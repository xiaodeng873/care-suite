import { supabase } from '../lib/supabase';

// =====================================================
// 一鍵排班原則（按職位分頁儲存於 facility_settings.auto_roster_principles）
// =====================================================

export interface AutoRosterPrinciples {
  /** 原則2：每個居住區，早班最多 N 名，有餘的攤派到午班 */
  earlyExtra: { enabled: boolean; n: number };
  /** 原則2 延伸：每個居住區，午班也最多 N 名 */
  afternoonMax: { enabled: boolean; n: number };
  /** 原則3：無視優先指派居住區的預設一鍵排班（預設不勾選） */
  ignoreStationPreference: boolean;
}

export const DEFAULT_AUTO_ROSTER_PRINCIPLES: AutoRosterPrinciples = {
  earlyExtra: { enabled: false, n: 1 },
  afternoonMax: { enabled: false, n: 1 },
  ignoreStationPreference: false,
};

/** key = 職位分頁（如「護士/保健員」） */
export type AutoRosterPrinciplesConfig = Record<string, AutoRosterPrinciples>;

const toPositiveInt = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
};

function sanitizeOne(raw: unknown): AutoRosterPrinciples {
  const d = DEFAULT_AUTO_ROSTER_PRINCIPLES;
  if (!raw || typeof raw !== 'object') return {
    earlyExtra: { ...d.earlyExtra },
    afternoonMax: { ...d.afternoonMax },
    ignoreStationPreference: d.ignoreStationPreference,
  };
  const r = raw as Record<string, unknown>;
  const extra = (r.earlyExtra ?? {}) as Record<string, unknown>;
  const afternoon = (r.afternoonMax ?? {}) as Record<string, unknown>;
  return {
    earlyExtra: {
      enabled: extra.enabled === true,
      n: toPositiveInt(extra.n, d.earlyExtra.n),
    },
    afternoonMax: {
      enabled: afternoon.enabled === true,
      n: toPositiveInt(afternoon.n, d.afternoonMax.n),
    },
    ignoreStationPreference: r.ignoreStationPreference === true,
  };
}

function sanitizeConfig(raw: unknown): AutoRosterPrinciplesConfig {
  if (!raw || typeof raw !== 'object') return {};
  const result: AutoRosterPrinciplesConfig = {};
  for (const [position, value] of Object.entries(raw as Record<string, unknown>)) {
    result[position] = sanitizeOne(value);
  }
  return result;
}

/** 取得某職位分頁的原則（未設定時回預設值） */
export function getPrinciplesForPosition(
  config: AutoRosterPrinciplesConfig,
  position: string,
): AutoRosterPrinciples {
  return config[position] ?? sanitizeOne(undefined);
}

/** 讀取一鍵排班原則。讀取失敗或欄位缺失時回落空設定（全部用預設值）。 */
export async function loadAutoRosterPrinciples(): Promise<AutoRosterPrinciplesConfig> {
  const { data, error } = await supabase
    .from('facility_settings')
    .select('auto_roster_principles')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.warn('讀取一鍵排班原則失敗，使用預設值:', error.message);
  }

  return sanitizeConfig(data?.auto_roster_principles);
}

/** 儲存一鍵排班原則（整份設定一併更新） */
export async function saveAutoRosterPrinciples(config: AutoRosterPrinciplesConfig): Promise<void> {
  const { error } = await supabase
    .from('facility_settings')
    .update({
      auto_roster_principles: config,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) {
    throw new Error(`儲存一鍵排班原則失敗：${error.message}`);
  }
}
