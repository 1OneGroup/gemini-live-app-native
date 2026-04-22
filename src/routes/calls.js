// src/routes/calls.js
// GET /api/calls          — list all calls
// GET /api/calls/:uuid    — single call with cost + analysis
const { Router } = require('express');

module.exports = (deps) => {
  const { store, db, GEMINI_MODELS, getActiveModel, callCostInr, safeJsonParse } = deps;
  const router = Router();

  router.get('/', (req, res) => {
    res.json(store.listCalls());
  });

  router.get('/:callUuid', async (req, res) => {
    const { callUuid } = req.params;
    const call = store.getCall(callUuid);
    if (!call) return res.status(404).send('Not found');

    // Compute cost in INR — model-specific pricing
    const t = call.tokens || {};
    const mp = GEMINI_MODELS[call.model]?.pricing || GEMINI_MODELS[getActiveModel()]?.pricing || GEMINI_MODELS['models/gemini-3.1-flash-live-preview'].pricing;
    const { plivo: plivoCost, gemini: geminiCost, total: costTotal } = callCostInr(t.inputTokens || 0, t.outputTokens || 0, mp, call.duration || 0);
    call.costINR = {
      plivo: plivoCost, gemini: geminiCost, total: costTotal,
      model: call.model || getActiveModel(),
      modelName: GEMINI_MODELS[call.model]?.name || GEMINI_MODELS[getActiveModel()]?.name || 'Unknown',
    };

    // Auto-classify outcome if missing
    if (!call.outcome && (call.status === 'completed' || call.hangupCause)) {
      call.outcome = store.classifyCallOutcome(callUuid);
    }

    // Attach per-call DeepSeek classification from contacts table if available
    const contact = await db.getContactByCallUuid(callUuid);
    if (contact) {
      call.analysis = {
        one_line_summary: contact.one_line_summary || null,
        intent: contact.intent || null,
        interest_score: contact.interest_score ?? null,
        objections: safeJsonParse(contact.objections, []),
      };
    }

    res.json(call);
  });

  return router;
};
