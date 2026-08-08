/**
 * 院舍系統統一顯示日期格式工具。
 *
 * 規則：
 * - 所有 UI / 列印輸出的阿拉伯數字日期統一使用 DD/MM/YYYY（兩位日、兩位月、四位年）。
 * - 中文日期（年月日）不在此處理。
 * - 內部 API / 資料庫 / 表單值仍使用 YYYY-MM-DD，不由此工具處理。
 */

export function isValidDate(value: Date | string | number | undefined | null): value is Date | string | number {
  if (value === undefined || value === null || value === '') return false;
  const d = value instanceof Date ? value : new Date(value);
  return !isNaN(d.getTime());
}

function parseDate(value: Date | string | number | undefined | null): Date | null {
  if (!isValidDate(value)) return null;
  return value instanceof Date ? value : new Date(value);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 格式化日期為 DD/MM/YYYY。
 * 無效日期回傳空字串。
 */
export function formatDisplayDate(
  value: Date | string | number | undefined | null,
  fallback = ''
): string {
  const d = parseDate(value);
  if (!d) return fallback;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * 解析 DD/MM/YYYY 字串，回傳內部 ISO 格式 YYYY-MM-DD。
 * 無效時回傳 null。
 */
export function parseDisplayDate(display: string): string | null {
  const clean = display.replace(/\s/g, '');
  const parts = clean.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y || d.length > 2 || m.length > 2 || y.length !== 4) return null;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 計算年齡（以今日為基準，未過生日則減一歲）。
 */
export function calculateAge(birthDate: Date | string | number | undefined | null): number | null {
  const d = parseDate(birthDate);
  if (!d) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

/**
 * 格式化日期並附加年齡，例如：01/08/1950 (75歲)。
 * 無法計算年齡時只回傳日期。
 */
export function formatDisplayDateWithAge(
  date: Date | string | number | undefined | null,
  fallback = '-'
): string {
  const dateStr = formatDisplayDate(date);
  if (!dateStr) return fallback;
  const age = calculateAge(date);
  if (age === null || age < 0) return dateStr;
  return `${dateStr} (${age}歲)`;
}

/**
 * 格式化日期 + 時間。
 * 時間可傳入 `HH:MM` 字串；若未提供且 value 為 Date，則使用其時間部分。
 */
export function formatDisplayDateTime(
  value: Date | string | number | undefined | null,
  time?: string
): string {
  const d = parseDate(value);
  if (!d) return '';

  const datePart = formatDisplayDate(d);
  if (time) return `${datePart} ${time}`;

  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${datePart} ${hours}:${minutes}`;
}

/**
 * 將 DD/MM/YYYY 或 ISO 日期轉為內部 YYYY-MM-DD 格式（供表單/DB 使用）。
 * 無效時回傳空字串。
 */
export function toInternalDate(value: Date | string | number | undefined | null): string {
  const d = parseDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 把日期轉為中文年月日格式（不屬於阿拉伯數字日期，保留給列印文件使用）。
 */
export function formatDisplayDateToChinese(
  value: Date | string | number | undefined | null,
  includeTime = false
): string {
  const d = parseDate(value);
  if (!d) return '';
  let result = `${d.getFullYear()}年${pad2(d.getMonth() + 1)}月${pad2(d.getDate())}日`;
  if (includeTime) {
    result += ` ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  return result;
}

/**
 * 格式化日期範圍。
 */
export function formatDisplayDateRange(
  start: Date | string | number | undefined | null,
  end: Date | string | number | undefined | null,
  separator = ' 至 '
): string {
  const startStr = formatDisplayDate(start);
  const endStr = formatDisplayDate(end);
  if (!startStr && !endStr) return '';
  if (!startStr) return endStr;
  if (!endStr) return startStr;
  return `${startStr}${separator}${endStr}`;
}
