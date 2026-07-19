/**
 * 院友健康教育 / 活動記錄表 列印表格 (iframe HTML 版)
 * 複刻 doc_html/院友健康教育 活動記錄表.html 的版面、CSS 與 19 欄表格結構，
 * 並映射 patient_activity_records 資料表的真實紀錄至對應日期列。
 *
 * 每位院友依日期範圍列出所有記錄，每頁最多 ROWS_PER_PAGE 列，
 * 超頁時標題/院友資料列/表頭與頁尾(頁碼/文件編號)於每頁重複。
 */
import type { Patient, PatientActivityRecord } from '../lib/database';
import { ACTIVITY_BOOLEAN_FIELDS } from './activityRecordStatus';
import { getFacilitySettings } from './facilitySettings';
import { MR_LOGO_DATA_URI } from './medicationRecordLogo';

const ROWS_PER_PAGE = 20;
const DOC_CODE = 'A19D FK (11.2020)';

// 16 個勾選欄位的直排表頭文字，順序須與 doc_html 一致
const CHECKBOX_HEADERS = [
  '生日會', '節日慶祝', '表演節目',
  '旅行', '參觀', '購物／飲茶', '遊戲',
  '(A)興趣小組', '(B)學習小組',
  '(C)自理活動訓練', '(D)個別興趣', '(E)個別輔導', '(F)個人治療訓練', '(G)團體探訪',
];

const escapeHtml = (text: string): string => {
  if (!text) return '';
  const map: { [key: string]: string } = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
};

const formatDateShort = (dateStr: string): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
};

const generateDataRows = (records: PatientActivityRecord[]): string => {
  return records.map(record => {
    let cells = `<td><input class="db-text-cell" value="${formatDateShort(record.record_date)}" readonly></td>`;
    ACTIVITY_BOOLEAN_FIELDS.forEach(field => {
      const checked = !record.is_absent && !!(record as Record<ActivityBooleanField, boolean>)[field];
      cells += `<td><input type="checkbox" class="db-checkbox" ${checked ? 'checked' : ''} disabled></td>`;
    });
    const otherText = record.is_absent ? '' : escapeHtml(record.other_activity || '');
    cells += `<td><textarea class="db-textarea" readonly>${otherText}</textarea></td>`;
    const notesText = record.is_absent
      ? `無法參加: ${escapeHtml(record.absence_reason || '住院/外出')}${record.notes ? ' / ' + escapeHtml(record.notes) : ''}`
      : escapeHtml(record.notes || '');
    cells += `<td><textarea class="db-textarea" readonly>${notesText}</textarea></td>`;
    return `<tr style="height: 34px;">${cells}</tr>`;
  }).join('');
};

// 產生單一頁的整頁 HTML（完全複刻 doc_html 樣式與結構）
const pageBlock = (patient: Patient, pageRecords: PatientActivityRecord[], pageIndex: number, totalPages: number, logoDataUri: string, facilityName: string): string => {
  const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const bed = patient.床號 || '';
  const idNumber = patient.身份證號碼 || '';

  return `
<div class="container">
  <div class="title-section">
    <div class="header-spacer"></div>
    <div class="header-center">
      <h1>${facilityName}</h1>
      <h2>院友健康教育 / 活動記錄表</h2>
    </div>
    <div class="header-right"><img class="logo-img" src="${logoDataUri}" alt="Logo"></div>
  </div>
  <br>
  <div class="user-info">
    <div>院友姓名：<input type="text" class="db-line-input" style="width: 140px;" value="${escapeHtml(patientName)}" readonly></div>
    <div>床號：<input type="text" class="db-line-input" style="width: 80px;" value="${escapeHtml(bed)}" readonly></div>
    <div>身份證號碼：<input type="text" class="db-line-input" style="width: 160px;" value="${escapeHtml(idNumber)}" readonly></div>
  </div>
  <br>
  <table>
    <colgroup>
      <col style="width: 55px;">
      <col style="width: 30px;" span="14">
      <col style="width: 30px;" span="2">
      <col style="width: 45px;">
      <col style="width: auto;">
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2">#請在適用<br>地方√<br><br>日期/時期</th>
        <th colspan="3">集體活動</th>
        <th colspan="4">戶外集體活動</th>
        <th colspan="2">小組活動<br>(請註明人數)</th>
        <th colspan="5">個人活動</th>
        <th rowspan="2"><div class="vertical-text">運動</div></th>
        <th rowspan="2"><div class="vertical-text">健康教育講座</div></th>
        <th rowspan="2"><div class="vertical-text">其他</div></th>
        <th rowspan="2">備註 /<br>註明活動<br>名稱及次數</th>
      </tr>
      <tr>
        ${CHECKBOX_HEADERS.map(label => `<th><div class="vertical-text">${label}</div></th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${generateDataRows(pageRecords)}
    </tbody>
  </table>

  <div class="notes-section">
    <div class="notes-heading">註釋：</div>
    <div class="note-item"><span class="note-label">(A)</span><span>興趣小組：集合 2-8 位院友一同參與一類興趣活動，如象棋、編織、縫紉、栽種、唱歌、閱報等... ...</span></div>
    <div class="note-item"><span class="note-label">(B)</span><span>學習小組：2-8 位院友一同學習、如寫字、識字、現實認知等... ...</span></div>
    <div class="note-item"><span class="note-label">(C)</span><span>自理活動訓練：由員工有目標地安排給院友做一些有別於日常自理習慣的訓練；在員工看護及鼓勵下讓院友練習如進食、梳洗、穿衣服、如廁、沖涼、摺衣服、執拾床舖等... ...</span></div>
    <div class="note-item"><span class="note-label">(D)</span><span>個別興趣：院友獨自進行的活動，如書法、聽歌、閱讀等... ...</span></div>
    <div class="note-item"><span class="note-label">(E)</span><span>個別輔導：員工與院友單對單傾談</span></div>
    <div class="note-item"><span class="note-label">(F)</span><span>個人治療訓練：包括醫護人員指導的訓練，個人感官刺激訓練等......</span></div>
    <div class="note-item"><span class="note-label">(G)</span><span>團體探訪：團體包括教會、義工等，與院友個別傾談</span></div>
  </div>

  <div class="footer">
    <div class="page-num">${pageIndex + 1}${totalPages > 1 ? ` / ${totalPages}` : ''}</div>
    <div class="doc-code">${DOC_CODE}</div>
  </div>
</div>`;
};

export const generateActivityRecordPrintFormHtml = (
  patients: Patient[],
  recordsByPatient: Map<number, PatientActivityRecord[]>,
  logoDataUri: string,
  facilityName: string
): string => {
  // 先攤平所有頁面，讓頁碼跨院友連續遞增
  const allPages: { patient: Patient; pageRecords: PatientActivityRecord[] }[] = [];
  patients.forEach(patient => {
    const records = (recordsByPatient.get(patient.院友id) || [])
      .slice()
      .sort((a, b) => new Date(a.record_date).getTime() - new Date(b.record_date).getTime());
    const pageChunks = records.length > 0 ? chunk(records, ROWS_PER_PAGE) : [[]];
    pageChunks.forEach(pageRecords => allPages.push({ patient, pageRecords }));
  });

  const totalPages = allPages.length;
  const pages = allPages.map((page, idx) => pageBlock(page.patient, page.pageRecords, idx, totalPages, logoDataUri, facilityName)).join('');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>院友健康教育 / 活動記錄表</title>
<style>
  @page { size: A4; margin: 5mm 0.25in; }
  * { box-sizing: border-box; }
  body { font-family: "DFKai-SB", "BiauKai", "標楷體", serif; margin: 0; padding: 0; background-color: #fff; color: #000; line-height: 1.1; }
  .no-print { text-align: center; margin: 10px; }
  .no-print button { padding: 8px 20px; font-size: 12px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
  .container { width: 100%; box-sizing: border-box; page-break-after: always; }
  .container:last-of-type { page-break-after: auto; }
  .title-section { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 5px; }
  .header-spacer { width: 18%; }
  .header-center { flex: 1; text-align: center; }
  .header-right { width: 18%; display: flex; align-items: flex-start; justify-content: flex-end; }
  .logo-img { max-height: 50px; max-width: 100%; object-fit: contain; }
  .title-section h1 { margin: 0; font-size: 22px; font-weight: bold; }
  .title-section h2 { margin: 0; font-size: 18px; font-weight: bold; }
  .user-info { display: flex; justify-content: space-between; margin-bottom: 2px; font-weight: bold; font-size: 14px; }
  .db-line-input { border: none; border-bottom: 1px solid black; background: transparent; font-family: inherit; font-size: 14px; padding: 0 5px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid black; }
  th, td { border: 1px solid black; text-align: center; vertical-align: middle; padding: 0; }
  th { font-size: 10px; font-weight: bold; background-color: #fff; }
  .vertical-text { writing-mode: vertical-rl; text-orientation: mixed; height: 95px; display: flex; align-items: center; justify-content: center; line-height: 1; margin: 0 auto; letter-spacing: 0px; }
  .db-checkbox { width: 13px; height: 13px; cursor: default; margin: 0; }
  .db-text-cell { width: 100%; height: 100%; border: none; background: transparent; font-family: inherit; font-size: 11px; text-align: center; outline: none; }
  .db-textarea { width: 100%; height: 100%; border: none; background: transparent; font-family: inherit; font-size: 10px; resize: none; overflow: hidden; display: block; padding: 2px; box-sizing: border-box; line-height: 1.2; }
  .notes-section { font-size: 11px; margin-top: 8px; line-height: 1.3; }
  .notes-heading { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
  .note-item { display: flex; margin-bottom: 1px; }
  .note-label { font-weight: bold; min-width: 25px; }
  .footer { margin-top: 5px; display: flex; justify-content: space-between; align-items: flex-end; font-weight: bold; }
  .page-num { flex: 1; text-align: center; font-size: 18px; }
  .doc-code { font-size: 10px; }
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

export const printActivityRecordForm = async (
  patients: Patient[],
  recordsByPatient: Map<number, PatientActivityRecord[]>
): Promise<void> => {
  const settings = await getFacilitySettings();
  const logoDataUri = settings.logoDataUri || MR_LOGO_DATA_URI;
  const html = generateActivityRecordPrintFormHtml(patients, recordsByPatient, logoDataUri, settings.facilityNameZh);
  const old = document.getElementById('activity-record-printform-iframe');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'activity-record-printform-iframe';
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
