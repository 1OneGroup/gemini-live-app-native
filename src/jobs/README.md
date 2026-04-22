# src/jobs

Async orchestration tasks: campaign batch dialing, daily auto-callback scheduling, and startup callback data repair.

## Files

| File | Exports | Purpose |
|---|---|---|
| `batch-engine.js` | `startCampaign`, `pauseCampaign`, `cancelCampaign`, `isRunning`, `getRunnerStatus`, `setMakeCallFn`, `classifyOutcome`, `runBatchAnalysis` | Campaign batch runner — dials contacts in groups, waits 5s between calls, runs AI analysis after each batch, pauses for approval before next batch. |
| `auto-callback.js` | `runAutoCallbacks`, `scheduleAutoCallbackCron` | Daily auto-callback cron — filters contacts whose `callback_date` is due, dials them via `makeCall`, marks as `calling`. Fires at 11:00 AM IST (5:30 AM UTC). |
| `sync-callback-data.js` | `syncCallbackData` | One-time startup repair — syncs in-memory call-store callback and outcome data to the `contacts` DB table, re-classifies outcomes that predate multi-outcome support, extracts callback timing. |

## Schedule

- **auto-callback**: Runs daily at 11:00 AM IST via `setInterval` check (cron defined in `auto-callback.js`). Dials all due contacts across campaigns with `auto_callback` enabled.
- **batch-engine**: Runs on-demand when a campaign is started (via dashboard or API). Blocks between batches for approval.
- **sync-callback-data**: Runs once at startup (after short delay in `src/index.js`).

## Imported by

- `src/index.js` (batch engine, auto-callback cron, sync routine)
