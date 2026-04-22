# src/lib

Shared utility functions for call tracking, outcome classification, phone normalization, pricing, and JSON parsing.

## Files

| File | Exports | Purpose |
|---|---|---|
| call-store.js | `createCall`, `updateCall`, `addTokens`, `addTranscript`, `classifyCallOutcome`, `getCall`, `listCalls` | In-memory per-call state store (transcripts, tokens, hangup cause, outcome); persists to DATA_DIR as JSON. |
| outcome-classifier.js | `classifyOutcome(transcript, durationSec, opts)` | Merges keyword-matching logic from batch-engine, call-store, and deepseek into single authoritative implementation. |
| phone.js | `normalizePhone(raw, { defaultCountryCode: '91' })` | Converts raw phone strings to E.164 format (e.g., `+919876543210`). |
| pricing.js | `USD_INR`, `PLIVO_RATE`, `callCostInr(input, output, pricing, durationSec)` | Call cost calculation for Plivo + Gemini; handles both token-based and per-minute fallback pricing. |
| safe-json.js | `safeJsonParse(str, fallback)` | Parses JSON without throwing; returns fallback on error. |

## Multi-outcome support

`outcome-classifier` supports both single-outcome (default) and multi-outcome modes via `{multiOutcome: true}` option. In multi-outcome mode it returns a comma-joined string of all matching labels (e.g., `brochure_sent,interested`). `call-store` uses multi-outcome mode when classifying outcomes.

## Imported by

- `src/index.js` — call-store, safe-json, phone, pricing
- `src/jobs/batch-engine.js` — call-store, outcome-classifier, safe-json
- `src/jobs/sync-callback-data.js` — call-store
- `src/gemini/session.js` — call-store
- `src/integrations/deepseek.js` — outcome-classifier
- `src/integrations/whatsapp.js` — phone
