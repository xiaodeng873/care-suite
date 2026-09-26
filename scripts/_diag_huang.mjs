// 診斷：黃逸綺（C237-1）嘅任務同近期健康記錄
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvKey(key) {
  for (const p of [join(__dirname, '..', 'apps', 'web', '.env'), join(__dirname, '..', '.env')]) {
    try {
      const text = readFileSync(p, 'utf8');
      const m = text.match(new RegExp(`^${key}=(.+)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch {}
  }
  return process.env[key] || null;
}

const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', loadEnvKey('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const patient = await supabase
  .from('院友主表')
  .select('院友id, 中文姓名, 床號, 入住日期, 在住狀態')
  .ilike('中文姓名', '%黃逸綺%')
  .maybeSingle();
if (!patient.data) {
  console.error('搵唔到黃逸綺');
  process.exit(1);
}
console.log('院友:', JSON.stringify(patient.data, null, 2));
const pid = patient.data.院友id;

const tasks = await supabase
  .from('patient_health_tasks')
  .select('id, health_record_type, frequency_unit, frequency_value, specific_times, start_date, end_date, is_recurring, next_due_at, last_completed_at, created_at, status')
  .eq('patient_id', pid)
  .order('health_record_type');
console.log('\n=== 任務 ===');
console.log(JSON.stringify(tasks.data, null, 2));

const records = await supabase
  .from('健康監測記錄')
  .select('記錄id, 記錄日期, 記錄時間, 監測類型, 數值, 數值_副, 任務id, 記錄人員, facility_id')
  .eq('院友id', pid)
  .gte('記錄日期', '2026-09-20')
  .order('記錄日期', { ascending: false })
  .order('記錄時間', { ascending: false });
console.log('\n=== 2026-09-20 起嘅健康記錄 ===');
console.log(JSON.stringify(records.data, null, 2));

// 服藥前 相關：處方工作流
const wf = await supabase
  .from('prescription_workflow_records')
  .select('*')
  .eq('patient_id', pid)
  .gte('scheduled_date', '2026-09-23')
  .order('scheduled_date', { ascending: false })
  .limit(30);
console.log('\n=== 處方工作流記錄（2026-09-23 起）===');
console.log(JSON.stringify(wf.data, null, 2));
if (wf.error) console.error('wf error:', wf.error.message);
