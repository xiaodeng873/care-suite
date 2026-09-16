/**
 * 雜費記錄報表 HTML 產生器（A4 橫向矩陣版）
 * 每位院友獨立一頁：每頁上下兩個月矩陣，X 軸 = 日期 1–31 日，
 * Y 軸 = 固定收費項目（13 項 + 2 空白手寫列）。
 * 格仔留空手寫，暫不映射費用記錄；不設月總計。
 */

import type { Patient } from '../lib/database';
import { getPrintBedNumber } from './bedTransferUtils';

export interface FeeStatisticsReportOptions {
  /** 起始月份（YYYY-MM）；每頁列該月及下一個月 */
  month: string;
  facilityName: string;
}

/** Y 軸固定收費項目（尾兩列空白手寫） */
const FEE_MATRIX_ROWS = [
  '陪診(首4小時)',
  '陪診(4小時後)',
  '施樂車',
  'CGAT取藥',
  'PGT取藥',
  '其他代辦',
  '尿片',
  '片芯',
  '驗血糖',
  '氣墊床',
  '醫院攪床',
  '電動床',
  '電費',
  '',
  '',
];

/** 'YYYY-MM' 加一個月（處理跨年） */
const addMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  const next = new Date(y, m, 1); // m 係 0-based 嘅「下一個月」
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
};

/** 'YYYY-MM' 減一個月（處理跨年） */
const subMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  const prev = new Date(y, m - 2, 1); // m-1 係本月 0-based；m-2 係上月
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
};

/** 'YYYY-MM' 當月實際日數（28/29/30/31） */
const daysInMonth = (month: string): number => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/**
 * 截數期標籤：每月 24 日截數，25 日起算至下月 24 日。
 * 'YYYY-MM' 指「截數月」，例如 2026-09 = 2026年8月25日 至 2026年9月24日。
 */
const periodLabel = (month: string): string => {
  const prev = subMonth(month);
  const [py, pm] = prev.split('-').map(Number);
  const [y, m] = month.split('-').map(Number);
  return `${py}年${pm}月25日 至 ${y !== py ? `${y}年` : ''}${m}月24日`;
};

const matrixTableHtml = (month: string): string => {
  // 截數期欄序：上月 25 日…上月最後一日，跟住本月 1…24 日
  const prevDays = daysInMonth(subMonth(month));
  const colDays = [
    ...Array.from({ length: prevDays - 24 }, (_, i) => 25 + i),
    ...Array.from({ length: 24 }, (_, i) => i + 1),
  ];
  const head = `<tr><th class="row-label">項目＼日期</th>${
    colDays.map((d) => `<th>${d}</th>`).join('')
  }</tr>`;
  const body = FEE_MATRIX_ROWS.map(
    (label) =>
      `<tr><td class="row-label">${escapeHtml(label)}</td>${
        '<td>&nbsp;</td>'.repeat(colDays.length)
      }</tr>`
  ).join('');
  return `<table class="fee-matrix">${head}${body}</table>`;
};

const patientPageHtml = (
  patient: Patient,
  monthA: string,
  monthB: string,
  facilityName: string
): string => {
  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const bed = getPrintBedNumber(patient);
  const periodStart = periodLabel(monthA).split(' 至 ')[0];
  const periodEnd = periodLabel(monthB).split(' 至 ')[1];
  return `
    <div class="page">
      <div class="report-head">
        <div class="facility">${escapeHtml(facilityName)}</div>
        <div class="doc-title">雜費記錄報表</div>
      </div>
      <div class="patient-line">
        <span>院友姓名：${escapeHtml(patientName)}</span>
        <span>床號：${escapeHtml(bed)}</span>
        <span>期間：${periodStart} 至 ${periodEnd}</span>
      </div>
      <div class="month-block">
        <div class="month-label">${periodLabel(monthA)}</div>
        ${matrixTableHtml(monthA)}
      </div>
      <div class="month-block">
        <div class="month-label">${periodLabel(monthB)}</div>
        ${matrixTableHtml(monthB)}
      </div>
    </div>
  `;
};

const wrapHtml = (pages: string): string => `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <title>雜費記錄報表</title>
  <style>
    @page { size: A4 landscape; margin: 6mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
      margin: 0;
      padding: 0;
      color: #1e293b;
      line-height: 1.2;
    }
    .page {
      width: 100%;
      min-height: 192mm;
      page-break-after: always;
    }
    .page:last-of-type { page-break-after: auto; }
    .report-head { text-align: center; }
    .facility { font-size: 15px; font-weight: bold; color: #0f766e; letter-spacing: 1px; }
    .doc-title { font-size: 13px; font-weight: bold; margin-top: 0.5mm; color: #334155; letter-spacing: 3px; }
    .patient-line {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      font-weight: bold;
      margin: 2mm 0;
      padding: 1.2mm 3mm;
      background: #f0fdfa;
      border: 0.75pt solid #99f6e4;
      border-radius: 1.5mm;
      color: #134e4a;
    }
    .month-block {
      margin-top: 1mm;
      border: 0.75pt solid #99f6e4;
      border-radius: 1.5mm;
      overflow: hidden;
    }
    .month-label {
      font-size: 10px;
      font-weight: bold;
      padding: 0.6mm 2.5mm;
      background: #ccfbf1;
      color: #0f766e;
      border-bottom: 0.75pt solid #99f6e4;
    }
    .fee-matrix {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .fee-matrix th, .fee-matrix td {
      border: 0.5pt solid #cbd5e1;
      text-align: center;
      vertical-align: middle;
      padding: 0;
    }
    .fee-matrix th {
      font-size: 7pt;
      font-weight: bold;
      height: 4mm;
      background: #f8fafc;
      color: #475569;
      border-bottom: 0.75pt solid #94a3b8;
    }
    .fee-matrix td { height: 5.2mm; font-size: 7pt; }
    .fee-matrix .row-label { width: 28mm; }
    .fee-matrix td.row-label {
      text-align: left;
      padding-left: 1.5mm;
      font-weight: bold;
      white-space: nowrap;
      background: #f0fdfa;
      color: #134e4a;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
${pages}
</body>
</html>`;

/** 每位院友一頁 A4 橫向矩陣（起始月份 + 下一個月） */
export const generateFeeStatisticsReportHtml = (
  patients: Patient[],
  options: FeeStatisticsReportOptions
): string => {
  const monthB = addMonth(options.month);
  const pages = patients
    .map((p) => patientPageHtml(p, options.month, monthB, options.facilityName))
    .join('');
  return wrapHtml(pages);
};

const escapeHtml = (text: string): string => {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};
