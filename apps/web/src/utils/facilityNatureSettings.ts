import { supabase } from '../lib/supabase';

// =====================================================
// 院舍性質類型定義
// =====================================================

/** 四個院舍性質：安老院（=私位）、甲二買位、甲一買位、院舍卷計劃 */
export type FacilityNature = '安老院' | '甲二買位' | '甲一買位' | '院舍卷計劃';

export const FACILITY_NATURES: FacilityNature[] = ['安老院', '甲二買位', '甲一買位', '院舍卷計劃'];

/** 買位／計劃類（有宿位數作分母，且觸發要求3用註冊護士） */
export const CONTRACT_NATURES: FacilityNature[] = ['甲二買位', '甲一買位', '院舍卷計劃'];

/** 24 小時最低人手表格的七個職位欄（順序固定） */
export const GRID_POSITIONS = ['主管', '註冊護士', '登記護士', '保健員', '護理員', '助理員', '物理治療師'] as const;
export type GridPosition = (typeof GRID_POSITIONS)[number];

/** 病護比例頁各性質適用職位（甲一買位／院舍卷計劃另有物理治療師） */
export const NATURE_RATIO_POSITIONS: Record<FacilityNature, string[]> = {
  安老院: ['主管', '保健員', '護理員', '助理員'],
  甲二買位: ['主管', '註冊護士', '登記護士', '護理員', '助理員'],
  甲一買位: ['主管', '註冊護士', '登記護士', '護理員', '助理員', '物理治療師'],
  院舍卷計劃: ['主管', '註冊護士', '登記護士', '護理員', '助理員', '物理治療師'],
};

/** 工時頁各性質適用職位（甲一買位／院舍卷計劃另有物理治療師，每周計；甲二買位無此要求） */
export const NATURE_HOURS_POSITIONS: Record<FacilityNature, string[]> = {
  安老院: ['主管', '保健員', '護理員', '助理員'],
  甲二買位: ['主管', '註冊護士', '登記護士', '護理員', '助理員'],
  甲一買位: ['主管', '註冊護士', '登記護士', '護理員', '助理員', '物理治療師'],
  院舍卷計劃: ['主管', '註冊護士', '登記護士', '護理員', '助理員', '物理治療師'],
};

export const PHYSIOTHERAPIST = '物理治療師';

// =====================================================
// 資料結構（對應 facility_settings 三個 jsonb 欄位）
// =====================================================

/** nature_bed_counts：各性質床位數 */
export type NatureBedCounts = Record<FacilityNature, number>;

export const DEFAULT_BED_COUNTS: NatureBedCounts = {
  安老院: 0,
  甲二買位: 0,
  甲一買位: 0,
  院舍卷計劃: 0,
};

/** 病護比例：職位 → 1:N 的 N（null = 無要求） */
export type PositionRatioMap = Record<string, number | null>;

/** 工時頁：職位 → 每天最低總工時（小時，null = 無要求；物理治療師為每周最低總工時） */
export type PositionHoursMap = Record<string, number | null>;

/** nature_requirements：每性質一組 { ratios, hours } */
export interface NatureRequirementsEntry {
  ratios: PositionRatioMap;
  hours: PositionHoursMap;
}

export type NatureRequirements = Partial<Record<FacilityNature, NatureRequirementsEntry>>;

export interface TimeSegment {
  start: string; // "HH:MM"
  end: string;
}

/** specific_hours_config：全院共用特定鐘點 */
export interface SpecificHoursConfig {
  /** 要求1：指定時段內護理員對住客 1:ratio（時段總和必須剛好 10 小時） */
  requirement1: { segments: TimeSegment[]; ratio: number };
  /** 要求2：其餘 14 小時護理員對住客 1:ratio */
  requirement2: { ratio: number };
  /** 要求3：每天有護士／保健員當值最低連續 11 小時，不可分割 */
  requirement3: TimeSegment;
}

export const DEFAULT_SPECIFIC_HOURS_CONFIG: SpecificHoursConfig = {
  requirement1: { segments: [{ start: '07:00', end: '17:00' }], ratio: 20 },
  requirement2: { ratio: 40 },
  requirement3: { start: '07:00', end: '18:00' },
};

export interface FacilityNatureSettings {
  bedCounts: NatureBedCounts;
  requirements: NatureRequirements;
  specific: SpecificHoursConfig;
}

// =====================================================
// jsonb 還原（防呆：缺欄位／型別不對時回落預設）
// =====================================================

function toPositiveIntOrNull(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function toNonNegativeInt(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function isTimeString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
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
        ratios[pos] = toPositiveIntOrNull(n);
      }
    }
    const hours: PositionHoursMap = {};
    if (e.hours && typeof e.hours === 'object') {
      for (const [pos, h] of Object.entries(e.hours as Record<string, unknown>)) {
        // 舊格式 {N, M, H}（每名每天）已廢除：物件會被 toPositiveIntOrNull 視為 null（無要求），需重新輸入總工時
        hours[pos] = toPositiveIntOrNull(h);
      }
    }
    result[nature] = { ratios, hours };
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
  const ratio1 = toPositiveIntOrNull(r1?.ratio) ?? fallback.requirement1.ratio;

  const r2 = obj.requirement2 as Record<string, unknown> | undefined;
  const ratio2 = toPositiveIntOrNull(r2?.ratio) ?? fallback.requirement2.ratio;

  const r3 = obj.requirement3 as Record<string, unknown> | undefined;
  const requirement3: TimeSegment =
    r3 && isTimeString(r3.start) && isTimeString(r3.end)
      ? { start: r3.start, end: r3.end }
      : fallback.requirement3;

  return {
    requirement1: { segments, ratio: ratio1 },
    requirement2: { ratio: ratio2 },
    requirement3,
  };
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
    .select('nature_bed_counts, nature_requirements, specific_hours_config')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.warn('讀取院舍性質設定失敗，使用預設值:', error.message);
  }

  return {
    bedCounts: sanitizeBedCounts(data?.nature_bed_counts),
    requirements: sanitizeRequirements(data?.nature_requirements),
    specific: sanitizeSpecific(data?.specific_hours_config),
  };
}

/** 儲存院舍性質設定（三欄一併更新）。床位總和等驗證在元件層完成。 */
export async function saveFacilityNatureSettings(settings: FacilityNatureSettings): Promise<void> {
  const { error } = await supabase
    .from('facility_settings')
    .update({
      nature_bed_counts: settings.bedCounts,
      nature_requirements: settings.requirements,
      specific_hours_config: settings.specific,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) {
    throw new Error(`儲存院舍性質設定失敗：${error.message}`);
  }
}
