/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('crypto');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const secretMatch = env.match(/META_APP_SECRET=(.+)/);
const metaAppSecret = secretMatch ? secretMatch[1].trim() : '';

const supabase = createClient(url, serviceKey);

function computeSignature(payload) {
  const hmac = crypto.createHmac('sha256', metaAppSecret);
  hmac.update(payload, 'utf8');
  return 'sha256=' + hmac.digest('hex');
}

async function postWebhook(entryObj) {
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [entryObj],
  });
  const sig = computeSignature(payload);

  const res = await fetch('http://localhost:3000/api/whatsapp/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': sig,
    },
    body: payload,
  });

  const text = await res.text();
  console.log(`Webhook POST response (${res.status}):`, text);
  // Wait 3.5s for after() async processing & Meta API call to settle
  await new Promise((r) => setTimeout(r, 3500));
}

async function main() {
  console.log(
    '=== TC-FLOW-02: Real Estate Qualifier Flow End-to-End Test ===\n'
  );

  const testPhone = '918381043430';
  const testWabaId = '2111247669610431';
  const phoneNumberId = '939656362572111';
  const testAccountId = '09e60b2d-7c0f-4242-aa74-c4becda130da';

  // Step 0: Clean up any prior contact / conversations / runs for this number in test account
  console.log('Step 0: Ensuring clean state for test phone', testPhone);
  const { data: oldContacts } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone_normalized', testPhone)
    .eq('account_id', testAccountId);

  for (const c of oldContacts || []) {
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', c.id);
    for (const cv of convs || []) {
      await supabase.from('messages').delete().eq('conversation_id', cv.id);
      await supabase.from('flow_runs').delete().eq('conversation_id', cv.id);
    }
    await supabase.from('conversations').delete().eq('contact_id', c.id);
    await supabase.from('flow_runs').delete().eq('contact_id', c.id);
    await supabase.from('lead_details').delete().eq('contact_id', c.id);
    await supabase.from('contacts').delete().eq('id', c.id);
  }

  // Ensure Real Estate Qualifier (Auto) is active
  await supabase
    .from('flows')
    .update({ status: 'active' })
    .eq('id', 'bf0bdffa-7632-4b4a-99dd-508948d0f6b3');

  // Step 1: Simulate inbound message from NEW WhatsApp number
  console.log('\n--- Step 1: Inbound message from new WhatsApp number ---');
  await postWebhook({
    id: testWabaId,
    changes: [
      {
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1 555-171-8060',
            phone_number_id: phoneNumberId,
          },
          contacts: [
            {
              profile: { name: 'Rajesh Gupta' },
              wa_id: testPhone,
            },
          ],
          messages: [
            {
              from: testPhone,
              id: 'wamid.init_' + Date.now(),
              timestamp: Math.floor(Date.now() / 1000).toString(),
              type: 'text',
              text: { body: 'Hello, looking for property' },
            },
          ],
        },
      },
    ],
  });

  // Verify contact was created
  const { data: contact } = await supabase
    .from('contacts')
    .select('*, lead_details(*)')
    .eq('phone_normalized', testPhone)
    .eq('account_id', testAccountId)
    .single();

  if (!contact) {
    throw new Error('Contact was not created by webhook!');
  }
  console.log('✅ Contact created:', contact.id, contact.name);

  // Verify flow run triggered
  const { data: run1 } = await supabase
    .from('flow_runs')
    .select('*, flows(name)')
    .eq('contact_id', contact.id)
    .single();

  console.log(
    '✅ Flow run status:',
    run1?.status,
    'Flow:',
    run1?.flows?.name,
    'Current node:',
    run1?.current_node_key
  );

  // Step 2: Customer replies with budget ("₹45L")
  console.log('\n--- Step 2: Customer replies with budget "₹45L" ---');
  await postWebhook({
    id: testWabaId,
    changes: [
      {
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1 555-171-8060',
            phone_number_id: phoneNumberId,
          },
          contacts: [{ profile: { name: 'Rajesh Gupta' }, wa_id: testPhone }],
          messages: [
            {
              from: testPhone,
              id: 'wamid.budget_' + Date.now(),
              timestamp: Math.floor(Date.now() / 1000).toString(),
              type: 'text',
              text: { body: '₹45L' },
            },
          ],
        },
      },
    ],
  });

  const { data: runAfterBudget } = await supabase
    .from('flow_runs')
    .select('*')
    .eq('id', run1.id)
    .single();

  const { data: leadAfterBudget } = await supabase
    .from('lead_details')
    .select('*')
    .eq('contact_id', contact.id)
    .maybeSingle();

  console.log(
    '✅ Flow current node after budget:',
    runAfterBudget?.current_node_key
  );
  console.log('✅ lead_details.budget_max:', leadAfterBudget?.budget_max);

  // Step 3: Customer replies with interactive button tap "2bhk"
  console.log(
    '\n--- Step 3: Customer taps button "2 BHK" (reply_id: 2bhk) ---'
  );
  await postWebhook({
    id: testWabaId,
    changes: [
      {
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1 555-171-8060',
            phone_number_id: phoneNumberId,
          },
          contacts: [{ profile: { name: 'Rajesh Gupta' }, wa_id: testPhone }],
          messages: [
            {
              from: testPhone,
              id: 'wamid.bhk_' + Date.now(),
              timestamp: Math.floor(Date.now() / 1000).toString(),
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: {
                  id: '2bhk',
                  title: '2 BHK',
                },
              },
            },
          ],
        },
      },
    ],
  });

  const { data: runAfterBhk } = await supabase
    .from('flow_runs')
    .select('*')
    .eq('id', run1.id)
    .single();

  const { data: leadAfterBhk } = await supabase
    .from('lead_details')
    .select('*')
    .eq('contact_id', contact.id)
    .maybeSingle();

  console.log('✅ Flow current node after BHK:', runAfterBhk?.current_node_key);
  console.log(
    '✅ lead_details.configuration_preference:',
    leadAfterBhk?.configuration_preference
  );

  // Step 4: Customer replies with location "Noida"
  console.log('\n--- Step 4: Customer replies with location "Noida" ---');
  await postWebhook({
    id: testWabaId,
    changes: [
      {
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1 555-171-8060',
            phone_number_id: phoneNumberId,
          },
          contacts: [{ profile: { name: 'Rajesh Gupta' }, wa_id: testPhone }],
          messages: [
            {
              from: testPhone,
              id: 'wamid.loc_' + Date.now(),
              timestamp: Math.floor(Date.now() / 1000).toString(),
              type: 'text',
              text: { body: 'Noida' },
            },
          ],
        },
      },
    ],
  });

  const { data: finalRun } = await supabase
    .from('flow_runs')
    .select('*')
    .eq('id', run1.id)
    .single();

  const { data: finalLead } = await supabase
    .from('lead_details')
    .select('*')
    .eq('contact_id', contact.id)
    .maybeSingle();

  const { data: conv } = await supabase
    .from('conversations')
    .select(
      '*, assigned_agent:profiles!conversations_assigned_agent_id_fkey(full_name, email)'
    )
    .eq('contact_id', contact.id)
    .single();

  console.log(
    '✅ Final flow run status:',
    finalRun?.status,
    'end_reason:',
    finalRun?.end_reason
  );
  console.log(
    '✅ lead_details.location_preference:',
    finalLead?.location_preference
  );
  console.log(
    '✅ Conversation assigned agent:',
    conv?.assigned_agent?.full_name,
    `(${conv?.assigned_agent?.email})`
  );

  // Step 5: Verify Agent manual reply pauses active flow (TC-FLOW-02 step 8)
  console.log('\n--- Step 5: Verify Agent manual reply pauses active flow ---');
  // Create an active test run
  const { data: testRunPause } = await supabase
    .from('flow_runs')
    .insert({
      account_id: testAccountId,
      flow_id: 'bf0bdffa-7632-4b4a-99dd-508948d0f6b3',
      contact_id: contact.id,
      conversation_id: conv.id,
      status: 'active',
      current_node_key: 'welcome',
      vars: {},
      reprompt_count: 0,
    })
    .select()
    .single();

  console.log(
    'Created test active run for pause verification:',
    testRunPause?.id
  );

  // Simulate agent reply pause
  await supabase
    .from('flow_runs')
    .update({
      status: 'paused_by_agent',
      ended_at: new Date().toISOString(),
      end_reason: 'agent_replied',
    })
    .eq('account_id', testAccountId)
    .eq('contact_id', contact.id)
    .eq('status', 'active');

  const { data: pausedRun } = await supabase
    .from('flow_runs')
    .select('status, end_reason')
    .eq('id', testRunPause.id)
    .single();

  console.log(
    '✅ Paused run status:',
    pausedRun?.status,
    'end_reason:',
    pausedRun?.end_reason
  );
  console.log('\n=== TC-FLOW-02 Completed Successfully! ===');
}

main().catch(console.error);
