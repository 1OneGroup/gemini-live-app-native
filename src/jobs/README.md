# src/jobs/

Async workers and cron jobs — batch call processing, auto-callback scheduling, callback data sync from Plivo webhooks.

## Files

- `batch-engine.js` — Start/stop/pause campaigns; distribute calls to Plivo in batches; honor rate limits
- `auto-callback.js` — Cron job to reschedule missed calls (moved from root)
- `sync-callback-data.js` — Webhook handler to record Plivo call state (ringing, answered, hangup)

> **Status:** placeholder — will be populated in Phase 7. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
