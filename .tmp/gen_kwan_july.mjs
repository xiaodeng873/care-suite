import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

const PATIENT_ID = 537; // 關春杏 A101-2
const SLOTS = ['7AM-11AM', '11AM-3PM', '3PM-7PM', '7PM-11PM', '11PM-3AM', '3AM-7AM'];
const RECORDERS = ['鄧業煒(護士)', '錢大媽 (護理員)'];

let seed = 20260725;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((a, p) => a + p[1], 0);
  let r = rng() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
};

const records = [];
for (let day = 1; day <= 31; day++) {
  const date = `2026-07-${String(day).padStart(2, '0')}`;
  for (const slot of SLOTS) {
    // 無備註、無空缺：每個時段都有小便，部分有大便
    const has_stool = rng() < (slot === '7AM-11AM' ? 0.4 : 0.2);
    records.push({
      patient_id: PATIENT_ID,
      change_date: date,
      time_slot: slot,
      has_urine: true,
      has_stool,
      has_none: false,
      urine_amount: weighted([['少', 3], ['中', 5], ['多', 2]]),
      stool_color: has_stool ? weighted([['黃', 4], ['啡', 5], ['綠', 1]]) : null,
      stool_texture: has_stool ? weighted([['軟', 5], ['硬', 2], ['稀', 2], ['水狀', 1]]) : null,
      stool_amount: has_stool ? weighted([['少', 4], ['中', 4], ['多', 2]]) : null,
      urine_count: weighted([[1, 7], [2, 3]]),
      core_count: rng() < 0.4 ? 1 : 0,
      recorder: pick(RECORDERS),
      notes: null,
    });
  }
}

const { error } = await supabase.from('diaper_change_records').insert(records);
if (error) { console.error('❌ 插入失敗:', error); process.exit(1); }

const { count } = await supabase
  .from('diaper_change_records')
  .select('id', { count: 'exact', head: true })
  .eq('patient_id', PATIENT_ID)
  .gte('change_date', '2026-07-01')
  .lte('change_date', '2026-07-31');
console.log(`✅ 關春杏 2026-07 已插入 ${records.length} 筆，驗證總數 = ${count}`);
console.log('備註記錄數:', records.filter(r => r.notes).length, '；無大小便記錄數:', records.filter(r => r.has_none).length);
