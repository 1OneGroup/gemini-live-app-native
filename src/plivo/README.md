# Plivo Integration

Bridges Plivo PSTN calls to Gemini Live audio sessions via WebSocket, handling audio codec conversion between mulaw@8k (Plivo) and PCM@16/24k (Gemini).

## Files

| File | Exports | Purpose |
|------|---------|---------|
| `audio-utils.js` | `mulawToPcm16k`, `pcm24kToMulaw`, `mulawDecodeTable`, `linearToMulaw` | Codec conversion: mulaw 8kHz ↔ PCM 16/24kHz with resampling |
| `outbound.js` | `makeCall`, `hangupCall`, `handleVoicemailDetected` | Call lifecycle: pre-warm Gemini, place Plivo call, AMD detection, hangup via REST API |
| `websocket.js` | `attachWebSocketServer`, `cleanup` | Plivo `/media-stream` WebSocket handler; bridges Plivo audio frames to Gemini Live session |

## Audio Flow

```
Plivo mulaw@8k ──> mulawToPcm16k ──> Gemini Live PCM input (16k)
Gemini Live PCM output (24k) ──> pcm24kToMulaw ──> Plivo mulaw@8k
```

## Imported by

- `/src/gemini/message-handler.js` — calls `pcm24kToMulaw` for outbound audio
- `/src/index.js` — calls `makeCall`, `hangupCall`, `handleVoicemailDetected`, `attachWebSocketServer`
