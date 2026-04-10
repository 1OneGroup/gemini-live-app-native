// Batch execution engine — orchestrates campaign calling with AI analysis between batches
const db = require('./db');
const store = require('./call-store');
const classifier = require('./classifier');

const CALL_COOLDOWN_MS = 5000;  // 5s between calls
const MAX_CONSECUTIVE_FAILURES = 3;
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const CLASSIFIER_DASHBOARD_URL = process.env.CLASSIFIER_DASHBOARD_URL;

async function sendWebhook(callUuid, callData, classification) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callUuid,
        phone: callData.to,
        customerName: callData.customerName,
        outcome: classification.outcome,
        lead_temperature: classification.lead_temperature,
        follow_up_action: classification.follow_up_action,
        conversation_summary: classification.conversation_summary,
        classification_confidence: classification.confidence,
        callback_date: classification.callback_date,
        duration: callData.duration,
        timestamp: new Date().toISOString(),
      }),
    });
    console.log(`[Webhook] Sent classification for ${callUuid} → ${classification.outcome}`);
  } catch (err) {
    console.error(`[Webhook] Failed to send for ${callUuid}:`, err.message);
  }
}

// Send completed call data to the lead classifier dashboard
async function sendToDashboard(callData, classification) {
  if (!CLASSIFIER_DASHBOARD_URL) return;
  try {
    const transcriptText = (callData.transcript || [])
      .filter(t => t.role !== 'system')
      .map(t => `${t.role === 'agent' ? 'Agent' : 'Lead'}: ${t.text}`)
      .join('\n');

    await fetch(CLASSIFIER_DASHBOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: callData.to,
        transcript: transcriptText,
        recordingUrl: callData.recordingUrl || null,
        callDuration: callData.duration || null,
        callDate: callData.startedAt || new Date().toISOString(),
        direction: 'outbound',
      }),
    });
    console.log(`[Dashboard] Lead sent: ${callData.to} → ${classification?.outcome}`);
  } catch (err) {
    console.error(`[Dashboard] Failed to send lead ${callData.to}:`, err.message);
  }
}

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

  const campaign = db.getCampaign(campaignId);
  if (!campaign) return { error: 'Campaign not found' };
  if (campaign.total_contacts === 0) return { error: 'No contacts uploaded' };

  const runner = { running: true, currentContact: null, consecutiveFailures: 0 };
  activeRunners.set(campaignId, runner);

  db.updateCampaign(campaignId, { status: 'running' });

  // Start async batch loop (non-blocking)
  runBatchLoop(campaignId, runner).catch(err => {
    console.error(`[BatchEngine] Campaign ${campaignId} error:`, err.message);
    db.updateCampaign(campaignId, { status: 'paused' });
    runner.running = false;
  });

  return { ok: true, status: 'running' };
}

function pauseCampaign(campaignId) {
  const runner = activeRunners.get(campaignId);
  if (runner) runner.running = false;
  db.updateCampaign(campaignId, { status: 'paused' });
  return { ok: true, status: 'paused' };
}

function cancelCampaign(campaignId) {
  const runner = activeRunners.get(campaignId);
  if (runner) runner.running = false;
  activeRunners.delete(campaignId);
  db.updateCampaign(campaignId, { status: 'cancelled' });
  return { ok: true, status: 'cancelled' };
}

async function runBatchLoop(campaignId, runner) {
  const campaign = db.getCampaign(campaignId);
  const maxBatch = db.getMaxBatch(campaignId);
  let currentBatch = campaign.current_batch || 1;

  while (currentBatch <= maxBatch && runner.running) {
    console.log(`[BatchEngine] Campaign ${campaignId}: starting batch ${currentBatch}/${maxBatch}`);
    db.updateCampaign(campaignId, { currentBatch, status: 'running' });

    // Check if this batch already has an analysis pending approval
    const existingAnalysis = db.getAnalysis(campaignId, currentBatch);
    if (existingAnalysis && existingAnalysis.approved === 0) {
      console.log(`[BatchEngine] Batch ${currentBatch} awaiting approval, pausing`);
      db.updateCampaign(campaignId, { status: 'awaiting_approval' });
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
    const stats = db.getContactStats(campaignId);
    db.updateCampaign(campaignId, { completedContacts: stats.completed + stats.failed });

    if (currentBatch < maxBatch) {
      // Pause for approval
      db.updateCampaign(campaignId, { status: 'awaiting_approval' });
      runner.running = false;
      console.log(`[BatchEngine] Campaign ${campaignId} paused for batch ${currentBatch} review`);
      return;
    }

    currentBatch++;
  }

  // All batches done
  if (runner.running) {
    const stats = db.getContactStats(campaignId);
    db.updateCampaign(campaignId, {
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
    const contact = db.getNextPendingContact(campaignId, batchNumber);
    if (!contact) break; // Batch done

    runner.currentContact = contact.id;
    console.log(`[BatchEngine] Calling ${contact.phone} (${contact.name || 'Unknown'})`);

    // Mark contact as calling
    db.updateContact(contact.id, { status: 'calling' });

    try {
      // Get campaign for potential prompt override
      const campaign = db.getCampaign(campaignId);

      // Make the call (pass whatsapp message key for brochure routing)
      const result = await _makeCallFn(contact.phone, contact.name || 'Sir', null, campaign.whatsapp_message_key || null, contact.employee_name || null, {});
      db.updateContact(contact.id, { callUuid: result.callUuid, status: 'calling' });

      // Wait for call to complete (poll call store)
      const outcome = await waitForCallCompletion(result.callUuid, 300000); // 5 min timeout
      const callData = store.getCall(result.callUuid);
      db.updateContact(contact.id, {
        status: 'completed', outcome,
        callbackDate: callData?.callbackDate || null,
        callbackNote: callData?.callbackRequested || null,
      });

      runner.consecutiveFailures = 0;
      console.log(`[BatchEngine] Call to ${contact.phone} completed: ${outcome}`);

    } catch (err) {
      console.error(`[BatchEngine] Call to ${contact.phone} failed:`, err.message);
      db.updateContact(contact.id, { status: 'failed', outcome: 'error' });
      runner.consecutiveFailures++;

      if (runner.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`[BatchEngine] ${MAX_CONSECUTIVE_FAILURES} consecutive failures, pausing campaign`);
        db.updateCampaign(campaignId, { status: 'paused' });
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
      // Use AI classifier instead of old keyword-based classifier
      try {
        const classification = await classifier.classifyCall(call);
        store.updateCall(callUuid, {
          outcome: classification.outcome,
          lead_temperature: classification.lead_temperature,
          follow_up_action: classification.follow_up_action,
          conversation_summary: classification.conversation_summary,
          classification_confidence: classification.confidence,
          callback_date: classification.callback_date,
        });
        await sendWebhook(callUuid, call, classification);
        await sendToDashboard(call, classification);
        return classification.outcome || 'no_answer';
      } catch (err) {
        console.error(`[BatchEngine] AI classification failed for ${callUuid}:`, err.message);
        return store.classifyCallOutcome(callUuid) || 'no_answer';
      }
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

// --- AI Batch Analysis ---
async function runBatchAnalysis(campaignId, batchNumber) {
  const contacts = db.getContacts(campaignId, { batchNumber });
  const batchStats = db.getBatchStats(campaignId, batchNumber);
  const campaign = db.getCampaign(campaignId);

  // Collect transcripts from completed calls
  const transcripts = [];
  for (const contact of contacts) {
    if (contact.call_uuid) {
      const call = store.getCall(contact.call_uuid);
      if (call?.transcript?.length > 0) {
        transcripts.push({
          name: contact.name || 'Unknown',
          phone: contact.phone,
          outcome: contact.outcome,
          duration: call.duration,
          transcript: call.transcript.map(t => `${t.role}: ${t.text}`).join('\n'),
        });
      }
    }
  }

  const prompt = `You are an AI telecalling campaign analyst. Analyze the following batch of cold calls for a real estate project.

## Campaign: ${campaign.name}
## Batch ${batchNumber} Results

### Stats
- Total calls: ${batchStats.total}
- Completed: ${batchStats.completed}
- Failed: ${batchStats.failed}
- Interested: ${batchStats.interested}
- Not interested: ${batchStats.not_interested}
- Callbacks: ${batchStats.callback}
- No answer: ${batchStats.no_answer}
- Busy: ${batchStats.busy}
- Brochure requests: ${batchStats.brochure_sent}
- Voicemail: ${batchStats.voicemail || 0}

### Call Transcripts (${transcripts.length} available)
${transcripts.slice(0, 20).map((t, i) => `
--- Call ${i + 1}: ${t.name} (${t.outcome}, ${t.duration}s) ---
${t.transcript}
`).join('\n')}

## Your Analysis

Provide:
1. **Summary**: 2-3 sentence overview of batch performance
2. **Key Patterns**: What objections are most common? What's working in the pitch?
3. **Recommendations**: Specific, actionable improvements for the next batch
4. **Prompt Adjustments**: If the system instruction should be tweaked, suggest specific changes

Format your response as JSON:
{
  "summary": "...",
  "recommendations": "...",
  "prompt_adjustments": "..."
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Try to parse JSON from response
    let analysis = { summary: text, recommendations: '', prompt_adjustments: '' };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        analysis = { summary: parsed.summary || text, recommendations: parsed.recommendations || '', prompt_adjustments: parsed.prompt_adjustments || '' };
      }
    } catch { /* Use raw text as summary */ }

    // Record which prompt was active for this batch
    const activePrompt = db.getActivePrompt();
    db.createAnalysis(campaignId, batchNumber, {
      summary: analysis.summary,
      recommendations: analysis.recommendations,
      promptAdjustments: analysis.prompt_adjustments,
      stats: batchStats,
      promptId: activePrompt?.id || null,
    });

    console.log(`[BatchEngine] AI analysis saved for batch ${batchNumber}`);
  } catch (err) {
    console.error(`[BatchEngine] AI analysis failed:`, err.message);
    // Save analysis with error
    const activePromptErr = db.getActivePrompt();
    db.createAnalysis(campaignId, batchNumber, {
      summary: `Analysis failed: ${err.message}`,
      recommendations: '',
      promptAdjustments: '',
      stats: batchStats,
      promptId: activePromptErr?.id || null,
    });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = {
  startCampaign, pauseCampaign, cancelCampaign,
  isRunning, getRunnerStatus, setMakeCallFn, classifyOutcome, runBatchAnalysis, classifier,
};
