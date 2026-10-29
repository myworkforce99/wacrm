import { describe, it, expect } from 'vitest';
import { TaskInputSchema, TaskPatchSchema } from './task';

describe('TaskInputSchema', () => {
  it('validates a complete task payload', () => {
    const payload = {
      title: 'Follow up with buyer regarding 3BHK visit',
      contact_id: '11111111-1111-4111-a111-111111111111',
      site_visit_id: '22222222-2222-4222-a222-222222222222',
      due_at: '2026-11-01T10:00:00.000Z',
      assigned_to: '33333333-3333-4333-a333-333333333333',
      done: true,
    };

    const result = TaskInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe(
        'Follow up with buyer regarding 3BHK visit'
      );
      expect(result.data.contact_id).toBe(
        '11111111-1111-4111-a111-111111111111'
      );
      expect(result.data.site_visit_id).toBe(
        '22222222-2222-4222-a222-222222222222'
      );
      expect(result.data.due_at).toBe('2026-11-01T10:00:00.000Z');
      expect(result.data.assigned_to).toBe(
        '33333333-3333-4333-a333-333333333333'
      );
      expect(result.data.done).toBe(true);
    }
  });

  it('validates a minimal task payload with default done: false', () => {
    const payload = {
      title: 'Call prospect',
    };

    const result = TaskInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Call prospect');
      expect(result.data.done).toBe(false);
      expect(result.data.contact_id).toBeUndefined();
      expect(result.data.due_at).toBeUndefined();
    }
  });

  it('coerces empty string UUIDs and due_at to null', () => {
    const payload = {
      title: 'Call prospect',
      contact_id: '',
      site_visit_id: '',
      due_at: '',
      assigned_to: '',
    };

    const result = TaskInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contact_id).toBeNull();
      expect(result.data.site_visit_id).toBeNull();
      expect(result.data.due_at).toBeNull();
      expect(result.data.assigned_to).toBeNull();
    }
  });

  it('rejects invalid UUID formats', () => {
    const payload = {
      title: 'Call prospect',
      contact_id: 'not-a-uuid',
    };

    const result = TaskInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid due_at datetime strings', () => {
    const payload = {
      title: 'Call prospect',
      due_at: 'tomorrow morning',
    };

    const result = TaskInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const payload = {
      title: '   ',
    };

    const result = TaskInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe('TaskPatchSchema', () => {
  it('allows partial updates with valid fields', () => {
    const result = TaskPatchSchema.safeParse({
      done: true,
      due_at: '2026-11-05T14:30:00Z',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.done).toBe(true);
      expect(result.data.due_at).toBe('2026-11-05T14:30:00Z');
      expect(result.data.title).toBeUndefined();
    }
  });
});
