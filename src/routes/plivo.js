// src/routes/plivo.js
// POST /answer             — Plivo answer URL (returns XML)
// POST /stream-status      — stream status callback
// POST /recording-callback — recording URL callback
// POST /recording-status   — recording status callback
// POST /hangup             — hangup webhook
// POST /machine-detection  — AMD callback
// POST /call               — outbound call initiation
const { Router } = require('express');

module.exports = (deps) => {
  const { store, pendingSessions, makeCall, hangupCall, handleVoicemailDetected } = deps;
  const router = Router();

  // Plivo answer URL — returns XML to set up bidirectional stream
  router.post('/answer', (req, res) => {
    const PUBLIC_URL = process.env.PUBLIC_URL;
    const wsUrl = `${PUBLIC_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/media-stream`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record recordSession="true" action="${PUBLIC_URL}/recording-callback" startRecordingAudio="${PUBLIC_URL}/recording-status" maxLength="3600" redirect="false" />
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000" statusCallbackUrl="${PUBLIC_URL}/stream-status">
    ${wsUrl}
  </Stream>
</Response>`;
    res.set('Content-Type', 'application/xml');
    res.send(xml);
    console.log('[HTTP] Answer URL served');
  });

  // Stream status callback — acknowledge only
  router.post('/stream-status', (req, res) => {
    res.sendStatus(200);
  });

  // Recording URL callback
  router.post('/recording-callback', (req, res) => {
    const body = req.body || {};
    // Express urlencoded parses form fields directly; also handle raw URLSearchParams fallback
    const callUuid = body.CallUUID;
    const recordingUrl = body.RecordUrl || body.RecordingUrl;
    console.log(`[Recording] Call ${callUuid}: ${recordingUrl}`);
    if (callUuid && recordingUrl) store.updateCall(callUuid, { recordingUrl });
    res.sendStatus(200);
  });

  // Recording status callback — acknowledge only
  router.post('/recording-status', (req, res) => {
    res.sendStatus(200);
  });

  // Hangup webhook
  router.post('/hangup', (req, res) => {
    const body = req.body || {};
    const callUuid = body.CallUUID;
    const duration = parseInt(body.Duration || '0');
    const hangupCause = body.HangupCauseName || body.HangupCause;
    const totalCost = body.TotalCost;
    const callStatus = body.CallStatus;
    const endTime = body.EndTime;
    const answerTime = body.AnswerTime;

    console.log(`[Hangup] ${callUuid}: ${callStatus}, ${duration}s, ${hangupCause}`);
    if (callUuid) {
      store.updateCall(callUuid, {
        status: callStatus || 'completed',
        duration, hangupCause, cost: totalCost,
        endedAt: endTime || new Date().toISOString(),
        answeredAt: answerTime || null,
      });
      // Classify outcome after a short delay to let final transcripts flush
      setTimeout(() => {
        const outcome = store.classifyCallOutcome(callUuid);
        console.log(`[Outcome] ${callUuid}: ${outcome}`);
      }, 5000);
      pendingSessions.delete(callUuid);
    }
    res.sendStatus(200);
  });

  // Answering Machine Detection callback
  router.post('/machine-detection', (req, res) => {
    const body = req.body || {};
    const callUuid = body.CallUUID;
    const isMachine = body.Machine === 'true';
    console.log(`[AMD] Call ${callUuid}: machine=${isMachine}`);
    if (isMachine && callUuid) {
      handleVoicemailDetected(callUuid);
    }
    res.sendStatus(200);
  });

  // Outbound call initiation
  router.post('/call', async (req, res) => {
    try {
      const params = req.body || {};
      const toNumber = params.to || '+919899050706';
      const customerName = params.customer_name || 'Sir';
      const result = await makeCall(toNumber, customerName);
      res.json(result);
    } catch (err) {
      console.error('[HTTP] Call error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
