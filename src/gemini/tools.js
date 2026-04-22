// Handlers for Gemini function calls (end_call, send_brochure).
// Previously inlined inside both preWarmGemini and reconnectGemini onMessage loops.
//
// Note on isReconnect branching: the original pre-warm and reconnect code
// had subtle divergences in logging and in the send_brochure fallbacks.
// We preserve those divergences exactly (byte-identical runtime behavior)
// via the isReconnect flag.
'use strict';

// Dispatch a single tool call. Returns nothing; side-effects via ws.send + hangupCall.
// Args:
//   fc               — the functionCall object from Gemini
//   session          — the unified session object
//   ws               — the *current* Gemini websocket (captured at call-site; important
//                      because it may have been swapped by reconnect)
//   deps.store       — call-store module
//   deps.whatsapp    — whatsapp module
//   deps.hangupCall  — hangupCall(callUuid) function
//   deps.isReconnect — preserves original per-path divergences
function handleToolCall(fc, session, ws, deps) {
  const { store, whatsapp, hangupCall, isReconnect } = deps;

  if (!isReconnect) {
    console.log(`[Gemini] Tool call: ${fc.name}`);
  }

  if (fc.name === 'end_call') {
    if (!isReconnect) {
      console.log(`[Hangup] Bot ending call ${session.callUuid}`);
    }
    store.addTranscript(session.callUuid, 'system', '[Call ended by agent]');
    ws.send(JSON.stringify({
      toolResponse: {
        functionResponses: [{
          id: fc.id,
          response: { result: 'Call ended successfully.' }
        }]
      }
    }));
    setTimeout(() => hangupCall(session.callUuid), 2000);
    return;
  }

  if (fc.name === 'send_brochure') {
    const call = store.getCall(session.callUuid);
    // Pre-warm: whatsappMessageKey on the call record overrides fc.args.project_name.
    // Reconnect: only fc.args.project_name is used. Preserving original behavior.
    const projectName = isReconnect
      ? (fc.args?.project_name || 'clermont')
      : (call?.whatsappMessageKey || fc.args?.project_name || 'clermont');
    const phone = call?.to || '';

    if (!isReconnect) {
      console.log(`[WhatsApp] Sending ${projectName} message to ${phone}`);
      store.addTranscript(session.callUuid, 'system', `[Sending ${projectName} WhatsApp message to ${phone}]`);
    }

    whatsapp.sendBrochure(phone, projectName, call?.employeeName).then(result => {
      // Pre-warm and reconnect use slightly different error-result wording.
      const successMsg = 'Brochure sent successfully via WhatsApp.';
      const failureMsg = isReconnect
        ? `Failed: ${result.error}`
        : `Failed to send: ${result.error}`;
      ws.send(JSON.stringify({
        toolResponse: {
          functionResponses: [{
            id: fc.id,
            response: { result: result.success ? successMsg : failureMsg }
          }]
        }
      }));
    }).catch(() => {
      const catchMsg = isReconnect
        ? 'Failed to send brochure.'
        : 'Failed to send brochure, but will try again later.';
      ws.send(JSON.stringify({
        toolResponse: {
          functionResponses: [{
            id: fc.id,
            response: { result: catchMsg }
          }]
        }
      }));
    });
  }
}

module.exports = { handleToolCall };
