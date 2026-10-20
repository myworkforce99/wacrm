import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: mocks.getCurrentAccount,
}));

describe('GET /api/social/connect', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      META_APP_ID: 'test-meta-app-id',
      NEXT_PUBLIC_SITE_URL: 'https://crm.example.com',
    };
  });

  it('rejects agent role with 403', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'agent',
      accountId: 'acc-1',
    });

    const req = new NextRequest(
      'http://localhost/api/social/connect?platform=instagram'
    );
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('rejects viewer role with 403', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'viewer',
      accountId: 'acc-1',
    });

    const req = new NextRequest(
      'http://localhost/api/social/connect?platform=instagram'
    );
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('redirects admin to facebook oauth dialog with instagram scopes', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'admin',
      accountId: 'acc-1',
    });

    const req = new NextRequest(
      'http://localhost/api/social/connect?platform=instagram'
    );
    const res = await GET(req);
    expect(res.status).toBe(307); // NextResponse.redirect
    const location = res.headers.get('location');
    expect(location).toContain('facebook.com/v21.0/dialog/oauth');
    expect(location).toContain('client_id=test-meta-app-id');
    expect(location).toContain('instagram_content_publish');
  });

  it('redirects admin to facebook oauth dialog with facebook page scopes', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'owner',
      accountId: 'acc-1',
    });

    const req = new NextRequest(
      'http://localhost/api/social/connect?platform=facebook'
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('facebook.com/v21.0/dialog/oauth');
    expect(location).toContain('pages_manage_posts');
  });
});
