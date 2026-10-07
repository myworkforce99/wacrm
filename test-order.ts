import { createClient } from '@supabase/supabase-js';
const supabase = createClient('http://localhost', 'abc');
supabase.from('contacts').select('id, deals(id)').order('created_at', { referencedTable: 'deals', ascending: false });
