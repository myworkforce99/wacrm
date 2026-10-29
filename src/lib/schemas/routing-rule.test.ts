import { describe, it, expect } from 'vitest';
import {
  LeadRoutingRuleInputSchema,
  LeadRoutingRulePatchSchema,
} from './routing-rule';

describe('LeadRoutingRuleInputSchema', () => {
  it('validates a complete routing rule payload', () => {
    const payload = {
      priority: 10,
      condition_type: 'source',
      condition_value: 'magicbricks',
      action_type: 'assign_to_agent',
      action_value: '11111111-1111-4111-a111-111111111111',
      is_active: true,
    };

    const result = LeadRoutingRuleInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(10);
      expect(result.data.condition_type).toBe('source');
      expect(result.data.condition_value).toBe('magicbricks');
      expect(result.data.action_type).toBe('assign_to_agent');
      expect(result.data.is_active).toBe(true);
    }
  });

  it('applies default priority (0) and default is_active (true)', () => {
    const payload = {
      condition_type: 'budget_gte',
      condition_value: '15000000',
      action_type: 'assign_to_role',
      action_value: 'admin',
    };

    const result = LeadRoutingRuleInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(0);
      expect(result.data.is_active).toBe(true);
    }
  });

  it('rejects invalid condition_type', () => {
    const payload = {
      condition_type: 'invalid_type',
      condition_value: 'test',
      action_type: 'assign_to_agent',
      action_value: '11111111-1111-4111-a111-111111111111',
    };

    const result = LeadRoutingRuleInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid action_type', () => {
    const payload = {
      condition_type: 'source',
      condition_value: 'test',
      action_type: 'invalid_action',
      action_value: '11111111-1111-4111-a111-111111111111',
    };

    const result = LeadRoutingRuleInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty strings for condition_value or action_value', () => {
    const payload = {
      condition_type: 'source',
      condition_value: '   ',
      action_type: 'assign_to_agent',
      action_value: '',
    };

    const result = LeadRoutingRuleInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe('LeadRoutingRulePatchSchema', () => {
  it('allows partial updates', () => {
    const result = LeadRoutingRulePatchSchema.safeParse({
      is_active: false,
      priority: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(false);
      expect(result.data.priority).toBe(5);
      expect(result.data.condition_type).toBeUndefined();
    }
  });
});
