#!/usr/bin/env node
// 從 CSV 匯入診斷記錄
// 用法：node scripts/import_diagnosis_records.mjs
// 正式寫入：node scripts/import_diagnosis_records.mjs --confirm

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

const CSV_PATH = 'upload/院友醫學診斷紀錄_完整解析版_2026-09-02.csv';

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

function extractFirstDate(str) {
  const match = str.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function extractBedNumber(str) {
  const match = str.trim().match(/^(\d{3}-\d{1,2})/);
  return match ? match[1] : null;
}

function extractChineseName(str) {
  const cleaned = str.replace(/^\s+/, '');
  const match = cleaned.match(/^\d{3}-\d{1,2}\s+([^|]+)/);
  return match ? match[1].trim() : null;
}

function stripBOM(text) {
  return text.replace(/^\uFEFF/, '');
}

async function findBedsByNumber(bedNumber) {
  const { data, error } = await supabase
    .from('beds')
    .select('id, bed_number')
    .ilike('bed_number', `%${bedNumber}`)
    .order('bed_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function findPatientByBedNumber(bedNumber, chineseName) {
  const beds = await findBedsByNumber(bedNumber);
  if (beds.length === 0) return null;

  const bedIds = beds.map(b => b.id);
  let query = supabase
    .from('院友主表')
    .select('院友id, 中文姓名, 床號, original_bed_id, bed_id')
    .or(`original_bed_id.in.(${bedIds.join(',')}),bed_id.in.(${bedIds.join(',')})`);

  // 只有床號跨站區、出現多個候選床位時，才用姓名輔助篩選
  if (chineseName && beds.length > 1) {
    query = query.ilike('中文姓名', `%${chineseName}%`);
  }

  const { data, error } = await query.limit(20);
  if (error) throw error;
  if (!data || data.length === 0) return null;

  // 若提供中文姓名，優先完全相符
  if (chineseName) {
    const exact = data.find(p => p.中文姓名 === chineseName);
    if (exact) return exact;
  }

  // 再優先 original_bed_id 在候選床位中的記錄
  const byOriginal = data.find(p => bedIds.includes(p.original_bed_id));
  if (byOriginal) return byOriginal;

  return data[0];
}

const DRY_RUN = !process.argv.includes('--confirm');

async function run() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const text = stripBOM(raw);
  const lines = text.split(/\r?\n/).filter(line => line.trim());

  const recordsToInsert = [];
  const skipped = [];
  const notFound = [];
  const patientCache = {};

  for (let i = 1; i < lines.length; i++) {
    const [identity, diagnosisItem] = parseCsvLine(lines[i]);
    if (!identity || !diagnosisItem) continue;

    const trimmedItem = diagnosisItem.trim();
    if (!trimmedItem || trimmedItem === '無記錄') {
      skipped.push({ line: i + 1, identity, reason: '無記錄或空白' });
      continue;
    }

    const bedNumber = extractBedNumber(identity);
    const diagnosisDate = extractFirstDate(identity);
    const chineseName = extractChineseName(identity);

    if (!bedNumber) {
      skipped.push({ line: i + 1, identity, reason: '無法解析床號' });
      continue;
    }
    if (!diagnosisDate) {
      skipped.push({ line: i + 1, identity, reason: '無法解析診斷日期' });
      continue;
    }

    const cacheKey = `${bedNumber}|${chineseName || ''}`;
    if (!patientCache[cacheKey]) {
      patientCache[cacheKey] = await findPatientByBedNumber(bedNumber, chineseName);
    }
    const patient = patientCache[cacheKey];

    if (!patient) {
      notFound.push({ line: i + 1, bedNumber, identity, diagnosisItem: trimmedItem });
      continue;
    }

    recordsToInsert.push({
      patient_id: patient.院友id,
      diagnosis_date: diagnosisDate,
      diagnosis_item: trimmedItem,
      diagnosis_unit: '',
      remarks: ''
    });
  }

  console.log(`\n📊 預覽結果：`);
  console.log(`  可插入筆數：${recordsToInsert.length}`);
  console.log(`  跳過筆數：${skipped.length}`);
  console.log(`  找不到院友：${notFound.length}`);

  if (skipped.length > 0) {
    console.log('\n⚠️ 跳過的記錄：');
    for (const s of skipped.slice(0, 20)) {
      console.log(`  第 ${s.line} 行 | ${s.reason} | ${s.identity}`);
    }
    if (skipped.length > 20) console.log(`  ... 還有 ${skipped.length - 20} 筆`);
  }

  if (notFound.length > 0) {
    console.log('\n⚠️ 找不到院友的記錄：');
    for (const n of notFound.slice(0, 30)) {
      console.log(`  第 ${n.line} 行 | 床號 ${n.bedNumber} | ${n.diagnosisItem}`);
    }
    if (notFound.length > 30) console.log(`  ... 還有 ${notFound.length - 30} 筆`);
  }

  if (DRY_RUN) {
    console.log('\n🔍 這是預覽模式。如要正式插入，請加上 --confirm');
    return;
  }

  if (recordsToInsert.length === 0) {
    console.log('沒有可插入記錄，結束。');
    return;
  }

  console.log('\n📝 前 10 筆預覽：');
  for (const r of recordsToInsert.slice(0, 10)) {
    console.log(`  patient_id=${r.patient_id}, date=${r.diagnosis_date}, item=${r.diagnosis_item}`);
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
