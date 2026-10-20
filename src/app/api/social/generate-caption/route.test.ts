import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { AiError } from '@/lib/ai/types';

const mocks = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  loadAiConfig: vi.fn(),
  generateReply: vi.fn(),
  logAiUsage: vi.fn(),
  supabaseAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  supabase: {},
}));

vi.mock('@/lib/auth/account', () => ({
  getCurrentAccount: mocks.getCurrentAccount,
  toErrorResponse: vi.fn((err: unknown) => {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal error',
      }),
      { status: 500 }
    );
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi
    .fn()
    .mockImplementation(() => Promise.resolve(mocks.supabase)),
}));

vi.mock('@/lib/ai/config', () => ({
  loadAiConfig: mocks.loadAiConfig,
}));

vi.mock('@/lib/ai/generate', () => ({
  generateReply: mocks.generateReply,
}));

vi.mock('@/lib/ai/usage', () => ({
  logAiUsage: mocks.logAiUsage,
}));

vi.mock('@/lib/ai/admin-client', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: {
    aiDraft: { limit: 20, windowMs: 60_000 },
    aiDraftAccount: { limit: 60, windowMs: 60_000 },
  },
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: vi.fn(() => {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
    });
  }),
}));

describe('POST /api/social/generate-caption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue({ success: true });
  });

  it('rejects viewer role with 403', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'viewer',
      accountId: 'acc-1',
      userId: 'user-viewer',
    });

    const req = new NextRequest(
      'http://localhost/api/social/generate-caption',
      {
        method: 'POST',
        body: JSON.stringify({
          platform: 'instagram',
          property_details: '3BHK in Noida',
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects request with missing property_details', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'agent',
      accountId: 'acc-1',
      userId: 'user-agent',
    });

    const req = new NextRequest(
      'http://localhost/api/social/generate-caption',
      {
        method: 'POST',
        body: JSON.stringify({
          platform: 'instagram',
          property_details: '',
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('property_details is required');
  });

  it('returns 400 when AI is not configured', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'agent',
      accountId: 'acc-1',
      userId: 'user-agent',
    });
    mocks.loadAiConfig.mockResolvedValue(null);

    const req = new NextRequest(
      'http://localhost/api/social/generate-caption',
      {
        method: 'POST',
        body: JSON.stringify({
          platform: 'instagram',
          property_details: '3BHK in Whitefield Bangalore, ₹1.5 Cr',
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('ai_not_configured');
  });

  it('generates caption successfully for agent role', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'agent',
      accountId: 'acc-1',
      userId: 'user-agent',
    });
    mocks.loadAiConfig.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-key',
    });
    mocks.generateReply.mockResolvedValue({
      text: 'Luxury 3BHK Apartment in Whitefield, Bangalore! 🌟 ₹1.5 Cr\n\n#BangaloreRealEstate #LuxuryLiving',
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
    });

    const req = new NextRequest(
      'http://localhost/api/social/generate-caption',
      {
        method: 'POST',
        body: JSON.stringify({
          platform: 'instagram',
          property_details: '3BHK in Whitefield Bangalore, ₹1.5 Cr',
          tone: 'friendly',
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.caption).toContain('Luxury 3BHK Apartment in Whitefield');
    expect(mocks.generateReply).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining(
          'real estate marketing copywriter'
        ),
        messages: [
          {
            role: 'user',
            content:
              'Platform: instagram\nProperty: 3BHK in Whitefield Bangalore, ₹1.5 Cr\nTone: friendly',
          },
        ],
      })
    );
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'admin',
      accountId: 'acc-1',
      userId: 'user-admin',
    });
    mocks.checkRateLimit.mockReturnValue({ success: false });

    const req = new NextRequest(
      'http://localhost/api/social/generate-caption',
      {
        method: 'POST',
        body: JSON.stringify({
          platform: 'facebook',
          property_details: '4BHK Villa in Gurgaon',
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('handles AiError properly', async () => {
    mocks.getCurrentAccount.mockResolvedValue({
      role: 'admin',
      accountId: 'acc-1',
      userId: 'user-admin',
    });
    mocks.loadAiConfig.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-key',
    });
    mocks.generateReply.mockRejectedValue(
      new AiError('Provider rate limit reached', {
        code: 'rate_limited',
        status: 429,
      })
    );

    const req = new NextRequest(
      'http://localhost/api/social/generate-caption',
      {
        method: 'POST',
        body: JSON.stringify({
          platform: 'instagram',
          property_details: 'Penthouse in Mumbai',
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('Provider rate limit reached');
    expect(data.code).toBe('rate_limited');
  });
});
