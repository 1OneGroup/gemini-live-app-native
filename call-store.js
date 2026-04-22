const fs = require('fs');
const path = require('path');
const { classifyOutcome: _classifyOutcome } = require('./src/lib/outcome-classifier');

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
    outcome: null, // interested|not_interested|callback|no_answer|busy|brochure_sent
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

// Classify call outcome from transcript — supports multiple outcomes
function classifyCallOutcome(callUuid) {
  const call = getCall(callUuid);
  if (!call || call.outcome) return call?.outcome; // already classified

  // Check if AMD already flagged this as voicemail
  if (call.voicemailDetected) {
    updateCall(callUuid, { outcome: 'voicemail' });
    return 'voicemail';
  }

  const hangup = (call.hangupCause || '').toLowerCase();
  if (hangup === 'rejected' || hangup === 'busy') {
    updateCall(callUuid, { outcome: 'busy' });
    return 'busy';
  }
  if (hangup === 'noanswer' || hangup === 'no_answer' || hangup === 'originator cancel') {
    updateCall(callUuid, { outcome: 'no_answer' });
    return 'no_answer';
  }

  // Delegate transcript + duration classification to shared module (multi-outcome mode)
  const transcript = (call.transcript || []).map(t => (t.text || '').toLowerCase()).join(' ');
  const outcome = _classifyOutcome(call.transcript || [], call.duration || 0, { multiOutcome: true });

  // Extract callback timing if this call has a callback outcome
  if (outcome.includes('callback')) {
    const timing = extractCallbackTiming(transcript);
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
      callbackRequested: call.callbackRequested || null,
      callbackDate: call.callbackDate || null,
    };
  });
  calls.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return calls;
}

module.exports = { createCall, updateCall, addTokens, addTranscript, classifyCallOutcome, getCall, listCalls };
