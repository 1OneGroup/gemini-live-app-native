# DeepSeek V3.2 Post-Call Analysis — Design

## Context

The app uses Gemini 3.1 Flash Live for realtime voice (audio in → audio out) and also receives
transcripts from Gemini via `inputAudioTranscription` / `outputAudioTranscription` in the session
setup. Transcription is **not** duplicated anywhere server-side.

What *is* happening redundantly is post-call analysis:

1. **Per-call outcome classification** — [`batch-engine.js` `classifyOutcome()`](../../../batch-engine.js) uses
   brittle keyword matching (`transcript.includes('brochure')`, etc.) to pick one of 7 outcomes.
   Misses paraphrases, mixed English/Hindi phrasing, sarcasm.
2. **Batch-level analysis** — [`batch-engine.js` `runBatchAnalysis()`](../../../batch-engine.js) ships all 20
   batch transcripts to **Gemini 2.5 Flash** (text) via REST to produce `{summary,
   recommendations, prompt_adjustments}`.

Goal: replace both with DeepSeek V3.2, capture richer per-call signal, and keep token use low.

## Non-Goals

- Changing Gemini 3.1 Flash Live for realtime voice (keep as-is).
- Replacing transcription (already from Gemini, no separate ASR exists).
- Generating `recommendations` or `prompt_adjustments` on batches — dropped by user request.
- Dashboard redesign — keep as-is, just surface new fields if trivial.

## Architecture

```
Plivo ⇄ Gemini 3.1 Flash Live  (audio + transcripts, unchanged)
                │
                └─► Postgres (transcripts stored)
                         │
                         ├─► DeepSeek V3.2: classifyCall  (replaces keyword regex)
                         └─► DeepSeek V3.2: summarizeBatch (replaces Gemini 2.5 Flash call)
```

Two DeepSeek functions, each used at one existing call-site. No other moving parts.

## Schema

### Per-call JSON (output of `classifyCall`)

```json
{
  "outcome": "interested",
  "intent": "site_visit_agreed",
  "interest_score": 8,
  "objections": ["price"],
  "one_line_summary": "Agreed to Saturday site visit; pushed back on 1.6Cr price."
}
```

**`outcome`** — 7 values (unchanged from today):
`interested`, `not_interested`, `callback`, `brochure_sent`, `no_answer`, `busy`, `voicemail`.
DeepSeek only sees transcripts, so it really classifies the first four; `no_answer`/`busy`/`voicemail`
are still set by Plivo hangup cause / AMD before DeepSeek is called.

**`intent`** — 7 values, mirroring the codebase's real features:
- `site_visit_agreed` — customer said yes to visiting (primary goal)
- `whatsapp_only` — wants brochure, declined visit
- `callback_requested` — busy now, call later
- `has_objections` — engaged but pushing back (price/location/timing)
- `not_interested` — flat no
- `wrong_person` — gatekeeper / wrong number / not a buyer
- `unclear` — too short / ambiguous

**`interest_score`** — integer 0–10. Orthogonal to outcome; lets us rank warm leads.

**`objections`** — short string array, e.g. `["price", "location", "timing"]`. Empty array if none.

**`one_line_summary`** — ~15 words. Fed into `summarizeBatch` (batch never re-sees transcripts).

### Batch JSON (output of `summarizeBatch`)

```json
{ "summary": "..." }
```

Just `summary`. `recommendations` and `prompt_adjustments` dropped per user request (still
nullable in the DB).

## Database changes

### `gemini_live.contacts` — add 4 nullable columns

```sql
ALTER TABLE gemini_live.contacts ADD COLUMN intent TEXT;
ALTER TABLE gemini_live.contacts ADD COLUMN interest_score INTEGER;
ALTER TABLE gemini_live.contacts ADD COLUMN objections TEXT;        -- JSON array
ALTER TABLE gemini_live.contacts ADD COLUMN one_line_summary TEXT;
```

Non-destructive; existing rows keep nulls.

### `gemini_live.batch_analyses` — no schema change

`recommendations` and `prompt_adjustments` columns remain but new writes leave them NULL.
Avoids a destructive migration and preserves historical analyses.

## Code changes

### New file: `deepseek.js`

```js
classifyCall(transcript) → { outcome, intent, interest_score, objections, one_line_summary }
summarizeBatch(perCallJsons, stats) → { summary }
```

- OpenAI-compatible endpoint: `https://api.deepseek.com/v1/chat/completions`
- Model: `deepseek-chat` (DeepSeek V3.2)
- `response_format: { type: "json_object" }`
- Per-call prompt: compact system prompt + serialized transcript, ~200 tokens in, ~50 out
- Batch prompt: tiny system prompt + array of per-call JSONs + batch stats, ~500 in, ~100 out

**Fallback**: on DeepSeek error, `classifyCall` falls back to the existing keyword-matching
logic (kept as a private helper inside `deepseek.js`). Contact gets `outcome`; new fields stay
NULL. `summarizeBatch` writes `"Analysis failed: <error>"` as summary (matches today's behavior).

### `batch-engine.js`

- **`classifyOutcome()`** — removed. Replaced at call-site (after `waitForCallCompletion`) with
  `await deepseek.classifyCall(call.transcript)`. Result destructured and passed to
  `db.updateContact({...})` along with existing `callbackDate`/`callbackNote`.
- **`runBatchAnalysis()`** — no longer re-sends transcripts. Pulls the 20 per-call JSONs
  directly from the `contacts` rows (intent, interest_score, objections, one_line_summary),
  calls `deepseek.summarizeBatch(perCallJsons, batchStats)`, writes summary only.
- **`GEMINI_TEXT_MODEL` constant** — removed.

### `db.js`

- `updateContact()` signature extends to accept `intent`, `interestScore`, `objections`,
  `oneLineSummary`.
- `getContacts()` and related queries return the new fields (already `SELECT *`).
- Optional (not in this pass): add `SUM(CASE WHEN intent=... THEN 1 ELSE 0 END)` rollups to
  `getContactStats` / `getBatchStats` for dashboard intent breakdowns.

### `server.js`

- Reads `DEEPSEEK_API_KEY` from env (no usage outside `deepseek.js`, but document in logs on
  startup if missing).

### `.env` and `docker-compose.yml`

- Add `DEEPSEEK_API_KEY=...` to `.env` and `.env.example`.
- Pass through in `docker-compose.yml` environment block.

## Deployment flow

The running container is the source of truth. Workflow for these changes:

1. Edit files in `/home/office/gemini-live-app-native/`.
2. `docker cp <file> gemini-live-app-native:/app/<file>` for each changed file.
3. `docker restart gemini-live-app-native`.
4. Commit and push to GitHub `main`.

DB migration runs once manually via `psql` or equivalent (no migration framework in the project today).

## Risks & tradeoffs

- **DeepSeek API availability** — single external dependency. Fallback to keyword regex keeps
  the system functional if DeepSeek is down.
- **Cost** — DeepSeek V3.2 per-token pricing is lower than Gemini 2.5 Flash, and the batch call
  ships ~10× less data (per-call JSONs instead of full transcripts). Net: meaningful drop;
  exact numbers to confirm against current DeepSeek pricing at implementation time.
- **Prompt injection via transcripts** — a caller *could* say things that try to manipulate the
  classifier. Mitigated by structured `response_format: json_object` and strict enum validation
  on outcome/intent in `deepseek.js` (invalid values fall through to keyword fallback).
- **Stale per-call JSON for batch summary** — if a call row is missing `one_line_summary`
  (DeepSeek failed on that call), the batch summary skips it. Stats in the batch row still
  reflect everyone.

## Out of scope / follow-ups

- Dashboard intent-breakdown badges (easy add once data is populated).
- Rerunning classification on historical calls (can be a one-shot script later).
- Streaming classification during the call (not necessary; post-call is fine).
