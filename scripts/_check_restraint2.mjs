import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
for (const bed of ['C237-3', 'C208-2']) {
  const { data: ps } = await supabase.from('院友主表').select('院友id, 中文姓名').eq('床號', bed).eq('在住狀態', '在住');
  for (const p of ps || []) {
    const { data: rows, error } = await supabase.from('patient_restraint_assessments').select('*').eq('patient_id', p.院友id);
    if (error) { console.log(bed, 'ERROR:', error.message); continue; }
    console.log(`${bed} ${p.中文姓名}: ${rows.length} 筆`);
    rows.forEach(r => {
      const keys = Object.keys(r).filter(k => /date|日期/i.test(k));
      console.log('   ', JSON.stringify(Object.fromEntries(keys.map(k => [k, r[k]]))), 'created=', r.created_at);
    });
  }
}
