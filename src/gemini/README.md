# src/gemini/

Gemini Live WebSocket session management, message routing, tool handling, and keep-alive logic.

## Files

- `session.js` — GeminiSession class; init WS, handle audio frames, close gracefully
- `setup-payload.js` — Build the initial setup message (system prompt, tools, config)
- `message-handler.js` — Route incoming Gemini messages (content, tool_use, etc.)
- `tools.js` — Tool definitions and execution (makeCall, sendBrochure, recordOutcome, etc.)
- `keepalive.js` — Heartbeat loop to detect stale connections and auto-reconnect

> **Status:** placeholder — will be populated in Phase 4. See /home/office/.claude/plans/swift-percolating-teapot.md for the full refactor plan.
