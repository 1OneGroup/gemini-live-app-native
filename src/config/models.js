// Gemini model registry + active-model persistence.
// Model is persisted to DATA_DIR/model-override.txt so it survives restarts.
'use strict';

const fs = require('fs');
const path = require('path');

// Pricing source: https://ai.google.dev/gemini-api/docs/pricing
const GEMINI_MODELS = {
  'models/gemini-3.1-flash-live-preview': {
    name: 'Gemini 3.1 Flash Live', shortName: '3.1 Flash',
    pricing: { // USD per 1M tokens
      textInput: 0.75, audioInput: 3.00, textOutput: 4.50, audioOutput: 12.00,
      audioInputPerMin: 0.005, audioOutputPerMin: 0.018,
    },
  },
  'models/gemini-2.5-flash-live-preview': {
    name: 'Gemini 2.5 Flash Live', shortName: '2.5 Flash',
    pricing: { // USD per 1M tokens
      textInput: 0.50, audioInput: 3.00, textOutput: 2.00, audioOutput: 12.00,
      audioInputPerMin: 0.005, audioOutputPerMin: 0.018, // same per-min as 3.1
    },
  },
};

const GEMINI_MODEL_DEFAULT = process.env.GEMINI_MODEL || 'models/gemini-3.1-flash-live-preview';
const MODEL_OVERRIDE_PATH = path.join(process.env.DATA_DIR || '/data', 'model-override.txt');

function getActiveModel() {
  try {
    if (fs.existsSync(MODEL_OVERRIDE_PATH)) {
      const m = fs.readFileSync(MODEL_OVERRIDE_PATH, 'utf8').trim();
      if (m && GEMINI_MODELS[m]) return m;
    }
  } catch {}
  return GEMINI_MODEL_DEFAULT;
}

function setActiveModel(model) {
  const dir = path.dirname(MODEL_OVERRIDE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MODEL_OVERRIDE_PATH, model, 'utf8');
}

module.exports = { GEMINI_MODELS, getActiveModel, setActiveModel };
