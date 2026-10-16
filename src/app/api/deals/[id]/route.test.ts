import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from './route';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  supabaseAdmin: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: mocks.requireRole,
  toErrorResponse: vi.fn((err) =>
    Response.json({ error: err.message }, { status: 403 })
  ),
}));

vi.mock('@/lib/automations/admin-client', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

describe('PATCH /api/deals/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks deal move if deal belongs to another agent', async () => {
    mocks.requireRole.mockResolvedValue({
      role: 'agent',
      userId: 'agent-1-auth-uuid',
      accountId: 'acc-1',
    });

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      assigned_to: 'agent-2-profile-uuid',
                      contact_id: 'contact-1',
                      stage_id: 'stage-1',
                      status: 'open',
                      closed_at: null,
                      reopened_count: 0,
                      assignee: { user_id: 'agent-2-auth-uuid' },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { assigned_agent_id: 'agent-2-auth-uuid' },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    mocks.supabaseAdmin.mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/deals/deal-1', {
      method: 'PATCH',
      body: JSON.stringify({ stage_id: 'stage-2' }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: 'deal-1' }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('DEAL_NOT_YOURS');
  });

  it('allows agent to move their own deal', async () => {
    mocks.requireRole.mockResolvedValue({
      role: 'agent',
      userId: 'agent-1-auth-uuid',
      accountId: 'acc-1',
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      assigned_to: 'agent-1-profile-uuid',
                      contact_id: 'contact-1',
                      stage_id: 'stage-1',
                      status: 'open',
                      closed_at: null,
                      reopened_count: 0,
                      assignee: { user_id: 'agent-1-auth-uuid' },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { assigned_agent_id: 'agent-1-auth-uuid' },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    mocks.supabaseAdmin.mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/deals/deal-1', {
      method: 'PATCH',
      body: JSON.stringify({ stage_id: 'stage-2' }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: 'deal-1' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('blocks non-manager from reassigning assigned_to', async () => {
    mocks.requireRole.mockResolvedValue({
      role: 'agent',
      userId: 'agent-1-auth-uuid',
      accountId: 'acc-1',
    });

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      assigned_to: 'agent-1-profile-uuid',
                      contact_id: 'contact-1',
                      stage_id: 'stage-1',
                      status: 'open',
                      closed_at: null,
                      reopened_count: 0,
                      assignee: { user_id: 'agent-1-auth-uuid' },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { assigned_agent_id: 'agent-1-auth-uuid' },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    mocks.supabaseAdmin.mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/deals/deal-1', {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to: 'agent-2-profile-uuid' }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: 'deal-1' }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('CANNOT_REASSIGN_DEAL');
  });

  it('allows manager/admin to reassign deal', async () => {
    mocks.requireRole.mockResolvedValue({
      role: 'admin',
      userId: 'admin-auth-uuid',
      accountId: 'acc-1',
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      assigned_to: 'agent-1-profile-uuid',
                      contact_id: 'contact-1',
                      stage_id: 'stage-1',
                      status: 'open',
                      closed_at: null,
                      reopened_count: 0,
                      assignee: { user_id: 'agent-1-auth-uuid' },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { assigned_agent_id: 'agent-1-auth-uuid' },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    mocks.supabaseAdmin.mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/deals/deal-1', {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to: 'agent-2-profile-uuid' }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: 'deal-1' }),
    });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalled();
  });
});
