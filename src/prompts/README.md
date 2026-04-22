# prompts/

Manages system prompts and runtime cues for Gemini Live sessions — Clermont project sales script with override support.

## Files

| File | Exports | Purpose |
|---|---|---|
| `prompts.js` | `getSystemInstruction()`, `saveSystemInstruction()`, `resetToDefault()`, `isUsingOverride()`, `DEFAULT_PROMPT` | Prompt I/O library. Loads active prompt from DB, file override, or default. Supports runtime editing and persistence to `/data/prompt-override.txt`. |
| `runtime-cues.js` | `OPENING_GREETING_CUE`, `CONTINUATION_CUE`, `END_CALL_DESCRIPTION` | Inline cue strings injected into Gemini WS sessions. Trigger opening greeting on dial, resume mid-call, and mark call close. |

## DB-backed prompts

The `prompts` table (in Supabase) stores named prompt variants. `getActivePrompt()` in `src/db/prompts.js` queries this table and overrides `DEFAULT_PROMPT` when a variant is marked active. Priority: **Active DB prompt** → **File override** → **DEFAULT_PROMPT**.

## Imported by

- `src/index.js` — Bootstraps system instruction on app startup
- `src/db/prompts.js` — Falls back to DEFAULT_PROMPT if no active DB record
- `src/gemini/setup-payload.js` — Injects END_CALL_DESCRIPTION into tool definitions
- `src/gemini/message-handler.js` — Sends OPENING_GREETING_CUE and CONTINUATION_CUE as realtimeInput.text
- `src/gemini/session.js` — Fetches active instruction before creating Gemini WS session
- `src/routes/prompts.js` — HTTP route handler; resets override via resetToDefault()
- `src/app.js` — Mounts prompts route at `/api/prompt*`
