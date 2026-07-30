import type { Patient, FollowUpAppointment } from '../lib/database';
import { calcAge } from './cgatFeeHelper';
import { getFacilitySettings } from './facilitySettings';

import { formatDisplayDate } from './dateFormat';
import { getPrintBedNumber } from './bedTransferUtils';

const ROWS_PER_PAGE = 28;
const DOC_CODE = 'B3 FK (11.2020)';

interface FollowUpPrintRow {
  是次日期: string;
  是次時間: string;
  醫院: string;
  專科: string;
  治療: string;
  下次日期: string;
  下次時間: string;
  備註: string;
}

const escapeHtml = (text: string | number | undefined | null): string => {
  if (text == null || text === '') return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
};

const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return formatDisplayDate(d);
};

const formatTime = (timeStr: string | undefined | null): string => {
  if (!timeStr) return '';
  const match = String(timeStr).match(/^(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  return timeStr;
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

const generateRow = (appointment: FollowUpAppointment): FollowUpPrintRow => {
  return {
    是次日期: formatDate(appointment.覆診日期),
    是次時間: formatTime(appointment.覆診時間),
    醫院: appointment.覆診地點 || '',
    專科: appointment.覆診專科 || '',
    治療: '', // Model 沒有對應欄位，按需求留空
    下次日期: '', // Model 沒有對應欄位，按需求留空
    下次時間: '', // Model 沒有對應欄位，按需求留空
    備註: appointment.備註 || '',
  };
};

const generateTableRows = (rows: FollowUpPrintRow[], totalRows: number): string => {
  let html = '';

  for (let i = 0; i < totalRows; i++) {
    const row = rows[i] || {
      是次日期: '',
      是次時間: '',
      醫院: '',
      專科: '',
      治療: '',
      下次日期: '',
      下次時間: '',
      備註: '',
    };

    html += `<tr class="data-row">
      <td><input class="db-text-cell" value="${escapeHtml(row.是次日期)}" readonly></td>
      <td><input class="db-text-cell" value="${escapeHtml(row.是次時間)}" readonly></td>
      <td><input class="db-text-cell left-align" value="${escapeHtml(row.醫院)}" readonly></td>
      <td><input class="db-text-cell left-align" value="${escapeHtml(row.專科)}" readonly></td>
      <td><input class="db-text-cell left-align" value="${escapeHtml(row.治療)}" readonly></td>
      <td><input class="db-text-cell" value="${escapeHtml(row.下次日期)}" readonly></td>
      <td><input class="db-text-cell" value="${escapeHtml(row.下次時間)}" readonly></td>
      <td><input class="db-text-cell left-align" value="${escapeHtml(row.備註)}" readonly></td>
    </tr>`;
  }

  return html;
};

const pageBlock = (
  patient: Patient,
  rows: FollowUpPrintRow[],
  pageIndex: number,
  totalPages: number,
  facilityName: string
): string => {
  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const age = calcAge(patient.出生日期);
  const genderAge = patient.性別 ? `${patient.性別}${age !== null ? `/${age}歲` : ''}` : '';
  const bed = getPrintBedNumber(patient);
  const pageNumberText = totalPages > 1 ? `${pageIndex} / ${totalPages}` : `${pageIndex}`;

  return `<div class="container">
  <div class="title-section">
    <div class="header-center">
      <h1>${facilityName}</h1>
      <h2>院友覆診記錄表</h2>
    </div>
  </div>

  <table class="info-table">
    <colgroup>
      <col style="width: 85px;">
      <col style="width: auto;">
      <col style="width: 60px;">
      <col style="width: 100px;">
      <col style="width: 95px;">
      <col style="width: 150px;">
    </colgroup>
    <tr>
      <td>院友姓名：</td>
      <td><input type="text" class="db-line-input" value="${escapeHtml(patientName)}" readonly></td>
      <td style="padding-left: 10px;">床號：</td>
      <td><input type="text" class="db-line-input" value="${escapeHtml(bed)}" readonly></td>
      <td style="padding-left: 1px;">性別/年齡：</td>
      <td><input type="text" class="db-line-input" value="${escapeHtml(genderAge)}" readonly></td>
    </tr>
  </table>

  <table class="main-table">
    <colgroup>
      <col class="col-date">
      <col class="col-time">
      <col class="col-hosp">
      <col class="col-spec">
      <col class="col-treat">
      <col class="col-date">
      <col class="col-time">
      <col class="col-remark">
    </colgroup>
    <thead>
      <tr>
        <th colspan="2">是次覆診</th>
        <th rowspan="2">醫院/診所</th>
        <th rowspan="2">專科</th>
        <th rowspan="2">治療</th>
        <th colspan="2">下次覆診</th>
        <th rowspan="2">備註</th>
      </tr>
      <tr>
        <th>日期</th>
        <th>時間</th>
        <th>日期</th>
        <th>時間</th>
      </tr>
    </thead>
    <tbody>
      ${generateTableRows(rows, ROWS_PER_PAGE)}
    </tbody>
  </table>

  <div class="footer">
    <div class="page-num">9</div>
    <div class="doc-code">${DOC_CODE}</div>
  </div>
</div>`;
};

const baseCss = `
  @page { size: A4; margin: 5mm 0.25in; }
  * { box-sizing: border-box; }
  body {
    font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
    margin: 0;
    padding: 0;
    background-color: #fff;
    color: #000;
    line-height: 1.2;
  }
  .container {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 287mm;
    page-break-after: always;
    break-after: page;
  }
  .container:last-of-type {
    page-break-after: auto;
  }
  .title-section {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    margin-bottom: 12px;
  }
  .header-center { flex: 1; text-align: center; }
  .header-center h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
  .header-center h2 {
    margin: 4px 0 0 0;
    font-size: 22px;
    font-weight: bold;
    display: inline-block;
    border-bottom: 1.5px solid black;
    padding-bottom: 2px;
  }
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    table-layout: fixed;
  }
  .info-table td {
    border: none;
    padding: 2px 0;
    vertical-align: bottom;
    font-size: 16px;
    font-weight: bold;
  }
  .db-line-input {
    width: 100%;
    border: none;
    border-bottom: 1px solid black;
    background: transparent;
    font-family: inherit;
    font-size: 16px;
    outline: none;
    padding: 0 0 1px 5px;
    box-sizing: border-box;
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
    height: 22px;
    background-color: #fff;
  }
  .col-date { width: 9%; }
  .col-time { width: 7%; }
  .col-hosp { width: 15%; }
  .col-spec { width: 12%; }
  .col-treat { width: 20%; }
  .col-remark { width: auto; }
  .data-row { height: 32px; }
  .db-text-cell {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    text-align: center;
    outline: none;
    display: block;
    box-sizing: border-box;
  }
  .left-align { text-align: left; padding-left: 4px; }
  .footer {
    margin-top: auto;
    display: flex;
    justify-content: flex-end;
    position: relative;
    height: 30px;
  }
  .page-num {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 24px;
    font-weight: bold;
    bottom: 0;
  }
  .doc-code { font-size: 11px; font-weight: bold; align-self: flex-end; }
`;

const wrapHtml = (bodyContent: string): string => `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>院友覆診記錄表</title>
<style>${baseCss}</style>
</head>
<body>
${bodyContent}
</body>
</html>`;

export const generateFollowUpRecordFormHtml = (
  patient: Patient,
  appointment: FollowUpAppointment,
  facilityName: string
): string => {
  const row = generateRow(appointment);
  return wrapHtml(pageBlock(patient, [row], 1, 1, facilityName));
};

export const generateFollowUpRecordFormsHtml = (
  appointments: FollowUpAppointment[],
  patients: Patient[],
  facilityName: string
): string => {
  // 依院友 ID 分組，同時保留原本勾選的出現順序
  const patientIds: number[] = [];
  const appointmentsByPatient = new Map<number, FollowUpAppointment[]>();

  appointments.forEach((appointment) => {
    const pid = appointment.院友id;
    if (!appointmentsByPatient.has(pid)) {
      appointmentsByPatient.set(pid, []);
      patientIds.push(pid);
    }
    appointmentsByPatient.get(pid)!.push(appointment);
  });

  const pages: string[] = [];

  patientIds.forEach((pid) => {
    const patient = patients.find((p) => p.院友id === pid);
    if (!patient) return;

    const patientAppointments = appointmentsByPatient.get(pid) || [];
    const sortedAppointments = patientAppointments.slice().sort((a, b) => {
      const aDate = a.覆診日期 || '';
      const bDate = b.覆診日期 || '';
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    const rows = sortedAppointments.map((appointment) => generateRow(appointment));
    const pageChunks = rows.length > 0 ? chunk(rows, ROWS_PER_PAGE) : [[]];
    const totalPages = pageChunks.length;

    pageChunks.forEach((pageRows, index) => {
      pages.push(pageBlock(patient, pageRows, index + 1, totalPages, facilityName));
    });
  });

  return wrapHtml(pages.join('\n'));
};

export const printFollowUpRecordForm = async (
  patient: Patient,
  appointment: FollowUpAppointment
): Promise<void> => {
  if (!patient || !appointment) return;

  const settings = await getFacilitySettings();
  const html = generateFollowUpRecordFormHtml(patient, appointment, settings.facilityNameZh);
  printHtmlWithIframe(html, 'follow-up-record-print-iframe');
};

export const printFollowUpRecordForms = async (
  appointments: FollowUpAppointment[],
  patients: Patient[]
): Promise<void> => {
  if (!appointments.length || !patients.length) return;

  const settings = await getFacilitySettings();
  const html = generateFollowUpRecordFormsHtml(appointments, patients, settings.facilityNameZh);
  printHtmlWithIframe(html, 'follow-up-record-print-iframe');
};

const printHtmlWithIframe = (html: string, iframeId: string): void => {
  const old = document.getElementById(iframeId);
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = iframeId;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };
};
