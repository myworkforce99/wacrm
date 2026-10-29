import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  requireApiKey: vi.fn(),
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock('@/lib/auth/api-context', () => ({
  requireApiKey: mocks.requireApiKey,
}));

describe('POST /api/v1/site-visits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid JSON body with 400 bad_request', async () => {
    mocks.requireApiKey.mockResolvedValue({
      accountId: 'acc_1',
      supabase: {},
    });

    const req = new Request('http://localhost:3000/api/v1/site-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('not-an-object'),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('bad_request');
  });

  it('rejects malformed datetime with 400', async () => {
    mocks.requireApiKey.mockResolvedValue({
      accountId: 'acc_1',
      supabase: {},
    });

    const req = new Request('http://localhost:3000/api/v1/site-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at: 'next week',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe('Must be a valid ISO datetime');
  });

  it('rejects invalid status with 400 Invalid status', async () => {
    mocks.requireApiKey.mockResolvedValue({
      accountId: 'acc_1',
      supabase: {},
    });

    const req = new Request('http://localhost:3000/api/v1/site-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at: '2026-11-20T10:00:00Z',
        status: 'invalid_status_enum',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid status');
  });

  it('creates site visit with valid payload', async () => {
    const validContactUuid = '11111111-1111-4111-a111-111111111111';
    mocks.singleMock.mockResolvedValue({
      data: {
        id: 'sv_123',
        account_id: 'acc_1',
        contact_id: validContactUuid,
        property_id: null,
        scheduled_at: '2026-11-20T10:00:00Z',
        status: 'pending',
        reminded_24h: false,
        reminded_2h: false,
        notes: 'Needs parking assistance',
        pickup_required: true,
        pickup_location: 'Station road',
        created_at: '2026-10-28T00:00:00Z',
        updated_at: '2026-10-28T00:00:00Z',
      },
      error: null,
    });
    mocks.selectMock.mockReturnValue({ single: mocks.singleMock });
    mocks.insertMock.mockReturnValue({ select: mocks.selectMock });

    mocks.requireApiKey.mockResolvedValue({
      accountId: 'acc_1',
      supabase: {
        from: (table: string) => {
          expect(table).toBe('site_visits');
          return { insert: mocks.insertMock };
        },
      },
    });

    const req = new Request('http://localhost:3000/api/v1/site-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: validContactUuid,
        scheduled_at: '2026-11-20T10:00:00Z',
        notes: 'Needs parking assistance',
        pickup_required: true,
        pickup_location: 'Station road',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('sv_123');
    expect(body.data.pickup_required).toBe(true);
    expect(body.data.pickup_location).toBe('Station road');
  });
});
