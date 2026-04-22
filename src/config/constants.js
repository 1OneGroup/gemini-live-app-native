// Shared application constants.
'use strict';

// INR / USD exchange rate used for cost calculations throughout the app.
// Primary home: here. pricing.js re-exports it.
const USD_INR = 84;

// Maximum number of Gemini session reconnections allowed per call.
const MAX_RECONNECTIONS = 5;

// Goodbye phrases used by both the pre-warm and reconnect Gemini message handlers.
// If the agent says any of these, auto-hangup fires after a short delay.
const goodbyePhrases = [
  'shukriya aapka time', 'aapka din bahut achha ho',
  'have a good', 'have a great', 'have a wonderful', 'have a nice day',
  'thank you so much for your time', 'thank you for your time',
  'bye!', 'goodbye', 'good bye', 'bye bye',
  'alvida', 'phir milte hain', 'namaste ji',
  'call end karti', 'call end karta', 'call disconnect',
  'see you then!', 'see you soon',
];

module.exports = { USD_INR, MAX_RECONNECTIONS, goodbyePhrases };
