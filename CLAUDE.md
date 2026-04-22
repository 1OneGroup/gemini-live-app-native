# gemini-live-app-native

Outbound-calling platform. Plivo PSTN ↔ Gemini Live (voice) bridge for AI sales calls,
with WhatsApp brochure send-back, DeepSeek V3.2 post-call analysis, a campaign manager
with auto-callback cron, and a single-page dashboard. PostgreSQL (Supabase) persists
campaigns, contacts, transcripts, and analyses. Runs in Docker on port 8100.

## Architecture (data flow)

```
Plivo PSTN ──HTTP webhook──> POST /answer ──> WS /media-stream ──┐
                                                                  │
                         Gemini Live WS (audio in/out) <───bridge─┘
                                                                  │
Dashboard (port 8100 /) <───HTTP───> HTTP endpoints <─────────────┘
                                         │
                                         ├─> PostgreSQL (campaigns, calls, analyses)
                                         ├─> DeepSeek (post-call analysis)
                                         └─> Evolution/Evo Go (WhatsApp)
```

## Run

- **Docker (prod shape):** `docker compose up -d --build`
- **Local:** copy `.env.example` to `.env`, fill values, `npm install`, `npm start`
- **Health:** `curl localhost:8100/health`
- **Dashboard:** `http://localhost:8100/`

## File map

| Path | Purpose |
|---|---|
| `src/index.js` | Process entry. Loads env, runs `db.init()`, starts jobs, creates http server, attaches WS, listens on `PORT`. |
| `src/app.js` | Express app factory. Mounts routers via dependency injection; serves dashboard HTML at `/`. |
| `src/config/` | `env.js`, `models.js` (GEMINI_MODELS registry + active-model getter/setter), `constants.js` (goodbyePhrases, USD_INR, MAX_RECONNECTIONS). |
| `src/db/` | pg Pool (`index.js`), DDL (`schema.sql` + `schema.js`), migrations, per-entity CRUD (campaigns, contacts, analyses, prompts, whatsapp-messages, employees). |
| `src/dashboard/` | `getDashboardHtml()` concatenator + per-feature HTML/CSS/JS string modules under `client/`. |
| `src/gemini/` | Unified Gemini Live session (`session.js` replaces the old duplicated preWarm + reconnect), setup-payload builder, message handler, tools (`end_call`, `send_brochure`), keepalive. |
| `src/integrations/` | `deepseek.js` (OpenRouter), `evolution.js` (Evo-Go WhatsApp API config), `whatsapp.js` (message sending). |
| `src/jobs/` | `batch-engine.js` (campaign runner), `auto-callback.js` (daily cron), `sync-callback-data.js`. |
| `src/lib/` | Pure utilities: `call-store` (in-memory call state), `outcome-classifier` (merged keyword logic), `phone`, `pricing`, `safe-json`. |
| `src/plivo/` | `audio-utils` (mulaw ↔ PCM), `outbound` (makeCall, hangupCall), `websocket` (/media-stream upgrade). |
| `src/prompts/` | `prompts.js` (getSystemInstruction, DEFAULT_PROMPT), `runtime-cues.js` (greeting + continuation + end_call description). |
| `src/routes/` | One Express router per feature area. Each is `(deps) => Router`. See `src/routes/README.md` for the full endpoint table. |
| `docs/refactor-baseline.txt`, `docs/dashboard-baseline.html` | Pre-refactor behavior snapshots for byte-identity verification. Dashboard sha256 `2dee3b508bc3d0436cff2ef0d829c530a692a3e31df8f8b3903e1ccb30cd4460` / 116902 bytes. |

## Environment variables

| Variable | Purpose |
|---|---|
| GEMINI_API_KEY | Google AI Studio API key for Gemini Live |
| GEMINI_MODEL | Gemini model name (default: models/gemini-3.1-flash-live-preview) |
| OPENROUTER_API_KEY | OpenRouter API key (for fallback model selection) |
| PLIVO_AUTH_ID | Plivo account auth ID |
| PLIVO_AUTH_TOKEN | Plivo account auth token |
| PLIVO_FROM_NUMBER | Outbound caller ID (E.164 format) |
| PUBLIC_URL | Public webhook URL for Plivo callbacks (e.g., https://example.com) |
| EVOLUTION_API_URL | Evolution/Evo-Go WhatsApp gateway URL (default: https://evo-go.tech.onegroup.co.in) |
| EVOLUTION_API_KEY | Evolution API key for WhatsApp authentication |
| EVOLUTION_INSTANCE | Evolution instance name (default: main-whatsapp) |
| DATABASE_URL | Supabase/PostgreSQL connection string (required) |
| CLASSIFIER_DASHBOARD_URL | Dashboard classifier endpoint URL |
| PORT | HTTP server port (default: 8100) |
| DATA_DIR | Local call recording and data directory (default: /data/calls) |

## Known follow-ups (out of scope for this refactor)

- No automated tests yet. The refactor is verified via static byte-identity + live smoke calls against a staging container.
- `preWarmGemini` vs `reconnectGemini` were originally asymmetric in 14 subtle ways — logging verbosity, a missing user-buffer flush on reconnect, `send_brochure` fallback omitting `whatsappMessageKey`, different error wording. Phase 4 preserved these byte-identically under the `isReconnect` flag; several look like bugs worth fixing in a follow-up.
- `pg` DeprecationWarning at boot: `client.query()` called while another query is executing. Pre-existing; preserved through the refactor.
- ESLint / Prettier are stubbed (`npm run lint` is a placeholder); add real linting if you want enforcement.
