// src/routes/analytics.js
// GET /api/analytics — aggregate call + campaign statistics
const { Router } = require('express');

module.exports = (deps) => {
  const { store, db, GEMINI_MODELS, getActiveModel, USD_INR, PLIVO_RATE } = deps;
  const router = Router();

  router.get('/', async (req, res) => {
    try {
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
      const defaultModel = getActiveModel();
      const defaultPricing = GEMINI_MODELS[defaultModel]?.pricing || GEMINI_MODELS['models/gemini-3.1-flash-live-preview'].pricing;

      // Per-minute fallback rate from active model
      const GEMINI_USD_RATE = defaultPricing.audioInputPerMin + defaultPricing.audioOutputPerMin;
      const GEMINI_RATE = Math.round(GEMINI_USD_RATE * USD_INR * 100) / 100;
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
          costGeminiTokens += ((t.inputTokens / 1e6 * mp.audioInput) + (t.outputTokens / 1e6 * mp.audioOutput)) * USD_INR;
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

      res.json({
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
            usdToInr: USD_INR, currency: 'INR',
          },
          modelPricing: Object.fromEntries(Object.entries(GEMINI_MODELS).map(([k, v]) => [k, { name: v.name, ...v.pricing }])),
        },
        outcomes: outcomeAgg,
        campaignPerformance: campaignPerf,
        callsByDay,
        costByDay,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
