import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  dedupeByPhone,
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  normalizeKey,
} from './dedupe';

describe('normalizeKey', () => {
  it('strips every non-digit', () => {
    expect(normalizeKey('+1 (415) 555-0123')).toBe('14155550123');
    expect(normalizeKey('14155550123')).toBe('14155550123');
  });

  it('collapses different formats of the same number to one key', () => {
    expect(normalizeKey('+44 7911 123456')).toBe(normalizeKey('447911123456'));
  });
});

describe('isExactMatch', () => {
  it('treats different formatting of the same digits as exact', () => {
    expect(
      isExactMatch({ id: '1', phone: '+1 (415) 555-0123' }, '14155550123')
    ).toBe(true);
  });

  it('is false for a trunk-variant (fuzzy) match', () => {
    expect(
      isExactMatch({ id: '1', phone: '37063949836' }, '370063949836')
    ).toBe(false);
  });
});

describe('isUniqueViolation', () => {
  it('detects Postgres 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });
  it('is false for other errors / non-objects', () => {
    expect(isUniqueViolation({ code: '23502' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('boom')).toBe(false);
  });
});

describe('dedupeByPhone', () => {
  it('keeps the first occurrence and counts in-file duplicates', () => {
    const { unique, duplicates } = dedupeByPhone([
      { phone: '+1 415 555-0101', name: 'A' },
      { phone: '+1 (415) 555-0101', name: 'B' }, // duplicate of A
      { phone: '+1 415 555-0102', name: 'C' },
    ]);
    expect(unique.map((r) => r.name)).toEqual(['A', 'C']);
    expect(duplicates).toBe(1);
  });

  it('collapses Indian mobile numbers across leading 0, 91, and +91 variants', () => {
    const { unique, duplicates, invalid } = dedupeByPhone([
      { phone: '+91 98765 43210', name: 'Lead 1 (+91)' },
      { phone: '9876543210', name: 'Lead 1 (10-digit)' }, // dupe
      { phone: '09876543210', name: 'Lead 1 (0-prefix)' }, // dupe
      { phone: '919876543210', name: 'Lead 1 (91-prefix)' }, // dupe
      { phone: '+91 98765 99999', name: 'Lead 2' },
    ]);
    expect(unique.map((r) => r.name)).toEqual(['Lead 1 (+91)', 'Lead 2']);
    expect(duplicates).toBe(3);
    expect(invalid).toBe(0);
  });

  it('drops rows without a leading + (no country code) for non-Indian numbers', () => {
    const { unique, duplicates, invalid } = dedupeByPhone([
      { phone: '4155551212', name: 'national' },
      { phone: '+14155551212', name: 'international' },
      { phone: '14155551212', name: 'digits with CC but no +' },
    ]);
    expect(unique.map((r) => r.name)).toEqual(['international']);
    expect(duplicates).toBe(0);
    expect(invalid).toBe(2);
  });

  it('drops rows with no digits, counted as invalid rather than duplicate', () => {
    const { unique, duplicates, invalid } = dedupeByPhone([
      { phone: '   ' },
      { phone: '+1 415 555-0103' },
    ]);
    expect(unique).toHaveLength(1);
    expect(duplicates).toBe(0);
    expect(invalid).toBe(1);
  });
});

describe('findExistingContact', () => {
  function stubDb(rows: Array<{ id: string; phone: string }>): SupabaseClient {
    const builder = {
      select: () => builder,
      eq: () => builder,
      like: () => Promise.resolve({ data: rows, error: null }),
    };
    return { from: () => builder } as unknown as SupabaseClient;
  }

  it('returns a trunk-variant match via phonesMatch', async () => {
    const db = stubDb([{ id: 'c1', phone: '37063949836' }]);
    const hit = await findExistingContact(db, 'acct', '+370 063 949 836');
    expect(hit?.id).toBe('c1');
  });

  it('returns an Indian mobile match across 0-prefix and +91', async () => {
    const db = stubDb([{ id: 'c2', phone: '+91 98765 43210' }]);
    const hit = await findExistingContact(db, 'acct', '09876543210');
    expect(hit?.id).toBe('c2');
  });

  it('returns null when no candidate matches', async () => {
    const db = stubDb([{ id: 'c1', phone: '14155559999' }]);
    const hit = await findExistingContact(db, 'acct', '+1 415 555-0123');
    expect(hit).toBeNull();
  });

  it('returns null for an empty phone without querying', async () => {
    const db = stubDb([{ id: 'c1', phone: '14155550123' }]);
    expect(await findExistingContact(db, 'acct', '   ')).toBeNull();
  });
});
