// transcriber.js — Audio transcription using Groq Whisper
require('dotenv').config();
const Groq = require('groq-sdk');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

async function transcribeAudio(lead) {
  const timestamp = new Date().toISOString();
  const leadId = lead.id || lead.plivoCallUuid || 'unknown';
  let tmpFile = null;

  console.log(`[${timestamp}] Starting transcription for lead ${leadId} (${lead.phone || ''})`);

  try {
    const credentials = Buffer.from(`${process.env.PLIVO_AUTH_ID}:${process.env.PLIVO_AUTH_TOKEN}`).toString('base64');

    console.log(`[${timestamp}] Downloading audio from Plivo for lead ${leadId}...`);

    const audioResponse = await axios.get(lead.recordingUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Basic ${credentials}` },
      timeout: 60000
    });

    const audioBuffer = Buffer.from(audioResponse.data);
    console.log(`[${timestamp}] Downloaded ${(audioBuffer.byteLength / 1024).toFixed(1)} KB for lead ${leadId}`);

    if (audioBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      console.warn(`[${timestamp}] Audio file too large. Skipping.`);
      return null;
    }

    tmpFile = path.join(os.tmpdir(), `lead-${leadId}.mp3`);
    fs.writeFileSync(tmpFile, audioBuffer);

    console.log(`[${timestamp}] Sending audio to Groq Whisper for transcription...`);

    const response = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: 'whisper-large-v3',
      language: 'hi',
      response_format: 'text'
    });

    const transcript = (typeof response === 'string' ? response : response.text || '').trim();
    console.log(`[${timestamp}] Transcription complete for lead ${leadId}. Length: ${transcript.length} chars`);

    return transcript || null;

  } catch (err) {
    console.error(`[${timestamp}] Transcription failed for lead ${leadId}:`, err.message);
    return null;
  } finally {
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

module.exports = { transcribeAudio };
