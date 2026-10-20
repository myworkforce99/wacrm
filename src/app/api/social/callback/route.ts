import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { canConnectSocialAccount } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/social/encryption';

export async function GET(request: NextRequest) {
  const metaAppId = process.env.META_APP_ID || '';
  const metaAppSecret = process.env.META_APP_SECRET || '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const redirectUri = `${siteUrl}/api/social/callback`;

  const code = request.nextUrl.searchParams.get('code');
  const rawState = request.nextUrl.searchParams.get('state');

  if (!code || !rawState) {
    return NextResponse.redirect(
      `${siteUrl}/social-media?error=oauth_cancelled`
    );
  }

  let platform = 'instagram';
  try {
    const parsed = JSON.parse(
      Buffer.from(rawState, 'base64').toString('utf8')
    ) as { platform?: string };
    if (parsed.platform) platform = parsed.platform;
  } catch {
    // Default to instagram
  }

  try {
    const { accountId, role } = await getCurrentAccount();
    if (!canConnectSocialAccount(role)) {
      return NextResponse.redirect(`${siteUrl}/social-media?error=forbidden`);
    }

    // Exchange short-lived code for long-lived access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${metaAppId}&client_secret=${metaAppSecret}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code=${code}`
    );
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    if (!tokenData.access_token) {
      return NextResponse.redirect(
        `${siteUrl}/social-media?error=token_exchange_failed`
      );
    }

    let platformUserId: string;
    let displayName: string;
    let avatarUrl: string | null = null;
    const accessToken: string = tokenData.access_token;

    if (platform === 'instagram') {
      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
      );
      const meData = (await meRes.json()) as {
        data?: Array<{ id: string; access_token: string }>;
      };
      const page = meData.data?.[0];
      if (!page) {
        return NextResponse.redirect(
          `${siteUrl}/social-media?error=no_page_found`
        );
      }

      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = (await igRes.json()) as {
        instagram_business_account?: { id: string };
      };
      const igAccount = igData.instagram_business_account;
      if (!igAccount) {
        return NextResponse.redirect(
          `${siteUrl}/social-media?error=no_ig_account`
        );
      }

      const igDetailRes = await fetch(
        `https://graph.facebook.com/v21.0/${igAccount.id}?fields=name,profile_picture_url&access_token=${page.access_token}`
      );
      const igDetail = (await igDetailRes.json()) as {
        name?: string;
        profile_picture_url?: string;
      };
      platformUserId = igAccount.id;
      displayName = igDetail.name ?? '@instagram_account';
      avatarUrl = igDetail.profile_picture_url ?? null;
    } else {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
      );
      const pagesData = (await pagesRes.json()) as {
        data?: Array<{ id: string; name: string }>;
      };
      const page = pagesData.data?.[0];
      if (!page) {
        return NextResponse.redirect(
          `${siteUrl}/social-media?error=no_page_found`
        );
      }
      platformUserId = page.id;
      displayName = page.name ?? 'Facebook Page';
    }

    const tokenEncrypted = encryptToken(accessToken);
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const db = await createClient();
    const { error } = await db.from('social_accounts').upsert(
      {
        account_id: accountId,
        platform,
        display_name: displayName,
        platform_user_id: platformUserId,
        access_token_enc: tokenEncrypted,
        token_expires_at: tokenExpiresAt,
        avatar_url: avatarUrl,
        is_active: true,
      },
      { onConflict: 'account_id,platform', ignoreDuplicates: false }
    );

    if (error) {
      return NextResponse.redirect(
        `${siteUrl}/social-media?error=db_save_failed`
      );
    }

    return NextResponse.redirect(
      `${siteUrl}/social-media?connected=${platform}`
    );
  } catch {
    return NextResponse.redirect(
      `${siteUrl}/social-media?error=unexpected_error`
    );
  }
}
