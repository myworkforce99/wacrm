import { describe, it, expect, vi } from 'vitest';
import { getFollowupsDueCount } from './queries';
import { SupabaseClient } from '@supabase/supabase-js';

describe('getFollowupsDueCount', () => {
  it('sums tasks and conversations correctly', async () => {
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ count: 5, error: null })),
      lt: vi.fn().mockImplementation((col) => {
        if (col === 'due_at') return Promise.resolve({ count: 3, error: null });
        if (col === 'first_unanswered_at')
          return Promise.resolve({ count: 7, error: null });
        return Promise.resolve({ count: 0, error: null });
      }),
      not: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ count: 10, error: null })),
    };

    const db = {
      from: vi.fn().mockReturnValue(chainMock),
    } as unknown as SupabaseClient;

    const res = await getFollowupsDueCount(db as unknown as SupabaseClient);
    expect(res.count).toBe(15);
    expect(res.overdue).toBe(10);
  });
});
