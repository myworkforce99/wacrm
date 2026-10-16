/**
 * scripts/seed-multi-agent-testing.js
 *
 * Seeds a clean organization ("Apex Horizon Realty") from scratch for Multi-Agent
 * WhatsApp workflow testing using Meta App credentials from whatsapp_credentials.md.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing required environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Meta test app details from whatsapp_credentials.md
const META_CREDENTIALS = {
  phoneNumberId: '939656362572111',
  wabaId: '2111247669610431',
  accessToken:
    'test-meta-token',
  verifyToken: 'wacrm',
  testRecipientNumber: '+1 (555) 171-8060',
  callbackUrl:
    'https://rebel-tipping-prenatal.ngrok-free.dev/api/whatsapp/webhook',
};

function encryptToken(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

async function findOrCreateUser(email, password, fullName) {
  const { data: listData } = await supabase.auth.admin.listUsers();
  const existing = listData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    console.log(`  User already exists: ${email} (${existing.id})`);
    // Ensure password is reset to Test@1234
    await supabase.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { full_name: fullName },
      email_confirm: true,
    });
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    throw new Error(`Failed to create user ${email}: ${error.message}`);
  }
  console.log(`  Created user: ${email} (${data.user.id})`);
  return data.user.id;
}

async function main() {
  console.log('====================================================');
  console.log('🚀 Seeding Multi-Agent Test Account: Apex Horizon Realty');
  console.log('====================================================\n');

  const defaultPassword = 'Test@1234';

  const teamMembers = [
    {
      role: 'owner',
      email: 'owner@apexrealty.in',
      name: 'Arjun Malhotra',
      available: true,
    },
    {
      role: 'admin',
      email: 'admin@apexrealty.in',
      name: 'Neha Sharma',
      available: true,
    },
    {
      role: 'agent',
      email: 'agent1@apexrealty.in',
      name: 'Vikram Singh',
      available: true,
    },
    {
      role: 'agent',
      email: 'agent2@apexrealty.in',
      name: 'Ananya Roy',
      available: true,
    },
    {
      role: 'agent',
      email: 'agent3@apexrealty.in',
      name: 'Karan Verma',
      available: false, // On Leave
    },
    {
      role: 'viewer',
      email: 'viewer@apexrealty.in',
      name: 'Pooja Iyer',
      available: false,
    },
  ];

  console.log('Step 1: Creating / verifying auth users...');
  const userMap = {};
  for (const m of teamMembers) {
    userMap[m.role === 'agent' ? m.email : m.role] = await findOrCreateUser(
      m.email,
      defaultPassword,
      m.name
    );
  }

  const ownerUserId = userMap['owner'];

  // 1. Resolve or set up owner's account
  console.log('\nStep 2: Configuring multi-tenant account...');
  let { data: ownerProfile } = await supabase
    .from('profiles')
    .select('id, account_id')
    .eq('user_id', ownerUserId)
    .single();

  let accountId = ownerProfile?.account_id;

  if (!accountId) {
    // Create accounts row if missing
    const { data: newAcc, error: accErr } = await supabase
      .from('accounts')
      .insert({
        name: 'Apex Horizon Realty',
        owner_user_id: ownerUserId,
        default_currency: 'INR',
      })
      .select('id')
      .single();
    if (accErr) throw accErr;
    accountId = newAcc.id;

    await supabase
      .from('profiles')
      .update({ account_id: accountId, account_role: 'owner' })
      .eq('user_id', ownerUserId);
  } else {
    // Update account name
    await supabase
      .from('accounts')
      .update({ name: 'Apex Horizon Realty', default_currency: 'INR' })
      .eq('id', accountId);
  }

  console.log(`  Account ID: ${accountId}`);

  // 2. Link all team members to this single account
  console.log('\nStep 3: Unifying team members under Apex Horizon Realty...');
  for (const m of teamMembers) {
    const userId = userMap[m.role === 'agent' ? m.email : m.role];

    // Fetch existing profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, account_id')
      .eq('user_id', userId)
      .maybeSingle();

    const oldAccId = prof?.account_id;

    if (prof) {
      await supabase
        .from('profiles')
        .update({
          account_id: accountId,
          account_role: m.role,
          full_name: m.name,
          email: m.email,
          is_available: m.available,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      await supabase.from('profiles').insert({
        user_id: userId,
        account_id: accountId,
        account_role: m.role,
        full_name: m.name,
        email: m.email,
        is_available: m.available,
      });
    }

    // Clean up empty orphan account if different from accountId
    if (oldAccId && oldAccId !== accountId) {
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', oldAccId);
      if (count === 0) {
        await supabase.from('accounts').delete().eq('id', oldAccId);
      }
    }

    console.log(`  Linked ${m.name} (${m.email}) -> Role: ${m.role}, Available: ${m.available}`);
  }

  // 3. Configure WhatsApp Business Channel
  console.log('\nStep 4: Linking WhatsApp Business Channel (Phone ID: 939656362572111)...');
  // Clear any existing claim on this phone_number_id from old accounts
  await supabase
    .from('whatsapp_config')
    .delete()
    .eq('phone_number_id', META_CREDENTIALS.phoneNumberId);

  // Clear any existing config for this account
  await supabase.from('whatsapp_config').delete().eq('account_id', accountId);

  const encryptedToken = encryptToken(META_CREDENTIALS.accessToken);
  const encryptedVerifyToken = encryptToken(META_CREDENTIALS.verifyToken);
  const { error: waError } = await supabase.from('whatsapp_config').insert({
    account_id: accountId,
    user_id: ownerUserId,
    phone_number_id: META_CREDENTIALS.phoneNumberId,
    waba_id: META_CREDENTIALS.wabaId,
    access_token: encryptedToken,
    verify_token: encryptedVerifyToken,
    status: 'connected',
    connected_at: new Date().toISOString(),
    registered_at: new Date().toISOString(),
    subscribed_apps_at: new Date().toISOString(),
    mirror_inbound_media: true,
  });

  if (waError) throw new Error(`Failed to configure WhatsApp: ${waError.message}`);
  console.log('  WhatsApp configuration successfully saved and encrypted.');

  // 4. Ensure Pipeline & Stages
  console.log('\nStep 5: Verifying Real Estate Pipeline & Stages...');
  let { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!pipeline) {
    const { data: newPipe, error: pipeErr } = await supabase
      .from('pipelines')
      .insert({
        account_id: accountId,
        user_id: ownerUserId,
        name: 'Real Estate',
      })
      .select('id')
      .single();
    if (pipeErr) throw pipeErr;
    pipeline = newPipe;
  }

  const pipelineStages = [
    { name: 'New', position: 0, color: '#3b82f6' },
    { name: 'Contacted', position: 1, color: '#8b5cf6' },
    { name: 'Site Visit', position: 2, color: '#ec4899' },
    { name: 'Negotiation', position: 3, color: '#f59e0b' },
    { name: 'Closed', position: 4, color: '#10b981' },
  ];

  for (const s of pipelineStages) {
    const { data: existStage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('pipeline_id', pipeline.id)
      .eq('name', s.name)
      .maybeSingle();

    if (!existStage) {
      await supabase.from('pipeline_stages').insert({
        pipeline_id: pipeline.id,
        name: s.name,
        position: s.position,
        color: s.color,
      });
    }
  }
  console.log('  Real Estate pipeline and 5 Kanban stages ready.');

  // 5. Seed Properties
  console.log('\nStep 6: Seeding Property Inventory...');
  const properties = [
    {
      title: 'Apex Grandeur — 3BHK Lake View',
      location: 'Powai, Mumbai',
      price: 16500000,
      property_type: 'apartment',
      bedrooms: 3,
      carpet_area: 1500,
      configuration: '3BHK',
      facing: 'North-East',
      rera_id: 'P51800028911',
      builder_name: 'Apex Developers',
      project_name: 'Apex Grandeur',
      possession_status: 'ready_to_move',
    },
    {
      title: 'Apex Grandeur — 2BHK City View',
      location: 'Powai, Mumbai',
      price: 11000000,
      property_type: 'apartment',
      bedrooms: 2,
      carpet_area: 1050,
      configuration: '2BHK',
      facing: 'East',
      rera_id: 'P51800028911',
      builder_name: 'Apex Developers',
      project_name: 'Apex Grandeur',
      possession_status: 'ready_to_move',
    },
    {
      title: 'Horizon Bay Towers — 4BHK Seafront',
      location: 'Worli, Mumbai',
      price: 45000000,
      property_type: 'apartment',
      bedrooms: 4,
      carpet_area: 2900,
      configuration: '4BHK',
      facing: 'West',
      rera_id: 'P51900034120',
      builder_name: 'Horizon Group',
      project_name: 'Horizon Bay',
      possession_status: 'under_construction',
    },
    {
      title: 'Emerald Luxury Villa — 4BHK',
      location: 'Thane West',
      price: 22500000,
      property_type: 'villa',
      bedrooms: 4,
      carpet_area: 3400,
      configuration: 'Villa',
      facing: 'East',
      rera_id: 'P51700019876',
      builder_name: 'Emerald Homes',
      project_name: 'Emerald Villas',
      possession_status: 'ready_to_move',
    },
  ];

  for (const p of properties) {
    const { data: existProp } = await supabase
      .from('properties')
      .select('id')
      .eq('account_id', accountId)
      .eq('title', p.title)
      .maybeSingle();

    if (!existProp) {
      await supabase.from('properties').insert({
        account_id: accountId,
        ...p,
      });
    }
  }
  console.log(`  Seeded ${properties.length} properties with RERA IDs and INR pricing.`);

  // 6. Seed Tags
  console.log('\nStep 7: Seeding Tags...');
  const tags = [
    { name: 'hot-lead', color: '#ef4444' },
    { name: 'investor', color: '#8b5cf6' },
    { name: 'first-time-buyer', color: '#10b981' },
    { name: 'nri', color: '#f59e0b' },
  ];

  for (const t of tags) {
    const { data: existTag } = await supabase
      .from('tags')
      .select('id')
      .eq('account_id', accountId)
      .eq('name', t.name)
      .maybeSingle();

    if (!existTag) {
      await supabase.from('tags').insert({
        account_id: accountId,
        user_id: ownerUserId,
        name: t.name,
        color: t.color,
      });
    }
  }
  console.log('  Seeded standard CRM tags (hot-lead, investor, etc.).');

  // 7. Seed Lead Routing Rules
  console.log('\nStep 8: Seeding Lead Routing Rules...');
  await supabase.from('lead_routing_rules').delete().eq('account_id', accountId);

  await supabase.from('lead_routing_rules').insert([
    {
      account_id: accountId,
      priority: 1,
      condition_type: 'budget_gte',
      condition_value: '20000000', // >= 2 Cr
      action_type: 'assign_to_role',
      action_value: 'admin',
      is_active: true,
    },
    {
      account_id: accountId,
      priority: 2,
      condition_type: 'configuration',
      condition_value: '3BHK',
      action_type: 'assign_to_role',
      action_value: 'agent',
      is_active: true,
    },
  ]);
  console.log('  Seeded priority routing rules (Luxury to Admin, 3BHK to Agent).');

  // 8. Seed Agent Monthly Targets
  console.log('\nStep 9: Seeding Agent Targets...');
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

  const agent1Id = userMap['agent1@apexrealty.in'];
  const agent2Id = userMap['agent2@apexrealty.in'];
  const agent3Id = userMap['agent3@apexrealty.in'];

  await supabase.from('agent_targets').delete().eq('account_id', accountId);

  await supabase.from('agent_targets').insert([
    {
      account_id: accountId,
      agent_id: agent1Id,
      period_start: periodStart,
      period_end: periodEnd,
      target_visits: 15,
      target_bookings: 3,
    },
    {
      account_id: accountId,
      agent_id: agent2Id,
      period_start: periodStart,
      period_end: periodEnd,
      target_visits: 12,
      target_bookings: 2,
    },
    {
      account_id: accountId,
      agent_id: agent3Id,
      period_start: periodStart,
      period_end: periodEnd,
      target_visits: 10,
      target_bookings: 2,
    },
  ]);
  console.log('  Configured monthly targets for sales agents.');

  // 9. Seed Initial Contacts & Conversations for Workflow Testing
  console.log('\nStep 10: Seeding Initial Workflow Leads & Conversations...');

  // Contact 1: Assigned to Agent 1 (Vikram)
  const { data: c1 } = await supabase
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: ownerUserId,
      name: 'Rohan Mehra',
      phone: '+919876543201',
      email: 'rohan.mehra@example.com',
      company: 'Tech Mahindra',
    })
    .select('id')
    .single();

  if (c1) {
    await supabase.from('lead_details').insert({
      account_id: accountId,
      contact_id: c1.id,
      source: '99acres',
      budget_min: 12000000,
      budget_max: 18000000,
      configuration_preference: ['3BHK'],
      location_preference: 'Powai',
      possession_preference: 'ready_to_move_only',
    });

    const { data: conv1 } = await supabase
      .from('conversations')
      .insert({
        account_id: accountId,
        user_id: ownerUserId,
        contact_id: c1.id,
        assigned_agent_id: agent1Id,
        status: 'open',
        last_message_text: 'Looking for a 3BHK in Powai under 1.8 Cr',
        last_message_at: new Date(Date.now() - 3600000).toISOString(), // 1h ago
        unread_count: 1,
      })
      .select('id')
      .single();

    if (conv1) {
      await supabase.from('messages').insert({
        conversation_id: conv1.id,
        sender_type: 'customer',
        message_type: 'text',
        content_text: 'Looking for a 3BHK in Powai under 1.8 Cr. Can we see Apex Grandeur?',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      });
    }
  }

  // Contact 2: Assigned to Agent 2 (Ananya)
  const { data: c2 } = await supabase
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: ownerUserId,
      name: 'Sunita Deshmukh',
      phone: '+919876543202',
      email: 'sunita.d@example.com',
      company: 'TCS',
    })
    .select('id')
    .single();

  if (c2) {
    await supabase.from('lead_details').insert({
      account_id: accountId,
      contact_id: c2.id,
      source: 'MagicBricks',
      budget_min: 9000000,
      budget_max: 12000000,
      configuration_preference: ['2BHK'],
      location_preference: 'Powai',
    });

    const { data: conv2 } = await supabase
      .from('conversations')
      .insert({
        account_id: accountId,
        user_id: ownerUserId,
        contact_id: c2.id,
        assigned_agent_id: agent2Id,
        status: 'open',
        last_message_text: 'Hi Sunita, would Saturday 11 AM work for the visit?',
        last_message_at: new Date(Date.now() - 7200000).toISOString(), // 2h ago
        unread_count: 0,
      })
      .select('id')
      .single();

    if (conv2) {
      await supabase.from('messages').insert({
        conversation_id: conv2.id,
        sender_type: 'agent',
        message_type: 'text',
        content_text: 'Hi Sunita, would Saturday 11 AM work for the visit?',
        created_at: new Date(Date.now() - 7200000).toISOString(),
      });
    }
  }

  // Contact 3: Unassigned Pool Lead (Waiting for claim or auto-route)
  const { data: c3 } = await supabase
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: ownerUserId,
      name: 'Kunal Shah',
      phone: '+919876543203',
      email: 'kunal.shah@example.com',
      company: 'HDFC Securities',
    })
    .select('id')
    .single();

  if (c3) {
    await supabase.from('lead_details').insert({
      account_id: accountId,
      contact_id: c3.id,
      source: 'Meta Ads',
      budget_min: 40000000,
      budget_max: 50000000,
      configuration_preference: ['4BHK'],
      location_preference: 'Worli',
    });

    const { data: conv3 } = await supabase
      .from('conversations')
      .insert({
        account_id: accountId,
        user_id: ownerUserId,
        contact_id: c3.id,
        assigned_agent_id: null, // Unassigned!
        status: 'open',
        last_message_text: 'Need details on sea-facing 4BHK towers in Worli.',
        last_message_at: new Date(Date.now() - 1800000).toISOString(), // 30m ago
        unread_count: 1,
      })
      .select('id')
      .single();

    if (conv3) {
      await supabase.from('messages').insert({
        conversation_id: conv3.id,
        sender_type: 'customer',
        message_type: 'text',
        content_text: 'Need details on sea-facing 4BHK towers in Worli.',
        created_at: new Date(Date.now() - 1800000).toISOString(),
      });
    }
  }

  // Contact 4: Meta Test Number (+1 555 171-8060)
  const { data: c4 } = await supabase
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: ownerUserId,
      name: 'WhatsApp Meta Tester',
      phone: META_CREDENTIALS.testRecipientNumber,
      email: 'tester@meta.com',
    })
    .select('id')
    .single();

  if (c4) {
    await supabase.from('lead_details').insert({
      account_id: accountId,
      contact_id: c4.id,
      source: 'Website',
      budget_min: 15000000,
      budget_max: 20000000,
      configuration_preference: ['3BHK'],
      location_preference: 'Powai',
    });

    await supabase.from('conversations').insert({
      account_id: accountId,
      user_id: ownerUserId,
      contact_id: c4.id,
      assigned_agent_id: null,
      status: 'open',
      last_message_text: 'Ready for live webhook test.',
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    });
  }

  console.log('  Seeded 4 initial contacts: 1 assigned to Vikram, 1 to Ananya, 1 Unassigned, 1 Meta Test number.');

  console.log('\n====================================================');
  console.log('🎉 SEEDING COMPLETE FOR: Apex Horizon Realty');
  console.log(`Account ID: ${accountId}`);
  console.log('Logins (All passwords: Test@1234):');
  console.log('  Owner:   owner@apexrealty.in  (Arjun Malhotra)');
  console.log('  Admin:   admin@apexrealty.in  (Neha Sharma)');
  console.log('  Agent 1: agent1@apexrealty.in (Vikram Singh - Available)');
  console.log('  Agent 2: agent2@apexrealty.in (Ananya Roy - Available)');
  console.log('  Agent 3: agent3@apexrealty.in (Karan Verma - On Leave)');
  console.log('  Viewer:  viewer@apexrealty.in (Pooja Iyer - Read Only)');
  console.log('WhatsApp:');
  console.log(`  Phone Number ID: ${META_CREDENTIALS.phoneNumberId}`);
  console.log(`  WABA ID:         ${META_CREDENTIALS.wabaId}`);
  console.log(`  Verify Token:    ${META_CREDENTIALS.verifyToken}`);
  console.log(`  Callback URL:    ${META_CREDENTIALS.callbackUrl}`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error seeding data:', err);
  process.exit(1);
});
