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
| server.js (1860 lines) | **Legacy monolith** — HTTP server, Plivo+Gemini WS bridging, all routes, outbound call logic. Being split in Phases 3/4/7. |
| dashboard.js | **Legacy monolith** — returns the rendered HTML of the dashboard. Being split in Phase 6. |
| db.js | Supabase/Postgres client + schema bootstrap + entity CRUD. Splitting in Phase 5. |
| batch-engine.js, call-store.js, deepseek.js, whatsapp.js, prompts.js, audio-utils.js | Domain helpers. Moving under `src/jobs/`, `src/lib/`, `src/integrations/`, `src/prompts/` in Phases 2/7. |
| src/ | **Target structure** (see `src/README.md` for the full map). Populated phase-by-phase; each subdir has its own README. |
| docs/refactor-baseline.txt, docs/dashboard-baseline.html | Pre-refactor behavior snapshots used to verify byte-identical behavior. |

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

## Refactor in progress

This repo is mid-refactor (`refactor/ai-friendly-structure` branch). Phase plan at
`/home/office/.claude/plans/swift-percolating-teapot.md`. Execution plan at
`/home/office/.claude/plans/execute-the-ai-friendliness-refactor-jolly-dream.md`.
Current phase: 1 (scaffolding — directory structure, README stubs, package.json updates).
