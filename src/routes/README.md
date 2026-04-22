# src/routes/

Express routers for API endpoints — domain-specific handlers (Plivo webhooks, call CRUD, campaigns, analytics, etc.) exported as factory functions for dependency injection.

## Routers

| File | HTTP Routes |
|------|-------------|
| analytics.js | GET /api/analytics |
| brochures.js | GET/POST /api/brochures, DELETE /api/brochures/:key |
| calls.js | GET /api/calls, GET /api/calls/:callUuid |
| campaigns.js | GET/POST /api/campaigns, GET/PATCH/DELETE /api/campaigns/:id, POST /api/campaigns/:id/{upload,start,pause,cancel,trigger-callbacks,auto-callback,batches/:n/approve,batches/:n/rerun-analysis}, GET /api/campaigns/:id/{callbacks,batches,batches/:n/analysis,contacts} |
| employees.js | GET /api/employee-instances/auto-detect, GET/POST /api/employee-instances, PATCH/DELETE /api/employee-instances/:id |
| evolution.js | GET /api/evolution/instances, POST /api/evolution/create-instance, GET /api/evolution/:path (proxy) |
| health.js | GET /health |
| model.js | GET /api/model, POST /api/model |
| plivo.js | POST {/answer,/stream-status,/recording-callback,/recording-status,/hangup,/machine-detection,/call} |
| prompts.js | GET/POST/DELETE /api/prompt, GET/POST /api/prompts, GET/PATCH/DELETE /api/prompts/:id, POST /api/prompts/:id/activate, DELETE /api/prompts/active |
| whatsapp-messages.js | GET/POST /api/whatsapp-messages, POST /api/whatsapp-messages/improve, DELETE /api/whatsapp-messages/active, GET/PATCH/DELETE /api/whatsapp-messages/:id, POST /api/whatsapp-messages/:id/activate |

## Dependency injection

Each router exports `(deps) => Router`. The factory receives shared dependencies from `src/app.js`: `store`, `db`, `makeCall`, `hangupCall`, `GEMINI_MODELS`, `getActiveModel`, `setActiveModel`, `callCostInr`, `safeJsonParse`, `normalizePhone`, `pendingSessions`, `sessions`, `getDashboardHtml`, `getSystemInstruction`, `saveSystemInstruction`, `isUsingOverride`, `DEFAULT_PROMPT`, `USD_INR`, `PLIVO_RATE`, `whatsapp`, `batchEngine`, and `handleVoicemailDetected`. This keeps routers free of global state and simplifies testing.

## Imported by

- `src/app.js`
