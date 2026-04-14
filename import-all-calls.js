// import-all-calls.js — Import ALL calls from Gemini Live and classify them
// Run with: node import-all-calls.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { classifyTranscript } = require('./classifier');

const GEMINI_LIVE_API = 'http://187.127.138.156:8100/api/calls';
const LEADS_FILE = path.join(__dirname, 'leads.json');

// Delay between Gemini API calls to avoid rate limiting
const CLASSIFY_DELAY_MS = 800;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// Format transcript array [{role, text, timestamp}] into readable string
function formatTranscript(transcriptArr) {
  if (!Array.isArray(transcriptArr) || transcriptArr.length === 0) return '';
  return transcriptArr
    .filter(t => t.text && t.text.trim())
    .map(t => {
      const speaker = t.role === 'user' ? 'Lead' : 'Agent';
      return `${speaker}: ${t.text.trim()}`;
    })
    .join('\n');
}

// Determine if a call outcome is a clear no-conversation result
function isNoConversation(call) {
  // No transcript lines or just 1 (only the greeting, no lead response)
  if (call.transcriptLines <= 1) return true;
  // Calls that never connected
  const noAnswerCauses = ['no answer', 'busy', 'voicemail', 'failed', 'NOANSWER', 'USER_BUSY', 'USER_NOT_REGISTERED'];
  if (call.hangupCause && noAnswerCauses.some(c => call.hangupCause.toLowerCase().includes(c.toLowerCase()))) return true;
  return false;
}

// Map Gemini Live's outcome field to our classification format (for no-conversation calls)
function mapNoConvOutcome(call) {
  // These calls never had a conversation — always NOT_INTERESTED
  return {
    classification: 'NOT_INTERESTED',
    confidence: 95,
    reason: call.hangupCause
      ? `Call ended without conversation: ${call.hangupCause}`
      : 'Call ended without meaningful conversation.',
    keySignals: call.hangupCause ? [call.hangupCause] : ['No response'],
    needsManualReview: false
  };
}

async function main() {
  log('=== Gemini Live Full Import Script ===');
  const force = process.argv.includes('--force');

  // ── Step 1: Load existing leads + backup ──────────────────────────────────
  const backupPath = path.join(__dirname, `leads.backup.import-${Date.now()}.json`);
  let existingLeads = [];
  if (fs.existsSync(LEADS_FILE)) {
    fs.copyFileSync(LEADS_FILE, backupPath);
    log(`Backed up current leads.json → ${path.basename(backupPath)}`);
    try {
      existingLeads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
      if (!Array.isArray(existingLeads)) existingLeads = [];
    } catch {
      existingLeads = [];
    }
  }
  log(`Existing leads in database: ${existingLeads.length}`);

  const existingUuids = new Set(
    existingLeads.map(l => l.geminiCallUuid).filter(Boolean)
  );

  // ── Step 2: Fetch ALL calls from Gemini Live API ───────────────────────────
  log('Fetching all calls from Gemini Live API...');
  let allCalls;
  try {
    const res = await fetch(GEMINI_LIVE_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    allCalls = await res.json();
    if (!Array.isArray(allCalls)) {
      throw new Error('Expected array from API, got: ' + typeof allCalls);
    }
    log(`Fetched ${allCalls.length} total calls from Gemini Live.`);
  } catch (err) {
    log(`ERROR: Failed to fetch calls — ${err.message}`);
    log('Aborting without modifying leads.json.');
    process.exit(1);
  }

  // ── Safety guard: refuse destructive runs ─────────────────────────────────
  if (allCalls.length === 0 && existingLeads.length > 0 && !force) {
    log(`ABORT: API returned 0 calls but you have ${existingLeads.length} leads already. Use --force to override.`);
    process.exit(1);
  }

  // ── Step 3: Skip calls already in the database ─────────────────────────────
  const newCalls = allCalls.filter(c => c.callUuid && !existingUuids.has(c.callUuid));
  log(`New calls to import: ${newCalls.length} (skipping ${allCalls.length - newCalls.length} already in DB)`);

  if (newCalls.length === 0) {
    log('Nothing new to import. Existing leads.json left untouched.');
    return;
  }

  const convoCallsRaw = newCalls.filter(c => !isNoConversation(c));
  const noConvoCalls = newCalls.filter(c => isNoConversation(c));
  log(`Calls with conversation: ${convoCallsRaw.length} | No conversation: ${noConvoCalls.length}`);

  const leads = existingLeads.slice();

  // ── Step 4: Process no-conversation calls (fast — no API call needed) ──────
  log(`Processing ${noConvoCalls.length} no-conversation calls as NOT_INTERESTED...`);
  for (const call of noConvoCalls) {
    const cl = mapNoConvOutcome(call);
    leads.push({
      id: uuidv4(),
      geminiCallUuid: call.callUuid,
      phone: call.to,
      customerName: call.customerName || null,
      callDate: call.startedAt || new Date().toISOString(),
      callDuration: call.duration || null,
      recordingUrl: null, // Not fetching for no-conv calls
      direction: 'outbound',
      hangupCause: call.hangupCause || null,
      transcript: null,
      classification: cl.classification,
      confidence: cl.confidence,
      reason: cl.reason,
      keySignals: cl.keySignals,
      status: 'classified',
      needsManualReview: false,
      manuallyOverridden: false,
      source: 'gemini-live-import',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  log(`Done: ${noConvoCalls.length} no-conversation leads added as NOT_INTERESTED.`);

  // ── Step 5: Fetch full details + classify conversation calls ───────────────
  log(`\nNow classifying ${convoCallsRaw.length} conversation calls with Gemini AI...`);
  log('This will take a few minutes. Progress below:\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < convoCallsRaw.length; i++) {
    const call = convoCallsRaw[i];
    const progress = `[${i + 1}/${convoCallsRaw.length}]`;

    try {
      // Fetch full call details (includes transcript array + recordingUrl)
      const detailRes = await fetch(`${GEMINI_LIVE_API}/${call.callUuid}`);
      if (!detailRes.ok) throw new Error(`HTTP ${detailRes.status} fetching call detail`);
      const detail = await detailRes.json();

      // Format transcript array → readable text
      const transcriptText = formatTranscript(detail.transcript);

      let classification;
      if (!transcriptText || transcriptText.length < 20) {
        // Transcript too short despite transcriptLines > 1 — treat as NOT_INTERESTED
        classification = {
          classification: 'NOT_INTERESTED',
          confidence: 70,
          reason: 'Transcript too short to classify meaningfully.',
          keySignals: ['Short transcript'],
          needsManualReview: false
        };
        log(`${progress} ${call.to} (${call.customerName || 'Unknown'}) — transcript too short, skipping Gemini`);
      } else {
        // Classify with Gemini
        classification = await classifyTranscript(transcriptText);
        log(`${progress} ${call.to} (${call.customerName || 'Unknown'}) → ${classification.classification} (${classification.confidence}%)`);
        await sleep(CLASSIFY_DELAY_MS);
      }

      leads.push({
        id: uuidv4(),
        geminiCallUuid: call.callUuid,
        phone: call.to,
        customerName: call.customerName || null,
        callDate: call.startedAt || new Date().toISOString(),
        callDuration: call.duration || null,
        recordingUrl: detail.recordingUrl || null,
        direction: 'outbound',
        hangupCause: call.hangupCause || null,
        transcript: transcriptText || null,
        classification: classification.classification,
        confidence: classification.confidence,
        reason: classification.reason,
        keySignals: classification.keySignals,
        status: 'classified',
        needsManualReview: classification.needsManualReview,
        manuallyOverridden: false,
        source: 'gemini-live-import',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      successCount++;

      // Save progress every 10 leads so we don't lose work if interrupted
      if (successCount % 10 === 0) {
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
        log(`  [Checkpoint] Saved ${leads.length} leads so far...`);
      }

    } catch (err) {
      failCount++;
      log(`${progress} ${call.to} — ERROR: ${err.message}`);

      // Save the lead with failed status rather than losing it
      leads.push({
        id: uuidv4(),
        geminiCallUuid: call.callUuid,
        phone: call.to,
        customerName: call.customerName || null,
        callDate: call.startedAt || new Date().toISOString(),
        callDuration: call.duration || null,
        recordingUrl: null,
        direction: 'outbound',
        hangupCause: call.hangupCause || null,
        transcript: null,
        classification: null,
        confidence: null,
        reason: null,
        keySignals: [],
        status: 'classification_failed',
        needsManualReview: true,
        manuallyOverridden: false,
        source: 'gemini-live-import',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  // ── Step 6: Sort newest first and save ─────────────────────────────────────
  leads.sort((a, b) => new Date(b.callDate) - new Date(a.callDate));

  if (leads.length < existingLeads.length && !force) {
    log(`ABORT: Final count (${leads.length}) is smaller than existing (${existingLeads.length}). Not overwriting. Use --force to override.`);
    process.exit(1);
  }
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');

  // ── Final summary ──────────────────────────────────────────────────────────
  const interested = leads.filter(l => l.classification === 'INTERESTED').length;
  const notInterested = leads.filter(l => l.classification === 'NOT_INTERESTED').length;
  const followUp = leads.filter(l => l.classification === 'FOLLOW_UP_LATER').length;
  const failed = leads.filter(l => l.status === 'classification_failed').length;

  log('\n=== IMPORT COMPLETE ===');
  log(`Total leads saved:  ${leads.length}`);
  log(`INTERESTED:         ${interested}`);
  log(`NOT_INTERESTED:     ${notInterested}`);
  log(`FOLLOW_UP_LATER:    ${followUp}`);
  log(`Failed:             ${failed}`);
  log(`\nDashboard: http://localhost:3000`);
  log(`Backup saved at:    ${path.basename(backupPath)}`);
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
