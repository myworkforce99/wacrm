import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { canManageSocialPosts } from '@/lib/auth/roles';
import { generateReply } from '@/lib/ai/generate';
import { loadAiConfig } from '@/lib/ai/config';
import { createClient } from '@/lib/supabase/server';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import { logAiUsage } from '@/lib/ai/usage';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { AiError } from '@/lib/ai/types';

export const REAL_ESTATE_SYSTEM_PROMPT = `
You are a real estate marketing copywriter for an Indian property developer.
Write engaging social media captions for Instagram and Facebook.
Captions should:
- Highlight the property's key features (location, configuration, price if provided)
- Use relevant real estate hashtags for Indian markets
- Have a clear call-to-action (e.g., "Call now", "Book a site visit")
- Be concise: under 300 characters for the main text, hashtags after a line break
- Use INR formatting (₹45 L, ₹1.2 Cr) for prices
- Sound professional but warm, not corporate
Return ONLY the caption text — no explanations or formatting markup.
`.trim();

export async function POST(request: NextRequest) {
  try {
    const { role, accountId, userId } = await getCurrentAccount();
    if (!canManageSocialPosts(role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const userLimit = checkRateLimit(
      `ai-social:${userId}`,
      RATE_LIMITS.aiDraft
    );
    if (!userLimit.success) return rateLimitResponse(userLimit);

    const accountLimit = checkRateLimit(
      `ai-social-acct:${accountId}`,
      RATE_LIMITS.aiDraftAccount
    );
    if (!accountLimit.success) return rateLimitResponse(accountLimit);

    const body = await request.json().catch(() => null);
    const platform = body?.platform === 'facebook' ? 'facebook' : 'instagram';
    const propertyDetails =
      typeof body?.property_details === 'string'
        ? body.property_details.trim()
        : '';
    const tone =
      body?.tone === 'friendly' || body?.tone === 'urgent'
        ? body.tone
        : 'professional';

    if (!propertyDetails) {
      return NextResponse.json(
        { error: 'property_details is required' },
        { status: 400 }
      );
    }

    const db = await createClient();
    const config = await loadAiConfig(db, accountId, {
      requireActive: false,
    }).catch((err) => {
      console.error('[social/generate-caption] loadAiConfig error:', err);
      throw new AiError('Stored API key could not be decrypted.', {
        code: 'key_decrypt_failed',
        status: 400,
      });
    });

    if (!config) {
      return NextResponse.json(
        {
          error:
            'AI assistant is not configured. Please add an API key in Settings → AI Assistant.',
          code: 'ai_not_configured',
        },
        { status: 400 }
      );
    }

    const userPrompt = `Platform: ${platform}\nProperty: ${propertyDetails}\nTone: ${tone}`;

    const { text, usage } = await generateReply({
      config,
      systemPrompt: REAL_ESTATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    try {
      void logAiUsage(supabaseAdmin(), {
        accountId,
        conversationId: null,
        mode: 'draft',
        provider: config.provider,
        model: config.model,
        usage,
      });
    } catch (logErr) {
      console.error('[social/generate-caption] usage log skipped:', logErr);
    }

    return NextResponse.json({ caption: text });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return toErrorResponse(err);
  }
}
