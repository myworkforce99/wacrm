import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  decryptToken: vi.fn(),
  publishInstagramPost: vi.fn(),
  publishFacebookPost: vi.fn(),
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: mocks.getCurrentAccount,
}));

vi.mock('@/lib/social/encryption', () => ({
  decryptToken: mocks.decryptToken,
  encryptToken: vi.fn(),
}));

vi.mock('@/lib/social/meta-api', () => ({
  publishInstagramPost: mocks.publishInstagramPost,
  publishFacebookPost: mocks.publishFacebookPost,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi
    .fn()
    .mockImplementation(() => Promise.resolve(mocks.supabase)),
}));

describe('POST /api/social/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects viewer role with 403', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'viewer',
      accountId: 'acc-1',
    });

    const req = new NextRequest('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ post_id: 'post-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects agent role with 403 (drafts only, admin publishes)', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'agent',
      accountId: 'acc-1',
    });

    const req = new NextRequest('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ post_id: 'post-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects request with missing post_id', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'admin',
      accountId: 'acc-1',
    });

    const req = new NextRequest('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when post is not found', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'admin',
      accountId: 'acc-1',
    });

    mocks.supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: new Error('not found') }),
          }),
        }),
      }),
    });

    const req = new NextRequest('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ post_id: 'post-nonexistent' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('successfully publishes instagram post and marks published', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'admin',
      accountId: 'acc-1',
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === 'social_posts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'post-1',
                    account_id: 'acc-1',
                    media_url: 'https://storage/image.png',
                    caption: 'Beautiful apartment',
                    social_account: {
                      platform: 'instagram',
                      platform_user_id: 'ig-123',
                      access_token_enc: 'enc_token',
                    },
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: updateMock,
        };
      }
      return {};
    });

    mocks.decryptToken.mockReturnValue('decrypted_token');
    mocks.publishInstagramPost.mockResolvedValue({
      success: true,
      platform_post_id: 'meta-ig-post-999',
    });

    const req = new NextRequest('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ post_id: 'post-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.platform_post_id).toBe('meta-ig-post-999');

    // Verify status was updated to published
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        platform_post_id: 'meta-ig-post-999',
      })
    );
  });

  it('marks post as failed when meta returns error', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'admin',
      accountId: 'acc-1',
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === 'social_posts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'post-1',
                    account_id: 'acc-1',
                    media_url: 'https://storage/image.png',
                    caption: 'Facebook post',
                    social_account: {
                      platform: 'facebook',
                      platform_user_id: 'page-456',
                      access_token_enc: 'enc_token',
                    },
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: updateMock,
        };
      }
      return {};
    });

    mocks.decryptToken.mockReturnValue('decrypted_token');
    mocks.publishFacebookPost.mockResolvedValue({
      success: false,
      error: 'Invalid OAuth access token',
    });

    const req = new NextRequest('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ post_id: 'post-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(502);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failure_reason: 'Invalid OAuth access token',
      })
    );
  });
});
