const http = require('http');
const { WebSocket, WebSocketServer } = require('ws');
const url = require('url');
const { mulawToPcm16k } = require('./audio-utils');
const { getSystemInstruction, saveSystemInstruction, resetToDefault, isUsingOverride, DEFAULT_PROMPT } = require('./prompts');
const store = require('./call-store');
const { getDashboardHtml } = require('./dashboard');
const db = require('./db');
const batchEngine = require('./batch-engine');
const whatsapp = require('./whatsapp');
const { safeJsonParse } = require('./src/lib/safe-json');
const { normalizePhone } = require('./src/lib/phone');
const { USD_INR, PLIVO_RATE, callCostInr } = require('./src/lib/pricing');
const {
  createGeminiSession,
  sendAudioToGemini,
  triggerOpeningGreeting,
  pendingSessions,
  sessions,
} = require('./src/gemini/session');
const { startPlivoPing } = require('./src/gemini/keepalive');

// --- Config ---
const PORT = process.env.PORT || 8100;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('[Server] OPENROUTER_API_KEY not set — DeepSeek classification and batch analysis will fall back to keyword matching / error summaries.');
}
const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID;
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN;
const PLIVO_FROM_NUMBER = process.env.PLIVO_FROM_NUMBER;
const PUBLIC_URL = process.env.PUBLIC_URL;
const { GEMINI_MODELS, getActiveModel, setActiveModel } = require('./src/config/models');

if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required');
if (!PLIVO_AUTH_ID || !PLIVO_AUTH_TOKEN) throw new Error('PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN required');

// Pre-warm wrapper — wires up the per-call deps (whatsapp, hangupCall) that
// session.js can't import itself without creating a circular require.
function preWarmGemini(callUuid, promptOverride) {
  return createGeminiSession({
    callUuid,
    promptOverride,
    isReconnect: false,
    deps: { whatsapp, hangupCall },
  });
}

// --- Express App + HTTP Server ---
const createApp = require('./src/app');
const app = createApp({
  store, db, whatsapp, batchEngine,
  getDashboardHtml, getSystemInstruction, saveSystemInstruction, isUsingOverride, DEFAULT_PROMPT,
  GEMINI_MODELS, getActiveModel, setActiveModel,
  callCostInr, safeJsonParse, normalizePhone,
  USD_INR, PLIVO_RATE,
  pendingSessions, sessions,
  makeCall, hangupCall, handleVoicemailDetected,
});
const server = http.createServer(app);

// --- WebSocket Server ---
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const parsed = url.parse(req.url);
  if (parsed.pathname === '/media-stream') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

wss.on('connection', (plivoWs) => {
  console.log('[Plivo] WebSocket connected');
  let streamId = null;
  let session = null;
  let firstAudioLogged = false;

  // Start Plivo keepalive pings
  startPlivoPing(plivoWs);

  plivoWs.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.event === 'start') {
      streamId = msg.start?.streamId || msg.streamId || `stream-${Date.now()}`;
      const callUuid = msg.start?.callId || 'unknown';
      console.log(`[Plivo] Stream started: ${streamId}, call: ${callUuid}`);

      store.updateCall(callUuid, { status: 'connected', answeredAt: new Date().toISOString() });

      // Attach to pre-warmed Gemini session
      session = pendingSessions.get(callUuid);
      if (session) {
        session.plivoWs = plivoWs;
        console.log(`[Bridge] Attached pre-warmed Gemini (ready=${session.ready}) to Plivo stream`);
      } else {
        // Fallback: no pre-warm (e.g. inbound or race condition)
        console.log('[Bridge] No pre-warmed session, connecting Gemini now');
        session = preWarmGemini(callUuid);
        session.plivoWs = plivoWs;
      }
      sessions.set(streamId, session);

      // Trigger agent to speak first — send a clientContent text turn so Gemini
      // generates its opening greeting immediately without waiting for user audio.
      if (session.ready && session.ws?.readyState === WebSocket.OPEN) {
        triggerOpeningGreeting(session, callUuid);
      } else {
        // Race condition: Gemini not ready yet. Flag so we trigger once setup completes.
        session._needsOpeningTrigger = true;
        console.log(`[Agent] Gemini not ready yet for ${callUuid}, will trigger opening on setup complete`);
      }
    }

    if (msg.event === 'media' && msg.media?.payload && session) {
      const audioBytes = Buffer.from(msg.media.payload, 'base64');
      if (!firstAudioLogged) { firstAudioLogged = true; console.log(`[Audio] First Plivo->Gemini: ${audioBytes.length}B`); }
      const pcm16k = mulawToPcm16k(audioBytes);

      if (session.ready && session.ws?.readyState === WebSocket.OPEN) {
        while (session.audioQueue.length > 0) sendAudioToGemini(session.ws, session.audioQueue.shift());
        sendAudioToGemini(session.ws, pcm16k);
      } else {
        // Buffer audio during reconnection (cap at 5 seconds worth to avoid memory bloat)
        if (session.audioQueue.length < 250) {
          session.audioQueue.push(pcm16k);
        }
      }
    }

    if (msg.event === 'stop') {
      console.log(`[Plivo] Stream stopped: ${streamId}`);
      cleanup(streamId);
    }
  });

  plivoWs.on('close', () => {
    console.log(`[Plivo] WebSocket closed: ${streamId}`);
    cleanup(streamId);
  });

  plivoWs.on('error', (err) => {
    console.error(`[Plivo] WebSocket error: ${err.message}`);
  });
});

function cleanup(streamId) {
  if (!streamId) return;
  const session = sessions.get(streamId);
  if (session) {
    if (session._pingInterval) clearInterval(session._pingInterval);
    if (session._sessionAgeTimer) clearTimeout(session._sessionAgeTimer);
    if (session._hangupTimer) clearTimeout(session._hangupTimer);
    if (session.plivoWs?._pingInterval) clearInterval(session.plivoWs._pingInterval);
    if (session.ws?.readyState === WebSocket.OPEN) session.ws.close();
    sessions.delete(streamId);
    if (session.callUuid) pendingSessions.delete(session.callUuid);
    console.log(`[Session] Cleaned up: ${streamId}`);
  }
}

// --- Plivo hangup call ---
function handleVoicemailDetected(callUuid) {
  // Close Gemini session to stop wasting tokens
  const session = pendingSessions.get(callUuid) ||
    [...sessions.values()].find(s => s.callUuid === callUuid);
  if (session?.ws?.readyState === WebSocket.OPEN) {
    session.ws.close();
  }
  pendingSessions.delete(callUuid);

  // Record outcome and log
  store.addTranscript(callUuid, 'system', '[Voicemail/answering machine detected — call terminated]');
  store.updateCall(callUuid, { outcome: 'voicemail', voicemailDetected: true });

  // Hang up via Plivo
  hangupCall(callUuid);
  console.log(`[AMD] Voicemail detected on ${callUuid} — hanging up`);
}

async function hangupCall(callUuid) {
  try {
    const authString = Buffer.from(`${PLIVO_AUTH_ID}:${PLIVO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(`https://api.plivo.com/v1/Account/${PLIVO_AUTH_ID}/Call/${callUuid}/`, {
      method: 'DELETE',
      headers: { 'Authorization': `Basic ${authString}` },
    });
    console.log(`[Hangup] Plivo API response: ${res.status}`);
  } catch (err) {
    console.error(`[Hangup] Error: ${err.message}`);
  }
}

// --- Plivo outbound call ---
// Pre-warms Gemini FIRST, waits for setup complete, THEN places the Plivo call.
// This ensures zero delay when the callee picks up.
// promptOverride: optional campaign-specific prompt (null = use global default/override)
async function makeCall(toNumber, customerName, promptOverride, whatsappMessageKey, employeeName, options = {}) {
  // Step 1: Pre-warm Gemini and wait for it to be ready
  const tempUuid = `pending-${Date.now()}`;
  const session = preWarmGemini(tempUuid, promptOverride);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Gemini pre-warm timed out after 10s')), 10000);
    const check = () => {
      if (session.ready) { clearTimeout(timeout); resolve(); }
      else setTimeout(check, 50);
    };
    check();
  });
  console.log(`[Gemini] Pre-warm ready, now placing Plivo call`);

  // Step 2: Place the Plivo call
  const authString = Buffer.from(`${PLIVO_AUTH_ID}:${PLIVO_AUTH_TOKEN}`).toString('base64');
  const answerUrl = `${PUBLIC_URL}/answer?customer_name=${encodeURIComponent(customerName)}`;

  const callParams = {
    from: PLIVO_FROM_NUMBER,
    to: toNumber,
    answer_url: answerUrl,
    answer_method: 'POST',
    hangup_url: `${PUBLIC_URL}/hangup`,
    hangup_method: 'POST',
    ring_timeout: 30,
  };

  // AMD is opt-in — only enable when explicitly requested (e.g. batch campaigns)
  // AMD was causing false positives that auto-disconnected real human calls after ~5s
  if (options.enableAMD) {
    callParams.machine_detection = 'true';
    callParams.machine_detection_url = `${PUBLIC_URL}/machine-detection`;
    callParams.machine_detection_time = 5000;
  }

  const body = JSON.stringify(callParams);

  const res = await fetch(`https://api.plivo.com/v1/Account/${PLIVO_AUTH_ID}/Call/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Plivo API error: ${JSON.stringify(data)}`);

  const realUuid = data.request_uuid;
  console.log(`[Plivo] Call initiated: ${realUuid} -> ${toNumber}`);

  // Remap the pre-warmed session from temp UUID to real call UUID
  pendingSessions.delete(tempUuid);
  session.callUuid = realUuid;
  pendingSessions.set(realUuid, session);

  // Create call log entry
  const activePrompt = promptOverride || await getSystemInstruction();
  store.createCall(realUuid, {
    to: toNumber,
    customerName,
    from: PLIVO_FROM_NUMBER,
    promptUsed: activePrompt,
    model: getActiveModel(),
    whatsappMessageKey: whatsappMessageKey || null,
    employeeName: employeeName || null,
  });

  return { ...data, callUuid: realUuid };
}

// Wire up batch engine with makeCall function
batchEngine.setMakeCallFn(makeCall);

// Sync callback data from call store to DB contacts on startup
async function syncCallbackData() {
  const allCalls = store.listCalls();
  let synced = 0;
  for (const call of allCalls) {
    if (!call.callUuid) continue;
    let fullCall = store.getCall(call.callUuid);
    if (!fullCall) continue;

    // Re-classify if outcome was set before multi-outcome support
    if (fullCall.outcome && !fullCall.outcome.includes(',')) {
      const oldOutcome = fullCall.outcome;
      store.updateCall(call.callUuid, { outcome: null });
      store.classifyCallOutcome(call.callUuid);
      fullCall = store.getCall(call.callUuid);
      if (fullCall.outcome && fullCall.outcome !== oldOutcome) {
        console.log(`[Sync] Re-classified ${call.callUuid}: ${oldOutcome} -> ${fullCall.outcome}`);
      }
    }

    // Re-extract callback timing if outcome has callback but no callbackDate
    if (fullCall.outcome && fullCall.outcome.includes('callback') && !fullCall.callbackDate) {
      const transcript = (fullCall.transcript || []).map(t => (t.text || '').toLowerCase()).join(' ');
      // Import extractCallbackTiming indirectly by re-running classification
      store.updateCall(call.callUuid, { outcome: null, callbackRequested: null, callbackDate: null });
      store.classifyCallOutcome(call.callUuid);
      fullCall = store.getCall(call.callUuid);
      if (fullCall.callbackDate) {
        console.log(`[Sync] Extracted callback timing for ${call.callUuid}: ${fullCall.callbackRequested} -> ${fullCall.callbackDate}`);
      }
    }

    // Sync callback/outcome data to matching DB contacts
    try {
      const contacts = await db.rawQuery('SELECT id, outcome, callback_date FROM contacts WHERE call_uuid = $1', [call.callUuid]);
      for (const contact of contacts) {
        const needsOutcomeUpdate = fullCall.outcome && fullCall.outcome !== contact.outcome;
        const needsCallbackUpdate = (fullCall.callbackDate || fullCall.callbackRequested) && !contact.callback_date;
        if (needsOutcomeUpdate || needsCallbackUpdate) {
          // Use raw SQL to allow overwriting outcome (COALESCE won't override existing)
          await db.rawExecute('UPDATE contacts SET outcome = $1, callback_date = $2, callback_note = $3 WHERE id = $4',
            [fullCall.outcome || contact.outcome, fullCall.callbackDate || null, fullCall.callbackRequested || null, contact.id]);
          synced++;
        }
      }
    } catch {}
  }
  if (synced > 0) console.log(`[Sync] Updated ${synced} contact(s) with callback/outcome data from call store`);
}

// Auto-callback cron — runs daily at 11:00 AM IST (5:30 AM UTC)
async function runAutoCallbacks() {
  const campaigns = await db.listCampaigns();
  for (const campaign of campaigns) {
    if (!campaign.auto_callback) continue;
    const callbacks = await db.getCallbackContacts(campaign.id);
    const now = new Date();
    const due = callbacks.filter(c => c.callback_date && new Date(c.callback_date) <= now);
    if (due.length === 0) continue;

    console.log(`[AutoCallback] Campaign "${campaign.name}": ${due.length} due callback(s)`);
    for (const contact of due) {
      try {
        const result = await makeCall(contact.phone, contact.name || 'Sir', campaign.prompt_override || null, campaign.whatsapp_message_key || null, null, { enableAMD: true });
        await db.updateContact(contact.id, { status: 'calling', callUuid: result.callUuid, outcome: null, callbackDate: null, callbackNote: null });
        console.log(`[AutoCallback] Called ${contact.name || contact.phone}: ${result.callUuid}`);
        // Wait between calls
        await new Promise(r => setTimeout(r, 5000));
      } catch (err) {
        console.error(`[AutoCallback] Failed to call ${contact.phone}:`, err.message);
      }
    }
  }
}

function scheduleAutoCallbackCron() {
  const CHECK_INTERVAL_MS = 60000; // Check every minute
  let lastRunDate = null;

  setInterval(() => {
    const now = new Date();
    // 11:00 AM IST = 5:30 AM UTC
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const todayStr = now.toISOString().split('T')[0];

    if (utcHour === 5 && utcMin === 30 && lastRunDate !== todayStr) {
      lastRunDate = todayStr;
      console.log(`[AutoCallback] Cron triggered at 11:00 AM IST (${todayStr})`);
      runAutoCallbacks().catch(err => console.error('[AutoCallback] Cron error:', err.message));
    }
  }, CHECK_INTERVAL_MS);

  console.log('[AutoCallback] Cron scheduled: daily at 11:00 AM IST');
}

// Initialize database then start server
db.init().then(() => {
  server.listen(PORT, async () => {
    console.log(`[Server] Gemini Live + Plivo bridge running on port ${PORT}`);
    console.log(`[Server] Dashboard: ${PUBLIC_URL}/dashboard`);
    setTimeout(() => syncCallbackData().catch(err => console.error('[Sync] Error:', err.message)), 1000);
    scheduleAutoCallbackCron();
    // Fix campaigns stuck in 'running' after restart (no active runners in memory)
    const stuck = await db.rawQuery("SELECT id, name FROM campaigns WHERE status = 'running'");
    for (const c of stuck) {
      await db.updateCampaign(c.id, { status: 'paused' });
      console.log(`[Startup] Reset stuck campaign "${c.name}" from running -> paused`);
    }
  });
}).catch(err => {
  console.error('[DB] Failed to initialize:', err.message);
  process.exit(1);
});
