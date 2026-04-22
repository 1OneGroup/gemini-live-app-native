// Pricing helpers — call cost math for Plivo and Gemini.
// USD_INR lives in src/config/constants.js; we re-export it for convenience.
'use strict';

const { USD_INR } = require('../config/constants');

// Plivo per-minute rate in INR (confirmed by board).
const PLIVO_RATE = 0.74;

/**
 * Compute Plivo + Gemini call cost in INR.
 *
 * If inputTokens > 0, uses token-based pricing for Gemini.
 * Otherwise falls back to per-minute pricing using model's audioInputPerMin +
 * audioOutputPerMin rates.
 *
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @param {object} modelPricing  - pricing block from GEMINI_MODELS[model].pricing
 * @param {number} durationSec   - call duration in seconds (used for Plivo + per-min fallback)
 * @returns {{ plivo: number, gemini: number, total: number }}
 */
function callCostInr(inputTokens, outputTokens, modelPricing, durationSec) {
  const dur = (durationSec || 0) / 60;
  const plivoCost = Math.round(dur * PLIVO_RATE * 100) / 100;

  let geminiCost;
  if ((inputTokens || 0) > 0) {
    geminiCost = Math.round(
      ((inputTokens / 1e6 * modelPricing.audioInput) + (outputTokens / 1e6 * modelPricing.audioOutput))
      * USD_INR * 100
    ) / 100;
  } else {
    geminiCost = Math.round(
      dur * (modelPricing.audioInputPerMin + modelPricing.audioOutputPerMin) * USD_INR * 100
    ) / 100;
  }

  return {
    plivo: plivoCost,
    gemini: geminiCost,
    total: Math.round((plivoCost + geminiCost) * 100) / 100,
  };
}

module.exports = { USD_INR, PLIVO_RATE, callCostInr };
