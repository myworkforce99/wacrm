import { describe, it, expect } from 'vitest';
import { AgentTargetInputSchema, AgentTargetPatchSchema } from './agent-target';

describe('AgentTargetInputSchema', () => {
  it('validates a complete agent target payload', () => {
    const payload = {
      agent_id: '11111111-1111-4111-a111-111111111111',
      period_start: '2026-11-01',
      period_end: '2026-11-30',
      target_visits: 25,
      target_bookings: 5,
    };

    const result = AgentTargetInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agent_id).toBe('11111111-1111-4111-a111-111111111111');
      expect(result.data.period_start).toBe('2026-11-01');
      expect(result.data.period_end).toBe('2026-11-30');
      expect(result.data.target_visits).toBe(25);
      expect(result.data.target_bookings).toBe(5);
    }
  });

  it('coerces string numbers and applies defaults for visits and bookings', () => {
    const payload = {
      agent_id: '11111111-1111-4111-a111-111111111111',
      period_start: '2026-11-01',
    };

    const result = AgentTargetInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target_visits).toBe(0);
      expect(result.data.target_bookings).toBe(0);
      expect(result.data.period_end).toBeUndefined();
    }
  });

  it('coerces string numbers correctly', () => {
    const payload = {
      agent_id: '11111111-1111-4111-a111-111111111111',
      period_start: '2026-11-01',
      target_visits: '15',
      target_bookings: '3',
    };

    const result = AgentTargetInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target_visits).toBe(15);
      expect(result.data.target_bookings).toBe(3);
    }
  });

  it('rejects invalid agent_id UUID', () => {
    const payload = {
      agent_id: 'not-a-uuid',
      period_start: '2026-11-01',
    };

    const result = AgentTargetInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid date formats for period_start or period_end', () => {
    expect(
      AgentTargetInputSchema.safeParse({
        agent_id: '11111111-1111-4111-a111-111111111111',
        period_start: '01-11-2026',
      }).success
    ).toBe(false);

    expect(
      AgentTargetInputSchema.safeParse({
        agent_id: '11111111-1111-4111-a111-111111111111',
        period_start: '2026-11-01T00:00:00Z',
      }).success
    ).toBe(false);
  });

  it('rejects negative target numbers', () => {
    const payload = {
      agent_id: '11111111-1111-4111-a111-111111111111',
      period_start: '2026-11-01',
      target_visits: -1,
    };

    const result = AgentTargetInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe('AgentTargetPatchSchema', () => {
  it('allows partial updates with valid fields', () => {
    const result = AgentTargetPatchSchema.safeParse({
      target_visits: 30,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target_visits).toBe(30);
      expect(result.data.agent_id).toBeUndefined();
    }
  });
});
