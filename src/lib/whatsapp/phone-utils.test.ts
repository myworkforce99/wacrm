import { describe, expect, it } from 'vitest';
import {
  formatPhoneDisplay,
  isRecipientNotAllowedError,
  isValidE164,
  normalizePhone,
  parseInternationalPhone,
  phoneVariants,
  phonesMatch,
  sanitizePhoneForMeta,
} from './phone-utils';

describe('sanitizePhoneForMeta', () => {
  it('strips +, spaces, and dashes leaving only digits', () => {
    expect(sanitizePhoneForMeta('+370 639 49836')).toBe('37063949836');
    expect(sanitizePhoneForMeta('+1 (415) 555-1212')).toBe('14155551212');
  });

  it('returns an empty string for falsy input', () => {
    expect(sanitizePhoneForMeta('')).toBe('');
    expect(sanitizePhoneForMeta(undefined as unknown as string)).toBe('');
  });

  it('is idempotent on already-sanitized input', () => {
    const cleaned = '14155551212';
    expect(sanitizePhoneForMeta(cleaned)).toBe(cleaned);
  });
});

describe('normalizePhone', () => {
  it('matches sanitizePhoneForMeta byte-for-byte (shared canonical form)', () => {
    const samples = ['+370 12345', 'abc-555-DEF', '', '0044 7000 0000 0000'];
    for (const s of samples) {
      expect(normalizePhone(s)).toBe(sanitizePhoneForMeta(s));
    }
  });
});

describe('phonesMatch', () => {
  it('returns true for exact digit matches', () => {
    expect(phonesMatch('+37063949836', '37063949836')).toBe(true);
  });

  it('matches across trunk-prefix variants by libphonenumber parsing', () => {
    // Lithuanian trunk-0 variant: 3700... matches 370...
    expect(phonesMatch('370063949836', '37063949836')).toBe(true);
  });

  it('rejects mismatched numbers', () => {
    expect(phonesMatch('+37063949836', '+37063949837')).toBe(false);
  });

  it('rejects different numbers that would have false-positive collided with naive last-8 matching', () => {
    // Both end in "12345678", but have different area / provider prefixes
    expect(phonesMatch('+91 9812345678', '+91 9912345678')).toBe(false);
    expect(phonesMatch('9812345678', '9912345678')).toBe(false);
  });

  it('handles Indian mobile variations (+91, 0-prefix, 91-prefix, raw 10-digits)', () => {
    expect(phonesMatch('+91 98765 43210', '9876543210')).toBe(true);
    expect(phonesMatch('09876543210', '9876543210')).toBe(true);
    expect(phonesMatch('919876543210', '9876543210')).toBe(true);
    expect(phonesMatch('09876543210', '+919876543210')).toBe(true);
    expect(phonesMatch('+91-98765-43210', '919876543210')).toBe(true);
  });

  it('handles US and UK numbers across formatting differences', () => {
    expect(phonesMatch('+1 (415) 555-1212', '+1 415.555.1212')).toBe(true);
    expect(phonesMatch('(415) 555-1212', '+1 415-555-1212')).toBe(true);
    expect(phonesMatch('+44 7911 123456', '+44 7911 123456')).toBe(true);
  });

  it('handles short or identical test digit strings via fallback', () => {
    expect(phonesMatch('1234567', '1234567')).toBe(true);
    expect(phonesMatch('1234567', '9991234567')).toBe(false);
  });
});

describe('isValidE164', () => {
  it('accepts numbers 8–15 digits with optional + and non-zero start', () => {
    expect(isValidE164('+37063949836')).toBe(true);
    expect(isValidE164('37063949836')).toBe(true);
    expect(isValidE164('+12345678')).toBe(true);
    expect(isValidE164('+123456789012345')).toBe(true);
  });

  it('rejects numbers that start with 0 in international form', () => {
    expect(isValidE164('+0123456')).toBe(false);
    expect(isValidE164('0044700000000')).toBe(false);
  });

  it('rejects too-short and too-long inputs', () => {
    expect(isValidE164('+1234567')).toBe(false);
    expect(isValidE164('+123456')).toBe(false);
    expect(isValidE164('+1234567890123456')).toBe(false);
  });

  it('rejects strings with non-digit characters', () => {
    expect(isValidE164('+1-415-555-1212')).toBe(false);
    expect(isValidE164('+1 4155551212')).toBe(false);
    expect(isValidE164('abc12345678')).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isValidE164('')).toBe(false);
  });
});

describe('parseInternationalPhone', () => {
  it('returns canonical E.164 form for international + numbers, tolerating formatting', () => {
    expect(parseInternationalPhone('+14155551212')).toBe('+14155551212');
    expect(parseInternationalPhone('+1 (415) 555-1212')).toBe('+14155551212');
    expect(parseInternationalPhone('  +370 639.49836 ')).toBe('+37063949836');
    expect(parseInternationalPhone('+44 7911 123456')).toBe('+447911123456');
  });

  it('implicitly normalizes Indian mobile numbers to E.164 (+91)', () => {
    expect(parseInternationalPhone('9876543210')).toBe('+919876543210');
    expect(parseInternationalPhone('09876543210')).toBe('+919876543210');
    expect(parseInternationalPhone('919876543210')).toBe('+919876543210');
    expect(parseInternationalPhone('+91 98765 43210')).toBe('+919876543210');
  });

  it('rejects national-format numbers without country code for non-Indian formats', () => {
    expect(parseInternationalPhone('4155551212')).toBeNull(); // US national
    expect(parseInternationalPhone('2125551234')).toBeNull(); // US national
    expect(parseInternationalPhone('02079460123')).toBeNull(); // UK national (London)
    expect(parseInternationalPhone('07911123456', 'GB')).toBe('+447911123456'); // UK national when defaultCountry is GB
  });

  it('rejects digits that carry a non-Indian country code but no + (ambiguous input)', () => {
    expect(parseInternationalPhone('14155551212')).toBeNull();
    expect(parseInternationalPhone('37063949836')).toBeNull();
  });

  it('rejects a + followed by an invalid digit string', () => {
    expect(parseInternationalPhone('+0123456789')).toBeNull();
    expect(parseInternationalPhone('+1234567')).toBeNull();
    expect(parseInternationalPhone('++14155551212')).toBeNull();
    expect(parseInternationalPhone('+1415555abcd')).toBeNull();
    expect(parseInternationalPhone('+')).toBeNull();
  });

  it('returns null for empty and nullish input', () => {
    expect(parseInternationalPhone('')).toBeNull();
    expect(parseInternationalPhone('   ')).toBeNull();
    expect(parseInternationalPhone(null)).toBeNull();
    expect(parseInternationalPhone(undefined)).toBeNull();
  });
});

describe('formatPhoneDisplay', () => {
  it('formats Indian mobile numbers in clean international representation', () => {
    expect(formatPhoneDisplay('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhoneDisplay('9876543210')).toBe('+91 98765 43210');
    expect(formatPhoneDisplay('09876543210')).toBe('+91 98765 43210');
  });

  it('formats international numbers in clean international representation', () => {
    expect(formatPhoneDisplay('+14155551212')).toBe('+1 415 555 1212');
    expect(formatPhoneDisplay('+447911123456')).toBe('+44 7911 123456');
    expect(formatPhoneDisplay('+37063949836')).toBe('+370 639 49836');
  });

  it('supports national formatting mode when requested', () => {
    expect(formatPhoneDisplay('9876543210', 'IN', 'national')).toBe(
      '098765 43210'
    );
  });

  it('returns empty string for null or empty input', () => {
    expect(formatPhoneDisplay('')).toBe('');
    expect(formatPhoneDisplay(null)).toBe('');
    expect(formatPhoneDisplay(undefined)).toBe('');
  });
});

describe('phoneVariants', () => {
  it('returns an empty list for empty input', () => {
    expect(phoneVariants('')).toEqual([]);
  });

  it('always lists the original number first', () => {
    const out = phoneVariants('37063949836');
    expect(out[0]).toBe('37063949836');
  });

  it('inserts a trunk 0 after each plausible country-code length', () => {
    const out = phoneVariants('37063949836');
    expect(out).toEqual(
      expect.arrayContaining(['37063949836', '307063949836', '370063949836'])
    );
  });

  it('removes a leading 0 after the country code when present', () => {
    const out = phoneVariants('370063949836');
    expect(out).toContain('370063949836');
    expect(out).toContain('37063949836');
  });

  it('deduplicates variants that collapse to the same digits', () => {
    const out = phoneVariants('37063949836');
    expect(new Set(out).size).toBe(out.length);
  });
});

describe('isRecipientNotAllowedError', () => {
  it('matches Meta error code 131030', () => {
    expect(
      isRecipientNotAllowedError(
        '(#131030) Recipient phone number not in allowed list'
      )
    ).toBe(true);
  });

  it('matches the human-readable English variants', () => {
    expect(isRecipientNotAllowedError('not in allowed list')).toBe(true);
    expect(
      isRecipientNotAllowedError('recipient not in the allowed list')
    ).toBe(true);
    expect(isRecipientNotAllowedError('NOT IN ALLOWED LIST')).toBe(true);
  });

  it('does not false-positive on unrelated Meta errors', () => {
    expect(isRecipientNotAllowedError('(#100) Invalid parameter')).toBe(false);
    expect(isRecipientNotAllowedError('template name does not exist')).toBe(
      false
    );
    expect(isRecipientNotAllowedError('')).toBe(false);
  });
});
