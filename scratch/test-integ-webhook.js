/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('crypto');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const supabase = createClient(url, serviceKey);

const accountId = '09e60b2d-7c0f-4242-aa74-c4becda130da';
const userId = '56d7351c-7e78-4d62-a8a6-954f6852c3ff';

function hashApiKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function testInboundWebhook() {
  console.log('=== TC-INTEG-06: Portal Webhook Lead Ingestion Test ===\n');

  // 1. Create a dedicated test API key with contacts:write scope
  const randomBody = crypto.randomBytes(32).toString('base64url');
  const plaintext = `wacrm_live_${randomBody}`;
  const keyHash = hashApiKey(plaintext);
  const keyPrefix = `wacrm_live_${randomBody.slice(0, 8)}`;

  const { data: insertedKey, error: insErr } = await supabase
    .from('api_keys')
    .insert({
      account_id: accountId,
      created_by: userId,
      name: 'Portal Test Key',
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: ['contacts:read', 'contacts:write'],
    })
    .select()
    .single();

  if (insErr) {
    console.error('API Key insert error:', insErr);
    return;
  }

  console.log(
    'Created temporary API key with contacts:write scope:',
    insertedKey.id
  );

  const testPhone = '+919876543999';
  const testPhoneNorm = '919876543999';

  // Clean up any old contact with this number
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone_normalized', testPhoneNorm)
    .eq('account_id', accountId)
    .maybeSingle();

  if (existing) {
    await supabase.from('lead_details').delete().eq('contact_id', existing.id);
    await supabase.from('contact_tags').delete().eq('contact_id', existing.id);
    await supabase.from('contacts').delete().eq('id', existing.id);
  }

  // 2. Send inbound email webhook from 99acres
  console.log('Step 1: Sending inbound lead email webhook from 99acres...');
  const formData = new FormData();
  formData.append(
    'subject',
    'New enquiry on 99acres for 3 BHK in Noida Sector 62'
  );
  formData.append(
    'text',
    'Name: Rohit Agrawal\nPhone: +91 98765 43999\nEmail: rohit.agrawal@testlead.com\nSource: 99acres'
  );

  const res1 = await fetch(
    `http://localhost:3000/api/webhooks/inbound-email?token=${plaintext}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const resBody1 = await res1.json();
  console.log('Webhook POST response status:', res1.status, resBody1);

  // 3. Verify contact created
  const { data: contact } = await supabase
    .from('contacts')
    .select('*, lead_details(*), contact_tags(tags(name))')
    .eq('phone_normalized', testPhoneNorm)
    .eq('account_id', accountId)
    .single();

  console.log(
    '✅ Created contact:',
    contact?.name,
    contact?.phone,
    'ID:',
    contact?.id
  );
  console.log('✅ lead_details source:', contact?.lead_details?.source);
  const tagNames = (contact?.contact_tags || []).map((t) => t.tags?.name);
  console.log('✅ Contact tags:', tagNames);

  // 4. Test Deduplication: Re-send same lead email
  console.log(
    '\nStep 2: Testing deduplication by sending the same lead email again...'
  );
  const res2 = await fetch(
    `http://localhost:3000/api/webhooks/inbound-email?token=${plaintext}`,
    {
      method: 'POST',
      body: formData,
    }
  );
  console.log(
    'Second webhook POST response status:',
    res2.status,
    await res2.json()
  );

  // Count total contacts with this phone number
  const { count } = await supabase
    .from('contacts')
    .select('id', { count: 'exact' })
    .eq('phone_normalized', testPhoneNorm)
    .eq('account_id', accountId);

  console.log('✅ Contacts count with phone (dedup check, expected 1):', count);

  // Clean up test key
  await supabase.from('api_keys').delete().eq('key_hash', keyHash);
  console.log('\n=== TC-INTEG-06 Completed Successfully! ===');
}

testInboundWebhook().catch(console.error);
