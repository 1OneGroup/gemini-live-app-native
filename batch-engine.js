// Batch execution engine — orchestrates campaign calling with AI analysis between batches
const db = require('./db');
const store = require('./call-store');
const deepseek = require('./deepseek');

const CALL_COOLDOWN_MS = 5000;  // 5s between calls
const MAX_CONSECUTIVE_FAILURES = 3;

// Active campaign runners: campaignId -> { running, abortController }
const activeRunners = new Map();

// External call function — injected from server.js to avoid circular deps
let _makeCallFn = null;
function setMakeCallFn(fn) { _makeCallFn = fn; }

function isRunning(campaignId) {
  return activeRunners.has(campaignId) && activeRunners.get(campaignId).running;
}

function getRunnerStatus(campaignId) {
  const runner = activeRunners.get(campaignId);
  if (!runner) return null;
  return { running: runner.running, currentContact: runner.currentContact, consecutiveFailures: runner.consecutiveFailures };
}

async function startCampaign(campaignId) {
  if (isRunning(campaignId)) return { error: 'Campaign already running' };

  const campaign = await db.getCampaign(campaignId);
  if (!campaign) return { error: 'Campaign not found' };
  if (campaign.total_contacts === 0) return { error: 'No contacts uploaded' };

  const runner = { running: true, currentContact: null, consecutiveFailures: 0 };
  activeRunners.set(campaignId, runner);

  await db.updateCampaign(campaignId, { status: 'running' });

  // Start async batch loop (non-blocking)
  runBatchLoop(campaignId, runner).catch(async err => {
    console.error(`[BatchEngine] Campaign ${campaignId} error:`, err.message);
    await db.updateCampaign(campaignId, { status: 'paused' });
    runner.running = false;
  });

  return { ok: true, status: 'running' };
}

async function pauseCampaign(campaignId) {
  const runner = activeRunners.get(campaignId);
  if (runner) runner.running = false;
  await db.updateCampaign(campaignId, { status: 'paused' });
  return { ok: true, status: 'paused' };
}

async function cancelCampaign(campaignId) {
  const runner = activeRunners.get(campaignId);
  if (runner) runner.running = false;
  activeRunners.delete(campaignId);
  await db.updateCampaign(campaignId, { status: 'cancelled' });
  return { ok: true, status: 'cancelled' };
}

async function runBatchLoop(campaignId, runner) {
  const campaign = await db.getCampaign(campaignId);
  const maxBatch = await db.getMaxBatch(campaignId);
  let currentBatch = campaign.current_batch || 1;

  while (currentBatch <= maxBatch && runner.running) {
    console.log(`[BatchEngine] Campaign ${campaignId}: starting batch ${currentBatch}/${maxBatch}`);
    await db.updateCampaign(campaignId, { currentBatch, status: 'running' });

    // Check if this batch already has an analysis pending approval
    const existingAnalysis = await db.getAnalysis(campaignId, currentBatch);
    if (existingAnalysis && existingAnalysis.approved === 0) {
      console.log(`[BatchEngine] Batch ${currentBatch} awaiting approval, pausing`);
      await db.updateCampaign(campaignId, { status: 'awaiting_approval' });
      runner.running = false;
      return;
    }

    // Run all contacts in this batch
    await runBatch(campaignId, currentBatch, runner);

    if (!runner.running) return; // Paused or cancelled

    // Batch complete — run AI analysis
    console.log(`[BatchEngine] Batch ${currentBatch} complete, running AI analysis`);
    await runBatchAnalysis(campaignId, currentBatch);

    // Update completed count
    const stats = await db.getContactStats(campaignId);
    await db.updateCampaign(campaignId, { completedContacts: stats.completed + stats.failed });

    if (currentBatch < maxBatch) {
      // Pause for approval
      await db.updateCampaign(campaignId, { status: 'awaiting_approval' });
      runner.running = false;
      console.log(`[BatchEngine] Campaign ${campaignId} paused for batch ${currentBatch} review`);
      return;
    }

    currentBatch++;
  }

  // All batches done
  if (runner.running) {
    const stats = await db.getContactStats(campaignId);
    await db.updateCampaign(campaignId, {
      status: 'completed',
      completedContacts: stats.completed + stats.failed,
      currentBatch: maxBatch,
    });
    runner.running = false;
    activeRunners.delete(campaignId);
    console.log(`[BatchEngine] Campaign ${campaignId} completed`);
  }
}

async function runBatch(campaignId, batchNumber, runner) {
  runner.consecutiveFailures = 0;

  while (runner.running) {
    const contact = await db.getNextPendingContact(campaignId, batchNumber);
    if (!contact) break; // Batch done

    runner.currentContact = contact.id;
    console.log(`[BatchEngine] Calling ${contact.phone} (${contact.name || 'Unknown'})`);

    // Mark contact as calling
    await db.updateContact(contact.id, { status: 'calling' });

    try {
      // Get campaign for potential prompt override
      const campaign = await db.getCampaign(campaignId);

      // Make the call (pass whatsapp message key for brochure routing)
      const result = await _makeCallFn(contact.phone, contact.name || 'Sir', campaign.prompt_override || null, campaign.whatsapp_message_key || null, contact.employee_name || null, { enableAMD: true });
      await db.updateContact(contact.id, { callUuid: result.callUuid, status: 'calling' });

      // Wait for call to complete (poll call store)
      const preOutcome = await waitForCallCompletion(result.callUuid, 300000); // 5 min timeout
      const callData = store.getCall(result.callUuid);

      // Transcript-bearing outcomes → DeepSeek classification. Hangup-only outcomes skip it.
      let outcome = preOutcome;
      let intent = null, interestScore = null, objections = null, oneLineSummary = null;
      if (['interested', 'not_interested', 'callback', 'brochure_sent'].includes(preOutcome)
          && callData?.transcript?.length > 0) {
        const c = await deepseek.classifyCall(callData.transcript);
        outcome = c.outcome || preOutcome;
        intent = c.intent;
        interestScore = c.interest_score;
        objections = c.objections ? JSON.stringify(c.objections) : null;
        oneLineSummary = c.one_line_summary;
      }

      await db.updateContact(contact.id, {
        status: 'completed', outcome,
        callbackDate: callData?.callbackDate || null,
        callbackNote: callData?.callbackRequested || null,
        intent, interestScore, objections, oneLineSummary,
      });

      runner.consecutiveFailures = 0;
      console.log(`[BatchEngine] Call to ${contact.phone} completed: ${outcome}${intent ? ` (intent=${intent}, score=${interestScore})` : ''}`);

    } catch (err) {
      console.error(`[BatchEngine] Call to ${contact.phone} failed:`, err.message);
      await db.updateContact(contact.id, { status: 'failed', outcome: 'error' });
      runner.consecutiveFailures++;

      if (runner.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`[BatchEngine] ${MAX_CONSECUTIVE_FAILURES} consecutive failures, pausing campaign`);
        await db.updateCampaign(campaignId, { status: 'paused' });
        runner.running = false;
        return;
      }
    }

    // Cooldown between calls
    if (runner.running) {
      await sleep(CALL_COOLDOWN_MS);
    }
  }

  runner.currentContact = null;
}

async function waitForCallCompletion(callUuid, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const call = store.getCall(callUuid);
    if (call && (call.status === 'completed' || call.hangupCause)) {
      return classifyOutcome(call);
    }
    await sleep(3000);
  }
  return 'no_answer';
}

function classifyOutcome(call) {
  if (!call) return 'no_answer';

  // AMD-detected voicemail takes priority
  if (call.voicemailDetected) return 'voicemail';

  const hangup = (call.hangupCause || '').toLowerCase();
  if (hangup === 'rejected' || hangup === 'busy') return 'busy';
  if (hangup === 'noanswer' || hangup === 'no_answer' || hangup === 'originator cancel') return 'no_answer';

  // Analyze transcript for interest signals
  const transcript = (call.transcript || []).map(t => t.text.toLowerCase()).join(' ');

  if (transcript.includes('brochure') || transcript.includes('whatsapp') || transcript.includes('send me')) {
    return 'brochure_sent'; // Will be updated to actual brochure_sent by WhatsApp handler
  }
  if (transcript.includes('site visit') || transcript.includes('appointment') || transcript.includes('schedule') ||
      transcript.includes('interested') || transcript.includes('tell me more') || transcript.includes('details')) {
    return 'interested';
  }
  if (transcript.includes('not interested') || transcript.includes('no thank') || transcript.includes('don\'t call') ||
      transcript.includes('remove my number') || transcript.includes('no need')) {
    return 'not_interested';
  }
  if (transcript.includes('call back') || transcript.includes('later') || transcript.includes('busy right now')) {
    return 'callback';
  }

  // Default based on duration
  if (call.duration && call.duration > 30) return 'interested';
  if (call.duration && call.duration > 10) return 'callback';
  return 'no_answer';
}

// --- AI Batch Analysis (DeepSeek V3.2 via OpenRouter) ---
// Pulls per-call JSONs written by classifyCall; never re-sends raw transcripts.
async function runBatchAnalysis(campaignId, batchNumber) {
  const contacts = await db.getContacts(campaignId, { batchNumber });
  const batchStats = await db.getBatchStats(campaignId, batchNumber);

  const perCallJsons = contacts
    .filter(c => c.one_line_summary)
    .map(c => ({
      outcome: c.outcome,
      intent: c.intent,
      interest_score: c.interest_score,
      objections: safeJsonParse(c.objections, []),
      one_line_summary: c.one_line_summary,
    }));

  const { summary } = await deepseek.summarizeBatch(perCallJsons, batchStats);

  const activePrompt = await db.getActivePrompt();
  await db.createAnalysis(campaignId, batchNumber, {
    summary,
    recommendations: null,
    promptAdjustments: null,
    stats: batchStats,
    promptId: activePrompt?.id || null,
  });

  console.log(`[BatchEngine] DeepSeek batch analysis saved for batch ${batchNumber} (${perCallJsons.length}/${contacts.length} calls had per-call JSON)`);
}

function safeJsonParse(s, fallback) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = {
  startCampaign, pauseCampaign, cancelCampaign,
  isRunning, getRunnerStatus, setMakeCallFn, classifyOutcome, runBatchAnalysis,
};
