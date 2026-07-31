/**
 * 個人衛生、清潔及大便記錄 列印表格 (iframe HTML 版)
 * 完全複刻 doc_html/個人衛生、清潔及大便記錄.html 的版面、CSS 與佔位符結構，
 * 並映射 hygiene_records 資料表的真實紀錄至對應日期列。
 *
 * 支援 1~2 個月份，每個月份各自生成一頁，日子行數依該月實際天數（28~31）自動調整。
 */

import type { Patient, HygieneRecord } from '../lib/database';

import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';
import { getPrintBedNumber } from './bedTransferUtils';


const ROWS_PER_PAGE = 20;

export interface HygieneMonthData {
  year: number;
  month: number; // 1-12
  recordsByPatient: Map<number, HygieneRecord[]>;
}

// 12 個個人衛生項目，順序須與 doc_html 表頭一致
const HYGIENE_ITEMS: Array<{ key: keyof HygieneRecord; label: string }> = [
  { key: 'has_bath', label: '沖涼洗頭' },
  { key: 'has_face_wash', label: '洗面' },
  { key: 'has_oral_care', label: '刷牙漱口' },
  { key: 'has_denture_care', label: '洗口浸假牙' },
  { key: 'has_haircut', label: '剪髮' },
  { key: 'has_shave', label: '剃鬚' },
  { key: 'has_nail_trim', label: '剪指甲' },
  { key: 'has_bedding_change', label: '換被套' },
  { key: 'has_sheet_pillow_change', label: '換床單枕袋' },
  { key: 'has_cup_wash', label: '洗杯' },
  { key: 'has_bedside_cabinet', label: '整理床頭櫃' },
  { key: 'has_wardrobe', label: '整理衣箱' },
];

// 4 個大便相關項目，順序須與 doc_html 表頭一致
const BOWEL_ITEMS: Array<{ key: keyof HygieneRecord; label: string }> = [
  { key: 'bowel_count', label: '#大便次數' },
  { key: 'bowel_amount', label: '*大便量' },
  { key: 'bowel_consistency', label: '∨大便性質' },
  { key: 'bowel_medication', label: '+大便藥' },
];

const getDaysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate();

const formatDateString = (year: number, month: number, day: number): string =>
  `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

const calculateAge = (birthDate?: string): string => {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return String(age);
};

const escapeHtml = (text: string): string => {
  if (!text) return '';
  const map: { [key: string]: string } = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
};

// 生成單一院友、單一月份的 1~天數 資料列
const generateDataRows = (records: HygieneRecord[], year: number, month: number): string => {
  const daysInMonth = getDaysInMonth(year, month);
  let rows = '';

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateString(year, month, day);
    const record = records.find(r => r.record_date === dateStr);

    let cells = '';

    HYGIENE_ITEMS.forEach(item => {
      const checked = record ? (record as any)[item.key] === true : false;
      cells += `<td><input class="db-text-cell" value="${checked ? '✓' : ''}" readonly></td>`;
    });

    BOWEL_ITEMS.forEach(item => {
      let val = '';
      if (record) {
        const v = (record as any)[item.key];
        if (v !== null && v !== undefined && v !== '') val = escapeHtml(String(v));
      }
      cells += `<td><input class="db-text-cell" value="${val}" readonly></td>`;
    });

    const notes = record ? escapeHtml(record.notes || record.status_notes || '') : '';
    cells += `<td><input class="db-text-cell" value="${notes}" readonly></td>`;

    const recorder = record ? escapeHtml(record.recorder || '') : '';
    cells += `<td><input class="db-text-cell" value="${recorder}" readonly></td>`;

    rows += `<tr class="data-row"><td><b>${day}</b></td>${cells}</tr>`;
  }

  return rows;
};

// 產生單一院友、單一月份的整頁 HTML（完全複刻 doc_html 樣式與結構）
const pageBlock = (patient: Patient, monthData: HygieneMonthData, facilityName: string): string => {
  const { year, month, recordsByPatient } = monthData;
  const records = recordsByPatient.get(patient.院友id) || [];
  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const age = calculateAge(patient.出生日期);
  const gender = patient.性別 || '';
  const bed = getPrintBedNumber(patient);
  const monthLabel = `${year}年${month.toString().padStart(2, '0')}月`;

  return `
<div class="container">
  <div class="title-section">
    <h1>${facilityName}</h1>
    <h2>個人衛生、清潔及大便記錄</h2>
    <div class="month-label">${monthLabel}</div>
  </div>
  <br>
  <table class="info-table">
    <colgroup>
      <col style="width: 30%;"><col style="width: 22%;"><col style="width: 22%;"><col style="width: 26%;">
    </colgroup>
    <tr>
      <td>院友姓名：<input type="text" class="db-line-input" style="width: 65%;" value="${escapeHtml(patientName)}" readonly></td>
      <td>年齡：<input type="text" class="db-line-input" style="width: 65%;" value="${age}" readonly></td>
      <td>性別：<input type="text" class="db-line-input" style="width: 65%;" value="${escapeHtml(gender)}" readonly></td>
      <td>床號：<input type="text" class="db-line-input" style="width: 65%;" value="${escapeHtml(bed)}" readonly></td>
    </tr>
  </table>

  <table class="main-table">
    <colgroup>
      <col style="width: 3.5%;">
      <col style="width: 4.4%;"><col style="width: 4.4%;"><col style="width: 4.4%;"><col style="width: 4.4%;">
      <col style="width: 4.4%;"><col style="width: 4.4%;"><col style="width: 4.4%;"><col style="width: 4.4%;">
      <col style="width: 4.4%;"><col style="width: 4.4%;"><col style="width: 4.4%;"><col style="width: 4.4%;">
      <col style="width: 4.4%;"><col style="width: 4.4%;"><col style="width: 4.4%;"><col style="width: 4.4%;">
      <col style="width: 14.1%;">
      <col style="width: 12%;">
    </colgroup>
    <thead>
      <tr>
        <th style="font-size: 16px; font-weight: bold; padding: 4px;">日期</th>
        <th class="vertical-th" style="font-size: 16px;">沖涼洗頭</th>
        <th class="vertical-th" style="font-size: 16px;">洗面</th>
        <th class="vertical-th" style="font-size: 16px;">刷牙漱口</th>
        <th class="vertical-th" style="font-size: 16px;">洗口浸假牙</th>
        <th class="vertical-th" style="font-size: 16px;">剪髮</th>
        <th class="vertical-th" style="font-size: 16px;">剃鬚</th>
        <th class="vertical-th" style="font-size: 16px;">剪指甲</th>
        <th class="vertical-th" style="font-size: 16px;">換被套</th>
        <th class="vertical-th" style="font-size: 16px;">換床單枕袋</th>
        <th class="vertical-th" style="font-size: 16px;">洗杯</th>
        <th class="vertical-th" style="font-size: 16px;">整理床頭櫃</th>
        <th class="vertical-th" style="font-size: 16px;">整理衣箱</th>
        <th class="vertical-th" style="font-size: 16px;">#大便次數</th>
        <th class="vertical-th" style="font-size: 16px;">*大便量</th>
        <th class="vertical-th" style="font-size: 16px;">∨大便性質</th>
        <th class="vertical-th" style="font-size: 16px;">+大便藥</th>
        <th style="font-size: 15px; padding: 4px; line-height: 1.2;">備註<br>(如大便有血、<br>潺或黑糞)</th>
        <th style="font-size: 15px; padding: 4px; line-height: 1.2;">職員簽名</th>
      </tr>
    </thead>
    <tbody>
      ${generateDataRows(records, year, month)}
    </tbody>
  </table>

  <div class="legend-section">
    <div>#大便次數：以 "正" 字表示; &gt;大便性質：硬=H &nbsp;軟=S &nbsp;稀/水狀=W</div>
    <div>*大便量：大量"+++"; 中量以"++"; 少量以"+" 表示。</div>
    <div>+按醫囑給予口服大便藥以「★」記錄；按醫囑給予栓劑以「▲」記錄。</div>
  </div>
  <div class="footer">
    <div class="page-num">1</div>
    <div class="doc-code"></div>
  </div>
</div>`;
};

export const generateHygieneRecordPrintFormHtml = (
  patients: Patient[],
  monthsData: HygieneMonthData[],
  facilityName: string
): string => {
  const pages = patients
    .map(p => monthsData.map(m => pageBlock(p, m, facilityName)).join(''))
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>個人衛生、清潔及大便記錄</title>
<style>
  @page { size: A4; margin: 5mm 0.2in; }
  * { box-sizing: border-box; }
  body { font-family: "DFKai-SB", "BiauKai", "標楷體", serif; margin: 0; padding: 0; background-color: #fff; color: #000; line-height: 1.1; }
  .no-print { text-align: center; margin: 10px; }
  .no-print button { padding: 8px 20px; font-size: 12px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
  .container { width: 100%; box-sizing: border-box; page-break-after: always; zoom: 0.9; display: flex; flex-direction: column; min-height: 287mm; }
  .container:last-of-type { page-break-after: auto; }
  .title-section { text-align: center; margin-bottom: 12px; }
  .title-section h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
  .title-section h2 { margin: 4px 0 0 0; font-size: 22px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
  .month-label { margin-top: 2px; font-size: 14px; font-weight: bold; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; }
  .info-table td { border: none; padding: 2px 0; vertical-align: bottom; font-size: 16px; font-weight: bold; white-space: nowrap; }
  .db-line-input { width: 90%; border: none; border-bottom: 1px solid black; background: transparent; font-family: inherit; font-size: 16px; outline: none; padding: 0 0 1px 5px; box-sizing: border-box; }
  table.main-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid black; }
  table.main-table th, table.main-table td { border: 1px solid black; text-align: center; vertical-align: middle; padding: 0; }
  table.main-table th { font-size: 11px; font-weight: bold; background-color: #fff; height: 110px; line-height: 1.1; }
  .vertical-th { writing-mode: vertical-rl; text-orientation: upright; white-space: nowrap; text-align: center; vertical-align: middle; font-size: 14px; font-weight: bold; padding: 10px 0; line-height: 1.0; }
  .data-row { height: 27px; }
  .db-text-cell { width: 100%; height: 25px; border: none; background: transparent; font-family: inherit; font-size: 12px; text-align: center; outline: none; display: block; box-sizing: border-box; }
  .legend-section { margin-top: 6px; font-size: 11px; font-weight: bold; line-height: 1.4; text-align: left; }
  .footer { margin-top: auto; position: relative; height: 30px; display: flex; justify-content: flex-end; }
  .page-num { position: absolute; left: 50%; transform: translateX(-50%); font-size: 24px; font-weight: bold; bottom: 0; }
  .doc-code { font-size: 11px; font-weight: bold; align-self: flex-end; }
  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">列印</button></div>
${pages}
</body>
</html>`;
};

export const printHygieneRecordForm = async (patients: Patient[], monthsData: HygieneMonthData[]): Promise<void> => {
  const settings = await getFacilitySettings();
  const html = generateHygieneRecordPrintFormHtml(patients, monthsData, settings.facilityNameZh);
  const old = document.getElementById('hygiene-printform-iframe');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'hygiene-printform-iframe';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  }
};

/**
 * 依日期範圍為單一院友產生個人衛生記錄表 HTML。
 * 會自動將範圍內的每個月份拆成一頁，並只帶入該院友的記錄。
 */
export const generateHygieneRecordFormForDateRange = (
  patient: Patient,
  records: HygieneRecord[],
  startDate: string,
  endDate: string,
  facilityName: string
): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const monthsData: HygieneMonthData[] = [];

  let y = start.getFullYear();
  let m = start.getMonth() + 1;
  const endY = end.getFullYear();
  const endM = end.getMonth() + 1;

  while (y < endY || (y === endY && m <= endM)) {
    const monthStr = m.toString().padStart(2, '0');
    const prefix = `${y}-${monthStr}-`;
    const monthRecords = records.filter(r => r.record_date.startsWith(prefix));
    const recordsByPatient = new Map<number, HygieneRecord[]>();
    recordsByPatient.set(patient.院友id, monthRecords);
    monthsData.push({ year: y, month: m, recordsByPatient });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return generateHygieneRecordPrintFormHtml([patient], monthsData, facilityName);
};

/**
 * 依日期範圍為單一院友列印個人衛生記錄表。
 */
export const printHygieneRecordFormForDateRange = async (
  patient: Patient,
  records: HygieneRecord[],
  startDate: string,
  endDate: string
): Promise<void> => {
  const settings = await getFacilitySettings();
  const html = generateHygieneRecordFormForDateRange(patient, records, startDate, endDate, settings.facilityNameZh);
  const old = document.getElementById('hygiene-printform-iframe');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'hygiene-printform-iframe';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  }
};
