import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // getUser() transparently refreshes an expired access token, which
  // ROTATES the refresh token and writes the new cookies onto
  // `supabaseResponse` via setAll() above. Any response we return in
  // place of `supabaseResponse` (every redirect / JSON branch below)
  // is a fresh object that does NOT carry those Set-Cookie headers, so
  // the rotated token never reaches the browser. The next request then
  // replays the old, now-consumed refresh token, the refresh fails, and
  // the session wedges — the user gets a broken reload after idling and
  // can only recover by manually clearing cookies (issue #288). Copy the
  // refreshed cookies onto whatever response we hand back to fix that.
  const withRefreshedCookies = <T extends NextResponse>(response: T): T => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  // Auth pages - redirect to dashboard if already logged in.
  // Exception: when an invite token is in the query string we
  // send the already-signed-in user to /join/<token> instead so
  // they can accept the invitation in one click. Without this,
  // a forwarded invite link to someone who's already signed in
  // would silently drop them on /dashboard.
  if (
    user &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup' ||
      request.nextUrl.pathname === '/forgot-password')
  ) {
    const url = request.nextUrl.clone();
    const inviteToken = request.nextUrl.searchParams.get('invite');
    if (
      inviteToken &&
      (request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/signup')
    ) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`;
      url.search = '';
    } else {
      url.pathname = '/dashboard';
      url.search = '';
    }
    return withRefreshedCookies(NextResponse.redirect(url));
  }

  // Protected pages - redirect to login if not authenticated
  // All dashboard routes that require (a) authentication and (b) an active
  // subscription. Add any new dashboard route here when it is created so it
  // automatically gets both the auth redirect and the billing gate.
  // NOTE: /billing itself must be in this list for the auth redirect to fire
  // on unauthenticated users trying to directly access /billing.
  const protectedPaths = [
    '/dashboard',
    '/inbox',
    '/contacts',
    '/pipelines',
    '/broadcasts',
    '/automations',
    '/settings',
    '/billing',
    '/integrations',
    '/site-visits',
    '/properties',
    '/flows',
    '/team',
    '/agents',
    '/notifications',
  ];
  if (
    !user &&
    protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return withRefreshedCookies(NextResponse.redirect(url));
  }

  // Billing gate - redirect to /billing if account is past_due or canceled
  if (
    user &&
    !request.nextUrl.pathname.startsWith('/billing') &&
    protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))
  ) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (profile?.account_id) {
      const { data: account } = await supabase
        .from('accounts')
        .select('subscription_status')
        .eq('id', profile.account_id)
        .single();

      if (
        account &&
        (account.subscription_status === 'canceled' ||
          account.subscription_status === 'past_due')
      ) {
        const url = request.nextUrl.clone();
        url.pathname = '/billing';
        return withRefreshedCookies(NextResponse.redirect(url));
      }
    }
  }

  // API routes that need auth (not webhooks)
  if (
    !user &&
    request.nextUrl.pathname.startsWith('/api/') &&
    !request.nextUrl.pathname.includes('/webhook') &&
    // Public routes that don't need auth
    !request.nextUrl.pathname.startsWith('/api/billing/webhook') &&
    !request.nextUrl.pathname.startsWith('/api/inbound-email') // assuming inbound email doesn't need auth
  ) {
    // Keep original check for whatsapp API routes specifically if needed,
    // but the original code was only for /api/whatsapp/. Let's match the original.
    if (request.nextUrl.pathname.startsWith('/api/whatsapp/')) {
      return withRefreshedCookies(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
