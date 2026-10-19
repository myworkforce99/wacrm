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

describe('/api/tasks', () => {
  let orMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let orderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // For GET
    orderMock = vi
      .fn()
      .mockResolvedValue({ data: [{ id: '1' }], error: null });
    orMock = vi.fn().mockImplementation(() => ({ order: orderMock }));
    eqMock = vi.fn().mockImplementation(() => ({
      eq: eqMock,
      or: orMock,
      order: orderMock,
    }));
    const lteMock = vi.fn().mockReturnValue({ eq: eqMock, or: orMock, order: orderMock });
    const selectMockGet = vi
      .fn()
      .mockReturnValue({ lte: lteMock, eq: eqMock, or: orMock, order: orderMock });

    // For POST
    const singleMock = vi
      .fn()
      .mockResolvedValue({ data: { id: '2' }, error: null });
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
      role: 'admin',
    });
    mocks.requireRole.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
      userId: 'usr1',
    });
  });

  it('GET /api/tasks returns tasks for admin without agent constraint', async () => {
    const req = new Request('http://localhost/api/tasks?due_today=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tasks).toHaveLength(1);
    expect(orMock).not.toHaveBeenCalled();
  });

  it('GET /api/tasks constrains to assigned_to/created_by for agent without assigned_to query param', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
      userId: 'usr1',
      role: 'agent',
    });

    const req = new Request('http://localhost/api/tasks?due_today=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(orMock).toHaveBeenCalledWith('assigned_to.eq.usr1,created_by.eq.usr1');
  });

  it('GET /api/tasks allows agent to query their own tasks by assigned_to=usr1', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
      userId: 'usr1',
      role: 'agent',
    });

    const req = new Request('http://localhost/api/tasks?assigned_to=usr1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(eqMock).toHaveBeenCalledWith('assigned_to', 'usr1');
  });

  it('GET /api/tasks returns empty array when agent tries to query another agent tasks', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      supabase: mocks.supabaseUser,
      accountId: 'acc1',
      userId: 'usr1',
      role: 'agent',
    });

    const req = new Request('http://localhost/api/tasks?assigned_to=other_user');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tasks).toEqual([]);
    expect(eqMock).not.toHaveBeenCalledWith('assigned_to', 'other_user');
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
