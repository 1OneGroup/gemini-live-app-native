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

  const transcript = (call.transcript || []).map(t => (t.text || '').toLowerCase()).join(' ');
  const outcomes = [];

  if (transcript.includes('brochure') && (transcript.includes('whatsapp') || transcript.includes('send'))) {
    outcomes.push('brochure_sent');
  }
  if (transcript.includes('site visit') || transcript.includes('schedule') ||
      transcript.includes('interested') || transcript.includes('tell me more') ||
      transcript.includes('appointment') || transcript.includes('visit kar')) {
    outcomes.push('interested');
  }
  if (transcript.includes('not interested') || transcript.includes('no thank') ||
      transcript.includes('don\'t call') || transcript.includes('remove') || transcript.includes('no need')) {
    outcomes.push('not_interested');
  }
  if (transcript.includes('call back') || transcript.includes('callback') || transcript.includes('later') ||
      transcript.includes('busy right now') || transcript.includes('abhi nahi') ||
      transcript.includes('call me') || transcript.includes('baad mein') ||
      transcript.includes('din baad') || transcript.includes('baad call')) {
    outcomes.push('callback');
    // Extract when they want the callback
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

  if (outcomes.length === 0) {
    // Fallback based on duration
    let outcome = 'no_answer';
    if (call.duration && call.duration > 30) outcome = 'interested';
    else if (call.duration && call.duration > 10) outcome = 'callback';
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
      recordingUrl: call.recordingUrl || null,
      tokens: call.tokens || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      outcome: call.outcome || null,
      confidence: call.confidence || null,
      classificationReason: call.classificationReason || null,
      callbackRequested: call.callbackRequested || null,
      callbackDate: call.callbackDate || null,
    };
  });
  calls.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return calls;
}

async function classifyWithGemini(callUuid, apiKey) {
  const call = getCall(callUuid);
  if (!call) return;

  // Fast-path: non-conversation outcomes don't need AI
  if (call.voicemailDetected) { updateCall(callUuid, { outcome: 'voicemail' }); return; }
  const hangup = (call.hangupCause || '').toLowerCase();
  if (hangup === 'rejected' || hangup === 'busy') { updateCall(callUuid, { outcome: 'busy' }); return; }
  if (hangup === 'noanswer' || hangup === 'no_answer' || hangup === 'originator cancel') { updateCall(callUuid, { outcome: 'no_answer' }); return; }

  // Skip only if already AI-classified with confidence
  if (['interested', 'not_interested', 'needs_review', 'follow_up'].includes(call.outcome) && call.confidence != null) return;

  const transcript = (call.transcript || []);
  console.log(`[Classify] ${callUuid} — transcript lines: ${transcript.length}, hangup: ${call.hangupCause}, outcome: ${call.outcome}`);
  if (transcript.length === 0) { console.log(`[Classify] No transcript, using keyword fallback`); classifyCallOutcome(callUuid); return; }

  const dialogue = transcript.map(t => `${t.role === 'agent' ? 'Agent' : 'Customer'}: ${t.text}`).join('\n');
  console.log(`[Classify] Sending to DeepSeek, dialogue length: ${dialogue.length} chars`);

  const prompt = `You are a sales call analyst. Read this call transcript and classify the lead.

Respond with ONLY valid JSON in this exact format:
{"classification": "interested" | "not_interested" | "needs_review", "confidence": 0-100, "reason": "one sentence"}

Rules for classification:
- "interested": customer showed genuine interest, asked questions, agreed to visit/callback, or gave positive signals
- "not_interested": customer clearly declined, said no, asked to not be called again
- "needs_review": conversation was ambiguous, too short, cut off, or intent is unclear

Rules for confidence (0-100):
- 90-100: very clear and explicit signals in transcript
- 70-89: reasonably clear signals
- 50-69: some signals but mixed or uncertain
- below 50: very unclear, short, or confusing conversation

Transcript:
${dialogue}`;

  try {
    const https = require('https');
    const body = JSON.stringify({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        }
      }, res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
      req.write(body);
      req.end();
    });
    const parsed = JSON.parse(result);
    console.log(`[Classify] OpenRouter raw response:`, result.substring(0, 300));
    const text = parsed?.choices?.[0]?.message?.content || '';
    const json = JSON.parse(text);
    const confidence = Math.min(100, Math.max(0, parseInt(json.confidence) || 50));
    let classification = ['interested', 'not_interested', 'needs_review'].includes(json.classification)
      ? json.classification : 'needs_review';
    // Override based on confidence
    if (confidence < 50) {
      classification = 'needs_review';
    } else if (confidence < 75 && classification !== 'needs_review') {
      classification = 'follow_up';
    }
    updateCall(callUuid, { outcome: classification, classificationReason: json.reason || '', confidence });
    console.log(`[Classify] ${callUuid} → ${classification} (${confidence}%): ${json.reason || ''}`);
  } catch (err) {
    console.warn(`[Classify] DeepSeek failed for ${callUuid}, using keyword fallback:`, err.message);
    classifyCallOutcome(callUuid);
  }
}

module.exports = { createCall, updateCall, addTokens, addTranscript, classifyCallOutcome, classifyWithGemini, getCall, listCalls };
