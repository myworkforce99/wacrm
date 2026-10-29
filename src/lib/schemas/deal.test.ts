import { describe, it, expect } from 'vitest';
import { DealInputSchema, DealPatchSchema, DealFormSchema } from './deal';

describe('DealInputSchema', () => {
  it('validates a valid complete deal payload', () => {
    const payload = {
      title: '3BHK Penthouse Purchase',
      value: 17500000,
      currency: 'INR',
      stage_id: 'stage-123',
      contact_id: 'contact-456',
      assigned_to: 'agent-789',
      notes: 'Buyer has pre-approved home loan with HDFC.',
      expected_close_date: '2026-12-15',
    };

    const result = DealInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('3BHK Penthouse Purchase');
      expect(result.data.currency).toBe('INR');
      expect(result.data.stage_id).toBe('stage-123');
      expect(result.data.contact_id).toBe('contact-456');
    }
  });

  it('validates minimal payload and applies default currency', () => {
    const payload = {
      title: 'Commercial Retail Shop',
      stage_id: 'stage-1',
      contact_id: 'contact-1',
    };

    const result = DealInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('INR');
    }
  });

  it('trims title whitespace', () => {
    const payload = {
      title: '   Luxury Villa Deal   ',
      stage_id: 'stage-1',
      contact_id: 'contact-1',
    };

    const result = DealInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Luxury Villa Deal');
    }
  });

  it('rejects missing or empty title', () => {
    const missing = DealInputSchema.safeParse({
      stage_id: 'stage-1',
      contact_id: 'contact-1',
    });
    expect(missing.success).toBe(false);

    const empty = DealInputSchema.safeParse({
      title: '   ',
      stage_id: 'stage-1',
      contact_id: 'contact-1',
    });
    expect(empty.success).toBe(false);
  });

  it('rejects title exceeding 200 characters', () => {
    const longTitle = 'a'.repeat(201);
    const result = DealInputSchema.safeParse({
      title: longTitle,
      stage_id: 'stage-1',
      contact_id: 'contact-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing contact_id or stage_id', () => {
    const noContact = DealInputSchema.safeParse({
      title: 'Deal A',
      stage_id: 'stage-1',
    });
    expect(noContact.success).toBe(false);

    const noStage = DealInputSchema.safeParse({
      title: 'Deal B',
      contact_id: 'contact-1',
    });
    expect(noStage.success).toBe(false);
  });
});

describe('DealPatchSchema', () => {
  it('allows partial updates with only stage_id', () => {
    const result = DealPatchSchema.safeParse({
      stage_id: 'stage-next',
    });
    expect(result.success).toBe(true);
  });

  it('allows partial updates with numeric value', () => {
    const result = DealPatchSchema.safeParse({
      value: 25000000,
      notes: 'Client negotiated final price.',
    });
    expect(result.success).toBe(true);

    // String number coerces
    const coerced = DealPatchSchema.safeParse({
      value: '25000000',
    });
    expect(coerced.success).toBe(true);
    if (coerced.success) {
      expect(coerced.data.value).toBe(25000000);
    }

    // Non-numeric string is rejected
    const nonNumeric = DealPatchSchema.safeParse({
      value: '2.5 Cr',
    });
    expect(nonNumeric.success).toBe(false);
  });

  it('validates lifecycle fields and requires lost_reason_id for lost status', () => {
    const validLost = DealPatchSchema.safeParse({
      status: 'lost',
      lost_reason_id: '11111111-1111-4111-a111-111111111111',
      lost_note: 'Found cheaper competitor deal',
      re_engage_on: '2026-12-01',
    });
    expect(validLost.success).toBe(true);

    const missingReason = DealPatchSchema.safeParse({
      status: 'lost',
    });
    expect(missingReason.success).toBe(false);

    const invalidReasonUuid = DealPatchSchema.safeParse({
      status: 'lost',
      lost_reason_id: 'not-a-uuid',
    });
    expect(invalidReasonUuid.success).toBe(false);

    // re_engage_on must be YYYY-MM-DD (DATE column), not datetime
    const datetimeReEngage = DealPatchSchema.safeParse({
      re_engage_on: '2026-12-01T10:00:00Z',
    });
    expect(datetimeReEngage.success).toBe(false);
  });
});

describe('DealFormSchema', () => {
  it('allows string representation of value for formatted currency input', () => {
    const result = DealFormSchema.safeParse({
      title: 'Luxury Villa',
      value: '2.5 Cr',
      currency: 'INR',
      stage_id: 'stage-1',
      contact_id: 'contact-1',
    });
    expect(result.success).toBe(true);
  });
});
