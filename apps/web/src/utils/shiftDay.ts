// =====================================================
// 排班日坐標系：以每天早上 07:00 為一天的開始
// =====================================================

const SHIFT_DAY_START_TIME = '07:00';

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 解析 "YYYY-MM-DD" 為本地時間 Date */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 把 Date 轉回 "YYYY-MM-DD"（本地時間） */
export function toDateStr(date: Date): string {
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** 加上/減去天數 */
export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

/**
 * 判斷某個絕對時間點屬於哪一個排班日。
 * 排班日 = [該日 07:00, 翌日 07:00)
 */
export function getShiftDay(dateStr: string, timeStr: string): string {
  const date = parseLocalDate(dateStr);
  if (timeStr < SHIFT_DAY_START_TIME) {
    date.setDate(date.getDate() - 1);
  }
  return toDateStr(date);
}

/**
 * 取得排班日的起點 Date（當天 07:00）
 */
export function getShiftDayStart(dateStr: string): Date {
  const date = parseLocalDate(dateStr);
  const [h, m] = SHIFT_DAY_START_TIME.split(':').map(Number);
  date.setHours(h, m, 0, 0);
  return date;
}

/**
 * 把絕對時間點轉為排班日內的分鐘數（0 = 07:00，1440 = 翌日 07:00）
 */
export function getMinutesIntoShiftDay(dateStr: string, timeStr: string): number {
  const start = getShiftDayStart(getShiftDay(dateStr, timeStr));
  const [h, m] = timeStr.split(':').map(Number);
  const point = parseLocalDate(dateStr);
  point.setHours(h, m, 0, 0);
  return (point.getTime() - start.getTime()) / 60000;
}

/**
 * 把排班日內的分鐘數轉為 calendar date 和 time
 */
export function fromShiftDayMinutes(shiftDay: string, minutes: number): { date: string; time: string } {
  const start = getShiftDayStart(shiftDay);
  const point = new Date(start.getTime() + minutes * 60000);
  return {
    date: toDateStr(point),
    time: `${pad(point.getHours())}:${pad(point.getMinutes())}`,
  };
}

/**
 * 取得班次所屬的排班日。
 * 規則：班次開始時間 < 07:00 屬於前一天，否則屬於 work_date 當天。
 */
export function getAssignmentShiftDay(workDate: string, startTime: string): string {
  return getShiftDay(workDate, startTime);
}

/**
 * 取得一個班次在排班日坐標系下的時間段 [startMinutes, endMinutes)。
 * endMinutes 可能 > 1440（跨午夜）。
 */
export function getAssignmentShiftDayMinutes(
  workDate: string,
  startTime: string,
  endTime: string,
): { shiftDay: string; start: number; end: number } {
  const shiftDay = getAssignmentShiftDay(workDate, startTime);
  const start = getMinutesIntoShiftDay(workDate, startTime);
  const rawEnd = getMinutesIntoShiftDay(workDate, endTime);
  // 若結束時間在起點之前，表示跨午夜，需加 1440
  const end = rawEnd <= start ? rawEnd + 1440 : rawEnd;
  return { shiftDay, start, end };
}

/**
 * 取得排班日內特定鐘點要求的 calendar 時段列表。
 * 例如排班日 D，特定鐘點 07:00-20:00 對應 calendar date D 的 07:00-20:00。
 * 特定鐘點 18:00-07:00（跨午夜）對應 D 18:00-24:00 和 D+1 00:00-07:00。
 */
export function getShiftDaySegments(
  shiftDay: string,
  segmentStart: string,
  segmentEnd: string,
): { date: string; start: string; end: string }[] {
  const startMin = getMinutesIntoShiftDay(shiftDay, segmentStart);
  const rawEndMin = getMinutesIntoShiftDay(shiftDay, segmentEnd);
  const endMin = rawEndMin <= startMin ? rawEndMin + 1440 : rawEndMin;

  const segments: { date: string; start: string; end: string }[] = [];
  let current = startMin;
  while (current < endMin) {
    const point = fromShiftDayMinutes(shiftDay, current);
    const dayEnd = Math.min(endMin, current + (1440 - (current % 1440)));
    const endPoint = fromShiftDayMinutes(shiftDay, dayEnd);
    segments.push({ date: point.date, start: point.time, end: endPoint.time });
    current = dayEnd;
  }
  return segments;
}

/**
 * 判斷某 calendar 時段（ HH:MM 到 HH:MM，可能跨午夜）是否覆蓋了指定小時。
 * 這裡的 hour 是 0-23 的 calendar 小時。
 */
export function calendarSegmentCoversHour(
  startTime: string,
  endTime: string,
  hour: number,
): boolean {
  const slotStart = hour * 60;
  const slotEnd = slotStart + 60;
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);

  if (e > s) {
    return slotStart < e && slotEnd > s;
  }
  if (e < s) {
    return slotStart < e || slotEnd > s;
  }
  return true;
}

/** "HH:MM" → 分鐘數 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
