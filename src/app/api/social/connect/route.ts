import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { canConnectSocialAccount } from '@/lib/auth/roles';

export async function GET(request: NextRequest) {
  try {
    const { role } = await getCurrentAccount();
    if (!canConnectSocialAccount(role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const metaAppId = process.env.META_APP_ID;
    if (!metaAppId) {
      return NextResponse.json(
        { error: 'META_APP_ID is not configured' },
        { status: 500 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    const redirectUri = `${siteUrl}/api/social/callback`;

    const platform =
      request.nextUrl.searchParams.get('platform') ?? 'instagram';
    const scopes =
      platform === 'instagram'
        ? 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'
        : 'pages_show_list,pages_read_engagement,pages_manage_posts';

    const state = Buffer.from(JSON.stringify({ platform })).toString('base64');
    const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    url.searchParams.set('client_id', metaAppId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', state);

    return NextResponse.redirect(url.toString());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
