import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH, DELETE } from './route';

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
  toErrorResponse: vi.fn(() => Response.json({ error: 'error' }, { status: 500 })),
}));

describe('/api/tasks/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const singleMock = vi.fn().mockResolvedValue({ data: { id: '1' }, error: null });
    
    // For GET
    const eqMockGet = vi.fn().mockReturnValue({ single: singleMock });
    const selectMockGet = vi.fn().mockReturnValue({ eq: eqMockGet });
    
    // For PATCH
    const selectMockUpdate = vi.fn().mockReturnValue({ single: singleMock });
    const eqMockUpdate = vi.fn().mockReturnValue({ select: selectMockUpdate });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMockUpdate });
    
    // For DELETE
    const deleteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    mocks.supabaseUser.from.mockReturnValue({
      select: selectMockGet,
      update: updateMock,
      delete: deleteMock,
    });

    mocks.getCurrentAccount.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
    });
    mocks.requireRole.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
    });
  });

  it('GET returns a task', async () => {
    const req = new Request('http://localhost/api/tasks/1');
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
  });

  it('PATCH updates a task', async () => {
    const req = new Request('http://localhost/api/tasks/1', {
      method: 'PATCH',
      body: JSON.stringify({ done: true }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
  });

  it('DELETE deletes a task', async () => {
    const req = new Request('http://localhost/api/tasks/1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(204);
  });
});
