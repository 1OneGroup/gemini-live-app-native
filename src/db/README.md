# src/db/

PostgreSQL (Supabase) schema, migrations, and entity CRUD operations. Each domain (campaigns, contacts, calls, analyses, etc.) has its own module.

## Files

- `index.js` — Database client init, connection pool, transaction helpers
- `schema.sql` — Complete schema (tables, constraints, indexes) for version control
- `campaigns.js` — Campaign CRUD, list, search, status updates
- `contacts.js` — Contact CRUD, deduplication, list by campaign
- `analyses.js` — Call analysis records, DeepSeek results, outcome storage
- `prompts.js` — Prompt template storage and retrieval
- `employees.js` — Team member records, permissions, quota tracking

> **Status:** placeholder — will be populated in Phase 5. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
