import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
for (const bed of ['C237-3', 'C208-2']) {
  const { data: ps } = await supabase.from('院友主表').select('院友id, 中文姓名').eq('床號', bed).eq('在住狀態', '在住');
  for (const p of ps || []) {
    const { data: rows } = await supabase.from('patient_restraint_assessments').select('id, doctor_signature_date, next_review_date, created_at').eq('patient_id', p.院友id);
    console.log(`${bed} ${p.中文姓名}: ${(rows||[]).length} 筆約束評估`);
    (rows||[]).forEach(r => console.log(`   sig=${r.doctor_signature_date} next=${r.next_review_date} created=${r.created_at}`));
  }
}
