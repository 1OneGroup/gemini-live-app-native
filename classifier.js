// classifier.js — AI classification using Groq (llama-3.3-70b)
require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const VALID_CLASSIFICATIONS = ['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP_LATER'];
const VALID_SUB_CLASSIFICATIONS = ['VISITING', 'NOT_VISITING'];
const MANUAL_REVIEW_THRESHOLD = 60;

const CLASSIFICATION_PROMPT = `You are an expert real estate sales call analyzer.
Your job is to read a call transcript between a sales agent and a potential property buyer lead,
and classify the lead's interest level based on what they said.

Classify into EXACTLY one of these three categories:

INTERESTED — The lead showed genuine interest. Signs include:
- Asked questions about price, location, amenities, possession date
- Agreed to a site visit or callback
- Said positive things like "yes", "tell me more", "sounds good", "I'm looking"
- Budget matches or they are flexible

When the classification is INTERESTED, you must also determine a sub_classification:

VISITING — The lead has agreed to or is likely to visit the property site. Signs include:
- Explicitly agreed to a site visit ("I'll come", "book a visit", "when can I see it")
- Hindi/Hinglish visit phrases: "dekhne aaunga", "aake dekhte hain", "site visit", "visit fix", "haan aa jayenge", "aana chahte hain", "dikha do", "property dekhni hai", "site pe aayenge", "kal aate hain", "weekend pe aa jayenge"
- Asked about site visit timing, directions, location, or availability
- Confirmed a date/time/day for visiting
- Said they want to see the property in person
- Agreed when agent proposed a visit or site tour

NOT_VISITING — The lead is interested but has NOT committed to visiting. Signs include:
- Asked questions about price/amenities but did not mention visiting
- Wants information sent via WhatsApp/email/message only ("details bhej do", "WhatsApp karo", "brochure bhejo")
- Interested in concept but did not discuss coming to the site
- Said "send me details" or "send brochure" without agreeing to visit
- Showed interest but avoided, deflected, or declined the site visit question
- Only asked for pricing or location info remotely

NOT_INTERESTED — The lead clearly does not want to proceed. Signs include:
- Already bought property elsewhere
- Explicitly said no, not interested, remove from list
- Hung up or was very rude
- Budget is completely mismatched and they are firm

FOLLOW_UP_LATER — The lead is not ready now but may be in future. Signs include:
- Said call me after X months
- Currently busy, travelling, or in a different city
- Interested but waiting for salary/loan approval
- Said maybe, not sure, thinking about it

Note: Transcripts may be in Hindi (Devanagari), English, or Hinglish (mixed Hindi-English Roman script). Analyze all three accurately.

Respond with ONLY a valid JSON object in this exact format:
{
  "classification": "INTERESTED" or "NOT_INTERESTED" or "FOLLOW_UP_LATER",
  "sub_classification": "VISITING" or "NOT_VISITING" or null,
  "confidence": a number from 0 to 100,
  "reason": "one sentence explaining why",
  "key_signals": ["signal 1", "signal 2"]
}
IMPORTANT: "sub_classification" must be "VISITING" or "NOT_VISITING" when classification is "INTERESTED". Set it to null for NOT_INTERESTED and FOLLOW_UP_LATER.
Do not write anything else. Only the JSON.

Transcript to analyze:
`;

async function classifyTranscript(transcript) {
  const timestamp = new Date().toISOString();

  if (!transcript || transcript.trim().length < 20) {
    console.warn(`[${timestamp}] Transcript too short — returning default classification.`);
    return {
      classification: 'NOT_INTERESTED',
      subClassification: null,
      confidence: 0,
      reason: 'No meaningful transcript available for classification.',
      keySignals: [],
      needsManualReview: true
    };
  }

  console.log(`[${timestamp}] Classifying transcript (${transcript.length} chars) with Groq llama-3.3-70b...`);

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'user', content: CLASSIFICATION_PROMPT + transcript }
      ]
    });

    const rawContent = response.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error(`[${timestamp}] Failed to parse response as JSON:`, rawContent);
      throw new Error('Groq returned invalid JSON response');
    }

    const classification = parsed.classification;
    if (!VALID_CLASSIFICATIONS.includes(classification)) {
      throw new Error(`Invalid classification value: ${classification}`);
    }

    const confidence = Math.max(0, Math.min(100, parseInt(parsed.confidence, 10) || 0));
    const keySignals = Array.isArray(parsed.key_signals) ? parsed.key_signals : [];

    let subClassification = null;
    if (classification === 'INTERESTED' && parsed.sub_classification) {
      subClassification = VALID_SUB_CLASSIFICATIONS.includes(parsed.sub_classification)
        ? parsed.sub_classification
        : null;
    }

    const result = {
      classification,
      subClassification,
      confidence,
      reason: parsed.reason || 'No reason provided.',
      keySignals,
      needsManualReview: confidence < MANUAL_REVIEW_THRESHOLD
    };

    const subLabel = subClassification ? ` [${subClassification}]` : '';
    console.log(`[${timestamp}] Classification: ${classification}${subLabel} (${confidence}%)${result.needsManualReview ? ' — FLAGGED FOR REVIEW' : ''}`);

    return result;

  } catch (err) {
    console.error(`[${timestamp}] Classification failed:`, err.message);
    throw new Error(`Classification failed: ${err.message}`);
  }
}

module.exports = { classifyTranscript };
