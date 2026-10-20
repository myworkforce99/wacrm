import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Called every minute by pg_cron: SELECT cron.schedule('social-post-scheduler', '* * * * *', $$SELECT net.http_post(...)$$);
Deno.serve(async () => {
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date().toISOString();

  // Fetch all due scheduled posts (max 20 per invocation to prevent timeouts)
  const { data: duePosts } = await db
    .from('social_posts')
    .select(
      'id, account_id, social_account_id, caption, media_url, retry_count, social_account:social_accounts(platform, platform_user_id, access_token_enc)'
    )
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .lt('retry_count', 3) // Give up after 3 attempts
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (!duePosts?.length) {
    return new Response(JSON.stringify({ message: 'No posts due' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const siteUrl =
    Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? Deno.env.get('SITE_URL') ?? '';
  const internalSecret = Deno.env.get('INTERNAL_API_SECRET') ?? '';

  const results = await Promise.allSettled(
    duePosts.map(async (post) => {
      // Mark publishing first (prevents double-trigger on overlapping cron ticks)
      await db
        .from('social_posts')
        .update({
          status: 'publishing',
          last_attempt_at: now,
          retry_count: post.retry_count + 1,
        })
        .eq('id', post.id);

      // Call the internal publish API route (reuses the existing publish logic)
      const publishRes = await fetch(`${siteUrl}/api/social/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Internal service call — use a shared secret, not a user session
          'x-internal-secret': internalSecret,
        },
        body: JSON.stringify({ post_id: post.id }),
      });

      if (!publishRes.ok) {
        const err = await publishRes.json().catch(() => ({}));
        await db
          .from('social_posts')
          .update({
            status: post.retry_count >= 2 ? 'failed' : 'scheduled',
            failure_reason: err.error ?? 'Scheduler publish failed',
          })
          .eq('id', post.id);
      }
    })
  );

  return new Response(JSON.stringify({ processed: results.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
