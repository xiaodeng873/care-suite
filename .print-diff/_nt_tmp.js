const { createClient } = require('@supabase/supabase-js');
(async () => {
  const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: beds } = await supabase.from('beds').select('*').ilike('床號', '%235-2%').limit(3);
  console.log('beds match:', JSON.stringify(beds));
  const { data: patients } = await supabase.from('院友主表').select('院友id,中文姓名,床號,在住狀態').ilike('中文姓名', '%陳振常%');
  console.log('patients:', JSON.stringify(patients));
  for (const p of patients || []) {
    const { data: tasks } = await supabase.from('patient_health_tasks').select('*').eq('patient_id', p.院友id);
    for (const t of tasks || []) {
      console.log(`[${t.id.slice(0,8)}] ${t.health_record_type} freq=${t.frequency_value}/${t.frequency_unit} times=${JSON.stringify(t.specific_times)} start=${t.start_date} next_due=${t.next_due_at} last_completed=${t.last_completed_at} status=${t.status} created=${t.created_at}`);
    }
    const { data: recs } = await supabase.from('健康監測記錄').select('監測類型,記錄日期,記錄時間,任務id').eq('院友id', p.院友id).order('記錄日期', { ascending: false }).limit(8);
    console.log('recent records:', JSON.stringify(recs, null, 1));
  }
})();
