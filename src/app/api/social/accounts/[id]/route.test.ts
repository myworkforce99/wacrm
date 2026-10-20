import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: mocks.getCurrentAccount,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi
    .fn()
    .mockImplementation(() => Promise.resolve(mocks.supabase)),
}));

describe('DELETE /api/social/accounts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects agent role with 403', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'agent',
      accountId: 'acc-1',
    });

    const req = new NextRequest('http://localhost/api/social/accounts/acc-123');
    const res = await DELETE(req, {
      params: Promise.resolve({ id: 'acc-123' }),
    });
    expect(res.status).toBe(403);
  });

  it('allows admin to disconnect social account by setting is_active to false', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'admin',
      accountId: 'acc-1',
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mocks.supabase.from.mockReturnValue({
      update: updateMock,
    });

    const req = new NextRequest('http://localhost/api/social/accounts/acc-123');
    const res = await DELETE(req, {
      params: Promise.resolve({ id: 'acc-123' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ is_active: false });
  });
});
