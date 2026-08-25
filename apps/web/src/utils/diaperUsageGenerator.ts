// 尿片記錄：每月虛擬尿片/片芯用量數據生成器
// 以床頭記錄換片介面的 6 個 4 小時時段（07:00 起）為基底。
// 生成數據隨機自然（每日總量在 min~max 內波動、時段分配不均），
// 院友外出/渡假/入院的時段會跳過不生成。

import { DIAPER_CHANGE_SLOTS, parseDiaperSlotStartTime, getActualSlotDate, isInHospital } from './careRecordHelper';
import type { Patient, PatientAdmissionRecord } from '../lib/database';

export type AbsenceReason = '入院' | '渡假';

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
  /** 缺席/跳過判斷：(date, slotTime) => 跳過原因（如 '入院'、'渡假'、'無記錄'）或 null */
  absenceCheck?: (date: string, slotTime: string) => string | null;
  /** 可注入隨機源（測試用），預設 Math.random */
  rng?: () => number;
}

/** 把 total 隨機分配到 slots 個格子（多項式：逐個單位隨機指派），回傳每格數量 */
const distribute = (total: number, slotCount: number, rng: () => number): number[] => {
  const counts = new Array(slotCount).fill(0);
  for (let i = 0; i < total; i++) {
    counts[Math.floor(rng() * slotCount)] += 1;
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
 * - 時段分配：隨機、允許 0，不會每格一樣。
 * - 缺席時段不生成（不寫入 grid）；整日缺席則該日無任何時段。
 */
export const generateMonthGrid = (params: GenerateMonthGridParams): DiaperUsageGrid => {
  const {
    year, month, monthlyDiaper, monthlyCore,
    dailyMinDiaper, dailyMaxDiaper, dailyMinCore, dailyMaxCore,
    absenceCheck, rng = Math.random,
  } = params;

  const days = daysInMonth(year, month);
  const avgDiaper = monthlyDiaper > 0 ? monthlyDiaper / days : 0;
  const avgCore = monthlyCore > 0 ? monthlyCore / days : 0;
  const grid: DiaperUsageGrid = {};

  for (let d = 1; d <= days; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // 可用的（非缺席）時段
    const available = DIAPER_CHANGE_SLOTS.filter(
      (s) => !absenceCheck || !absenceCheck(date, s.time)
    );
    if (available.length === 0) continue; // 整日缺席

    const diaperTotal = avgDiaper > 0
      ? randomDailyTotal(avgDiaper, dailyMinDiaper, dailyMaxDiaper, rng)
      : 0;
    const coreTotal = avgCore > 0
      ? randomDailyTotal(avgCore, dailyMinCore, dailyMaxCore, rng)
      : 0;

    const diaperCounts = distribute(diaperTotal, available.length, rng);
    const coreCounts = distribute(coreTotal, available.length, rng);

    const daySlots: Record<string, DiaperUsageCell> = {};
    available.forEach((slot, i) => {
      daySlots[slot.time] = { urine: diaperCounts[i], core: coreCounts[i] };
    });
    grid[date] = daySlots;
  }

  return grid;
};
