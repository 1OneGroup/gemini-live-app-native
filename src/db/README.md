# src/db

PostgreSQL connection pool, query helpers, and entity CRUD for the gemini_live schema.

## Files

| File | Exports | Purpose |
|---|---|---|
| index.js | `pool, init, uid, queryOne, queryAll, execute, rawQuery, rawExecute` + all entity CRUD | PostgreSQL Pool initialization, query helpers, and barrel export of all entity modules |
| schema.js | `ensureSchema()` | Runs `schema.sql` DDL on startup (idempotent) |
| schema.sql | *(DDL, no JS exports)* | Table definitions and constraints for campaigns, contacts, analyses, prompts, employees, and messages |
| migrations.js | `migrateBrochuresJson()` | One-time migration: loads brochures.json and inserts into whatsapp_messages table |
| campaigns.js | `createCampaign, getCampaign, listCampaigns, updateCampaign, deleteCampaign` | CRUD for campaigns table |
| contacts.js | `insertContacts, getContacts, getContactStats, getBatchStats, getContactByCallUuid, updateContact, getCallbackContacts, getNextPendingContact, getMaxBatch` | CRUD and queries for contacts table; batch assignment on bulk insert |
| analyses.js | `createAnalysis, getAnalysis, listAnalyses, approveAnalysis, rejectAnalysis, deleteAnalysis` | CRUD for batch_analyses table |
| prompts.js | `createPrompt, listPrompts, getPrompt, updatePrompt, deletePrompt, setActivePrompt, getActivePrompt, seedDefaultPrompt` | CRUD for prompts table; `seedDefaultPrompt()` seeded on init |
| whatsapp-messages.js | `createWhatsappMessage, listWhatsappMessages, getWhatsappMessage, updateWhatsappMessage, deleteWhatsappMessage, setActiveWhatsappMessage, getActiveWhatsappMessage` | CRUD for whatsapp_messages table |
| employees.js | `createEmployeeInstance, listEmployeeInstances, getEmployeeInstance, getEmployeeByName, updateEmployeeInstance, deleteEmployeeInstance, getUniqueEmployeeNames` | CRUD for employee_instances table |

## Init sequence

1. `index.js` exports `init()`, which runs: `schema.ensureSchema()` (DDL) → `prompts.seedDefaultPrompt()` (default prompt) → `migrations.migrateBrochuresJson()` (one-time migration).
2. Order is critical: schema must exist before seeding or migrating data.
3. All operations are idempotent; safe to call on every startup.

## Imported by

- src/index.js
- src/jobs/sync-callback-data.js
- src/jobs/batch-engine.js
- src/jobs/auto-callback.js
- src/integrations/whatsapp.js
- src/prompts/prompts.js
