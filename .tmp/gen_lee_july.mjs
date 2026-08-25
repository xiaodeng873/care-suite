import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

const PATIENT_ID = 538; // 李玉嬋 A101-1
const SLOTS = ['7AM-11AM', '11AM-3PM', '3PM-7PM', '7PM-11PM', '11PM-3AM', '3AM-7AM'];
const RECORDERS = ['鄧業煒(護士)', '錢大媽 (護理員)'];

// 可重現隨機
let seed = 20260701;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const weighted = (pairs) => { // [[value, weight], ...]
  const total = pairs.reduce((a, p) => a + p[1], 0);
  let r = rng() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
};

// 事件定義：date -> Set(slot) -> notes
const events = {};
const mark = (date, slots, note) => {
  events[date] = events[date] || {};
  slots.forEach(s => { events[date][s] = note; });
};
const d = (day) => `2026-07-${String(day).padStart(2, '0')}`;

// 入院：7/8 11AM 起 至 7/11 3PM 前（7/11 7AM-11AM、11AM-3PM 仍入院）
mark(d(8), ['11AM-3PM', '3PM-7PM', '7PM-11PM', '11PM-3AM', '3AM-7AM'], '入院');
mark(d(9), SLOTS, '入院');
mark(d(10), SLOTS, '入院');
mark(d(11), ['7AM-11AM', '11AM-3PM'], '入院');
// 外出：7/19 日間三個時段
mark(d(19), ['7AM-11AM', '11AM-3PM', '3PM-7PM'], '外出');
// 渡假：7/24–7/27 全日
for (const day of [24, 25, 26, 27]) mark(d(day), SLOTS, '渡假');

const records = [];
for (let day = 1; day <= 31; day++) {
  const date = d(day);
  for (const slot of SLOTS) {
    const note = events[date]?.[slot];
    const recorder = pick(RECORDERS);
    if (note) {
      // 入院/外出/渡假：清空排泄輸入（同 DiaperChangeModal 備註按鈕行為）
      records.push({
        patient_id: PATIENT_ID,
        change_date: date,
        time_slot: slot,
        has_urine: false, has_stool: false, has_none: false,
        urine_amount: null, stool_color: null, stool_texture: null, stool_amount: null,
        urine_count: null, core_count: null,
        recorder,
        notes: note,
      });
      continue;
    }
    // 正常時段
    const isMorning = slot === '7AM-11AM';
    const r = rng();
    let has_none = false, has_urine = false, has_stool = false;
    if (r < 0.08) has_none = true;
    else {
      has_urine = rng() < 0.9;
      has_stool = rng() < (isMorning ? 0.4 : 0.2);
      if (!has_urine && !has_stool) has_none = true;
    }
    records.push({
      patient_id: PATIENT_ID,
      change_date: date,
      time_slot: slot,
      has_urine,
      has_stool,
      has_none,
      urine_amount: has_urine ? weighted([['少', 3], ['中', 5], ['多', 2]]) : null,
      stool_color: has_stool ? weighted([['黃', 4], ['啡', 5], ['綠', 1]]) : null,
      stool_texture: has_stool ? weighted([['軟', 5], ['硬', 2], ['稀', 2], ['水狀', 1]]) : null,
      stool_amount: has_stool ? weighted([['少', 4], ['中', 4], ['多', 2]]) : null,
      urine_count: has_none ? (rng() < 0.5 ? 0 : 1) : weighted([[1, 7], [2, 3]]),
      core_count: rng() < 0.4 ? 1 : 0,
      recorder,
      notes: null,
    });
  }
}

console.log(`準備插入 ${records.length} 筆（31 日 × 6 時段 = 186）`);
const eventCount = records.filter(r => r.notes).length;
console.log(`其中事件記錄 ${eventCount} 筆：入院 ${records.filter(r => r.notes === '入院').length}、外出 ${records.filter(r => r.notes === '外出').length}、渡假 ${records.filter(r => r.notes === '渡假').length}`);

const { error } = await supabase.from('diaper_change_records').insert(records);
if (error) { console.error('❌ 插入失敗:', error); process.exit(1); }
console.log('✅ 插入完成');

// 驗證
const { count } = await supabase
  .from('diaper_change_records')
  .select('id', { count: 'exact', head: true })
  .eq('patient_id', PATIENT_ID)
  .gte('change_date', '2026-07-01')
  .lte('change_date', '2026-07-31');
console.log('驗證：2026-07 記錄總數 =', count);
