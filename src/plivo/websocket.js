// src/plivo/websocket.js
// Attaches the /media-stream WebSocket server to an existing HTTP server.
// Call attachWebSocketServer(httpServer, deps) once after creating the server.

'use strict';

const { WebSocket, WebSocketServer } = require('ws');
const url = require('url');
const { mulawToPcm16k } = require('./audio-utils');
const { sendAudioToGemini, pendingSessions, sessions, triggerOpeningGreeting } = require('../gemini/session');
const { startPlivoPing } = require('../gemini/keepalive');

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

// deps: { preWarmGemini }
function attachWebSocketServer(httpServer, deps) {
  const { preWarmGemini } = deps;
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
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

        deps.store.updateCall(callUuid, { status: 'connected', answeredAt: new Date().toISOString() });

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
}

module.exports = { attachWebSocketServer, cleanup };
