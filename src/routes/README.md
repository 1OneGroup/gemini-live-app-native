# src/routes/

HTTP endpoint handlers — one module per logical domain (Plivo webhooks, call CRUD, campaigns, analytics, etc.). Express.Router instances wrapped for easy mounting.

## Files

- `plivo.js` — POST /answer (inbound), POST /hangup, POST /digits (DTMF)
- `calls.js` — GET /calls, GET /calls/:id, POST /calls, PUT /calls/:id
- `campaigns.js` — GET/POST/PUT /campaigns, campaign list, create, update
- `brochures.js` — GET /brochures, POST /brochures, WhatsApp send integration
- `employees.js` — GET/POST /employees, team member CRUD
- `prompts.js` — GET/POST /prompts, list and create prompt templates
- `model.js` — GET /model, POST /model/test (model switching & validation)
- `analytics.js` — GET /analytics (KPIs, charts, call metrics)
- `health.js` — GET /health (liveness & readiness)

> **Status:** placeholder — will be populated in Phase 3. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
