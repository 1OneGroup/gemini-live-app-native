# src/plivo/

Plivo PSTN integration — inbound call handling, outbound call initiation, audio I/O, and WebSocket bridge to Gemini Live.

## Files

- `websocket.js` — WebSocket server for Plivo audio streams, frame buffering, heartbeat
- `outbound.js` — Make outbound calls via Plivo API, handle callbacks, retry logic
- `audio-utils.js` — Encode/decode audio frames, handle Plivo's mulaw format

> **Status:** placeholder — will be populated in Phase 7. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
