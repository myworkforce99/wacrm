require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  await supabase.rpc('execute_sql', {
    sql: `
      CREATE OR REPLACE VIEW contacts_with_ownership AS
      SELECT c.*,
        (
          c.user_id = auth.uid() OR
          EXISTS (SELECT 1 FROM conversations conv WHERE conv.contact_id = c.id AND conv.assigned_agent_id = auth.uid()) OR
          EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = c.id AND d.assigned_to = auth.uid())
        ) AS is_mine
      FROM contacts c;
    `
  });
  
  const { data, error } = await supabase.from('contacts_with_ownership').select('id, name, is_mine, deals(status)').limit(1);
  console.log("View test:", data, error);
}
run();
