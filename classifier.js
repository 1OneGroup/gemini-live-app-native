// AI-powered call classification using Gemini 2.5 Flash
const store = require('./call-store');
const fs = require('fs');
const path = require('path');

const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CLASSIFICATION_PROMPT = `You are a real estate telecalling analyst for ONE Group Developers (India).
Analyze this call transcript and return a JSON classification.

CALL METADATA:
- Customer: {customerName}
- Duration: {duration} seconds
- Hangup cause: {hangupCause}
- Voicemail detected: {voicemailDetected}
- Brochure sent during call: {brochureSent}
- Transcript lines: {transcriptLineCount}

TRANSCRIPT:
{transcript}

CLASSIFICATION RULES:
- If no transcript and ring timeout → no_answer
- If AMD/voicemail detected → voicemail
- If call rejected/busy → busy
- If customer confirmed a specific day/time for site visit → site_visit_confirmed (HOT)
- If customer asked questions about the project, pricing, amenities → interested (WARM)
- If customer said call later/busy now → callback_requested (WARM)
- If brochure was sent → add brochure_sent, determine if also interested
- If customer said "not interested"/"nahi chahiye"/declined twice → not_interested (DEAD)
- If customer asked to not be called again → do_not_call (DEAD)
- If wrong person/language barrier/different language → wrong_number (DEAD)
- If call connected but only "hello hello" with no real conversation → network_issue (COLD)
- Duration alone does NOT determine interest — READ the transcript
- Conversations are often in Hindi/Hinglish — understand Hindi words like "haan" (yes), "nahi" (no), "chahiye" (want), "dekhenge" (will see), "aaunga" (will come), "baad mein" (later), "zaroorat nahi" (no need)

Return ONLY this JSON (no markdown, no code blocks):
{
  "outcome": "one of: site_visit_confirmed|interested|callback_requested|brochure_sent|not_interested|wrong_number|voicemail|no_answer|busy|network_issue|do_not_call",
  "lead_temperature": "hot|warm|cold|dead",
  "follow_up_action": "assign_sales_team|send_whatsapp_brochure|send_whatsapp_followup|schedule_callback|retry_call|none",
  "callback_date": "ISO datetime or null",
  "conversation_summary": "1-2 sentence summary of what happened",
  "confidence": 0.0-1.0
}`;

/**
 * Classify a single call using AI
 * @param {object} callData - Call data from call-store
 * @returns {object} Classification result
 */
async function classifyCall(callData) {
  if (!callData) return fallbackClassification(null);

  // Pre-checks for obvious cases (no AI needed)
  const hangup = (callData.hangupCause || '').toLowerCase();

  // Voicemail
  if (callData.voicemailDetected) {
    return {
      outcome: 'voicemail',
      lead_temperature: 'dead',
      follow_up_action: 'none',
      callback_date: null,
      conversation_summary: 'Voicemail/answering machine detected.',
      confidence: 0.99,
    };
  }

  // Busy/Rejected
  if (hangup === 'rejected' || hangup === 'busy' || hangup === 'busy line') {
    return {
      outcome: 'busy',
      lead_temperature: 'cold',
      follow_up_action: 'retry_call',
      callback_date: null,
      conversation_summary: 'Call was busy or rejected by the customer.',
      confidence: 0.99,
    };
  }

  // No answer — ring timeout with no transcript
  const transcript = callData.transcript || [];
  const hasTranscript = transcript.some(t => t.role === 'user' && t.text?.trim());
  if (!hasTranscript && (hangup === 'noanswer' || hangup === 'no_answer' || hangup === 'originator cancel' || hangup === 'no answer')) {
    return {
      outcome: 'no_answer',
      lead_temperature: 'dead',
      follow_up_action: 'retry_call',
      callback_date: null,
      conversation_summary: 'Phone rang but nobody answered.',
      confidence: 0.99,
    };
  }

  // For all other cases, use AI classification
  try {
    return await aiClassify(callData);
  } catch (err) {
    console.error(`[Classifier] AI classification failed for ${callData.callUuid}:`, err.message);
    return fallbackClassification(callData);
  }
}

/**
 * Call Gemini 2.5 Flash for AI classification
 */
async function aiClassify(callData) {
  const transcript = (callData.transcript || [])
    .filter(t => t.role !== 'system' || t.text?.includes('[Site visit confirmed') || t.text?.includes('[Sending'))
    .map(t => `${t.role}: ${t.text}`)
    .join('\n');

  const brochureSent = (callData.transcript || []).some(t =>
    t.role === 'system' && (t.text?.includes('[Sending') || t.text?.includes('WhatsApp'))
  );

  const prompt = CLASSIFICATION_PROMPT
    .replace('{customerName}', callData.customerName || 'Unknown')
    .replace('{duration}', callData.duration || 0)
    .replace('{hangupCause}', callData.hangupCause || 'Unknown')
    .replace('{voicemailDetected}', callData.voicemailDetected ? 'Yes' : 'No')
    .replace('{brochureSent}', brochureSent ? 'Yes' : 'No')
    .replace('{transcriptLineCount}', (callData.transcript || []).length)
    .replace('{transcript}', transcript || '(no transcript available)');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from response — handle markdown code blocks
  let jsonStr = text;
  // Strip markdown code block if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response: ' + text.substring(0, 200));
  }

  const result = JSON.parse(jsonMatch[0]);

  // Validate and normalize
  const validOutcomes = ['site_visit_confirmed', 'interested', 'callback_requested', 'brochure_sent', 'not_interested', 'wrong_number', 'voicemail', 'no_answer', 'busy', 'network_issue', 'do_not_call'];
  const validTemps = ['hot', 'warm', 'cold', 'dead'];
  const validActions = ['assign_sales_team', 'send_whatsapp_brochure', 'send_whatsapp_followup', 'schedule_callback', 'retry_call', 'none'];

  return {
    outcome: validOutcomes.includes(result.outcome) ? result.outcome : 'no_answer',
    lead_temperature: validTemps.includes(result.lead_temperature) ? result.lead_temperature : 'cold',
    follow_up_action: validActions.includes(result.follow_up_action) ? result.follow_up_action : 'none',
    callback_date: result.callback_date || null,
    conversation_summary: result.conversation_summary || '',
    confidence: typeof result.confidence === 'number' ? Math.min(1, Math.max(0, result.confidence)) : 0.5,
  };
}

/**
 * Fallback classification when AI is unavailable
 * Uses improved keyword matching with Hindi/Hinglish support
 */
function fallbackClassification(callData) {
  if (!callData) {
    return {
      outcome: 'no_answer', lead_temperature: 'dead', follow_up_action: 'retry_call',
      callback_date: null, conversation_summary: 'No call data available.', confidence: 0.3,
    };
  }

  const hangup = (callData.hangupCause || '').toLowerCase();
  const transcript = (callData.transcript || []).filter(t => t.role === 'user').map(t => (t.text || '').toLowerCase()).join(' ');
  const fullTranscript = (callData.transcript || []).map(t => (t.text || '').toLowerCase()).join(' ');

  // Not interested signals (Hindi + English)
  if (transcript.match(/nahi chahiye|not interested|no thank|zaroorat nahi|bilkul nahi|don't call|remove my number|no need/)) {
    if (transcript.match(/don't call|remove|mat karo call|band karo/)) {
      return { outcome: 'do_not_call', lead_temperature: 'dead', follow_up_action: 'none', callback_date: null, conversation_summary: 'Customer asked not to be called again.', confidence: 0.6 };
    }
    return { outcome: 'not_interested', lead_temperature: 'dead', follow_up_action: 'none', callback_date: null, conversation_summary: 'Customer expressed no interest.', confidence: 0.6 };
  }

  // Site visit confirmed
  if (fullTranscript.includes('[site visit confirmed') || transcript.match(/confirm|pakka|zaroor|aaunga|aaenge|aa raha|i'll come|i will come|definitely come|bilkul aaunga/)) {
    return { outcome: 'site_visit_confirmed', lead_temperature: 'hot', follow_up_action: 'assign_sales_team', callback_date: null, conversation_summary: 'Customer confirmed a site visit.', confidence: 0.6 };
  }

  // Interested signals
  if (transcript.match(/interested|tell me more|kitna|kya rate|price|location|site visit|dekhna chahte|dekhenge|batao|details/)) {
    return { outcome: 'interested', lead_temperature: 'warm', follow_up_action: 'send_whatsapp_brochure', callback_date: null, conversation_summary: 'Customer showed interest in the project.', confidence: 0.5 };
  }

  // Callback requested
  if (transcript.match(/call back|callback|later|busy right now|abhi nahi|baad mein|din baad|kal|tomorrow|baad call/)) {
    return { outcome: 'callback_requested', lead_temperature: 'warm', follow_up_action: 'schedule_callback', callback_date: null, conversation_summary: 'Customer requested a callback.', confidence: 0.5 };
  }

  // Brochure sent
  if (fullTranscript.includes('[sending') || transcript.match(/brochure|whatsapp pe bhej|send me/)) {
    return { outcome: 'brochure_sent', lead_temperature: 'warm', follow_up_action: 'send_whatsapp_followup', callback_date: null, conversation_summary: 'Brochure was sent to the customer.', confidence: 0.6 };
  }

  // Wrong number / language barrier
  if (transcript.match(/wrong number|galat number|kisi aur ka|i don't speak|language/)) {
    return { outcome: 'wrong_number', lead_temperature: 'dead', follow_up_action: 'none', callback_date: null, conversation_summary: 'Wrong number or language barrier.', confidence: 0.5 };
  }

  // Network issue — connected but no real conversation
  if (callData.duration > 5 && (!transcript || transcript.trim().length < 20)) {
    return { outcome: 'network_issue', lead_temperature: 'cold', follow_up_action: 'retry_call', callback_date: null, conversation_summary: 'Call connected but no real conversation occurred.', confidence: 0.5 };
  }

  // Duration-based fallback
  if (callData.duration > 30 && transcript.length > 30) {
    return { outcome: 'interested', lead_temperature: 'warm', follow_up_action: 'send_whatsapp_brochure', callback_date: null, conversation_summary: 'Extended conversation indicating potential interest.', confidence: 0.4 };
  }

  return { outcome: 'no_answer', lead_temperature: 'dead', follow_up_action: 'retry_call', callback_date: null, conversation_summary: 'Unable to determine outcome.', confidence: 0.3 };
}

/**
 * Re-classify a single call by UUID
 */
async function reclassifySingle(callUuid) {
  const callData = store.getCall(callUuid);
  if (!callData) return { error: 'Call not found' };

  const result = await classifyCall(callData);

  // Update the call JSON file with new classification
  store.updateCall(callUuid, {
    outcome: result.outcome,
    lead_temperature: result.lead_temperature,
    follow_up_action: result.follow_up_action,
    conversation_summary: result.conversation_summary,
    classification_confidence: result.confidence,
    callback_date: result.callback_date,
  });

  return { callUuid, ...result };
}

/**
 * Re-classify all calls (or a campaign's calls)
 */
async function reclassifyAll(campaignId) {
  const DATA_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'calls') : '/data/calls';
  let callUuids;

  if (campaignId) {
    // Get call UUIDs from campaign contacts
    const db = require('./db');
    const contacts = db.getContacts(campaignId, { limit: 10000 });
    callUuids = contacts.filter(c => c.call_uuid).map(c => c.call_uuid);
  } else {
    // Get all call UUIDs from data directory
    try {
      callUuids = fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch {
      return { error: 'Cannot read call data directory', total: 0, processed: 0, results: [] };
    }
  }

  const results = { total: callUuids.length, processed: 0, skipped: 0, errors: 0, classifications: {} };

  for (const callUuid of callUuids) {
    try {
      const callData = store.getCall(callUuid);
      if (!callData) { results.skipped++; continue; }

      const hangup = (callData.hangupCause || '').toLowerCase();
      const hasTranscript = (callData.transcript || []).some(t => t.role === 'user' && t.text?.trim());

      // Skip genuinely obvious cases (but still re-classify if they might be wrong)
      // Only skip calls that are mechanically no_answer (ring timeout, no transcript at all)
      if (!hasTranscript && (hangup === 'noanswer' || hangup === 'no_answer' || hangup === 'originator cancel') && (!callData.transcript || callData.transcript.length === 0)) {
        results.skipped++;
        continue;
      }

      const classification = await classifyCall(callData);

      // Update call file
      store.updateCall(callUuid, {
        outcome: classification.outcome,
        lead_temperature: classification.lead_temperature,
        follow_up_action: classification.follow_up_action,
        conversation_summary: classification.conversation_summary,
        classification_confidence: classification.confidence,
        callback_date: classification.callback_date,
      });

      // Update DB contact if exists
      try {
        const db = require('./db');
        const contacts = db.db.prepare('SELECT id FROM contacts WHERE call_uuid = ?').all(callUuid);
        for (const contact of contacts) {
          db.updateContactClassification(contact.id, classification);
        }
      } catch {}

      // Track outcome distribution
      results.classifications[classification.outcome] = (results.classifications[classification.outcome] || 0) + 1;
      results.processed++;

      // Small delay to avoid rate limiting
      if (results.processed % 10 === 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`[Classifier] Error re-classifying ${callUuid}:`, err.message);
      results.errors++;
    }
  }

  console.log(`[Classifier] Re-classification complete: ${results.processed} processed, ${results.skipped} skipped, ${results.errors} errors`);
  console.log(`[Classifier] Distribution:`, JSON.stringify(results.classifications));
  return results;
}

module.exports = { classifyCall, reclassifySingle, reclassifyAll, fallbackClassification };
