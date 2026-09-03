#!/usr/bin/env node
// 刪除所有既有診斷記錄後，從兩份 CSV 重新匯入
// 用法（預覽）: node scripts/import_diagnosis_records_rebuild.mjs
// 正式寫入: node scripts/import_diagnosis_records_rebuild.mjs --confirm

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('❌ 請提供 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const CSV_FILES = [
  'upload/院友醫學診斷紀錄_防漏修復版sactionD.csv',
  'upload/院友醫學診斷紀錄_防漏修復版stationC.csv',
];

// CSV 姓名與資料庫實際姓名的對應修正
const NAME_FIXES = {
  '何志廉': '何志亷',
  '何玉𡖖': '何玉卿',
};

function stripBOM(text) {
  return text.replace(/^\uFEFF/, '');
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function extractChineseName(str) {
  const cleaned = str.replace(/^\s+/, '');
  const match = cleaned.match(/^\d{3}-\d{1,2}\s+([^|]+)/);
  return match ? match[1].trim() : null;
}

function extractBedNumber(str) {
  const match = str.trim().match(/^(\d{3}-\d{1,2})/);
  return match ? match[1] : null;
}

async function findPatientByName(chineseName, bedNumber) {
  if (!chineseName) return null;

  const searchName = NAME_FIXES[chineseName] || chineseName;

  // 優先精確匹配
  let { data, error } = await supabase
    .from('院友主表')
    .select('院友id, 中文姓名, 床號')
    .eq('中文姓名', searchName);

  if (error) throw error;

  if (!data || data.length === 0) {
    // 精確找不到時改以模糊匹配（去掉常見空格）
    ({ data, error } = await supabase
      .from('院友主表')
      .select('院友id, 中文姓名, 床號')
      .ilike('中文姓名', `%${searchName.replace(/\s+/g, '')}%`));
    if (error) throw error;
  }

  if (!data || data.length === 0) return null;
  if (data.length === 1) return data[0];

  // 若有多個同名院友，嘗試用床號輔助配對
  if (bedNumber) {
    const byBed = data.find(p => p.床號 && (p.床號.startsWith(bedNumber) || p.床號.includes(bedNumber)));
    if (byBed) return byBed;
  }

  return null;
}

async function clearDiagnosisRecords() {
  console.log('\n🗑️  清除既有診斷記錄...');

  const { error: rpcError } = await supabase.rpc('exec_sql_mutation', {
    sql_string: `TRUNCATE TABLE diagnosis_records RESTART IDENTITY CASCADE;`
  });

  if (!rpcError) {
    console.log('✅ 已清除既有診斷記錄');
    return;
  }

  console.log(`⚠️  TRUNCATE 失敗 (${rpcError.message})，改以 delete() 分批刪除...`);
  let deleted = 0;
  while (true) {
    const { data, error } = await supabase
      .from('diagnosis_records')
      .delete()
      .order('id', { ascending: true })
      .not('id', 'is', null)
      .select('id')
      .limit(1000);

    if (error) throw error;
    if (!data || data.length === 0) break;
    deleted += data.length;
    console.log(`  已刪除 ${deleted} 筆...`);
    if (data.length < 1000) break;
  }
  console.log('✅ 已清除既有診斷記錄');
}

const DRY_RUN = !process.argv.includes('--confirm');

async function run() {
  const recordsToInsert = [];
  const skipped = [];
  const notFound = [];
  const patientCache = {};
  const seenKeys = new Set();

  for (const csvPath of CSV_FILES) {
    if (!fs.existsSync(csvPath)) {
      console.warn(`⚠️ 檔案不存在，略過：${csvPath}`);
      continue;
    }

    const raw = fs.readFileSync(csvPath, 'utf8');
    const text = stripBOM(raw);
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const identity = cols[0];
      const diagnosisItem = csvPath.includes('sactionD') ? cols[2] : cols[1];

      if (!identity) continue;

      const trimmedItem = (diagnosisItem || '').trim();
      if (!trimmedItem || trimmedItem === '無記錄') {
        skipped.push({ file: csvPath, line: i + 1, identity, reason: '無記錄或空白' });
        continue;
      }

      const chineseName = extractChineseName(identity);
      const bedNumber = extractBedNumber(identity);

      if (!chineseName) {
        skipped.push({ file: csvPath, line: i + 1, identity, reason: '無法解析中文姓名' });
        continue;
      }

      const cacheKey = `${chineseName}|${bedNumber || ''}`;
      if (!patientCache[cacheKey]) {
        patientCache[cacheKey] = await findPatientByName(chineseName, bedNumber);
      }
      const patient = patientCache[cacheKey];

      if (!patient) {
        notFound.push({ file: csvPath, line: i + 1, identity, diagnosisItem: trimmedItem });
        continue;
      }

      const recordKey = `${patient.院友id}|${trimmedItem}`;
      if (seenKeys.has(recordKey)) {
        skipped.push({ file: csvPath, line: i + 1, identity, reason: '重複診斷項目' });
        continue;
      }
      seenKeys.add(recordKey);

      recordsToInsert.push({
        patient_id: patient.院友id,
        diagnosis_date: '不詳',
        diagnosis_item: trimmedItem,
        diagnosis_unit: '',
        remarks: ''
      });
    }
  }

  console.log(`\n📊 預覽結果：`);
  console.log(`  可插入筆數：${recordsToInsert.length}`);
  console.log(`  跳過筆數：${skipped.length}`);
  console.log(`  找不到院友：${notFound.length}`);

  if (skipped.length > 0) {
    console.log('\n⚠️ 跳過的記錄（前 20 筆）：');
    for (const s of skipped.slice(0, 20)) {
      console.log(`  ${s.file} 第 ${s.line} 行 | ${s.reason} | ${s.identity}`);
    }
    if (skipped.length > 20) console.log(`  ... 還有 ${skipped.length - 20} 筆`);
  }

  if (notFound.length > 0) {
    console.log('\n⚠️ 找不到院友的記錄（前 30 筆）：');
    for (const n of notFound.slice(0, 30)) {
      console.log(`  ${n.file} 第 ${n.line} 行 | ${n.identity} | ${n.diagnosisItem}`);
    }
    if (notFound.length > 30) console.log(`  ... 還有 ${notFound.length - 30} 筆`);
  }

  if (DRY_RUN) {
    console.log('\n🔍 這是預覽模式。如要正式寫入，請加上 --confirm');
    return;
  }

  if (recordsToInsert.length === 0) {
    console.log('沒有可插入記錄，結束。');
    return;
  }

  await clearDiagnosisRecords();

  console.log('\n📝 前 10 筆預覽：');
  for (const r of recordsToInsert.slice(0, 10)) {
    console.log(`  patient_id=${r.patient_id}, item=${r.diagnosis_item}`);
  }

  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
    const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('diagnosis_records').insert(batch);
    if (error) {
      console.error(`❌ 插入第 ${i + 1}-${i + batch.length} 筆失敗:`, error.message);
      throw error;
    }
    inserted += batch.length;
    console.log(`✅ 已插入 ${inserted}/${recordsToInsert.length} 筆`);
  }

  console.log(`\n🎉 完成，共插入 ${inserted} 筆診斷記錄。`);
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
