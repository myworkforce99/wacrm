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

describe('POST /api/v1/properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid JSON body with 400 bad_request', async () => {
    mocks.requireApiKey.mockResolvedValue({
      accountId: 'acc_1',
      supabase: {},
    });

    const req = new Request('http://localhost:3000/api/v1/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['not', 'an', 'object']),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('bad_request');
  });

  it('rejects missing or empty title with 400', async () => {
    mocks.requireApiKey.mockResolvedValue({
      accountId: 'acc_1',
      supabase: {},
    });

    const req = new Request('http://localhost:3000/api/v1/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 1000000 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/'title' is required/i);
  });

  it('rejects negative price with 400', async () => {
    mocks.requireApiKey.mockResolvedValue({
      accountId: 'acc_1',
      supabase: {},
    });

    const req = new Request('http://localhost:3000/api/v1/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Villa', price: -500 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe('Price cannot be negative');
  });

  it('creates property with valid payload', async () => {
    mocks.singleMock.mockResolvedValue({
      data: {
        id: 'prop_123',
        account_id: 'acc_1',
        title: 'Emerald Bay',
        price: 8500000,
        property_type: 'Apartment',
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
          expect(table).toBe('properties');
          return { insert: mocks.insertMock };
        },
      },
    });

    const req = new Request('http://localhost:3000/api/v1/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Emerald Bay',
        price: 8500000,
        property_type: 'Apartment',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('prop_123');
    expect(body.data.title).toBe('Emerald Bay');
  });
});
