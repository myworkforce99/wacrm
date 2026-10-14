import { describe, it, expect, vi } from 'vitest';
import { getFollowupsDueCount, loadTeamPerformance } from './queries';
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

describe('loadTeamPerformance', () => {
  it('correctly calculates agent workload, visits, conversion, and targets', async () => {
    const mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        type ResolveFn = (value: { data: unknown; error: null }) => void;
        const queryBuilder: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        };

        if (table === 'profiles') {
          queryBuilder.then = (resolve: ResolveFn) =>
            resolve({
              data: [
                {
                  user_id: 'agent-1',
                  full_name: 'Rohit Sharma',
                  avatar_url: 'https://example.com/avatar.jpg',
                  account_role: 'agent',
                  is_available: true,
                },
              ],
              error: null,
            });
        } else if (table === 'conversations') {
          queryBuilder.then = (resolve: ResolveFn) =>
            resolve({
              data: [
                {
                  assigned_agent_id: 'agent-1',
                  contact_id: 'lead-1',
                  status: 'open',
                },
              ],
              error: null,
            });
        } else if (table === 'site_visits') {
          queryBuilder.then = (resolve: ResolveFn) =>
            resolve({
              data: [
                {
                  status: 'completed',
                  contact_id: 'lead-1',
                },
              ],
              error: null,
            });
        } else if (table === 'deals') {
          queryBuilder.then = (resolve: ResolveFn) =>
            resolve({
              data: [
                {
                  assigned_to: 'profile-1',
                  status: 'won',
                  assignee: { user_id: 'agent-1' },
                },
              ],
              error: null,
            });
        } else if (table === 'messages') {
          queryBuilder.then = (resolve: ResolveFn) =>
            resolve({
              data: [
                {
                  conversation_id: 'conv-1',
                  sender_type: 'customer',
                  sender_id: null,
                  created_at: '2026-10-01T10:00:00Z',
                },
                {
                  conversation_id: 'conv-1',
                  sender_type: 'agent',
                  sender_id: 'agent-1',
                  created_at: '2026-10-01T10:12:00Z',
                },
              ],
              error: null,
            });
        } else if (table === 'agent_targets') {
          queryBuilder.then = (resolve: ResolveFn) =>
            resolve({
              data: [
                {
                  agent_id: 'agent-1',
                  target_visits: 12,
                  target_bookings: 4,
                },
              ],
              error: null,
            });
        } else {
          queryBuilder.then = (resolve: ResolveFn) =>
            resolve({ data: [], error: null });
        }

        return queryBuilder;
      }),
    } as unknown as SupabaseClient;

    const result = await loadTeamPerformance(mockDb, 30);
    expect(result).toHaveLength(1);
    const agent = result[0];
    expect(agent.agentId).toBe('agent-1');
    expect(agent.name).toBe('Rohit Sharma');
    expect(agent.isAvailable).toBe(true);
    expect(agent.openLeadsCount).toBe(1);
    expect(agent.visitsCompleted).toBe(1);
    expect(agent.actualVisitsThisMonth).toBe(1);
    expect(agent.targetVisits).toBe(12);
    expect(agent.targetBookings).toBe(4);
    expect(agent.conversionRate).toBe(100);
    expect(agent.avgResponseTimeMin).toBe(12);
  });
});
