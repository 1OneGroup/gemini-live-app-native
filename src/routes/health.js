// src/routes/health.js
// GET /health — liveness check + active session summary
const { Router } = require('express');

module.exports = (deps) => {
  const { sessions, pendingSessions } = deps;
  const router = Router();

  router.get('/', (req, res) => {
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
    res.json({
      status: 'ok',
      sessions: sessions.size,
      pending: pendingSessions.size,
      activeSessions,
    });
  });

  return router;
};
