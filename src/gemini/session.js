// Unified Gemini session factory. Replaces server.js preWarmGemini() and
// reconnectGemini(); parameterizes on `isReconnect` and shares all WS
// binding, setup payload, message handling, and tool declarations.
//
// State ownership: pendingSessions and sessions Maps are module-level here.
// server.js and routers import them (server.js passes them through to
// routers via deps). This keeps all session lifecycle in one place.
'use strict';

const { WebSocket } = require('ws');
const { MAX_RECONNECTIONS } = require('../config/constants');
const { getSystemInstruction } = require('../../prompts');
const store = require('../../call-store');
const { getActiveModel } = require('../config/models');
const { buildSetupPayload } = require('./setup-payload');
const { createMessageHandler, triggerOpeningGreeting } = require('./message-handler');
const { startGeminiPing, startStaleSessionSweep } = require('./keepalive');

// --- Module-level session state ---
// Pre-warmed Gemini sessions: callUuid -> session
const pendingSessions = new Map();
// Active sessions (Plivo stream bound): streamId -> session
const sessions = new Map();

// Start the stale-session sweep once at import time (was a setInterval in server.js).
startStaleSessionSweep(pendingSessions);

// Sends a PCM16k audio chunk to Gemini as realtimeInput.audio.
// Exported so the WS handler in server.js can call it directly.
function sendAudioToGemini(ws, pcmBuffer) {
  ws.send(JSON.stringify({
    realtimeInput: {
      audio: { mimeType: 'audio/pcm;rate=16000', data: pcmBuffer.toString('base64') }
    }
  }));
}

// Creates (or reconnects) a Gemini Live session.
//
// Params:
//   callUuid        — the Plivo call UUID (or a temp 'pending-*' id for pre-warm)
//   promptOverride  — optional campaign-specific system instruction; ignored
//                     on reconnect (matches original reconnectGemini behavior)
//   isReconnect     — false = fresh pre-warm; true = reconnect on an existing session
//   existingSession — required when isReconnect=true; the session to re-bind
//   deps            — { whatsapp, hangupCall } — injected from server.js to
//                     avoid a circular require with hangupCall in server.js
//
// Returns: the session object (same one that was passed in on reconnect).
function createGeminiSession({ callUuid, promptOverride, isReconnect, existingSession, deps }) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

  const session = isReconnect ? existingSession : {
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

  if (!isReconnect) {
    console.log(`[Gemini] Pre-warming for call ${callUuid}`);
  }

  const ws = new WebSocket(GEMINI_WS_URL);
  session.ws = ws;

  // Bound reconnect function — passed into the message handler so it can
  // trigger its own reconnects on goAway / close without circular imports.
  const reconnectFn = (s, uuid) => createGeminiSession({
    callUuid: uuid,
    isReconnect: true,
    existingSession: s,
    deps,
  });

  ws.on('open', async () => {
    if (isReconnect) {
      console.log(`[Gemini] Reconnect WS open for ${callUuid}, sending setup...`);
    } else {
      console.log(`[Gemini] Pre-warm connected, sending setup...`);
    }
    session._setupStart = Date.now();

    // Reconnect ignores promptOverride — uses the currently-active system
    // instruction. Pre-warm honors promptOverride. This matches the original.
    const systemInstruction = isReconnect
      ? await getSystemInstruction()
      : (promptOverride || await getSystemInstruction());

    ws.send(JSON.stringify(buildSetupPayload({
      model: getActiveModel(),
      systemInstruction,
    })));
  });

  ws.on('message', createMessageHandler({
    session,
    callUuid,
    ws,
    isReconnect,
    deps: {
      store,
      whatsapp: deps.whatsapp,
      hangupCall: deps.hangupCall,
      reconnectGemini: reconnectFn,
      sendAudioToGemini,
    },
  }));

  ws.on('close', (code, reason) => {
    if (isReconnect) {
      console.log(`[Gemini] Reconnected session closed: ${code} ${reason}`);
    } else {
      console.log(`[Gemini] Closed: ${code} ${reason}`);
    }
    session.ready = false;
    if (session._pingInterval) clearInterval(session._pingInterval);
    if (session._sessionAgeTimer) clearTimeout(session._sessionAgeTimer);

    if (session.plivoWs?.readyState === WebSocket.OPEN && !session._reconnecting && session._reconnectCount < MAX_RECONNECTIONS) {
      session._reconnecting = true;
      session._reconnectCount++;
      if (isReconnect) {
        console.log(`[Gemini] Reconnect attempt #${session._reconnectCount} for ${callUuid}...`);
        store.addTranscript(callUuid, 'system', `[Gemini session closed — reconnecting (attempt ${session._reconnectCount}/${MAX_RECONNECTIONS})...]`);
      } else {
        console.log(`[Gemini] Call ${callUuid} still active — reconnect attempt #${session._reconnectCount}...`);
        store.addTranscript(callUuid, 'system', `[Gemini disconnected — reconnecting (attempt ${session._reconnectCount}/${MAX_RECONNECTIONS})...]`);
      }
      reconnectFn(session, callUuid);
    } else if (session.plivoWs?.readyState === WebSocket.OPEN && session._reconnectCount >= MAX_RECONNECTIONS) {
      if (isReconnect) {
        console.log(`[Gemini] Max reconnections (${MAX_RECONNECTIONS}) reached for ${callUuid} — ending call`);
      } else {
        console.log(`[Gemini] Max reconnections reached for ${callUuid} — ending call`);
      }
      store.addTranscript(callUuid, 'system', '[Gemini max reconnections reached — ending call]');
      deps.hangupCall(callUuid);
    }
  });

  ws.on('error', (err) => {
    if (isReconnect) {
      console.error(`[Gemini] Reconnect error: ${err.message}`);
    } else {
      console.error(`[Gemini] Error: ${err.message}`);
    }
  });

  ws.on('pong', () => {
    session._lastPong = Date.now();
  });

  if (!isReconnect) {
    pendingSessions.set(callUuid, session);
  }
  return session;
}

module.exports = {
  createGeminiSession,
  sendAudioToGemini,
  triggerOpeningGreeting,
  pendingSessions,
  sessions,
};
