// transcriber.js — Audio transcription using Google Gemini
// Downloads audio from Plivo and converts to text using Gemini 2.5 Flash

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Gemini inline data limit: 20MB
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * Transcribes audio from a Plivo recording URL using Google Gemini.
 * Supports Hindi, English, and Hinglish automatically.
 * @param {Object} lead - The lead object containing recordingUrl
 * @returns {Promise<string|null>} The transcript text, or null on failure
 */
async function transcribeAudio(lead) {
  const timestamp = new Date().toISOString();
  const leadId = lead.id || lead.plivoCallUuid || 'unknown';

  console.log(`[${timestamp}] Starting transcription for lead ${leadId} (${lead.phone || ''})`);

  try {
    const authId = process.env.PLIVO_AUTH_ID;
    const authToken = process.env.PLIVO_AUTH_TOKEN;
    const credentials = Buffer.from(`${authId}:${authToken}`).toString('base64');

    console.log(`[${timestamp}] Downloading audio from Plivo for lead ${leadId}...`);

    const audioResponse = await axios.get(lead.recordingUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Basic ${credentials}` },
      timeout: 60000
    });

    const audioBuffer = Buffer.from(audioResponse.data);
    const fileSizeBytes = audioBuffer.byteLength;

    console.log(`[${timestamp}] Downloaded ${(fileSizeBytes / 1024).toFixed(1)} KB for lead ${leadId}`);

    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      console.warn(`[${timestamp}] Audio file too large (${(fileSizeBytes / 1024 / 1024).toFixed(1)}MB). Skipping.`);
      return null;
    }

    const audioBase64 = audioBuffer.toString('base64');

    console.log(`[${timestamp}] Sending audio to Gemini for transcription...`);

    const result = await model.generateContent([
      { inlineData: { mimeType: 'audio/mp3', data: audioBase64 } },
      'Transcribe this call recording exactly. The conversation is in Hindi, English, or Hinglish (mixed Hindi-English). Write each speaker turn on a new line as "Agent: ..." or "Lead: ...". Output only the transcript, nothing else.'
    ]);

    const transcript = result.response.text().trim();

    console.log(`[${timestamp}] Transcription complete for lead ${leadId}. Length: ${transcript.length} chars`);

    return transcript || null;

  } catch (err) {
    console.error(`[${timestamp}] Transcription failed for lead ${leadId}:`, err.message);
    return null;
  }
}

module.exports = { transcribeAudio };
