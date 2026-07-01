import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!KEY) { console.error('need key'); process.exit(1); }
const sb = createClient(SUPABASE_URL, KEY);

const localDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// 1. find patient by bed C233-1 or name 沈勇
const { data: patients, error: perr } = await sb
  .from('院友主表')
  .select('院友id, 床號, 中文姓氏, 中文名字, 在住狀態, 入住日期')
  .or('床號.eq.C233-1,中文名字.ilike.%勇%');
if (perr) { console.error('patient err', perr); process.exit(1); }
console.log('=== 院友 ===');
console.log(JSON.stringify(patients, null, 2));

const target = patients?.find(p => p.床號 === 'C233-1') || patients?.[0];
if (!target) { console.log('no patient found'); process.exit(0); }
const pid = target.院友id;

// 2. monitoring tasks for this patient
const { data: tasks, error: terr } = await sb
  .from('patient_health_tasks')
  .select('id, patient_id, health_record_type, specific_times, frequency_unit, frequency_value, start_date, next_due_at, last_completed_at, notes')
  .eq('patient_id', pid);
if (terr) { console.error('task err', terr); }
console.log('\n=== 任務 ===');
console.log(JSON.stringify(tasks, null, 2));

// 3. recent health records for this patient (last 30 days)
const since = new Date(); since.setDate(since.getDate() - 30);
const { data: recs, error: rerr } = await sb
  .from('健康監測記錄')
  .select('記錄id, 院友id, 任務id, 監測類型, 記錄日期, 記錄時間')
  .eq('院友id', pid)
  .gte('記錄日期', localDateStr(since))
  .order('記錄日期', { ascending: false });
if (rerr) { console.error('rec err', rerr); }
console.log('\n=== 近30天健康記錄 (院友) ===');
console.log(JSON.stringify(recs, null, 2));
console.log('\nToday:', localDateStr(new Date()));
