import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

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
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mocks.supabase)),
}));

describe('POST /api/contacts/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects agent role with 403', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'agent',
      accountId: 'acc-1',
      userId: 'usr-1',
    });

    const req = new Request('http://localhost/api/contacts/import', {
      method: 'POST',
      body: JSON.stringify([]),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('imports contacts and writes configuration_preference array', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'admin',
      accountId: 'acc-1',
      userId: 'admin-1',
    });

    let insertedLeadDetails: unknown[] = [];

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === 'contacts') {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'contact-uuid-1', phone_normalized: '919876543210' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lead_details') {
        return {
          upsert: vi.fn().mockImplementation((payload) => {
            insertedLeadDetails = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === 'contact_notes') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    const req = new Request('http://localhost/api/contacts/import', {
      method: 'POST',
      body: JSON.stringify([
        {
          name: 'Vikrant Roy',
          phone: '+91 98765 43210',
          source: '99acres',
          budget_min: 15000000,
          budget_max: 20000000,
          location: 'Powai',
          bhk_config: '3BHK',
          stage: 'New',
          notes: 'Looking for urgent visit',
        },
      ]),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.created).toBe(1);

    expect(insertedLeadDetails.length).toBe(1);
    expect(insertedLeadDetails[0]).toMatchObject({
      contact_id: 'contact-uuid-1',
      source: '99acres',
      property_type: '3BHK',
      configuration_preference: ['3BHK'],
      location_preference: 'Powai',
    });
  });
});
