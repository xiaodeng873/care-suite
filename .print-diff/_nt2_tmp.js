const { createClient } = require('@supabase/supabase-js');
(async () => {
  const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: patients } = await supabase.from('院友主表').select('院友id,中文姓名,床號').ilike('中文姓名', '%陳振常%');
  const p = patients[0];
  const { data: tasks } = await supabase.from('patient_health_tasks').select('id,health_record_type,frequency_unit,frequency_value,specific_times,start_date,end_date,end_time,is_recurring,next_due_at,last_completed_at,notes').eq('patient_id', p.院友id);
  for (const t of tasks || []) {
    console.log(`[${t.id.slice(0,8)}] ${t.health_record_type} ${t.frequency_value}/${t.frequency_unit} recurring=${t.is_recurring} start=${t.start_date?.slice(0,10)} end=${t.end_date} ${t.end_time || ''} next_due=${t.next_due_at?.slice(0,10)} notes=${t.notes || ''}`);
  }
  // 全院非循環任務統計
  const { data: nrs } = await supabase.from('patient_health_tasks').select('id,end_date,is_recurring,health_record_type').eq('is_recurring', false);
  console.log(`\n全院非循環任務: ${(nrs||[]).length} 個`);
  (nrs||[]).slice(0,10).forEach(t => console.log(`  [${t.id.slice(0,8)}] ${t.health_record_type} end=${t.end_date}`));
})();
