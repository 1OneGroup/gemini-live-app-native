# gemini/

Core Gemini Live WebSocket session management, message handling, and tool invocation for AI voice calls.

## Files

| File | Exports | Purpose |
|---|---|---|
| `session.js` | `createGeminiSession()`, `sendAudioToGemini()`, `triggerOpeningGreeting()`, `pendingSessions`, `sessions` | Unified session factory replacing pre-warm and reconnect paths; manages WS lifecycle, setup, and state ownership |
| `setup-payload.js` | `buildSetupPayload()` | Constructs the `{ setup: ... }` JSON for Gemini Live (model config, voice, system instruction, tools, audio transcription) |
| `message-handler.js` | `createMessageHandler()`, `triggerOpeningGreeting()` | Unified onMessage handler; routes audio to Plivo, buffers transcripts, detects turn-complete, auto-hangup, and tool calls |
| `tools.js` | `handleToolCall()` | Dispatches `end_call` and `send_brochure` function calls from Gemini; preserves original pre-warm/reconnect divergences |
| `keepalive.js` | `startGeminiPing()`, `startPlivoPing()`, `startStaleSessionSweep()` | Ping handlers (15s interval) for WS keep-alive; sweeper removes pre-warmed sessions idle >2 minutes |

## Reconnect behavior

Set `isReconnect: true` and pass `existingSession` to `createGeminiSession()` to resume after a Gemini WS drop. Reconnect preserves transcript, token counters, and Plivo streamSid; does **not** fire the opening greeting on first reconnect (triggers it instead if Plivo was not yet connected), and sends a `CONTINUATION_CUE` on 2nd+ reconnects.

## Imported by

- `/home/office/gemini-live-app-native/src/index.js`
- `/home/office/gemini-live-app-native/src/plivo/outbound.js`
- `/home/office/gemini-live-app-native/src/plivo/websocket.js`
