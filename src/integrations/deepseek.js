// DeepSeek V3.2 post-call analysis via OpenRouter (OpenAI-compatible).
// Two entry points:
//   classifyCall(transcript)           → per-call {outcome,intent,interest_score,objections,one_line_summary}
//   summarizeBatch(perCallJsons, stats) → batch {summary}
// Falls back to keyword matching on API/parse failure so the batch engine stays functional.

const { classifyOutcome: _classifyOutcome } = require('../lib/outcome-classifier');

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-v3.2';
const API_KEY = process.env.OPENROUTER_API_KEY;

const OUTCOMES = ['interested', 'not_interested', 'callback', 'brochure_sent', 'no_answer', 'busy', 'voicemail'];
const INTENTS  = ['site_visit_agreed', 'whatsapp_only', 'callback_requested', 'has_objections', 'not_interested', 'wrong_person', 'unclear'];

const CLASSIFY_SYSTEM = `You classify real-estate cold-call transcripts (Hindi+English mixed) for a sales team.

Return ONE JSON object, no prose, with exactly these keys:
{
  "outcome": one of ${JSON.stringify(OUTCOMES.slice(0,4))},
  "intent":  one of ${JSON.stringify(INTENTS)},
  "interest_score": integer 0-10,
  "objections": string[] drawn from short tokens like "price","location","timing","size","builder","financing","family_decision" (empty array if none),
  "one_line_summary": ~15 words, past tense, factual
}

Outcome guidance:
- "interested"     → customer engaged, agreed to visit OR asked for follow-up
- "brochure_sent"  → customer wants info/brochure on WhatsApp, declined visit
- "callback"       → busy, asked to be called later
- "not_interested" → flat no, remove my number, not a buyer

Intent is a finer signal orthogonal to outcome:
- site_visit_agreed   → yes to visit
- whatsapp_only       → brochure yes, visit no
- callback_requested  → call later
- has_objections      → engaged but pushing back
- not_interested      → flat no
- wrong_person        → gatekeeper / wrong number
- unclear             → too short/ambiguous

interest_score: 0=flat-no, 3-4=lukewarm, 5-6=curious, 7-8=warm, 9-10=ready-to-visit.`;

const SUMMARIZE_SYSTEM = `You are a telecalling batch analyst. You receive per-call classification JSONs (already summarized — do NOT ask for full transcripts) plus aggregate stats.

Return ONE JSON object, no prose: {"summary": "..."}

The summary is 2-3 sentences. Focus on patterns: common objections, intent distribution, warm-lead quality. Mention specific numbers when they stand out. Write for a sales manager reading between batches.`;

async function callOpenRouter(messages, maxTokens, temperature) {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY not set');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gemini-live.tech.onegroup.co.in',
      'X-Title': 'gemini-live-app-native',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: 'json_object' },
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty OpenRouter response');
  return JSON.parse(content);
}

function serializeTranscript(transcript) {
  if (!Array.isArray(transcript) || transcript.length === 0) return '';
  return transcript.map(t => `${t.role || '?'}: ${t.text || ''}`).join('\n').slice(0, 6000);
}

// Keyword fallback — delegates to the shared outcome-classifier module.
function keywordFallback(transcript) {
  const text = serializeTranscript(transcript);
  if (!text) return 'no_answer';
  const result = _classifyOutcome(transcript);
  // deepseek.js historically returned 'interested' as default for any transcript-bearing
  // call (not 'no_answer'), so preserve that behaviour when the shared module returns no_answer.
  if (result === 'no_answer') return 'interested';
  return result;
}

function emptyResult(outcome) {
  return { outcome, intent: null, interest_score: null, objections: null, one_line_summary: null };
}

async function classifyCall(transcript) {
  const serialized = serializeTranscript(transcript);
  if (!serialized) return emptyResult('no_answer');
  if (!API_KEY) return emptyResult(keywordFallback(transcript));

  try {
    const parsed = await callOpenRouter([
      { role: 'system', content: CLASSIFY_SYSTEM },
      { role: 'user', content: `Transcript:\n${serialized}` },
    ], 300, 0.2);

    const outcome = OUTCOMES.includes(parsed.outcome) ? parsed.outcome : keywordFallback(transcript);
    const intent  = INTENTS.includes(parsed.intent) ? parsed.intent : null;
    let score = parsed.interest_score;
    if (typeof score !== 'number' || !Number.isFinite(score)) score = null;
    else score = Math.max(0, Math.min(10, Math.round(score)));
    const objections = Array.isArray(parsed.objections) ? parsed.objections.filter(s => typeof s === 'string').slice(0, 8) : [];
    const summary = typeof parsed.one_line_summary === 'string' ? parsed.one_line_summary.slice(0, 300) : null;

    return { outcome, intent, interest_score: score, objections, one_line_summary: summary };
  } catch (err) {
    console.error('[DeepSeek] classifyCall failed:', err.message);
    return emptyResult(keywordFallback(transcript));
  }
}

async function summarizeBatch(perCallJsons, stats) {
  if (!API_KEY) return { summary: 'Analysis failed: OPENROUTER_API_KEY not set' };
  const payload = {
    stats: stats || {},
    calls: (perCallJsons || []).map(c => ({
      outcome: c.outcome,
      intent: c.intent,
      interest_score: c.interest_score,
      objections: c.objections || [],
      one_line_summary: c.one_line_summary,
    })),
  };
  try {
    const parsed = await callOpenRouter([
      { role: 'system', content: SUMMARIZE_SYSTEM },
      { role: 'user', content: JSON.stringify(payload) },
    ], 400, 0.3);
    const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Analysis failed: empty summary';
    return { summary };
  } catch (err) {
    console.error('[DeepSeek] summarizeBatch failed:', err.message);
    return { summary: `Analysis failed: ${err.message}` };
  }
}

module.exports = { classifyCall, summarizeBatch };
