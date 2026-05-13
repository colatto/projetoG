import { getSupabase } from '../supabase.js';
import { getSiengeClient } from '../sienge.js';

async function run() {
  const supabase = getSupabase();
  const siengeClient = await getSiengeClient(supabase);
  
  const page = await siengeClient.get<any>('/purchase-orders?limit=1');
  console.log(JSON.stringify(page.results[0], null, 2));
}

run();
