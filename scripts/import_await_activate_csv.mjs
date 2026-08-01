import { createClient } from '@supabase/supabase-js';
import { parse } from '@fast-csv/parse';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const CSV_PATH = process.env.AWAIT_CSV_PATH || 'C:/Users/Admin/Desktop/care-suite/upload/await to activate - Sheet1.csv';
const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const MIGRATION_USER = process.env.MIGRATION_USER || 'system_migration';

const PATIENT_NAME_ALIASES = {
  '何志廉': '何志亷',
  '何玉𡖖': '何玉卿',
};

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('缺少環境變數：請提供 VITE_SUPABASE_URL / SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeSpaces(str) {
  return (str || '').toString().replace(/\s+/g, ' ').trim();
}
function stripQuotes(str) {
  return (str || '').toString().replace(/^["']+|["']+$/g, '').trim();
}
function applyPatientAlias(name) {
  return PATIENT_NAME_ALIASES[name] || name;
}
function normalizeBed(bed) {
  return (bed || '').toString().trim().toUpperCase();
}

function parseDosage(raw) {
  const original = normalizeSpaces(raw);
  if (!original || original === '無時段' || original === '即時' || original === '提前' || original === '適量') return { amount: '', unit: '' };
  const m = original.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { amount: '', unit: original };
  return { amount: m[1], unit: normalizeUnit(m[2]) };
}
function normalizeUnit(unit) {
  if (!unit) return '';
  const u = unit.toString().trim().toLowerCase();
  if (u === 'ml' || u === '毫升') return '毫升';
  if (u === 'tab' || u === 'tablet') return '片';
  if (u === 'cap' || u === 'capsule') return '膠囊';
  if (u === 'sachet') return '包';
  if (u === 'drop') return '滴';
  return unit.trim();
}

function parsePreparation(raw) {
  const s = normalizeSpaces(raw);
  if (['即時', '提前', '無時段'].includes(s)) return s;
  return '';
}
function parseSpecialInstruction(raw) {
  const s = normalizeSpaces(raw);
  if (['適量'].includes(s)) return s;
  return '';
}

function parseRoute(raw) {
  const map = {
    PO: '口服', LA: '外用', PR: '直腸', SC: '皮下注射', IM: '肌肉注射',
    INHL: '吸入', SL: '舌下', BE: '雙耳', LE: '左耳', OU: '雙眼',
    NA: '鼻', 'LEFT EAR': '左耳', 'BOTH EARS': '雙耳', 'NASAL SPRAY': '鼻',
    'MOUTH WASH': '漱口', 'HAIR WASH': '洗頭',
  };
  return map[(raw || '').toString().trim().toUpperCase()] || raw || '';
}

function parseFrequency(raw) {
  const original = normalizeSpaces(raw);
  if (!original) return { frequency_type: 'daily', daily_frequency: 1, meal_timing: '' };
  const base = {
    BD: { daily_frequency: 2 }, TDS: { daily_frequency: 3 }, QID: { daily_frequency: 4 },
    DAILY: { daily_frequency: 1 }, NOCTE: { daily_frequency: 1, meal_timing: '晚上' },
    OM: { daily_frequency: 1, meal_timing: '早上' },
    NOON: { daily_frequency: 1, meal_timing: '中午' },
    '5X/WK': { frequency_type: 'every_x_days', frequency_value: 2, daily_frequency: 1 },
  };
  let key = original.toUpperCase().replace(/^"/, '').trim();
  let meal = '';
  if (key.endsWith(' AC')) { meal = '餐前'; key = key.slice(0, -3).trim(); }
  else if (key.endsWith(' PC')) { meal = '餐後'; key = key.slice(0, -3).trim(); }
  if (base[key]) return { frequency_type: 'daily', ...base[key], meal_timing: meal || base[key].meal_timing || '' };
  if (/^Q\d+H$/i.test(key)) {
    const hours = parseInt(key.match(/\d+/)[0], 10);
    return { frequency_type: 'hourly', frequency_value: hours, daily_frequency: Math.floor(24 / hours), meal_timing: meal };
  }
  return { frequency_type: 'daily', daily_frequency: 1, meal_timing: meal, _raw: original };
}

const TIME_TOKEN_MAP = {
  '7A': '07:00', '7:30A': '07:30', '8A': '08:00', '9A': '09:00', '10A': '10:00', '11A': '11:00',
  '12N': '12:00', '1P': '13:00', '2P': '14:00', '3P': '15:00', '4P': '16:00', '4:30P': '16:30',
  '7P': '19:00', '8P': '20:00', '9P': '21:00', '10P': '22:00',
};
function parseTimeSlots(raw) {
  if (!raw) return [];
  const parts = raw.split(/[,，]/).map(s => stripQuotes(s).trim()).filter(Boolean);
  const slots = [];
  for (const p of parts) {
    const up = p.toUpperCase();
    if (TIME_TOKEN_MAP[up]) slots.push(TIME_TOKEN_MAP[up]);
    else if (/^\d{1,2}:\d{2}$/.test(p)) slots.push(p.padStart(5, '0'));
  }
  return [...new Set(slots)].sort();
}

function parseSource(raw) {
  const original = normalizeSpaces(raw);
  if (!original) return { source: '', specialty: '' };
  const parts = original.split('/').map(s => s.trim()).filter(Boolean);
  let hospital = parts[0] || '';
  let specialty = parts[1] || '';
  if (hospital.toUpperCase() === 'CGAT') hospital = '廣華醫院';
  return { source: hospital, specialty };
}

function parseDate(raw) {
  const d = normalizeSpaces(raw);
  return d || null;
}

async function loadPatients() {
  const { data, error } = await supabase.from('院友主表').select('院友id,床號,中文姓名,在住狀態');
  if (error) throw new Error(`讀取院友失敗：${error.message}`);
  return data || [];
}

function findPatient(rawBed, rawName, patients) {
  const bed = normalizeBed(rawBed);
  const name = applyPatientAlias(normalizeSpaces(rawName));
  if (!name) return null;
  const residents = patients.filter(p => p.在住狀態 === '在住');

  // 姓名 + 完整床號
  const exact = residents.find(p => {
    const pName = normalizeSpaces(p.中文姓名);
    const pBed = normalizeBed(p.床號);
    return pName === name && pBed === bed;
  });
  if (exact) return exact.院友id;

  // 姓名 + 去掉前綴床號
  const prefixMatch = residents.find(p => {
    const pName = normalizeSpaces(p.中文姓名);
    const pBed = normalizeBed(p.床號).replace(/^[A-Z]/, '');
    return pName === name && pBed === bed;
  });
  if (prefixMatch) return prefixMatch.院友id;

  // 純姓名（唯一在住）
  const nameMatches = residents.filter(p => normalizeSpaces(p.中文姓名) === name);
  if (nameMatches.length === 1) return nameMatches[0].院友id;

  return null;
}

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = fs.createReadStream(filePath);
    const parser = parse({ headers: true, trim: true, ignoreEmpty: true });
    stream.pipe(parser).on('error', reject).on('data', r => rows.push(r)).on('end', () => resolve(rows));
  });
}

async function insertPrescriptions(records) {
  if (!records.length) return { count: 0 };
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { data, error } = await supabase.from('new_medication_prescriptions').insert(batch).select('id');
    if (error) throw new Error(`批次插入失敗（第 ${i + 1} 筆起）：${error.message}`);
    inserted += data.length;
  }
  return { count: inserted };
}

async function main() {
  console.log(`模式：${DRY_RUN ? 'DRY-RUN（不寫入資料庫）' : '正式執行'}`);
  console.log(`讀取 CSV：${CSV_PATH}`);

  const [rawRows, patients] = await Promise.all([parseCsv(CSV_PATH), loadPatients()]);
  console.log(`CSV 列數：${rawRows.length}，院友數：${patients.length}`);

  const records = [];
  const errors = [];
  let rowNum = 1;

  for (const row of rawRows) {
    rowNum += 1;
    try {
      const values = Object.values(row).map(v => (v || '').toString().trim());
      if (values.length < 6) {
        errors.push({ row: rowNum, reason: '欄位不足', values });
        continue;
      }
      const bed = values[1];
      const name = values[4];
      const medicationName = values[5];
      const startDate = values[6];
      const prescriptionDate = values[7];
      const sourceRaw = values[8];
      const prescriber = values[9];
      const prepOrSpecial = values[10];
      const routeRaw = values[11];
      const freqRaw = values[12];
      const dosageRaw = values[13];
      const timeRaw = values[14];
      const remarkLabel = values[15];
      const remarkContent = values[16];

      if (!medicationName) {
        errors.push({ row: rowNum, reason: '藥物名稱空白', name });
        continue;
      }

      const patientId = findPatient(bed, name, patients);
      if (!patientId) {
        errors.push({ row: rowNum, reason: '找不到院友', bed, name });
        continue;
      }

      let route = parseRoute(routeRaw);
      // TNG 舌下丸在院內歸類為口服藥
      if (/\b(TNG|GLYCERYL TRINITRATE)\b/i.test(medicationName)) {
        route = '口服';
      }
      const freq = parseFrequency(freqRaw);
      const { amount, unit } = parseDosage(dosageRaw);
      const prep = parsePreparation(prepOrSpecial);
      const special = parseSpecialInstruction(prepOrSpecial);
      const isNoTimeSlot = /無時段|無時間|無服藥時段/i.test(timeRaw);
      let slots = parseTimeSlots(timeRaw);

      // 備藥方式
      let preparation = 'immediate';
      const oralUnits = ['粒', '片', '膠囊'];
      const isOralTablet = route === '口服' && oralUnits.includes(unit);
      const isPrn = /\bPRN\b/i.test(remarkContent || '');
      if (isOralTablet && !(isPrn && slots.length === 0)) preparation = 'advanced';
      if (prep === '提前') preparation = 'advanced';
      if (prep === '即時') preparation = 'immediate';
      // TNG 舌下丸即時備藥
      if (/\b(TNG|GLYCERYL TRINITRATE)\b/i.test(medicationName)) preparation = 'immediate';

      const { source, specialty } = parseSource(sourceRaw);

      const notesParts = [];
      if (special) notesParts.push(special);
      if (prescriber && prescriber !== 'lowong') notesParts.push(`開方：${prescriber}`);
      if (remarkLabel || remarkContent) {
        const label = remarkLabel ? remarkLabel.replace(/：$/, '') : '';
        if (label && remarkContent) notesParts.push(`${label}：${remarkContent}`);
        else if (remarkContent) notesParts.push(remarkContent);
      }
      if (freq._raw) notesParts.push(`原頻率：${freq._raw}`);

      const record = {
        patient_id: patientId,
        medication_name: medicationName,
        prescription_date: parseDate(prescriptionDate),
        start_date: parseDate(startDate),
        start_time: null,
        end_date: null,
        dosage_form: '',
        administration_route: route || null,
        dosage_amount: amount || null,
        dosage_unit: unit || null,
        frequency_type: freq.frequency_type,
        frequency_value: freq.frequency_value || null,
        specific_weekdays: [],
        is_odd_even_day: 'none',
        is_prn: isPrn,
        medication_time_slots: slots,
        meal_timing: freq.meal_timing || null,
        notes: notesParts.join('；') || null,
        preparation_method: preparation,
        status: 'pending_change',
        medication_source: source || null,
        medication_source_specialty: specialty || null,
        medication_quantity: null,
        is_long_term: true,
        inspection_rules: [],
        created_by: MIGRATION_USER,
        last_modified_by: MIGRATION_USER,
      };
      records.push(record);
    } catch (err) {
      errors.push({ row: rowNum, reason: err.message, raw: row });
    }
  }

  console.log(`\n預計寫入待變更處方：${records.length}`);
  console.log(`錯誤 / 跳過：${errors.length}`);
  if (errors.length) {
    console.log('錯誤詳情（前 10 筆）：');
    for (const e of errors.slice(0, 10)) console.log(`  row ${e.row}: ${e.reason} ${JSON.stringify({ bed: e.bed, name: e.name })}`);
  }

  if (DRY_RUN) {
    console.log('\nDRY-RUN 預覽（前 3 筆）：');
    for (const rec of records.slice(0, 3)) console.log(JSON.stringify(rec, null, 2));
  } else {
    const { count } = await insertPrescriptions(records);
    console.log(`\n實際寫入：${count} 筆`);
  }
}

main().catch(err => {
  console.error('執行失敗：', err);
  process.exit(1);
});
