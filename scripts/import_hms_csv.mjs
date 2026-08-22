import { createClient } from '@supabase/supabase-js';
import { parse } from '@fast-csv/parse';
import fs from 'fs';
import path from 'path';

const CSV_PATH = process.env.HMS_CSV_PATH || path.resolve('apps/web/public/hms.csv');
const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const MIGRATION_USER = process.env.MIGRATION_USER || 'system_migration';
const C_STATION_CODE = process.env.C_STATION_CODE || 'C';

// CSV 院友姓名異體字 → 資料庫姓名
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

// ── 醫院簡稱 → 英文全名（來自 121304e.pdf）
const HOSPITAL_ABBREV_EN = {
  CCH: 'Cheshire Home (Chung Hom Kok)',
  PYNEH: 'Pamela Youde Nethersole Eastern Hospital',
  RH: 'Ruttonjee Hospital',
  SJH: 'St John Hospital',
  TSKH: 'Tang Shiu Kin Hospital',
  TWEH: 'Tung Wah Eastern Hospital',
  WCHH: 'Wong Chuk Hang Hospital',
  DKCH: 'The Duchess of Kent Children\'s Hospital at Sandy Bay',
  GH: 'Grantham Hospital',
  MMRC: 'MacLehose Medical Rehabilitation Centre',
  QMH: 'Queen Mary Hospital',
  TYH: 'Tsan Yuk Hospital',
  FYKH: 'Tung Wah Group of Hospitals Fung Yiu King Hospital',
  TWH: 'Tung Wah Hospital',
  BTS: 'HK Red Cross Blood Transfusion Service',
  HKBH: 'Hong Kong Buddhist Hospital',
  HKCH: 'Hong Kong Children\'s Hospital',
  HKEH: 'Hong Kong Eye Hospital',
  KH: 'Kowloon Hospital',
  KWH: 'Kwong Wah Hospital',
  OLMH: 'Our Lady of Maryknoll Hospital',
  QEH: 'Queen Elizabeth Hospital',
  WTSH: 'Tung Wah Group of Hospitals Wong Tai Sin Hospital',
  HHH: 'Haven of Hope Hospital',
  TKOH: 'Tseung Kwan O Hospital',
  UCH: 'United Christian Hospital',
  CMC: 'Caritas Medical Centre',
  KCH: 'Kwai Chung Hospital',
  NLTH: 'North Lantau Hospital',
  PMH: 'Princess Margaret Hospital',
  YCH: 'Yan Chai Hospital',
  AHNH: 'Alice Ho Miu Ling Nethersole Hospital',
  BBH: 'Bradbury Hospice',
  SCH: 'Cheshire Home (Shatin)',
  NDH: 'North District Hospital',
  PWH: 'Prince of Wales Hospital',
  SH: 'Shatin Hospital',
  TPH: 'Tai Po Hospital',
  CPH: 'Castle Peak Hospital',
  POH: 'Pok Oi Hospital',
  SLH: 'Siu Lam Hospital',
  TSWH: 'Tin Shui Wai Hospital',
  TMH: 'Tuen Mun Hospital',
  CGAT: 'Kwong Wah Hospital',
};

// ── 英文醫院名 → 中文醫院名
const EN_TO_ZH_HOSPITAL = {
  'Cheshire Home (Chung Hom Kok)': '舂坎角慈氏護養院',
  'Pamela Youde Nethersole Eastern Hospital': '東區尤德夫人那打素醫院',
  'Ruttonjee Hospital': '律敦治醫院',
  'Tang Shiu Kin Hospital': '鄧肇堅醫院',
  'Tung Wah Eastern Hospital': '東華東院',
  'Wong Chuk Hang Hospital': '黃竹坑醫院',
  'The Duchess of Kent Children\'s Hospital at Sandy Bay': '大口環根德公爵夫人兒童醫院',
  'Grantham Hospital': '葛量洪醫院',
  'Queen Mary Hospital': '瑪麗醫院',
  'Tsan Yuk Hospital': '贊育醫院',
  'Tung Wah Hospital': '東華醫院',
  'Hong Kong Buddhist Hospital': '香港佛教醫院',
  'Hong Kong Children\'s Hospital': '香港兒童醫院',
  'Hong Kong Eye Hospital': '香港眼科醫院',
  'Kowloon Hospital': '九龍醫院',
  'Kwong Wah Hospital': '廣華醫院',
  'Our Lady of Maryknoll Hospital': '聖母醫院',
  'Queen Elizabeth Hospital': '伊利沙伯醫院',
  'Haven of Hope Hospital': '播道醫院',
  'Tseung Kwan O Hospital': '將軍澳醫院',
  'United Christian Hospital': '基督教聯合醫院',
  'Caritas Medical Centre': '明愛醫院',
  'Kwai Chung Hospital': '葵涌醫院',
  'North Lantau Hospital': '北大嶼山醫院',
  'Princess Margaret Hospital': '瑪嘉烈醫院',
  'Yan Chai Hospital': '仁濟醫院',
  'Alice Ho Miu Ling Nethersole Hospital': '雅麗氏何妙齡那打素醫院',
  'North District Hospital': '北區醫院',
  'Prince of Wales Hospital': '威爾斯親王醫院',
  'Shatin Hospital': '沙田醫院',
  'Tai Po Hospital': '大埔醫院',
  'Castle Peak Hospital': '青山醫院',
  'Pok Oi Hospital': '博愛醫院',
  'Siu Lam Hospital': '小欖醫院',
  'Tin Shui Wai Hospital': '天水圍醫院',
  'Tuen Mun Hospital': '屯門醫院',
  'Bradbury Hospice': '白普理寧養中心',
  'Cheshire Home (Shatin)': '沙田慈氏護養院',
};

// ── 服用途徑縮寫 → 中文（對照大小寫）
const ROUTE_MAP = {
  PO: '口服',
  LA: '外用',
  PR: '直腸',
  SC: '皮下注射',
  IM: '肌肉注射',
  INHL: '吸入',
  SL: '舌下', // 舌下含服：獨立子類，藥紙歸口服
  BE: '雙耳',
  'BOTH EARS': '雙耳',
  LE: '左耳',
  'LEFT EAR': '左耳',
  RE: '右耳',
  'RIGHT EAR': '右耳',
  OU: '雙眼',
  NA: '鼻',
  'NASAL SPRAY': '鼻',
  'MOUTH WASH': '漱口', // 漱口：獨立子類，藥紙歸口服
  'HAIR WASH': '洗頭',
};

// ── 頻率基底對照（未含 AC/PC 等後綴）
const BASE_FREQ = {
  BD: { frequency_type: 'daily', daily_frequency: 2 },
  TDS: { frequency_type: 'daily', daily_frequency: 3 },
  QID: { frequency_type: 'daily', daily_frequency: 4 },
  DAILY: { frequency_type: 'daily', daily_frequency: 1 },
  NOCTE: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '晚上' },
  NOON: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '中午' },
  PM: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '晚上' },
  臨睡前: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '睡前' },
  早餐時: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '早餐時' },
  晚餐後: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '晚餐後' },
  晚餐時: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '晚餐時' },
  進餐時或餐後1小時: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '進餐時' },
  餐前或餐後兩小時: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '餐前' },
  OM: { frequency_type: 'daily', daily_frequency: 1, meal_timing: '早上' },
  Q6H: { frequency_type: 'hourly', frequency_value: 6, daily_frequency: 4 },
  Q4H: { frequency_type: 'hourly', frequency_value: 4, daily_frequency: 6 },
  Q8H: { frequency_type: 'hourly', frequency_value: 8, daily_frequency: 3 },
  Q12H: { frequency_type: 'hourly', frequency_value: 12, daily_frequency: 2 },
  Q48H: { frequency_type: 'every_x_days', frequency_value: 2, daily_frequency: 1 },
  Q72H: { frequency_type: 'every_x_days', frequency_value: 3, daily_frequency: 1 },
  '1X/WK': { frequency_type: 'every_x_days', frequency_value: 7, daily_frequency: 1 },
  '2X/WK': { frequency_type: 'every_x_days', frequency_value: 3, daily_frequency: 1 },
  '3X/WK': { frequency_type: 'every_x_days', frequency_value: 2, daily_frequency: 1 },
  '4X/WK': { frequency_type: 'every_x_days', frequency_value: 2, daily_frequency: 1 },
  '5X/WK': { frequency_type: 'every_x_days', frequency_value: 1, daily_frequency: 1 },
  '1X/MTH': { frequency_type: 'every_x_months', frequency_value: 1, daily_frequency: 1 },
  Q3MON: { frequency_type: 'every_x_months', frequency_value: 3, daily_frequency: 1 },
  Q6M: { frequency_type: 'every_x_months', frequency_value: 6, daily_frequency: 1 },
  'ON EVEN DAYS': { frequency_type: 'odd_even_days', is_odd_even_day: 'even', daily_frequency: 1 },
  'ON ODD DAYS': { frequency_type: 'odd_even_days', is_odd_even_day: 'odd', daily_frequency: 1 },
  'ALT DAY': { frequency_type: 'odd_even_days', is_odd_even_day: 'odd', daily_frequency: 1 },
  STAT: { frequency_type: 'daily', daily_frequency: 1 },
  當天一次: { frequency_type: 'daily', daily_frequency: 1 },
  '5X/DAY': { frequency_type: 'daily', daily_frequency: 5 },
  '8X/DAY': { frequency_type: 'daily', daily_frequency: 8 },
  RT: { frequency_type: 'daily', daily_frequency: 1 },
  見備註: { frequency_type: 'daily', daily_frequency: 1 },
};

// ── 時間點 token → HH:MM
const TIME_TOKEN_MAP = {
  '7A': '07:00',
  '7:30A': '07:30',
  '8A': '08:00',
  '9A': '09:00',
  '10A': '10:00',
  '11A': '11:00',
  '12N': '12:00',
  '1P': '13:00',
  '2P': '14:00',
  '3P': '15:00',
  '4P': '16:00',
  '4:30P': '16:30',
  '7P': '19:00',
  '8P': '20:00',
  '9P': '21:00',
  '10P': '22:00',
};

const VITAL_SIGN_ORDER = ['上壓', '下壓', '脈搏', '血糖值', '呼吸', '血含氧量', '體溫'];

function normalizeSpaces(str) {
  return (str || '').toString().replace(/\s+/g, ' ').trim();
}

function stripQuotes(str) {
  return (str || '').toString().replace(/^["']+|["']+$/g, '').trim();
}

// ── 解析 CSV 服用時間點
function parseTimeSlots(raw) {
  if (!raw) return [];
  const parts = raw.split(/[,，]/).map(s => stripQuotes(s).trim()).filter(Boolean);
  const slots = [];
  for (const p of parts) {
    const up = p.toUpperCase();
    if (['無時段', '提前', '即時', 'NONE'].includes(up)) continue;
    if (TIME_TOKEN_MAP[up]) {
      slots.push(TIME_TOKEN_MAP[up]);
    } else if (/^\d{1,2}:\d{2}$/.test(p)) {
      slots.push(p.padStart(5, '0'));
    } else {
      const m = p.match(/^(\d{1,2})(?::(\d{2}))?([AP])$/i);
      if (m) {
        let h = parseInt(m[1], 10);
        const min = m[2] ? parseInt(m[2], 10) : 0;
        const ap = m[3].toUpperCase();
        if (ap === 'P' && h !== 12) h += 12;
        if (ap === 'A' && h === 12) h = 0;
        slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
    }
  }
  return [...new Set(slots)].sort();
}

// ── 解析單一頻率 token
function lookupSingleFrequency(token) {
  let key = token.toUpperCase().replace(/^"/, '').trim();
  key = key.replace(/^DAY\s+/, '');

  let mealTiming = '';
  if (key.endsWith(' AC')) {
    mealTiming = '餐前';
    key = key.slice(0, -3).trim();
  } else if (key.endsWith(' PC')) {
    mealTiming = '餐後';
    key = key.slice(0, -3).trim();
  }

  const zhKey = token.replace(/^"/, '').trim();
  const lookupKey = BASE_FREQ[key] ? key : Object.keys(BASE_FREQ).find(k => k.toUpperCase() === key || k === zhKey);
  if (!lookupKey || !BASE_FREQ[lookupKey]) return null;

  const base = { ...BASE_FREQ[lookupKey] };
  if (mealTiming) base.meal_timing = mealTiming;
  if (!base.meal_timing) base.meal_timing = '';
  return base;
}

// ── 解析頻率（支援逗號分隔組合）
function parseFrequency(raw, unknownFreqs) {
  const original = normalizeSpaces(raw);
  if (!original) return { frequency_type: 'daily', daily_frequency: 1 };

  const tokens = original.split(/[,，]/).map(s => stripQuotes(s).trim()).filter(Boolean);
  const results = [];
  for (const t of tokens) {
    const r = lookupSingleFrequency(t);
    if (r) {
      results.push(r);
    } else {
      unknownFreqs.add(original);
      results.push({ frequency_type: 'daily', daily_frequency: 1, meal_timing: '', _unknown: original });
    }
  }

  const first = results[0];
  let dailyFreq = 0;
  let mealTimings = [];
  let freqType = first.frequency_type;
  let freqValue = first.frequency_value || null;
  let oddEven = first.is_odd_even_day || 'none';

  for (const r of results) {
    dailyFreq += r.daily_frequency || 1;
    if (r.meal_timing) mealTimings.push(r.meal_timing);
    if (r.frequency_type && r.frequency_type !== 'daily') {
      freqType = r.frequency_type;
      if (r.frequency_value) freqValue = r.frequency_value;
      if (r.is_odd_even_day) oddEven = r.is_odd_even_day;
    }
  }

  return {
    frequency_type: freqType,
    daily_frequency: dailyFreq || 1,
    frequency_value: freqValue,
    is_odd_even_day: oddEven,
    meal_timing: mealTimings[0] || '',
    _unknown: first._unknown,
  };
}

// ── 劑型推測
function inferDosageForm(route, unit) {
  const u = (unit || '').toString().toLowerCase();
  // 舌下、漱口視為口服子類
  const oralRoutes = ['口服', '舌下', '漱口'];
  if (oralRoutes.includes(route)) {
    if (['粒', '片', '膠囊', 'mg', 'g', 'mcg', 'iu'].includes(u)) return '片劑';
    if (['毫升', 'ml'].includes(u)) return '藥水';
    // 漱口/舌下無單位時預設片劑或藥水；Mouth Wash 無單位則傾向藥水
    if (route === '漱口') return '藥水';
    return '片劑';
  }
  if (['肌肉注射', '皮下注射'].includes(route)) return '注射劑';
  if (['直腸', 'PR'].includes(route)) return '栓劑';
  if (['滴眼', '滴耳', '鼻', '鼻噴霧'].includes(route)) return '滴劑';
  if (route === '吸入') return '吸入劑';
  if (route === '洗頭') return '外用藥膏';
  return '外用藥膏';
}

// ── 單位標準化
function normalizeUnit(unit) {
  if (!unit) return '';
  const u = unit.toString().trim().toLowerCase();
  if (u === 'ml' || u === '毫升') return '毫升';
  if (u === 'tab' || u === 'tablet') return '片';
  if (u === 'cap' || u === 'capsule') return '膠囊';
  return unit.trim();
}

// ── 解析劑量/單位
function parseDosage(raw) {
  const original = normalizeSpaces(raw);
  if (!original) return { amount: '', unit: '' };
  const m = original.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { amount: '', unit: normalizeUnit(original) };
  return { amount: m[1], unit: normalizeUnit(m[2]) };
}

// ── 藥物名稱正規化（用於比對藥物資料庫）
const DRUG_NAME_NOISE = new Set([
  'tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules',
  'fc', 'film', 'coated', 'film-coated', 'extended', 'release', 'er', 'sr', 'cr',
  'blister', 'box', 'bottle', 'hospital', 'pack',
  'inj', 'injection', 'syr', 'syrup', 'ointment', 'oint', 'cream', 'solution', 'soln',
  'drop', 'drops', 'nasal', 'spray', 'patch', 'powder', 'powd', 'inhaler', 'inhl',
  'turbuhaler', 'penfill', 'suppository', 'supp', 'suspension', 'susp', 'sachet',
  'hm', 'as', 'besylate', 'fumarate', 'hcl', 'sodium', 'calcium', 'potassium',
]);

function normalizeDrugName(name) {
  let s = (name || '').toString().toLowerCase();
  s = s.replace(/\(.*?\)/g, ' ');
  s = s.replace(/[\/\,\-–—.+&]/g, ' ');
  const tokens = s.split(/\s+/).filter(Boolean).map(t => t.trim()).filter(t => !DRUG_NAME_NOISE.has(t) && !/^(as|fc|er|sr|cr)$/i.test(t));
  const normalized = tokens.map(t => {
    if (/^\d+(?:\.\d+)?microgram(s)?$/.test(t)) return t.replace(/micrograms?/, 'mcg');
    return t;
  });
  return normalized.sort().join(' ');
}

// ── 床位範圍檢查（支援 C202-1 / 202-1 等格式，取第一組數字）
function parseBedFloor(bed) {
  const m = (bed || '').toString().match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function isInCBedRange(bed) {
  const floor = parseBedFloor(bed);
  return floor !== null && floor >= 202 && floor <= 237;
}

function normalizeBed(bed) {
  return (bed || '').toString().trim().toUpperCase();
}

// ── 解析院友：CSV 床號通常不含大廈前綴，資料庫則可能為 C202-1；只配對在住院友
function applyPatientAlias(name) {
  return PATIENT_NAME_ALIASES[name] || name;
}

function findPatient(rawBed, rawName, patients) {
  const bed = normalizeBed(rawBed);
  const name = applyPatientAlias(normalizeSpaces(rawName));
  if (!name || !bed) return null;

  if (/^[A-Z]/.test(bed)) {
    const exact = patients.find(p => {
      const pName = normalizeSpaces(p.中文姓名);
      const pBed = normalizeBed(p.床號);
      return pName === name && pBed === bed;
    });
    return exact ? exact.院友id : null;
  }

  const prefixMatch = patients.find(p => {
    const pName = normalizeSpaces(p.中文姓名);
    const pBed = normalizeBed(p.床號).replace(/^[A-Z]/, '');
    return pName === name && pBed === bed;
  });
  return prefixMatch ? prefixMatch.院友id : null;
}

// ── 藥物配對
function findDrugId(rawName, drugs) {
  const key = normalizeDrugName(rawName);
  if (!key) return null;
  return drugs.normalizedMap[key] || null;
}

// ── 解析藥物來源與專科
function parseSource(raw, settings, unknownSources) {
  const original = normalizeSpaces(raw);
  if (!original) return { source: '', specialty: '' };

  let parts = original.split('/').map(s => s.trim()).filter(Boolean);
  let hospitalToken = parts[0] || '';
  let specialtyToken = parts[1] || '';

  if (hospitalToken.toUpperCase() === 'CGAT') hospitalToken = 'KWH';
  if (specialtyToken.toUpperCase() === 'CGAT') specialtyToken = 'CGAT';

  if (parts.length === 1) {
    const words = hospitalToken.split(/\s+/).filter(Boolean);
    if (words.length > 1 && (HOSPITAL_ABBREV_EN[words[0].toUpperCase()] || findChineseInstitution(words[0], settings))) {
      hospitalToken = words[0];
      specialtyToken = words.slice(1).join(' ');
    }
  }

  let source = findChineseInstitution(hospitalToken, settings);
  if (!source) {
    const enName = HOSPITAL_ABBREV_EN[hospitalToken.toUpperCase()];
    if (enName) {
      source = EN_TO_ZH_HOSPITAL[enName] || enName;
    } else {
      const dashParts = hospitalToken.split(/\s*-\s*/).map(s => s.trim()).filter(Boolean);
      for (const p of dashParts) {
        const candidate = findChineseInstitution(p, settings);
        if (candidate) { source = candidate; break; }
        const en = HOSPITAL_ABBREV_EN[p.toUpperCase()];
        if (en) { source = EN_TO_ZH_HOSPITAL[en] || en; break; }
      }
    }
  }

  if (!source) {
    unknownSources.add(hospitalToken);
    source = hospitalToken;
  }

  const groups = ['機構_醫管局醫院', '機構_醫管局門診', '機構_醫管局精神科', '機構_衛生署', '機構_其他'];
  const alreadyInAny = groups.some(g => settings[g].includes(source));
  if (!alreadyInAny) {
    const enName = HOSPITAL_ABBREV_EN[hospitalToken.toUpperCase()];
    const lowerSource = source.toLowerCase();
    const lowerToken = (specialtyToken || '').toLowerCase();

    if (enName) {
      settings.機構_醫管局醫院.push(source);
    } else if (
      lowerToken.includes('psy') ||
      lowerSource.includes('精神科') ||
      lowerSource.includes('精神健康')
    ) {
      settings.機構_醫管局精神科.push(source);
    } else if (
      lowerSource.includes('門診') ||
      lowerSource.includes('診所') ||
      lowerSource.includes('健康中心') ||
      lowerSource.includes('家庭醫學') ||
      lowerSource.endsWith('藥房') ||
      lowerToken.includes('gopd') ||
      lowerToken.includes('pod') ||
      lowerToken.includes('opd') ||
      lowerToken.includes('oph') ||
      lowerToken.includes('hemat')
    ) {
      settings.機構_醫管局門診.push(source);
    } else {
      settings.機構_其他.push(source);
    }
  }

  let specialty = '';
  if (specialtyToken) {
    const specMap = {
      CGAT: '社區老人評估小組',
      PSY: '精神科',
      PGT: '老人科',
      GOPD: '家庭醫學科',
      POD: '家庭醫學科',
      OPH: '眼科',
      HEMAT: '血液科',
      ORT: '骨科',
      MED: '內科',
    };
    if (specMap[specialtyToken.toUpperCase()]) {
      specialty = specMap[specialtyToken.toUpperCase()];
    } else {
      specialty = specialtyToken;
    }
    if (!settings.專科.includes(specialty)) settings.專科.push(specialty);
  }

  return { source, specialty };
}

function findChineseInstitution(token, settings) {
  if (!token) return null;
  const groups = ['機構_醫管局醫院', '機構_醫管局門診', '機構_醫管局精神科', '機構_衛生署', '機構_其他'];
  for (const g of groups) {
    if (settings[g].includes(token)) return token;
  }
  let best = null;
  for (const g of groups) {
    for (const name of settings[g]) {
      if (token.includes(name) || name.includes(token)) {
        if (!best || name.length > best.length) best = name;
      }
    }
  }
  return best;
}

// ── 解析服用途徑（SL 視為口服子類）
function parseRoute(raw, settings, unknownRoutes) {
  const original = stripQuotes(normalizeSpaces(raw));
  if (!original) return '';
  const key = original.toUpperCase();
  if (ROUTE_MAP[key]) return ROUTE_MAP[key];

  for (const [k, v] of Object.entries(ROUTE_MAP)) {
    if (k.toUpperCase() === key) return v;
  }

  if (original.includes('/') || HOSPITAL_ABBREV_EN[key] || key.startsWith('KCH ') || key.length > 20) {
    unknownRoutes.add(original);
    return original;
  }

  if (!settings.服用途徑.includes(original)) {
    settings.服用途徑.push(original);
  }
  return original;
}

// ── 日期時間解析
function parseDateTime(raw) {
  const original = normalizeSpaces(raw);
  if (!original) return { date: '', time: '' };
  const [datePart, timePart] = original.split(' ');
  const date = datePart || '';
  let time = '';
  if (timePart && timePart !== '00:00') {
    const [h, m] = timePart.split(':');
    const hh = String(parseInt(h || '0', 10)).padStart(2, '0');
    const mm = String(parseInt(m || '0', 10)).padStart(2, '0');
    time = `${hh}:${mm}`;
  }
  return { date, time };
}

// ── 解析注意事項：分離 PRN、檢測項與其餘備註
function parseInspectionRules(note) {
  const rules = [];
  if (!note) return { rules, cleanedNote: '' };

  let working = note;
  const matchedRanges = [];

  // 先移除 PRN 標記本身（會另外用 is_prn 表達）
  const prnRegex = /\bPRN\b/gi;
  let prnMatch;
  while ((prnMatch = prnRegex.exec(working)) !== null) {
    matchedRanges.push([prnMatch.index, prnMatch.index + prnMatch[0].length]);
  }
  working = removeRanges(working, matchedRanges);
  matchedRanges.length = 0;

  // 1. 解析英文監測條件（含閾值與單位）
  const englishUnit = '\\s*(?:mmHg|/min|bpm|%|mg/dL|mmol/L|°C)?';
  const englishPatterns = [
    { regex: new RegExp(`(?:w/h\\s*if|WH\\s*if|withhold\\s*if)?\\s*HR\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${englishUnit}`, 'gi'), type: '脈搏' },
    { regex: new RegExp(`(?:w/h\\s*if|WH\\s*if|withhold\\s*if)?\\s*SBP\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${englishUnit}`, 'gi'), type: '上壓' },
    { regex: new RegExp(`(?:w/h\\s*if|WH\\s*if|withhold\\s*if)?\\s*DBP\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${englishUnit}`, 'gi'), type: '下壓' },
    { regex: new RegExp(`(?:w/h\\s*if|WH\\s*if|withhold\\s*if)?\\s*(?:Blood\\s+)?Glucose\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${englishUnit}`, 'gi'), type: '血糖值' },
    { regex: new RegExp(`(?:w/h\\s*if|WH\\s*if|withhold\\s*if)?\\s*SpO2\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${englishUnit}`, 'gi'), type: '血含氧量' },
    { regex: new RegExp(`(?:w/h\\s*if|WH\\s*if|withhold\\s*if)?\\s*(?:RR|Resp)\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${englishUnit}`, 'gi'), type: '呼吸' },
    { regex: new RegExp(`(?:w/h\\s*if|WH\\s*if|withhold\\s*if)?\\s*(?:Temp|Temperature)\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${englishUnit}`, 'gi'), type: '體溫' },
  ];

  for (const { regex, type } of englishPatterns) {
    let match;
    const localRegex = new RegExp(regex.source, regex.flags.replace('g', '') + 'g');
    while ((match = localRegex.exec(working)) !== null) {
      const operator = operatorFromSymbol(match[1]);
      const value = parseFloat(match[2]);
      rules.push({ vital_sign_type: type, condition_operator: operator, condition_value: value, action_if_met: 'block_dispensing' });
      matchedRanges.push([match.index, match.index + match[0].length]);
    }
  }

  // 2. 解析中文監測條件（含閾值與單位）
  const chineseUnit = '\\s*(?:mmHg|/min|次/min|次/分|bpm|%|mg/dL|mmol/L|°C)?';
  const chinesePatterns = [
    { regex: new RegExp(`脈搏\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${chineseUnit}`, 'g'), type: '脈搏' },
    { regex: new RegExp(`上血壓\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${chineseUnit}`, 'g'), type: '上壓' },
    { regex: new RegExp(`下血壓\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${chineseUnit}`, 'g'), type: '下壓' },
    { regex: new RegExp(`血壓\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${chineseUnit}`, 'g'), type: '上壓' },
    { regex: new RegExp(`血糖(?:值)?\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${chineseUnit}`, 'g'), type: '血糖值' },
    { regex: new RegExp(`(?:血含氧量|血氧)\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${chineseUnit}`, 'g'), type: '血含氧量' },
    { regex: new RegExp(`呼吸\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${chineseUnit}`, 'g'), type: '呼吸' },
    { regex: new RegExp(`體溫\\s*(<=?|>=?)\\s*(\\d+(?:\\.\\d+)?)${chineseUnit}`, 'g'), type: '體溫' },
  ];

  for (const { regex, type } of chinesePatterns) {
    let match;
    const localRegex = new RegExp(regex.source, regex.flags.replace('g', '') + 'g');
    while ((match = localRegex.exec(working)) !== null) {
      const operator = operatorFromSymbol(match[1]);
      const value = parseFloat(match[2]);
      rules.push({ vital_sign_type: type, condition_operator: operator, condition_value: value, action_if_met: 'block_dispensing' });
      matchedRanges.push([match.index, match.index + match[0].length]);
    }
  }

  // 移除已配對的閾值子串
  working = removeRanges(working, matchedRanges);

    // 清理殘留標點與空白
  let cleanedNote = working
    .replace(/[;；,，、]+/g, '；')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(?:^\s*；\s*|\s*；\s*$)/g, '')
    .trim();

  // 去除重複規則（同類型保留一個）
  const seen = new Set();
  const uniqueRules = [];
  for (const r of rules) {
    const key = `${r.vital_sign_type}|${r.condition_operator}|${r.condition_value}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRules.push(r);
    }
  }

  // 按固定生命表徵順序排序
  uniqueRules.sort((a, b) => VITAL_SIGN_ORDER.indexOf(a.vital_sign_type) - VITAL_SIGN_ORDER.indexOf(b.vital_sign_type));

  return { rules: uniqueRules, cleanedNote };
}

function operatorFromSymbol(symbol) {
  if (symbol === '<=') return 'lte';
  if (symbol === '>=') return 'gte';
  if (symbol === '<') return 'lt';
  if (symbol === '>') return 'gt';
  return 'lt';
}

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

// ── 解析備藥方式
function parsePreparation(raw, route, unit, isPrn, slots) {
  const prep = normalizeSpaces(raw);
  if (prep === '提前') return 'advanced';
  if (prep === '即時') return 'immediate';
  if (prep === '無時段') return 'immediate';

  // 預設邏輯：口服藥片且非無時段 PRN 則提前備藥
  const oralUnits = ['粒', '片', '膠囊'];
  const isOralTablet = route === '口服' && oralUnits.includes(unit);
  if (isOralTablet && !(isPrn && slots.length === 0)) return 'advanced';
  return 'immediate';
}

// ── CSV 讀取
function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = fs.createReadStream(filePath);
    const parser = parse({ headers: true, trim: true, ignoreEmpty: true });
    stream
      .pipe(parser)
      .on('error', reject)
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows));
  });
}

// ── 資料庫輔助
async function fetchAll(table, select) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw new Error(`讀取 ${table} 失敗：${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function loadCPatients() {
  const { data: stations, error: stationsErr } = await supabase.from('stations').select('id, code, name');
  if (stationsErr) throw stationsErr;

  const cStation = stations.find(s => s.code === C_STATION_CODE || s.name?.includes(C_STATION_CODE));
  console.log(`C 站識別：${cStation ? `${cStation.name} (${cStation.id})` : '依床位範圍 202-237'}`);

  const { data: allPatients, error: pErr } = await supabase
    .from('院友主表')
    .select('院友id,床號,中文姓名,在住狀態,station_id,bed_id');
  if (pErr) throw pErr;

  let cBedIds = new Set();
  if (cStation) {
    const { data: cBeds, error: bErr } = await supabase
      .from('beds')
      .select('id, station_id, room_number, bed_number')
      .eq('station_id', cStation.id)
      .gte('room_number', '202')
      .lte('room_number', '237');
    if (!bErr && cBeds) {
      cBedIds = new Set(cBeds.map(b => b.id));
    }
  }

  return (allPatients || []).filter(p => {
    if (cStation && p.station_id === cStation.id) return true;
    if (p.bed_id && cBedIds.has(p.bed_id)) return true;
    return isInCBedRange(p.床號);
  });
}

async function deleteCPrescriptions(cPatientIds) {
  const prescriptions = await fetchAll('new_medication_prescriptions', 'id,patient_id');
  const toDelete = prescriptions.filter(rx => cPatientIds.includes(rx.patient_id));

  console.log(`現有 C 站處方：${toDelete.length} 筆`);
  if (toDelete.length === 0) return 0;

  if (DRY_RUN) {
    console.log('DRY-RUN：略過實際刪除');
    return toDelete.length;
  }

  const BATCH = 100;
  const toDeleteIds = toDelete.map(d => d.id);

  let deletedWorkflows = 0;
  for (let i = 0; i < toDeleteIds.length; i += BATCH) {
    const batchIds = toDeleteIds.slice(i, i + BATCH);
    const { error: wfError } = await supabase.from('medication_workflow_records').delete().in('prescription_id', batchIds);
    if (wfError) {
      console.error(`刪除工作流程記錄批次 ${i + 1}-${i + batchIds.length} 失敗：${wfError.message}`);
    } else {
      deletedWorkflows += batchIds.length;
    }
  }
  console.log(`已刪除工作流程記錄：${deletedWorkflows} 筆`);

  let deleted = 0;
  for (let i = 0; i < toDeleteIds.length; i += BATCH) {
    const batchIds = toDeleteIds.slice(i, i + BATCH);
    const { error } = await supabase.from('new_medication_prescriptions').delete().in('id', batchIds);
    if (error) {
      console.error(`刪除處方批次 ${i + 1}-${i + batchIds.length} 失敗：${error.message}`);
    } else {
      deleted += batchIds.length;
    }
  }
  console.log(`已刪除 C 站處方：${deleted} 筆`);
  return deleted;
}

async function loadDrugs() {
  const { data, error } = await supabase.from('medication_drug_database').select('*');
  if (error) throw new Error(`讀取藥物資料庫失敗：${error.message}`);
  const normalizedMap = {};
  for (const d of data || []) {
    const key = normalizeDrugName(d.drug_name);
    if (!normalizedMap[key]) normalizedMap[key] = d.id;
  }
  return { normalizedMap, rows: data || [] };
}

async function createDrug(drug) {
  if (DRY_RUN) return { id: `dry-run-drug-${Math.random().toString(36).slice(2)}` };
  const { data, error } = await supabase.from('medication_drug_database').insert(drug).select('id').single();
  if (error) throw new Error(`新增藥物失敗：${error.message}`);
  return data;
}

async function loadSettings() {
  const { data, error } = await supabase
    .from('facility_settings')
    .select('medication_settings')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(`讀取藥物設定失敗：${error.message}`);

  const defaults = {
    劑型: ['片劑', '膠囊', '藥水', '注射劑', '外用藥膏', '滴劑', '皮膚貼劑'],
    服用途徑: ['口服', '肌肉注射', '皮下注射', '外用', '滴眼', '滴耳', '鼻胃管', '吸入', '舌下', '漱口'],
    服用單位: ['粒', '片', '膠囊', '毫升', '滴', '口', '支', '包', '茶匙', '湯匙', 'mg', 'ml', 'g', 'mcg', 'IU'],
    特殊用法: ['適量', '搽患處', '貼在皮膚上', '薄薄一層', '按需要使用'],
    服用時段: ['餐前', '進餐時', '餐後', '早餐前', '早餐時', '早餐後', '午餐前', '午餐時', '午餐後', '晚餐前', '晚餐時', '晚餐後', '早上', '中午', '晚上', '睡前'],
    每日次數: [1, 2, 3, 4, 5, 6, 8],
    藥物來源: [],
    機構_醫管局醫院: [
      '瑪麗醫院', '東區尤德夫人那打素醫院', '律敦治醫院', '鄧肇堅醫院', '東華醫院', '東華東院',
      '葛量洪醫院', '黃竹坑醫院', '贊育醫院', '大口環根德公爵夫人兒童醫院', '舂坎角慈氏護養院',
      '伊利沙伯醫院', '廣華醫院', '聖母醫院', '九龍醫院', '香港眼科醫院', '香港佛教醫院', '播道醫院',
      '基督教聯合醫院', '將軍澳醫院', '靈實醫院', '瑪嘉烈醫院', '葵涌醫院', '明愛醫院', '北大嶼山醫院',
      '香港兒童醫院', '威爾斯親王醫院', '沙田醫院', '白普理寧養中心', '大埔醫院',
      '雅麗氏何妙齡那打素醫院', '北區醫院', '沙田慈氏護養院', '屯門醫院', '博愛醫院', '仁濟醫院',
      '青山醫院', '天水圍醫院', '小欖醫院',
    ],
    機構_醫管局門診: [
      '柏立基夫人普通科門診診所', '柴灣普通科門診診所', '北南丫普通科門診診所', '坪洲普通科門診診所',
      '西灣河普通科門診診所', '筲箕灣賽馬會普通科門診診所', '索罟灣普通科門診診所', '長洲醫院普通科門診部',
      '赤柱普通科門診診所', '東華東院普通科門診部', '貝夫人普通科門診診所', '環翠普通科門診診所',
      '香港仔賽馬會普通科門診診所', '鴨脷洲普通科門診診所', '中區健康院普通科門診診所',
      '堅尼地城賽馬會普通科門診診所', '西營盤賽馬會普通科門診診所', '東華醫院普通科門診診所',
      '中九龍診所', '東九龍普通科門診診所',
    ],
    機構_醫管局精神科: [
      '東區尤德夫人那打素醫院精神科門診', '瑪麗醫院精神科門診', '戴麟趾康復中心（精神科門診）',
      '九龍醫院精神科門診', '明愛醫院精神科門診', '東九龍精神科中心', '容鳳書紀念中心（精神科門診）',
      '油麻地兒童及青少年精神健康服務', '威爾斯親王醫院精神科門診', '雅麗氏何妙齡那打素醫院精神科門診',
      '沙田醫院精神科門診', '大埔醫院精神科門診', '將軍澳醫院精神科門診', '屯門醫院精神科門診',
      '青山醫院精神科門診', '葵涌醫院精神科門診', '葵涌老齡精神科門診部暨照顧者支援中心',
      '葵涌兒童及青少年精神科中心', '西九龍精神科中心', '北區醫院精神科門診',
    ],
    機構_衛生署: [
      '柴灣社會衞生科診所', '長沙灣皮膚科診所', '粉嶺綜合治療中心(社會衞生科)', '容鳳書皮膚科診所',
      '油麻地皮膚科診所', '西營盤皮膚科診所', '屯門社會衞生科診所', '油麻地女性社會衞生科診所',
      '油麻地男性社會衞生科診所', '容鳳書社會衞生科診所', '灣仔男性社會衞生科診所', '灣仔女性社會衞生科診所',
      '長沙灣政府合署牙科診所', '將軍澳牙科診所', '李寶椿牙科診所', '觀塘牙科診所', '下葵涌政府牙科診所',
      '荃灣政府合署牙科診所', '容鳳書牙科診所', '仁愛牙科診所', '青山醫院牙科診所', '元朗賽馬會牙科診所',
      '荃灣牙科診所', '西營盤牙科診所八樓', '海港政府大樓牙齒矯正科診所', '海港政府大樓牙科診所',
      '香港仔賽馬會牙科診所', '柴灣政府牙科診所', '鄧肇堅牙科診所', '灣仔牙科診所', '馬鞍山牙科診所',
      '尤德夫人政府牙科診所',
    ],
    機構_其他: ['私家診所', '私家藥房', '出院病房配發', '其他'],
    專科: [
      '內科', '外科', '骨科', '婦產科', '兒科', '眼科', '耳鼻喉科', '精神科', '皮膚科', '心臟科',
      '臨床腫瘤科', '神經外科', '神經科', '腎科', '內分泌及糖尿科', '老人科', '復康科', '泌尿外科',
      '風濕科', '呼吸系統科', '腸胃肝臟科', '血液科', '感染及傳染病科', '疼痛科', '紓緩科',
      '家庭醫學科', '急症科', '牙科',
    ],
  };

  const loaded = data?.medication_settings || {};
  const merged = { ...defaults };
  for (const k of Object.keys(defaults)) {
    if (Array.isArray(loaded[k])) merged[k] = [...loaded[k]];
  }
  return merged;
}

async function saveSettings(settings) {
  if (DRY_RUN) return;
  const { data: existing, error: selectError } = await supabase
    .from('facility_settings')
    .select('id')
    .eq('id', 1)
    .maybeSingle();
  if (selectError) throw new Error(`檢查 facility_settings 失敗：${selectError.message}`);

  if (existing) {
    const { error } = await supabase
      .from('facility_settings')
      .update({ medication_settings: settings, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw new Error(`更新藥物設定失敗：${error.message}`);
  } else {
    const { error } = await supabase.from('facility_settings').insert({
      id: 1,
      facility_name_zh: '善頤 (福群) 護老院',
      facility_name_en: 'SeniorCare',
      facility_phone: '',
      facility_address_zh: '',
      facility_address_en: '',
      facility_fax: '',
      medication_settings: settings,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`插入藥物設定失敗：${error.message}`);
  }
}

async function insertPrescriptions(records) {
  if (!records.length) return 0;
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { data, error } = await supabase.from('new_medication_prescriptions').insert(batch).select('id');
    if (error) throw new Error(`批次插入處方失敗（第 ${i + 1} 筆起）：${error.message}`);
    inserted += data.length;
  }
  return inserted;
}

async function main() {
  console.log(`模式：${DRY_RUN ? 'DRY-RUN（不寫入資料庫）' : '正式執行'}`);
  console.log(`CSV：${CSV_PATH}`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`找不到 CSV：${CSV_PATH}`);
    process.exit(1);
  }

  const [rawRows, cPatients, drugsBase, settings] = await Promise.all([
    parseCsv(CSV_PATH),
    loadCPatients(),
    loadDrugs(),
    loadSettings(),
  ]);

  const cPatientIds = cPatients.map(p => p.院友id);
  console.log(`C 站在住院友：${cPatients.length} 位`);

  // 刪除現有 C 站處方
  await deleteCPrescriptions(cPatientIds);

  const records = [];
  const errors = [];
  const unknownFreqs = new Set();
  const unknownRoutes = new Set();
  const unknownSources = new Set();
  const createdDrugs = [];
  const newDrugKeys = new Map();
  let outOfRange = 0;
  let noPatient = 0;
  const inspectionRuleSummary = [];

  let rowNum = 1;
  for (const row of rawRows) {
    rowNum += 1;
    try {
      const rawBed = row['床號'];
      if (!isInCBedRange(rawBed)) {
        outOfRange += 1;
        continue;
      }

      const patientId = findPatient(rawBed, row['院友姓名'], cPatients);
      if (!patientId) {
        noPatient += 1;
        errors.push({
          row: rowNum,
          reason: '床位/姓名配對失敗',
          bed: rawBed,
          name: row['院友姓名'],
        });
        continue;
      }

      const medicationName = normalizeSpaces(row['藥物名稱']);
      if (!medicationName) {
        errors.push({ row: rowNum, reason: '藥物名稱空白' });
        continue;
      }

      const drugKey = normalizeDrugName(medicationName);
      let drugId = findDrugId(medicationName, drugsBase) || newDrugKeys.get(drugKey);
      if (!drugId) {
        const { amount, unit } = parseDosage(row['劑量和單位']);
        const route = parseRoute(row['服用途徑'], settings, unknownRoutes);
        const newDrug = {
          drug_name: medicationName,
          drug_code: null,
          drug_type: '',
          administration_route: route,
          unit: unit || '',
          notes: '由 HMS CSV 匯入自動建立',
        };
        drugId = `dry-run-drug-${createdDrugs.length}`;
        if (!DRY_RUN) {
          const created = await createDrug(newDrug);
          drugId = created.id;
          drugsBase.normalizedMap[drugKey] = drugId;
        }
        newDrugKeys.set(drugKey, drugId);
        createdDrugs.push({ row: rowNum, name: medicationName, id: drugId });
      }

      const { source, specialty } = parseSource(row['藥第來源/專科'], settings, unknownSources);
      let route = parseRoute(row['服用途徑'], settings, unknownRoutes);
      const freq = parseFrequency(row['服用頻率'], unknownFreqs);
      const { amount, unit } = parseDosage(row['劑量和單位']);
      const dosageForm = inferDosageForm(route, unit);
      let slots = parseTimeSlots(row['服用時間點']);

      // 注意事項處理：PRN、檢測項、其餘為備註
      const rawNotes = normalizeSpaces(row['注意事項']);
      let isPrn = /\bPRN\b/i.test(rawNotes || '');
      const { rules: inspectionRules, cleanedNote } = parseInspectionRules(rawNotes);

      let notes = cleanedNote;
      if (freq._unknown) {
        notes = notes ? `${notes}；原頻率：${freq._unknown}` : `原頻率：${freq._unknown}`;
      }

      // 備藥方式
      const preparation = parsePreparation(row['備藥'], route, unit, isPrn, slots);

      // 服用時段
      let mealTiming = freq.meal_timing || '';
      if (/METFORMIN/i.test(medicationName) || /ASPIRIN\s+TABLET/i.test(medicationName)) {
        mealTiming = '進餐時';
      }

      // 短期藥物
      const isLongTerm = !/短期藥物/.test(rawNotes || '');

      const { date: startDate, time: startTime } = parseDateTime(row['開始日期']);
      const prescriptionDate = row['處方日期'] || startDate;

      // 確保設定選項存在
      if (freq.daily_frequency && !settings.每日次數.includes(freq.daily_frequency)) {
        settings.每日次數.push(freq.daily_frequency);
        settings.每日次數.sort((a, b) => a - b);
      }
      if (mealTiming && !settings.服用時段.includes(mealTiming)) {
        settings.服用時段.push(mealTiming);
      }
      if (route && !settings.服用途徑.includes(route)) {
        settings.服用途徑.push(route);
      }

      if (inspectionRules.length) {
        inspectionRuleSummary.push({
          row: rowNum,
          patient: `${rawBed} ${row['院友姓名']}`,
          medication: medicationName,
          rules: inspectionRules.map(r => `${r.vital_sign_type} ${r.condition_operator} ${r.condition_value}`).join(', '),
        });
      }

      records.push({
        patient_id: patientId,
        medication_name: medicationName,
        prescription_date: prescriptionDate,
        start_date: startDate,
        start_time: startTime || null,
        end_date: null,
        dosage_form: dosageForm,
        administration_route: route || null,
        dosage_amount: amount || null,
        dosage_unit: unit || null,
        frequency_type: freq.frequency_type,
        frequency_value: freq.frequency_value || null,
        daily_frequency: freq.daily_frequency,
        specific_weekdays: [],
        is_odd_even_day: freq.is_odd_even_day || 'none',
        is_prn: isPrn,
        medication_time_slots: slots,
        meal_timing: mealTiming || null,
        notes: notes || null,
        preparation_method: preparation,
        status: 'active',
        medication_source: source || null,
        medication_source_specialty: specialty || null,
        medication_quantity: null,
        is_long_term: isLongTerm,
        inspection_rules: inspectionRules,
        created_by: MIGRATION_USER,
        last_modified_by: MIGRATION_USER,
      });
    } catch (err) {
      errors.push({ row: rowNum, reason: err.message, raw: row });
    }
  }

  console.log(`\nCSV 總列數：${rawRows.length}`);
  console.log(`範圍外跳過：${outOfRange}`);
  console.log(`配對失敗：${noPatient}`);
  console.log(`預計寫入處方：${records.length}`);
  console.log(`預計新增藥物：${createdDrugs.length}`);
  console.log(`檢測項規則：${inspectionRuleSummary.length} 筆`);
  console.log(`錯誤 / 跳過：${errors.length}`);

  if (unknownFreqs.size) {
    console.log(`\n未識別頻率（${unknownFreqs.size} 種）：`);
    for (const f of Array.from(unknownFreqs).sort()) console.log(`  - ${f}`);
  }
  if (unknownRoutes.size) {
    console.log(`\n未識別途徑（${unknownRoutes.size} 種）：`);
    for (const r of Array.from(unknownRoutes).sort()) console.log(`  - ${r}`);
  }
  if (unknownSources.size) {
    console.log(`\n未識別醫院簡稱（${unknownSources.size} 種）：`);
    for (const s of Array.from(unknownSources).sort()) console.log(`  - ${s}`);
  }

  if (DRY_RUN) {
    console.log('\n--- DRY-RUN 預覽（前 5 筆）---');
    for (const rec of records.slice(0, 5)) {
      console.log(JSON.stringify(rec, null, 2));
    }
    if (inspectionRuleSummary.length) {
      console.log('\n--- 檢測項規則預覽（前 20 筆）---');
      for (const r of inspectionRuleSummary.slice(0, 20)) {
        console.log(`  ${r.patient} | ${r.medication} | ${r.rules}`);
      }
    }
  } else {
    await saveSettings(settings);
    const inserted = await insertPrescriptions(records);
    console.log(`\n實際寫入處方：${inserted} 筆`);
  }

  const log = {
    mode: DRY_RUN ? 'dry-run' : 'production',
    csvRows: rawRows.length,
    outOfRange,
    noPatient,
    prescriptions: records.length,
    newDrugs: createdDrugs.length,
    inspectionRules: inspectionRuleSummary,
    errors,
    unknownFreqs: Array.from(unknownFreqs).sort(),
    unknownRoutes: Array.from(unknownRoutes).sort(),
    unknownSources: Array.from(unknownSources).sort(),
    createdDrugDetails: createdDrugs,
  };

  const logPath = path.resolve('scripts/import_hms_csv.log.json');
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`\n日誌已寫入：${logPath}`);
}

main().catch(err => {
  console.error('執行失敗：', err);
  process.exit(1);
});
