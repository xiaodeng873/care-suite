// =====================================================
// 排班預排驗證工具
// 供 RosterLeaveModal / RosterScheduleView 判斷能否新增/刪除假別
// =====================================================

import type { UserLeaveRecord, PublicHoliday, LeaveType } from '@care-suite/shared';
import { getExpectedMonthlyRestDays } from './restDays';
import { getPublicHolidaysForMonth } from './publicHolidays';

export interface RosterLeaveContext {
  /** 目標年份 */
  year: number;
  /** 目標月份（1-12） */
  month: number;
  /** 該員工在整個系統中的預排記錄 */
  existingLeaves: UserLeaveRecord[];
  /** 該員工已預排的 PH/SH 所引用的 public_holiday id 集合 */
  usedHolidayIds: Set<string>;
  /** 可排 DO 的總額度（結餘 + 目標月預估） */
  doBalance: number;
  /** 當前 PRD fraction 累積（可用 PRD = floor(fraction + 目標月預估)） */
  restDayFraction: number;
  /** 目標月預估 PRD 天數 */
  prdExpected: number;
  /** 該員工年假可用天數 */
  alBalance: number;
  /** 該月 PH/SH 假期清單（public_holidays） */
  publicHolidays: PublicHoliday[];
  /** 該員工適用的公眾假期類型（PH/SH），未設定則不能預排 PH/SH */
  publicHolidayType: 'PH' | 'SH' | null;
}

/** 檢查請假日期是否落在目標年月 */
export function isDateInTargetMonth(dateStr: string, year: number, month: number): boolean {
  const [y, m] = dateStr.split('-').map(Number);
  return y === year && m === month;
}

/** 檢查同一員工同一天是否已有請假（排除 optional 的 excludeId，用於編輯） */
export function hasLeaveConflict(
  leaveDate: string,
  existingLeaves: UserLeaveRecord[],
  excludeId?: string,
): boolean {
  return existingLeaves.some((l) => l.leave_date === leaveDate && l.id !== excludeId);
}

function parseTimeMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 驗證一筆排班預排是否合法；回傳錯誤訊息或 null */
export function validateScheduledLeave(
  payload: {
    recordType: 'leave' | 'availability';
    leaveDate: string;
    leaveType: LeaveType | null;
    urgency: 'mandatory' | 'preferred';
    referencePublicHolidayId?: string | null;
    availabilityStartTime?: string | null;
    availabilityEndTime?: string | null;
  },
  ctx: RosterLeaveContext,
): string | null {
  if (!isDateInTargetMonth(payload.leaveDate, ctx.year, ctx.month)) {
    return '預排日必須在目標排班月份內';
  }

  if (hasLeaveConflict(payload.leaveDate, ctx.existingLeaves)) {
    return '該員工在目標日期已有預排記錄';
  }

  if (payload.recordType === 'availability') {
    if (!payload.availabilityStartTime || !payload.availabilityEndTime) {
      return '請輸入特定上班時間的開始與結束時間';
    }
    const start = parseTimeMinutes(payload.availabilityStartTime);
    const end = parseTimeMinutes(payload.availabilityEndTime);
    if (start === end) {
      return '特定上班時間必須大於 0 小時';
    }
    return null;
  }

  if (!payload.leaveType) {
    return '請選擇假別';
  }

  if (payload.leaveType === 'DO') {
    if (ctx.doBalance <= 0) {
      return 'DO 額度不足';
    }
    return null;
  }

  if (payload.leaveType === 'PRD') {
    const available = Math.floor(ctx.restDayFraction + ctx.prdExpected);
    if (available <= 0) {
      return 'PRD 累積不足 1 天，無法預排';
    }
    return null;
  }

  if (payload.leaveType === 'PH' || payload.leaveType === 'SH') {
    if (!payload.referencePublicHolidayId) {
      return 'PH/SH 預排必須關聯實際假期';
    }
    const holiday = ctx.publicHolidays.find(
      (h) => h.id === payload.referencePublicHolidayId && h.type === payload.leaveType,
    );
    if (!holiday) {
      return '找不到對應的實際假期';
    }
    if (!isDateInTargetMonth(holiday.holiday_date, ctx.year, ctx.month)) {
      return '實際假期與目標排班月份不同';
    }
    if (ctx.usedHolidayIds.has(payload.referencePublicHolidayId)) {
      return '該實際假期已被同一員工預排';
    }
    return null;
  }

  if (payload.leaveType === 'AL') {
    if (ctx.alBalance <= 0) {
      return 'AL 額度不足';
    }
  }

  // SL / CL / NPL：暫不驗證額度，僅檢查衝突
  return null;
}

/** 計算目標月份的預估 DO / PRD 天數與 PH / SH 數目 */
export function getRosterExpectedCounts(
  weeklyWorkDays: number | null,
  restDayFraction: number,
  publicHolidays: PublicHoliday[],
  year: number,
  month: number,
  restDayStartDate?: string | null,
) {
  const rest = getExpectedMonthlyRestDays(
    weeklyWorkDays ?? 0,
    year,
    month,
    restDayFraction,
    restDayStartDate ?? undefined,
  );
  const ph = getPublicHolidaysForMonth(publicHolidays, year, month, 'PH');
  const sh = getPublicHolidaysForMonth(publicHolidays, year, month, 'SH');

  return {
    doExpected: rest.doDays,
    prdExpected: rest.prdDays,
    leftoverFraction: rest.leftoverFraction,
    phExpected: ph.count,
    shExpected: sh.count,
  };
}

/** 計算目標月份的各假別已使用數（按 leave_date 年月，只計放假記錄） */
export function getRosterUsedCounts(leaveRecords: UserLeaveRecord[], year: number, month: number) {
  const inMonth = (date: string) => isDateInTargetMonth(date, year, month);
  const leaves = leaveRecords.filter((l) => l.record_type === 'leave');
  return {
    doUsed: leaves.filter((l) => l.leave_type === 'DO' && inMonth(l.leave_date)).length,
    prdUsed: leaves.filter((l) => l.leave_type === 'PRD' && inMonth(l.leave_date)).length,
    phUsed: leaves.filter((l) => l.leave_type === 'PH' && inMonth(l.leave_date)).length,
    shUsed: leaves.filter((l) => l.leave_type === 'SH' && inMonth(l.leave_date)).length,
    alUsed: leaves.filter((l) => l.leave_type === 'AL' && inMonth(l.leave_date)).length,
    slUsed: leaves.filter((l) => l.leave_type === 'SL' && inMonth(l.leave_date)).length,
    clUsed: leaves.filter((l) => l.leave_type === 'CL' && inMonth(l.leave_date)).length,
    nplUsed: leaves.filter((l) => l.leave_type === 'NPL' && inMonth(l.leave_date)).length,
  };
}
