import { describe, it, expect } from 'vitest';
import {
  PropertyInputSchema,
  PropertyPatchSchema,
  PropertyFormSchema,
} from './property';

describe('PropertyInputSchema', () => {
  it('validates a complete valid property payload', () => {
    const payload = {
      title: 'Palm Grove Residency',
      location: 'Whitefield, Bangalore',
      price: 12500000,
      property_type: 'Apartment',
      bedrooms: 3,
      tags: ['luxury', 'gated-community'],
      configuration: '3BHK',
      builder_name: 'Prestige Group',
      project_name: 'Palm Grove Phase 2',
      rera_id: 'PRM/KA/RERA/1251/310/PR/170915/000123',
      possession_status: 'under_construction',
      possession_date: '2027-12-31',
      carpet_area: 1450.5,
      facing: 'East',
    };

    const result = PropertyInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Palm Grove Residency');
      expect(result.data.price).toBe(12500000);
      expect(result.data.carpet_area).toBe(1450.5);
    }
  });

  it('validates a minimal property payload with only title', () => {
    const payload = {
      title: 'Ocean View Villa',
    };

    const result = PropertyInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('trims whitespace on title', () => {
    const result = PropertyInputSchema.safeParse({
      title: '   Green Valley   ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Green Valley');
    }
  });

  it('rejects missing or empty title', () => {
    const missing = PropertyInputSchema.safeParse({});
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.message).toMatch(/'title' is required/i);
    }

    const empty = PropertyInputSchema.safeParse({ title: '   ' });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0]?.message).toMatch(/'title' is required/i);
    }
  });

  it('rejects negative price', () => {
    const result = PropertyInputSchema.safeParse({
      title: 'Sunrise Apartments',
      price: -500,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Price cannot be negative');
    }
  });

  it('rejects non-numeric price', () => {
    const result = PropertyInputSchema.safeParse({
      title: 'Sunrise Apartments',
      price: 'expensive' as unknown as number,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Price must be a number');
    }
  });

  it('rejects non-integer or negative bedrooms', () => {
    const floatBeds = PropertyInputSchema.safeParse({
      title: 'Sky Tower',
      bedrooms: 2.5,
    });
    expect(floatBeds.success).toBe(false);
    if (!floatBeds.success) {
      expect(floatBeds.error.issues[0]?.message).toBe(
        'Bedrooms must be an integer'
      );
    }

    const negBeds = PropertyInputSchema.safeParse({
      title: 'Sky Tower',
      bedrooms: -1,
    });
    expect(negBeds.success).toBe(false);
    if (!negBeds.success) {
      expect(negBeds.error.issues[0]?.message).toBe(
        'Bedrooms cannot be negative'
      );
    }
  });

  it('rejects zero or negative carpet area', () => {
    const zero = PropertyInputSchema.safeParse({
      title: 'Sky Tower',
      carpet_area: 0,
    });
    expect(zero.success).toBe(false);
    if (!zero.success) {
      expect(zero.error.issues[0]?.message).toBe(
        'Carpet area must be positive'
      );
    }

    const negative = PropertyInputSchema.safeParse({
      title: 'Sky Tower',
      carpet_area: -100,
    });
    expect(negative.success).toBe(false);
  });

  it('rejects unknown property_type, possession_status, and facing direction', () => {
    const invalidType = PropertyInputSchema.safeParse({
      title: 'Sky Tower',
      property_type: 'Igloo' as unknown as 'Apartment',
    });
    expect(invalidType.success).toBe(false);

    const invalidStatus = PropertyInputSchema.safeParse({
      title: 'Sky Tower',
      possession_status: 'demolished' as unknown as 'ready_to_move',
    });
    expect(invalidStatus.success).toBe(false);

    const invalidFacing = PropertyInputSchema.safeParse({
      title: 'Sky Tower',
      facing: 'Upward' as unknown as 'East',
    });
    expect(invalidFacing.success).toBe(false);
  });
});

describe('PropertyFormSchema', () => {
  it('allows property_type and possession_status to be optional', () => {
    const result = PropertyFormSchema.safeParse({
      title: 'Green Meadows',
      facing: 'East',
    });
    expect(result.success).toBe(true);
  });
});

describe('PropertyPatchSchema', () => {
  it('allows empty object for patch', () => {
    const result = PropertyPatchSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('allows partial fields update and nullable fields', () => {
    const result = PropertyPatchSchema.safeParse({
      price: 20000000,
      location: null,
      facing: 'North-East',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(20000000);
      expect(result.data.location).toBeNull();
    }
  });

  it('still enforces field constraints if provided in patch', () => {
    const emptyTitle = PropertyPatchSchema.safeParse({
      title: '   ',
    });
    expect(emptyTitle.success).toBe(false);

    const negPrice = PropertyPatchSchema.safeParse({
      price: -1000,
    });
    expect(negPrice.success).toBe(false);
  });
});
