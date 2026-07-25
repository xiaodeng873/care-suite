import type { Patient } from '../lib/database';
import { calcAge } from './cgatFeeHelper';
import { getFacilitySettings } from './facilitySettings';

export interface EpisodeEvent {
  id?: string;
  event_type: 'admission' | 'transfer' | 'discharge' | 'vacation_start' | 'vacation_end';
  event_date: string;
  event_time?: string;
  hospital_name?: string;
  hospital_ward?: string;
  hospital_bed_number?: string;
  remarks?: string;
  event_order?: number;
  vacation_end_type?: string;
}

export interface HospitalEpisode {
  id?: string;
  patient_id?: number;
  episode_start_date?: string;
  episode_end_date?: string;
  primary_hospital?: string;
  primary_ward?: string;
  primary_bed_number?: string;
  remarks?: string;
  episode_events?: EpisodeEvent[];
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
  return d.toLocaleDateString('zh-TW');
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

interface ErRecordRow {
  date: string;
  erHospital: string;
  erReason: string;
  stayHospital: string;
  ward: string;
  bed: string;
  admissionDate: string;
  dischargeDate: string;
  condition: string;
  remarks: string;
}

const generateRowForEpisode = (episode: HospitalEpisode): ErRecordRow => {
  const events = episode?.episode_events && Array.isArray(episode.episode_events) ? episode.episode_events : [];

  if (events.length > 0) {
    const admissionEvent =
      events.find((e) => e.event_type === 'admission' || e.event_type === 'vacation_start') || events[0];
    const dischargeEvent = events.find(
      (e) => e.event_type === 'discharge' || e.event_type === 'vacation_end'
    );

    const admissionDate = formatDate(admissionEvent.event_date);
    const dischargeDate = dischargeEvent ? formatDate(dischargeEvent.event_date) : '';

    return {
      date: admissionDate,
      erHospital: admissionEvent.hospital_name || episode?.primary_hospital || '',
      erReason: '',
      stayHospital: admissionEvent.hospital_name || episode?.primary_hospital || '',
      ward: admissionEvent.hospital_ward || episode?.primary_ward || '',
      bed: admissionEvent.hospital_bed_number || episode?.primary_bed_number || '',
      admissionDate,
      dischargeDate,
      condition: '', // 病況按需求留空
      remarks: episode?.remarks || '',
    };
  }

  const startDate = formatDate(episode?.episode_start_date);
  const endDate = formatDate(episode?.episode_end_date);

  return {
    date: startDate,
    erHospital: episode?.primary_hospital || '',
    erReason: '',
    stayHospital: episode?.primary_hospital || '',
    ward: episode?.primary_ward || '',
    bed: episode?.primary_bed_number || '',
    admissionDate: startDate,
    dischargeDate: endDate,
    condition: '', // 病況按需求留空
    remarks: episode?.remarks || '',
  };
};

const generateTableRows = (rows: ErRecordRow[], totalRows: number): string => {
  let html = '';

  for (let i = 0; i < totalRows; i++) {
    const row = rows[i] || {
      date: '',
      erHospital: '',
      erReason: '',
      stayHospital: '',
      ward: '',
      bed: '',
      admissionDate: '',
      dischargeDate: '',
      condition: '',
      remarks: '',
    };

    html += `<tr>
      <td><input type="text" class="db-text-cell" value="${escapeHtml(row.date)}" readonly></td>
      <td><input type="text" class="db-text-cell" value="${escapeHtml(row.erHospital)}" readonly></td>
      <td><input type="text" class="db-text-cell" value="${escapeHtml(row.erReason)}" readonly></td>
      <td><input type="text" class="db-text-cell" value="${escapeHtml(row.stayHospital)}" readonly></td>
      <td>
        <div class="slash-cell">
          <input type="text" class="db-text-cell" value="${escapeHtml(row.ward)}" readonly>
          <span>/</span>
          <input type="text" class="db-text-cell" value="${escapeHtml(row.bed)}" readonly>
        </div>
      </td>
      <td><input type="text" class="db-text-cell" value="${escapeHtml(row.admissionDate)}" readonly></td>
      <td><input type="text" class="db-text-cell" value="${escapeHtml(row.dischargeDate)}" readonly></td>
      <td><input type="text" class="db-text-cell" value="${escapeHtml(row.condition)}" readonly></td>
      <td><input type="text" class="db-text-cell" value="${escapeHtml(row.remarks)}" readonly></td>
    </tr>`;
  }

  return html;
};

const pageBlock = (
  patient: Patient,
  rows: ErRecordRow[],
  pageIndex: number,
  totalPages: number,
  facilityName: string,
  logoDataUri?: string | null
): string => {
  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const age = calcAge(patient.出生日期);
  const genderAge = patient.性別 ? `${patient.性別}${age !== null ? `/${age}歲` : ''}` : '';
  const bed = patient.床號 || '';

  const logoHtml = logoDataUri
    ? `<div class="logo-box"><img class="logo-img" src="${escapeHtml(logoDataUri)}" alt="Logo"></div>`
    : `<div class="logo-box"><span style="font-size:13px;font-weight:bold;">${escapeHtml(facilityName)}</span></div>`;

  return `<div class="container">
  <div class="header-top">
    <div class="header-spacer"></div>
    <div class="header-center">
      <h1>${escapeHtml(facilityName)}</h1>
      <h2>使用急症室 / 留院記錄</h2>
    </div>
    <div class="header-right">${logoHtml}</div>
  </div>

  <div class="info-row">
    <div class="info-item">院友姓名：<input type="text" class="db-line-input" style="width: 220px;" value="${escapeHtml(patientName)}" readonly></div>
    <div class="info-item">房/床號：<input type="text" class="db-line-input" style="width: 150px;" value="${escapeHtml(bed)}" readonly></div>
    <div class="info-item">性別/年齡：<input type="text" class="db-line-input" style="width: 150px;" value="${escapeHtml(genderAge)}" readonly></div>
  </div>

  <table>
    <colgroup>
      <col class="col-date">
      <col style="width: 120px;">
      <col style="width: 140px;">
      <col style="width: 120px;">
      <col class="col-ward">
      <col class="col-adm">
      <col class="col-dis">
      <col class="col-cond">
      <col class="col-remark">
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2">日期</th>
        <th colspan="2">使用急症室</th>
        <th colspan="5">留院</th>
        <th rowspan="2">備註</th>
      </tr>
      <tr style="height: 30px;">
        <th>醫院</th>
        <th>原因</th>
        <th>醫院</th>
        <th>病房/床號</th>
        <th>入院日期</th>
        <th>出院日期</th>
        <th>病況</th>
      </tr>
    </thead>
    <tbody>
      ${generateTableRows(rows, 12)}
    </tbody>
  </table>

  <div class="footer">
    <div class="page-num-bottom">8</div>
    <div class="doc-code">B5 FK (11.2020)</div>
  </div>
</div>`;
};

const baseCss = `
  @page { size: A4 landscape; margin: 5mm 10mm; }
  body {
    font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
    margin: 0;
    padding: 0;
    background-color: #fff;
    color: #000;
  }
  .container {
    width: 100%;
    box-sizing: border-box;
    page-break-after: always;
    break-after: page;
  }
  .container:last-of-type {
    page-break-after: auto;
  }
  .header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    text-align: center;
    margin-bottom: 10px;
  }
  .header-top .header-spacer { width: 18%; }
  .header-top .header-center { flex: 1; }
  .header-top h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
  .header-top h2 { margin: 4px 0 0 0; font-size: 22px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
  .header-top .header-right { width: 18%; display: flex; align-items: flex-start; justify-content: flex-end; }
  .logo-box { width: 80px; height: 60px; display: flex; align-items: center; justify-content: center; }
  .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .page-num-top { display: none; }
  .info-row {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 8px;
    font-weight: bold;
    font-size: 16px;
  }
  .info-item { margin-right: 30px; }
  .db-line-input {
    border: none;
    border-bottom: 1px solid black;
    background: transparent;
    font-family: inherit;
    font-size: 16px;
    padding: 0 5px;
    min-width: 150px;
    outline: none;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1.5px solid black;
  }
  th, td {
    border: 1px solid black;
    text-align: center;
    vertical-align: middle;
    padding: 0;
    height: 35px;
  }
  th {
    font-size: 15px;
    font-weight: bold;
    background-color: #fff;
  }
  .col-date { width: 85px; }
  .col-ward { width: 100px; }
  .col-adm { width: 85px; }
  .col-dis { width: 85px; }
  .col-cond { width: 130px; }
  .col-remark { width: 130px; }
  .db-text-cell {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 14px;
    text-align: center;
    outline: none;
    display: block;
  }
  .slash-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  .slash-cell span { font-size: 18px; padding: 0 5px; }
  .footer {
    margin-top: 10px;
    display: flex;
    justify-content: flex-end;
    position: relative;
    height: 30px;
  }
  .page-num-bottom {
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
<title>使用急症室 / 留院記錄</title>
<style>${baseCss}</style>
</head>
<body>
${bodyContent}
</body>
</html>`;

export const generateERRecordFormHtml = (patient: Patient, episode: HospitalEpisode, facilityName: string, logoDataUri?: string | null): string => {
  const row = generateRowForEpisode(episode);
  return wrapHtml(pageBlock(patient, [row], 1, 1, facilityName, logoDataUri));
};

export const generateERRecordFormsHtml = (
  episodes: HospitalEpisode[],
  patients: Patient[],
  facilityName: string,
  logoDataUri?: string | null
): string => {
  const ROWS_PER_PAGE = 12;

  // 依院友 ID 分組，同時保留原本勾選的出現順序
  const patientIds: number[] = [];
  const episodesByPatient = new Map<number, HospitalEpisode[]>();

  episodes.forEach((episode) => {
    const pid = episode.patient_id || 0;
    if (!episodesByPatient.has(pid)) {
      episodesByPatient.set(pid, []);
      patientIds.push(pid);
    }
    episodesByPatient.get(pid)!.push(episode);
  });

  const pages: string[] = [];

  patientIds.forEach((pid) => {
    const patient = patients.find((p) => p.院友id === pid);
    if (!patient) return;

    const patientEpisodes = episodesByPatient.get(pid) || [];
    const sortedEpisodes = patientEpisodes.slice().sort((a, b) => {
      const aDate = a.episode_start_date || '';
      const bDate = b.episode_start_date || '';
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    const rows = sortedEpisodes.map((episode) => generateRowForEpisode(episode));
    const pageChunks = chunk(rows, ROWS_PER_PAGE);
    const totalPages = pageChunks.length || 1;

    pageChunks.forEach((pageRows, index) => {
      pages.push(pageBlock(patient, pageRows, index + 1, totalPages, facilityName, logoDataUri));
    });
  });

  return wrapHtml(pages.join('\n'));
};

export const printERRecordForm = async (patient: Patient, episode: HospitalEpisode): Promise<void> => {
  if (!patient || !episode) return;

  const settings = await getFacilitySettings();
  const html = generateERRecordFormHtml(patient, episode, settings.facilityNameZh, settings.logoDataUri);
  printHtmlWithIframe(html, 'er-record-print-iframe');
};

export const printERRecordForms = async (episodes: HospitalEpisode[], patients: Patient[]): Promise<void> => {
  if (!episodes.length || !patients.length) return;

  const settings = await getFacilitySettings();
  const html = generateERRecordFormsHtml(episodes, patients, settings.facilityNameZh, settings.logoDataUri);
  printHtmlWithIframe(html, 'er-record-print-iframe');
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
