// Runtime prompt cues injected into Gemini sessions at key moments.
// These are the inline strings from server.js triggerOpeningGreeting() and
// reconnectGemini(). Centralised here so they can be tuned without hunting
// through the Gemini session code.
'use strict';

// Sent as realtimeInput.text once the Plivo WS connects and Gemini is ready.
// Triggers Gemini to start speaking its opening greeting immediately.
const OPENING_GREETING_CUE =
  '[The phone call has just connected. The customer has picked up. Start speaking now with your opening greeting immediately.]';

// Sent on the 2nd+ reconnect (instead of the full greeting) so Gemini resumes
// mid-conversation without re-introducing itself.
const CONTINUATION_CUE =
  '[System: The call is still ongoing. Continue the conversation naturally from where you left off. Do not re-introduce yourself or repeat your greeting.]';

// Tool description for the end_call function declaration (identical in both
// preWarmGemini and reconnectGemini setup payloads).
const END_CALL_DESCRIPTION =
  'End the phone call. You MUST call this function immediately after saying goodbye or any closing phrase. The call will NOT disconnect unless you call this function. Always call end_call after your final farewell — never just say bye without calling it.';

module.exports = { OPENING_GREETING_CUE, CONTINUATION_CUE, END_CALL_DESCRIPTION };
