## DeepSeek V3.2 Post-Call Analysis — Implementation Plan

**Goal:** Replace keyword-based per-call outcome classification and Gemini 2.5 Flash batch analysis with DeepSeek V3.2, add richer per-call signal (intent, interest_score, objections, one_line_summary), keep token use low.

**Architecture:** One new module `deepseek.js` exposing `classifyCall(transcript)` and `summarizeBatch(perCallJsons, stats)`. `batch-engine.js` calls `classifyCall` after `waitForCallCompletion` and `summarizeBatch` instead of the Gemini REST call. DB gets 4 new nullable columns on `contacts`. Fallback to keyword logic on DeepSeek error.

**Tech Stack:** Node.js, Postgres (Supabase), DeepSeek V3.2 (`deepseek-chat`, OpenAI-compatible JSON mode), Docker.

---

### Task 1: DB migration — add 4 nullable columns to `contacts`

**Files:**
- Run-once migration (no file in repo; spec says manual via psql)

- [ ] Run via `docker exec supabase-db psql -U supabase_admin -d postgres`:

```sql
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS intent TEXT;
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS interest_score INTEGER;
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS objections TEXT;
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS one_line_summary TEXT;
```

- [ ] Update `db.js` `ensureSchema()` so fresh deploys also get the columns. Add the four `ADD COLUMN IF NOT EXISTS` lines after the `contacts` table definition (safe because Postgres supports this idempotently).

---

### Task 2: Create `deepseek.js`

**Files:**
- Create: `/home/office/gemini-live-app-native/deepseek.js`

- [ ] Write module with:
  - Constants: `DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'`, `DEEPSEEK_MODEL = 'deepseek-chat'`, `DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY`.
  - Valid enum sets: `OUTCOMES = ['interested','not_interested','callback','brochure_sent','no_answer','busy','voicemail']`, `INTENTS = ['site_visit_agreed','whatsapp_only','callback_requested','has_objections','not_interested','wrong_person','unclear']`.
  - `async function classifyCall(transcriptArray)`:
    - Serialize transcript array `[{role,text}]` → `role: text` newline-joined. If empty or missing API key → return `{ outcome: keywordFallback(transcriptArray), intent: null, interest_score: null, objections: null, one_line_summary: null }`.
    - System prompt: strict JSON-only classifier for real-estate cold-call transcripts (Hindi+English). Describes the 7 outcomes, 7 intents, 0–10 interest_score, objections array, ~15-word one_line_summary. Demands output shape exactly.
    - Call DeepSeek with `response_format: { type: 'json_object' }`, `temperature: 0.2`, `max_tokens: 300`.
    - Parse JSON; validate `outcome ∈ OUTCOMES`, `intent ∈ INTENTS` (else null), clamp score 0–10, coerce objections to string[] or `[]`.
    - On any thrown error or invalid JSON: log and return keyword fallback shape.
  - `async function summarizeBatch(perCallJsons, stats)`:
    - perCallJsons = array of `{intent, interest_score, objections, one_line_summary, outcome}`. Skip entries with null one_line_summary.
    - System prompt: analyst producing a single JSON `{"summary": "..."}` 2–3 sentence batch overview emphasizing patterns in objections, intents, interest distribution.
    - DeepSeek call, `response_format: json_object`, `temperature: 0.3`, `max_tokens: 400`.
    - On error: return `{ summary: 'Analysis failed: ' + err.message }`.
  - Private `keywordFallback(transcriptArray)`: port of the existing keyword logic from `batch-engine.js:classifyOutcome` (the transcript-scanning portion — brochure/site visit/not interested/callback cases). Returns a single outcome string.
  - `module.exports = { classifyCall, summarizeBatch };`.

- [ ] Smoke-test locally before deploying:

```bash
cd /home/office/gemini-live-app-native
DEEPSEEK_API_KEY=<key> node -e "require('./deepseek').classifyCall([{role:'assistant',text:'Would you like to visit the site on Saturday?'},{role:'user',text:'Yes Saturday works, but 1.6 crore is too much'}]).then(console.log)"
```

Expected: JSON with `outcome: 'interested'`, `intent: 'site_visit_agreed'`, `interest_score` 7–9, `objections: ['price']`, a ~15-word summary.

---

### Task 3: Rewire `batch-engine.js`

**Files:**
- Modify: `/home/office/gemini-live-app-native/batch-engine.js`

- [ ] Remove `GEMINI_TEXT_MODEL` constant (line 7) and add `const deepseek = require('./deepseek');` near top (below `const store = require('./call-store');`).

- [ ] Replace call-site after `waitForCallCompletion`. Currently:
```js
const outcome = await waitForCallCompletion(result.callUuid, 300000);
const callData = store.getCall(result.callUuid);
await db.updateContact(contact.id, {
  status: 'completed', outcome,
  callbackDate: callData?.callbackDate || null,
  callbackNote: callData?.callbackRequested || null,
});
```
Change to:
```js
const preOutcome = await waitForCallCompletion(result.callUuid, 300000);
const callData = store.getCall(result.callUuid);
// Hangup-cause-derived outcomes (no_answer/busy/voicemail) — no transcript classification needed.
let outcome = preOutcome;
let intent = null, interestScore = null, objections = null, oneLineSummary = null;
if (['interested','not_interested','callback','brochure_sent'].includes(preOutcome) && callData?.transcript?.length) {
  const c = await deepseek.classifyCall(callData.transcript);
  outcome = c.outcome || preOutcome;
  intent = c.intent;
  interestScore = c.interest_score;
  objections = c.objections ? JSON.stringify(c.objections) : null;
  oneLineSummary = c.one_line_summary;
}
await db.updateContact(contact.id, {
  status: 'completed', outcome,
  callbackDate: callData?.callbackDate || null,
  callbackNote: callData?.callbackRequested || null,
  intent, interestScore, objections, oneLineSummary,
});
```

- [ ] Simplify `waitForCallCompletion`: keep it returning transcript-derived outcome as the *preliminary* signal. (Leave `classifyOutcome` in-file for fallback — still referenced by `module.exports` for backward compat. The keyword fallback lives in `deepseek.js`; this one is the non-transcript hangup-cause classifier.) Actually: `classifyOutcome` is still useful for the AMD/hangup case. Keep it, it's exported. Done.

- [ ] Rewrite `runBatchAnalysis(campaignId, batchNumber)`:
```js
async function runBatchAnalysis(campaignId, batchNumber) {
  const contacts = await db.getContacts(campaignId, { batchNumber });
  const batchStats = await db.getBatchStats(campaignId, batchNumber);

  const perCallJsons = contacts
    .filter(c => c.one_line_summary)
    .map(c => ({
      outcome: c.outcome,
      intent: c.intent,
      interest_score: c.interest_score,
      objections: c.objections ? safeJsonParse(c.objections, []) : [],
      one_line_summary: c.one_line_summary,
    }));

  let analysis;
  try {
    analysis = await deepseek.summarizeBatch(perCallJsons, batchStats);
  } catch (err) {
    analysis = { summary: `Analysis failed: ${err.message}` };
  }

  const activePrompt = await db.getActivePrompt();
  await db.createAnalysis(campaignId, batchNumber, {
    summary: analysis.summary,
    recommendations: null,
    promptAdjustments: null,
    stats: batchStats,
    promptId: activePrompt?.id || null,
  });
  console.log(`[BatchEngine] DeepSeek batch analysis saved for batch ${batchNumber}`);
}

function safeJsonParse(s, fb) { try { return JSON.parse(s); } catch { return fb; } }
```

- [ ] Delete the entire old fetch-to-Gemini block (the `prompt = ...`, `fetch(...generativelanguage...)`, and parsing).

---

### Task 4: Extend `db.updateContact` to write new fields

**Files:**
- Modify: `/home/office/gemini-live-app-native/db.js` (function at line 264)

- [ ] Replace `updateContact`:
```js
async function updateContact(id, { status, callUuid, outcome, callbackDate, callbackNote, intent, interestScore, objections, oneLineSummary }) {
  await execute(
    `UPDATE contacts SET
      status = COALESCE($1, status), call_uuid = COALESCE($2, call_uuid),
      outcome = COALESCE($3, outcome), callback_date = COALESCE($4, callback_date),
      callback_note = COALESCE($5, callback_note),
      intent = COALESCE($6, intent), interest_score = COALESCE($7, interest_score),
      objections = COALESCE($8, objections), one_line_summary = COALESCE($9, one_line_summary)
     WHERE id = $10`,
    [status || null, callUuid || null, outcome || null, callbackDate || null, callbackNote || null,
     intent || null, interestScore ?? null, objections || null, oneLineSummary || null, id]
  );
}
```

- [ ] In `ensureSchema`, append to the `CREATE TABLE contacts` section (outside, after CREATE TABLE):
```sql
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS intent TEXT;
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS interest_score INTEGER;
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS objections TEXT;
ALTER TABLE gemini_live.contacts ADD COLUMN IF NOT EXISTS one_line_summary TEXT;
```

---

### Task 5: Wire env var into server/compose/.env.example

**Files:**
- Modify: `/home/office/gemini-live-app-native/server.js` (near line 14)
- Modify: `/home/office/gemini-live-app-native/docker-compose.yml` (environment block)
- Modify: `/home/office/gemini-live-app-native/.env.example`

- [ ] `server.js`: after `const GEMINI_API_KEY = process.env.GEMINI_API_KEY;` add:
```js
if (!process.env.DEEPSEEK_API_KEY) {
  console.warn('[Server] DEEPSEEK_API_KEY not set — per-call classification and batch analysis will use keyword fallback only.');
}
```

- [ ] `docker-compose.yml`: add `- DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}` to the environment block.

- [ ] `.env.example`: add `DEEPSEEK_API_KEY=` line.

- [ ] On the host, append `DEEPSEEK_API_KEY=<key>` to the active `.env` the container is deployed from (wherever `docker-compose up` is run — check `/docker/` locations if not obvious).

---

### Task 6: Deploy to container

- [ ] For each modified/new file, `docker cp` into `gemini-live-app-native:/app/<file>`:
```bash
cd /home/office/gemini-live-app-native
for f in deepseek.js batch-engine.js db.js server.js; do
  docker cp "$f" gemini-live-app-native:/app/"$f"
done
```

- [ ] Set env in container (since `docker-compose.yml` change only takes effect on `up`, and the container is currently `docker run`-based — verify and choose the correct restart path):
```bash
docker inspect gemini-live-app-native --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -i deepseek
```
If not present, the user must export `DEEPSEEK_API_KEY` in the host env and `docker compose up -d` the service to inject it. If the container is not compose-managed, a `docker exec`-visible env is not sufficient — a recreate is required.

- [ ] `docker restart gemini-live-app-native` (or `docker compose up -d --force-recreate gemini-live-bridge` if env was added).

- [ ] Verify startup:
```bash
docker logs --tail 60 gemini-live-app-native
```
Expected: no crash, see `[DB] Schema ensured`, no `DEEPSEEK_API_KEY not set` warning.

---

### Task 7: Commit and push to GitHub main

- [ ] `git add deepseek.js batch-engine.js db.js server.js docker-compose.yml .env.example docs/superpowers/plans/2026-04-22-deepseek-analysis.md`

- [ ] Commit:
```
feat: replace keyword classifier + Gemini batch analysis with DeepSeek V3.2
- new deepseek.js (classifyCall, summarizeBatch) with keyword fallback
- contacts table: add intent, interest_score, objections, one_line_summary
- batch-engine: per-call DeepSeek classification; batch summarizes from per-call JSONs
- drops recommendations/prompt_adjustments generation (cols kept nullable)
```

- [ ] `git push origin main`
