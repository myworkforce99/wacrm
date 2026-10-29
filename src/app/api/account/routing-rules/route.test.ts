import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const mocks = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: mocks.getCurrentAccount,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/auth/roles', () => ({
  hasMinRole: vi.fn((role: string, minRole: string) => {
    if (minRole === 'admin') return role === 'admin' || role === 'owner';
    return true;
  }),
}));

describe('/api/account/routing-rules', () => {
  let selectMock: ReturnType<typeof vi.fn>;
  let insertMock: ReturnType<typeof vi.fn>;
  let singleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    const orderMock = vi.fn().mockResolvedValue({
      data: [{ id: 'rule-1', priority: 1 }],
      error: null,
    });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    selectMock = vi.fn().mockReturnValue({ eq: eqMock });

    singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'rule-2',
        account_id: 'acc1',
        priority: 0,
        condition_type: 'source',
        condition_value: 'magicbricks',
        action_type: 'assign_to_agent',
        action_value: '11111111-1111-4111-a111-111111111111',
        is_active: true,
      },
      error: null,
    });
    const selectSingleMock = vi.fn().mockReturnValue({ single: singleMock });
    insertMock = vi.fn().mockReturnValue({ select: selectSingleMock });

    const supabaseMock = {
      from: vi.fn().mockReturnValue({
        select: selectMock,
        insert: insertMock,
      }),
    };

    mocks.createClient.mockResolvedValue(supabaseMock);
    mocks.getCurrentAccount.mockResolvedValue({
      accountId: 'acc1',
      userId: 'usr1',
      role: 'admin',
    });
  });

  describe('GET', () => {
    it('returns routing rules for authorized admin', async () => {
      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.routing_rules).toBeDefined();
    });

    it('returns 403 for non-admin agents', async () => {
      mocks.getCurrentAccount.mockResolvedValueOnce({
        accountId: 'acc1',
        userId: 'usr1',
        role: 'agent',
      });

      const res = await GET();
      expect(res.status).toBe(403);
    });
  });

  describe('POST', () => {
    it('creates routing rule with valid payload', async () => {
      const req = new Request('http://localhost/api/account/routing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condition_type: 'source',
          condition_value: 'magicbricks',
          action_type: 'assign_to_agent',
          action_value: '11111111-1111-4111-a111-111111111111',
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.id).toBe('rule-2');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 0,
          condition_type: 'source',
          condition_value: 'magicbricks',
          action_type: 'assign_to_agent',
          action_value: '11111111-1111-4111-a111-111111111111',
          is_active: true,
        })
      );
    });

    it('rejects invalid condition_type', async () => {
      const req = new Request('http://localhost/api/account/routing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condition_type: 'invalid_condition',
          condition_value: 'something',
          action_type: 'assign_to_agent',
          action_value: '11111111-1111-4111-a111-111111111111',
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
      expect(insertMock).not.toHaveBeenCalled();
    });
  });
});
