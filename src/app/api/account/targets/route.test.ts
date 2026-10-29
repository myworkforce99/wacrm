import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const mocks = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  requireRole: vi.fn(),
  supabaseUser: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: mocks.getCurrentAccount,
  requireRole: mocks.requireRole,
  toErrorResponse: vi.fn(() =>
    Response.json({ error: 'error' }, { status: 500 })
  ),
}));

describe('/api/account/targets', () => {
  let selectMock: ReturnType<typeof vi.fn>;
  let upsertMock: ReturnType<typeof vi.fn>;
  let singleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 't-1',
        account_id: 'acc1',
        agent_id: '11111111-1111-4111-a111-111111111111',
        period_start: '2026-11-01',
        period_end: '2026-11-30',
        target_visits: 10,
        target_bookings: 2,
      },
      error: null,
    });

    const selectSingleMock = vi.fn().mockReturnValue({ single: singleMock });
    upsertMock = vi.fn().mockReturnValue({ select: selectSingleMock });

    const eqPeriodMock = vi.fn().mockResolvedValue({
      data: [{ id: 't-1' }],
      error: null,
    });
    const eqAccountMock = vi.fn().mockImplementation(() => {
      return {
        eq: eqPeriodMock,
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: [{ id: 't-1' }], error: null }),
      };
    });

    selectMock = vi.fn().mockReturnValue({ eq: eqAccountMock });

    mocks.supabaseUser.from.mockReturnValue({
      select: selectMock,
      upsert: upsertMock,
    });

    mocks.getCurrentAccount.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
      userId: 'usr1',
      role: 'admin',
    });
    mocks.requireRole.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
      userId: 'usr1',
    });
  });

  describe('GET', () => {
    it('fetches targets for the current account', async () => {
      const req = new Request('http://localhost/api/account/targets');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.targets).toBeDefined();
    });
  });

  describe('POST', () => {
    it('creates or updates target with valid input and auto-computes period_end', async () => {
      const req = new Request('http://localhost/api/account/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: '11111111-1111-4111-a111-111111111111',
          period_start: '2026-11-01',
          target_visits: 15,
          target_bookings: 3,
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          period_start: '2026-11-01',
          period_end: '2026-11-30',
          target_visits: 15,
          target_bookings: 3,
        }),
        expect.anything()
      );
      expect(json.target).toBeDefined();
    });

    it('rejects invalid input schema (invalid date)', async () => {
      const req = new Request('http://localhost/api/account/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: '11111111-1111-4111-a111-111111111111',
          period_start: 'not-a-date',
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
      expect(upsertMock).not.toHaveBeenCalled();
    });
  });
});
