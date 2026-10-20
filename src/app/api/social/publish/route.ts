import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { canPublishSocialPost } from '@/lib/auth/roles';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/social/encryption';
import {
  publishInstagramPost,
  publishFacebookPost,
} from '@/lib/social/meta-api';

export async function POST(request: NextRequest) {
  let accountId: string | null = null;
  const internalSecret = request.headers.get('x-internal-secret');
  const configuredSecret = process.env.INTERNAL_API_SECRET;

  const isInternal = Boolean(
    configuredSecret && internalSecret && internalSecret === configuredSecret
  );

  if (!isInternal) {
    try {
      const auth = await getCurrentAccount();
      if (!canPublishSocialPost(auth.role)) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }
      accountId = auth.accountId;
    } catch {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    post_id?: string;
  };
  const postId = body.post_id;
  if (!postId) {
    return NextResponse.json({ error: 'MISSING_POST_ID' }, { status: 400 });
  }

  const db = isInternal
    ? createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    : await createClient();

  // Fetch post + social account
  let query = db
    .from('social_posts')
    .select('*, social_account:social_accounts(*)')
    .eq('id', postId);

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data: post, error: postErr } = await query.single();

  if (postErr || !post || !post.social_account) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (!post.media_url) {
    return NextResponse.json({ error: 'MISSING_MEDIA' }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(post.social_account.access_token_enc);
  } catch {
    await db
      .from('social_posts')
      .update({
        status: 'failed',
        failure_reason: 'Decryption failed for social account token',
      })
      .eq('id', postId);
    return NextResponse.json(
      { error: 'TOKEN_DECRYPTION_FAILED' },
      { status: 500 }
    );
  }

  // Mark as publishing
  await db
    .from('social_posts')
    .update({
      status: 'publishing',
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', postId);

  let result;
  if (post.social_account.platform === 'instagram') {
    result = await publishInstagramPost({
      igUserId: post.social_account.platform_user_id,
      accessToken,
      imageUrl: post.media_url,
      caption: post.caption ?? undefined,
    });
  } else {
    result = await publishFacebookPost({
      pageId: post.social_account.platform_user_id,
      accessToken,
      imageUrl: post.media_url,
      caption: post.caption ?? undefined,
    });
  }

  await db
    .from('social_posts')
    .update({
      status: result.success ? 'published' : 'failed',
      platform_post_id: result.platform_post_id ?? null,
      failure_reason: result.error ?? null,
    })
    .eq('id', postId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    platform_post_id: result.platform_post_id,
  });
}
