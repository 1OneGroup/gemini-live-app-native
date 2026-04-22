// Unified Gemini -> server message handler. Replaces the two ~240-line
// onMessage bodies inside server.js preWarmGemini and reconnectGemini.
//
// The only real behavioral differences between the original pre-warm
// and reconnect onMessage handlers are:
//   - Pre-warm: logs latency/transcripts/tool-calls; fires opening greeting
//     from setupComplete only if _needsOpeningTrigger was set by the WS
//     handler; tracks first-audio latency.
//   - Reconnect: sets _reconnecting=false on setupComplete; adds
//     "[Gemini reconnected successfully]" transcript entry; on 1st reconnect
//     fires triggerOpeningGreeting, on 2nd+ sends CONTINUATION_CUE; suppresses
//     most console.log chatter; send_brochure uses slightly different
//     failure-result wording and does NOT fall back to call.whatsappMessageKey;
//     missing the "flush user buffer when agent starts a new turn" block.
//
// All of these are preserved exactly via `isReconnect`, so the runtime
// behavior is byte-identical to before.
'use strict';

const { WebSocket } = require('ws');
const { pcm24kToMulaw } = require('../plivo/audio-utils');
const { MAX_RECONNECTIONS, goodbyePhrases } = require('../config/constants');
const { OPENING_GREETING_CUE, CONTINUATION_CUE } = require('../prompts/runtime-cues');
const { startGeminiPing, GEMINI_SESSION_MAX_MS } = require('./keepalive');
const { handleToolCall } = require('./tools');

// Sends the opening-greeting cue as realtimeInput.text.
// Exported so server.js WS handler can call it when Plivo 'start' arrives
// after Gemini is already ready.
function triggerOpeningGreeting(session, callUuid) {
  console.log(`[Agent] Triggering opening greeting via realtimeInput.text for call ${callUuid}`);
  session._openingTriggeredAt = Date.now();
  session.ws.send(JSON.stringify({
    realtimeInput: {
      text: OPENING_GREETING_CUE
    }
  }));
}

// Creates the onMessage handler bound to a session + deps.
// ws is captured at creation time — during reconnect a *new* handler is
// created around the new ws, mirroring the original structure.
function createMessageHandler({ session, callUuid, ws, isReconnect, deps }) {
  const { store, whatsapp, hangupCall, reconnectGemini, sendAudioToGemini } = deps;

  return (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    // --- setup complete ---
    if (msg.setupComplete) {
      const elapsed = session._setupStart ? Date.now() - session._setupStart : '?';
      if (isReconnect) {
        console.log(`[Gemini] Reconnect setup complete in ${elapsed}ms for ${callUuid}`);
      } else {
        console.log(`[Gemini] Pre-warm setup complete in ${elapsed}ms`);
      }
      session.ready = true;
      if (isReconnect) session._reconnecting = false;

      startGeminiPing(session);

      // Session age warning timer
      if (isReconnect) {
        session._sessionAgeTimer = setTimeout(() => {
          console.warn(`[Gemini] Reconnected session ${callUuid} approaching 10-min limit`);
        }, GEMINI_SESSION_MAX_MS);
      } else {
        session._sessionAgeTimer = setTimeout(() => {
          console.warn(`[Gemini] Session ${callUuid} approaching 10-min limit, consider wrapping up`);
          store.addTranscript(callUuid, 'system', '[Warning: Gemini session nearing 10-minute limit]');
        }, GEMINI_SESSION_MAX_MS);
      }

      if (isReconnect) {
        store.addTranscript(callUuid, 'system', '[Gemini reconnected successfully]');
      }

      // Flush any buffered audio
      while (session.audioQueue.length > 0) {
        sendAudioToGemini(ws, session.audioQueue.shift());
      }

      if (isReconnect) {
        // On first reconnect, re-trigger greeting so user knows agent is back.
        // On subsequent reconnects, send a context cue instead of full greeting.
        if (session.plivoWs?.readyState === WebSocket.OPEN) {
          session._firstAudioSent = false;
          if (session._reconnectCount <= 1) {
            triggerOpeningGreeting(session, callUuid);
          } else {
            ws.send(JSON.stringify({
              realtimeInput: {
                text: CONTINUATION_CUE
              }
            }));
          }
        }
      } else {
        // If Plivo connected before Gemini was ready, trigger opening now
        if (session._needsOpeningTrigger && session.plivoWs?.readyState === WebSocket.OPEN) {
          session._needsOpeningTrigger = false;
          triggerOpeningGreeting(session, callUuid);
        }
      }
    }

    // --- goAway — Gemini signals imminent disconnect, reconnect proactively ---
    if (msg.goAway) {
      if (isReconnect) {
        console.warn(`[Gemini] GoAway on reconnected session ${callUuid} — proactively reconnecting`);
        store.addTranscript(callUuid, 'system', '[Gemini reconnected session ending — reconnecting proactively]');
      } else {
        console.warn(`[Gemini] GoAway received for call ${callUuid} — proactively reconnecting`);
        store.addTranscript(callUuid, 'system', '[Gemini session ending — reconnecting proactively]');
      }
      if (session.plivoWs?.readyState === WebSocket.OPEN && !session._reconnecting && session._reconnectCount < MAX_RECONNECTIONS) {
        session._reconnecting = true;
        session._reconnectCount++;
        console.log(`[Gemini] Proactive reconnect #${session._reconnectCount} for ${callUuid}`);
        reconnectGemini(session, callUuid);
      }
    }

    // --- user interruption ---
    if (msg.serverContent?.interrupted) {
      if (!isReconnect) {
        console.log('[Gemini] Interrupted by user — clearing Plivo audio');
      }
      if (session.plivoWs?.readyState === WebSocket.OPEN) {
        session.plivoWs.send(JSON.stringify({ event: 'clearAudio' }));
      }
      session.agentTranscriptBuffer = '';
    }

    // --- audio + text from Gemini -> Plivo ---
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
          // Pre-warm only: log time-to-first-audio from opening trigger
          if (!isReconnect && !session._firstAudioSent && session._openingTriggeredAt) {
            const latency = Date.now() - session._openingTriggeredAt;
            console.log(`[Timing] First audio from Gemini ${latency}ms after opening trigger (call ${callUuid})`);
            session._firstAudioSent = true;
          }
          const pcm24k = Buffer.from(part.inlineData.data, 'base64');
          const mulaw = pcm24kToMulaw(pcm24k);
          const payload = mulaw.toString('base64');
          if (session.plivoWs?.readyState === WebSocket.OPEN) {
            session.plivoWs.send(JSON.stringify({
              event: 'playAudio',
              media: { contentType: 'audio/x-mulaw', sampleRate: 8000, payload }
            }));
          }
        }
        if (part.text) {
          session.agentTextBuffer += part.text;
        }
      }
    }

    // Buffer output transcription (agent speech)
    const outTx = msg.serverContent?.outputTranscription || msg.serverContent?.output_transcription;
    if (outTx?.text) {
      session.agentTranscriptBuffer = (session.agentTranscriptBuffer || '') + outTx.text;
    }

    // Buffer input transcription (user speech)
    const inTx = msg.serverContent?.inputTranscription || msg.serverContent?.input_transcription;
    if (inTx?.text) {
      session.userTranscriptBuffer = (session.userTranscriptBuffer || '') + inTx.text;
    }

    // --- turn complete: flush buffers, auto-hangup on goodbye ---
    if (msg.serverContent?.turnComplete) {
      // Flush user transcript buffer first
      if (session.userTranscriptBuffer?.trim()) {
        if (!isReconnect) {
          console.log(`[Transcript] User: ${session.userTranscriptBuffer.trim().substring(0, 200)}`);
        }
        store.addTranscript(session.callUuid, 'user', session.userTranscriptBuffer.trim());
        session.userTranscriptBuffer = '';
      }
      // Flush agent transcript buffer
      const agentText = session.agentTranscriptBuffer?.trim() || '';
      if (agentText) {
        if (!isReconnect) {
          console.log(`[Transcript] Agent: ${agentText.substring(0, 200)}`);
        }
        store.addTranscript(session.callUuid, 'agent', agentText);
        session.agentTranscriptBuffer = '';
      }
      // Fallback: text parts from model turn
      if (session.agentTextBuffer?.trim()) {
        store.addTranscript(session.callUuid, 'agent', session.agentTextBuffer.trim());
        session.agentTextBuffer = '';
      }
      if (!isReconnect) {
        console.log('[Gemini] Turn complete');
      }

      // Auto-hangup detection
      const lower = agentText.toLowerCase();
      if (goodbyePhrases.some(p => lower.includes(p))) {
        if (!isReconnect) {
          console.log(`[Hangup] Detected closing phrase, scheduling hangup in 3s`);
        }
        if (session._hangupTimer) clearTimeout(session._hangupTimer);
        session._hangupTimer = setTimeout(() => {
          if (isReconnect) {
            console.log(`[Hangup] Auto-hanging up call ${session.callUuid} (reconnect handler)`);
          } else {
            console.log(`[Hangup] Auto-hanging up call ${session.callUuid}`);
          }
          store.addTranscript(session.callUuid, 'system', '[Call ended by agent - auto hangup]');
          hangupCall(session.callUuid);
        }, 3000);
      }
    }

    // --- token usage ---
    if (msg.usageMetadata) {
      const um = msg.usageMetadata;
      store.addTokens(session.callUuid, um.promptTokenCount || 0, um.candidatesTokenCount || um.responseTokenCount || 0);
    }

    // --- pre-warm only: flush user buffer when agent starts a new turn ---
    // Original reconnect handler was missing this block; preserve that.
    if (!isReconnect && msg.serverContent?.modelTurn && session.userTranscriptBuffer?.trim()) {
      console.log(`[Transcript] User: ${session.userTranscriptBuffer.trim().substring(0, 200)}`);
      store.addTranscript(session.callUuid, 'user', session.userTranscriptBuffer.trim());
      session.userTranscriptBuffer = '';
    }

    // --- tool calls (end_call, send_brochure) ---
    if (msg.toolCall?.functionCalls) {
      for (const fc of msg.toolCall.functionCalls) {
        handleToolCall(fc, session, ws, { store, whatsapp, hangupCall, isReconnect });
      }
    }
  };
}

module.exports = { createMessageHandler, triggerOpeningGreeting };
