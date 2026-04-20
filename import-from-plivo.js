// import-from-plivo.js — Fetch ALL calls from Plivo and classify them
// Run with: node import-from-plivo.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const plivo = require('plivo');
const { transcribeAudio } = require('./transcriber');
const { classifyTranscript } = require('./classifier');

const client = new plivo.Client(process.env.PLIVO_AUTH_ID, process.env.PLIVO_AUTH_TOKEN);
const LEADS_FILE = path.join(__dirname, 'data', 'leads.json');

// Calls shorter than this (seconds) had no real conversation
const MIN_CONVERSATION_DURATION = 20;
// Delay between Gemini API calls to avoid rate limiting
const CLASSIFY_DELAY_MS = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// Fetch ALL calls from Plivo (paginated)
async function fetchAllPlivoCalls() {
  const all = [];
  let offset = 0;
  const limit = 20;

  while (true) {
    const resp = await client.calls.list({ limit, offset });
    const calls = Object.values(resp).filter(v => typeof v === 'object' && v.callUuid);
    if (calls.length === 0) break;
    all.push(...calls);
    log(`Fetched ${all.length} / ${resp.meta?.totalCount || '?'} calls from Plivo...`);
    if (!resp.meta?.next) break;
    offset += limit;
    await sleep(300);
  }
  return all;
}

// Get recording URL for a call
async function getRecordingUrl(callUuid) {
  try {
    const resp = await client.recordings.list({ call_uuid: callUuid, limit: 1 });
    const recs = Object.values(resp).filter(v => typeof v === 'object' && v.recordingUrl);
    return recs[0]?.recordingUrl || null;
  } catch {
    return null;
  }
}

async function main() {
  log('=== Plivo Full Import Script ===');

  // Backup current leads.json
  const backupPath = path.join(__dirname, `leads.backup.plivo-${Date.now()}.json`);
  if (fs.existsSync(LEADS_FILE)) {
    fs.copyFileSync(LEADS_FILE, backupPath);
    log(`Backed up leads.json → ${path.basename(backupPath)}`);
  }

  // Load existing leads to deduplicate
  const existingLeads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  const existingUuids = new Set(existingLeads.map(l => l.plivoCallUuid).filter(Boolean));
  log(`Existing leads: ${existingLeads.length} (will skip duplicates)`);

  // Fetch all calls from Plivo
  log('Fetching all calls from Plivo...');
  let allCalls;
  try {
    allCalls = await fetchAllPlivoCalls();
    log(`Total calls fetched: ${allCalls.length}`);
  } catch (err) {
    log(`ERROR fetching from Plivo: ${err.message}`);
    process.exit(1);
  }

  // Filter out calls already in leads.json
  const newCalls = allCalls.filter(c => !existingUuids.has(c.callUuid));
  log(`New calls to process: ${newCalls.length} (${allCalls.length - newCalls.length} already imported)`);

  if (newCalls.length === 0) {
    log('Nothing new to import. Done.');
    return;
  }

  // Split by duration
  const convoCalls = newCalls.filter(c => parseInt(c.callDuration) >= MIN_CONVERSATION_DURATION);
  const noConvoCalls = newCalls.filter(c => parseInt(c.callDuration) < MIN_CONVERSATION_DURATION);
  log(`With conversation (>=${MIN_CONVERSATION_DURATION}s): ${convoCalls.length}`);
  log(`No conversation (<${MIN_CONVERSATION_DURATION}s): ${noConvoCalls.length}`);

  const newLeads = [];

  // Process no-conversation calls instantly as NOT_INTERESTED
  log(`\nMarking ${noConvoCalls.length} short calls as NOT_INTERESTED...`);
  for (const call of noConvoCalls) {
    newLeads.push({
      id: uuidv4(),
      plivoCallUuid: call.callUuid,
      phone: call.toNumber ? `+${call.toNumber}` : call.fromNumber,
      customerName: null,
      callDate: call.initiationTime || new Date().toISOString(),
      callDuration: parseInt(call.callDuration) || 0,
      recordingUrl: null,
      direction: call.callDirection || 'outbound',
      hangupCause: call.hangupCauseName || null,
      transcript: null,
      classification: 'NOT_INTERESTED',
      confidence: 90,
      reason: `Call duration ${call.callDuration}s — no meaningful conversation.`,
      keySignals: [call.hangupCauseName || 'Short call'],
      status: 'classified',
      needsManualReview: false,
      manuallyOverridden: false,
      source: 'plivo-import',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  // Process conversation calls — fetch recording, transcribe, classify
  log(`\nProcessing ${convoCalls.length} conversation calls (Whisper + Gemini)...`);
  log('This will take several minutes...\n');

  let success = 0, failed = 0;

  for (let i = 0; i < convoCalls.length; i++) {
    const call = convoCalls[i];
    const progress = `[${i + 1}/${convoCalls.length}]`;
    const phone = call.toNumber ? `+${call.toNumber}` : call.fromNumber;

    try {
      // Get recording URL
      const recordingUrl = await getRecordingUrl(call.callUuid);
      if (!recordingUrl) {
        log(`${progress} ${phone} — no recording, marking NOT_INTERESTED`);
        newLeads.push({
          id: uuidv4(),
          plivoCallUuid: call.callUuid,
          phone,
          customerName: null,
          callDate: call.initiationTime || new Date().toISOString(),
          callDuration: parseInt(call.callDuration) || 0,
          recordingUrl: null,
          direction: call.callDirection || 'outbound',
          hangupCause: call.hangupCauseName || null,
          transcript: null,
          classification: 'NOT_INTERESTED',
          confidence: 70,
          reason: 'No recording available for transcription.',
          keySignals: ['No recording'],
          status: 'classified',
          needsManualReview: false,
          manuallyOverridden: false,
          source: 'plivo-import',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        continue;
      }

      // Transcribe with Whisper
      log(`${progress} ${phone} (${call.callDuration}s) — transcribing...`);
      const leadObj = { recordingUrl, plivoCallUuid: call.callUuid };
      const transcript = await transcribeAudio(leadObj);

      if (!transcript || transcript.trim().length < 20) {
        log(`${progress} ${phone} — transcription failed/empty`);
        newLeads.push({
          id: uuidv4(),
          plivoCallUuid: call.callUuid,
          phone,
          customerName: null,
          callDate: call.initiationTime || new Date().toISOString(),
          callDuration: parseInt(call.callDuration) || 0,
          recordingUrl,
          direction: call.callDirection || 'outbound',
          hangupCause: call.hangupCauseName || null,
          transcript: null,
          classification: null,
          confidence: null,
          reason: null,
          keySignals: [],
          status: 'transcription_failed',
          needsManualReview: true,
          manuallyOverridden: false,
          source: 'plivo-import',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        failed++;
        continue;
      }

      // Classify with Gemini
      const result = await classifyTranscript(transcript);
      log(`${progress} ${phone} → ${result.classification} (${result.confidence}%)`);

      newLeads.push({
        id: uuidv4(),
        plivoCallUuid: call.callUuid,
        phone,
        customerName: null,
        callDate: call.initiationTime || new Date().toISOString(),
        callDuration: parseInt(call.callDuration) || 0,
        recordingUrl,
        direction: call.callDirection || 'outbound',
        hangupCause: call.hangupCauseName || null,
        transcript,
        classification: result.classification,
        confidence: result.confidence,
        reason: result.reason,
        keySignals: result.keySignals,
        status: 'classified',
        needsManualReview: result.needsManualReview,
        manuallyOverridden: false,
        source: 'plivo-import',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      success++;
      await sleep(CLASSIFY_DELAY_MS);

      // Save checkpoint every 10 leads
      if (success % 10 === 0) {
        const all = [...existingLeads, ...newLeads];
        all.sort((a, b) => new Date(b.callDate) - new Date(a.callDate));
        fs.writeFileSync(LEADS_FILE, JSON.stringify(all, null, 2));
        log(`[Checkpoint] Saved ${all.length} total leads...`);
      }

    } catch (err) {
      failed++;
      log(`${progress} ${phone} — ERROR: ${err.message}`);
      newLeads.push({
        id: uuidv4(),
        plivoCallUuid: call.callUuid,
        phone,
        customerName: null,
        callDate: call.initiationTime || new Date().toISOString(),
        callDuration: parseInt(call.callDuration) || 0,
        recordingUrl: null,
        direction: call.callDirection || 'outbound',
        hangupCause: call.hangupCauseName || null,
        transcript: null,
        classification: null,
        confidence: null,
        reason: null,
        keySignals: [],
        status: 'classification_failed',
        needsManualReview: true,
        manuallyOverridden: false,
        source: 'plivo-import',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  // Final save
  const allLeads = [...existingLeads, ...newLeads];
  allLeads.sort((a, b) => new Date(b.callDate) - new Date(a.callDate));
  fs.writeFileSync(LEADS_FILE, JSON.stringify(allLeads, null, 2));

  // Summary
  const interested = allLeads.filter(l => l.classification === 'INTERESTED').length;
  const notInterested = allLeads.filter(l => l.classification === 'NOT_INTERESTED').length;
  const followUp = allLeads.filter(l => l.classification === 'FOLLOW_UP_LATER').length;

  log('\n=== IMPORT COMPLETE ===');
  log(`Total leads saved:  ${allLeads.length}`);
  log(`INTERESTED:         ${interested}`);
  log(`NOT_INTERESTED:     ${notInterested}`);
  log(`FOLLOW_UP_LATER:    ${followUp}`);
  log(`Classified OK:      ${success}`);
  log(`Failed:             ${failed}`);
  log(`\nDashboard: http://localhost:3000`);
}

main().catch(err => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
