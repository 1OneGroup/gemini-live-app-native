const http = require('http');
const { WebSocket, WebSocketServer } = require('ws');
const url = require('url');
const { mulawToPcm16k, pcm24kToMulaw } = require('./audio-utils');
const { getSystemInstruction, saveSystemInstruction, resetToDefault, isUsingOverride, DEFAULT_PROMPT } = require('./prompts');
const store = require('./call-store');
const { getDashboardHtml } = require('./dashboard');
const db = require('./db');
const batchEngine = require('./batch-engine');
const whatsapp = require('./whatsapp');
const { safeJsonParse } = require('./src/lib/safe-json');
const { normalizePhone } = require('./src/lib/phone');
const { USD_INR, PLIVO_RATE, callCostInr } = require('./src/lib/pricing');
const { OPENING_GREETING_CUE, CONTINUATION_CUE, END_CALL_DESCRIPTION } = require('./src/prompts/runtime-cues');

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

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required');
if (!PLIVO_AUTH_ID || !PLIVO_AUTH_TOKEN) throw new Error('PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN required');

// Pre-warmed Gemini sessions: callUuid -> { ws, ready, audioQueue, plivoWs, callUuid }
const pendingSessions = new Map();
// Active sessions: streamId -> session
const sessions = new Map();

// --- Connection keepalive ---
const { MAX_RECONNECTIONS, goodbyePhrases } = require('./src/config/constants');
const PING_INTERVAL_MS = 15000;  // Ping every 15s to prevent proxy idle timeout
const GEMINI_SESSION_MAX_MS = 9 * 60 * 1000;  // Warn at 9 min (Gemini limit is ~10 min)
const STALE_SESSION_CHECK_MS = 30000;  // Check for stale sessions every 30s

function startGeminiPing(session) {
  if (session._pingInterval) clearInterval(session._pingInterval);
  session._pingInterval = setInterval(() => {
    if (session.ws?.readyState === WebSocket.OPEN) {
      session.ws.ping();
    } else {
      clearInterval(session._pingInterval);
    }
  }, PING_INTERVAL_MS);
}

function startPlivoPing(plivoWs) {
  if (plivoWs._pingInterval) clearInterval(plivoWs._pingInterval);
  plivoWs._pingInterval = setInterval(() => {
    if (plivoWs.readyState === WebSocket.OPEN) {
      plivoWs.ping();
    } else {
      clearInterval(plivoWs._pingInterval);
    }
  }, PING_INTERVAL_MS);
}

// Stale session cleanup
setInterval(() => {
  const now = Date.now();
  for (const [uuid, session] of pendingSessions) {
    // Remove pre-warmed sessions that never connected after 2 minutes
    if (session._createdAt && now - session._createdAt > 120000 && !session.plivoWs) {
      console.log(`[Cleanup] Removing stale pending session: ${uuid}`);
      if (session.ws?.readyState === WebSocket.OPEN) session.ws.close();
      if (session._pingInterval) clearInterval(session._pingInterval);
      if (session._sessionAgeTimer) clearTimeout(session._sessionAgeTimer);
      pendingSessions.delete(uuid);
    }
  }
}, STALE_SESSION_CHECK_MS);

// --- Trigger opening greeting ---
// Sends a realtimeInput text message to Gemini so it starts speaking immediately.
// Uses realtimeInput.text (the correct Live API format), not clientContent.
function triggerOpeningGreeting(session, callUuid) {
  console.log(`[Agent] Triggering opening greeting via realtimeInput.text for call ${callUuid}`);
  session._openingTriggeredAt = Date.now();
  session.ws.send(JSON.stringify({
    realtimeInput: {
      text: OPENING_GREETING_CUE
    }
  }));
}

// --- Pre-warm Gemini connection ---
// Called at call initiation time (before callee answers) to eliminate delay
function preWarmGemini(callUuid, promptOverride) {
  console.log(`[Gemini] Pre-warming for call ${callUuid}`);
  const session = {
    ws: null,
    ready: false,
    audioQueue: [],
    plivoWs: null,
    callUuid,
    agentTextBuffer: '',
    _createdAt: Date.now(),
    _reconnecting: false,
    _reconnectCount: 0,
  };

  const ws = new WebSocket(GEMINI_WS_URL);
  session.ws = ws;

  ws.on('open', async () => {
    console.log(`[Gemini] Pre-warm connected, sending setup...`);
    const t0 = Date.now();
    session._setupStart = t0;
    ws.send(JSON.stringify({
      setup: {
        model: getActiveModel(),
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          },
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
        systemInstruction: {
          parts: [{ text: promptOverride || await getSystemInstruction() }]
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
            endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
            prefixPaddingMs: 40,
            silenceDurationMs: 300,
          },
          activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
          turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
        },
        tools: [{
          functionDeclarations: [{
            name: 'end_call',
            description: END_CALL_DESCRIPTION,
          }, {
            name: 'send_brochure',
            description: 'Send a property brochure PDF to the customer via WhatsApp. Call this when the customer expresses interest and you have offered to send details or a brochure.',
            parameters: {
              type: 'OBJECT',
              properties: {
                project_name: {
                  type: 'STRING',
                  description: 'The real estate project name (e.g. Clermont, Mohali Heights)',
                },
              },
              required: ['project_name'],
            },
          }]
        }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      }
    }));
  });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.setupComplete) {
      const elapsed = session._setupStart ? Date.now() - session._setupStart : '?';
      console.log(`[Gemini] Pre-warm setup complete in ${elapsed}ms`);
      session.ready = true;
      // Start keepalive pings
      startGeminiPing(session);
      // Track session age — warn before Gemini's ~10 min limit
      session._sessionAgeTimer = setTimeout(() => {
        console.warn(`[Gemini] Session ${callUuid} approaching 10-min limit, consider wrapping up`);
        store.addTranscript(callUuid, 'system', '[Warning: Gemini session nearing 10-minute limit]');
      }, GEMINI_SESSION_MAX_MS);
      // Flush any buffered audio
      while (session.audioQueue.length > 0) {
        sendAudioToGemini(ws, session.audioQueue.shift());
      }
      // If Plivo connected before Gemini was ready, trigger opening now
      if (session._needsOpeningTrigger && session.plivoWs?.readyState === WebSocket.OPEN) {
        session._needsOpeningTrigger = false;
        triggerOpeningGreeting(session, callUuid);
      }
    }

    // Handle GoAway — Gemini signals it will disconnect soon; proactively reconnect
    if (msg.goAway) {
      console.warn(`[Gemini] GoAway received for call ${callUuid} — proactively reconnecting`);
      store.addTranscript(callUuid, 'system', '[Gemini session ending — reconnecting proactively]');
      if (session.plivoWs?.readyState === WebSocket.OPEN && !session._reconnecting && session._reconnectCount < MAX_RECONNECTIONS) {
        session._reconnecting = true;
        session._reconnectCount++;
        console.log(`[Gemini] Proactive reconnect #${session._reconnectCount} for ${callUuid}`);
        reconnectGemini(session, callUuid);
      }
    }

    // Handle interruption — user barged in while agent was speaking
    if (msg.serverContent?.interrupted) {
      console.log('[Gemini] Interrupted by user — clearing Plivo audio');
      if (session.plivoWs?.readyState === WebSocket.OPEN) {
        session.plivoWs.send(JSON.stringify({ event: 'clearAudio' }));
      }
      // Clear any buffered agent transcript since it was interrupted
      session.agentTranscriptBuffer = '';
    }

    // Handle audio from Gemini -> Plivo
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
          // Log time-to-first-audio from opening trigger
          if (!session._firstAudioSent && session._openingTriggeredAt) {
            const latency = Date.now() - session._openingTriggeredAt;
            console.log(`[Timing] First audio from Gemini ${latency}ms after opening trigger (call ${callUuid})`);
            session._firstAudioSent = true;
          }
          const pcm24k = Buffer.from(part.inlineData.data, 'base64');
          const mulaw = pcm24kToMulaw(pcm24k);
          const payload = mulaw.toString('base64');
          if (session.plivoWs?.readyState === WebSocket.OPEN) {
            session.plivoWs.send(JSON.stringify({
              event: 'playAudio',
              media: { contentType: 'audio/x-mulaw', sampleRate: 8000, payload }
            }));
          }
        }
        if (part.text) {
          session.agentTextBuffer += part.text;
        }
      }
    }

    // Buffer output transcription (agent speech) — consolidate into full turns
    const outTx = msg.serverContent?.outputTranscription || msg.serverContent?.output_transcription;
    if (outTx?.text) {
      session.agentTranscriptBuffer = (session.agentTranscriptBuffer || '') + outTx.text;
    }

    // Buffer input transcription (user speech) — consolidate into full turns
    const inTx = msg.serverContent?.inputTranscription || msg.serverContent?.input_transcription;
    if (inTx?.text) {
      session.userTranscriptBuffer = (session.userTranscriptBuffer || '') + inTx.text;
    }

    if (msg.serverContent?.turnComplete) {
      // Flush user transcript buffer first (user spoke before agent responded)
      if (session.userTranscriptBuffer?.trim()) {
        console.log(`[Transcript] User: ${session.userTranscriptBuffer.trim().substring(0, 200)}`);
        store.addTranscript(session.callUuid, 'user', session.userTranscriptBuffer.trim());
        session.userTranscriptBuffer = '';
      }
      // Flush agent transcript buffer
      const agentText = session.agentTranscriptBuffer?.trim() || '';
      if (agentText) {
        console.log(`[Transcript] Agent: ${agentText.substring(0, 200)}`);
        store.addTranscript(session.callUuid, 'agent', agentText);
        session.agentTranscriptBuffer = '';
      }
      // Fallback: text parts from model turn
      if (session.agentTextBuffer?.trim()) {
        store.addTranscript(session.callUuid, 'agent', session.agentTextBuffer.trim());
        session.agentTextBuffer = '';
      }
      console.log('[Gemini] Turn complete');

      // Auto-hangup detection: if agent said goodbye phrases, hang up after a short delay
      const lower = agentText.toLowerCase();
      if (goodbyePhrases.some(p => lower.includes(p))) {
        console.log(`[Hangup] Detected closing phrase, scheduling hangup in 3s`);
        if (session._hangupTimer) clearTimeout(session._hangupTimer);
        session._hangupTimer = setTimeout(() => {
          console.log(`[Hangup] Auto-hanging up call ${session.callUuid}`);
          store.addTranscript(session.callUuid, 'system', '[Call ended by agent - auto hangup]');
          hangupCall(session.callUuid);
        }, 3000);
      }
    }

    // Track token usage from Gemini
    if (msg.usageMetadata) {
      const um = msg.usageMetadata;
      store.addTokens(session.callUuid, um.promptTokenCount || 0, um.candidatesTokenCount || um.responseTokenCount || 0);
    }

    // Also flush user buffer when agent starts a new turn (user interrupted or spoke between turns)
    if (msg.serverContent?.modelTurn && session.userTranscriptBuffer?.trim()) {
      console.log(`[Transcript] User: ${session.userTranscriptBuffer.trim().substring(0, 200)}`);
      store.addTranscript(session.callUuid, 'user', session.userTranscriptBuffer.trim());
      session.userTranscriptBuffer = '';
    }

    // Handle function calls from Gemini (e.g. end_call, send_brochure)
    if (msg.toolCall?.functionCalls) {
      for (const fc of msg.toolCall.functionCalls) {
        console.log(`[Gemini] Tool call: ${fc.name}`);
        if (fc.name === 'end_call') {
          console.log(`[Hangup] Bot ending call ${session.callUuid}`);
          store.addTranscript(session.callUuid, 'system', '[Call ended by agent]');
          ws.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{
                id: fc.id,
                response: { result: 'Call ended successfully.' }
              }]
            }
          }));
          setTimeout(() => hangupCall(session.callUuid), 2000);
        }
        if (fc.name === 'send_brochure') {
          const call = store.getCall(session.callUuid);
          const projectName = call?.whatsappMessageKey || fc.args?.project_name || 'clermont';
          const phone = call?.to || '';
          console.log(`[WhatsApp] Sending ${projectName} message to ${phone}`);
          store.addTranscript(session.callUuid, 'system', `[Sending ${projectName} WhatsApp message to ${phone}]`);
          whatsapp.sendBrochure(phone, projectName, call?.employeeName).then(result => {
            ws.send(JSON.stringify({
              toolResponse: {
                functionResponses: [{
                  id: fc.id,
                  response: { result: result.success ? 'Brochure sent successfully via WhatsApp.' : `Failed to send: ${result.error}` }
                }]
              }
            }));
          }).catch(() => {
            ws.send(JSON.stringify({
              toolResponse: {
                functionResponses: [{
                  id: fc.id,
                  response: { result: 'Failed to send brochure, but will try again later.' }
                }]
              }
            }));
          });
        }
      }
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[Gemini] Closed: ${code} ${reason}`);
    session.ready = false;
    if (session._pingInterval) clearInterval(session._pingInterval);
    if (session._sessionAgeTimer) clearTimeout(session._sessionAgeTimer);

    // Attempt reconnection if the call is still active and under the reconnect limit
    if (session.plivoWs?.readyState === WebSocket.OPEN && !session._reconnecting && session._reconnectCount < MAX_RECONNECTIONS) {
      session._reconnecting = true;
      session._reconnectCount++;
      console.log(`[Gemini] Call ${callUuid} still active — reconnect attempt #${session._reconnectCount}...`);
      store.addTranscript(callUuid, 'system', `[Gemini disconnected — reconnecting (attempt ${session._reconnectCount}/${MAX_RECONNECTIONS})...]`);
      reconnectGemini(session, callUuid);
    } else if (session.plivoWs?.readyState === WebSocket.OPEN && session._reconnectCount >= MAX_RECONNECTIONS) {
      console.log(`[Gemini] Max reconnections reached for ${callUuid} — ending call`);
      store.addTranscript(callUuid, 'system', '[Gemini max reconnections reached — ending call]');
      hangupCall(callUuid);
    }
  });

  ws.on('error', (err) => {
    console.error(`[Gemini] Error: ${err.message}`);
  });

  ws.on('pong', () => {
    session._lastPong = Date.now();
  });

  pendingSessions.set(callUuid, session);
  return session;
}

// --- Gemini Reconnection ---
function reconnectGemini(session, callUuid) {
  const ws = new WebSocket(GEMINI_WS_URL);
  session.ws = ws;

  ws.on('open', async () => {
    console.log(`[Gemini] Reconnect WS open for ${callUuid}, sending setup...`);
    session._setupStart = Date.now();
    ws.send(JSON.stringify({
      setup: {
        model: getActiveModel(),
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          },
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
        systemInstruction: {
          parts: [{ text: await getSystemInstruction() }]
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
            endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
            prefixPaddingMs: 40,
            silenceDurationMs: 300,
          },
          activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
          turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
        },
        tools: [{
          functionDeclarations: [{
            name: 'end_call',
            description: END_CALL_DESCRIPTION,
          }, {
            name: 'send_brochure',
            description: 'Send a property brochure PDF to the customer via WhatsApp. Call this when the customer expresses interest and you have offered to send details or a brochure.',
            parameters: {
              type: 'OBJECT',
              properties: {
                project_name: {
                  type: 'STRING',
                  description: 'The real estate project name (e.g. Clermont, Mohali Heights)',
                },
              },
              required: ['project_name'],
            },
          }]
        }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      }
    }));
  });

  // Reuse the same message handler from the original session
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.setupComplete) {
      const elapsed = session._setupStart ? Date.now() - session._setupStart : '?';
      console.log(`[Gemini] Reconnect setup complete in ${elapsed}ms for ${callUuid}`);
      session.ready = true;
      session._reconnecting = false;
      startGeminiPing(session);
      session._sessionAgeTimer = setTimeout(() => {
        console.warn(`[Gemini] Reconnected session ${callUuid} approaching 10-min limit`);
      }, GEMINI_SESSION_MAX_MS);
      store.addTranscript(callUuid, 'system', '[Gemini reconnected successfully]');
      // Flush buffered audio
      while (session.audioQueue.length > 0) {
        sendAudioToGemini(ws, session.audioQueue.shift());
      }
      // On first reconnect, re-trigger greeting so user knows agent is back
      // On subsequent reconnects, send a context cue instead of full greeting
      if (session.plivoWs?.readyState === WebSocket.OPEN) {
        session._firstAudioSent = false;
        if (session._reconnectCount <= 1) {
          triggerOpeningGreeting(session, callUuid);
        } else {
          // Send a short context cue to resume conversation without re-introducing
          ws.send(JSON.stringify({
            realtimeInput: {
              text: CONTINUATION_CUE
            }
          }));
        }
      }
    }

    if (msg.goAway) {
      console.warn(`[Gemini] GoAway on reconnected session ${callUuid} — proactively reconnecting`);
      store.addTranscript(callUuid, 'system', '[Gemini reconnected session ending — reconnecting proactively]');
      if (session.plivoWs?.readyState === WebSocket.OPEN && !session._reconnecting && session._reconnectCount < MAX_RECONNECTIONS) {
        session._reconnecting = true;
        session._reconnectCount++;
        console.log(`[Gemini] Proactive reconnect #${session._reconnectCount} for ${callUuid}`);
        reconnectGemini(session, callUuid);
      }
    }

    if (msg.serverContent?.interrupted) {
      if (session.plivoWs?.readyState === WebSocket.OPEN) {
        session.plivoWs.send(JSON.stringify({ event: 'clearAudio' }));
      }
      session.agentTranscriptBuffer = '';
    }

    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
          const pcm24k = Buffer.from(part.inlineData.data, 'base64');
          const mulaw = pcm24kToMulaw(pcm24k);
          const payload = mulaw.toString('base64');
          if (session.plivoWs?.readyState === WebSocket.OPEN) {
            session.plivoWs.send(JSON.stringify({
              event: 'playAudio',
              media: { contentType: 'audio/x-mulaw', sampleRate: 8000, payload }
            }));
          }
        }
        if (part.text) {
          session.agentTextBuffer += part.text;
        }
      }
    }

    const outTx = msg.serverContent?.outputTranscription || msg.serverContent?.output_transcription;
    if (outTx?.text) {
      session.agentTranscriptBuffer = (session.agentTranscriptBuffer || '') + outTx.text;
    }

    const inTx = msg.serverContent?.inputTranscription || msg.serverContent?.input_transcription;
    if (inTx?.text) {
      session.userTranscriptBuffer = (session.userTranscriptBuffer || '') + inTx.text;
    }

    if (msg.serverContent?.turnComplete) {
      if (session.userTranscriptBuffer?.trim()) {
        store.addTranscript(session.callUuid, 'user', session.userTranscriptBuffer.trim());
        session.userTranscriptBuffer = '';
      }
      const agentText = session.agentTranscriptBuffer?.trim() || '';
      if (agentText) {
        store.addTranscript(session.callUuid, 'agent', agentText);
        session.agentTranscriptBuffer = '';
      }
      if (session.agentTextBuffer?.trim()) {
        store.addTranscript(session.callUuid, 'agent', session.agentTextBuffer.trim());
        session.agentTextBuffer = '';
      }
      const lower = agentText.toLowerCase();
      if (goodbyePhrases.some(p => lower.includes(p))) {
        if (session._hangupTimer) clearTimeout(session._hangupTimer);
        session._hangupTimer = setTimeout(() => {
          console.log(`[Hangup] Auto-hanging up call ${session.callUuid} (reconnect handler)`);
          store.addTranscript(session.callUuid, 'system', '[Call ended by agent - auto hangup]');
          hangupCall(session.callUuid);
        }, 3000);
      }
    }

    // Track token usage from Gemini (reconnect handler)
    if (msg.usageMetadata) {
      const um = msg.usageMetadata;
      store.addTokens(session.callUuid, um.promptTokenCount || 0, um.candidatesTokenCount || um.responseTokenCount || 0);
    }

    if (msg.toolCall?.functionCalls) {
      for (const fc of msg.toolCall.functionCalls) {
        if (fc.name === 'end_call') {
          store.addTranscript(session.callUuid, 'system', '[Call ended by agent]');
          ws.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{
                id: fc.id,
                response: { result: 'Call ended successfully.' }
              }]
            }
          }));
          setTimeout(() => hangupCall(session.callUuid), 2000);
        }
        if (fc.name === 'send_brochure') {
          const projectName = fc.args?.project_name || 'clermont';
          const call = store.getCall(session.callUuid);
          const phone = call?.to || '';
          whatsapp.sendBrochure(phone, projectName, call?.employeeName).then(result => {
            ws.send(JSON.stringify({
              toolResponse: {
                functionResponses: [{
                  id: fc.id,
                  response: { result: result.success ? 'Brochure sent successfully via WhatsApp.' : `Failed: ${result.error}` }
                }]
              }
            }));
          }).catch(() => {
            ws.send(JSON.stringify({
              toolResponse: {
                functionResponses: [{
                  id: fc.id,
                  response: { result: 'Failed to send brochure.' }
                }]
              }
            }));
          });
        }
      }
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[Gemini] Reconnected session closed: ${code} ${reason}`);
    session.ready = false;
    if (session._pingInterval) clearInterval(session._pingInterval);
    if (session._sessionAgeTimer) clearTimeout(session._sessionAgeTimer);
    // Attempt further reconnection if under the limit
    if (session.plivoWs?.readyState === WebSocket.OPEN && !session._reconnecting && session._reconnectCount < MAX_RECONNECTIONS) {
      session._reconnecting = true;
      session._reconnectCount++;
      console.log(`[Gemini] Reconnect attempt #${session._reconnectCount} for ${callUuid}...`);
      store.addTranscript(callUuid, 'system', `[Gemini session closed — reconnecting (attempt ${session._reconnectCount}/${MAX_RECONNECTIONS})...]`);
      reconnectGemini(session, callUuid);
    } else if (session.plivoWs?.readyState === WebSocket.OPEN && session._reconnectCount >= MAX_RECONNECTIONS) {
      console.log(`[Gemini] Max reconnections (${MAX_RECONNECTIONS}) reached for ${callUuid} — ending call`);
      store.addTranscript(callUuid, 'system', '[Gemini max reconnections reached — ending call]');
      hangupCall(callUuid);
    }
  });

  ws.on('error', (err) => {
    console.error(`[Gemini] Reconnect error: ${err.message}`);
  });

  ws.on('pong', () => {
    session._lastPong = Date.now();
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

function sendAudioToGemini(ws, pcmBuffer) {
  ws.send(JSON.stringify({
    realtimeInput: {
      audio: { mimeType: 'audio/pcm;rate=16000', data: pcmBuffer.toString('base64') }
    }
  }));
}

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
