#!/usr/bin/env node
// 用於從「體檢日期一覽表(2026年)」提取的資料生成年度體檢 row
// 步驟：1) 提取圖中日期 → 2) 以床位/姓名對應院友 id → 3) 生成樣本供確認（不插入）
// 規則（用戶確認）：
//   - 床號對不上就按姓名匹配；已退住略過但報告；找不到人名略過但報告
//   - 2025年欄（印刷日期）與 1-12月欄（2026 手寫日期）各自生成獨立 row
//   - 略過：238-4 何秋霞、265-2 譚杏嫻、268-5 晏曉蘭

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('❌ 請提供 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// 從圖中手動提取的資料
// 格式：[床位, 中文姓名, [2026年手寫日期 ISO...], 2025年印刷日期 ISO 或 null]
const extracted = [
  ['238-1', '黃珍女', [], '2025-10-20'],
  ['238-3', '胡養', ['2026-04-01'], '2025-04-15'],
  ['238-4', '何秋霞', ['2026-03-27'], null],          // 略過（找不到人）
  ['239-1', '朱二光', ['2026-06-11'], '2025-06-16'],
  ['239-2', '陳監華', [], '2025-10-15'],
  ['239-3', '黃少茄', ['2026-06-01'], '2025-06-06'],
  ['239-4', '莊思齊', [], '2025-12-05'],
  ['252-1', '陳順媚', [], '2025-12-11'],
  ['253-1', '袁潤球', ['2026-06-01'], '2025-06-06'],
  ['255-1', '劉志', [], '2025-10-30'],
  ['255-2', '李洪柏', ['2026-03-08'], '2025-03-10'],
  ['255-3', '鍾偉傑', ['2026-06-01'], '2025-06-09'],
  ['255-4', '譚炎堂', ['2026-06-11'], '2025-06-16'],
  ['258-1', '梁莉環', [], '2025-09-26'],
  ['258-2', '鄭金', ['2026-05-11'], null],
  ['258-4', '劉串金', ['2026-08-02'], '2025-08-15'],
  ['259-1', '廖玉屏', ['2026-03-07'], '2025-03-08'],
  ['259-2', '張新華', ['2026-04-13'], '2025-04-11'],
  ['259-3', '李肖霞', [], '2025-09-15'],
  ['259-4', '潘金佩', [], '2025-12-03'],
  ['261-1', '劉世玉', [], '2025-12-11'],
  ['261-2', '楊宗鎏', ['2026-06-03'], '2025-06-06'],
  ['261-3', '李錦雄', [], '2025-12-20'],
  ['261-4', '溫國昌', [], '2025-10-24'],
  ['263-1', '符史法', ['2026-03-27'], '2025-08-04'],
  ['263-2', '陳志光', [], '2025-09-04'],
  ['263-3', '黃文友', [], '2025-08-25'],
  ['263-4', '黃意漢', ['2026-04-01'], '2025-04-11'],
  ['265-1', '莊婷婷', ['2026-01-16'], null],
  ['265-2', '譚杏嫻', ['2026-02-13'], null],          // 略過（找不到人）
  ['265-3', '李美卿', ['2026-01-06'], null],
  ['265-4', '謝巧賢', ['2026-01-29'], null],
  ['266-1', '鄭秀貞', ['2026-07-08'], '2025-07-17'],
  ['266-2', '劉春玉', ['2026-07-05'], '2025-07-07'],
  ['266-3', '蒙秀嫻', ['2026-02-23'], '2025-02-24'],
  ['266-4', '梁美平', [], '2025-09-15'],
  ['268-1', '紀楚粧', [], '2025-12-13'],
  ['268-2', '梁惠芳', [], '2025-12-30'],
  ['268-3', '馬煥勻', [], '2025-12-05'],
  ['268-4', '鄺揚眉', ['2026-07-08'], '2025-07-17'],
  ['268-5', '晏曉蘭', [], null],                        // 略過（找不到人）
  ['268-6', '陳淑馨', [], '2025-09-15'],
  ['270-1', '周國英', [], '2025-10-02'],
  ['270-2', '司徒德利', ['2026-02-27'], '2025-03-10'],
  ['271-1', '盧麗娟', ['2026-01-15'], '2025-02-14'],
  ['271-2', '阮蘇萍', ['2026-01-27'], '2025-01-28'],
  ['272-1', '林妹', ['2026-06-11'], '2025-06-16'],
  ['272-2', '李璋', ['2026-03-13'], '2025-04-11'],
  ['272-3', '周雪英', ['2026-03-30'], '2025-04-24'],
  ['276-1', '劉彩玉', ['2026-03-30'], '2025-04-25'],
  ['276-2', '陳子沛', ['2026-07-05'], '2025-07-07'],
  ['277-1', '陳妹', [], '2025-11-14'],
  ['278-1', '郭惠珍', [], '2025-12-19'],
  ['279-1', '趙月英', ['2026-08-02'], '2025-08-06'],
  ['279-2', '司徒二女', [], '2025-11-17'],
  ['280-1', '蕭美梨', ['2026-05-26'], '2025-05-30'],
  ['281-1', '趙盤珠', ['2026-07-16'], '2025-07-25'],
  ['281-2', '張秀貞', ['2026-07-12'], '2025-07-21'],
  ['281-3', '鍾黃秀琴', [], '2025-09-22'],
  ['282-1', '盧煥田', [], '2025-10-03'],
  ['283-1', '朱麗金', [], '2025-08-25'],
  ['285-2', '關美嫻', ['2026-05-31'], '2025-06-02'],
  ['285-3', '謝少琼', [], '2025-09-26'],
  ['286-1', '吳仲桂', ['2026-02-26'], null],
  ['286-2', '唐雅麗', [], '2025-12-05'],
  ['286-3', '黃笑蘭', ['2026-03-26'], '2025-03-31'],
  ['286-4', '麥慧霞', ['2026-03-23'], '2025-03-23'],
  ['287-1', '鄧威華', [], '2025-12-16'],
  ['287-2', '楊金葵', ['2026-03-12'], '2025-03-24'],
  ['287-3', '嚴金湖', [], '2025-09-29'],
  ['287-4', '王源', ['2026-03-23'], '2025-03-23'],
];

const nextDueDate = (iso) => {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
};

async function main() {
  // 查所有院友（包括已退住，用於姓名對應與報告）
  const { data: patients, error } = await supabase
    .from('院友主表')
    .select('院友id, 床號, 中文姓名, 中文姓氏, 中文名字, 在住狀態');

  if (error) {
    console.error('❌ 查詢院友失敗:', error);
    process.exit(1);
  }

  const bedMap = new Map();
  const nameMap = new Map();
  for (const p of patients || []) {
    if (p.床號) {
      // DB 床號帶站別字母前綴（如 D238-4），去掉字母對應圖中床位（如 238-4）
      const suffix = p.床號.replace(/^[A-Za-z]+/, '');
      // 同一床位可能有多人（在住 + 已退住），優先保留在住者
      if (!bedMap.has(suffix) || p.在住狀態 === '在住') bedMap.set(suffix, p);
    }
    if (p.中文姓名) {
      if (!nameMap.has(p.中文姓名)) nameMap.set(p.中文姓名, []);
      nameMap.get(p.中文姓名).push(p);
    }
  }

  console.log('=== 對應結果 ===');
  const rows = [];
  const notFound = [];    // 完全找不到人名
  const skippedQuit = []; // 只找到已退住，略過
  for (const [bed, name, dates2026, date2025] of extracted) {
    let patient = bedMap.get(bed);
    let matchedBy = '床位';
    if (!patient || patient.中文姓名 !== name) {
      // 床位對不上（或姓名不符）→ 改用姓名對應
      const byName = nameMap.get(name) || [];
      const active = byName.find(p => p.在住狀態 === '在住');
      if (active) {
        console.log(`ℹ️ 床位 ${bed} 對不上，按姓名「${name}」對應到 ${active.床號}（在住）`);
        patient = active;
        matchedBy = '姓名';
      } else if (byName.length > 0) {
        skippedQuit.push({ bed, name, dbBed: byName.map(p => p.床號).join('/') });
        continue;
      } else {
        notFound.push({ bed, name, bedResident: patient ? `${patient.中文姓名}（${patient.在住狀態}）` : '空床' });
        continue;
      }
    }
    if (patient.在住狀態 !== '在住') {
      skippedQuit.push({ bed, name, dbBed: patient.床號 });
      continue;
    }
    // 2025 年印刷日期一筆
    if (date2025) {
      rows.push({
        patient_id: patient.院友id,
        床位: bed,
        中文姓名: patient.中文姓名,
        last_doctor_signature_date: date2025,
        next_due_date: nextDueDate(date2025),
        對應方式: matchedBy,
      });
    }
    // 2026 年手寫日期各一筆
    for (const date of dates2026) {
      rows.push({
        patient_id: patient.院友id,
        床位: bed,
        中文姓名: patient.中文姓名,
        last_doctor_signature_date: date,
        next_due_date: nextDueDate(date),
        對應方式: matchedBy,
      });
    }
  }

  console.log(`\n=== 共 ${rows.length} 筆可生成 ===\n`);

  // 輸出第一筆作為樣本
  if (rows.length > 0) {
    console.log('樣本 row（第 1 筆）：');
    console.log(JSON.stringify(rows[0], null, 2));
  }

  // 全部列表
  console.log('\n全部資料：');
  rows.forEach((r, i) => {
    console.log(`${i + 1}. ${r.床位} ${r.中文姓名} | ${r.last_doctor_signature_date} → ${r.next_due_date}（${r.對應方式}對應）`);
  });

  console.log('\n=== 已退住，略過 ===');
  skippedQuit.forEach(s => console.log(`⏭️ ${s.bed} ${s.name}（DB: ${s.dbBed}，已退住）`));

  console.log('\n=== 找不到人名，已略過 ===');
  notFound.forEach(s => console.log(`❓ ${s.bed} ${s.name}（該床 DB 住者: ${s.bedResident}）`));

  // 插入資料庫（用戶已確認）
  console.log('\n=== 開始插入 ===');
  const toInsert = rows.map(r => ({
    patient_id: r.patient_id,
    last_doctor_signature_date: r.last_doctor_signature_date,
    next_due_date: r.next_due_date,
  }));
  const { data: inserted, error: insertError } = await supabase
    .from('annual_health_checkups')
    .insert(toInsert)
    .select('id');
  if (insertError) {
    console.error('❌ 插入失敗:', insertError);
    process.exit(1);
  }
  console.log(`✅ 成功插入 ${inserted.length} 筆`);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
