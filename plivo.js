// plivo.js — Plivo REST API integration
// Fetches call recordings and returns normalized lead objects

require('dotenv').config();
const plivo = require('plivo');

// Initialize Plivo client with credentials from .env
const client = new plivo.Client(
  process.env.PLIVO_AUTH_ID,
  process.env.PLIVO_AUTH_TOKEN
);

/**
 * Fetches call recordings from Plivo and returns an array of normalized call objects.
 * Only returns calls that have recordings attached.
 * @returns {Promise<Array>} Array of call objects ready to be saved as leads
 */
async function fetchNewCalls() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Fetching call recordings from Plivo...`);

  try {
    // Fetch calls that have recordings — Plivo CDR API
    // client.calls.list() returns a paginated resource; actual records are in .objects
    const callsResponse = await client.calls.list({
      has_recording: true,
      limit: 20,
      offset: 0
    });

    // Guard: .objects may not exist if no calls found
    const calls = Array.isArray(callsResponse) ? [...callsResponse] : [];

    if (calls.length === 0) {
      console.log(`[${timestamp}] No calls with recordings found in Plivo.`);
      return [];
    }

    console.log(`[${timestamp}] Found ${calls.length} call(s) with recordings.`);

    // Normalize each call into a lead-ready object
    const normalized = [];

    for (const call of calls) {
      try {
        // Fetch the recording URL for this specific call
        const recordingUrl = await getRecordingUrl(call.callUuid);

        if (!recordingUrl) {
          console.warn(`[${timestamp}] No recording URL found for call ${call.callUuid}, skipping.`);
          continue;
        }

        normalized.push({
          plivoCallUuid: call.callUuid,
          // Use the caller's number for inbound calls, or the callee for outbound
          phone: call.callDirection === 'inbound' ? call.fromNumber : call.toNumber,
          callDate: call.initiationTime || new Date().toISOString(),
          callDuration: parseInt(call.callDuration, 10) || 0,
          recordingUrl: recordingUrl,
          direction: call.callDirection || 'unknown'
        });
      } catch (err) {
        console.error(`[${timestamp}] Error processing call ${call.callUuid}:`, err.message);
        // Continue processing remaining calls even if one fails
      }
    }

    console.log(`[${timestamp}] Successfully normalized ${normalized.length} call(s).`);
    return normalized;

  } catch (err) {
    console.error(`[${timestamp}] Plivo API error:`, err.message);
    throw new Error(`Failed to fetch calls from Plivo: ${err.message}`);
  }
}

/**
 * Fetches the recording URL for a specific call UUID.
 * @param {string} callUuid - The Plivo call UUID
 * @returns {Promise<string|null>} The recording URL or null if not found
 */
async function getRecordingUrl(callUuid) {
  try {
    const recordingsResponse = await client.recordings.list({
      call_uuid: callUuid,
      limit: 1
    });

    const recordings = Array.isArray(recordingsResponse) ? [...recordingsResponse] : [];

    if (recordings.length === 0) return null;

    // Return the first recording URL (most recent)
    return recordings[0].recordingUrl || null;
  } catch (err) {
    console.error(`Error fetching recording for call ${callUuid}:`, err.message);
    return null;
  }
}

module.exports = { fetchNewCalls };
