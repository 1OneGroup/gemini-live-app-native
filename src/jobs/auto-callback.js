// src/jobs/auto-callback.js
// Cron job: daily at 11:00 AM IST (5:30 AM UTC), dials any contacts whose
// callback_date is due. Only runs for campaigns with auto_callback enabled.

const db = require('../../db');

// Dial all due callback contacts across all auto_callback-enabled campaigns.
// makeCallFn — the makeCall function from src/plivo/outbound.js (injected to
// avoid circular deps: outbound.js -> session.js -> ... -/-> jobs).
async function runAutoCallbacks(makeCallFn) {
  const campaigns = await db.listCampaigns();
  for (const campaign of campaigns) {
    if (!campaign.auto_callback) continue;
    const callbacks = await db.getCallbackContacts(campaign.id);
    const now = new Date();
    const due = callbacks.filter(c => c.callback_date && new Date(c.callback_date) <= now);
    if (due.length === 0) continue;

    console.log(`[AutoCallback] Campaign "${campaign.name}": ${due.length} due callback(s)`);
    for (const contact of due) {
      try {
        const result = await makeCallFn(contact.phone, contact.name || 'Sir', campaign.prompt_override || null, campaign.whatsapp_message_key || null, null, { enableAMD: true });
        await db.updateContact(contact.id, { status: 'calling', callUuid: result.callUuid, outcome: null, callbackDate: null, callbackNote: null });
        console.log(`[AutoCallback] Called ${contact.name || contact.phone}: ${result.callUuid}`);
        // Wait between calls
        await new Promise(r => setTimeout(r, 5000));
      } catch (err) {
        console.error(`[AutoCallback] Failed to call ${contact.phone}:`, err.message);
      }
    }
  }
}

// Set up a setInterval that fires runAutoCallbacks once per day at 11:00 AM IST.
// makeCallFn is passed in at schedule time.
function scheduleAutoCallbackCron(makeCallFn) {
  const CHECK_INTERVAL_MS = 60000; // Check every minute
  let lastRunDate = null;

  setInterval(() => {
    const now = new Date();
    // 11:00 AM IST = 5:30 AM UTC
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const todayStr = now.toISOString().split('T')[0];

    if (utcHour === 5 && utcMin === 30 && lastRunDate !== todayStr) {
      lastRunDate = todayStr;
      console.log(`[AutoCallback] Cron triggered at 11:00 AM IST (${todayStr})`);
      runAutoCallbacks(makeCallFn).catch(err => console.error('[AutoCallback] Cron error:', err.message));
    }
  }, CHECK_INTERVAL_MS);

  console.log('[AutoCallback] Cron scheduled: daily at 11:00 AM IST');
}

module.exports = { runAutoCallbacks, scheduleAutoCallbackCron };
