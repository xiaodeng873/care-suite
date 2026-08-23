/**
 * 每兩小時轉身記錄表 HTML 列印產生器
 * A4 直向，每月一頁：31 日 × 12 個轉身時間點，格內填 左/右/平/坐
 * 時間點與轉身記錄 tab 一致（TIME_SLOTS：07:00 起每 2 小時）
 */

import type { PositionChangeRecord } from '../lib/database';
import { TIME_SLOTS } from './careRecordHelper';

export interface PositionChangePatientInfo {
  中文姓名?: string | null;
  中文姓氏?: string | null;
  中文名字?: string | null;
  性別?: string | null;
  出生日期?: string | null;
  床號?: string | null;
  original_bed_number?: string | null;
}

const SLOT_HEADERS = TIME_SLOTS; // 07:00, 09:00, …, 05:00

/** scheduled_time（HH:MM）→ 時間點欄索引；不在 TIME_SLOTS 內回 -1 */
function slotIndexOf(scheduledTime: string): number {
  return TIME_SLOTS.indexOf((scheduledTime || '').slice(0, 5));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildMonthGrid(
  records: PositionChangeRecord[],
  year: number,
  month: number, // 1-12
): string {
  // cell[day][slot] = position
  const cell: (string | null)[][] = Array.from({ length: 31 }, () => Array(12).fill(null));
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  for (const r of records) {
    if (!r.change_date || !r.change_date.startsWith(monthPrefix)) continue;
    const day = Number(r.change_date.slice(8, 10));
    const slot = slotIndexOf(r.scheduled_time);
    if (day >= 1 && day <= 31 && slot >= 0 && cell[day - 1][slot] == null) {
      cell[day - 1][slot] = r.position;
    }
  }
  const rows: string[] = [];
  for (let d = 1; d <= 31; d++) {
    const tds = cell[d - 1]
      .map((v) => `<td class="cell-slot">${v ? `<span class="pos">${escapeHtml(v)}</span>` : ''}</td>`)
      .join('');
    rows.push(`<tr><td class="col-date">${d}</td>${tds}</tr>`);
  }
  return rows.join('');
}

function renderPage(
  info: PositionChangePatientInfo | null,
  records: PositionChangeRecord[],
  year: number,
  month: number,
  facilityName: string,
): string {
  const name = info
    ? (`${info.中文姓氏 ?? ''}${info.中文名字 ?? ''}`.trim() || info.中文姓名 || '')
    : '';
  const bed = info ? (info.original_bed_number || info.床號 || '') : '';
  const gender = info?.性別 || '';
  const age = info?.出生日期
    ? String(year - new Date(info.出生日期).getFullYear())
    : '';

  return `
<div class="print-page pc-page">
  <div class="header-section">
    <div class="year-month-box">${year} 年 ${month} 月</div>
    <div class="title-area">
      <div class="title-main">${escapeHtml(facilityName)}</div>
      <div class="title-sub">每兩小時轉身記錄 (左、右、平臥、坐)</div>
    </div>
    <div style="width:20mm;"></div>
  </div>

  <div class="info-row">
    <span>院友姓名：</span>
    <div class="uline uline-grow">${escapeHtml(name)}</div>
    <span>床號：</span>
    <div class="uline" style="width:40mm;">${escapeHtml(bed)}</div>
    <span>性別：</span>
    <div class="uline" style="width:12mm;">${escapeHtml(gender)}</div>
    <span>年齡：</span>
    <div class="uline" style="width:16mm;">${escapeHtml(age)}</div>
  </div>

  <table class="record-table">
    <thead>
      <tr>
        <th class="col-date">時間<hr>日期</th>
        ${SLOT_HEADERS.map((h) => `<th>${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${buildMonthGrid(records, year, month)}
    </tbody>
  </table>

  <div class="footer-code">A04-FK (02.2025)</div>
</div>`;
}

/**
 * 產生日期範圍內的轉身記錄表（每月一頁）
 * @param info 院友資料；傳 null 代表空白表格（blank 模式）
 */
export function generatePositionChangeRangeHtml(
  info: PositionChangePatientInfo | null,
  records: PositionChangeRecord[],
  startDate: string,
  endDate: string,
  facilityName: string,
): string {
  // 逐月產生一頁
  const months: { year: number; month: number }[] = [];
  const [sy, sm] = startDate.split('-').map(Number);
  const [ey, em] = endDate.split('-').map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  if (months.length === 0) months.push({ year: sy, month: sm });

  const pages = months.map(({ year, month }) => renderPage(info, records, year, month, facilityName));

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>每兩小時轉身記錄表</title>
<style>
@page { size: A4; margin: 0; }
body { margin: 0; padding: 0; font-family: "MingLiU", "PMingLiU", serif; color: #000; background: #fff; }
.pc-page { width: 210mm; height: 296mm; padding: 5mm 10mm; box-sizing: border-box; display: flex; flex-direction: column; page-break-after: always; overflow: hidden; }
.pc-page:last-child { page-break-after: auto; }

.header-section { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 5px; }
.year-month-box { border: 1px solid black; width: 80mm; height: 15mm; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; }
.title-area { text-align: center; flex-grow: 1; }
.title-main { font-size: 26px; font-weight: bold; }
.title-sub { font-size: 16px; font-weight: bold; text-decoration: underline; margin-top: 5px; }

.info-row { display: flex; width: 100%; margin-bottom: 5px; font-size: 15px; align-items: flex-end; white-space: nowrap; }
.uline { border-bottom: 0.5pt solid black; margin: 0 10px 0 5px; height: 20px; text-align: center; }
.uline-grow { flex-grow: 1; }

.record-table { width: 100%; border-collapse: collapse; table-layout: fixed; flex-grow: 1; }
.record-table th, .record-table td { border: 0.5pt solid black; padding: 0; text-align: center; vertical-align: middle; }
.record-table th { font-size: 11px; background-color: #fcfcfc; height: 12mm; line-height: 1.1; }
.record-table th hr { border: none; border-top: 0.5pt solid black; margin: 2px 0; }
.col-date { width: 8mm; font-weight: bold; }

.cell-slot {
  background: linear-gradient(to top right, transparent calc(50% - 0.4pt), black 50%, transparent calc(50% + 0.4pt));
  height: 7.2mm;
  font-size: 12px;
  font-weight: bold;
}
.cell-slot .pos { background: #fff; padding: 0 1px; }

.footer-code { text-align: right; font-size: 9px; margin-top: 2px; }
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}
