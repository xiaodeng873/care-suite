import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

// ── 1. 李玉嬋 7 月統計 ──
const { data: lee, error: e1 } = await supabase
  .from('diaper_change_records')
  .select('change_date, time_slot, notes')
  .eq('patient_id', 538)
  .gte('change_date', '2026-07-01')
  .lte('change_date', '2026-07-31');
if (e1) { console.error(e1); process.exit(1); }

const daysWith = (note) => new Set(lee.filter(r => r.notes === note).map(r => r.change_date));
const slotCount = (note) => lee.filter(r => r.notes === note).length;
console.log('=== 李玉嬋 2026-07 換片記錄統計 ===');
console.log('總記錄數:', lee.length, '/ 186');
console.log('入院:', daysWith('入院').size, '天（', [...daysWith('入院')].sort().join(', '), '），共', slotCount('入院'), '個時段');
console.log('渡假:', daysWith('渡假').size, '天（', [...daysWith('渡假')].sort().join(', '), '），共', slotCount('渡假'), '個時段');
console.log('外出:', slotCount('外出'), '個時段（', [...daysWith('外出')].sort().join(', '), '）');
console.log('無記錄時段:', 186 - lee.length);

// ── 2. 關春杏：找院友 + 檢查現有記錄 ──
const { data: kwan, error: e2 } = await supabase
  .from('院友主表')
  .select('院友id, 床號, 中文姓名, 在住狀態')
  .ilike('中文姓名', '%關春杏%');
console.log('\n關春杏:', e2 || kwan);
if (!kwan?.length) process.exit(0);
const pid = kwan[0].院友id;

const { count } = await supabase
  .from('diaper_change_records')
  .select('id', { count: 'exact', head: true })
  .eq('patient_id', pid)
  .gte('change_date', '2026-07-01')
  .lte('change_date', '2026-07-31');
console.log('關春杏 2026-07 現有記錄數:', count);
