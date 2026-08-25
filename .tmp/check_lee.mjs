import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

// 1. 找李玉蟬
const { data: patients, error: e1 } = await supabase
  .from('院友主表')
  .select('院友id, 床號, 中文姓名, 在住狀態')
  .ilike('中文姓名', '%李玉蟬%');
console.log('院友:', e1 || patients);

// 2. 她 2026-07 的現有換片記錄
if (patients?.length) {
  const pid = patients[0].院友id;
  const { data: recs, error: e2 } = await supabase
    .from('diaper_change_records')
    .select('id, change_date, time_slot, notes, recorder')
    .eq('patient_id', pid)
    .gte('change_date', '2026-07-01')
    .lte('change_date', '2026-07-31')
    .order('change_date')
    .order('time_slot');
  console.log('2026-07 現有記錄數:', e2 || recs.length);
  if (recs.length) console.log(recs.slice(0, 10));
}

// 3. 其他院友最近記錄的 recorder 慣例
const { data: sample } = await supabase
  .from('diaper_change_records')
  .select('recorder')
  .not('recorder', 'is', null)
  .order('created_at', { ascending: false })
  .limit(20);
console.log('recorder 樣本:', [...new Set((sample || []).map(r => r.recorder))]);
