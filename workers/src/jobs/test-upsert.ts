import { getSupabase } from '../supabase.js';

async function run() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('purchase_orders').upsert({
    id: 999999,
    supplier_id: 999999, // probably doesn't exist
    local_status: 'PENDENTE',
  });
  console.log('Error:', error);
}

run();
