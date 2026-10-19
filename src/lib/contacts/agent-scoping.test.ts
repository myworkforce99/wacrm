import { describe, expect, it, vi } from 'vitest';
import {
  getAgentAssignedContactIds,
  buildAgentContactFilter,
} from './agent-scoping';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('agent-scoping', () => {
  describe('buildAgentContactFilter', () => {
    it('generates user_id condition when no profileId or additional IDs', () => {
      const filter = buildAgentContactFilter('user-1');
      expect(filter).toBe('user_id.eq.user-1');
    });

    it('generates combined user_id conditions when profileId differs from userId', () => {
      const filter = buildAgentContactFilter('user-1', 'profile-1');
      expect(filter).toBe('user_id.eq.user-1,user_id.eq.profile-1');
    });

    it('does not duplicate if profileId equals userId', () => {
      const filter = buildAgentContactFilter('user-1', 'user-1');
      expect(filter).toBe('user_id.eq.user-1');
    });

    it('appends id.in condition when additionalContactIds are provided', () => {
      const filter = buildAgentContactFilter('user-1', 'profile-1', [
        'c-1',
        'c-2',
        'c-1',
      ]);
      expect(filter).toBe('user_id.eq.user-1,user_id.eq.profile-1,id.in.(c-1,c-2)');
    });

    it('ignores empty/falsy strings in additionalContactIds', () => {
      const filter = buildAgentContactFilter('user-1', null, ['c-1', '', 'c-3']);
      expect(filter).toBe('user_id.eq.user-1,id.in.(c-1,c-3)');
    });
  });

  describe('getAgentAssignedContactIds', () => {
    it('aggregates unique contact IDs from deals and conversations', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'deals') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              not: vi.fn().mockResolvedValue({
                data: [{ contact_id: 'c-deal-1' }, { contact_id: 'c-shared' }],
              }),
            };
          }
          if (table === 'conversations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              not: vi.fn().mockResolvedValue({
                data: [{ contact_id: 'c-conv-1' }, { contact_id: 'c-shared' }],
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      const ids = await getAgentAssignedContactIds(
        mockSupabase,
        'user-1',
        'profile-1'
      );

      expect(ids).toEqual(['c-deal-1', 'c-shared', 'c-conv-1']);
      expect(mockSupabase.from).toHaveBeenCalledWith('deals');
      expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
    });

    it('handles null/empty responses gracefully', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({ data: null }),
        })),
      } as unknown as SupabaseClient;

      const ids = await getAgentAssignedContactIds(mockSupabase, 'user-1');
      expect(ids).toEqual([]);
    });
  });
});
