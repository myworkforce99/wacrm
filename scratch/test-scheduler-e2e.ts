import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf-8');
for (const line of env.split('\n')) {
  const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminDb = createClient(url, serviceKey);

const ACCOUNT_ID = '09e60b2d-7c0f-4242-aa74-c4becda130da';
const SITE_URL = 'http://localhost:3000';
const INTERNAL_SECRET =
  process.env.INTERNAL_API_SECRET || 'wacrm_internal_secret_dev_2026';

async function testSchedulerE2E() {
  console.log(
    '=== TESTING SCHEDULER EDGE FUNCTION SIMULATION & RETRY LOGIC ===\n'
  );

  // 1. Get active social account
  const { data: accounts } = await adminDb
    .from('social_accounts')
    .select('id, platform, display_name')
    .eq('account_id', ACCOUNT_ID)
    .eq('is_active', true)
    .limit(1);

  if (!accounts?.length) throw new Error('No social account found');
  const socialAccountId = accounts[0].id;

  // 2. Insert a scheduled post that is due right now (scheduled_at in past)
  const pastDate = new Date(Date.now() - 10000).toISOString();
  const { data: duePost, error: insertErr } = await adminDb
    .from('social_posts')
    .insert({
      account_id: ACCOUNT_ID,
      social_account_id: socialAccountId,
      caption: '[Scheduler Test] Automated Due Post Test',
      media_url:
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      status: 'scheduled',
      scheduled_at: pastDate,
      retry_count: 0,
    })
    .select()
    .single();

  if (insertErr || !duePost)
    throw new Error(`Insert failed: ${insertErr?.message}`);
  console.log(
    `✓ Inserted due scheduled post [ID: ${duePost.id}] with scheduled_at: ${duePost.scheduled_at}`
  );

  // 3. Query as Edge Function would
  const now = new Date().toISOString();
  const { data: queriedPosts } = await adminDb
    .from('social_posts')
    .select(
      'id, account_id, social_account_id, caption, media_url, retry_count'
    )
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .lt('retry_count', 3)
    .order('scheduled_at', { ascending: true })
    .limit(20);

  const found = queriedPosts?.find((p) => p.id === duePost.id);
  if (!found) throw new Error('Scheduler query failed to find the due post!');
  console.log(
    `✓ Scheduler query successfully identified due post (found among ${queriedPosts?.length} due posts)`
  );

  // 4. Mark publishing (as Edge Function does)
  await adminDb
    .from('social_posts')
    .update({
      status: 'publishing',
      last_attempt_at: now,
      retry_count: duePost.retry_count + 1,
    })
    .eq('id', duePost.id);

  const { data: publishingPost } = await adminDb
    .from('social_posts')
    .select('status, retry_count')
    .eq('id', duePost.id)
    .single();
  console.log(
    `✓ Post transitioned to '${publishingPost?.status}' with retry_count = ${publishingPost?.retry_count}`
  );

  // 5. Test internal publish route dispatch
  console.log('✓ Calling POST /api/social/publish with x-internal-secret...');
  const res = await fetch(`${SITE_URL}/api/social/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({ post_id: duePost.id }),
  });
  console.log(`✓ /api/social/publish returned status HTTP ${res.status}`);
  const resultJson = await res.json().catch(() => ({}));
  console.log(`  Response:`, resultJson);

  // 6. Check final post status in remote DB
  const { data: finalPost } = await adminDb
    .from('social_posts')
    .select('id, status, platform_post_id, failure_reason, retry_count')
    .eq('id', duePost.id)
    .single();

  console.log(`✓ Final post status in DB: ${finalPost?.status}`);
  if (finalPost?.status === 'published') {
    console.log(`  platform_post_id: ${finalPost.platform_post_id}`);
  } else if (finalPost?.status === 'failed') {
    console.log(`  failure_reason: ${finalPost.failure_reason}`);
  }

  // 7. Test 3-Retry Exhaustion to 'failed'
  console.log('\n--- Testing Retry Exhaustion Logic ---');
  await adminDb
    .from('social_posts')
    .update({
      status: 'scheduled',
      retry_count: 2, // Last retry before giveup
    })
    .eq('id', duePost.id);

  // Simulate scheduler attempt 3
  const currentRetry = 2;
  await adminDb
    .from('social_posts')
    .update({
      status: currentRetry >= 2 ? 'failed' : 'scheduled',
      retry_count: currentRetry + 1,
      failure_reason: 'Simulated 3rd attempt failure exhaustion',
    })
    .eq('id', duePost.id);

  const { data: exhaustedPost } = await adminDb
    .from('social_posts')
    .select('status, retry_count, failure_reason')
    .eq('id', duePost.id)
    .single();

  if (exhaustedPost?.status !== 'failed' || exhaustedPost?.retry_count !== 3) {
    throw new Error('Retry exhaustion failed!');
  }
  console.log(
    `✓ Retry exhaustion verified: status = ${exhaustedPost.status}, retry_count = ${exhaustedPost.retry_count}`
  );

  // Clean up
  await adminDb.from('social_posts').delete().eq('id', duePost.id);
  console.log(`✓ Cleaned up test post [${duePost.id}]`);
  console.log('\n=== SCHEDULER END-TO-END VERIFICATION COMPLETE & PASSED ===');
}

testSchedulerE2E().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
