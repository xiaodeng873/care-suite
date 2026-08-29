import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
for (const bed of ['C208-2', 'C237-3']) {
  const { data: ps } = await supabase.from('院友主表').select('院友id, 中文姓名, 在住狀態').eq('床號', bed);
  for (const p of ps || []) {
    const { data: rows } = await supabase.from('annual_health_checkups').select('id, last_doctor_signature_date, next_due_date, created_at').eq('patient_id', p.院友id).order('created_at');
    console.log(`${bed} ${p.中文姓名}（${p.在住狀態}, id=${p.院友id}）共 ${rows.length} 筆:`);
    rows.forEach(r => console.log(`   sig=${r.last_doctor_signature_date} due=${r.next_due_date} created=${r.created_at}`));
  }
}
