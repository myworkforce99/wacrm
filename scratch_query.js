import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const fortyEightHoursAgo = new Date(
    Date.now() - 48 * 60 * 60 * 1000
  ).toISOString();

  const { data: staleDeals, error: dealsErr } = await supabase
    .from('deals')
    .select(
      '*, stage:pipeline_stages(name), contact:contacts(id, name, conversations!inner(assigned_agent_id))'
    )
    .lt('updated_at', fortyEightHoursAgo)
    .in('stage.name', ['New', 'Contacted'])
    .not('contact.conversations', 'is', null);

  console.log('Error:', dealsErr);
  console.log('Data count:', staleDeals?.length);
}

test();
