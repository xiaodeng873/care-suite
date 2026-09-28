// 一次性資料修正：
// 1) 所有處方/藥物資料庫 meal_timings 入面「睡前」→「臨睡前」
// 2) 時段為 臨睡前/晚上/早上/上午/中午/下午 嘅 slot 全部設 replacePrefix=true（取代前綴）
// 用法：node scripts/_fix_meal_timings_prefix.mjs        （先 DRY RUN 預覽）
//       node scripts/_fix_meal_timings_prefix.mjs apply   （正式寫入）
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  try {
    key = readFileSync('apps/web/.env', 'utf-8').split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY='))?.split('=')[1]?.trim();
  } catch { /* ignore */ }
}
if (!key) { console.error('缺少 SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', key, { auth: { autoRefreshToken: false, persistSession: false } });
const APPLY = process.argv[2] === 'apply';

const PREFIX_SLOTS = ['臨睡前', '晚上', '早上', '上午', '中午', '下午'];

// 回傳 { meal_timings, slot1, slot2, changed } 或 null（唔使改）
function transform(row) {
  const slot1Key = row.__slot1Key;
  const raw = row.meal_timings;
  let slots = null;
  let connectors = [];
  let replacePrefix = [];
  if (raw && Array.isArray(raw.slots) && raw.slots.length) {
    slots = raw.slots.map(s => String(s ?? ''));
    connectors = Array.isArray(raw.connectors) ? raw.connectors : [];
    replacePrefix = Array.isArray(raw.replacePrefix) ? raw.replacePrefix.map(Boolean) : [];
  } else {
    // jsonb 冇資料 → 用舊三欄（處方=meal_timing，藥物資料庫=meal_timing_1）
    const s1 = String(row[slot1Key] ?? '').trim();
    const s2 = String(row.meal_timing_2 ?? '').trim();
    slots = [s1, s2].filter(Boolean);
    connectors = slots.length > 1 ? [row.meal_timing_connector === '及' ? '及' : '或'] : [];
  }
  if (!slots.length) return null;

  let changed = false;
  const newSlots = slots.map((s) => {
    if (s === '睡前') { changed = true; return '臨睡前'; }
    return s;
  });
  const newPrefix = newSlots.map((s, i) => {
    const on = PREFIX_SLOTS.includes(s);
    const was = Boolean(replacePrefix[i]);
    if (on && !was) changed = true;
    return on || was;
  });
  if (!changed) return null;

  return {
    meal_timings: { slots: newSlots, connectors, replacePrefix: newPrefix },
    slot1: newSlots[0] ?? null,
    slot2: newSlots[1] ?? null,
    changed: true,
  };
}

async function processTable(table, slot1Key) {
  const selectCols = `id, meal_timings, ${slot1Key}, meal_timing_2, meal_timing_connector`;
  const { data: rows } = await supabase.from(table).select(selectCols).not('meal_timing', 'is', null);
  // 連 meal_timing 三欄全空但 jsonb 有資料嘅都要
  const { data: jsonRows } = await supabase.from(table).select(selectCols).not('meal_timings', 'is', null);
  const all = new Map();
  for (const r of [...(rows || []), ...(jsonRows || [])]) all.set(r.id, { ...r, __slot1Key: slot1Key });

  let updated = 0, skipped = 0;
  for (const row of all.values()) {
    const t = transform(row);
    if (!t) { skipped++; continue; }
    updated++;
    console.log(`${table} #${row.id}: slots=[${(row.meal_timings?.slots ?? [row[slot1Key], row.meal_timing_2]).join(',')}] → [${t.meal_timings.slots.join(',')}] prefix=[${t.meal_timings.replacePrefix.map((b, i) => `${t.meal_timings.slots[i]}:${b ? 'T' : 'F'}`).join(' ')}]`);
    if (APPLY) {
      const { error: upErr } = await supabase.from(table).update({
        meal_timings: t.meal_timings,
        [slot1Key]: t.slot1,
        meal_timing_2: t.slot2,
      }).eq('id', row.id);
      if (upErr) console.error(`  更新失敗 #${row.id}:`, upErr.message);
    }
  }
  console.log(`== ${table}: ${updated} 筆需更新, ${skipped} 筆唔使改${APPLY ? '' : '（DRY RUN，未寫入）'}`);
}

await processTable('new_medication_prescriptions', 'meal_timing');
await processTable('medication_drug_database', 'meal_timing_1');
