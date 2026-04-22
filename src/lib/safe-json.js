// Safe JSON parse — returns fallback instead of throwing on invalid input.
'use strict';

/**
 * Parse a JSON string without throwing.
 * @param {string|null|undefined} str  - Input to parse.
 * @param {*} fallback                 - Value to return on error (default null).
 * @returns {*}
 */
function safeJsonParse(str, fallback = null) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = { safeJsonParse };
