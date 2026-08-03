import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data, error } = await supabase.from('patient_fee_records').select('patient_id, record_date, is_recurring, item_name, unit, fee_item_id').order('record_date', { ascending: false }).limit(200);
  if (error) { console.error(error); return; }
  console.log('Total rows fetched:', data.length);
  const byMonth = {};
  for (const r of data) {
    const m = r.record_date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(r);
  }
  for (const m of Object.keys(byMonth).sort()) {
    const recs = byMonth[m];
    const recurring = recs.filter(r => r.is_recurring);
    console.log(`${m}: ${recs.length} rows, ${recurring.length} recurring`);
    for (const r of recurring.slice(0, 5)) {
      console.log(`  patient_id=${r.patient_id} item=${r.item_name} unit=${r.unit} fee_item_id=${r.fee_item_id}`);
    }
  }
}
main();
