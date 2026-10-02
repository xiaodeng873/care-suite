import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: ps } = await supabase.from('院友主表').select('院友id, 中文姓名, 床號').ilike('床號', '%233-1%');
console.log('院友:', JSON.stringify(ps));

const pid = ps?.[0]?.院友id;
if (!pid) process.exit(0);

const { data: recs } = await supabase.from('健康監測記錄').select('*').eq('院友id', pid).eq('記錄日期', '2026-10-01').order('記錄時間');
console.log('\n1/10 監測記錄:');
for (const r of recs || []) {
  console.log(`  [${r.監測類型}] ${r.記錄時間} 任務id=${r.任務id ?? 'null'} SBP=${r.收縮壓 ?? ''} DBP=${r.舒張壓 ?? ''} P=${r.脈搏 ?? ''} RR=${r.呼吸 ?? ''} SpO2=${r.血含氧量 ?? ''} 記錄人員=${r.記錄人員 ?? ''}`);
}

const { data: tasks } = await supabase.from('patient_health_tasks').select('*').eq('patient_id', pid).order('created_at');
console.log('\n任務:');
for (const t of tasks || []) {
  console.log(`  [${t.id}] ${t.health_record_type} times=${JSON.stringify(t.specific_times)} start=${t.start_date} status=${t.status} freq=${t.frequency_type}/${t.frequency_value} notes=${t.notes ?? ''}`);
}
