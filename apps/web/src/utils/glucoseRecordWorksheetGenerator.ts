import { supabase } from '../lib/supabase';
import {
  getFacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
  type FacilitySettings,
} from './facilitySettings';
import { MR_LOGO_DATA_URI } from './medicationRecordLogo';

// ─────────────────────────────────────────────────────────────────────────────
// 院友血糖記錄表（A4 直印）
// 嚴格複刻體溫記錄表版式，惟表頭字眼改為血糖，並將欄位改為 2 組
// 「日期 / 時間 / 血糖 mmol/L / 備註」（共 8 欄），其中「備註」欄寬為其他欄的兩倍。
// 映射關係：每位在住院友的「健康監測記錄（監測類型 = 血糖值）」依日期/時間排序，
// 以欄為主（column-major）由左組到右組、由上而下填入。
// ─────────────────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 32; // 每頁資料列數（不計表頭）
const GROUPS_PER_PAGE = 2; // 每頁「日期/時間/血糖/備註」組數
const CELLS_PER_PAGE = ROWS_PER_PAGE * GROUPS_PER_PAGE; // 每頁可容納的記錄數 = 64
const FOOTER_LABEL = '更新 B26 FK (09/2016)';

interface PatientRow {
  院友id: number;
  中文姓名: string | null;
  床號: string | null;
  性別: string | null;
  出生日期: string | null;
}

interface GlucoseRecord {
  院友id: number;
  記錄日期: string;
  記錄時間: string | null;
  數值: number | null;
  備註: string | null;
}

interface GlucoseCell {
  date: string;
  time: string;
  value: string;
  remark: string;
}

let activeFacility: FacilitySettings = DEFAULT_FACILITY_SETTINGS;

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const escapeAttr = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;');

const calculateAge = (birthDate: string | null): string => {
  if (!birthDate) return '';
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age > 0 ? String(age) : '';
};

const formatGenderAge = (patient: PatientRow): string => {
  const gender = patient.性別 ?? '';
  const age = calculateAge(patient.出生日期);
  if (!gender && !age) return '';
  return age ? `${gender} / ${age}` : gender;
};

// 日期顯示為 YY/M/D（含兩位年份，與紙本手寫風格一致、欄位較窄）
const formatShortDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  return `${yy}/${date.getMonth() + 1}/${date.getDate()}`;
};

// 時間顯示為 HH:MM（截取前 5 字元）
const formatTime = (timeStr: string | null): string => {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
};

const formatGlucose = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

// 取得院友（依床號排序）；提供 patientIds 時僅取指定院友，否則取全部在住院友
const fetchInResidencePatients = async (patientIds?: number[]): Promise<PatientRow[]> => {
  let query = supabase
    .from('院友主表')
    .select('院友id, 中文姓名, 床號, 性別, 出生日期');
  if (patientIds && patientIds.length > 0) {
    query = query.in('院友id', patientIds);
  } else {
    query = query.eq('在住狀態', '在住');
  }
  const { data, error } = await query.order('床號', { ascending: true });
  if (error) {
    console.error('讀取院友失敗:', error);
    throw error;
  }
  return (data ?? []) as PatientRow[];
};

// 取得指定日期範圍內的所有血糖記錄
const fetchGlucoseRecords = async (startDate: string, endDate: string): Promise<GlucoseRecord[]> => {
  const { data, error } = await supabase
    .from('健康監測記錄')
    .select('院友id, 記錄日期, 記錄時間, 數值, 備註')
    .eq('監測類型', '血糖值')
    .gte('記錄日期', startDate)
    .lte('記錄日期', endDate)
    .order('記錄日期', { ascending: true })
    .order('記錄時間', { ascending: true });
  if (error) {
    console.error('讀取血糖記錄失敗:', error);
    throw error;
  }
  return (data ?? []) as GlucoseRecord[];
};

// 將一位院友的血糖記錄轉為儲存格（依日期/時間排序）
const buildCells = (records: GlucoseRecord[]): GlucoseCell[] => {
  const sorted = [...records].sort((a, b) =>
    new Date(`${a.記錄日期} ${a.記錄時間 ?? '00:00'}`).getTime()
    - new Date(`${b.記錄日期} ${b.記錄時間 ?? '00:00'}`).getTime()
  );
  return sorted.map(record => ({
    date: formatShortDate(record.記錄日期),
    time: formatTime(record.記錄時間),
    value: formatGlucose(record.數值),
    remark: record.備註 ?? '',
  }));
};

// 將院友的儲存格切成多頁
const chunkCellsIntoPages = (cells: GlucoseCell[]): GlucoseCell[][] => {
  const pages: GlucoseCell[][] = [];
  if (cells.length === 0) {
    pages.push([]);
    return pages;
  }
  for (let i = 0; i < cells.length; i += CELLS_PER_PAGE) {
    pages.push(cells.slice(i, i + CELLS_PER_PAGE));
  }
  return pages;
};

// 將一頁的記錄以「欄為主」排成 32 列 × 2 組
const buildGrid = (cells: GlucoseCell[]): (GlucoseCell | null)[][] => {
  const grid: (GlucoseCell | null)[][] = Array.from({ length: ROWS_PER_PAGE }, () =>
    Array.from({ length: GROUPS_PER_PAGE }, () => null as GlucoseCell | null)
  );
  cells.forEach((cell, index) => {
    const group = Math.floor(index / ROWS_PER_PAGE); // 0..1
    const row = index % ROWS_PER_PAGE; // 0..31
    if (group < GROUPS_PER_PAGE) {
      grid[row][group] = cell;
    }
  });
  return grid;
};

const renderHeader = (): string => {
  const logo = activeFacility.logoDataUri || MR_LOGO_DATA_URI;
  const nameZh = activeFacility.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;
  const nameEn = activeFacility.facilityNameEn?.trim() || '';
  const logoAlt = nameEn ? `${nameZh} ${nameEn}` : nameZh;
  return `
    <div class="gr-header">
      <div class="gr-side-spacer"></div>
      <div class="gr-title-block">
        <div class="gr-org">${escapeHtml(nameZh)}</div>
        <div class="gr-doc">院友血糖記錄</div>
      </div>
      <div class="gr-logo-block">
        <img class="gr-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(logoAlt)}">
        ${nameEn ? `<div class="gr-logo-text">${escapeHtml(nameEn)}</div>` : ''}
      </div>
    </div>
  `;
};

const renderInfoRow = (patient: PatientRow, pageLabel: string): string => `
  <div class="gr-info">
    <div class="gr-info-item"><span class="gr-info-label">姓名：</span><span class="gr-info-value">${escapeHtml(patient.中文姓名 ?? '')}</span></div>
    <div class="gr-info-item"><span class="gr-info-label">床號：</span><span class="gr-info-value">${escapeHtml(patient.床號 ?? '')}</span></div>
    <div class="gr-info-item"><span class="gr-info-label">性別/年齡：</span><span class="gr-info-value">${escapeHtml(formatGenderAge(patient))}</span></div>
    <div class="gr-info-item"><span class="gr-info-label">頁數：</span><span class="gr-info-value">${escapeHtml(pageLabel)}</span></div>
  </div>
`;

const renderTable = (cells: GlucoseCell[]): string => {
  const grid = buildGrid(cells);
  const headerCells = Array.from({ length: GROUPS_PER_PAGE }, () =>
    '<th class="gr-th-date">日期</th><th class="gr-th-time">時間</th><th class="gr-th-value">血糖 mmol/L</th><th class="gr-th-remark">備註</th>'
  ).join('');
  const bodyRows = grid.map(row => {
    const tds = row.map(cell => {
      const dateText = cell ? escapeHtml(cell.date) : '';
      const timeText = cell ? escapeHtml(cell.time) : '';
      const valueText = cell ? escapeHtml(cell.value) : '';
      const remarkText = cell ? escapeHtml(cell.remark) : '';
      return `<td class="gr-td-date">${dateText}</td><td class="gr-td-time">${timeText}</td><td class="gr-td-value">${valueText}</td><td class="gr-td-remark">${remarkText}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `
    <table class="gr-table">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
};

const renderPage = (patient: PatientRow, cells: GlucoseCell[], pageLabel: string): string => `
  <section class="gr-page">
    ${renderHeader()}
    ${renderInfoRow(patient, pageLabel)}
    ${renderTable(cells)}
    <div class="gr-footer">${escapeHtml(FOOTER_LABEL)}</div>
  </section>
`;

const buildHtml = (pages: string[]): string => `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>院友血糖記錄</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "標楷體", "DFKai-SB", "BiauKai", "KaiTi", "TW-Kai", "AR PL UKai TW", serif;
    color: #000;
  }
  .gr-page {
    width: 190mm;
    min-height: 277mm;
    margin: 0 auto;
    padding: 0;
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }
  .gr-page:last-child { page-break-after: auto; }

  /* 抬頭 */
  .gr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4mm;
  }
  .gr-side-spacer {
    width: 34mm;
    flex-shrink: 0;
  }
  .gr-title-block {
    flex: 1;
    text-align: center;
  }
  .gr-org { font-size: 24pt; font-weight: 700; letter-spacing: 2px; }
  .gr-doc { font-size: 20pt; font-weight: 700; margin-top: 1mm; }
  .gr-logo-block {
    width: 34mm;
    text-align: center;
    flex-shrink: 0;
  }
  .gr-logo { max-width: 30mm; max-height: 16mm; object-fit: contain; }
  .gr-logo-text { font-size: 8pt; font-weight: 700; margin-top: 0.5mm; }

  /* 院友資訊列 */
  .gr-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 4mm;
    margin-bottom: 2.5mm;
    padding: 0 1mm;
    font-size: 11pt;
  }
  .gr-info-item {
    display: flex;
    align-items: baseline;
    white-space: nowrap;
    flex: 1;
  }
  .gr-info-label { font-weight: 600; flex-shrink: 0; }
  .gr-info-value {
    flex: 1;
    border-bottom: 0.3mm solid #000;
    min-width: 14mm;
    padding: 0 1mm;
    min-height: 5mm;
    text-align: center;
  }

  /* 表格 */
  .gr-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .gr-table th, .gr-table td {
    border: 0.3mm solid #000;
    text-align: center;
    vertical-align: middle;
    font-size: 10.5pt;
  }
  /* 每組（日期/時間/血糖/備註）之間加粗分隔線（備註欄為每組最右欄） */
  .gr-th-remark, .gr-td-remark {
    border-right: 0.7mm solid #000;
  }
  /* 表格最左緣加粗，與右側分隔線對稱 */
  .gr-th-date:first-child, .gr-td-date:first-child {
    border-left: 0.7mm solid #000;
  }
  .gr-table th {
    height: 7mm;
    font-weight: 700;
    background: #fff;
  }
  .gr-table td {
    height: 7.2mm;
  }
  /* 欄寬：日期/時間/血糖均寬，備註為兩倍寬 */
  /* 2組×(3+2)=10份；每份=100%/10=10%；均寬欄=10%，備註=20% */
  .gr-th-date, .gr-td-date { width: 10%; }
  .gr-th-time, .gr-td-time { width: 10%; }
  .gr-th-value, .gr-td-value { width: 10%; }
  .gr-th-remark, .gr-td-remark { width: 20%; text-align: left; padding-left: 1mm; }

  /* 頁尾 */
  .gr-footer {
    margin-top: auto;
    padding-top: 2mm;
    text-align: right;
    font-size: 9pt;
  }
</style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;

const openPrintWindow = (html: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    iframe.contentWindow?.addEventListener('load', () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    });
  }
};

/**
 * 產生院友血糖記錄表並開啟列印視窗。
 * @param startDate 起始日期 (YYYY-MM-DD)
 * @param endDate 結束日期 (YYYY-MM-DD)
 */
export const generateGlucoseRecordWorksheet = async (
  startDate: string,
  endDate: string,
  patientIds?: number[]
): Promise<void> => {
  activeFacility = await getFacilitySettings();

  const [patients, records] = await Promise.all([
    fetchInResidencePatients(patientIds),
    fetchGlucoseRecords(startDate, endDate),
  ]);

  // 依院友分組記錄
  const recordsByPatient = new Map<number, GlucoseRecord[]>();
  records.forEach(record => {
    const list = recordsByPatient.get(record.院友id) ?? [];
    list.push(record);
    recordsByPatient.set(record.院友id, list);
  });

  const pagesHtml: string[] = [];
  patients.forEach(patient => {
    const patientRecords = recordsByPatient.get(patient.院友id) ?? [];
    const cells = buildCells(patientRecords);
    const pages = chunkCellsIntoPages(cells);
    pages.forEach((pageCells, index) => {
      const pageLabel = pages.length > 1 ? `${index + 1} / ${pages.length}` : '1';
      pagesHtml.push(renderPage(patient, pageCells, pageLabel));
    });
  });

  const html = buildHtml(pagesHtml);
  openPrintWindow(html);
};
