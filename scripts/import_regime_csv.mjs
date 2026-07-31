import { createClient } from '@supabase/supabase-js';
import { parse } from '@fast-csv/parse';
import fs from 'fs';
import path from 'path';

const CSV_PATH = process.env.CSV_PATH || 'C:/Users/Admin/Desktop/care-suite/regime - Sheet1.csv';
const C_PATIENT_CSV = process.env.C_PATIENT_CSV || 'C:/Users/Admin/Desktop/care-suite/upload/院友個人基本資料(C).csv';
const D_PATIENT_CSV = process.env.D_PATIENT_CSV || 'C:/Users/Admin/Desktop/care-suite/upload/院友個人基本資料(D).csv';
const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const MIGRATION_USER = process.env.MIGRATION_USER || 'system_migration';

// 床位範圍過濾：預設只處理 202-1 至 287-4（即樓層 202–287）
const BED_RANGE_MIN = parseInt(process.env.BED_RANGE_MIN || '202', 10);
const BED_RANGE_MAX = parseInt(process.env.BED_RANGE_MAX || '287', 10);

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
  CGAT: 'Kwong Wah Hospital', // 特例：CGAT 視為廣華醫院
};

// ── 英文醫院名 → 中文醫院名（對照 medicationSettings 預設清單）
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

// ── 服用途徑縮寫/英文 → 中文
const ROUTE_MAP = {
  PO: '口服',
  LA: '外用',
  PR: '直腸',
  SC: '皮下注射',
  IM: '肌肉注射',
  INHL: '吸入',
  SL: '舌下',
  BE: '雙耳',
  'BOTH EARS': '雙耳',
  LE: '左耳',
  'LEFT EAR': '左耳',
  OU: '雙眼',
  NA: '鼻',
  'NASAL SPRAY': '鼻',
  'MOUTH WASH': '漱口',
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
  PO: { frequency_type: 'daily', daily_frequency: 1 },
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

// ── 劑型推測
function inferDosageForm(route, unit) {
  const u = (unit || '').toString().toLowerCase();
  if (route === '口服') {
    if (['粒', '片', '膠囊', 'mg', 'g', 'mcg', 'iu'].includes(u)) return '片劑';
    if (['毫升', 'ml'].includes(u)) return '藥水';
    return '片劑';
  }
  if (['肌肉注射', '皮下注射'].includes(route)) return '注射劑';
  if (['直腸', 'PR'].includes(route)) return '栓劑';
  if (['滴眼', '滴耳', '鼻', '鼻噴霧'].includes(route)) return '滴劑';
  if (route === '吸入') return '吸入劑';
  if (route === '舌下') return '片劑';
  if (['漱口', '洗頭'].includes(route)) return '外用藥膏';
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
      // 嘗試通用轉換：數字+A/P
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

// ── 自動生成時間點（參考 PrescriptionModal 邏輯）
function getAutoTimeSlots(dailyFrequency, mealTiming) {
  if (!dailyFrequency || dailyFrequency < 1) dailyFrequency = 1;
  if (dailyFrequency === 1) {
    switch (mealTiming) {
      case '早餐前':
      case '餐前':
        return ['07:00'];
      case '午餐前':
        return ['11:00'];
      case '早上':
      case '早餐時':
        return ['08:00'];
      case '午餐時':
      case '中午':
        return ['12:00'];
      case '晚餐時':
        return ['16:00'];
      case '晚上':
      case '睡前':
        return ['20:00'];
      case '晚餐後':
        return ['19:00'];
      default:
        return ['08:00'];
    }
  }
  if (dailyFrequency === 2) {
    const first = ['早餐前', '餐前'].includes(mealTiming) ? '07:00' : '08:00';
    return [first, '16:00'];
  }
  if (dailyFrequency === 3) {
    const first = ['早餐前', '餐前'].includes(mealTiming) ? '07:00' : '08:00';
    return [first, '12:00', '16:00'];
  }
  if (dailyFrequency === 4) {
    const first = ['早餐前', '餐前'].includes(mealTiming) ? '07:00' : '08:00';
    return [first, '12:00', '16:00', '20:00'];
  }
  if (dailyFrequency === 5) return ['08:00', '12:00', '16:00', '20:00', '00:00'];
  if (dailyFrequency === 6) return ['08:00', '12:00', '16:00', '20:00', '00:00', '04:00'];
  if (dailyFrequency === 7) return ['08:00', '11:00', '14:00', '17:00', '20:00', '23:00', '02:00'];
  if (dailyFrequency === 8) return ['08:00', '11:00', '14:00', '17:00', '20:00', '23:00', '02:00', '05:00'];
  const targetCount = Math.max(1, dailyFrequency);
  const interval = 24 / targetCount;
  const times = [];
  for (let i = 0; i < targetCount; i++) {
    const hour = Math.floor(8 + i * interval) % 24;
    times.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return times.sort();
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

// ── 解析頻率（支援逗號分隔組合，例如 OM, Noon）
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

  // 合併多個 token：每日次數相加，時間點合併，頻率類型以第一個為主
  const first = results[0];
  let dailyFreq = 0;
  let mealTimings = [];
  let slots = [];
  let freqType = first.frequency_type;
  let freqValue = first.frequency_value || null;
  let oddEven = first.is_odd_even_day || 'none';

  for (const r of results) {
    dailyFreq += r.daily_frequency || 1;
    if (r.meal_timing) mealTimings.push(r.meal_timing);
    // 根據 meal_timing 產生單一時間點，用於組合
    const singleSlots = getAutoTimeSlots(1, r.meal_timing || '');
    if (singleSlots.length) slots.push(...singleSlots);
    if (r.frequency_type && r.frequency_type !== 'daily') {
      freqType = r.frequency_type;
      if (r.frequency_value) freqValue = r.frequency_value;
      if (r.is_odd_even_day) oddEven = r.is_odd_even_day;
    }
  }

  const combined = {
    frequency_type: freqType,
    daily_frequency: dailyFreq || 1,
    frequency_value: freqValue,
    is_odd_even_day: oddEven,
    meal_timing: mealTimings[0] || '',
    _unknown: first._unknown,
  };
  // 預先產生的組合時間點（最終仍會以 CSV 的「服用時間點」為優先）
  combined._autoSlots = [...new Set(slots)].sort();
  return combined;
}

// ── 在 medication_settings 各機構群組中尋找已有中文機構名稱
function findChineseInstitution(token, settings) {
  if (!token) return null;
  const groups = ['機構_醫管局醫院', '機構_醫管局門診', '機構_醫管局精神科', '機構_衛生署', '機構_其他'];
  // 完全吻合
  for (const g of groups) {
    if (settings[g].includes(token)) return token;
  }
  // 互相包含（優先較長者）
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

// ── 解析藥物來源與專科
function parseSource(raw, settings, unknownSources) {
  const original = normalizeSpaces(raw);
  if (!original) return { source: '', specialty: '' };

  let parts = original.split('/').map(s => s.trim()).filter(Boolean);
  let hospitalToken = parts[0] || '';
  let specialtyToken = parts[1] || '';

  // CGAT 特例：無論出現在哪都視為廣華醫院
  if (hospitalToken.toUpperCase() === 'CGAT') {
    hospitalToken = 'KWH';
  }
  if (specialtyToken.toUpperCase() === 'CGAT') {
    specialtyToken = 'CGAT';
  }

  // 若沒有 "/"，嘗試以空格分隔：第一個詞若為已知醫院簡稱，其後視為專科/門診
  // 例：KWH GOPD、KWH POD、QEH OPH
  if (parts.length === 1) {
    const words = hospitalToken.split(/\s+/).filter(Boolean);
    if (words.length > 1 && (HOSPITAL_ABBREV_EN[words[0].toUpperCase()] || findChineseInstitution(words[0], settings))) {
      hospitalToken = words[0];
      specialtyToken = words.slice(1).join(' ');
    }
  }

  // 醫院：先找中文，再找英文簡稱，再處理 "簡稱 - 中文" 格式
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

  // 把來源歸類到機構群組（若尚未存在）
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

  // 專科
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
    };
    if (specMap[specialtyToken.toUpperCase()]) {
      specialty = specMap[specialtyToken.toUpperCase()];
    } else if (settings.專科.includes(specialtyToken)) {
      specialty = specialtyToken;
    } else {
      specialty = specialtyToken;
    }
    if (!settings.專科.includes(specialty)) settings.專科.push(specialty);
  }

  return { source, specialty };
}

// ── 解析服用途徑
function parseRoute(raw, settings, unknownRoutes) {
  const original = stripQuotes(normalizeSpaces(raw));
  if (!original) return '';
  const key = original.toUpperCase();
  if (ROUTE_MAP[key]) return ROUTE_MAP[key];

  // 看起來像來源/含有斜線/過長的值，不加入設定
  if (original.includes('/') || HOSPITAL_ABBREV_EN[key] || key.startsWith('KCH ') || key.length > 20) {
    unknownRoutes.add(original);
    return original;
  }

  // 視為新的中文途徑，加入設定
  if (!settings.服用途徑.includes(original)) {
    settings.服用途徑.push(original);
  }
  return original;
}

// ── 解析劑量/單位
function parseDosage(raw) {
  const original = normalizeSpaces(raw);
  if (!original) return { amount: '', unit: '' };
  const m = original.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { amount: '', unit: normalizeUnit(original) };
  return { amount: m[1], unit: normalizeUnit(m[2]) };
}

// ── 藥物名稱正規化（用於比對，避免大小寫、劑型字眼導致重複）
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
  // 去掉括號內容（通常是包裝資訊）
  s = s.replace(/\(.*?\)/g, ' ');
  // 將標點與劑型分隔符號換成空格
  s = s.replace(/[\/,\-–—.+&]/g, ' ');
  // 去掉雜訊字
  const tokens = s.split(/\s+/).filter(Boolean).map(t => t.trim()).filter(t => !DRUG_NAME_NOISE.has(t) && !/^(as|fc|er|sr|cr)$/i.test(t));
  // 對 strength 單位做標準化：microgram -> mcg
  const normalized = tokens.map(t => {
    if (/^\d+(\.\d+)?microgram(s)?$/.test(t)) return t.replace(/micrograms?/,'mcg');
    return t;
  });
  return normalized.sort().join(' ');
}

// ── 床位範圍檢查（支援 C202-1 / D202-1 / 202-1 等格式，取第一組數字）
function parseBedFloor(bed) {
  const m = (bed || '').toString().match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function isInBedRange(bed) {
  const floor = parseBedFloor(bed);
  return floor !== null && floor >= BED_RANGE_MIN && floor <= BED_RANGE_MAX;
}

// ── 院友姓名異體字對照
function applyPatientAlias(name) {
  return PATIENT_NAME_ALIASES[name] || name;
}

function normalizeBed(bed) {
  return (bed || '').toString().trim().toUpperCase();
}

// ── 解析院友
// CSV 的床號通常不含大廈前綴（如 202-1），資料庫則可能為 C202-1 / D202-1 等。
// 只配對：在住 + 姓名吻合 + 床號（去掉前綴後）完全吻合。
// 不再使用「同名唯一」或「床號互相包含」fallback，避免錯配到舊退住院友。
function findPatient(rawBed, rawName, patients) {
  const bed = normalizeBed(rawBed);
  const name = applyPatientAlias(normalizeSpaces(rawName));
  if (!name || !bed) return null;

  // 只考慮在住院友
  const residentPatients = patients.filter(p => p.在住狀態 === '在住');

  // 1. CSV 床號已含字母前綴：必須完整床號+姓名吻合
  if (/^[A-Z]/.test(bed)) {
    const exact = residentPatients.find(p => {
      const pName = normalizeSpaces(p.中文姓名);
      const pBed = normalizeBed(p.床號);
      return pName === name && pBed === bed;
    });
    return exact ? exact.院友id : null;
  }

  // 2. CSV 床號不含前綴：把 DB 床號前綴去掉後再比對
  const prefixMatch = residentPatients.find(p => {
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

async function loadPatients() {
  const { data, error } = await supabase.from('院友主表').select('院友id,床號,中文姓名,在住狀態');
  if (error) throw new Error(`讀取院友失敗：${error.message}`);
  return data || [];
}

function prefixBed(bed, area) {
  const b = normalizeBed(bed);
  if (!b || /^[A-Z]/.test(b)) return b;
  return `${area}${b}`;
}

async function loadLatestPatientBeds() {
  const rows = [];
  for (const [area, filePath] of [['C', C_PATIENT_CSV], ['D', D_PATIENT_CSV]]) {
    if (!fs.existsSync(filePath)) {
      console.warn(`找不到最新院友資料：${filePath}`);
      continue;
    }
    const areaRows = await parseCsv(filePath);
    for (const r of areaRows) {
      r._area = area;
      r._prefixedBed = prefixBed(r['床位號'], area);
      rows.push(r);
    }
  }

  const map = new Map();
  const duplicates = [];
  for (const r of rows) {
    const name = applyPatientAlias(normalizeSpaces(r['中文姓名']));
    const bed = r._prefixedBed;
    if (!name || !bed) continue;
    if (map.has(name) && map.get(name) !== bed) {
      duplicates.push({ name, existing: map.get(name), newBed: bed });
    }
    map.set(name, bed);
  }
  if (duplicates.length) {
    console.warn(`姓名重複出現於不同床位（取最後一筆）：`);
    for (const d of duplicates) console.warn(`  ${d.name}: ${d.existing} vs ${d.newBed}`);
  }
  return { map, rows };
}

async function syncPatientBeds(latestRows) {
  const patients = await loadPatients();
  const updates = [];
  for (const r of latestRows) {
    const name = applyPatientAlias(normalizeSpaces(r['中文姓名']));
    const bed = r._prefixedBed;
    if (!name || !bed) continue;
    const patient = patients.find(
      p => p.在住狀態 === '在住' && normalizeSpaces(p.中文姓名) === name
    );
    if (patient && normalizeBed(patient.床號) !== bed) {
      updates.push({ id: patient.院友id, name, oldBed: patient.床號, newBed: bed });
    }
  }

  if (DRY_RUN) {
    console.log(`DRY-RUN：預計更新 ${updates.length} 位院友床位`);
    return updates;
  }

  for (const u of updates) {
    const { error } = await supabase.from('院友主表').update({ 床號: u.newBed }).eq('院友id', u.id);
    if (error) throw new Error(`更新院友 ${u.name}(${u.id}) 床位失敗：${error.message}`);
  }
  if (updates.length) console.log(`已同步 ${updates.length} 位院友床位與最新 C/D 區資料一致`);
  return updates;
}

async function deleteMigrationPrescriptions() {
  const { data, error } = await supabase
    .from('new_medication_prescriptions')
    .delete()
    .eq('created_by', MIGRATION_USER)
    .select('id');
  if (error) throw new Error(`刪除舊 migration 處方失敗：${error.message}`);
  return data?.length || 0;
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
  if (DRY_RUN) return { id: `dry-run-${Math.random().toString(36).slice(2)}` };
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
    服用途徑: ['口服', '肌肉注射', '皮下注射', '外用', '滴眼', '滴耳', '鼻胃管', '吸入'],
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

function parseDateTime(raw) {
  const original = normalizeSpaces(raw);
  if (!original) return { date: '', time: '' };
  const [datePart, timePart] = original.split(' ');
  const date = datePart || '';
  let time = '';
  if (timePart) {
    const [h, m] = timePart.split(':');
    const hh = String(parseInt(h || '0', 10)).padStart(2, '0');
    const mm = String(parseInt(m || '0', 10)).padStart(2, '0');
    time = `${hh}:${mm}`;
  }
  return { date, time };
}

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

async function insertPrescriptions(records) {
  if (!records.length) return { count: 0 };
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { data, error } = await supabase.from('new_medication_prescriptions').insert(batch).select('id');
    if (error) throw new Error(`批次插入處方失敗（第 ${i + 1} 筆起）：${error.message}`);
    inserted += data.length;
  }
  return { count: inserted };
}

async function main() {
  console.log(`模式：${DRY_RUN ? 'DRY-RUN（不寫入資料庫）' : '正式執行'}`);
  console.log(`讀取 CSV：${CSV_PATH}`);
  console.log(`最新 C 區院友資料：${C_PATIENT_CSV}`);
  console.log(`最新 D 區院友資料：${D_PATIENT_CSV}`);

  const [rawRows, patients, drugsBase, settings, latestPatientData] = await Promise.all([
    parseCsv(CSV_PATH),
    loadPatients(),
    loadDrugs(),
    loadSettings(),
    loadLatestPatientBeds(),
  ]);

  console.log(`CSV 列數：${rawRows.length}，院友數：${patients.length}，現有藥物數：${drugsBase.rows.length}`);
  console.log(`最新 C/D 院友資料筆數：${latestPatientData.rows.length}，姓名→床位映射：${latestPatientData.map.size} 筆`);

  // 同步院友主表床位與最新 C/D 區資料一致
  const bedUpdates = await syncPatientBeds(latestPatientData.rows);
  // DRY-RUN 時不寫入 DB，但仍把更新反映到記憶體中的院友列表，確保配對預覽準確
  let refreshedPatients = patients;
  if (bedUpdates.length > 0) {
    if (DRY_RUN) {
      refreshedPatients = patients.map(p => {
        const u = bedUpdates.find(up => up.id === p.院友id);
        return u ? { ...p, 床號: u.newBed } : p;
      });
    } else {
      refreshedPatients = await loadPatients();
    }
  }

  const latestBedMap = latestPatientData.map;

  const records = [];
  const errors = [];
  const unknownFreqs = new Set();
  const unknownRoutes = new Set();
  const unknownSources = new Set();
  const createdDrugs = [];
  const newDrugKeys = new Map(); // normalized key -> temporary id
  let outOfRange = 0;
  let notInLatestCsv = 0;

  let rowNum = 1;
  for (const row of rawRows) {
    rowNum += 1;
    try {
      const rowName = applyPatientAlias(normalizeSpaces(row['院友姓名']));
      const correctedBed = latestBedMap.get(rowName);

      // 以最新 C/D 區院友資料為準；找不到代表已離院或不在 C/D 區
      if (!correctedBed) {
        notInLatestCsv += 1;
        errors.push({
          row: rowNum,
          reason: '最新C/D院友資料找不到此人（可能已離院或不在C/D區）',
          bed: row['床號'],
          name: row['院友姓名'],
        });
        continue;
      }

      if (!isInBedRange(correctedBed)) {
        outOfRange += 1;
        errors.push({
          row: rowNum,
          reason: '修正後床位不在 202-287 範圍內',
          originalBed: row['床號'],
          correctedBed,
          name: row['院友姓名'],
        });
        continue;
      }

      const patientId = findPatient(correctedBed, row['院友姓名'], refreshedPatients);
      if (!patientId) {
        errors.push({
          row: rowNum,
          reason: '床位/姓名配對失敗（已按最新資料修正床位）',
          originalBed: row['床號'],
          correctedBed,
          name: row['院友姓名'],
        });
        continue;
      }

      // 藥物
      const medicationName = normalizeSpaces(row['藥物名稱']);
      if (!medicationName) {
        errors.push({ row: rowNum, reason: '藥物名稱空白' });
        continue;
      }
      const drugKey = normalizeDrugName(medicationName);
      let drugId = findDrugId(medicationName, drugsBase) || newDrugKeys.get(drugKey);
      if (!drugId) {
        const { amount, unit } = parseDosage(row['劑量/單位']);
        const route = parseRoute(row['服用途徑'], settings, unknownRoutes);
        const newDrug = {
          drug_name: medicationName,
          drug_code: null,
          drug_type: '',
          administration_route: route,
          unit: unit || '',
          notes: '由舊系統 CSV 匯入自動建立',
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

      // 來源 / 專科 / 途徑 / 頻率 / 劑量
      const { source, specialty } = parseSource(row['藥物來源'], settings, unknownSources);
      const route = parseRoute(row['服用途徑'], settings, unknownRoutes);
      const freq = parseFrequency(row['頻率'], unknownFreqs);
      const { amount, unit } = parseDosage(row['劑量/單位']);
      const dosageForm = inferDosageForm(route, unit);

      // 時間點：先讀 CSV，若無則用頻率對照產生的預設時間；PRN 可留白
      let slots = parseTimeSlots(row['服用時間點']);
      const isPrn = /\bPRN\b/i.test(row['PRN/remark'] || '');
      if (slots.length === 0 && freq._autoSlots && freq._autoSlots.length) {
        slots = freq._autoSlots;
      }
      if (!isPrn && slots.length === 0 && freq.daily_frequency) {
        slots = getAutoTimeSlots(freq.daily_frequency, freq.meal_timing || '');
      }

      // 備藥方式
      let preparation = 'immediate';
      const oralUnits = ['粒', '片', '膠囊'];
      const isOralTablet = route === '口服' && oralUnits.includes(unit);
      if (isOralTablet && !(isPrn && slots.length === 0)) {
        preparation = 'advanced';
      }
      // TNG / 舌下底丸 特例
      if (/\bTNG\b/i.test(medicationName) || route === '舌下') {
        preparation = 'immediate';
      }

      // 日期
      const { date: startDate, time: startTime } = parseDateTime(row['開始日期和時間']);
      const prescriptionDate = row['處方日期'] || startDate;

      // notes：非 PRN 的 remark 文字 + 未知頻率註記
      const remarkRaw = (row['PRN/remark'] || '').toString().trim();
      const notesParts = [];
      if (remarkRaw && !/^\s*PRN\s*$/i.test(remarkRaw)) {
        const nonPrn = remarkRaw.replace(/\bPRN\b/gi, '').trim();
        if (nonPrn) notesParts.push(nonPrn);
      }
      if (freq._unknown) notesParts.push(`原頻率：${freq._unknown}`);

      // 確保每日次數選項存在
      if (freq.daily_frequency && !settings.每日次數.includes(freq.daily_frequency)) {
        settings.每日次數.push(freq.daily_frequency);
        settings.每日次數.sort((a, b) => a - b);
      }
      // 確保服用時段存在（時間點會以 HH:MM 存，不用加時段，但 meal_timing 要用）
      if (freq.meal_timing && !settings.服用時段.includes(freq.meal_timing)) {
        settings.服用時段.push(freq.meal_timing);
      }

      const record = {
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
        specific_weekdays: [],
        is_odd_even_day: freq.is_odd_even_day || 'none',
        is_prn: isPrn,
        medication_time_slots: slots,
        meal_timing: freq.meal_timing || null,
        notes: notesParts.join('；') || null,
        preparation_method: preparation,
        status: 'active',
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

  console.log(`\n床位範圍：${BED_RANGE_MIN}-${BED_RANGE_MAX} 樓`);
  console.log(`最新院友資料找不到（離院 / 非C/D區）：${notInLatestCsv}`);
  console.log(`修正後床位在範圍外跳過：${outOfRange}`);
  console.log(`預計寫入處方筆數：${records.length}`);
  console.log(`預計新增藥物：${createdDrugs.length}`);
  console.log(`錯誤 / 跳過：${errors.length}`);

  if (unknownFreqs.size) {
    console.log(`\n未識別頻率（${unknownFreqs.size} 種）：`);
    for (const f of Array.from(unknownFreqs).sort()) console.log(`  - ${f}`);
  }
  if (unknownRoutes.size) {
    console.log(`\n未識別途徑（當作來源或保留原文，${unknownRoutes.size} 種）：`);
    for (const r of Array.from(unknownRoutes).sort()) console.log(`  - ${r}`);
  }
  if (unknownSources.size) {
    console.log(`\n未識別醫院簡稱（加入「其他」，${unknownSources.size} 種）：`);
    for (const s of Array.from(unknownSources).sort()) console.log(`  - ${s}`);
  }

  if (DRY_RUN) {
    console.log('\n--- DRY-RUN 預覽（前 5 筆）---');
    for (const rec of records.slice(0, 5)) {
      console.log(JSON.stringify(rec, null, 2));
    }
    console.log('\n--- 設定變更預覽 ---');
    const changedKeys = Object.keys(settings).filter(k => {
      const loaded = settings[k];
      // 與預設比較簡化：只印長度變化
      return Array.isArray(loaded) && loaded.length > 0;
    });
    for (const k of changedKeys) {
      console.log(`${k}: ${settings[k].length} 項`);
    }
  } else {
    await saveSettings(settings);
    if (records.length > 0) {
      const deletedCount = await deleteMigrationPrescriptions();
      console.log(`已刪除舊 migration 處方：${deletedCount} 筆`);
    }
    const { count } = await insertPrescriptions(records);
    console.log(`\n實際寫入處方：${count} 筆`);
  }

  const log = {
    mode: DRY_RUN ? 'dry-run' : 'production',
    bedRange: `${BED_RANGE_MIN}-${BED_RANGE_MAX}`,
    csvRows: rawRows.length,
    notInLatestCsv,
    outOfRange,
    prescriptions: records.length,
    newDrugs: createdDrugs.length,
    bedUpdates,
    errors,
    unknownFreqs: Array.from(unknownFreqs).sort(),
    unknownRoutes: Array.from(unknownRoutes).sort(),
    unknownSources: Array.from(unknownSources).sort(),
    settingsSummary: Object.fromEntries(
      Object.keys(settings).map(k => [k, settings[k].length])
    ),
    createdDrugDetails: createdDrugs,
  };

  const logPath = path.resolve('scripts/import_regime_csv.log.json');
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`\n日誌已寫入：${logPath}`);
}

main().catch((err) => {
  console.error('執行失敗：', err);
  process.exit(1);
});
