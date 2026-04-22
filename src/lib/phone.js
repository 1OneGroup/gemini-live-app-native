// Phone number normalisation — produces E.164 (+[country][number]) from raw strings.
'use strict';

/**
 * Normalise a raw phone string to E.164 format (e.g. "+919876543210").
 *
 * Rules applied (in order):
 *  1. Strip everything except digits and leading +.
 *  2. If it already starts with "+", return as-is.
 *  3. If it starts with "0", replace leading 0 with the default country code.
 *  4. If it is exactly 10 digits, prepend the default country code.
 *  5. Otherwise prepend "+" (assumes caller already has country code).
 *
 * @param {string} raw
 * @param {{ defaultCountryCode?: string }} opts
 * @returns {string}
 */
function normalizePhone(raw, { defaultCountryCode = '91' } = {}) {
  let phone = (raw || '').replace(/[^0-9+]/g, '');
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) return '+' + defaultCountryCode + phone.substring(1);
  if (phone.length === 10) return '+' + defaultCountryCode + phone;
  return '+' + phone;
}

module.exports = { normalizePhone };
