# src/

Target structure for the refactored AI-friendly codebase. The monolithic `server.js`, `dashboard.js`, and domain helpers are being decomposed phase-by-phase into this structure, maintaining backward compatibility and byte-identical behavior throughout.

## Directory map

| Dir | Purpose | Populated | Files |
|---|---|---|---|
| `config/` | Environment & static config | Phase 2 | env.js, models.js, constants.js |
| `lib/` | Shared utilities (no I/O) | Phase 2 | outcome-classifier.js, pricing.js, phone.js, safe-json.js, call-store.js |
| `prompts/` | Gemini prompt templates | Phase 2 | index.js, default-clermont.js, runtime-cues.js |
| `routes/` | HTTP endpoint handlers | Phase 3 | plivo.js, calls.js, campaigns.js, brochures.js, employees.js, prompts.js, model.js, analytics.js, health.js |
| `gemini/` | Gemini Live session logic | Phase 4 | session.js, setup-payload.js, message-handler.js, tools.js, keepalive.js |
| `db/` | PostgreSQL entity CRUD + schema | Phase 5 | index.js, schema.sql, campaigns.js, contacts.js, analyses.js, prompts.js, employees.js |
| `dashboard/` | Dashboard server-side logic | Phase 6 | index.js, styles.css.js, layout.html.js, bootstrap.js |
| `dashboard/client/` | Dashboard single-page app (browser) | Phase 6 | campaigns.js, calls.js, analytics.js, prompts.js, brochures.js, settings.js, state.js, utils.js |
| `plivo/` | Plivo PSTN & WebSocket bridge | Phase 7 | websocket.js, outbound.js, audio-utils.js |
| `jobs/` | Async jobs & cron workers | Phase 7 | batch-engine.js, auto-callback.js, sync-callback-data.js |
| `integrations/` | Third-party API clients | Phase 7 | whatsapp.js, deepseek.js, evolution.js |

## Status

Placeholder — currently populated by Phase 1 scaffolding only. See `/home/office/.claude/plans/swift-percolating-teapot.md` for the full refactor plan.

> **Status:** placeholder — will be populated in Phases 2–7. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
