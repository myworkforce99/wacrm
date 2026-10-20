import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  SOCIAL_POST_TEMPLATES,
  getTemplatesByCategory,
  getTemplateById,
} from '../src/lib/social/templates';

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

const ACCOUNT_ID = '09e60b2d-7c0f-4242-aa74-c4becda130da'; // Apex Horizon Realty

async function runPhase3Verification() {
  console.log('=== PHASE 3 DEEP DATA WIRING, API & DB VERIFICATION ===\n');

  // 1. Verify Templates Library
  console.log('1. Verifying Templates Library:');
  expect(SOCIAL_POST_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  for (const tpl of SOCIAL_POST_TEMPLATES) {
    console.log(
      `  ✓ Template [${tpl.id}] - ${tpl.title} (${tpl.category}): ${tpl.suggestedHashtags.join(' ')}`
    );
  }

  const launchTemplates = getTemplatesByCategory('property_launch');
  expect(launchTemplates.length).toBeGreaterThan(0);
  console.log(
    `  ✓ Filter by category works: ${launchTemplates.length} launch templates found.`
  );

  const siteVisitTpl = getTemplateById('site-visit-invite');
  expect(siteVisitTpl).toBeDefined();
  console.log(`  ✓ Lookup by ID works: "${siteVisitTpl?.title}" found.`);

  // 2. Verify Remote DB Configuration (Supabase)
  console.log('\n2. Verifying Remote Database Configuration:');
  const { data: aiConfig, error: aiErr } = await adminDb
    .from('ai_configs')
    .select('provider, model, is_active')
    .eq('account_id', ACCOUNT_ID)
    .single();

  if (aiErr || !aiConfig) {
    console.warn('  ⚠ No ai_configs found for test account, check settings.');
  } else {
    console.log(
      `  ✓ Remote AI Config: Provider=${aiConfig.provider}, Model=${aiConfig.model}, Active=${aiConfig.is_active}`
    );
  }

  const { data: accounts, error: accErr } = await adminDb
    .from('social_accounts')
    .select('id, platform, display_name, is_active')
    .eq('account_id', ACCOUNT_ID)
    .eq('is_active', true)
    .limit(1);

  if (accErr || !accounts?.length) {
    throw new Error('No active social account found in remote database.');
  }
  const socialAccount = accounts[0];
  console.log(
    `  ✓ Remote Social Account: ${socialAccount.display_name} (${socialAccount.platform})`
  );

  // 3. Simulate End-to-End Post Creation with AI Caption & Template Hashtags
  console.log('\n3. Verifying Post Creation with AI Caption + Template:');
  const chosenTemplate = SOCIAL_POST_TEMPLATES[0]; // New Project Launch
  const mockGeneratedCaption =
    '✨ Introducing Apex Sky Villas in Worli, Mumbai! Exclusive 4BHK residences starting at ₹12.5 Cr. Experience panoramic sea views & luxury amenities. Book your private walkthrough today!\n\n' +
    chosenTemplate.suggestedHashtags.join(' ');

  const { data: newPost, error: insertErr } = await adminDb
    .from('social_posts')
    .insert({
      account_id: ACCOUNT_ID,
      social_account_id: socialAccount.id,
      caption: mockGeneratedCaption,
      media_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9',
      status: 'draft',
    })
    .select('*')
    .single();

  if (insertErr || !newPost) {
    throw new Error(`Failed to insert post: ${insertErr?.message}`);
  }
  console.log(
    `  ✓ Successfully inserted social post with AI caption and template: [ID: ${newPost.id}]`
  );
  console.log(`    Status: ${newPost.status}`);
  console.log(`    Caption length: ${newPost.caption.length} chars`);
  console.log(
    `    Hashtags included: ${chosenTemplate.suggestedHashtags.every((tag) => newPost.caption.includes(tag)) ? 'YES' : 'NO'}`
  );

  // 4. Verify Remote DB Query & Readback
  console.log('\n4. Verifying Remote DB Query & Readback:');
  const { data: readback, error: readErr } = await adminDb
    .from('social_posts')
    .select('*, social_account:social_accounts(platform, display_name)')
    .eq('id', newPost.id)
    .single();

  if (readErr || !readback) {
    throw new Error(`Failed to read back post: ${readErr?.message}`);
  }
  console.log(
    `  ✓ Remote DB Readback Verified: Post ID ${readback.id} linked to ${readback.social_account.display_name}`
  );

  // Clean up test post
  await adminDb.from('social_posts').delete().eq('id', newPost.id);
  console.log(`  ✓ Cleaned up verification post ID ${newPost.id}`);

  console.log('\n=== ALL PHASE 3 DEEP VERIFICATION CHECKS PASSED ===\n');
}

function expect(val: any) {
  return {
    toBeGreaterThanOrEqual: (expected: number) => {
      if (val < expected) throw new Error(`Expected ${val} >= ${expected}`);
    },
    toBeGreaterThan: (expected: number) => {
      if (val <= expected) throw new Error(`Expected ${val} > ${expected}`);
    },
    toBeDefined: () => {
      if (val === undefined || val === null)
        throw new Error('Expected value to be defined');
    },
  };
}

runPhase3Verification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
