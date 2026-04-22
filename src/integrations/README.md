# Integrations

Centralizes external service connections: DeepSeek V3.2 post-call analysis, Evo-Go WhatsApp brochure delivery, and instance credentials.

## Files

| File | Exports | Purpose |
|------|---------|---------|
| `deepseek.js` | `classifyCall(transcript)`, `summarizeBatch(perCallJsons, stats)` | DeepSeek V3.2 via OpenRouter: classifies call outcomes, intent, objections, interest score; generates batch summaries. Falls back to keyword matching if API unavailable. |
| `evolution.js` | `getEvoUrl()`, `getEvoKey()`, `getDefaultInstance()`, `fetchInstances()`, `clearInstanceCache()`, `getInstanceCredentials()`, `listInstances()`, `createInstance()`, `proxyGet()` | Single source of truth for Evo-Go URL, API key, instance lookup, and credentials. Caches instance list (5 min TTL). |
| `whatsapp.js` | `sendBrochure(phoneNumber, projectName, employeeName)`, `getBrochures()`, `setBrochure()`, `deleteBrochure()` | Sends WhatsApp brochures (PDF/image/video/text) via Evo-Go; manages brochure registry; resolves message templates from DB or fallback. Generates unique stanza IDs per message (DedupeID fix). |

## External Services

- **OpenRouter** — DeepSeek V3.2 (`deepseek/deepseek-v3.2`) for post-call analysis via OpenAI-compatible API.
- **Evolution/Evo-Go** — WhatsApp gateway at `evo-go.tech.onegroup.co.in` (configurable via `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` env vars).

## Imported By

- `src/index.js` — imports `whatsapp.js`
- `src/jobs/batch-engine.js` — imports `deepseek.js`
- `src/routes/evolution.js` — imports `evolution.js`
