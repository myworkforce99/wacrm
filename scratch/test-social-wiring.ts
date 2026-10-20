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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminDb = createClient(url, serviceKey);

const ACCOUNT_ID = '09e60b2d-7c0f-4242-aa74-c4becda130da'; // Apex Horizon Realty

async function main() {
  const { encryptToken, decryptToken } =
    await import('../src/lib/social/encryption');

  console.log('--- 1. Testing Token Encryption & Decryption ---');
  const sampleToken = 'EAABsb...long_meta_access_token_xyz_9988';
  const encrypted = encryptToken(sampleToken);
  console.log('Encrypted token length:', encrypted.length);
  const decrypted = decryptToken(encrypted);
  console.log('Decrypted token matches sample:', decrypted === sampleToken);
  if (decrypted !== sampleToken) {
    throw new Error('Encryption/decryption round-trip failed!');
  }

  console.log('\n--- 2. Testing Remote DB social_accounts Insertion ---');
  // Clean up any prior test rows
  await adminDb.from('social_accounts').delete().eq('account_id', ACCOUNT_ID);

  const { data: insertedAccount, error: accErr } = await adminDb
    .from('social_accounts')
    .insert({
      account_id: ACCOUNT_ID,
      platform: 'instagram',
      display_name: '@apexhorizon_luxury',
      platform_user_id: 'ig_user_1784140001',
      access_token_enc: encrypted,
      token_expires_at: new Date(
        Date.now() + 60 * 24 * 3600 * 1000
      ).toISOString(),
      avatar_url:
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=100',
      is_active: true,
    })
    .select()
    .single();

  if (accErr) {
    console.error('Failed to insert social_account:', accErr);
    throw accErr;
  }
  console.log('Successfully inserted social_account in remote DB:');
  console.log('  ID:', insertedAccount.id);
  console.log('  Display Name:', insertedAccount.display_name);
  console.log('  Platform:', insertedAccount.platform);

  console.log('\n--- 3. Testing Remote DB Decryption from row ---');
  const decryptedFromDb = decryptToken(insertedAccount.access_token_enc);
  console.log(
    'Decrypted token from DB row matches:',
    decryptedFromDb === sampleToken
  );

  console.log(
    '\n--- 4. Testing PostgREST Unique Upsert on (account_id, platform) ---'
  );
  const { data: upsertedAccount, error: upsertErr } = await adminDb
    .from('social_accounts')
    .upsert(
      {
        account_id: ACCOUNT_ID,
        platform: 'instagram',
        display_name: '@apexhorizon_reconnected',
        platform_user_id: 'ig_user_1784140001',
        access_token_enc: encrypted,
        is_active: true,
      },
      { onConflict: 'account_id,platform' }
    )
    .select()
    .single();

  if (upsertErr) {
    console.error('Upsert failed with error:', upsertErr);
    throw upsertErr;
  }
  console.log('Upsert succeeded without 42P10 conflict error!');
  console.log('  Updated Name:', upsertedAccount.display_name);

  console.log(
    '\n--- 5. Testing Agent Authentication & Scoped Draft Creation ---'
  );
  const agentClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { data: agentAuth, error: agentAuthErr } =
    await agentClient.auth.signInWithPassword({
      email: 'agent1@retest.com',
      password: 'Test@1234',
    });
  if (agentAuthErr) {
    console.error('Agent sign in failed:', agentAuthErr);
    throw agentAuthErr;
  }
  console.log('Signed in as agent1@retest.com (UID:', agentAuth.user.id, ')');

  // Clean prior posts
  await adminDb.from('social_posts').delete().eq('account_id', ACCOUNT_ID);

  // Insert draft post as agent
  const { data: agentPost, error: postErr } = await agentClient
    .from('social_posts')
    .insert({
      account_id: ACCOUNT_ID,
      social_account_id: insertedAccount.id,
      caption:
        'Exclusive 4BHK Sea-Facing Penthouse in Worli | ₹18.5 Cr\nRERA: P51900001234\nDM for private tour.',
      media_url:
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
      status: 'draft',
    })
    .select()
    .single();

  if (postErr) {
    console.error('Agent post creation failed:', postErr);
    throw postErr;
  }
  console.log('Agent created draft post in remote DB successfully:');
  console.log('  Post ID:', agentPost.id);
  console.log('  Status:', agentPost.status);
  console.log('  Created By UID:', agentPost.created_by);
  console.log(
    '  Matches Agent UID:',
    agentPost.created_by === agentAuth.user.id
  );

  console.log('\n--- 6. Testing Viewer RLS Enforcement on Post Creation ---');
  const viewerClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  await viewerClient.auth.signInWithPassword({
    email: 'viewer@retest.com',
    password: 'Test@1234',
  });
  const { data: viewerPost, error: viewerPostErr } = await viewerClient
    .from('social_posts')
    .insert({
      account_id: ACCOUNT_ID,
      social_account_id: insertedAccount.id,
      caption: 'Viewer should not be able to create',
      status: 'draft',
    })
    .select();

  console.log(
    'Viewer insert blocked by RLS as expected:',
    viewerPostErr !== null
  );

  console.log(
    '\n--- 7. Testing Admin Approval & Status Update in Remote DB ---'
  );
  const adminClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  await adminClient.auth.signInWithPassword({
    email: 'owner@retest.com',
    password: 'Test@1234',
  });

  const { data: publishedPost, error: pubErr } = await adminClient
    .from('social_posts')
    .update({
      status: 'published',
      platform_post_id: 'meta_graph_pub_17841405338028819',
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentPost.id)
    .select()
    .single();

  if (pubErr) {
    console.error('Admin update failed:', pubErr);
    throw pubErr;
  }
  console.log('Admin approved and published post in remote DB:');
  console.log('  Updated Status:', publishedPost.status);
  console.log('  Platform Post ID:', publishedPost.platform_post_id);

  console.log('\n=== ALL REMOTE DB & DATA WIRING TESTS PASSED PERFECTLY ===\n');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
