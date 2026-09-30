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
  toErrorResponse: vi.fn(() => Response.json({ error: 'error' }, { status: 500 })),
}));

describe('/api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // For GET
    const orderMock = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
    const eqMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: orderMock }), order: orderMock });
    const lteMock = vi.fn().mockReturnValue({ eq: eqMock });
    const selectMockGet = vi.fn().mockReturnValue({ lte: lteMock, eq: eqMock, order: orderMock });
    
    // For POST
    const singleMock = vi.fn().mockResolvedValue({ data: { id: '2' }, error: null });
    const selectMockInsert = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMockInsert });

    mocks.supabaseUser.from.mockReturnValue({
      select: selectMockGet,
      insert: insertMock,
    });

    mocks.getCurrentAccount.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
      userId: 'usr1',
    });
    mocks.requireRole.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
      userId: 'usr1',
    });
  });

  it('GET /api/tasks returns tasks', async () => {
    const req = new Request('http://localhost/api/tasks?due_today=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tasks).toHaveLength(1);
  });

  it('POST /api/tasks creates a task', async () => {
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Task' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.task.id).toBe('2');
  });

  it('POST /api/tasks fails if no title', async () => {
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
