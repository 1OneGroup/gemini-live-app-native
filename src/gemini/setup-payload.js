// Builds the `{ setup: {...} }` JSON payload sent to Gemini Live on WS connect.
// Previously duplicated in server.js preWarmGemini() and reconnectGemini().
'use strict';

const { END_CALL_DESCRIPTION } = require('../prompts/runtime-cues');

// Returns the full setup object ready for JSON.stringify + ws.send.
// `model` is the active Gemini model id (e.g. 'models/gemini-3.1-flash-live-preview').
// `systemInstruction` is the resolved prompt string (promptOverride or global default).
function buildSetupPayload({ model, systemInstruction }) {
  return {
    setup: {
      model,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }
          }
        },
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
          endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
          prefixPaddingMs: 40,
          silenceDurationMs: 300,
        },
        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
        turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
      },
      tools: [{
        functionDeclarations: [{
          name: 'end_call',
          description: END_CALL_DESCRIPTION,
        }, {
          name: 'send_brochure',
          description: 'Send a property brochure PDF to the customer via WhatsApp. Call this when the customer expresses interest and you have offered to send details or a brochure.',
          parameters: {
            type: 'OBJECT',
            properties: {
              project_name: {
                type: 'STRING',
                description: 'The real estate project name (e.g. Clermont, Mohali Heights)',
              },
            },
            required: ['project_name'],
          },
        }]
      }],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    }
  };
}

module.exports = { buildSetupPayload };
