// 補錄 script：所有「有血壓記錄但同一時間缺 血含氧量/呼吸」嘅時段，隨機補上該兩項記錄
// 隨機範圍同 HealthRecordModal 既有預填一致：
//   血含氧量 = Math.floor(Math.random() * 5 + 95)  → 95-99
//   呼吸     = Math.floor(Math.random() * 9 + 14)  → 14-22
// 新記錄會繼承原血壓記錄嘅 院友id / 記錄日期 / 記錄時間 / 任務id / 記錄人員 / facility_id
// （facility_id 必須顯式複製：service role 冇 JWT claim，trigger 會留 NULL，RLS 下 app 會睇唔到）
// idempotent：同一 院友+日期+時間(HH:MM) 已有該類型記錄就 skip，可以重複跑
//
// 執行方法（repo root）：
//   node scripts/backfill_spo2_rr.mjs           # 實際執行
//   node scripts/backfill_spo2_rr.mjs --dry-run # 只統計，唔寫入
// 需要 apps/web/.env 有 SUPABASE_SERVICE_ROLE_KEY（或環境變數 SUPABASE_SERVICE_ROLE_KEY）

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

function loadEnvKey(key) {
  if (process.env[key]) return process.env[key];
  for (const p of [join(__dirname, '..', 'apps', 'web', '.env'), join(__dirname, '..', '.env')]) {
    try {
      const text = readFileSync(p, 'utf8');
      const m = text.match(new RegExp(`^${key}=(.+)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* 檔案唔存在就試下一個 */ }
  }
  return null;
}

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SERVICE_ROLE_KEY = loadEnvKey('SUPABASE_SERVICE_ROLE_KEY');
if (!SERVICE_ROLE_KEY) {
  console.error('❌ 搵唔到 SUPABASE_SERVICE_ROLE_KEY（apps/web/.env 或環境變數）');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PAGE_SIZE = 1000;
const normTime = (t) => (t || '').substring(0, 5); // HH:MM（寫入可以有秒，比對統一 HH:MM）
const keyOf = (r) => `${r.院友id}|${r.記錄日期}|${normTime(r.記錄時間)}`;

// 同 HealthRecordModal.tsx 既有隨機預填範圍一致
const randSpo2 = () => Math.floor(Math.random() * 5 + 95);
const randRR = () => Math.floor(Math.random() * 9 + 14);

async function fetchAll(select, filterType) {
  const all = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from('健康監測記錄')
      .select(select)
      .order('記錄id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (filterType) q = q.eq('監測類型', filterType);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

console.log(DRY_RUN ? '=== DRY RUN（只統計唔寫入）===' : '=== 實際執行 ===');

console.log('載入血壓記錄…');
const bpRecords = await fetchAll('記錄id, 院友id, 記錄日期, 記錄時間, 任務id, 記錄人員, facility_id', '血壓');
console.log(`  血壓記錄: ${bpRecords.length} 條`);

console.log('載入現有 血含氧量/呼吸 記錄…');
const spo2Existing = new Set((await fetchAll('院友id, 記錄日期, 記錄時間', '血含氧量')).map(keyOf));
const rrExisting = new Set((await fetchAll('院友id, 記錄日期, 記錄時間', '呼吸')).map(keyOf));
console.log(`  血含氧量: ${spo2Existing.size} 個時段 / 呼吸: ${rrExisting.size} 個時段`);

// 排隊要補嘅記錄（同一 key 唔好重複排）
const queued = new Set();
const toInsert = [];
for (const bp of bpRecords) {
  const k = keyOf(bp);
  const base = {
    院友id: bp.院友id,
    記錄日期: bp.記錄日期,
    記錄時間: bp.記錄時間,
    任務id: bp.任務id ?? null,
    記錄人員: bp.記錄人員 ?? null,
    facility_id: bp.facility_id ?? null,
  };
  if (!spo2Existing.has(k) && !queued.has(`spo2|${k}`)) {
    queued.add(`spo2|${k}`);
    toInsert.push({ ...base, 監測類型: '血含氧量', 數值: randSpo2() });
  }
  if (!rrExisting.has(k) && !queued.has(`rr|${k}`)) {
    queued.add(`rr|${k}`);
    toInsert.push({ ...base, 監測類型: '呼吸', 數值: randRR() });
  }
}

const spo2Count = toInsert.filter(r => r.監測類型 === '血含氧量').length;
const rrCount = toInsert.length - spo2Count;
console.log(`\n掃描結果：${bpRecords.length} 條血壓記錄`);
console.log(`  要補 血含氧量: ${spo2Count} 條`);
console.log(`  要補 呼吸:     ${rrCount} 條`);

if (DRY_RUN || toInsert.length === 0) {
  console.log(toInsert.length === 0 ? '✅ 冇嘢要補' : '（dry-run，未寫入）');
  process.exit(0);
}

// 分批 insert（每批 500）
let inserted = 0;
let failed = 0;
for (let i = 0; i < toInsert.length; i += 500) {
  const batch = toInsert.slice(i, i + 500);
  const { error } = await supabase.from('健康監測記錄').insert(batch);
  if (error) {
    console.error(`❌ 批次 ${i}-${i + batch.length} 失敗:`, error.message);
    failed += batch.length;
  } else {
    inserted += batch.length;
    console.log(`  ✅ 已寫入 ${inserted}/${toInsert.length}`);
  }
}

console.log('\n========== 補錄完成 ==========');
console.log(`成功寫入: ${inserted} 條（血含氧量 ${spo2Count} / 呼吸 ${rrCount}）`);
console.log(`失敗: ${failed} 條`);
if (failed > 0) process.exit(1);
