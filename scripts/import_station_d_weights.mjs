// 匯入 upload/station_d_bw.csv：D 座 2026 年 1-8 月院友體重
// 寫入 健康監測記錄（監測類型='體重'，記錄日期=每月 1 日，與現有慣例一致）
// 冪等：同院友同日期的體重記錄已存在則跳過
// 用法: node scripts/import_station_d_weights.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '../.env'), 'utf8');
const KEY = (env.match(/^SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\r\n]+)/m) || [])[1];
if (!KEY) { console.error('❌ 找不到 SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 已知筆誤修正：bed -> { monthIndex(0=Jan): correctedValue }
const CORRECTIONS = {
  '261-1': { 7: 61.5 },  // Aug "615" -> 61.5
  '276-2': { 5: 45.5 },  // Jun "455" -> 45.5
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'];

async function run() {
  const raw = readFileSync(join(__dirname, '../upload/station_d_bw.csv'), 'utf8');
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].split(',').map(s => s.trim());

  const rows = []; // { bed, month, weight }
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const bed = cols[0].trim();
    if (!bed) continue;
    cols.slice(1).forEach((cell, i) => {
      const monthName = header[i + 1];
      const monthIdx = MONTHS.indexOf(monthName);
      if (monthIdx < 0) return;
      let v = cell.trim();
      if (!v) return;
      const corr = CORRECTIONS[bed]?.[monthIdx];
      if (corr !== undefined) v = String(corr);
      const w = Number(v);
      if (!Number.isFinite(w) || w <= 0 || w > 300) {
        console.warn(`⚠️  跳過異常值 ${bed} ${monthName}: "${cell.trim()}"`);
        return;
      }
      rows.push({ bed, month: monthIdx + 1, weight: w });
    });
  }
  console.log(`📄 CSV 有效資料點：${rows.length} 個`);

  // 床號對應：CSV "238-1" -> DB "D238-1"
  const beds = [...new Set(rows.map(r => r.bed))];
  const dbBeds = beds.map(b => 'D' + b);
  const { data: patients, error: pErr } = await supabase
    .from('院友主表').select('院友id,床號,中文姓名')
    .in('床號', dbBeds);
  if (pErr) { console.error('❌ 讀取院友失敗:', pErr.message); process.exit(1); }

  const bedToPatient = new Map(patients.map(p => [p.床號, p]));
  const unmatched = beds.filter(b => !bedToPatient.has('D' + b));
  if (unmatched.length) console.warn(`⚠️  找不到對應床號（跳過）: ${unmatched.join(', ')}`);

  let inserted = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    const patient = bedToPatient.get('D' + r.bed);
    if (!patient) { skipped++; continue; }
    const recordDate = `2026-${String(r.month).padStart(2, '0')}-01`;

    // 冪等檢查
    const { count, error: cErr } = await supabase.from('健康監測記錄')
      .select('*', { count: 'exact', head: true })
      .eq('院友id', patient.院友id)
      .eq('記錄日期', recordDate)
      .eq('監測類型', '體重');
    if (cErr) { console.error(`❌ 檢查 ${r.bed} ${recordDate}: ${cErr.message}`); failed++; continue; }
    if (count && count > 0) { skipped++; continue; }

    const { error } = await supabase.from('健康監測記錄').insert([{
      院友id: patient.院友id,
      記錄日期: recordDate,
      記錄時間: '00:00:00',
      監測類型: '體重',
      數值: r.weight,
      備註: '定期',
      記錄人員: '系統匯入',
    }]);
    if (error) { console.error(`❌ ${r.bed} ${recordDate}: ${error.message}`); failed++; }
    else inserted++;
  }

  console.log(`\n✅ 完成：新增 ${inserted} 筆，已存在/無對應跳過 ${skipped} 筆，失敗 ${failed} 筆`);
}

run().catch(err => { console.error('執行失敗:', err); process.exit(1); });
