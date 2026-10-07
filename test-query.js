/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data } = await supabase
    .from('contacts')
    .select('id, name, lead_details(*)')
    .eq('name', 'Rohit Sharma')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log(JSON.stringify(data, null, 2));
}
run();
