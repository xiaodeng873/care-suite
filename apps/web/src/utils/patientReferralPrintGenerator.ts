import type { Patient } from '../lib/database';
import type { HospitalEpisode } from './erRecordPrintGenerator';
import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';
import { calcAge } from './cgatFeeHelper';
import { formatDisplayDate } from './dateFormat';

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

const checkbox = (label: string, checked = false) => `
  <label class="cb-item">
    <input type="checkbox" ${checked ? 'checked' : ''} disabled>
    <span>${escapeHtml(label)}</span>
  </label>`;

const inputLine = (width = '100%') => `<input type="text" class="db-line-input" style="width:${width};" readonly>`;

const vitalCell = (label: string, value: string = '') => `
  <div class="vital-cell">
    <span class="vital-label">${escapeHtml(label)}</span>
    <input type="text" class="db-text-cell" value="${escapeHtml(value)}" readonly>
  </div>`;

const sectionHeader = (num: number | string, title: string) => `
  <div class="section-header">
    <span class="section-num">(${num})</span>
    <span class="section-title">${escapeHtml(title)}</span>
  </div>`;

const infoRow = (label: string, value: string = '', width = 'auto') => `
  <div class="info-item" style="width:${width};">
    <span class="info-label">${escapeHtml(label)}</span>
    <input type="text" class="db-line-input" value="${escapeHtml(value)}" readonly>
  </div>`;

const page1 = (patient: Patient, episode: HospitalEpisode, settings: FacilitySettingsInfo): string => {
  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const age = calcAge(patient.出生日期);
  const genderAge = patient.性別 ? `${patient.性別}${age !== null ? ` / ${age}歲` : ''}` : '';
  const bed = patient.床號 || '';
  const idNumber = patient.身份證號碼 || '';
  const birthDate = formatDate(patient.出生日期);
  const contactPhone = patient.通訊電話 || '';
  const hospital = episode.primary_hospital || '';
  const ward = episode.primary_ward || '';
  const hospitalBed = episode.primary_bed_number || '';
  const startDate = formatDate(episode.episode_start_date);
  const events = episode.episode_events || [];
  const admissionEvent = events.find(e => e.event_type === 'admission') || events[0];
  const eventTime = admissionEvent?.event_time || '';
  const eventDate = admissionEvent ? formatDate(admissionEvent.event_date) : startDate;

  const facilityNameEn = settings.facilityNameEn ? ` / ${escapeHtml(settings.facilityNameEn)}` : '';
  const facilityAddressEn = settings.facilityAddressEn ? `<br>${escapeHtml(settings.facilityAddressEn)}` : '';
  const phoneLabel = settings.facilityPhone ? `電話：${escapeHtml(settings.facilityPhone)}` : '';
  const faxLabel = settings.facilityFax ? `傳真：${escapeHtml(settings.facilityFax)}` : '';

  return `
<div class="container">
  <div class="facility-header">
    <div class="facility-name">
      <h1>${escapeHtml(settings.facilityNameZh)}${facilityNameEn}</h1>
    </div>
    <div class="facility-contact">
      <div class="facility-address">${escapeHtml(settings.facilityAddressZh)}${facilityAddressEn}</div>
      <div class="facility-phone-fax">${phoneLabel}　${faxLabel}</div>
    </div>
  </div>

  <div class="title-section">
    <h2>院友送診資料</h2>
    <h3>Patient Referral Form</h3>
  </div>

  <div class="patient-info-box">
    <div class="info-row">
      ${infoRow('院友姓名', patientName, '35%')}
      ${infoRow('房號/床號', bed, '30%')}
      ${infoRow('性別/年齡', genderAge, '35%')}
    </div>
    <div class="info-row">
      ${infoRow('出生日期', birthDate, '35%')}
      ${infoRow('身份證號碼', idNumber, '35%')}
      ${infoRow('院友電話', contactPhone, '30%')}
    </div>
    <div class="info-row">
      ${infoRow('送診醫院', hospital, '40%')}
      ${infoRow('病房/床號', `${ward} ${hospitalBed}`.trim(), '30%')}
      ${infoRow('送診日期/時間', `${eventDate} ${eventTime}`.trim(), '30%')}
    </div>
  </div>

  ${sectionHeader('1', '生命表徵（Vital Signs）')}
  <div class="vital-grid">
    ${vitalCell('時間 Time', eventTime)}
    ${vitalCell('血壓 BP mmHg', '')}
    ${vitalCell('脈搏 Pulse /min', '')}
    ${vitalCell('呼吸 RR /min', '')}
    ${vitalCell('體溫 Temp °C', '')}
    ${vitalCell('血氧 SpO2 %', '')}
    ${vitalCell('血糖 BG mmol/L', '')}
  </div>

  ${sectionHeader('2', '意識、溝通及跌倒風險（Mental Status & Risk')}
  <div class="checkbox-grid">
    ${checkbox('清醒 Alert')}
    ${checkbox('恍惚 Confused')}
    ${checkbox('昏迷 Unconscious')}
    ${checkbox('有溝通問題 Communication Problem')}
    ${checkbox('三個月內曾跌倒 Fall within 3 months')}
    ${checkbox('遊走/離座 Wandering')}
  </div>

  ${sectionHeader('3', '診斷（Diagnosis）')}
  <div class="lined-box" style="height:40px;">${inputLine('100%')}</div>

  ${sectionHeader('4', '藥物或食物過敏歷史（Allergy History）')}
  <div class="allergy-box">
    <div class="checkbox-inline">
      ${checkbox('已知過敏 Known allergy', (patient.藥物敏感 && patient.藥物敏感.length > 0))}
      ${checkbox('無已知過敏 NKDA', !(patient.藥物敏感 && patient.藥物敏感.length > 0))}
    </div>
    <div class="lined-box" style="height:30px;">
      <span class="info-label">詳情：</span>
      ${inputLine('calc(100% - 50px)')}
    </div>
  </div>

  ${sectionHeader('5', '長期服藥（Long-term Medications）')}
  <table class="med-table">
    <thead>
      <tr>
        <th style="width:8%">#</th>
        <th style="width:42%">藥名及劑量</th>
        <th style="width:20%">服法</th>
        <th style="width:15%">頻次</th>
        <th style="width:15%">備註</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>2</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>3</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>4</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>5</td><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>

  ${sectionHeader('6', '飲食及餵食（Diet & Feeding）')}
  <div class="checkbox-grid two-cols">
    ${checkbox('普通膳食 Normal')}
    ${checkbox('碎餐 Soft')}
    ${checkbox('糊餐 Puréed')}
    ${checkbox('流質 Fluid')}
    ${checkbox('鼻胃飼管 NGT')}
    ${checkbox('PEG')}
    ${checkbox('協助餵食 Assisted feeding')}
    ${checkbox('吞嚥困難 Dysphagia')}
  </div>

  <div class="footer">
    <div class="page-num">1</div>
  </div>
</div>`;
};

const page2 = (patient: Patient, episode: HospitalEpisode, settings: FacilitySettingsInfo): string => {
  return `
<div class="container">
  <div class="facility-header compact">
    <div class="facility-name">
      <h1>${escapeHtml(settings.facilityNameZh)}${settings.facilityNameEn ? ` / ${escapeHtml(settings.facilityNameEn)}` : ''}</h1>
    </div>
    <div class="facility-contact">
      <div class="facility-address">${escapeHtml(settings.facilityAddressZh)}${settings.facilityAddressEn ? `<br>${escapeHtml(settings.facilityAddressEn)}` : ''}</div>
      <div class="facility-phone-fax">${settings.facilityPhone ? `電話：${escapeHtml(settings.facilityPhone)}` : ''}　${settings.facilityFax ? `傳真：${escapeHtml(settings.facilityFax)}` : ''}</div>
    </div>
  </div>

  <div class="title-section">
    <h2>院友送診資料（續）</h2>
    <h3>Patient Referral Form (Cont'd)</h3>
  </div>

  ${sectionHeader('7', '護理需要（Nursing Care Needs）')}
  <div class="care-grid">
    <div class="care-block">
      <div class="care-title">失禁 Incontinence</div>
      <div class="checkbox-col">
        ${checkbox('沒有 None')}
        ${checkbox('小便 Urine')}
        ${checkbox('大便 Faecal')}
        ${checkbox('尿片 Diaper')}
      </div>
    </div>
    <div class="care-block">
      <div class="care-title">傷口 Wound</div>
      <div class="checkbox-col">
        ${checkbox('沒有 None')}
        ${checkbox('有，請註明部位')}
      </div>
      <div class="lined-box" style="height:24px;">${inputLine('100%')}</div>
    </div>
    <div class="care-block">
      <div class="care-title">壓瘡 Pressure Sore</div>
      <div class="checkbox-col">
        ${checkbox('沒有 None')}
        ${checkbox('有，請註明部位')}
      </div>
      <div class="lined-box" style="height:24px;">${inputLine('100%')}</div>
    </div>
  </div>

  ${sectionHeader('8', '出入量（Intake & Output）')}
  <div class="io-grid">
    <div class="io-block">
      <div class="io-label">口服/進食量 Oral intake</div>
      <div class="io-row"><span>前一日：</span>${inputLine('100px')}</div>
      <div class="io-row"><span>本日：</span>${inputLine('100px')}</div>
    </div>
    <div class="io-block">
      <div class="io-label">尿量 Urine output</div>
      <div class="io-row"><span>前一日：</span>${inputLine('100px')}</div>
      <div class="io-row"><span>本日：</span>${inputLine('100px')}</div>
    </div>
    <div class="io-block">
      <div class="io-label">大便 Stool</div>
      <div class="io-row"><span>前一日：</span>${inputLine('100px')}</div>
      <div class="io-row"><span>本日：</span>${inputLine('100px')}</div>
    </div>
  </div>

  ${sectionHeader('9', '輔助器具及管道（Aids & Tubes）')}
  <div class="checkbox-grid three-cols">
    ${checkbox('輪椅 Wheelchair')}
    ${checkbox('助行架 Walking frame')}
    ${checkbox('尿喉 Catheter')}
    ${checkbox('氧氣 Oxygen')}
    ${checkbox('氣切 Tracheostomy')}
    ${checkbox('鼻胃管 NGT')}
  </div>

  ${sectionHeader('10', '隔離及感染控制（Infection Control）')}
  <div class="lined-box" style="height:34px;">${inputLine('100%')}</div>

  ${sectionHeader('11', '約束物品（Restraint）')}
  <div class="checkbox-grid two-cols">
    ${checkbox('沒有 None')}
    ${checkbox('有，請註明：')}
  </div>
  <div class="lined-box" style="height:24px;">${inputLine('100%')}</div>

  ${sectionHeader('12', '隨行物品（Items Accompanying Patient）')}
  <div class="checkbox-grid two-cols">
    ${checkbox('身份證明文件 ID')}
    ${checkbox('藥物 Medications')}
    ${checkbox('覆診紙 Follow-up slip')}
    ${checkbox('現金/貴重物品 Cash/Valuables')}
  </div>
  <div class="lined-box" style="height:24px;">${inputLine('100%')}</div>

  ${sectionHeader('13', '其他補充資料（Other Information）')}
  <div class="lined-box" style="height:60px;">${inputLine('100%')}</div>

  <div class="doctor-section">
    <div class="doctor-title">醫院填寫欄（To be completed by medical practitioner）</div>
    <div class="info-row">
      ${infoRow('初步診斷', '', '50%')}
      ${infoRow('處方/治療', '', '50%')}
    </div>
    <div class="info-row">
      ${infoRow('其他指示', '', '100%')}
    </div>
    <div class="info-row">
      ${infoRow('醫院/部門', '', '50%')}
      ${infoRow('聯絡電話', '', '50%')}
    </div>
    <div class="signature-row">
      <div class="sig-item">醫生簽署：<div class="sig-line"></div></div>
      <div class="sig-item">日期/時間：<div class="sig-line"></div></div>
    </div>
  </div>

  <div class="staff-signatures">
    <div class="signature-row">
      <div class="sig-item">職員簽署：<div class="sig-line"></div></div>
      <div class="sig-item">職級：<div class="sig-line"></div></div>
      <div class="sig-item">日期/時間：<div class="sig-line"></div></div>
    </div>
  </div>

  <div class="footer">
    <div class="page-num">2</div>
  </div>
</div>`;
};

interface FacilitySettingsInfo {
  facilityNameZh: string;
  facilityNameEn: string;
  facilityAddressZh: string;
  facilityAddressEn: string;
  facilityPhone: string;
  facilityFax: string;
}

export const generatePatientReferralHtml = (
  patient: Patient,
  episode: HospitalEpisode,
  settings: FacilitySettingsInfo
): string => {
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>院友送診資料 - ${escapeHtml(patient.中文姓名 || '')}</title>
<style>
  @page { size: A4 portrait; margin: 8mm 10mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
    margin: 0;
    padding: 0;
    background-color: #fff;
    color: #000;
    font-size: 11px;
    line-height: 1.2;
  }
  .no-print { text-align: center; margin: 10px; }
  .no-print button { padding: 8px 20px; font-size: 12px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
  .container {
    width: 100%;
    box-sizing: border-box;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    min-height: 275mm;
  }
  .container:last-of-type { page-break-after: auto; }

  .facility-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1.5px solid black;
    padding-bottom: 4px;
    margin-bottom: 6px;
  }
  .facility-header.compact { margin-bottom: 4px; }
  .facility-name h1 {
    margin: 0;
    font-size: 16px;
    font-weight: bold;
  }
  .facility-contact {
    text-align: right;
    font-size: 10px;
    line-height: 1.3;
  }
  .facility-address { font-weight: bold; }
  .facility-phone-fax { margin-top: 2px; }

  .title-section {
    text-align: center;
    margin-bottom: 6px;
  }
  .title-section h2 {
    margin: 0;
    font-size: 20px;
    font-weight: bold;
    display: inline-block;
    border-bottom: 1.5px solid black;
    padding-bottom: 1px;
  }
  .title-section h3 {
    margin: 2px 0 0 0;
    font-size: 12px;
    font-weight: normal;
  }

  .patient-info-box {
    border: 1.5px solid black;
    padding: 5px;
    margin-bottom: 6px;
  }
  .info-row {
    display: flex;
    gap: 10px;
    margin-bottom: 4px;
  }
  .info-row:last-child { margin-bottom: 0; }
  .info-item {
    display: flex;
    align-items: center;
    flex: 1;
  }
  .info-label {
    font-weight: bold;
    white-space: nowrap;
    margin-right: 4px;
  }
  .db-line-input {
    border: none;
    border-bottom: 1px solid black;
    background: transparent;
    font-family: inherit;
    font-size: 11px;
    padding: 0 4px;
    flex: 1;
    outline: none;
    min-width: 40px;
  }
  .db-text-cell {
    width: 100%;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 11px;
    text-align: center;
    outline: none;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #f0f0f0;
    border: 1.5px solid black;
    border-bottom: none;
    padding: 2px 5px;
    margin-top: 5px;
  }
  .section-num {
    font-weight: bold;
    font-size: 12px;
  }
  .section-title {
    font-weight: bold;
    font-size: 12px;
  }

  .vital-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border: 1.5px solid black;
    border-top: none;
  }
  .vital-cell {
    border-right: 1px solid black;
    padding: 3px 2px;
    text-align: center;
  }
  .vital-cell:last-child { border-right: none; }
  .vital-label {
    display: block;
    font-size: 9px;
    margin-bottom: 2px;
  }
  .vital-cell input { height: 16px; }

  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px 8px;
    border: 1.5px solid black;
    border-top: none;
    padding: 4px 5px;
  }
  .checkbox-grid.two-cols { grid-template-columns: repeat(2, 1fr); }
  .checkbox-grid.three-cols { grid-template-columns: repeat(3, 1fr); }
  .cb-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
  }
  .cb-item input { width: 11px; height: 11px; margin: 0; }

  .checkbox-inline {
    display: flex;
    gap: 16px;
    padding: 3px 0;
  }

  .lined-box {
    border: 1.5px solid black;
    border-top: none;
    padding: 2px 4px;
    display: flex;
    align-items: center;
  }

  .med-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1.5px solid black;
    border-top: none;
  }
  .med-table th, .med-table td {
    border: 1px solid black;
    text-align: center;
    vertical-align: middle;
    height: 22px;
    padding: 0;
    font-size: 10px;
  }
  .med-table th { font-weight: bold; background: #fff; }

  .care-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border: 1.5px solid black;
    border-top: none;
  }
  .care-block {
    border-right: 1px solid black;
    padding: 4px 5px;
  }
  .care-block:last-child { border-right: none; }
  .care-title { font-weight: bold; font-size: 10px; margin-bottom: 3px; }
  .checkbox-col { display: flex; flex-direction: column; gap: 2px; }

  .io-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border: 1.5px solid black;
    border-top: none;
  }
  .io-block {
    border-right: 1px solid black;
    padding: 4px 5px;
  }
  .io-block:last-child { border-right: none; }
  .io-label { font-weight: bold; font-size: 10px; margin-bottom: 3px; }
  .io-row { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }

  .doctor-section {
    border: 1.5px solid black;
    padding: 5px;
    margin-top: 6px;
  }
  .doctor-title {
    font-weight: bold;
    font-size: 12px;
    margin-bottom: 4px;
    text-align: center;
  }
  .staff-signatures {
    margin-top: 6px;
  }
  .signature-row {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .sig-item {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }
  .sig-line {
    flex: 1;
    border-bottom: 1px solid black;
    height: 16px;
  }

  .footer {
    margin-top: auto;
    display: flex;
    justify-content: center;
    padding-top: 4px;
  }
  .page-num {
    font-size: 16px;
    font-weight: bold;
  }

  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">列印</button></div>
${page1(patient, episode, settings)}
${page2(patient, episode, settings)}
</body>
</html>`;
};

export const printPatientReferralForm = async (
  patient: Patient,
  episode: HospitalEpisode
): Promise<void> => {
  const settings = await getFacilitySettings();
  const html = generatePatientReferralHtml(patient, episode, {
    facilityNameZh: settings.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh,
    facilityNameEn: settings.facilityNameEn || '',
    facilityAddressZh: settings.facilityAddressZh || '',
    facilityAddressEn: settings.facilityAddressEn || '',
    facilityPhone: settings.facilityPhone || '',
    facilityFax: settings.facilityFax || '',
  });

  const old = document.getElementById('patient-referral-print-iframe');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'patient-referral-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.top = '-1000px';
  iframe.style.left = '-1000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    throw new Error('無法建立列印文件');
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((resolve) => {
    const onLoad = () => {
      iframe.removeEventListener('load', onLoad);
      resolve();
    };
    iframe.addEventListener('load', onLoad);
    if (doc.readyState === 'complete') {
      onLoad();
    }
  });

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
};

export const printPatientReferralForms = async (
  episodes: HospitalEpisode[],
  patients: Patient[]
): Promise<void> => {
  for (const episode of episodes) {
    const patient = patients.find(p => p.院友id === episode.patient_id);
    if (!patient) continue;
    await printPatientReferralForm(patient, episode);
  }
};
