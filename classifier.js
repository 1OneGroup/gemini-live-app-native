// classifier.js — AI classification logic using Google Gemini
// Classifies lead transcripts into INTERESTED / NOT_INTERESTED / FOLLOW_UP_LATER

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Google Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

// Use gemini-2.0-flash — fast, cheap, and accurate for classification tasks
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.1,       // Low temperature = consistent, deterministic classification
    maxOutputTokens: 4096,
    responseMimeType: 'application/json' // Enforces JSON output in Gemini
  }
});

// Valid classification values
const VALID_CLASSIFICATIONS = ['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP_LATER'];

// Valid sub-classification values (only for INTERESTED leads)
const VALID_SUB_CLASSIFICATIONS = ['VISITING', 'NOT_VISITING'];

// Confidence threshold below which a lead is flagged for manual review
const MANUAL_REVIEW_THRESHOLD = 60;

// System prompt for real estate sales call analysis
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

/**
 * Classifies a call transcript using Google Gemini.
 * @param {string} transcript - The call transcript text
 * @returns {Promise<Object>} Classification result: { classification, confidence, reason, keySignals, needsManualReview }
 */
async function classifyTranscript(transcript) {
  const timestamp = new Date().toISOString();

  // Guard: empty or extremely short transcripts cannot be meaningfully classified
  if (!transcript || transcript.trim().length < 20) {
    console.warn(`[${timestamp}] Transcript too short or empty — returning default classification.`);
    return {
      classification: 'NOT_INTERESTED',
      subClassification: null,
      confidence: 0,
      reason: 'No meaningful transcript available for classification.',
      keySignals: [],
      needsManualReview: true
    };
  }

  console.log(`[${timestamp}] Classifying transcript (${transcript.length} chars) with Gemini 1.5 Flash...`);

  try {
    // Send prompt + transcript to Gemini
    const result = await model.generateContent(CLASSIFICATION_PROMPT + transcript);
    const rawContent = result.response.text();

    // Parse the JSON response from Gemini
    let parsed;
    try {
      // Gemini sometimes wraps JSON in markdown code fences — strip them if present
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error(`[${timestamp}] Failed to parse Gemini response as JSON:`, rawContent);
      throw new Error('Gemini returned invalid JSON response');
    }

    // Validate classification is one of the expected values
    const classification = parsed.classification;
    if (!VALID_CLASSIFICATIONS.includes(classification)) {
      console.error(`[${timestamp}] Invalid classification received: ${classification}`);
      throw new Error(`Invalid classification value: ${classification}`);
    }

    // Safely parse confidence — model may return it as a string like "87"
    const confidence = Math.max(0, Math.min(100, parseInt(parsed.confidence, 10) || 0));

    // Ensure key_signals is always an array
    const keySignals = Array.isArray(parsed.key_signals) ? parsed.key_signals : [];

    // Extract and validate sub-classification (only for INTERESTED leads)
    let subClassification = null;
    if (classification === 'INTERESTED' && parsed.sub_classification) {
      subClassification = VALID_SUB_CLASSIFICATIONS.includes(parsed.sub_classification)
        ? parsed.sub_classification
        : null;
    }

    const classificationResult = {
      classification,
      subClassification,
      confidence,
      reason: parsed.reason || 'No reason provided.',
      keySignals,
      needsManualReview: confidence < MANUAL_REVIEW_THRESHOLD
    };

    const subLabel = subClassification ? ` [${subClassification}]` : '';
    console.log(`[${timestamp}] Gemini classification: ${classification}${subLabel} (${confidence}% confidence)${classificationResult.needsManualReview ? ' — FLAGGED FOR REVIEW' : ''}`);

    return classificationResult;

  } catch (err) {
    console.error(`[${timestamp}] Classification failed:`, err.message);
    throw new Error(`Classification failed: ${err.message}`);
  }
}

module.exports = { classifyTranscript };
