import { describe, it, expect } from 'vitest';
import {
  ContactInputSchema,
  ContactPatchSchema,
  ContactFormSchema,
} from './contact';

describe('ContactInputSchema', () => {
  it('validates a complete contact payload', () => {
    const payload = {
      name: 'Rahul Sharma',
      phone: '+919876543210',
      email: 'rahul.sharma@example.com',
      company: 'TechCorp India',
      source: '99acres',
      other_source: '',
      location_preference: 'Indiranagar, Bangalore',
      budget_min_input: '1.5 Cr',
      budget_max_input: '2 Cr',
      configuration_preference: ['3BHK', '4BHK'],
      property_type: 'Apartment',
      intent: 'End Use',
      possession_preference: 'ready_to_move_only',
      assigned_agent_id: '11111111-1111-4111-a111-111111111111',
      stage_id: 'stage-456',
      selected_tag_ids: ['tag-1', 'tag-2'],
      note_text: 'Urgent buyer moving next month',
    };

    const result = ContactInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Rahul Sharma');
      expect(result.data.phone).toBe('+919876543210');
      expect(result.data.email).toBe('rahul.sharma@example.com');
      expect(result.data.source).toBe('99acres');
      expect(result.data.assigned_agent_id).toBe(
        '11111111-1111-4111-a111-111111111111'
      );
    }
  });

  it('validates minimal contact payload and applies defaults', () => {
    const payload = {
      phone: '+919876543210',
    };

    const result = ContactInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('Manual Entry');
      expect(result.data.property_type).toBe('all');
      expect(result.data.intent).toBe('all');
      expect(result.data.possession_preference).toBe('any');
      expect(result.data.assigned_agent_id).toBeUndefined();
      expect(result.data.configuration_preference).toEqual([]);
      expect(result.data.selected_tag_ids).toEqual([]);
    }
  });

  it('accepts null for assigned_agent_id and rejects non-UUID or unassigned sentinel', () => {
    const nullAgent = ContactInputSchema.safeParse({
      phone: '+919876543210',
      assigned_agent_id: null,
    });
    expect(nullAgent.success).toBe(true);

    const sentinelAgent = ContactInputSchema.safeParse({
      phone: '+919876543210',
      assigned_agent_id: 'unassigned',
    });
    expect(sentinelAgent.success).toBe(false);

    const nonUuid = ContactInputSchema.safeParse({
      phone: '+919876543210',
      assigned_agent_id: 'agent-123',
    });
    expect(nonUuid.success).toBe(false);
  });

  it('allows empty string or valid email', () => {
    const emptyEmail = ContactInputSchema.safeParse({
      phone: '+919876543210',
      email: '',
    });
    expect(emptyEmail.success).toBe(true);

    const validEmail = ContactInputSchema.safeParse({
      phone: '+919876543210',
      email: 'buyer@test.com',
    });
    expect(validEmail.success).toBe(true);

    const invalidEmail = ContactInputSchema.safeParse({
      phone: '+919876543210',
      email: 'not-an-email',
    });
    expect(invalidEmail.success).toBe(false);
  });

  it('rejects missing or too short phone number', () => {
    const missing = ContactInputSchema.safeParse({});
    expect(missing.success).toBe(false);

    const tooShort = ContactInputSchema.safeParse({
      phone: '12345',
    });
    expect(tooShort.success).toBe(false);
  });
});

describe('ContactFormSchema', () => {
  it('requires name for manual form entry', () => {
    const noName = ContactFormSchema.safeParse({
      phone: '+919876543210',
    });
    expect(noName.success).toBe(false);

    const emptyName = ContactFormSchema.safeParse({
      name: '   ',
      phone: '+919876543210',
    });
    expect(emptyName.success).toBe(false);

    const valid = ContactFormSchema.safeParse({
      name: 'Priya Patel',
      phone: '+919876543210',
    });
    expect(valid.success).toBe(true);
  });
});

describe('ContactPatchSchema', () => {
  it('allows partial contact updates', () => {
    const result = ContactPatchSchema.safeParse({
      location_preference: 'Whitefield',
      budget_max_input: '3 Cr',
    });
    expect(result.success).toBe(true);
  });
});
