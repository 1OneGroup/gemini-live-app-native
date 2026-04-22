// Outcome classifier — merges batch-engine.js, call-store.js, and deepseek.js
// keyword-matching logic into a single authoritative implementation.
//
// Exported: classifyOutcome(transcript, durationSec, opts = {})
//
// opts:
//   deepseekResult {string|null} — if provided, used directly as the outcome
//                                  (still validated against known outcomes).
//   multiOutcome   {boolean}     — when true, returns a comma-joined string of
//                                  ALL matching outcome labels (call-store style).
//                                  When false (default), returns the first/best
//                                  single outcome (batch-engine / deepseek style).
'use strict';

const KNOWN_OUTCOMES = ['interested', 'not_interested', 'callback', 'brochure_sent', 'no_answer', 'busy', 'voicemail'];

/**
 * Normalise a transcript value to a single lowercase string.
 * Accepts: array of { text, role } objects, or a plain string.
 */
function normalizeTranscript(transcript) {
  if (Array.isArray(transcript)) {
    return transcript.map(t => (t.text || t || '').toLowerCase()).join(' ');
  }
  if (typeof transcript === 'string') return transcript.toLowerCase();
  return '';
}

/**
 * Classify a call outcome from keyword matching on the transcript.
 *
 * Union of keywords from:
 *  - batch-engine.js classifyOutcome (original)
 *  - call-store.js classifyCallOutcome (richest list, ported from batch-engine)
 *  - deepseek.js keywordFallback
 *
 * @param {Array|string} transcript  - call transcript (array of {text,role} or plain string)
 * @param {number}       durationSec - call duration in seconds (used for fallback)
 * @param {object}       opts
 * @param {string|null}  opts.deepseekResult - pre-classified outcome from DeepSeek AI
 * @param {boolean}      opts.multiOutcome   - return comma-joined multi-outcome (default false)
 * @returns {string}
 */
function classifyOutcome(transcript, durationSec, opts = {}) {
  const { deepseekResult = null, multiOutcome = false } = opts;

  // If a validated DeepSeek result is available, trust it.
  if (deepseekResult && KNOWN_OUTCOMES.includes(deepseekResult)) {
    return deepseekResult;
  }

  const text = normalizeTranscript(transcript);

  if (!text) {
    // No transcript — use duration fallback
    if (durationSec && durationSec > 30) return 'interested';
    if (durationSec && durationSec > 10) return 'callback';
    return 'no_answer';
  }

  const outcomes = [];

  // Brochure / WhatsApp send — call-store requires both signals; batch-engine + deepseek
  // only need one. Take the call-store AND logic (brochure + send/whatsapp) as the primary
  // check; add batch-engine's "send me" as an additional trigger.
  if (text.includes('brochure') && (text.includes('whatsapp') || text.includes('send'))) {
    outcomes.push('brochure_sent');
  } else if (text.includes('brochure') || text.includes('send me')) {
    // Weaker signal (batch-engine / deepseek compatibility)
    outcomes.push('brochure_sent');
  }

  // Interested — union of all keyword lists
  if (
    text.includes('site visit') || text.includes('appointment') || text.includes('schedule') ||
    text.includes('interested') || text.includes('tell me more') || text.includes('details') ||
    text.includes('visit kar')
  ) {
    outcomes.push('interested');
  }

  // Not interested — union of all keyword lists
  if (
    text.includes('not interested') || text.includes('no thank') || text.includes("don't call") ||
    text.includes('remove my number') || text.includes('remove') || text.includes('no need')
  ) {
    outcomes.push('not_interested');
  }

  // Callback — union of all keyword lists (call-store has the richest set)
  if (
    text.includes('call back') || text.includes('callback') || text.includes('later') ||
    text.includes('busy right now') || text.includes('abhi nahi') || text.includes('call me') ||
    text.includes('baad mein') || text.includes('din baad') || text.includes('baad call')
  ) {
    outcomes.push('callback');
  }

  if (outcomes.length === 0) {
    // Duration-based fallback
    if (durationSec && durationSec > 30) return 'interested';
    if (durationSec && durationSec > 10) return 'callback';
    return 'no_answer';
  }

  if (multiOutcome) {
    return outcomes.join(',');
  }

  // Single-outcome mode: prefer more specific / positive outcomes
  // Priority: brochure_sent > interested > callback > not_interested
  if (outcomes.includes('brochure_sent')) return 'brochure_sent';
  if (outcomes.includes('interested')) return 'interested';
  if (outcomes.includes('callback')) return 'callback';
  if (outcomes.includes('not_interested')) return 'not_interested';
  return outcomes[0];
}

module.exports = { classifyOutcome };
