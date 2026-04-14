// server.js — Main Express backend for Gemini Live Lead Classifier
// Serves the dashboard and provides all API endpoints

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const { fetchNewCalls } = require('./plivo');
const { transcribeAudio } = require('./transcriber');
const { classifyTranscript } = require('./classifier');

const app = express();
const PORT = process.env.PORT || 3000;
const LEADS_FILE = path.join(__dirname, 'leads.json');

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Guard: prevent concurrent process-all runs ───────────────────────────────

let isProcessing = false;

// ─── File I/O Helpers ─────────────────────────────────────────────────────────

/**
 * Reads all leads from the local JSON database.
 * Synchronous I/O is intentional — single-user local tool avoids async race conditions.
 * @returns {Array} Array of lead objects
 */
function readLeads() {
  try {
    const raw = fs.readFileSync(LEADS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Writes all leads to the local JSON database.
 * @param {Array} leads - Array of lead objects to persist
 */
function writeLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

/**
 * Logs a timestamped message to console.
 * @param {string} message
 */
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// ─── API Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/webhook/lead
 * Receives a new lead from the external Gemini Live platform via webhook.
 *
 * Expected JSON body:
 * {
 *   "phone": "+91XXXXXXXXXX",          (required)
 *   "recordingUrl": "https://...",     (required — audio file URL)
 *   "callDate": "ISO8601 string",      (optional — defaults to now)
 *   "callDuration": 120,               (optional — seconds)
 *   "direction": "inbound|outbound"    (optional)
 * }
 *
 * Optional header for security: x-webhook-secret must match WEBHOOK_SECRET in .env
 * Returns the created lead object.
 */
app.post('/api/webhook/lead', async (req, res) => {
  // Optional secret-based authentication
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && secret !== 'your_optional_webhook_secret') {
    const provided = req.headers['x-webhook-secret'];
    if (provided !== secret) {
      log('Webhook rejected: invalid secret');
      return res.status(401).json({ error: 'Invalid webhook secret.' });
    }
  }

  const { phone, customerName, recordingUrl, transcript: incomingTranscript, callDate, callDuration, direction } = req.body;

  // Validate required fields — phone is always required; either transcript or recordingUrl must be present
  if (!phone) {
    return res.status(400).json({ error: 'Missing required field: phone.' });
  }
  if (!incomingTranscript && !recordingUrl) {
    return res.status(400).json({ error: 'Missing required field: provide either transcript or recordingUrl.' });
  }

  try {
    const leads = readLeads();

    // Deduplicate by recordingUrl when provided — don't import the same call twice
    if (recordingUrl) {
      const alreadyExists = leads.some(l => l.recordingUrl === recordingUrl);
      if (alreadyExists) {
        log(`Webhook: duplicate recordingUrl received for ${phone}, skipping.`);
        return res.status(409).json({ error: 'Lead with this recordingUrl already exists.' });
      }
    }

    // If transcript is provided by Gemini Live, save it immediately and mark as transcribed
    // so the auto-processing step can skip Whisper and go straight to classification
    const hasTranscript = !!(incomingTranscript && incomingTranscript.trim().length > 0);

    const newLead = {
      id: uuidv4(),
      phone,
      customerName: customerName || null,
      callDate: callDate || new Date().toISOString(),
      callDuration: callDuration ? parseInt(callDuration, 10) : null,
      recordingUrl: recordingUrl || null,
      direction: direction || 'inbound',
      transcript: hasTranscript ? incomingTranscript.trim() : null,
      classification: null,
      subClassification: null,
      confidence: null,
      reason: null,
      keySignals: [],
      // If transcript already provided → skip Whisper, jump straight to classification
      status: hasTranscript ? 'transcribed' : 'fetched',
      needsManualReview: false,
      manuallyOverridden: false,
      source: 'gemini-live-webhook',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    leads.unshift(newLead); // Add at top (newest first)
    writeLeads(leads);

    log(`Webhook: New lead received — ${phone} (ID: ${newLead.id}, transcript: ${hasTranscript ? 'YES' : 'NO'})`);

    // Respond immediately so the caller isn't blocked
    res.status(201).json({ success: true, lead: newLead });

    // Auto-process in the background after responding
    setImmediate(async () => {
      try {
        log(`Auto-processing webhook lead ${newLead.id}...`);

        let transcript = newLead.transcript;

        // Step 1: Transcribe with Whisper ONLY if transcript was not provided by Gemini Live
        if (!transcript) {
          if (!newLead.recordingUrl) {
            log(`Auto-process: No transcript and no recordingUrl for ${newLead.id}, skipping.`);
            return;
          }

          log(`Auto-process: No transcript provided — running Whisper for ${newLead.id}...`);
          const { transcribeAudio } = require('./transcriber');
          transcript = await transcribeAudio(newLead);

          const leads1 = readLeads();
          const idx1 = leads1.findIndex(l => l.id === newLead.id);
          if (idx1 !== -1) {
            leads1[idx1].transcript = transcript || null;
            leads1[idx1].status = transcript ? 'transcribed' : 'transcription_failed';
            leads1[idx1].updatedAt = new Date().toISOString();
            writeLeads(leads1);
          }

          if (!transcript) {
            log(`Auto-process: Transcription failed for ${newLead.id}`);
            return;
          }
        } else {
          log(`Auto-process: Transcript already present (from Gemini Live) — skipping Whisper for ${newLead.id}`);
        }

        // Step 2: Classify with Gemini
        const { classifyTranscript } = require('./classifier');
        const result = await classifyTranscript(transcript);

        const leads2 = readLeads();
        const idx2 = leads2.findIndex(l => l.id === newLead.id);
        if (idx2 !== -1) {
          leads2[idx2].classification = result.classification;
          leads2[idx2].subClassification = result.subClassification;
          leads2[idx2].confidence = result.confidence;
          leads2[idx2].reason = result.reason;
          leads2[idx2].keySignals = result.keySignals;
          leads2[idx2].needsManualReview = result.needsManualReview;
          leads2[idx2].status = 'classified';
          leads2[idx2].updatedAt = new Date().toISOString();
          writeLeads(leads2);
          log(`Auto-process complete for ${newLead.id}: ${result.classification}${result.subClassification ? ' [' + result.subClassification + ']' : ''} (${result.confidence}%)`);
        }
      } catch (autoErr) {
        log(`Auto-process error for ${newLead.id}: ${autoErr.message}`);
      }
    });

  } catch (err) {
    log(`Webhook error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/webhook-info
 * Returns the webhook URL and expected payload format for easy configuration.
 */
app.get('/api/webhook-info', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    webhookUrl: `${baseUrl}/api/webhook/lead`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': '(value of WEBHOOK_SECRET in .env — optional)'
    },
    payload: {
      phone: '+91XXXXXXXXXX (required)',
      transcript: 'Full conversation text from Gemini Live (recommended — skips Whisper)',
      recordingUrl: 'https://your-audio-url.mp3 (optional — used for Whisper if no transcript)',
      callDate: '2026-04-10T10:30:00 (optional)',
      callDuration: '180 (seconds, optional)',
      direction: 'inbound or outbound (optional)'
    },
    note: 'Provide transcript for instant classification (no Whisper needed). Provide recordingUrl as fallback if transcript is unavailable.'
  });
});

/**
 * GET /api/leads
 * Returns all leads from leads.json, sorted newest first.
 */
app.get('/api/leads', (req, res) => {
  try {
    const leads = readLeads();
    // Sort by createdAt descending (newest first)
    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(leads);
  } catch (err) {
    log(`GET /api/leads error: ${err.message}`);
    res.status(500).json({ error: 'Failed to read leads.' });
  }
});

/**
 * POST /api/fetch-calls
 * Fetches latest call recordings from Plivo and saves new ones to leads.json.
 * Deduplicates by recordingUrl to avoid duplicates.
 */
app.get('/api/leads/:leadId/recording', async (req, res) => {
  try {
    const leads = readLeads();
    const lead = leads.find(l => l.id === req.params.leadId);
    if (!lead || !lead.recordingUrl) {
      return res.status(404).json({ error: 'No recording' });
    }

    const authId = process.env.PLIVO_AUTH_ID;
    const authToken = process.env.PLIVO_AUTH_TOKEN;
    const credentials = Buffer.from(`${authId}:${authToken}`).toString('base64');

    const upstream = await axios.get(lead.recordingUrl, {
      headers: { Authorization: `Basic ${credentials}` },
      responseType: 'stream',
    });

    res.setHeader('Content-Type', upstream.headers['content-type'] || 'audio/mpeg');
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }
    res.setHeader('Accept-Ranges', 'bytes');
    upstream.data.pipe(res);
  } catch (err) {
    log(`GET /api/leads/${req.params.leadId}/recording error: ${err.message}`);
    res.status(502).json({ error: 'Failed to fetch recording', detail: err.message });
  }
});

app.post('/api/fetch-calls', async (req, res) => {
  try {
    log('Fetching new calls from Plivo...');
    const newCalls = await fetchNewCalls();
    const leads = readLeads();

    // Build a set of existing recording URLs for deduplication
    const existingUrls = new Set(leads.map(l => l.recordingUrl).filter(Boolean));

    // Filter out calls we already have, then map to lead objects
    const deduplicated = newCalls
      .filter(call => !existingUrls.has(call.recordingUrl))
      .map(call => ({
        id: uuidv4(),
        phone: call.phone,
        callDate: call.callDate,
        callDuration: call.callDuration,
        recordingUrl: call.recordingUrl,
        direction: call.direction,
        plivoCallUuid: call.plivoCallUuid,
        transcript: null,
        classification: null,
        subClassification: null,
        confidence: null,
        reason: null,
        keySignals: [],
        status: 'fetched',
        needsManualReview: false,
        manuallyOverridden: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

    const updated = [...leads, ...deduplicated];
    writeLeads(updated);

    log(`Fetch complete. Added ${deduplicated.length} new lead(s). Total: ${updated.length}`);
    res.json({
      added: deduplicated.length,
      total: updated.length,
      message: `Added ${deduplicated.length} new call(s).`
    });

  } catch (err) {
    log(`POST /api/fetch-calls error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/transcribe/:leadId
 * Transcribes audio for a specific lead using OpenAI Whisper.
 */
app.post('/api/transcribe/:leadId', async (req, res) => {
  try {
    const leads = readLeads();
    const idx = leads.findIndex(l => l.id === req.params.leadId);

    if (idx === -1) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    if (!leads[idx].recordingUrl) {
      return res.status(400).json({ error: 'Lead has no recording URL.' });
    }

    log(`Transcribing lead ${req.params.leadId} (${leads[idx].phone})...`);

    const transcript = await transcribeAudio(leads[idx]);

    // Update lead record based on transcription result
    leads[idx].transcript = transcript || null;
    leads[idx].status = transcript ? 'transcribed' : 'transcription_failed';
    leads[idx].updatedAt = new Date().toISOString();

    writeLeads(leads);

    if (!transcript) {
      return res.status(500).json({
        error: 'Transcription failed. See server logs for details.',
        lead: leads[idx]
      });
    }

    log(`Transcription complete for lead ${req.params.leadId}`);
    res.json(leads[idx]);

  } catch (err) {
    log(`POST /api/transcribe error: ${err.message}`);
    // Try to mark the lead as failed even if an unexpected error occurred
    try {
      const leads = readLeads();
      const idx = leads.findIndex(l => l.id === req.params.leadId);
      if (idx !== -1) {
        leads[idx].status = 'transcription_failed';
        leads[idx].updatedAt = new Date().toISOString();
        writeLeads(leads);
      }
    } catch { /* best effort */ }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/classify/:leadId
 * Classifies transcript for a specific lead using GPT-4o-mini.
 */
app.post('/api/classify/:leadId', async (req, res) => {
  try {
    const leads = readLeads();
    const idx = leads.findIndex(l => l.id === req.params.leadId);

    if (idx === -1) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    if (!leads[idx].transcript) {
      return res.status(400).json({ error: 'Lead has no transcript. Transcribe it first.' });
    }

    log(`Classifying lead ${req.params.leadId} (${leads[idx].phone})...`);

    const result = await classifyTranscript(leads[idx].transcript);

    // Merge classification result into lead record
    leads[idx].classification = result.classification;
    leads[idx].subClassification = result.subClassification;
    leads[idx].confidence = result.confidence;
    leads[idx].reason = result.reason;
    leads[idx].keySignals = result.keySignals;
    leads[idx].needsManualReview = result.needsManualReview;
    leads[idx].status = 'classified';
    leads[idx].updatedAt = new Date().toISOString();

    writeLeads(leads);

    log(`Classification complete for lead ${req.params.leadId}: ${result.classification}${result.subClassification ? ' [' + result.subClassification + ']' : ''} (${result.confidence}%)`);
    res.json(leads[idx]);

  } catch (err) {
    log(`POST /api/classify error: ${err.message}`);
    // Mark the lead as classification failed
    try {
      const leads = readLeads();
      const idx = leads.findIndex(l => l.id === req.params.leadId);
      if (idx !== -1) {
        leads[idx].status = 'classification_failed';
        leads[idx].updatedAt = new Date().toISOString();
        writeLeads(leads);
      }
    } catch { /* best effort */ }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/reclassify-interested
 * Re-classifies all INTERESTED leads that don't yet have a subClassification.
 * Streams progress via SSE. Skips manually overridden leads.
 */
app.post('/api/reclassify-interested', async (req, res) => {
  if (isProcessing) {
    return res.status(409).json({ error: 'Processing is already in progress.' });
  }

  isProcessing = true;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const toReclassify = readLeads().filter(
      l => l.classification === 'INTERESTED' && !l.subClassification && l.transcript && !l.manuallyOverridden
    );

    sendEvent({ step: 'reclassify_start', message: `Re-classifying ${toReclassify.length} interested lead(s)...`, total: toReclassify.length });
    log(`Reclassify Interested: ${toReclassify.length} lead(s) to process.`);

    let done = 0;
    let failed = 0;

    for (const lead of toReclassify) {
      sendEvent({ step: 'reclassifying', phone: lead.phone, current: done + failed + 1, total: toReclassify.length });

      try {
        const result = await classifyTranscript(lead.transcript);
        const leads = readLeads();
        const idx = leads.findIndex(l => l.id === lead.id);
        if (idx !== -1) {
          leads[idx].classification = result.classification;
          leads[idx].subClassification = result.subClassification;
          leads[idx].confidence = result.confidence;
          leads[idx].reason = result.reason;
          leads[idx].keySignals = result.keySignals;
          leads[idx].needsManualReview = result.needsManualReview;
          leads[idx].updatedAt = new Date().toISOString();
          writeLeads(leads);
        }
        done++;
        sendEvent({ step: 'reclassified', phone: lead.phone, classification: result.classification, subClassification: result.subClassification, confidence: result.confidence });
      } catch (err) {
        failed++;
        log(`Reclassify error for ${lead.id}: ${err.message}`);
        sendEvent({ step: 'reclassify_failed', phone: lead.phone, error: err.message });
      }
    }

    sendEvent({ step: 'done', message: 'Re-classification complete.', reclassified: done, failed });
    log(`Reclassify Interested complete. Done: ${done}, Failed: ${failed}`);

  } catch (err) {
    log(`Reclassify Interested error: ${err.message}`);
    sendEvent({ step: 'error', message: err.message });
  } finally {
    isProcessing = false;
    res.end();
  }
});

/**
 * POST /api/process-all
 * Runs the full pipeline: fetch → transcribe → classify for all unprocessed leads.
 * Streams progress using Server-Sent Events (SSE) so the UI can show real-time updates.
 */
app.post('/api/process-all', async (req, res) => {
  // Prevent concurrent runs
  if (isProcessing) {
    return res.status(409).json({ error: 'Processing is already in progress.' });
  }

  isProcessing = true;

  // Set up Server-Sent Events headers for real-time streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Helper to send SSE progress events to the client
  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // ── Step 1: Fetch new calls from Plivo ──────────────────────────────────
    sendEvent({ step: 'fetch', message: 'Fetching calls from Plivo...' });
    log('Process All: Fetching calls from Plivo...');

    let newCallsAdded = 0;
    try {
      const newCalls = await fetchNewCalls();
      const leads = readLeads();
      const existingUrls = new Set(leads.map(l => l.recordingUrl).filter(Boolean));

      const deduplicated = newCalls
        .filter(call => !existingUrls.has(call.recordingUrl))
        .map(call => ({
          id: uuidv4(),
          phone: call.phone,
          callDate: call.callDate,
          callDuration: call.callDuration,
          recordingUrl: call.recordingUrl,
          direction: call.direction,
          plivoCallUuid: call.plivoCallUuid,
          transcript: null,
          classification: null,
          subClassification: null,
          confidence: null,
          reason: null,
          keySignals: [],
          status: 'fetched',
          needsManualReview: false,
          manuallyOverridden: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

      const updated = [...leads, ...deduplicated];
      writeLeads(updated);
      newCallsAdded = deduplicated.length;

      sendEvent({ step: 'fetch', message: `Fetched ${newCallsAdded} new call(s).`, count: newCallsAdded });
      log(`Process All: Fetched ${newCallsAdded} new call(s).`);

    } catch (fetchErr) {
      log(`Process All: Plivo fetch failed — ${fetchErr.message}`);
      sendEvent({ step: 'fetch_error', message: `Plivo fetch failed: ${fetchErr.message}. Continuing with existing leads.` });
    }

    // ── Step 2: Transcribe all leads that haven't been transcribed yet ───────
    const leadsToTranscribe = readLeads().filter(
      l => !l.transcript && l.recordingUrl && l.status !== 'transcription_failed'
    );

    sendEvent({
      step: 'transcribe_start',
      message: `Transcribing ${leadsToTranscribe.length} lead(s)...`,
      total: leadsToTranscribe.length
    });
    log(`Process All: Transcribing ${leadsToTranscribe.length} lead(s)...`);

    let transcribed = 0;
    let transcribeFailed = 0;

    for (const lead of leadsToTranscribe) {
      sendEvent({
        step: 'transcribing',
        message: `Transcribing ${lead.phone}...`,
        leadId: lead.id,
        current: transcribed + transcribeFailed + 1,
        total: leadsToTranscribe.length
      });

      try {
        const transcript = await transcribeAudio(lead);
        const leads = readLeads();
        const idx = leads.findIndex(l => l.id === lead.id);
        if (idx !== -1) {
          leads[idx].transcript = transcript || null;
          leads[idx].status = transcript ? 'transcribed' : 'transcription_failed';
          leads[idx].updatedAt = new Date().toISOString();
          writeLeads(leads);
        }

        if (transcript) {
          transcribed++;
          sendEvent({ step: 'transcribed', leadId: lead.id, phone: lead.phone });
        } else {
          transcribeFailed++;
          sendEvent({ step: 'transcribe_failed', leadId: lead.id, phone: lead.phone });
        }
      } catch (err) {
        transcribeFailed++;
        log(`Process All: Transcription error for ${lead.id}: ${err.message}`);
        sendEvent({ step: 'transcribe_failed', leadId: lead.id, phone: lead.phone, error: err.message });
      }
    }

    // ── Step 3: Classify all leads that have transcripts but no classification ─
    const leadsToClassify = readLeads().filter(
      l => l.transcript && !l.classification && l.status !== 'classification_failed'
    );

    sendEvent({
      step: 'classify_start',
      message: `Classifying ${leadsToClassify.length} lead(s)...`,
      total: leadsToClassify.length
    });
    log(`Process All: Classifying ${leadsToClassify.length} lead(s)...`);

    let classified = 0;
    let classifyFailed = 0;

    for (const lead of leadsToClassify) {
      sendEvent({
        step: 'classifying',
        message: `Classifying ${lead.phone}...`,
        leadId: lead.id,
        current: classified + classifyFailed + 1,
        total: leadsToClassify.length
      });

      try {
        const result = await classifyTranscript(lead.transcript);
        const leads = readLeads();
        const idx = leads.findIndex(l => l.id === lead.id);
        if (idx !== -1) {
          leads[idx].classification = result.classification;
          leads[idx].subClassification = result.subClassification;
          leads[idx].confidence = result.confidence;
          leads[idx].reason = result.reason;
          leads[idx].keySignals = result.keySignals;
          leads[idx].needsManualReview = result.needsManualReview;
          leads[idx].status = 'classified';
          leads[idx].updatedAt = new Date().toISOString();
          writeLeads(leads);
        }
        classified++;
        sendEvent({
          step: 'classified',
          leadId: lead.id,
          phone: lead.phone,
          classification: result.classification,
          subClassification: result.subClassification,
          confidence: result.confidence
        });
      } catch (err) {
        classifyFailed++;
        log(`Process All: Classification error for ${lead.id}: ${err.message}`);

        try {
          const leads = readLeads();
          const idx = leads.findIndex(l => l.id === lead.id);
          if (idx !== -1) {
            leads[idx].status = 'classification_failed';
            leads[idx].updatedAt = new Date().toISOString();
            writeLeads(leads);
          }
        } catch { /* best effort */ }

        sendEvent({ step: 'classify_failed', leadId: lead.id, phone: lead.phone, error: err.message });
      }
    }

    // ── Done ─────────────────────────────────────────────────────────────────
    const summary = {
      step: 'done',
      message: 'All processing complete.',
      newCallsFetched: newCallsAdded,
      transcribed,
      transcribeFailed,
      classified,
      classifyFailed
    };

    sendEvent(summary);
    log(`Process All complete. Fetched: ${newCallsAdded}, Transcribed: ${transcribed}, Classified: ${classified}`);

  } catch (err) {
    log(`Process All unexpected error: ${err.message}`);
    sendEvent({ step: 'error', message: `Unexpected error: ${err.message}` });
  } finally {
    isProcessing = false;
    res.end();
  }
});

/**
 * DELETE /api/leads/:leadId
 * Permanently removes a lead from leads.json.
 */
app.delete('/api/leads/:leadId', (req, res) => {
  try {
    const leads = readLeads();
    const filtered = leads.filter(l => l.id !== req.params.leadId);

    if (filtered.length === leads.length) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    writeLeads(filtered);
    log(`Deleted lead ${req.params.leadId}`);
    res.json({ success: true, message: 'Lead deleted.' });

  } catch (err) {
    log(`DELETE /api/leads error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/leads/:leadId
 * Manually overrides the classification or other fields of a lead.
 * Allowed fields: classification, reason, needsManualReview
 */
app.patch('/api/leads/:leadId', (req, res) => {
  try {
    const leads = readLeads();
    const idx = leads.findIndex(l => l.id === req.params.leadId);

    if (idx === -1) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    // Only allow these fields to be updated via manual override
    const allowedFields = ['classification', 'subClassification', 'reason', 'needsManualReview'];
    const validClassifications = ['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP_LATER'];
    const validSubClassifications = ['VISITING', 'NOT_VISITING'];

    // Validate classification value if provided
    if (req.body.classification && !validClassifications.includes(req.body.classification)) {
      return res.status(400).json({ error: `Invalid classification. Must be one of: ${validClassifications.join(', ')}` });
    }

    // Validate sub-classification value if provided
    if (req.body.subClassification !== undefined && req.body.subClassification !== null &&
        !validSubClassifications.includes(req.body.subClassification)) {
      return res.status(400).json({ error: `Invalid sub-classification. Must be one of: ${validSubClassifications.join(', ')}` });
    }

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        leads[idx][field] = req.body[field];
      }
    });

    // If classification is being changed to something other than INTERESTED, clear subClassification
    if (req.body.classification && req.body.classification !== 'INTERESTED') {
      leads[idx].subClassification = null;
    }

    // Mark as manually overridden so we can track it
    leads[idx].manuallyOverridden = true;
    leads[idx].updatedAt = new Date().toISOString();

    writeLeads(leads);
    log(`Manual override for lead ${req.params.leadId}: ${JSON.stringify(req.body)}`);
    res.json(leads[idx]);

  } catch (err) {
    log(`PATCH /api/leads error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── Catch-all: serve dashboard for any unmatched route ───────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  log(`Gemini Live Lead Classifier running at http://localhost:${PORT}`);
  log(`Dashboard: http://localhost:${PORT}`);
  log(`API: http://localhost:${PORT}/api/leads`);
});
