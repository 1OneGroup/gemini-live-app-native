// src/index.js
// Entry point: load env, init DB, start jobs, create Express app, attach WS, listen.
// server.js is now a 1-line facade that require()s this file.

require('dotenv').config();

const http = require('http');
const { getDashboardHtml } = require('../dashboard');
const db = require('../db');
const { getSystemInstruction, saveSystemInstruction, isUsingOverride, DEFAULT_PROMPT } = require('../prompts');
const store = require('../call-store');
const batchEngine = require('../batch-engine');
const whatsapp = require('../whatsapp');
const { safeJsonParse } = require('./lib/safe-json');
const { normalizePhone } = require('./lib/phone');
const { USD_INR, PLIVO_RATE, callCostInr } = require('./lib/pricing');
const { GEMINI_MODELS, getActiveModel, setActiveModel } = require('./config/models');
const { createGeminiSession, pendingSessions, sessions } = require('./gemini/session');
const { makeCall: _makeCall, hangupCall, handleVoicemailDetected } = require('./plivo/outbound');
const { attachWebSocketServer } = require('./plivo/websocket');
const { syncCallbackData } = require('./jobs/sync-callback-data');
const { scheduleAutoCallbackCron } = require('./jobs/auto-callback');
const createApp = require('./app');

// --- Config validation ---
const PORT = process.env.PORT || 8100;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('[Server] OPENROUTER_API_KEY not set — DeepSeek classification and batch analysis will fall back to keyword matching / error summaries.');
}
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required');
if (!process.env.PLIVO_AUTH_ID || !process.env.PLIVO_AUTH_TOKEN) throw new Error('PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN required');

// Pre-warm wrapper — wires up per-call deps that session.js can't import itself
// without creating a circular require (hangupCall lives in plivo/outbound.js which
// in turn imports session.js).
function preWarmGemini(callUuid, promptOverride) {
  return createGeminiSession({
    callUuid,
    promptOverride,
    isReconnect: false,
    deps: { whatsapp, hangupCall },
  });
}

// Bind makeCall to its required deps (preWarmGemini, store, getSystemInstruction).
function makeCall(toNumber, customerName, promptOverride, whatsappMessageKey, employeeName, options = {}) {
  return _makeCall(toNumber, customerName, promptOverride, whatsappMessageKey, employeeName, options, {
    preWarmGemini, store, getSystemInstruction,
  });
}

// Wire up batch engine with makeCall function
batchEngine.setMakeCallFn(makeCall);

// --- Express app + HTTP server ---
const app = createApp({
  store, db, whatsapp, batchEngine,
  getDashboardHtml, getSystemInstruction, saveSystemInstruction, isUsingOverride, DEFAULT_PROMPT,
  GEMINI_MODELS, getActiveModel, setActiveModel,
  callCostInr, safeJsonParse, normalizePhone,
  USD_INR, PLIVO_RATE,
  pendingSessions, sessions,
  makeCall, hangupCall, handleVoicemailDetected: (callUuid) => handleVoicemailDetected(callUuid, store, sessions),
});
const server = http.createServer(app);

// --- WebSocket server ---
attachWebSocketServer(server, { preWarmGemini, store });

// --- Boot ---
db.init().then(() => {
  server.listen(PORT, async () => {
    console.log(`[Server] Gemini Live + Plivo bridge running on port ${PORT}`);
    console.log(`[Server] Dashboard: ${process.env.PUBLIC_URL}/dashboard`);
    setTimeout(() => syncCallbackData().catch(err => console.error('[Sync] Error:', err.message)), 1000);
    scheduleAutoCallbackCron(makeCall);
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
