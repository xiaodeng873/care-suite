// =====================================================
// 公眾假期獲得行產生規則（lazy materialization）
// 對應 user_public_holiday_details 表內 is_system=true 的「獲得」明細
// =====================================================

import { supabase } from '../lib/supabase';
import type { PublicHoliday, PublicHolidayType } from '@care-suite/shared';

/** 系統應發放的一筆公眾假期獲得行（按單一假期） */
export interface ExpectedPublicHolidayGrant {
  /** 發放日期（YYYY-MM-DD，固定為當月 1 日） */
  record_date: string;
  /** 發放天數（固定為 1） */
  days: number;
  /** 備註（該假期名稱） */
  remark: string;
  /** 關聯的 public_holidays id */
  reference_public_holiday_id: string;
  /** 有效期至：holiday_date + 30 天 */
  expiry_date: string;
  /** 原始假期日期（用於 UI 倒數） */
  holiday_date: string;
  /** 原始假期名稱 */
  name: string;
}

/** 以本地日期組件格式化為 YYYY-MM-DD（避免 toISOString 的時區偏移） */
function formatDate(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/** 讀取指定日期範圍與類型的公眾假期 model */
export async function loadPublicHolidaysRange(
  startDate: string,
  endDate: string,
  type: PublicHolidayType,
): Promise<PublicHoliday[]> {
  const { data, error } = await supabase
    .from('public_holidays')
    .select('*')
    .eq('type', type)
    .gte('holiday_date', startDate)
    .lte('holiday_date', endDate)
    .order('holiday_date', { ascending: true });

  if (error) throw new Error(`讀取公眾假期失敗：${error.message}`);
  return (data || []) as PublicHoliday[];
}

/** 讀取指定年份與類型的公眾假期 model */
export async function loadPublicHolidays(
  year: number,
  type: PublicHolidayType,
): Promise<PublicHoliday[]> {
  const start = formatDate(year, 1, 1);
  const end = formatDate(year, 12, 31);
  const { data, error } = await supabase
    .from('public_holidays')
    .select('*')
    .eq('type', type)
    .gte('holiday_date', start)
    .lte('holiday_date', end)
    .order('holiday_date', { ascending: true });

  if (error) throw new Error(`讀取公眾假期失敗：${error.message}`);
  return (data || []) as PublicHoliday[];
}

/** 將 YYYY-MM-DD 解析為 {y,m,d} */
function parseDate(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

/** 對 YYYY-MM-DD 加減天數，回傳 YYYY-MM-DD（本地時間，避免時區偏移） */
export function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDate(dateStr);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * 計算由起始日當月起至 today 為止，系統應存在的公眾假期獲得行。
 *
 * 規則（2026-08-08 修訂）：
 * - 無 type 或無 startDate → 空陣列
 * - 每一筆對應一個實際假期，record_date 固定為該假期所屬月份的 1 日
 * - days = 1，remark = 假期名稱
 * - reference_public_holiday_id = 假期 id
 * - expiry_date = holiday_date + 30 天
 * - 只產生 holiday_date <= today 的月份內假期（當月未來假期仍視為已發放）
 */
export function getExpectedPublicHolidayGrants(
  startDate: string | null | undefined,
  type: PublicHolidayType | null | undefined,
  holidays: PublicHoliday[],
  today: Date = new Date(),
): ExpectedPublicHolidayGrant[] {
  if (!startDate || !type) return [];

  const todayStr = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  if (startDate > todayStr) return [];

  const { y: startY, m: startM } = parseDate(startDate);

  const rows: ExpectedPublicHolidayGrant[] = [];
  let y = startY;
  let m = startM;

  while (true) {
    const monthStr = formatDate(y, m, 1);
    if (monthStr > todayStr) break;

    const monthHolidays = holidays.filter((h) => {
      const { y: hy, m: hm } = parseDate(h.holiday_date);
      return hy === y && hm === m && h.type === type;
    });

    for (const h of monthHolidays) {
      rows.push({
        record_date: monthStr,
        days: 1,
        remark: h.name,
        reference_public_holiday_id: h.id,
        expiry_date: addDays(h.holiday_date, 30),
        holiday_date: h.holiday_date,
        name: h.name,
      });
    }

    // 移到下個月
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return rows;
}

/** 取得指定年月的 PH/SH 假期清單與數目 */
export function getPublicHolidaysForMonth(
  holidays: PublicHoliday[],
  year: number,
  month: number,
  type: PublicHolidayType,
): { holidays: PublicHoliday[]; count: number } {
  const list = holidays.filter((h) => {
    const [hy, hm] = h.holiday_date.split('-').map(Number);
    return hy === year && hm === month && h.type === type;
  });
  return { holidays: list, count: list.length };
}

/** 取得可預排 PH/SH 的日期：與實際假期同月份內的任意日子（目標排班月份） */
export function getValidSubstituteDates(
  holidayDate: string,
  year: number,
  month: number,
): string[] {
  const [hy, hm] = holidayDate.split('-').map(Number);
  if (hy !== year || hm !== month) return [];

  const lastDay = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    dates.push(formatDate(year, month, d));
  }
  return dates;
}
