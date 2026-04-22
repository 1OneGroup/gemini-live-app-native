// Keepalive + stale-session sweep for Gemini sessions.
// Extracted verbatim from server.js startGeminiPing / startPlivoPing /
// the setInterval stale-session sweeper. Behavior unchanged.
'use strict';

const { WebSocket } = require('ws');

const PING_INTERVAL_MS = 15000;          // 15s — both Gemini and Plivo
const GEMINI_SESSION_MAX_MS = 9 * 60 * 1000;  // Warn at 9 min (Gemini's hard cap is ~10 min)
const STALE_SESSION_CHECK_MS = 30000;    // Stale check cadence

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

// Starts the periodic sweeper that removes pre-warmed sessions that never
// got a Plivo connection after 2 minutes. Idempotent: call once at boot.
function startStaleSessionSweep(pendingSessions) {
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
}

module.exports = {
  startGeminiPing,
  startPlivoPing,
  startStaleSessionSweep,
  PING_INTERVAL_MS,
  GEMINI_SESSION_MAX_MS,
  STALE_SESSION_CHECK_MS,
};
