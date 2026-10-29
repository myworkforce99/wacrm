import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  findActiveKeyByHash: vi.fn(),
  getCurrentAccount: vi.fn(),
  findOrCreateContact: vi.fn(),
  setContactTags: vi.fn(),
  resolveAuditUserId: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/lib/api-keys/store', () => ({
  findActiveKeyByHash: mocks.findActiveKeyByHash,
}));

vi.mock('@/lib/api-keys/keys', () => ({
  hashApiKey: (k: string) => `hash_${k}`,
  looksLikeApiKey: (k: string) => k.startsWith('wacrm_'),
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: mocks.getCurrentAccount,
}));

vi.mock('@/lib/api/v1/contacts', () => ({
  findOrCreateContact: mocks.findOrCreateContact,
  setContactTags: mocks.setContactTags,
  resolveAuditUserId: mocks.resolveAuditUserId,
}));

vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: () => ({
    from: mocks.fromMock,
  }),
}));

describe('POST /api/portal/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mocks.getCurrentAccount.mockRejectedValue(new Error('No session'));

    const req = new Request('http://localhost:3000/api/portal/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876543210' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects invalid payload without phone with 400', async () => {
    mocks.findActiveKeyByHash.mockResolvedValue({
      account_id: 'acc_123',
      scopes: ['contacts:write'],
    });

    const req = new Request(
      'http://localhost:3000/api/portal/webhook?token=wacrm_live_abc',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'No Phone Lead' }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid portal lead payload');
  });

  it('accepts valid 99acres lead payload, deduplicates, and sets tags', async () => {
    mocks.findActiveKeyByHash.mockResolvedValue({
      account_id: 'acc_123',
      scopes: ['contacts:write'],
    });
    mocks.resolveAuditUserId.mockResolvedValue('audit_user_1');
    mocks.findOrCreateContact.mockResolvedValue({
      id: 'contact_456',
      created: true,
    });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mocks.fromMock.mockImplementation((table: string) => {
      if (table === 'lead_details') {
        return { upsert: upsertMock };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [] }),
      };
    });

    const req = new Request(
      'http://localhost:3000/api/portal/webhook?token=wacrm_live_abc&source=99acres',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Rajesh Verma',
          phone: '+919876543210',
          email: 'rajesh@example.com',
          projName: 'Grand Residency',
          location: 'Whitefield',
          query: 'Looking for 3BHK ready to move',
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.contact_id).toBe('contact_456');
    expect(body.source).toBe('99acres');

    expect(mocks.findOrCreateContact).toHaveBeenCalledWith(
      expect.anything(),
      'acc_123',
      'audit_user_1',
      {
        phone: '+919876543210',
        name: 'Rajesh Verma',
        email: 'rajesh@example.com',
      }
    );

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acc_123',
        contact_id: 'contact_456',
        source: '99acres',
        location_preference: 'Whitefield',
      }),
      { onConflict: 'contact_id' }
    );

    expect(mocks.setContactTags).toHaveBeenCalledWith(
      expect.anything(),
      'acc_123',
      'audit_user_1',
      'contact_456',
      ['99acres']
    );
  });
});
