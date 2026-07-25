import type { PatientLog, Patient } from '../lib/database';
import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';
import { printCombinedHtml } from './printUtils';

const MAX_ROWS_PER_PAGE = 35;
// 護理/治療欄寬度約可容納 38 個 14px 中文字（含左右 padding）。
// 以「中文字 = 1.0 單位」換算，英文/數字等較窄字元可佔更少單位，
// 從而按內容實際寬度決定何時折行，避免強行切斷英數混雜文字。
const MAX_WIDTH_UNITS = 38;
const DOC_CODE = 'B14 FK (11.2020)';
// A4 內容高度（扣除 @page 上下 margin 5mm）= 287mm
const PAGE_CONTENT_HEIGHT_MM = 287;

interface PrintRow {
  contentLine: string;
  isFirstRowOfRecord: boolean;
  isLastRowOfRecord: boolean;
  isLastContentLine: boolean;
  recordDate: string;
  recorder: string;
  recordId: string;
}

const charWidth = (char: string): number => {
  const code = char.charCodeAt(0);
  // CJK 統一表意文字、擴展區及全形字元
  if (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef)
  ) {
    return 1.0;
  }
  // 英文大寫
  if (char >= 'A' && char <= 'Z') return 0.6;
  // 英文小寫及數字
  if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) return 0.5;
  // 空格
  if (char === ' ') return 0.3;
  // 其他符號（標點等）
  return 0.4;
};

const lineWidth = (line: string): number => {
  let width = 0;
  for (const char of line) {
    width += charWidth(char);
  }
  return width;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const calculateAge = (birthDate?: string): string => {
  if (!birthDate) return '';
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
  ) {
    age -= 1;
  }
  return age > 0 ? String(age) : '';
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

const splitTextIntoLines = (text: string, maxWidth: number): string[] => {
  if (!text) return [''];
  const rawLines = text.split('\n');
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trimEnd();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    let currentLine = '';
    let currentWidth = 0;
    for (const char of trimmed) {
      const w = charWidth(char);
      if (currentWidth + w > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
        currentWidth = w;
      } else {
        currentLine += char;
        currentWidth += w;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }
  return lines;
};

const buildRowsForPatient = (logs: PatientLog[]): PrintRow[] => {
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
  );
  const rows: PrintRow[] = [];
  for (const log of sortedLogs) {
    const contentLines = splitTextIntoLines(log.content, MAX_WIDTH_UNITS);
    const totalLines = Math.max(contentLines.length, 1);
    // 標記最後一個非空內容行為「末字該行」
    let lastContentIndex = -1;
    for (let i = contentLines.length - 1; i >= 0; i--) {
      if (contentLines[i].trim() !== '') {
        lastContentIndex = i;
        break;
      }
    }
    for (let i = 0; i < totalLines; i++) {
      rows.push({
        contentLine: contentLines[i] || '',
        isFirstRowOfRecord: i === 0,
        isLastRowOfRecord: i === totalLines - 1,
        isLastContentLine: i === lastContentIndex,
        recordDate: log.log_date,
        recorder: log.recorder,
        recordId: log.id,
      });
    }
  }
  return rows;
};

const paginateRows = (rows: PrintRow[], rowsPerPage: number): PrintRow[][] => {
  const pages: PrintRow[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) {
    pages.push(rows.slice(i, i + rowsPerPage));
  }
  return pages;
};

const buildPageHtml = (
  pageRows: PrintRow[],
  pageNumber: number,
  patient: Patient | undefined,
  facilityName: string,
  logoDataUri: string | null
): string => {
  const fullRows = pageRows.length;
  const emptyRows = Math.max(MAX_ROWS_PER_PAGE - fullRows, 0);

  const renderRow = (row: PrintRow, rowIndex: number): string => {
    const isFirstRowOfPage = rowIndex === 0;
    let dateCell = '';
    if (row.isFirstRowOfRecord) {
      dateCell = formatDate(row.recordDate);
    } else if (isFirstRowOfPage) {
      dateCell = '續上頁';
    }
    const signCell = row.isLastRowOfRecord ? escapeHtml(row.recorder) : '';
    const strikeFill = row.isLastContentLine ? '<span class="strike-fill"></span>' : '';
    return `<tr class="data-row">
      <td class="center-input">${escapeHtml(dateCell)}</td>
      <td class="content-cell"><div class="content-wrap"><span>${escapeHtml(row.contentLine)}</span>${strikeFill}</div></td>
      <td class="center-input">${signCell}</td>
    </tr>`;
  };

  const dataRowsHtml = pageRows.map((row, idx) => renderRow(row, idx)).join('');
  const emptyRowsHtml = Array(emptyRows)
    .fill('<tr class="data-row"><td class="center-input"></td><td class="content-cell"><div class="content-wrap"><span></span></div></td><td class="center-input"></td></tr>')
    .join('');

  const 姓名 = patient ? `${patient.中文姓氏 || ''}${patient.中文名字 || ''}` : '';
  const 床號 = patient?.床號 || '';
  const 性別年齡 = patient
    ? `${patient.性別 || ''}/${calculateAge(patient.出生日期)}`
    : '';
  const logoHtml = logoDataUri
    ? `<img class="header-logo" src="${escapeHtml(logoDataUri)}" alt="logo">`
    : '';
  const pageIndicatorHtml = `<div class="page-indicator">第 ${pageNumber} 頁</div>`;

  return `
  <div class="page">
    <div class="page-header">
      <div class="header-section">
        <div class="header-spacer"></div>
        <div class="header-center">
          <h1>${escapeHtml(facilityName)}</h1>
          <h2>護理及治療記錄</h2>
        </div>
        <div class="header-right">
          <div class="logo-box">
            ${logoHtml}
          </div>
        </div>
        ${pageIndicatorHtml}
      </div>
      <table class="info-table">
        <colgroup>
          <col style="width: 85px;">
          <col style="width: auto;">
          <col style="width: 60px;">
          <col style="width: 150px;">
          <col style="width: 95px;">
          <col style="width: 150px;">
        </colgroup>
        <tr>
          <td>院友姓名：</td>
          <td><input type="text" class="db-line-input" value="${escapeHtml(姓名)}"></td>
          <td>床號：</td>
          <td><input type="text" class="db-line-input" value="${escapeHtml(床號)}"></td>
          <td>性別/年齡：</td>
          <td><input type="text" class="db-line-input" value="${escapeHtml(性別年齡)}"></td>
        </tr>
      </table>
    </div>
    <div class="page-content">
      <table class="main-table">
        <colgroup>
          <col class="col-date">
          <col class="col-content">
          <col class="col-sign">
        </colgroup>
        <thead>
          <tr>
            <th>日期/更期</th>
            <th>護理/治療</th>
            <th>簽名</th>
          </tr>
        </thead>
        <tbody>
          ${dataRowsHtml}
          ${emptyRowsHtml}
        </tbody>
      </table>
    </div>
    <div class="page-footer">
      <span class="page-num">6</span>
      <span class="doc-code">${DOC_CODE}</span>
    </div>
  </div>`;
};

const buildPatientHtml = (
  patient: Patient | undefined,
  logs: PatientLog[],
  facilityName: string,
  logoDataUri: string | null
): string => {
  const rows = buildRowsForPatient(logs);
  const pages = paginateRows(rows, MAX_ROWS_PER_PAGE);
  if (pages.length === 0) {
    pages.push([]);
  }

  const pageHtmls = pages.map((pageRows, idx) =>
    buildPageHtml(pageRows, idx + 1, patient, facilityName, logoDataUri)
  );

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <title>護理及治療記錄 - ${escapeHtml(facilityName)}</title>
  <style>
    @page {
      size: A4;
      margin: 5mm 0.25in;
    }
    body {
      font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
      margin: 0; padding: 0;
      background-color: #fff;
      color: #000;
      line-height: 1.2;
    }
    .page {
      height: ${PAGE_CONTENT_HEIGHT_MM}mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .page-header {
      flex-shrink: 0;
    }
    .page-content {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      overflow: hidden;
    }
    .page-footer {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      position: relative;
      height: 30px;
      padding: 2px 0;
      font-weight: bold;
    }
    .page-footer .page-num {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      font-size: 24px;
      bottom: 0;
    }
    .page-footer .doc-code {
      position: absolute;
      right: 0;
      bottom: 0;
      font-size: 11px;
      font-weight: bold;
    }
    .header-section {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 12px;
      position: relative;
    }
    .header-center { flex: 1; text-align: center; }
    .header-section h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
    .header-section h2 {
      margin: 4px 0 0 0;
      font-size: 22px;
      font-weight: bold;
      display: inline-block;
      border-bottom: 1.5px solid black;
      padding-bottom: 2px;
    }
    .header-spacer { width: 18%; }
    .header-right {
      width: 18%;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
    }
    .logo-box {
      width: 80px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-logo {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .page-indicator {
      position: absolute;
      right: 0;
      top: 40px;
      font-size: 10px;
      font-weight: bold;
      text-align: right;
      white-space: nowrap;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 5px;
      table-layout: fixed;
    }
    .info-table td {
      border: none;
      padding: 2px 0;
      vertical-align: bottom;
      font-size: 16px;
      font-weight: bold;
      white-space: nowrap;
    }
    .db-line-input {
      width: 90%;
      border: none;
      border-bottom: 1px solid black;
      background: transparent;
      font-family: inherit;
      font-size: 16px;
      outline: none;
      padding: 0 5px;
    }
    table.main-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: 1.5px solid black;
    }
    table.main-table th, table.main-table td {
      border: 1px solid black;
      text-align: center;
      vertical-align: middle;
      padding: 0;
    }
    table.main-table th {
      font-size: 14px;
      font-weight: bold;
      height: 28px;
      background-color: #fff;
    }
    .col-date { width: 14%; }
    .col-content { width: 74%; }
    .col-sign { width: 12%; }
    .data-row { height: 25.5px; }
    .center-input { text-align: center; padding: 0; font-size: 14px; }
    .content-cell { text-align: left; padding: 0; }
    .content-wrap {
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
      padding: 0 8px;
      box-sizing: border-box;
      font-size: 14px;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
    }
    .strike-fill {
      flex-grow: 1;
      position: relative;
      height: 1em;
      margin-left: 2px;
    }
    .strike-fill::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      border-top: 1px solid black;
    }
  </style>
</head>
<body>
  ${pageHtmls.join('\n')}
</body>
</html>`;
};

export async function generatePatientLogNursingTreatmentHtml(
  logs: PatientLog[],
  patients: Patient[],
  selectedIds: string[]
): Promise<string> {
  if (selectedIds.length === 0) {
    return '';
  }

  const selectedLogs = logs.filter((log) => selectedIds.includes(log.id));
  if (selectedLogs.length === 0) {
    return '';
  }

  const facilitySettings = await getFacilitySettings();
  const facilityName = facilitySettings.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;
  const logoDataUri = facilitySettings.logoDataUri;

  const byPatient = new Map<number, PatientLog[]>();
  for (const log of selectedLogs) {
    const list = byPatient.get(log.patient_id) || [];
    list.push(log);
    byPatient.set(log.patient_id, list);
  }

  const pages: string[] = [];
  for (const [patientId, patientLogs] of byPatient) {
    const patient = patients.find((p) => p.院友id === patientId);
    pages.push(buildPatientHtml(patient, patientLogs, facilityName, logoDataUri));
  }

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <title>護理及治療記錄</title>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;
}

export async function printPatientLogNursingTreatment(
  logs: PatientLog[],
  patients: Patient[],
  selectedIds: string[]
): Promise<void> {
  if (selectedIds.length === 0) {
    alert('請選擇要列印的日誌記錄');
    return;
  }

  const html = await generatePatientLogNursingTreatmentHtml(logs, patients, selectedIds);
  if (!html) {
    alert('找不到選取的記錄');
    return;
  }
  printCombinedHtml([html], 'patient-log-nursing-treatment-iframe');
}
