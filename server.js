require('dotenv').config();
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

// --- Config ---
const PORT = process.env.PORT || 8100;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID;
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN;
const PLIVO_FROM_NUMBER = process.env.PLIVO_FROM_NUMBER;
const PUBLIC_URL = process.env.PUBLIC_URL;
const GEMINI_MODEL_DEFAULT = process.env.GEMINI_MODEL || 'models/gemini-3.1-flash-live-preview';
// Pricing source: https://ai.google.dev/gemini-api/docs/pricing
const GEMINI_MODELS = {
  'models/gemini-3.1-flash-live-preview': {
    name: 'Gemini 3.1 Flash Live', shortName: '3.1 Flash',
    pricing: { // USD per 1M tokens
      textInput: 0.75, audioInput: 3.00, textOutput: 4.50, audioOutput: 12.00,
      audioInputPerMin: 0.005, audioOutputPerMin: 0.018,
    },
  },
  'models/gemini-2.5-flash-live-preview': {
    name: 'Gemini 2.5 Flash Live', shortName: '2.5 Flash',
    pricing: { // USD per 1M tokens
      textInput: 0.50, audioInput: 3.00, textOutput: 2.00, audioOutput: 12.00,
      audioInputPerMin: 0.005, audioOutputPerMin: 0.018, // same per-min as 3.1
    },
  },
};
const fs_model = require('fs');
const MODEL_OVERRIDE_PATH = require('path').join(process.env.DATA_DIR || '/data', 'model-override.txt');

function getActiveModel() {
  try {
    if (fs_model.existsSync(MODEL_OVERRIDE_PATH)) {
      const m = fs_model.readFileSync(MODEL_OVERRIDE_PATH, 'utf8').trim();
      if (m && GEMINI_MODELS[m]) return m;
    }
  } catch {}
  return GEMINI_MODEL_DEFAULT;
}

function setActiveModel(model) {
  const dir = require('path').dirname(MODEL_OVERRIDE_PATH);
  if (!fs_model.existsSync(dir)) fs_model.mkdirSync(dir, { recursive: true });
  fs_model.writeFileSync(MODEL_OVERRIDE_PATH, model, 'utf8');
}

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required');
if (!PLIVO_AUTH_ID || !PLIVO_AUTH_TOKEN) throw new Error('PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN required');

// Pre-warmed Gemini sessions: callUuid -> { ws, ready, audioQueue, plivoWs, callUuid }
const pendingSessions = new Map();
// Active sessions: streamId -> session
const sessions = new Map();

// --- Connection keepalive ---
const PING_INTERVAL_MS = 15000;  // Ping every 15s to prevent proxy idle timeout
const GEMINI_SESSION_MAX_MS = 9 * 60 * 1000;  // Warn at 9 min (Gemini limit is ~10 min)
const MAX_RECONNECTIONS = 5;  // Allow up to 5 Gemini session reconnections per call
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
      text: '[The phone call has just connected. The customer has picked up. Start speaking now with your opening greeting immediately.]'
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
            description: 'End the phone call. You MUST call this function immediately after saying goodbye or any closing phrase. The call will NOT disconnect unless you call this function. Always call end_call after your final farewell — never just say bye without calling it.',
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
      const goodbyePhrases = [
        'shukriya aapka time', 'aapka din bahut achha ho',
        'have a good', 'have a great', 'have a wonderful', 'have a nice day',
        'thank you so much for your time', 'thank you for your time',
        'bye!', 'goodbye', 'good bye', 'bye bye',
        'alvida', 'phir milte hain', 'namaste ji',
        'call end karti', 'call end karta', 'call disconnect',
        'see you then!', 'see you soon',
      ];
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
            description: 'End the phone call. You MUST call this function immediately after saying goodbye or any closing phrase. The call will NOT disconnect unless you call this function. Always call end_call after your final farewell — never just say bye without calling it.',
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
              text: '[System: The call is still ongoing. Continue the conversation naturally from where you left off. Do not re-introduce yourself or repeat your greeting.]'
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
      const goodbyePhrases = [
        'shukriya aapka time', 'aapka din bahut achha ho',
        'have a good', 'have a great', 'have a wonderful', 'have a nice day',
        'thank you so much for your time', 'thank you for your time',
        'bye!', 'goodbye', 'good bye', 'bye bye',
        'alvida', 'phir milte hain', 'namaste ji',
        'call end karti', 'call end karta', 'call disconnect',
        'see you then!', 'see you soon',
      ];
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

// --- HTTP Server ---
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  // Dashboard
  if (parsed.pathname === '/' || parsed.pathname === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    res.end(getDashboardHtml());
    return;
  }

  if (parsed.pathname === '/api/calls' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(store.listCalls()));
    return;
  }

  if (parsed.pathname.startsWith('/api/calls/') && req.method === 'GET') {
    const callUuid = parsed.pathname.split('/api/calls/')[1];
    const call = store.getCall(callUuid);
    if (!call) { res.writeHead(404); res.end('Not found'); return; }
    // Compute cost in INR — model-specific pricing
    const USD_INR = 84;
    const dur = (call.duration || 0) / 60;
    const plivoCost = Math.round(dur * 0.74 * 100) / 100;
    const t = call.tokens || {};
    const mp = GEMINI_MODELS[call.model]?.pricing || GEMINI_MODELS[getActiveModel()]?.pricing || GEMINI_MODELS['models/gemini-3.1-flash-live-preview'].pricing;
    const geminiCost = (t.inputTokens || 0) > 0
      ? Math.round(((t.inputTokens / 1e6 * mp.audioInput) + (t.outputTokens / 1e6 * mp.audioOutput)) * USD_INR * 100) / 100
      : Math.round(dur * (mp.audioInputPerMin + mp.audioOutputPerMin) * USD_INR * 100) / 100;
    call.costINR = {
      plivo: plivoCost, gemini: geminiCost, total: Math.round((plivoCost + geminiCost) * 100) / 100,
      model: call.model || getActiveModel(), modelName: GEMINI_MODELS[call.model]?.name || GEMINI_MODELS[getActiveModel()]?.name || 'Unknown',
    };
    // Auto-classify if missing, not AI-classified, or confidence not yet recorded
    const aiOutcomes = ['interested', 'not_interested', 'needs_review', 'follow_up'];
    if ((call.status === 'completed' || call.hangupCause) && (!aiOutcomes.includes(call.outcome) || call.confidence == null)) {
      await store.classifyWithGemini(callUuid, OPENROUTER_API_KEY);
      const updated = store.getCall(callUuid);
      call.outcome = updated?.outcome || null;
      call.confidence = updated?.confidence || null;
      call.classificationReason = updated?.classificationReason || null;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(call));
    return;
  }

  if (parsed.pathname === '/api/prompt' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ prompt: await getSystemInstruction(), isOverride: isUsingOverride(), defaultPrompt: DEFAULT_PROMPT }));
    return;
  }

  if (parsed.pathname === '/api/prompt' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { prompt } = JSON.parse(body);
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Prompt text is required' }));
          return;
        }
        saveSystemInstruction(prompt.trim());
        console.log(`[Prompt] Saved custom prompt (${prompt.trim().length} chars)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, length: prompt.trim().length, isOverride: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (parsed.pathname === '/api/prompt' && req.method === 'DELETE') {
    resetToDefault();
    console.log('[Prompt] Reset to default');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, isOverride: false }));
    return;
  }

  // Plivo answer URL
  if (parsed.pathname === '/answer' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const wsUrl = `${PUBLIC_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/media-stream`;
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record recordSession="true" action="${PUBLIC_URL}/recording-callback" startRecordingAudio="${PUBLIC_URL}/recording-status" maxLength="3600" redirect="false" />
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000" statusCallbackUrl="${PUBLIC_URL}/stream-status">
    ${wsUrl}
  </Stream>
</Response>`;
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(xml);
      console.log('[HTTP] Answer URL served');
    });
    return;
  }

  if (parsed.pathname === '/stream-status' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { res.writeHead(200); res.end('OK'); });
    return;
  }

  if (parsed.pathname === '/recording-callback' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const callUuid = params.get('CallUUID');
      const recordingUrl = params.get('RecordUrl') || params.get('RecordingUrl');
      console.log(`[Recording] Call ${callUuid}: ${recordingUrl}`);
      if (callUuid && recordingUrl) store.updateCall(callUuid, { recordingUrl });
      res.writeHead(200); res.end('OK');
    });
    return;
  }

  if (parsed.pathname === '/recording-status' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { res.writeHead(200); res.end('OK'); });
    return;
  }

  if (parsed.pathname === '/hangup' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const callUuid = params.get('CallUUID');
      const duration = parseInt(params.get('Duration') || '0');
      const hangupCause = params.get('HangupCauseName') || params.get('HangupCause');
      const totalCost = params.get('TotalCost');
      const callStatus = params.get('CallStatus');
      const endTime = params.get('EndTime');
      const answerTime = params.get('AnswerTime');

      console.log(`[Hangup] ${callUuid}: ${callStatus}, ${duration}s, ${hangupCause}`);
      if (callUuid) {
        store.updateCall(callUuid, {
          status: callStatus || 'completed',
          duration, hangupCause, cost: totalCost,
          endedAt: endTime || new Date().toISOString(),
          answeredAt: answerTime || null,
        });
        // Classify outcome after a short delay to let final transcripts flush
        setTimeout(async () => {
          await store.classifyWithGemini(callUuid, OPENROUTER_API_KEY);
          const call = store.getCall(callUuid);
          console.log(`[Outcome] ${callUuid}: ${call?.outcome}`);
        }, 5000);
        pendingSessions.delete(callUuid);
      }
      res.writeHead(200); res.end('OK');
    });
    return;
  }

  // Answering Machine Detection callback from Plivo
  if (parsed.pathname === '/machine-detection' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const callUuid = params.get('CallUUID');
      const isMachine = params.get('Machine') === 'true';
      console.log(`[AMD] Call ${callUuid}: machine=${isMachine}`);
      if (isMachine && callUuid) {
        handleVoicemailDetected(callUuid);
      }
      res.writeHead(200); res.end('OK');
    });
    return;
  }

  // Call initiation
  if (parsed.pathname === '/call' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body);
        const toNumber = params.to || '+919899050706';
        const customerName = params.customer_name || 'Sir';
        const result = await makeCall(toNumber, customerName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[HTTP] Call error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (parsed.pathname === '/health') {
    const activeSessions = [];
    for (const [sid, s] of sessions) {
      activeSessions.push({
        streamId: sid,
        callUuid: s.callUuid,
        geminiReady: s.ready,
        geminiWsState: s.ws?.readyState,
        plivoWsState: s.plivoWs?.readyState,
        ageMs: s._createdAt ? Date.now() - s._createdAt : null,
        lastPong: s._lastPong ? Date.now() - s._lastPong : null,
        reconnecting: s._reconnecting || false,
        reconnectCount: s._reconnectCount || 0,
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      sessions: sessions.size,
      pending: pendingSessions.size,
      activeSessions,
    }));
    return;
  }

  // --- Campaign API Routes ---

  // Helper: parse JSON body
  function parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 10e6) { req.destroy(); reject(new Error('Body too large')); } });
      req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    });
  }

  function json(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // List campaigns
  if (parsed.pathname === '/api/campaigns' && req.method === 'GET') {
    const rawCampaigns = await db.listCampaigns();
    const campaigns = [];
    for (const c of rawCampaigns) {
      campaigns.push({ ...c, stats: await db.getContactStats(c.id), isRunning: batchEngine.isRunning(c.id) });
    }
    json(res, campaigns);
    return;
  }

  // Create campaign
  if (parsed.pathname === '/api/campaigns' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.name) { json(res, { error: 'name is required' }, 400); return; }
      const campaign = await db.createCampaign({
        name: body.name,
        promptOverride: body.prompt_override,
        batchSize: body.batch_size || 100,
        maxConcurrent: body.max_concurrent || 1,
        whatsappMessageKey: body.whatsapp_message_key || null,
      });
      json(res, campaign, 201);
    } catch (err) { json(res, { error: err.message }, 400); }
    return;
  }

  // Campaign detail
  const campaignMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)$/);
  if (campaignMatch && req.method === 'GET') {
    const campaign = await db.getCampaign(campaignMatch[1]);
    if (!campaign) { json(res, { error: 'Not found' }, 404); return; }
    const stats = await db.getContactStats(campaign.id);
    const analyses = await db.listAnalyses(campaign.id);
    const maxBatch = await db.getMaxBatch(campaign.id);
    json(res, { ...campaign, stats, analyses, maxBatch, isRunning: batchEngine.isRunning(campaign.id), runner: batchEngine.getRunnerStatus(campaign.id) });
    return;
  }

  // Update campaign
  if (campaignMatch && req.method === 'PATCH') {
    try {
      const body = await parseBody(req);
      const campaign = await db.updateCampaign(campaignMatch[1], {
        name: body.name, status: body.status, promptOverride: body.prompt_override,
        batchSize: body.batch_size, maxConcurrent: body.max_concurrent,
      });
      if (!campaign) { json(res, { error: 'Not found' }, 404); return; }
      json(res, campaign);
    } catch (err) { json(res, { error: err.message }, 400); }
    return;
  }

  // Delete campaign
  if (campaignMatch && req.method === 'DELETE') {
    await db.deleteCampaign(campaignMatch[1]);
    json(res, { ok: true });
    return;
  }

  // CSV upload
  const uploadMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/upload$/);
  if (uploadMatch && req.method === 'POST') {
    const campaignId = uploadMatch[1];
    const campaign = await db.getCampaign(campaignId);
    if (!campaign) { json(res, { error: 'Campaign not found' }, 404); return; }

    let rawBody = '';
    req.on('data', c => { rawBody += c; if (rawBody.length > 10e6) { req.destroy(); return; } });
    req.on('end', async () => {
      try {
        // Handle both JSON array and CSV text
        let contacts;
        const contentType = req.headers['content-type'] || '';

        if (contentType.includes('application/json')) {
          const parsed = JSON.parse(rawBody);
          contacts = parsed.contacts || parsed;
        } else {
          // Parse CSV
          const lines = rawBody.trim().split('\n');
          if (lines.length < 2) { json(res, { error: 'CSV must have a header row and at least one data row' }, 400); return; }
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
          const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'mobile' || h === 'number' || h === 'phone_number');
          const nameIdx = headers.findIndex(h => h === 'name' || h === 'fullname' || h === 'customer_name' || h === 'contact_name');
          const empIdx = headers.findIndex(h => h === 'employeename' || h === 'employee_name' || h === 'employee' || h === 'agent');
          if (phoneIdx === -1) { json(res, { error: 'CSV must have a phone/mobile/number column' }, 400); return; }

          contacts = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/['"]/g, ''));
            if (!cols[phoneIdx]) continue;
            let phone = cols[phoneIdx].replace(/[^0-9+]/g, '');
            if (!phone.startsWith('+')) {
              if (phone.startsWith('0')) phone = '+91' + phone.substring(1);
              else if (phone.length === 10) phone = '+91' + phone;
              else phone = '+' + phone;
            }
            const employeeName = empIdx >= 0 ? (cols[empIdx] || '').trim() || null : null;
            const metadata = {};
            headers.forEach((h, idx) => { if (idx !== phoneIdx && idx !== nameIdx && idx !== empIdx && cols[idx]) metadata[h] = cols[idx]; });
            contacts.push({ phone, name: nameIdx >= 0 ? cols[nameIdx] : null, employeeName, metadata: Object.keys(metadata).length > 0 ? metadata : null });
          }
        }

        if (!contacts || contacts.length === 0) { json(res, { error: 'No valid contacts found' }, 400); return; }
        if (contacts.length > 10000) { json(res, { error: 'Maximum 10,000 contacts per campaign' }, 400); return; }

        await db.insertContacts(campaignId, contacts, campaign.batch_size);
        const updated = await db.getCampaign(campaignId);
        json(res, { ok: true, totalContacts: updated.total_contacts, batches: await db.getMaxBatch(campaignId) });
      } catch (err) {
        json(res, { error: err.message }, 400);
      }
    });
    return;
  }

  // Start campaign
  const startMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/start$/);
  if (startMatch && req.method === 'POST') {
    const result = await batchEngine.startCampaign(startMatch[1]);
    json(res, result, result.error ? 400 : 200);
    return;
  }

  // Pause campaign
  const pauseMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/pause$/);
  if (pauseMatch && req.method === 'POST') {
    json(res, await batchEngine.pauseCampaign(pauseMatch[1]));
    return;
  }

  // Cancel campaign
  const cancelMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/cancel$/);
  if (cancelMatch && req.method === 'POST') {
    json(res, await batchEngine.cancelCampaign(cancelMatch[1]));
    return;
  }

  // Callback contacts for a campaign
  const callbacksMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/callbacks$/);
  if (callbacksMatch && req.method === 'GET') {
    json(res, await db.getCallbackContacts(callbacksMatch[1]));
    return;
  }

  // Trigger due callbacks — calls contacts whose callback_date has arrived
  const triggerCallbacksMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/trigger-callbacks$/);
  if (triggerCallbacksMatch && req.method === 'POST') {
    const campaignId = triggerCallbacksMatch[1];
    const campaign = await db.getCampaign(campaignId);
    if (!campaign) { json(res, { error: 'Campaign not found' }, 404); return; }
    const callbacks = await db.getCallbackContacts(campaignId);
    const now = new Date();
    const due = callbacks.filter(c => c.callback_date && new Date(c.callback_date) <= now);
    if (due.length === 0) { json(res, { triggered: 0, message: 'No callbacks due' }); return; }

    const results = [];
    for (const contact of due) {
      try {
        const result = await makeCall(contact.phone, contact.name || 'Sir', campaign.prompt_override || null, campaign.whatsapp_message_key || null, null, { enableAMD: true });
        await db.updateContact(contact.id, { status: 'calling', callUuid: result.callUuid, outcome: null, callbackDate: null, callbackNote: null });
        results.push({ phone: contact.phone, name: contact.name, callUuid: result.callUuid, status: 'calling' });
      } catch (err) {
        results.push({ phone: contact.phone, name: contact.name, error: err.message });
      }
    }
    json(res, { triggered: results.length, results });
    return;
  }

  // Toggle auto-callback for a campaign
  const autoCallbackMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/auto-callback$/);
  if (autoCallbackMatch && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const campaignId = autoCallbackMatch[1];
      const enabled = body.enabled ? 1 : 0;
      await db.rawExecute('UPDATE campaigns SET auto_callback = $1 WHERE id = $2', [enabled, campaignId]);
      const campaign = await db.getCampaign(campaignId);
      json(res, { auto_callback: campaign?.auto_callback || 0 });
    } catch (err) { json(res, { error: err.message }, 400); }
    return;
  }

  // List batches
  const batchesMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/batches$/);
  if (batchesMatch && req.method === 'GET') {
    const campaignId = batchesMatch[1];
    const maxBatch = await db.getMaxBatch(campaignId);
    const batches = [];
    for (let i = 1; i <= maxBatch; i++) {
      const stats = await db.getBatchStats(campaignId, i);
      const analysis = await db.getAnalysis(campaignId, i);
      const prompt = analysis?.prompt_id ? await db.getPrompt(analysis.prompt_id) : null;
      batches.push({ batchNumber: i, stats, analysis: analysis ? { ...analysis, prompt_name: prompt?.name || null } : null });
    }
    json(res, batches);
    return;
  }

  // Approve batch
  const approveMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/batches\/(\d+)\/approve$/);
  if (approveMatch && req.method === 'POST') {
    const campaignId = approveMatch[1];
    const batchNum = parseInt(approveMatch[2]);
    try {
      const body = await parseBody(req);
      await db.approveAnalysis(campaignId, batchNum);
      // If prompt adjustments provided, update campaign prompt
      if (body.prompt_override) {
        await db.updateCampaign(campaignId, { promptOverride: body.prompt_override });
      }
      // If batch_size adjustment provided
      if (body.batch_size) {
        await db.updateCampaign(campaignId, { batchSize: body.batch_size });
      }
      // Advance to next batch and resume
      await db.updateCampaign(campaignId, { currentBatch: batchNum + 1 });
      const result = await batchEngine.startCampaign(campaignId);
      json(res, { ok: true, ...result });
    } catch (err) { json(res, { error: err.message }, 400); }
    return;
  }

  // Get batch analysis
  const analysisMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/batches\/(\d+)\/analysis$/);
  if (analysisMatch && req.method === 'GET') {
    const analysis = await db.getAnalysis(analysisMatch[1], parseInt(analysisMatch[2]));
    if (!analysis) { json(res, { error: 'No analysis found' }, 404); return; }
    const prompt = analysis.prompt_id ? await db.getPrompt(analysis.prompt_id) : null;
    json(res, { ...analysis, stats: analysis.stats ? JSON.parse(analysis.stats) : null, prompt_name: prompt?.name || null });
    return;
  }

  // Re-run batch analysis (delete old + regenerate)
  const rerunMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/batches\/(\d+)\/rerun-analysis$/);
  if (rerunMatch && req.method === 'POST') {
    const campaignId = rerunMatch[1];
    const batchNum = parseInt(rerunMatch[2]);
    await db.deleteAnalysis(campaignId, batchNum);
    try {
      await batchEngine.runBatchAnalysis(campaignId, batchNum);
      const analysis = await db.getAnalysis(campaignId, batchNum);
      const prompt = analysis?.prompt_id ? await db.getPrompt(analysis.prompt_id) : null;
      json(res, { ok: true, analysis: analysis ? { ...analysis, prompt_name: prompt?.name || null } : null });
    } catch (err) { json(res, { error: err.message }, 500); }
    return;
  }

  // List contacts
  const contactsMatch = parsed.pathname.match(/^\/api\/campaigns\/([^/]+)\/contacts$/);
  if (contactsMatch && req.method === 'GET') {
    const contacts = await db.getContacts(contactsMatch[1], {
      batchNumber: parsed.query.batch ? parseInt(parsed.query.batch) : undefined,
      status: parsed.query.status,
      outcome: parsed.query.outcome || undefined,
      limit: parsed.query.limit ? parseInt(parsed.query.limit) : 100,
      offset: parsed.query.offset ? parseInt(parsed.query.offset) : 0,
    });
    json(res, contacts);
    return;
  }

  // Brochure config endpoints
  if (parsed.pathname === '/api/brochures' && req.method === 'GET') {
    json(res, whatsapp.getBrochures());
    return;
  }

  if (parsed.pathname === '/api/brochures' && req.method === 'POST') {
    parseBody(req).then(body => {
      if (!body.key || !body.name || !body.url) { json(res, { error: 'key, name, url required' }, 400); return; }
      json(res, whatsapp.setBrochure(body.key, { name: body.name, url: body.url, caption: body.caption || '' }));
    }).catch(err => json(res, { error: err.message }, 400));
    return;
  }

  const brochureKeyMatch = parsed.pathname.match(/^\/api\/brochures\/([^/]+)$/);
  if (brochureKeyMatch && req.method === 'DELETE') {
    json(res, whatsapp.deleteBrochure(brochureKeyMatch[1]));
    return;
  }

  // --- Employee WhatsApp Instances API ---
  if (parsed.pathname === '/api/employee-instances/auto-detect' && req.method === 'GET') {
    const employeeNames = await db.getUniqueEmployeeNames();
    const mappings = await db.listEmployeeInstances();
    const result = employeeNames.map(name => {
      const mapping = mappings.find(m => m.employee_name.toLowerCase() === name.toLowerCase());
      return {
        employee_name: name,
        mapped: !!mapping,
        id: mapping?.id || null,
        instance_name: mapping?.instance_name || null,
        status: mapping?.status || null,
      };
    });
    // Also include mapped employees not in campaigns
    for (const m of mappings) {
      if (!result.find(r => r.employee_name.toLowerCase() === m.employee_name.toLowerCase())) {
        result.push({ employee_name: m.employee_name, mapped: true, id: m.id, instance_name: m.instance_name, status: m.status });
      }
    }
    json(res, result);
    return;
  }

  if (parsed.pathname === '/api/evolution/instances' && req.method === 'GET') {
    try {
      const evoRes = await fetch(`${process.env.EVOLUTION_API_URL || 'http://evolution-api-fgxi-api-1:8080'}/instance/fetchInstances`, {
        headers: { 'apikey': process.env.EVOLUTION_API_KEY || '' },
      });
      const evoData = await evoRes.json();
      const instances = (Array.isArray(evoData) ? evoData : []).map(i => ({
        name: i.name,
        connectionStatus: i.connectionStatus,
        profileName: i.profileName || null,
      }));
      json(res, instances);
    } catch (err) { json(res, { error: err.message }, 500); }
    return;
  }

  if (parsed.pathname === '/api/employee-instances' && req.method === 'GET') {
    json(res, await db.listEmployeeInstances());
    return;
  }

  if (parsed.pathname === '/api/employee-instances' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.employee_name || !body.instance_name) { json(res, { error: 'employee_name and instance_name required' }, 400); return; }
      const inst = await db.createEmployeeInstance({
        employeeName: body.employee_name,
        instanceName: body.instance_name,
        phone: body.phone,
        status: body.status || 'pending',
      });
      json(res, inst, 201);
    } catch (err) { json(res, { error: err.message }, 400); }
    return;
  }

  const empInstMatch = parsed.pathname.match(/^\/api\/employee-instances\/([^/]+)$/);
  if (empInstMatch && req.method === 'PATCH') {
    try {
      const body = await parseBody(req);
      const inst = await db.updateEmployeeInstance(empInstMatch[1], {
        employeeName: body.employee_name, instanceName: body.instance_name,
        phone: body.phone, status: body.status,
      });
      if (!inst) { json(res, { error: 'Not found' }, 404); return; }
      json(res, inst);
    } catch (err) { json(res, { error: err.message }, 400); }
    return;
  }

  if (empInstMatch && req.method === 'DELETE') {
    await db.deleteEmployeeInstance(empInstMatch[1]);
    json(res, { ok: true });
    return;
  }

  // Proxy to Evolution API — get instance connection state + QR
  const evoProxyMatch = parsed.pathname.match(/^\/api\/evolution\/(.+)$/);
  if (evoProxyMatch && req.method === 'GET') {
    const evoPath = evoProxyMatch[1];
    try {
      const evoRes = await fetch(`${process.env.EVOLUTION_API_URL || 'http://evolution-api-fgxi-api-1:8080'}/${evoPath}`, {
        headers: { 'apikey': process.env.EVOLUTION_API_KEY || '' },
      });
      const evoData = await evoRes.json();
      json(res, evoData);
    } catch (err) { json(res, { error: err.message }, 500); }
    return;
  }

  // Create Evolution API instance
  if (parsed.pathname === '/api/evolution/create-instance' && req.method === 'POST') {
    parseBody(req).then(async body => {
      try {
        const evoRes = await fetch(`${process.env.EVOLUTION_API_URL || 'http://evolution-api-fgxi-api-1:8080'}/instance/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': process.env.EVOLUTION_API_KEY || '' },
          body: JSON.stringify({
            instanceName: body.instance_name,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
          }),
        });
        const evoData = await evoRes.json();
        json(res, evoData);
      } catch (err) { json(res, { error: err.message }, 500); }
    }).catch(err => json(res, { error: err.message }, 400));
    return;
  }

  // --- Model Selection API ---
  if (parsed.pathname === '/api/model' && req.method === 'GET') {
    json(res, { active: getActiveModel(), models: GEMINI_MODELS });
    return;
  }

  if (parsed.pathname === '/api/model' && req.method === 'POST') {
    parseBody(req).then(body => {
      if (!body.model || !GEMINI_MODELS[body.model]) {
        json(res, { error: 'Invalid model. Available: ' + Object.keys(GEMINI_MODELS).join(', ') }, 400);
        return;
      }
      setActiveModel(body.model);
      console.log(`[Model] Switched to ${body.model}`);
      json(res, { active: body.model, name: GEMINI_MODELS[body.model].name });
    }).catch(err => json(res, { error: err.message }, 400));
    return;
  }

  // --- Named Prompts API ---
  if (parsed.pathname === '/api/prompts' && req.method === 'GET') {
    json(res, await db.listPrompts());
    return;
  }

  if (parsed.pathname === '/api/prompts' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.name || !body.body) { json(res, { error: 'name and body required' }, 400); return; }
      const prompt = await db.createPrompt({ name: body.name, body: body.body, isActive: !!body.is_active });
      json(res, prompt, 201);
    } catch (err) { json(res, { error: err.message }, 400); }
    return;
  }

  const promptMatch = parsed.pathname.match(/^\/api\/prompts\/([^/]+)$/);
  if (promptMatch && req.method === 'GET') {
    const prompt = await db.getPrompt(promptMatch[1]);
    if (!prompt) { json(res, { error: 'Not found' }, 404); return; }
    json(res, prompt);
    return;
  }

  if (promptMatch && req.method === 'PATCH') {
    try {
      const body = await parseBody(req);
      const prompt = await db.updatePrompt(promptMatch[1], { name: body.name, body: body.body });
      if (!prompt) { json(res, { error: 'Not found' }, 404); return; }
      json(res, prompt);
    } catch (err) { json(res, { error: err.message }, 400); }
    return;
  }

  if (promptMatch && req.method === 'DELETE') {
    await db.deletePrompt(promptMatch[1]);
    json(res, { ok: true });
    return;
  }

  const activateMatch = parsed.pathname.match(/^\/api\/prompts\/([^/]+)\/activate$/);
  if (activateMatch && req.method === 'POST') {
    const prompt = await db.setActivePrompt(activateMatch[1]);
    if (!prompt) { json(res, { error: 'Not found' }, 404); return; }
    json(res, prompt);
    return;
  }

  if (parsed.pathname === '/api/prompts/active' && req.method === 'DELETE') {
    // Deactivate all prompts (fall back to file override or default)
    await db.rawExecute('UPDATE prompts SET is_active = 0');
    json(res, { ok: true });
    return;
  }

  // --- Analytics API ---
  if (parsed.pathname === '/api/analytics' && req.method === 'GET') {
    const campaigns = await db.listCampaigns();
    const calls = store.listCalls();

    // Aggregate outcomes from ALL calls (not just campaign contacts)
    const outcomeAgg = { interested: 0, not_interested: 0, callback: 0, no_answer: 0, busy: 0, brochure_sent: 0, voicemail: 0 };
    let totalInterested = 0, totalBrochures = 0;

    for (const c of calls) {
      // Auto-classify calls that don't have an outcome yet
      let outcome = c.outcome;
      if (!outcome && (c.status === 'completed' || c.hangupCause)) {
        outcome = store.classifyCallOutcome(c.callUuid);
      }
      if (outcome && outcomeAgg[outcome] !== undefined) {
        outcomeAgg[outcome]++;
      }
      if (outcome === 'interested') totalInterested++;
      if (outcome === 'brochure_sent') totalBrochures++;
    }

    const completedCalls = calls.filter(c => c.status === 'completed');
    const totalCompleted = completedCalls.length;

    // Campaign-level performance
    const campaignPerf = [];
    let totalContacts = 0;
    for (const camp of campaigns) {
      const s = await db.getContactStats(camp.id);
      totalContacts += s.total || 0;
      const processed = (s.completed || 0) + (s.failed || 0);
      campaignPerf.push({
        id: camp.id, name: camp.name, status: camp.status,
        total: s.total || 0, completed: s.completed || 0,
        interested: s.interested || 0, brochures: s.brochure_sent || 0,
        connRate: processed > 0 ? Math.round((s.completed || 0) / processed * 100) : 0,
        intRate: (s.completed || 0) > 0 ? Math.round((s.interested || 0) / s.completed * 100) : 0,
      });
    }

    // Call duration stats + cost calculation
    const totalDuration = completedCalls.reduce((s, c) => s + (c.duration || 0), 0);
    const avgDuration = completedCalls.length > 0 ? Math.round(totalDuration / completedCalls.length) : 0;
    const totalMinutes = totalDuration / 60;

    // Cost rates — model-specific pricing from https://ai.google.dev/gemini-api/docs/pricing
    const USD_TO_INR = 84;
    const PLIVO_RATE = 0.74; // ₹0.74/min (confirmed by board)
    const defaultModel = getActiveModel();
    const defaultPricing = GEMINI_MODELS[defaultModel]?.pricing || GEMINI_MODELS['models/gemini-3.1-flash-live-preview'].pricing;

    // Per-minute fallback rate from active model
    const GEMINI_USD_RATE = defaultPricing.audioInputPerMin + defaultPricing.audioOutputPerMin;
    const GEMINI_RATE = Math.round(GEMINI_USD_RATE * USD_TO_INR * 100) / 100;
    const TOTAL_RATE = Math.round((PLIVO_RATE + GEMINI_RATE) * 100) / 100;

    const costPlivo = Math.round(totalMinutes * PLIVO_RATE * 100) / 100;

    // Token-based cost — per-call, model-specific
    let totalInputTokens = 0, totalOutputTokens = 0;
    let costGeminiTokens = 0;
    for (const c of calls) {
      const t = c.tokens || {};
      totalInputTokens += t.inputTokens || 0;
      totalOutputTokens += t.outputTokens || 0;
      if ((t.inputTokens || 0) > 0) {
        const mp = GEMINI_MODELS[c.model]?.pricing || defaultPricing;
        costGeminiTokens += ((t.inputTokens / 1e6 * mp.audioInput) + (t.outputTokens / 1e6 * mp.audioOutput)) * USD_TO_INR;
      }
    }
    costGeminiTokens = Math.round(costGeminiTokens * 100) / 100;
    const totalTokens = totalInputTokens + totalOutputTokens;
    const costGeminiTimeBased = Math.round(totalMinutes * GEMINI_RATE * 100) / 100;

    // Use token-based cost if we have token data, otherwise fall back to time-based
    const costGemini = costGeminiTokens > 0 ? costGeminiTokens : costGeminiTimeBased;
    const costGeminiMethod = costGeminiTokens > 0 ? 'tokens' : 'time-estimate';
    const costTotal = Math.round((costPlivo + costGemini) * 100) / 100;

    // Per-call cost breakdown
    const costPerCall = completedCalls.length > 0 ? Math.round(costTotal / completedCalls.length * 100) / 100 : 0;
    const costPerInterested = totalInterested > 0 ? Math.round(costTotal / totalInterested * 100) / 100 : 0;

    // Calls per day (last 30 days)
    const callsByDay = {};
    const costByDay = {};
    for (const c of calls) {
      const day = c.startedAt?.substring(0, 10);
      if (day) {
        callsByDay[day] = (callsByDay[day] || 0) + 1;
        costByDay[day] = Math.round(((costByDay[day] || 0) + ((c.duration || 0) / 60 * TOTAL_RATE)) * 100) / 100;
      }
    }

    json(res, {
      summary: {
        totalCampaigns: campaigns.length,
        totalContacts, totalCompleted, totalInterested, totalBrochures,
        totalCalls: calls.length, completedCalls: completedCalls.length, avgDuration,
        totalMinutes: Math.round(totalMinutes * 10) / 10,
        overallConnRate: totalCompleted > 0 && totalContacts > 0 ? Math.round(totalCompleted / totalContacts * 100) : 0,
        overallIntRate: totalCompleted > 0 ? Math.round(totalInterested / totalCompleted * 100) : 0,
      },
      cost: {
        plivo: costPlivo, gemini: costGemini, total: costTotal,
        geminiMethod: costGeminiMethod,
        perCall: costPerCall, perInterested: costPerInterested,
        tokens: { input: totalInputTokens, output: totalOutputTokens, total: totalTokens },
        activeModel: defaultModel,
        activeModelName: GEMINI_MODELS[defaultModel]?.name || defaultModel,
        rates: {
          plivo: PLIVO_RATE, geminiPerMin: GEMINI_RATE, totalPerMin: TOTAL_RATE,
          usdToInr: USD_TO_INR, currency: 'INR',
        },
        modelPricing: Object.fromEntries(Object.entries(GEMINI_MODELS).map(([k, v]) => [k, { name: v.name, ...v.pricing }])),
      },
      outcomes: outcomeAgg,
      campaignPerformance: campaignPerf,
      callsByDay,
      costByDay,
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

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
