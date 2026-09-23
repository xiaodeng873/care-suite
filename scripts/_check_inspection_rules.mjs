import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await supabase
  .from('new_medication_prescriptions')
  .select('id, patient_id, medication_name, inspection_rules, status')
  .neq('inspection_rules', '[]')
  .not('inspection_rules', 'is', null);
if (error) { console.error(error); process.exit(1); }
console.log('有檢測規則嘅處方數:', data.length);
for (const r of data) {
  console.log(`- ${r.medication_name} (patient ${r.patient_id}, status ${r.status}):`);
  for (const rule of r.inspection_rules) console.log('   ', JSON.stringify(rule));
}
