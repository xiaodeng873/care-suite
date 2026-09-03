#!/usr/bin/env node
// 從 C 站 HMS CSV 重新匯入處方記錄
// 用法：node scripts/import_c_station_prescriptions.mjs              （乾跑預覽）
//       node scripts/import_c_station_prescriptions.mjs --confirm    （正式寫入）

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const C_STATION_ID = '2e6d61ee-9285-4314-9808-f3c9e224ba66';

const HMS_CSV = path.resolve('apps/web/public/hms.csv');
const HMS_PRN_CSV = path.resolve('apps/web/public/hms_prn.csv');
const BATCH_SIZE = 100;
const DRY_RUN = !process.argv.includes('--confirm');

// 姓名異體字對照，需要時手動加入
const NAME_ALIASES = {};

if (!SERVICE_KEY) {
  console.error('❌ 請設定 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── CSV 解析（支援跨行引號欄位）
function stripBOM(text) {
  return text.replace(/^\uFEFF/, '');
}

function parseCsv(text) {
  const rows = [];
  let fields = [];
  let current = '';
  let inQuotes = false;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const next = chars[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      if (fields.length > 0 || current.trim() !== '') {
        fields.push(current);
        rows.push(fields);
      }
      fields = [];
      current = '';
      continue;
    }
    current += char;
  }
  if (fields.length > 0 || current.trim() !== '') {
    fields.push(current);
    rows.push(fields);
  }
  return rows;
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('找不到 CSV：' + filePath);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return parseCsv(stripBOM(raw));
}

// ── 通用正規化
function normalizeText(str) {
  return (str || '').toString().replace(/\s+/g, ' ').trim();
}

function normalizeName(str) {
  const alias = NAME_ALIASES[normalizeText(str)];
  return alias || normalizeText(str);
}

function normalizeBedNumber(str) {
  return (str || '').toString().trim().toUpperCase().replace(/^[A-Z]+/, '').replace(/\s+/g, '');
}

// ── 日期：只取 YYYY-MM-DD 部分
function parseDatePart(raw) {
  const txt = normalizeText(raw);
  if (!txt) return null;
  const m = txt.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// ── 藥物來源與專科
function parseSource(raw) {
  const txt = normalizeText(raw);
  if (!txt) return { source: '', specialty: null };
  const parts = txt.split('/', 2).map((s) => s.trim());
  const source = parts[0] || '';
  const specialty = parts[1] || null;
  return { source, specialty };
}

// ── 劑量：以第一個空格區分數值與單位
function parseDosage(raw) {
  const txt = normalizeText(raw);
  if (!txt) return { amount: '', unit: '' };
  const m = txt.match(/^(\S+)\s+(.*)$/);
  if (!m) return { amount: txt, unit: '' };
  return { amount: m[1], unit: m[2] };
}

// ── 頻率對照
const DAILY_FREQ_MAP = {
  DAILY: 1,
  BD: 2,
  TDS: 3,
  QID: 4,
  Q6H: 4,
  NOCTE: 1,
  STAT: 1,
};

function parseFrequencyAndTiming(rawFreq, drugName) {
  const original = normalizeText(rawFreq).toUpperCase();
  let dailyFrequency = 0;
  let mealTiming = '';

  if (original) {
    const tokens = original.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    for (let token of tokens) {
      if (token.endsWith(' AC')) {
        mealTiming = '飯前';
        token = token.slice(0, -3).trim();
      } else if (token.endsWith(' PC')) {
        mealTiming = '飯後';
        token = token.slice(0, -3).trim();
      }

      if (token === 'AC') {
        mealTiming = '飯前';
        continue;
      }
      if (token === 'PC') {
        mealTiming = '飯後';
        continue;
      }

      const mapped = DAILY_FREQ_MAP[token];
      if (mapped) {
        dailyFrequency += mapped;
      }
    }
  }

  if (dailyFrequency === 0) dailyFrequency = 1;

  const dUpper = (drugName || '').toString().toUpperCase();
  if (dUpper.includes('METFORMIN') || (dUpper.includes('ASPIRIN') && dUpper.includes('TABLET'))) {
    mealTiming = '進餐時';
  }

  return { dailyFrequency, mealTiming };
}

// ── 服用途徑
function parseRoute(rawRoute, drugName) {
  const dUpper = (drugName || '').toString().toUpperCase();
  if (dUpper.includes('MOUTHWASH') || dUpper.includes('GARGLE') || dUpper.includes('MOUTH WASH')) {
    return '漱口';
  }
  if (dUpper.includes('GLYCERYL TRINITRATE SUBL')) {
    return '舌下含服';
  }

  const r = normalizeText(rawRoute).toUpperCase();
  switch (r) {
    case 'PO':
      return '口服';
    case 'SL':
      return '舌下含服';
    case 'LA':
      return '外用';
    case 'PR':
      return '直腸/肛門';
    default:
      break;
  }

  const injectionTokens = ['IM', 'SC', 'IV', 'INJ', 'INJECTION', 'IM/IV', 'SC/IV', 'IV INFUSION', 'INTRAVENOUS', 'INTRAMUSCULAR', 'SUBCUTANEOUS'];
  if (injectionTokens.includes(r) || r.includes('INJ') || r.includes('INFUSION')) {
    return '注射';
  }

  return normalizeText(rawRoute);
}

// ── 備藥方式
function parsePreparation(raw) {
  const p = normalizeText(raw);
  if (p === '即時') return 'immediate';
  if (p === '提前') return 'advanced';
  if (p === '無時段') return 'custom';
  return null;
}

// ── 服用時間點
const SLOT_MAP = {
  '7A': '07:00',
  '8A': '08:00',
  '12N': '12:00',
  '4P': '16:00',
  '8P': '20:00',
  '臨睡前': '21:00',
};

function parseTimeSlots(raw) {
  const txt = normalizeText(raw).toUpperCase();
  if (!txt || txt === '無時段') return [];
  const slots = [];
  for (const p of raw.split(/[,，]/)) {
    const token = normalizeText(p).toUpperCase();
    if (!token || token === '無時段') continue;
    if (SLOT_MAP[token]) slots.push(SLOT_MAP[token]);
  }
  return [...new Set(slots)].sort();
}

// ── 移除字串中已配對的區段
function removeRanges(str, ranges) {
  if (!ranges.length) return str;
  ranges.sort((a, b) => a[0] - b[0]);
  let result = '';
  let last = 0;
  for (const [start, end] of ranges) {
    result += str.slice(last, start);
    last = end;
  }
  result += str.slice(last);
  return result;
}

// ── 檢測規則：僅在有閾值時才產生，不會憑空建立預設規則
const VITAL_SIGN_TYPES = ['脈搏', '上壓', '下壓', '血糖值'];
const OP_MAP = {
  '小於或等於': 'lte',
  '大於或等於': 'gte',
  '小於': 'lt',
  '大於': 'gt',
};

function parseInspectionRules(note) {
  const working = note || '';
  const rules = [];
  const ranges = [];

  const pattern = /(脈搏|上壓|下壓|血糖值?)\s*(小於或等於|大於或等於|小於|大於)\s*(\d+(?:\.\d+)?)/g;
  let match;
  while ((match = pattern.exec(working)) !== null) {
    let type = match[1];
    if (type === '血糖') type = '血糖值';
    if (!VITAL_SIGN_TYPES.includes(type)) continue;
    const operator = OP_MAP[match[2]];
    const value = parseFloat(match[3]);
    if (!operator || Number.isNaN(value)) continue;
    rules.push({
      vital_sign_type: type,
      condition_operator: operator,
      condition_value: value,
      action_if_met: 'block_dispensing',
    });
    ranges.push([match.index, match.index + match[0].length]);
  }

  const cleanedNote = removeRanges(working, ranges)
    .replace(/[;；,，、]+/g, '；')
    .replace(/\s+/g, ' ')
    .trim();

  return { rules, cleanedNote };
}

// ── 備註處理：分離 PRN、短期藥物、檢測規則
function buildNotes(rawNotes, fileIsPrn) {
  const combined = Array.isArray(rawNotes)
    ? rawNotes.map((n) => normalizeText(n)).filter(Boolean).join('；')
    : normalizeText(rawNotes);

  const isPrn = fileIsPrn || /\bPRN\b/i.test(combined);
  let notes = combined.replace(/\bPRN\b/gi, '').trim();
  notes = notes.replace(/[;；,，、]+/g, '；').replace(/\s+/g, ' ').trim();

  const inspection = parseInspectionRules(notes);
  notes = inspection.cleanedNote;

  let isLongTerm = true;
  if (notes === '短期藥物') {
    isLongTerm = false;
    notes = '';
  } else if (notes.includes('短期藥物')) {
    notes = notes.replace(/短期藥物/g, '')
      .replace(/[;；,，、]+/g, '；')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    notes: notes || null,
    isPrn,
    isLongTerm,
    rules: inspection.rules,
  };
}

// ── 載入 C 站床位與院友
async function loadCBeds() {
  const { data, error } = await supabase
    .from('beds')
    .select('id, station_id, bed_number')
    .eq('station_id', C_STATION_ID);
  if (error) throw new Error(`讀取 C 站床位失敗：${error.message}`);
  return data || [];
}

async function loadCPatients(cBedIds) {
  const bedIdSet = new Set(cBedIds);
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('院友主表')
      .select('院友id, 中文姓名, 床號, station_id, last_station_id, bed_id, original_bed_id')
      .range(from, from + 999);
    if (error) throw new Error(`讀取院友主表失敗：${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  return all.filter((p) =>
    p.station_id === C_STATION_ID ||
    p.last_station_id === C_STATION_ID ||
    bedIdSet.has(p.bed_id) ||
    bedIdSet.has(p.original_bed_id)
  );
}

function buildLookups(patients) {
  const byName = new Map();
  const byBed = new Map();

  for (const p of patients) {
    const name = normalizeName(p.中文姓名);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(p);

    const bed = normalizeBedNumber(p.床號);
    if (bed) {
      if (!byBed.has(bed)) byBed.set(bed, []);
      byBed.get(bed).push(p);
    }
  }

  return { byName, byBed };
}

function matchPatient(rawBed, rawName, lookups) {
  const name = normalizeName(rawName);
  const bedKey = normalizeBedNumber(rawBed);

  const byName = lookups.byName.get(name) || [];
  if (byName.length === 1) return byName[0];

  if (byName.length > 1 && bedKey) {
    const narrowed = byName.filter((p) => normalizeBedNumber(p.床號) === bedKey);
    if (narrowed.length === 1) return narrowed[0];
  }

  if (bedKey) {
    const byBed = lookups.byBed.get(bedKey) || [];
    if (byBed.length === 1) return byBed[0];
  }

  return null;
}

// ── 確認模式下刪除舊處方（連帶先刪相關檢測規則，避免 FK 錯誤）
async function deleteExistingPrescriptions(patientIds) {
  if (patientIds.length === 0) return 0;

  const allIds = [];
  for (let i = 0; i < patientIds.length; i += BATCH_SIZE) {
    const chunk = patientIds.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('new_medication_prescriptions')
      .select('id')
      .in('patient_id', chunk);
    if (error) throw new Error(`查詢待刪處方失敗：${error.message}`);
    allIds.push(...(data || []).map((d) => d.id));
  }

  if (allIds.length === 0) return 0;

  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const chunk = allIds.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('medication_inspection_rules')
      .delete()
      .in('prescription_id', chunk);
    if (error) {
      console.error(`⚠️ 刪除檢測規則批次失敗：${error.message}`);
    }
  }

  let deleted = 0;
  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const chunk = allIds.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('new_medication_prescriptions').delete().in('id', chunk);
    if (error) throw new Error(`刪除處方失敗：${error.message}`);
    deleted += chunk.length;
  }

  return deleted;
}

// ── 將單一 CSV 列轉為處方記錄
function processRow(row, fileType, lookups) {
  const isPrnFile = fileType === 'prn';
  const idx = {
    bed: 0,
    name: isPrnFile ? 3 : 1,
    drug: isPrnFile ? 4 : 2,
    startDate: isPrnFile ? 5 : 3,
    rxDate: isPrnFile ? 6 : 4,
    source: isPrnFile ? 7 : 5,
    route: isPrnFile ? 11 : 7,
    freq: isPrnFile ? 12 : 8,
    prep: isPrnFile ? 13 : 9,
    dosage: isPrnFile ? 14 : 10,
    slots: isPrnFile ? 15 : 11,
  };

  const bed = normalizeText(row[idx.bed]);
  const name = normalizeText(row[idx.name]);
  const drug = normalizeText(row[idx.drug]);

  if (!bed && !name) {
    return { error: '床號與姓名皆空白', bed, name, drug };
  }

  const patient = matchPatient(bed, name, lookups);
  if (!patient) {
    return { error: '無法配對院友', bed, name, drug };
  }

  const startDate = parseDatePart(row[idx.startDate]);
  const rxDate = parseDatePart(row[idx.rxDate]);
  if (!startDate || !rxDate) {
    return { error: '日期格式無效', bed, name, drug };
  }

  const notesInput = isPrnFile ? [row[8], row[16], row[17], row[18]] : row[6];
  const { notes, isPrn, isLongTerm, rules } = buildNotes(notesInput, isPrnFile);

  const { source, specialty } = parseSource(row[idx.source]);
  const route = parseRoute(row[idx.route], drug);
  const { dailyFrequency, mealTiming } = parseFrequencyAndTiming(row[idx.freq], drug);
  const { amount, unit } = parseDosage(row[idx.dosage]);
  const slots = parseTimeSlots(row[idx.slots]);
  const prep = parsePreparation(row[idx.prep]);

  const prescription = {
    patient_id: patient.院友id,
    medication_name: drug,
    prescription_date: rxDate,
    start_date: startDate,
    start_time: null,
    end_date: null,
    end_time: null,
    administration_route: route,
    dosage_amount: amount,
    dosage_unit: unit,
    frequency_type: 'daily',
    frequency_value: 1,
    daily_frequency: dailyFrequency,
    is_prn: isPrn,
    is_long_term: isLongTerm,
    medication_time_slots: slots,
    meal_timing: mealTiming,
    notes,
    preparation_method: prep,
    status: 'active',
    medication_source: source,
    medication_source_specialty: specialty,
  };

  return { prescription, rules, patient };
}

// ── 輸出摘要
function printSummary(totalRows, toInsert, unmatched, perPatient, prnCount, ruleCount) {
  const matched = toInsert.length;
  console.log('\n📊 預覽摘要');
  console.log(`  CSV 總列數：${totalRows}`);
  console.log(`  成功配對：${matched}`);
  console.log(`  未能配對：${unmatched.length}`);
  console.log(`  含 PRN：${prnCount}`);
  console.log(`  檢測規則：${ruleCount}`);
  console.log(`  涉及院友：${perPatient.size}`);

  if (perPatient.size > 0) {
    console.log('\n👤 每位院友彙總（前 50 位）：');
    const entries = [...perPatient.entries()]
      .sort((a, b) => a[1].bed.localeCompare(b[1].bed, undefined, { numeric: true }));
    for (const [id, info] of entries.slice(0, 50)) {
      console.log(`  ${info.bed || '?'}	${info.name}	院友id=${id}	處方=${info.prescriptions}	PRN=${info.prn}	規則=${info.rules}`);
    }
    if (entries.length > 50) console.log(`  ... 還有 ${entries.length - 50} 位`);
  }

  if (unmatched.length > 0) {
    console.log('\n⚠️ 未能配對的列（前 30 列）：');
    for (const u of unmatched.slice(0, 30)) {
      console.log(`  ${u.file.toUpperCase()} 第 ${u.line} 行 | 床號=${u.bed} | 姓名=${u.name} | 藥物=${u.drug} | 原因：${u.reason}`);
    }
    if (unmatched.length > 30) console.log(`  ... 還有 ${unmatched.length - 30} 列`);
  }

  if (DRY_RUN) {
    console.log('\n🔍 目前為乾跑模式，未寫入資料庫。正式匯入請加上 --confirm');
  }
}

// ── 主流程
async function main() {
  console.log(`模式：${DRY_RUN ? 'DRY-RUN（不寫入）' : '正式寫入（--confirm）'}`);
  console.log(`CSV：${HMS_CSV}、${HMS_PRN_CSV}`);

  const [hmsLines, prnLines, cBeds] = await Promise.all([
    readCsv(HMS_CSV),
    readCsv(HMS_PRN_CSV),
    loadCBeds(),
  ]);

  const cPatients = await loadCPatients(cBeds.map((b) => b.id));
  const lookups = buildLookups(cPatients);

  console.log(`C 站床位：${cBeds.length} 張，篩選院友：${cPatients.length} 位`);

  const toInsert = [];
  const unmatched = [];
  const matchedPatientIds = new Set();
  const perPatient = new Map();
  let totalRows = 0;
  let prnCount = 0;
  let ruleCount = 0;

  function walk(rows, fileType) {
    // 跳過第一列標題
    for (let i = 1; i < rows.length; i++) {
      totalRows += 1;
      const row = rows[i];
      const result = processRow(row, fileType, lookups);

      if (result.error) {
        unmatched.push({
          file: fileType,
          line: i + 1,
          bed: normalizeText(row[0]),
          name: normalizeText(row[fileType === 'prn' ? 3 : 1]),
          drug: normalizeText(row[fileType === 'prn' ? 4 : 2]),
          reason: result.error,
        });
        continue;
      }

      const { prescription, rules, patient } = result;
      toInsert.push({ prescription, rules });
      matchedPatientIds.add(patient.院友id);

      if (prescription.is_prn) prnCount += 1;
      ruleCount += rules.length;

      const key = patient.院友id;
      if (!perPatient.has(key)) {
        perPatient.set(key, {
          name: patient.中文姓名,
          bed: patient.床號,
          prescriptions: 0,
          prn: 0,
          rules: 0,
        });
      }
      const info = perPatient.get(key);
      info.prescriptions += 1;
      if (prescription.is_prn) info.prn += 1;
      info.rules += rules.length;
    }
  }

  walk(hmsLines, 'hms');
  walk(prnLines, 'prn');

  printSummary(totalRows, toInsert, unmatched, perPatient, prnCount, ruleCount);

  if (DRY_RUN || toInsert.length === 0) {
    return;
  }

  // 正式寫入
  const patientIds = [...matchedPatientIds];
  console.log(`\n🗑️ 開始刪除 ${patientIds.length} 位院友的現有 C 站處方...`);
  const deleted = await deleteExistingPrescriptions(patientIds);
  console.log(`已刪除現有處方：${deleted} 筆`);

  console.log('\n📝 開始插入新處方...');
  let insertedRx = 0;
  let insertedRules = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const prescriptions = batch.map((b) => b.prescription);

    const { data, error } = await supabase
      .from('new_medication_prescriptions')
      .insert(prescriptions)
      .select('id');
    if (error) throw new Error(`批次插入處方失敗（第 ${i + 1} 筆起）：${error.message}`);
    if (!data || data.length !== prescriptions.length) {
      throw new Error('處方插入後回傳的 ID 數量不符');
    }

    const rulesToInsert = [];
    for (let j = 0; j < data.length; j++) {
      for (const rule of batch[j].rules) {
        rulesToInsert.push({ ...rule, prescription_id: data[j].id });
      }
    }

    if (rulesToInsert.length > 0) {
      const { error: ruleError } = await supabase
        .from('medication_inspection_rules')
        .insert(rulesToInsert);
      if (ruleError) throw new Error(`批次插入檢測規則失敗：${ruleError.message}`);
      insertedRules += rulesToInsert.length;
    }

    insertedRx += prescriptions.length;
    console.log(`✅ 已插入 ${insertedRx}/${toInsert.length} 筆處方（檢測規則 ${insertedRules} 筆）`);
  }

  console.log(`\n🎉 完成：刪除 ${deleted} 筆，新增 ${insertedRx} 筆處方與 ${insertedRules} 筆檢測規則。`);
}

main().catch((err) => {
  console.error('執行失敗：', err);
  process.exit(1);
});
