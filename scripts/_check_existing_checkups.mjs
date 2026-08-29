import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error, count } = await supabase.from('annual_health_checkups').select('id, patient_id, last_doctor_signature_date', { count: 'exact' });
if (error) { console.error(error); process.exit(1); }
console.log('總數:', count);
const byYear = {};
for (const r of data || []) {
  const y = (r.last_doctor_signature_date || 'null').slice(0, 4);
  byYear[y] = (byYear[y] || 0) + 1;
}
console.log('按年份:', JSON.stringify(byYear));
// D 站院友的現有記錄
const { data: pats } = await supabase.from('院友主表').select('院友id, 床號, 中文姓名').like('床號', 'D%');
const dIds = new Set((pats || []).map(p => p.院友id));
const dRows = (data || []).filter(r => dIds.has(r.patient_id));
console.log('D站院友現有體檢記錄:', dRows.length);
for (const r of dRows) {
  const p = pats.find(x => x.院友id === r.patient_id);
  console.log(`  ${p.床號} ${p.中文姓名} | ${r.last_doctor_signature_date}`);
}
