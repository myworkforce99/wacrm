import { describe, it, expect } from 'vitest';
import {
  NormalizedPortalLeadSchema,
  NinetyNineAcresPayloadSchema,
  MagicBricksPayloadSchema,
  HousingComPayloadSchema,
  NoBrokerPayloadSchema,
  MetaLeadAdsPayloadSchema,
  normalizePortalPayload,
} from './portal-lead';

describe('Portal Lead Schemas', () => {
  describe('99acres', () => {
    it('parses and normalizes 99acres lead payload', () => {
      const raw = {
        name: 'Vikram Mehta',
        phone: '+919876543210',
        email: 'vikram@example.com',
        projName: 'Palm Heights Phase 1',
        location: 'Whitefield, Bangalore',
        query: 'Looking for 3BHK ready to move',
      };

      const parsed = NinetyNineAcresPayloadSchema.safeParse(raw);
      expect(parsed.success).toBe(true);

      const normalized = normalizePortalPayload('99acres', raw);
      expect(normalized).toEqual({
        name: 'Vikram Mehta',
        phone: '+919876543210',
        email: 'vikram@example.com',
        source: '99acres',
        project_name: 'Palm Heights Phase 1',
        location_preference: 'Whitefield, Bangalore',
        notes: 'Looking for 3BHK ready to move',
      });
    });

    it('rejects 99acres payload without phone', () => {
      const raw = {
        name: 'Vikram Mehta',
      };
      expect(() => normalizePortalPayload('99acres', raw)).toThrow();
    });
  });

  describe('MagicBricks', () => {
    it('parses and normalizes MagicBricks lead payload with mobile key', () => {
      const raw = {
        name: 'Pooja Sharma',
        mobile: '+919123456789',
        email: 'pooja@example.com',
        project: 'Sobha Dream Acres',
        message: 'Interested in site visit this Saturday',
        city: 'Bangalore',
      };

      const parsed = MagicBricksPayloadSchema.safeParse(raw);
      expect(parsed.success).toBe(true);

      const normalized = normalizePortalPayload('MagicBricks', raw);
      expect(normalized.source).toBe('MagicBricks');
      expect(normalized.phone).toBe('+919123456789');
      expect(normalized.project_name).toBe('Sobha Dream Acres');
      expect(normalized.notes).toBe('Interested in site visit this Saturday');
      expect(normalized.location_preference).toBe('Bangalore');
    });
  });

  describe('Housing.com', () => {
    it('parses and normalizes Housing.com lead payload with lead_phone key', () => {
      const raw = {
        lead_name: 'Amit Kumar',
        lead_phone: '+919988776655',
        lead_email: 'amit@example.com',
        property_title: 'Godrej Woods',
        city: 'Noida',
        notes: '2BHK preferred budget 1 Cr',
      };

      const parsed = HousingComPayloadSchema.safeParse(raw);
      expect(parsed.success).toBe(true);

      const normalized = normalizePortalPayload('Housing.com', raw);
      expect(normalized.source).toBe('Housing.com');
      expect(normalized.name).toBe('Amit Kumar');
      expect(normalized.phone).toBe('+919988776655');
      expect(normalized.project_name).toBe('Godrej Woods');
      expect(normalized.location_preference).toBe('Noida');
    });
  });

  describe('NoBroker', () => {
    it('parses and normalizes NoBroker lead payload with contact_number key', () => {
      const raw = {
        customer_name: 'Deepak Rao',
        contact_number: '+919888877777',
        email_id: 'deepak@example.com',
        locality: 'HSR Layout',
        property_type: 'Villa',
      };

      const parsed = NoBrokerPayloadSchema.safeParse(raw);
      expect(parsed.success).toBe(true);

      const normalized = normalizePortalPayload('NoBroker', raw);
      expect(normalized.source).toBe('NoBroker');
      expect(normalized.name).toBe('Deepak Rao');
      expect(normalized.phone).toBe('+919888877777');
      expect(normalized.property_type).toBe('Villa');
      expect(normalized.location_preference).toBe('HSR Layout');
    });
  });

  describe('MetaLeadAds', () => {
    it('parses and normalizes Meta Lead Ads payload', () => {
      const raw = {
        full_name: 'Kavita Nair',
        phone_number: '+919777766666',
        email: 'kavita@example.com',
        bhk: '3BHK',
        form_id: 'meta_form_456',
      };

      const parsed = MetaLeadAdsPayloadSchema.safeParse(raw);
      expect(parsed.success).toBe(true);

      const normalized = normalizePortalPayload('MetaLeadAds', raw);
      expect(normalized.source).toBe('MetaLeadAds');
      expect(normalized.name).toBe('Kavita Nair');
      expect(normalized.phone).toBe('+919777766666');
      expect(normalized.configuration).toBe('3BHK');
      expect(normalized.notes).toBe('Form ID: meta_form_456');
    });
  });

  describe('NormalizedPortalLeadSchema generic validation', () => {
    it('validates a generic lead payload', () => {
      const generic = {
        name: 'John Doe',
        phone: '+14155552671',
        email: 'john@example.com',
        source: 'Website',
        budget_min: 5000000,
        budget_max: 7500000,
      };

      const parsed = NormalizedPortalLeadSchema.safeParse(generic);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid email format when email is present', () => {
      const invalidEmail = {
        phone: '+14155552671',
        email: 'not-an-email',
      };

      const parsed = NormalizedPortalLeadSchema.safeParse(invalidEmail);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe('Invalid email address');
      }
    });

    it('allows empty string for email', () => {
      const emptyEmail = {
        phone: '+14155552671',
        email: '',
      };

      const parsed = NormalizedPortalLeadSchema.safeParse(emptyEmail);
      expect(parsed.success).toBe(true);
    });
  });
});
