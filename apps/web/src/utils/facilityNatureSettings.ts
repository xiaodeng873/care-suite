import { supabase } from '../lib/supabase';

// =====================================================
// 院舍性質類型定義
// =====================================================

/** 三個院舍性質：安老院（=私位）、甲二買位、甲一買位 */
export type FacilityNature = '安老院' | '甲二買位' | '甲一買位';

export const FACILITY_NATURES: FacilityNature[] = ['安老院', '甲二買位', '甲一買位'];

/** 參與法定人手計算的性質 */
export const STAFFING_NATURES: FacilityNature[] = ['安老院', '甲二買位', '甲一買位'];

/** 非私位的性質（用於從私位分母中扣除） */
export const NON_PRIVATE_NATURES: FacilityNature[] = ['甲二買位', '甲一買位'];

/** 觸發甲一買位合約工時的性質 */
export const A1_CONTRACT_NATURES: FacilityNature[] = ['甲一買位'];

/** 有買位合約工時的性質（甲一/甲二，視乎床位設定，兩者互斥） */
export type ContractNature = '甲一買位' | '甲二買位';
export const CONTRACT_NATURES: ContractNature[] = ['甲一買位', '甲二買位'];

/** 24 小時最低人手表格的職位欄（順序固定）；「任何員工」對應表1第5項（18:00–翌日07:00 須有 2 名員工當值） */
export const GRID_POSITIONS = ['主管', '註冊/登記護士', '保健員', '護理員', '助理員', '物理治療師', '任何員工'] as const;
export type GridPosition = (typeof GRID_POSITIONS)[number];

/**
 * 法定最低比例（高度照顧院舍共通底線，《安老院規例》附表1，寫死不可手調）：
 * - 護士及保健員：指明期間內 13 小時，每 30 名住客 1 名保健員；1 名護士（在場及當值）視同 2 名保健員（→ 護士 1:60）
 * - 護理員：指明期間內 10 小時 1:20；其餘任何時間 1:40
 * - 助理員：指明期間內 11 小時 1:40
 * 所有人手換算向上取整（ceil），帶小數必須進位。
 */
export const STATUTORY_RATIOS = {
  careWorkerDay: 20,
  careWorkerNight: 40,
  assistant: 40,
  healthWorker: 30,
  /** 1 名護士視同 2 名保健員 */
  nurse: 60,
} as const;

/** 表1第5項：每日 18:00 至翌日 07:00 須有 2 名員工當值（可以是為遵守其他項目而聘用的人） */
export const NIGHT_ANY_STAFF = { start: '18:00', end: '07:00', count: 2 } as const;

/** 甲一買位每 40 宿位合約工時基準（法定預設值，可在「買位合約工時」頁修改，RN+EN 合計） */
export const A1_CONTRACT_WEEKLY_HOURS_PER_40_BEDS = {
  主管: 48,
  護士: 96,
  保健員: 96,
  護理員: 384,
  助理員: 192,
} as const;

/** 參與買位合約工時的職位（順序固定） */
export const A1_CONTRACT_POSITIONS = ['主管', '護士', '保健員', '護理員', '助理員'] as const;

/** 買位合約工時每 40 宿位每週基準預設值。
 * 甲二級（EA2）40 買位宿位：主管 48、保健員 192、護理員 384、助理員 288（每週總計 912 小時）；
 * 無護士要求；物理/職業治療師按服務時數，不列入。 */
export const DEFAULT_CONTRACT_WEEKLY_HOURS_PER_40_BEDS: Record<ContractNature, Record<string, number>> = {
  甲一買位: { ...A1_CONTRACT_WEEKLY_HOURS_PER_40_BEDS },
  甲二買位: { 主管: 48, 護士: 0, 保健員: 192, 護理員: 384, 助理員: 288 },
};

/** 買位合約工時用戶設定：性質 → 職位 → 每週合約總工時（絕對值；缺省時按每 40 宿位基準換算） */
export type ContractWeeklyHours = Record<string, number>;
export type ContractHoursConfig = Partial<Record<ContractNature, ContractWeeklyHours>>;

/** 每人每日最低工時硬約束（小時） */
export const MIN_DAILY_HOURS_PER_PERSON = 8;

/** 工時計算最小單位（小時） */
export const WORK_HOUR_STEP = 0.5;

/** 病護比例頁各性質適用職位（保健員所有性質都有，但只有 13 小時連續當值要求，無比例輸入；安老院／甲二無護士要求；
 *  買位合約的各職位比例與總工時已在合約列明、與排班無關，不在此輸入；甲一買位保留「註冊/登記護士」；
 *  助理員有指明期間 11 小時的當值比例，所有性質適用） */
export const NATURE_RATIO_POSITIONS: Record<FacilityNature, string[]> = {
  安老院: ['主管', '保健員', '護理員', '助理員'],
  甲二買位: ['主管', '保健員', '護理員', '助理員'],
  甲一買位: ['主管', '註冊/登記護士', '保健員', '護理員', '助理員'],
};

// =====================================================
// 資料結構（對應 facility_settings 三個 jsonb 欄位）
// =====================================================

/** nature_bed_counts：各性質床位數 */
export type NatureBedCounts = Record<FacilityNature, number>;

export const DEFAULT_BED_COUNTS: NatureBedCounts = {
  安老院: 0,
  甲二買位: 0,
  甲一買位: 0,
};

/** 10 小時／14 小時分段比例（舊儲存格式；法定比例現已寫死，僅作還原相容用） */
export interface SplitRatio {
  /** 要求1時段（07:00–22:00 內合共 10 小時）的 1:N */
  day: number | null;
  /** 其餘 14 小時的 1:N */
  night: number | null;
}

/** 病護比例：職位 → 單一 1:N 或 10h/14h 分段比例（null = 無要求）。法定共通比例已寫死（STATUTORY_RATIOS），此處僅保留舊資料還原 */
export type PositionRatioMap = Record<string, number | SplitRatio | null>;

/** nature_requirements：每性質一組 { ratios } */
export interface NatureRequirementsEntry {
  ratios: PositionRatioMap;
}

export type NatureRequirements = Partial<Record<FacilityNature, NatureRequirementsEntry>>;

export interface TimeSegment {
  start: string; // "HH:MM"
  end: string;
}

/** specific_hours_config：全院共用的時段定義（三個特定鐘點；比例已按附表1寫死，見 STATUTORY_RATIOS） */
export interface SpecificHoursConfig {
  /** 護理員指明期間：時段總和必須剛好 10 小時，在 07:00–22:00 內，可分割；其餘 14 小時為另一段 */
  requirement1: { segments: TimeSegment[] };
  /** 護士／保健員指明期間：最低連續 13 小時，不可分割 */
  requirement3: TimeSegment;
  /** 助理員指明期間：連續 11 小時，不可分割（院舍向社署申報的日間核心時段，預設 07:00–18:00） */
  assistantWindow: TimeSegment;
}

export const DEFAULT_SPECIFIC_HOURS_CONFIG: SpecificHoursConfig = {
  requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
  requirement3: { start: '07:00', end: '20:00' },
  assistantWindow: { start: '07:00', end: '18:00' },
};

export interface FacilityNatureSettings {
  bedCounts: NatureBedCounts;
  requirements: NatureRequirements;
  specific: SpecificHoursConfig;
  /** 買位合約工時用戶設定（每週總工時絕對值）；空物件 = 全部用基準換算 */
  contractHours: ContractHoursConfig;
}

// =====================================================
// jsonb 還原（防呆：缺欄位／型別不對時回落預設）
// =====================================================

function toPositiveIntOrNull(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** 正數（保留至多兩位小數；助理員比例 1:9.09、1:12.5 需要小數） */
function toPositiveNumberOrNull(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function toNonNegativeInt(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function isTimeString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

/** 非負數（買位工時可為 0，例如甲二無護士要求），取整至 0.5 小時 */
function toNonNegativeHalfHour(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n * 2) / 2 : null;
}

function sanitizeContractHours(raw: unknown): ContractHoursConfig {
  const result: ContractHoursConfig = {};
  if (!raw || typeof raw !== 'object') return result;
  const obj = raw as Record<string, unknown>;
  for (const nature of CONTRACT_NATURES) {
    const entry = obj[nature];
    if (!entry || typeof entry !== 'object') continue;
    const hours: ContractWeeklyHours = {};
    for (const [pos, v] of Object.entries(entry as Record<string, unknown>)) {
      const n = toNonNegativeHalfHour(v);
      if (n != null) hours[pos] = n;
    }
    result[nature] = hours;
  }
  return result;
}

function sanitizeBedCounts(raw: unknown): NatureBedCounts {
  const result = { ...DEFAULT_BED_COUNTS };
  if (raw && typeof raw === 'object') {
    for (const nature of FACILITY_NATURES) {
      result[nature] = toNonNegativeInt((raw as Record<string, unknown>)[nature]);
    }
  }
  return result;
}

function sanitizeRequirements(raw: unknown): NatureRequirements {
  const result: NatureRequirements = {};
  if (!raw || typeof raw !== 'object') return result;
  const obj = raw as Record<string, unknown>;
  for (const nature of FACILITY_NATURES) {
    const entry = obj[nature];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const ratios: PositionRatioMap = {};
    if (e.ratios && typeof e.ratios === 'object') {
      for (const [pos, n] of Object.entries(e.ratios as Record<string, unknown>)) {
        // 分段比例 { day, night }（10h/14h）；否則為單一 1:N
        // （舊格式的定額 {per,count}、合約欄 contractPer/contractCount 及 hours 已廢除，不再讀取）
        if (n && typeof n === 'object') {
          const o = n as Record<string, unknown>;
          if ('per' in o || 'count' in o) continue;
          ratios[pos] = { day: toPositiveIntOrNull(o.day), night: toPositiveIntOrNull(o.night) };
        } else {
          ratios[pos] = toPositiveNumberOrNull(n);
        }
      }
    }
    result[nature] = { ratios };
  }
  return result;
}

function sanitizeSpecific(raw: unknown): SpecificHoursConfig {
  const fallback = DEFAULT_SPECIFIC_HOURS_CONFIG;
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;

  const r1 = obj.requirement1 as Record<string, unknown> | undefined;
  let segments = fallback.requirement1.segments;
  if (r1 && Array.isArray(r1.segments)) {
    const parsed = (r1.segments as unknown[])
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => ({ start: s.start, end: s.end }))
      .filter((s): s is TimeSegment => isTimeString(s.start) && isTimeString(s.end));
    if (parsed.length > 0) segments = parsed;
  }

  const r3 = obj.requirement3 as Record<string, unknown> | undefined;
  let requirement3: TimeSegment =
    r3 && isTimeString(r3.start) && isTimeString(r3.end)
      ? { start: r3.start, end: r3.end }
      : fallback.requirement3;
  // 舊預設時段 07:00–18:00 是 11 小時，法例要求為 13 小時：自動改用新預設 07:00–20:00（自訂時段保留）
  if (requirement3.start === '07:00' && requirement3.end === '18:00') {
    requirement3 = { ...requirement3, end: '20:00' };
  }

  const aw = obj.assistantWindow as Record<string, unknown> | undefined;
  const assistantWindow: TimeSegment =
    aw && isTimeString(aw.start) && isTimeString(aw.end)
      ? { start: aw.start, end: aw.end }
      : fallback.assistantWindow;

  // 舊格式的 requirement1.ratio / requirement2.ratio（全院護理員比例）已併入各性質的分段比例，不再讀取
  return { requirement1: { segments }, requirement3, assistantWindow };
}

// =====================================================
// 讀寫 facility_settings（單列 id = 1）
// =====================================================

/**
 * 讀取院舍性質設定。讀取失敗或欄位缺失時回落預設值
 * （床位數全 0、requirements 空、specific 用預設）。
 */
export async function loadFacilityNatureSettings(): Promise<FacilityNatureSettings> {
  const { data, error } = await supabase
    .from('facility_settings')
    .select('nature_bed_counts, nature_requirements, specific_hours_config, contract_hours_config')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.warn('讀取院舍性質設定失敗，使用預設值:', error.message);
  }

  return {
    bedCounts: sanitizeBedCounts(data?.nature_bed_counts),
    requirements: sanitizeRequirements(data?.nature_requirements),
    specific: sanitizeSpecific(data?.specific_hours_config),
    contractHours: sanitizeContractHours(data?.contract_hours_config),
  };
}

/** 儲存院舍性質設定（四欄一併更新）。床位總和等驗證在元件層完成。 */
export async function saveFacilityNatureSettings(settings: FacilityNatureSettings): Promise<void> {
  const { error } = await supabase
    .from('facility_settings')
    .update({
      nature_bed_counts: settings.bedCounts,
      nature_requirements: settings.requirements,
      specific_hours_config: settings.specific,
      contract_hours_config: settings.contractHours,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) {
    throw new Error(`儲存院舍性質設定失敗：${error.message}`);
  }
}
