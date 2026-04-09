const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/data/calls';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function getCallPath(callUuid) {
  return path.join(DATA_DIR, `${callUuid}.json`);
}

function createCall(callUuid, { to, customerName, from, promptUsed, model, whatsappMessageKey, employeeName }) {
  const call = {
    callUuid,
    to,
    from,
    customerName,
    promptUsed,
    status: 'initiated',
    startedAt: new Date().toISOString(),
    answeredAt: null,
    endedAt: null,
    duration: null,
    hangupCause: null,
    recordingUrl: null,
    transcript: [],    // { role: 'agent'|'user', text: string, timestamp: string }
    geminiTurns: 0,
    cost: null,
    tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    model: model || null,
    outcome: null, // AI-classified: site_visit_confirmed|interested|callback_requested|brochure_sent|not_interested|wrong_number|voicemail|no_answer|busy|network_issue|do_not_call
    lead_temperature: null, // hot|warm|cold|dead
    follow_up_action: null, // assign_sales_team|send_whatsapp_brochure|send_whatsapp_followup|schedule_callback|retry_call|none
    conversation_summary: null,
    classification_confidence: null,
    whatsappMessageKey: whatsappMessageKey || null,
    employeeName: employeeName || null,
  };
  fs.writeFileSync(getCallPath(callUuid), JSON.stringify(call, null, 2));
  return call;
}

function updateCall(callUuid, updates) {
  const p = getCallPath(callUuid);
  if (!fs.existsSync(p)) return null;
  const call = JSON.parse(fs.readFileSync(p, 'utf8'));
  Object.assign(call, updates);
  fs.writeFileSync(p, JSON.stringify(call, null, 2));
  return call;
}

function addTokens(callUuid, inputTokens, outputTokens) {
  const p = getCallPath(callUuid);
  if (!fs.existsSync(p)) return;
  const call = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!call.tokens) call.tokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  call.tokens.inputTokens += inputTokens || 0;
  call.tokens.outputTokens += outputTokens || 0;
  call.tokens.totalTokens = call.tokens.inputTokens + call.tokens.outputTokens;
  fs.writeFileSync(p, JSON.stringify(call, null, 2));
}

function addTranscript(callUuid, role, text) {
  const p = getCallPath(callUuid);
  if (!fs.existsSync(p)) return;
  const call = JSON.parse(fs.readFileSync(p, 'utf8'));
  call.transcript.push({ role, text, timestamp: new Date().toISOString() });
  if (role === 'agent') call.geminiTurns++;
  fs.writeFileSync(p, JSON.stringify(call, null, 2));
}

// Extract callback timing from transcript text
function extractCallbackTiming(transcript) {
  // Match patterns: English + Hindi/Hinglish
  const patterns = [
    /(\d+)\s*[-–to]+\s*(\d+)\s*(?:days?|din)/i,
    /(\d+)\s*(?:days?|din)\s*(?:baad|later|mein|me|after)?/i,
    /(?:do|teen|char|paanch|ek)\s*(?:din|days?)\s*(?:baad|later|mein|me|after)?/i,
    /(\d+)\s*hours?/i,
    /(\d+)\s*(?:ghante?)/i,
    /next\s+week/i,
    /agle\s+hafte/i,
    /tomorrow/i,
    /kal/i,
    /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,
    /somvaar|mangalvaar|budhvaar|guruvaar|shukravaar|shanivaar|ravivaar/i,
    /(\d+)\s*min/i,
  ];
  // Hindi number words to digits
  const hindiNums = { ek: 1, do: 2, teen: 3, char: 4, paanch: 5, chhah: 6, saat: 7, aath: 8, nau: 9, das: 10 };

  for (const p of patterns) {
    const m = transcript.match(p);
    if (m) {
      let matched = m[0];
      // Normalize Hindi number words
      for (const [word, num] of Object.entries(hindiNums)) {
        if (matched.toLowerCase().startsWith(word)) {
          matched = num + ' days';
          break;
        }
      }
      return matched;
    }
  }
  return null;
}

// Detect voicemail from transcript text
function isVoicemailTranscript(fullTranscript) {
  const vmPhrases = [
    'forwarded to voicemail', 'not available', 'record your message',
    'leave a message', 'record your name and reason', 'after the tone',
    'voicemail box', 'please leave your message'
  ];
  return vmPhrases.some(phrase => fullTranscript.includes(phrase));
}

// Check if user had a substantive response (more than just greetings)
function hasSubstantiveUserResponse(userTurns) {
  const trivialWords = new Set(['hello', 'hi', 'haan', 'han', 'ha', 'haa', 'bol', 'bolo', 'hey', 'alo', 'halo', 'hallo', 'ji', 'yes', 'no', 'por', 'que', 'nein', 'nahi', 'nahin', 'ok', 'okay']);
  return userTurns.some(text => {
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const words = normalized.replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return false;
    return words.some(w => !trivialWords.has(w));
  });
}

// Classify call outcome from transcript — supports multiple outcomes
function classifyCallOutcome(callUuid) {
  const call = getCall(callUuid);
  if (!call || call.outcome) return call?.outcome; // already classified

  const hangup = (call.hangupCause || '').toLowerCase();
  if (hangup === 'rejected' || hangup === 'busy') {
    updateCall(callUuid, { outcome: 'busy' });
    return 'busy';
  }
  if (hangup === 'noanswer' || hangup === 'no_answer' || hangup === 'originator cancel') {
    updateCall(callUuid, { outcome: 'no_answer' });
    return 'no_answer';
  }

  const turns = call.transcript || [];
  const fullTranscript = turns.map(t => (t.text || '').toLowerCase()).join(' ');
  const userTurns = turns.filter(t => t.role === 'user').map(t => (t.text || '').toLowerCase());
  const userTranscript = userTurns.join(' ');

  // 1. Voicemail detection — check before keyword matching
  if (isVoicemailTranscript(fullTranscript)) {
    updateCall(callUuid, { outcome: 'voicemail' });
    return 'voicemail';
  }

  // 2. Keyword matching — only analyze USER turns for interest signals
  const outcomes = [];

  if (userTranscript.includes('brochure') && (userTranscript.includes('whatsapp') || userTranscript.includes('send'))) {
    outcomes.push('brochure_sent');
  }
  // Also detect brochure sent via system confirmation message from send_brochure tool
  if (!outcomes.includes('brochure_sent') && fullTranscript.includes('[sending') && fullTranscript.includes('whatsapp')) {
    outcomes.push('brochure_sent');
  }
  const isNotInterested = userTranscript.includes('not interested') || userTranscript.includes('no thank') ||
      userTranscript.includes('don\'t call') || userTranscript.includes('remove') || userTranscript.includes('no need') ||
      userTranscript.includes('nein') || userTranscript.includes('nahin') ||
      userTranscript.includes('zaroorat nahi') || userTranscript.includes('bilkul nahi') || userTranscript.includes('nahi chahiye');
  if (isNotInterested) {
    outcomes.push('not_interested');
  }
  // site_visit_confirmed — explicit commitment (fallback if tool wasn't called during call)
  if (!isNotInterested && (
      fullTranscript.includes('[site visit confirmed:') ||
      userTranscript.includes('confirm') || userTranscript.includes('pakka') ||
      userTranscript.includes('zaroor') || userTranscript.includes('zarur') ||
      userTranscript.includes('aaunga') || userTranscript.includes('aaenge') ||
      userTranscript.includes('aa raha hoon') || userTranscript.includes('aa rahi hoon') ||
      userTranscript.includes("i'll come") || userTranscript.includes('i will come') ||
      userTranscript.includes('bilkul aaunga') || userTranscript.includes('definitely come')
  )) {
    outcomes.push('site_visit_confirmed');
  }
  if (!isNotInterested && !outcomes.includes('site_visit_confirmed') && (
      userTranscript.includes('site visit') || userTranscript.includes('schedule') ||
      userTranscript.includes('interested') || userTranscript.includes('tell me more') ||
      userTranscript.includes('appointment') || userTranscript.includes('visit kar'))) {
    outcomes.push('interested');
  }
  if (userTranscript.includes('call back') || userTranscript.includes('callback') || userTranscript.includes('later') ||
      userTranscript.includes('busy right now') || userTranscript.includes('abhi nahi') ||
      userTranscript.includes('call me') || userTranscript.includes('baad mein') ||
      userTranscript.includes('din baad') || userTranscript.includes('baad call')) {
    outcomes.push('callback');
    // Extract when they want the callback
    const timing = extractCallbackTiming(userTranscript);
    if (timing) {
      const now = new Date();
      const daysMatch = timing.match(/(\d+)\s*[-–to]+\s*(\d+)\s*(?:days?|din)/i) || timing.match(/(\d+)\s*(?:days?|din)/i);
      let callbackDate = null;
      if (daysMatch) {
        const days = parseInt(daysMatch[daysMatch.length === 3 ? 2 : 1]);
        callbackDate = new Date(now.getTime() + days * 86400000);
      } else if (/tomorrow|kal/i.test(timing)) {
        callbackDate = new Date(now.getTime() + 86400000);
      } else if (/next\s+week|agle\s+hafte/i.test(timing)) {
        callbackDate = new Date(now.getTime() + 7 * 86400000);
      }
      updateCall(callUuid, {
        callbackRequested: timing,
        callbackDate: callbackDate ? callbackDate.toISOString() : null,
      });
    }
  }

  if (outcomes.length === 0) {
    // 3. Duration fallback — require at least 2 substantive user turns for 'callback'.
    // A single-word response (even non-trivial) is not enough to indicate callback intent.
    let outcome = 'no_answer';
    const substantiveTurnCount = userTurns.filter(t => hasSubstantiveUserResponse([t])).length;
    if (substantiveTurnCount >= 2) {
      if (call.duration && call.duration > 30) outcome = 'interested';
      else if (call.duration && call.duration > 10) outcome = 'callback';
    } else if (substantiveTurnCount >= 1 && call.duration && call.duration > 30) {
      outcome = 'interested'; // Long call with some engagement, but not enough turns for callback
    }
    updateCall(callUuid, { outcome });
    return outcome;
  }

  const outcome = outcomes.join(',');
  updateCall(callUuid, { outcome });
  return outcome;
}

function getCall(callUuid) {
  const p = getCallPath(callUuid);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function listCalls() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const calls = files.map(f => {
    const call = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    return {
      callUuid: call.callUuid,
      to: call.to,
      customerName: call.customerName,
      status: call.status,
      startedAt: call.startedAt,
      duration: call.duration,
      hangupCause: call.hangupCause,
      geminiTurns: call.geminiTurns,
      transcriptLines: call.transcript.length,
      hasRecording: !!call.recordingUrl,
      tokens: call.tokens || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      outcome: call.outcome || null,
      lead_temperature: call.lead_temperature || null,
      follow_up_action: call.follow_up_action || null,
      conversation_summary: call.conversation_summary || null,
      classification_confidence: call.classification_confidence || null,
      callbackRequested: call.callbackRequested || null,
      callbackDate: call.callbackDate || null,
    };
  });
  calls.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return calls;
}

function getAllCallUuids() {
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

module.exports = { createCall, updateCall, addTokens, addTranscript, classifyCallOutcome, getCall, listCalls, getAllCallUuids };
