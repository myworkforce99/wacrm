import { describe, it, expect } from 'vitest';
import { SiteVisitInputSchema, SiteVisitPatchSchema } from './site-visit';

describe('SiteVisitInputSchema', () => {
  const validContactId = '11111111-1111-4111-a111-111111111111';
  const validPropertyId = '22222222-2222-4222-a222-222222222222';

  it('validates a complete valid site visit payload', () => {
    const payload = {
      contact_id: validContactId,
      property_id: validPropertyId,
      scheduled_at: '2026-11-15T14:30:00Z',
      status: 'confirmed',
      notes: 'Customer interested in 3BHK higher floor',
      pickup_required: true,
      pickup_location: 'Indiranagar Metro Station Gate 2',
    };

    const result = SiteVisitInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contact_id).toBe(validContactId);
      expect(result.data.status).toBe('confirmed');
      expect(result.data.pickup_required).toBe(true);
    }
  });

  it('accepts ISO datetime with timezone offset (+05:30)', () => {
    const result = SiteVisitInputSchema.safeParse({
      scheduled_at: '2026-11-15T10:00:00+05:30',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
      expect(result.data.pickup_required).toBe(false);
    }
  });

  it('allows missing or null scheduled_at', () => {
    const missing = SiteVisitInputSchema.safeParse({
      contact_id: validContactId,
    });
    expect(missing.success).toBe(true);

    const nullable = SiteVisitInputSchema.safeParse({
      contact_id: validContactId,
      scheduled_at: null,
    });
    expect(nullable.success).toBe(true);
    if (nullable.success) {
      expect(nullable.data.scheduled_at).toBeNull();
    }
  });

  it('rejects malformed datetime string', () => {
    const badStrings = ['tomorrow at 3pm', '2026-13-45', 'not-a-date'];
    for (const bad of badStrings) {
      const result = SiteVisitInputSchema.safeParse({
        scheduled_at: bad,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Must be a valid ISO datetime'
        );
      }
    }
  });

  it('rejects invalid status enum with custom error message', () => {
    const result = SiteVisitInputSchema.safeParse({
      scheduled_at: '2026-11-15T14:30:00Z',
      status: 'cancelled_by_user' as unknown as 'pending',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Invalid status');
    }
  });

  it('rejects invalid UUID format for contact_id and property_id', () => {
    const badContact = SiteVisitInputSchema.safeParse({
      contact_id: 'non-uuid-contact-id',
      scheduled_at: '2026-11-15T14:30:00Z',
    });
    expect(badContact.success).toBe(false);
    if (!badContact.success) {
      expect(badContact.error.issues[0]?.message).toBe(
        'contact_id must be a valid UUID'
      );
    }

    const badProp = SiteVisitInputSchema.safeParse({
      property_id: 'bad-prop-123',
      scheduled_at: '2026-11-15T14:30:00Z',
    });
    expect(badProp.success).toBe(false);
    if (!badProp.success) {
      expect(badProp.error.issues[0]?.message).toBe(
        'property_id must be a valid UUID'
      );
    }
  });
});

describe('SiteVisitPatchSchema', () => {
  it('allows partial update without scheduled_at', () => {
    const result = SiteVisitPatchSchema.safeParse({
      status: 'completed',
      notes: 'Client made a token advance',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('completed');
    }
  });

  it('allows setting nullable fields to null', () => {
    const result = SiteVisitPatchSchema.safeParse({
      notes: null,
      pickup_location: null,
      property_id: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed datetime if provided in patch', () => {
    const result = SiteVisitPatchSchema.safeParse({
      scheduled_at: 'invalid-iso-date',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Must be a valid ISO datetime'
      );
    }
  });
});
