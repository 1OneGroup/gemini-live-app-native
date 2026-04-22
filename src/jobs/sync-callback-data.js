// src/jobs/sync-callback-data.js
// Syncs in-memory call-store callback/outcome data to the DB contacts table.
// Called once at startup (after a short delay) to catch any data that was
// written to the call store during a previous run but not yet persisted.

const db = require('../../db');
const store = require('../../call-store');

async function syncCallbackData() {
  const allCalls = store.listCalls();
  let synced = 0;
  for (const call of allCalls) {
    if (!call.callUuid) continue;
    let fullCall = store.getCall(call.callUuid);
    if (!fullCall) continue;

    // Re-classify if outcome was set before multi-outcome support
    if (fullCall.outcome && !fullCall.outcome.includes(',')) {
      const oldOutcome = fullCall.outcome;
      store.updateCall(call.callUuid, { outcome: null });
      store.classifyCallOutcome(call.callUuid);
      fullCall = store.getCall(call.callUuid);
      if (fullCall.outcome && fullCall.outcome !== oldOutcome) {
        console.log(`[Sync] Re-classified ${call.callUuid}: ${oldOutcome} -> ${fullCall.outcome}`);
      }
    }

    // Re-extract callback timing if outcome has callback but no callbackDate
    if (fullCall.outcome && fullCall.outcome.includes('callback') && !fullCall.callbackDate) {
      // Re-run classification to extract callback timing
      store.updateCall(call.callUuid, { outcome: null, callbackRequested: null, callbackDate: null });
      store.classifyCallOutcome(call.callUuid);
      fullCall = store.getCall(call.callUuid);
      if (fullCall.callbackDate) {
        console.log(`[Sync] Extracted callback timing for ${call.callUuid}: ${fullCall.callbackRequested} -> ${fullCall.callbackDate}`);
      }
    }

    // Sync callback/outcome data to matching DB contacts
    try {
      const contacts = await db.rawQuery('SELECT id, outcome, callback_date FROM contacts WHERE call_uuid = $1', [call.callUuid]);
      for (const contact of contacts) {
        const needsOutcomeUpdate = fullCall.outcome && fullCall.outcome !== contact.outcome;
        const needsCallbackUpdate = (fullCall.callbackDate || fullCall.callbackRequested) && !contact.callback_date;
        if (needsOutcomeUpdate || needsCallbackUpdate) {
          await db.rawExecute('UPDATE contacts SET outcome = $1, callback_date = $2, callback_note = $3 WHERE id = $4',
            [fullCall.outcome || contact.outcome, fullCall.callbackDate || null, fullCall.callbackRequested || null, contact.id]);
          synced++;
        }
      }
    } catch {}
  }
  if (synced > 0) console.log(`[Sync] Updated ${synced} contact(s) with callback/outcome data from call store`);
}

module.exports = { syncCallbackData };
