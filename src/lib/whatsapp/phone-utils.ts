import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';

export type { CountryCode };

/**
 * Sanitize phone number for Meta WhatsApp API.
 * Meta requires digits only — no + prefix, no spaces, no dashes.
 * e.g. "+370 63949836" → "37063949836"
 */
export function sanitizePhoneForMeta(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Normalize phone number by removing all non-digit characters.
 * Used for comparing phone numbers in different formats.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Validate a *stored or inbound* phone number is E.164-like: 8–15 digits
 * starting with a non-zero digit, optional + prefix.
 *
 * This is the check for digit strings we already hold — a contact row,
 * Meta's `wa_id`, a broadcast recipient — accepting the digits-only
 * form Meta uses.
 */
export function isValidE164(phone: string): boolean {
  return /^\+?[1-9]\d{7,14}$/.test(phone);
}

/**
 * Helper to parse a phone string safely using libphonenumber-js.
 */
function parsePhone(
  raw: string | null | undefined,
  defaultCountry: CountryCode = 'IN'
) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(trimmed);
    if (parsed && (parsed.isValid() || parsed.isPossible())) return parsed;
  }

  const compact = trimmed.replace(/[\s().-]/g, '');
  if (defaultCountry === 'IN') {
    if (/^[6-9]\d{9}$/.test(compact)) {
      const parsed = parsePhoneNumberFromString('+91' + compact);
      if (parsed && (parsed.isValid() || parsed.isPossible())) return parsed;
    } else if (/^0[6-9]\d{9}$/.test(compact)) {
      const parsed = parsePhoneNumberFromString('+91' + compact.slice(1));
      if (parsed && (parsed.isValid() || parsed.isPossible())) return parsed;
    } else if (/^91[6-9]\d{9}$/.test(compact)) {
      const parsed = parsePhoneNumberFromString('+' + compact);
      if (parsed && (parsed.isValid() || parsed.isPossible())) return parsed;
    }
  }

  if (!trimmed.startsWith('+')) {
    const withPlus = parsePhoneNumberFromString('+' + compact);
    if (withPlus && (withPlus.isValid() || withPlus.isPossible()))
      return withPlus;
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (parsed && parsed.isValid()) return parsed;

  return null;
}

/**
 * Parse a phone number as typed by a person or sent by an API integrator.
 *
 * Enforces explicit country code (via leading `+` or recognized Indian mobile format),
 * and returns the true E.164 format (e.g. "+919876543210" or "+14155551212") — or null.
 * Rejects ambiguous national formats without country code (issue #586).
 */
export function parseInternationalPhone(
  raw: string | null | undefined,
  defaultCountry: CountryCode = 'IN'
): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const compact = raw.trim().replace(/[\s().-]/g, '');
  if (!compact) return null;

  // If there's no '+', only allow recognized domestic formats when defaultCountry is set
  if (!compact.startsWith('+')) {
    if (defaultCountry === 'IN') {
      if (/^[6-9]\d{9}$/.test(compact)) {
        const parsed = parsePhoneNumberFromString('+91' + compact);
        return parsed && (parsed.isValid() || parsed.isPossible())
          ? parsed.format('E.164')
          : null;
      }
      if (/^0[6-9]\d{9}$/.test(compact)) {
        const parsed = parsePhoneNumberFromString('+91' + compact.slice(1));
        return parsed && (parsed.isValid() || parsed.isPossible())
          ? parsed.format('E.164')
          : null;
      }
      if (/^91[6-9]\d{9}$/.test(compact)) {
        const parsed = parsePhoneNumberFromString('+' + compact);
        return parsed && (parsed.isValid() || parsed.isPossible())
          ? parsed.format('E.164')
          : null;
      }
      // Without +, reject ambiguous national formats (e.g. 4155551212, 14155551212, 07700900123)
      return null;
    } else {
      const parsed = parsePhoneNumberFromString(compact, defaultCountry);
      return parsed && (parsed.isValid() || parsed.isPossible())
        ? parsed.format('E.164')
        : null;
    }
  }

  const parsed = parsePhoneNumberFromString(compact);
  if (parsed && (parsed.isValid() || parsed.isPossible())) {
    return parsed.format('E.164');
  }
  return null;
}

/**
 * Compare two phone numbers using libphonenumber-js to detect whether
 * they represent the same subscriber, accounting for country codes,
 * trunk prefixes (e.g. Lithuanian 3700... vs 370..., Indian 098... vs +9198...),
 * and formatting differences.
 * Eliminates naive 8-digit substring collisions.
 */
export function phonesMatch(
  phone1: string,
  phone2: string,
  defaultCountry: CountryCode = 'IN'
): boolean {
  if (!phone1 || !phone2) return false;
  let p1 = parsePhone(phone1, defaultCountry);
  let p2 = parsePhone(phone2, defaultCountry);

  // If one had country code (e.g. +1 ...) and the other had national format,
  // retry parsing the other with the known country code
  if (
    p2 &&
    (p2.isValid() || p2.isPossible()) &&
    (!p1 || (!p1.isValid() && !p1.isPossible()) || !phone1.startsWith('+'))
  ) {
    if (p2.country) {
      const p1Retry = parsePhoneNumberFromString(phone1, p2.country);
      if (p1Retry && (p1Retry.isValid() || p1Retry.isPossible())) p1 = p1Retry;
    }
  }
  if (
    p1 &&
    (p1.isValid() || p1.isPossible()) &&
    (!p2 || (!p2.isValid() && !p2.isPossible()) || !phone2.startsWith('+'))
  ) {
    if (p1.country) {
      const p2Retry = parsePhoneNumberFromString(phone2, p1.country);
      if (p2Retry && (p2Retry.isValid() || p2Retry.isPossible())) p2 = p2Retry;
    }
  }

  if (
    p1 &&
    p2 &&
    (p1.isValid() || p1.isPossible()) &&
    (p2.isValid() || p2.isPossible())
  ) {
    return p1.number === p2.number;
  }

  // Fallback: if both are identical digit strings (e.g. for non-standard test stubs)
  const d1 = normalizePhone(phone1);
  const d2 = normalizePhone(phone2);
  return !!d1 && d1 === d2;
}

/**
 * Format phone number smoothly for display.
 * Returns formatted international string (+91 98765 43210, +1 415 555 1212)
 * or national format if requested.
 */
export function formatPhoneDisplay(
  phone: string | null | undefined,
  defaultCountry: CountryCode = 'IN',
  format: 'international' | 'national' = 'international'
): string {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  const parsed = parsePhone(trimmed, defaultCountry);
  if (parsed && (parsed.isValid() || parsed.isPossible())) {
    return format === 'national'
      ? parsed.formatNational()
      : parsed.formatInternational();
  }
  return trimmed;
}

/**
 * Generate plausible phone number variants for retry when Meta's
 * sandbox rejects a number with error #131030 ("not in allowed list").
 */
export function phoneVariants(sanitized: string): string[] {
  if (!sanitized) return [];
  const seen = new Set<string>();
  const push = (v: string) => {
    if (v && !seen.has(v)) seen.add(v);
  };

  // 1. Original
  push(sanitized);

  // 2. Insert a 0 after each plausible country-code length
  for (const ccLen of [1, 2, 3]) {
    if (sanitized.length <= ccLen) continue;
    const cc = sanitized.slice(0, ccLen);
    const rest = sanitized.slice(ccLen);
    if (!rest.startsWith('0')) {
      push(cc + '0' + rest);
    }
  }

  // 3. Remove a leading 0 after each plausible country-code length
  for (const ccLen of [1, 2, 3]) {
    if (sanitized.length <= ccLen + 1) continue;
    const cc = sanitized.slice(0, ccLen);
    const rest = sanitized.slice(ccLen);
    if (rest.startsWith('0')) {
      push(cc + rest.slice(1));
    }
  }

  return [...seen];
}

/**
 * Returns true when the Meta API error indicates the recipient
 * phone number isn't in the allowed list (sandbox restriction).
 */
export function isRecipientNotAllowedError(message: string): boolean {
  return /131030|not in allowed list|not in the allowed list/i.test(message);
}
