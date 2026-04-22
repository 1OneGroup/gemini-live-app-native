// src/plivo/outbound.js
// Plivo outbound call management: makeCall, hangupCall, handleVoicemailDetected.
// makeCall pre-warms a Gemini session before placing the Plivo call so there is
// zero agent-speech delay when the callee picks up.

const { pendingSessions } = require('../gemini/session');
const { getActiveModel } = require('../config/models');

const PLIVO_AUTH_ID    = process.env.PLIVO_AUTH_ID;
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN;
const PLIVO_FROM_NUMBER = process.env.PLIVO_FROM_NUMBER;
const PUBLIC_URL        = process.env.PUBLIC_URL;

// Hang up an active Plivo call via the REST API.
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

// AMD callback: close the Gemini session, record voicemail outcome, hang up.
function handleVoicemailDetected(callUuid, store, sessions) {
  // Close Gemini session to stop wasting tokens
  const { WebSocket } = require('ws');
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

// Pre-warm Gemini then place the Plivo call.
// promptOverride: optional campaign-specific prompt (null = use global default/override)
async function makeCall(toNumber, customerName, promptOverride, whatsappMessageKey, employeeName, options = {}, deps = {}) {
  const { preWarmGemini, store, getSystemInstruction } = deps;

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

module.exports = { makeCall, hangupCall, handleVoicemailDetected };
