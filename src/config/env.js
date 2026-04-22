// Validated environment variable accessors.
// Safe to import from anywhere — dotenv.config() is called here idempotently.
// Phase 2 decision: root files still read process.env directly for now.
// This module documents all env vars and will be the single access point from Phase 3 onward.
'use strict';

// Load .env only if not already loaded (idempotent in Docker — no .env file present).
try { require('dotenv').config(); } catch {}

module.exports = {
  // Google Gemini Live API
  GEMINI_API_KEY:  process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL:    process.env.GEMINI_MODEL   || 'models/gemini-3.1-flash-live-preview',

  // OpenRouter (DeepSeek post-call analysis + WA message improvement)
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',

  // Plivo PSTN
  PLIVO_AUTH_ID:     process.env.PLIVO_AUTH_ID     || '',
  PLIVO_AUTH_TOKEN:  process.env.PLIVO_AUTH_TOKEN  || '',
  PLIVO_FROM_NUMBER: process.env.PLIVO_FROM_NUMBER || '',

  // Public-facing URL for Plivo webhooks
  PUBLIC_URL: process.env.PUBLIC_URL || '',

  // Evolution / Evo-Go WhatsApp gateway
  EVOLUTION_API_URL:  process.env.EVOLUTION_API_URL  || 'https://evo-go.tech.onegroup.co.in',
  EVOLUTION_API_KEY:  process.env.EVOLUTION_API_KEY  || '',
  EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE || 'office_bot',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Classifier dashboard (optional external endpoint)
  CLASSIFIER_DASHBOARD_URL: process.env.CLASSIFIER_DASHBOARD_URL || '',

  // Server port
  PORT: parseInt(process.env.PORT || '8100', 10),

  // Local call data directory
  DATA_DIR: process.env.DATA_DIR || '/data/calls',
};
