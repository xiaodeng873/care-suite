// 尿片記錄：每月虛擬尿片/片芯用量數據生成器
// 以床頭記錄換片介面的 6 個 4 小時時段（07:00 起）為基底。
// 生成數據隨機自然（有多有少），院友外出/渡假/入院/無記錄/無大小便的時段會跳過不生成。
// 生成依據（每日與每次條件共同生效）：
// 每日總量（月估算÷日數波動，限每日 min~max）分配到 6 時段，
// 每格受每次上限限制（超出捨棄），生成的格不可低於每次下限。

import { DIAPER_CHANGE_SLOTS, parseDiaperSlotStartTime, getActualSlotDate, isInHospital } from './careRecordHelper';
import type { Patient, PatientAdmissionRecord } from '../lib/database';

export type AbsenceReason = '入院' | '渡假';

/**
 * 真實換片記錄本身的跳過原因（無則為 null，表示可生成/可覆蓋）。
 * 跳過：備註為入院/渡假/外出，或該時段無大小便（has_none 或無任何排泄記錄）。
 */
export const diaperRecordSkipReason = (r: {
  has_urine: boolean;
  has_stool: boolean;
  has_none: boolean;
  notes?: string | null;
}): string | null => {
  if (r.notes && ['入院', '渡假', '外出'].includes(r.notes)) return r.notes;
  if (r.has_none || (!r.has_urine && !r.has_stool)) return '無大小便';
  return null;
};

export interface DiaperUsageCell {
  urine: number;
  core: number;
}

/** generated_data 的形狀：{ "YYYY-MM-DD": { "7AM-11AM": { urine, core }, ... } }（缺席時段不寫入） */
export type DiaperUsageGrid = Record<string, Record<string, DiaperUsageCell>>;

export const daysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

/**
 * 判斷院友在某日期某換片時段是否缺席（入院/渡假）。
 * 以時段起始時刻（含跨夜實際日期）為檢查點；找不到事件回傳 null。
 */
export const getSlotAbsence = (
  patient: Patient,
  date: string,
  slotTime: string,
  admissionRecords: PatientAdmissionRecord[],
  hospitalEpisodes: any[] = []
): AbsenceReason | null => {
  const startTime = parseDiaperSlotStartTime(slotTime);
  const actualDate = getActualSlotDate(date, startTime);
  const target = new Date(`${actualDate}T${startTime}:00`);

  // 1. hospital_episodes：有 primary_hospital = 入院；有 vacation_destination = 渡假
  for (const ep of hospitalEpisodes) {
    if (ep.patient_id !== patient.院友id || !ep.episode_start_date) continue;
    const start = new Date(`${ep.episode_start_date}T00:00:00`);
    if (target < start) continue;
    if (ep.episode_end_date) {
      const end = new Date(`${ep.episode_end_date}T23:59:59`);
      if (target > end) continue;
    }
    return ep.primary_hospital ? '入院' : '渡假';
  }

  // 2. fallback：舊入院/出院記錄
  if (isInHospital(patient, actualDate, startTime, admissionRecords, hospitalEpisodes)) {
    return '入院';
  }
  return null;
};

export interface GenerateMonthGridParams {
  year: number;
  month: number; // 1-12
  monthlyDiaper: number;
  monthlyCore: number;
  dailyMinDiaper: number;
  dailyMaxDiaper: number;
  dailyMinCore: number;
  dailyMaxCore: number;
  /** 每次換片用量範圍：與每日條件共同生效（max 省略 = 無上限；min 預設 0，生成的格不可低於 min） */
  perChangeMinDiaper?: number;
  perChangeMaxDiaper?: number;
  perChangeMinCore?: number;
  perChangeMaxCore?: number;
  /** 缺席/跳過判斷：(date, slotTime) => 跳過原因（如 '入院'、'渡假'、'無記錄'）或 null */
  absenceCheck?: (date: string, slotTime: string) => string | null;
  /** 可注入隨機源（測試用），預設 Math.random */
  rng?: () => number;
}

/** 把 total 隨機分配到 slots 個格子（逐個單位隨機指派，每格不超過 maxPerSlot；全滿後餘量捨棄），回傳每格數量 */
const distribute = (total: number, slotCount: number, maxPerSlot: number, rng: () => number): number[] => {
  const counts = new Array(slotCount).fill(0);
  for (let i = 0; i < total; i++) {
    const candidates: number[] = [];
    for (let j = 0; j < slotCount; j++) {
      if (counts[j] < maxPerSlot) candidates.push(j);
    }
    if (candidates.length === 0) break; // 所有格已達每次上限，餘量捨棄
    counts[candidates[Math.floor(rng() * candidates.length)]] += 1;
  }
  return counts;
};

/** 以 avg 為中心 ±30% 隨機波動，四捨五入後 clamp 到 [min, max] */
const randomDailyTotal = (avg: number, min: number, max: number, rng: () => number): number => {
  const waved = Math.round(avg * (0.7 + rng() * 0.6));
  return Math.max(min, Math.min(max, waved));
};

/**
 * 生成整月虛擬數據表。
 * - 每日總量：以「每月估算 ÷ 日數」為中心隨機波動，限制在用戶自設 min~max。
 * - 時段分配：先隨機分配到全部 6 個時段（允許 0，不會每格一樣），
 *   再剔除被跳過時段的份量——跳過（入院/渡假/無記錄/無大小便）會令當日用量自然減少。
 * - 生成的格不可低於每次下限（當日總量為 0 則全 0，不憑空生成）；
 *   下限高於上限時以上限為準。
 * - 整日跳過則該日無任何時段。
 */
export const generateMonthGrid = (params: GenerateMonthGridParams): DiaperUsageGrid => {
  const {
    year, month, monthlyDiaper, monthlyCore,
    dailyMinDiaper, dailyMaxDiaper, dailyMinCore, dailyMaxCore,
    perChangeMinDiaper = 0, perChangeMaxDiaper,
    perChangeMinCore = 0, perChangeMaxCore,
    absenceCheck, rng = Math.random,
  } = params;

  const days = daysInMonth(year, month);
  const avgDiaper = monthlyDiaper > 0 ? monthlyDiaper / days : 0;
  const avgCore = monthlyCore > 0 ? monthlyCore / days : 0;
  const grid: DiaperUsageGrid = {};

  for (let d = 1; d <= days; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // 可用的（非跳過）時段
    const available = DIAPER_CHANGE_SLOTS.filter(
      (s) => !absenceCheck || !absenceCheck(date, s.time)
    );
    if (available.length === 0) continue; // 整日跳過

    // 每日與每次條件共同生效：
    // 每日總量（月估算÷日數波動，限 dailyMin~dailyMax）分配到全部 6 個時段，
    // 每格受每次上限限制（超出捨棄）；
    // 再只保留可用時段（跳過時段的份量隨之失去），
    // 保留的格不可低於每次下限（當日總量為 0 則保持 0，不憑空生成）。
    const dailyDiaperTotal =
      avgDiaper > 0 ? randomDailyTotal(avgDiaper, dailyMinDiaper, dailyMaxDiaper, rng) : 0;
    const dailyCoreTotal =
      avgCore > 0 ? randomDailyTotal(avgCore, dailyMinCore, dailyMaxCore, rng) : 0;
    const diaperCounts = distribute(
      dailyDiaperTotal,
      DIAPER_CHANGE_SLOTS.length,
      perChangeMaxDiaper ?? Number.MAX_SAFE_INTEGER,
      rng
    );
    const coreCounts = distribute(
      dailyCoreTotal,
      DIAPER_CHANGE_SLOTS.length,
      perChangeMaxCore ?? Number.MAX_SAFE_INTEGER,
      rng
    );
    // 下限高於上限的矛盾設定以上限為準
    const diaperFloor = Math.min(perChangeMinDiaper, perChangeMaxDiaper ?? perChangeMinDiaper);
    const coreFloor = Math.min(perChangeMinCore, perChangeMaxCore ?? perChangeMinCore);

    const daySlots: Record<string, DiaperUsageCell> = {};
    DIAPER_CHANGE_SLOTS.forEach((slot, i) => {
      if (!available.includes(slot)) return;
      daySlots[slot.time] = {
        urine: dailyDiaperTotal > 0 ? Math.max(diaperCounts[i], diaperFloor) : 0,
        core: dailyCoreTotal > 0 ? Math.max(coreCounts[i], coreFloor) : 0,
      };
    });
    grid[date] = daySlots;
  }

  return grid;
};
