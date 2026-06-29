import { supabase } from '../lib/supabase';
import {
  getFacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
  type FacilitySettings,
} from './facilitySettings';
import { MR_LOGO_DATA_URI } from './medicationRecordLogo';

// ─────────────────────────────────────────────────────────────────────────────
// 院友體溫記錄表（A4 直印）
// 嚴格複刻紙本表格：5 組「日期 / 體溫 C°」欄位 × 30 列，含院舍抬頭與頁尾編號。
// 映射關係：每位在住院友的「健康監測記錄（監測類型 = 體溫）」依日期/時間排序，
// 以欄為主（column-major）由左組到右組、由上而下填入日期與數值。
// ─────────────────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 32; // 每頁資料列數（不計表頭）
const PAIRS_PER_PAGE = 5; // 每頁「日期/體溫」組數
const CELLS_PER_PAGE = ROWS_PER_PAGE * PAIRS_PER_PAGE; // 每頁可容納的記錄數 = 160
const FOOTER_LABEL = '更新 B26 FK (09/2016)';

interface PatientRow {
  院友id: number;
  中文姓名: string | null;
  床號: string | null;
  性別: string | null;
  出生日期: string | null;
}

interface TempRecord {
  院友id: number;
  記錄日期: string;
  記錄時間: string | null;
  數值: number | null;
}

interface TempCell {
  date: string;
  value: string;
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

const formatTemperature = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '';
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
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

// 取得指定日期範圍內的所有體溫記錄
const fetchTemperatureRecords = async (startDate: string, endDate: string): Promise<TempRecord[]> => {
  const { data, error } = await supabase
    .from('健康監測記錄')
    .select('院友id, 記錄日期, 記錄時間, 數值')
    .eq('監測類型', '體溫')
    .gte('記錄日期', startDate)
    .lte('記錄日期', endDate)
    .order('記錄日期', { ascending: true })
    .order('記錄時間', { ascending: true });
  if (error) {
    console.error('讀取體溫記錄失敗:', error);
    throw error;
  }
  return (data ?? []) as TempRecord[];
};

// 將院友的體溫記錄切成多頁（每頁最多 150 筆）
const chunkRecordsIntoPages = (records: TempRecord[]): TempCell[][] => {
  const cells: TempCell[] = records.map(r => ({
    date: formatShortDate(r.記錄日期),
    value: formatTemperature(r.數值),
  }));
  const pages: TempCell[][] = [];
  if (cells.length === 0) {
    // 沒有記錄的院友仍輸出一張空白表
    pages.push([]);
    return pages;
  }
  for (let i = 0; i < cells.length; i += CELLS_PER_PAGE) {
    pages.push(cells.slice(i, i + CELLS_PER_PAGE));
  }
  return pages;
};

// 將一頁的記錄以「欄為主」排成 30 列 × 5 組
const buildGrid = (cells: TempCell[]): (TempCell | null)[][] => {
  const grid: (TempCell | null)[][] = Array.from({ length: ROWS_PER_PAGE }, () =>
    Array.from({ length: PAIRS_PER_PAGE }, () => null as TempCell | null)
  );
  cells.forEach((cell, index) => {
    const pair = Math.floor(index / ROWS_PER_PAGE); // 0..4
    const row = index % ROWS_PER_PAGE; // 0..29
    if (pair < PAIRS_PER_PAGE) {
      grid[row][pair] = cell;
    }
  });
  return grid;
};

const renderHeader = (): string => {
  const logo = activeFacility.logoDataUri || MR_LOGO_DATA_URI;
  const nameZh = activeFacility.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;
  const nameEn = activeFacility.facilityNameEn || DEFAULT_FACILITY_SETTINGS.facilityNameEn;
  const logoAlt = `${nameZh} ${nameEn}`.trim();
  return `
    <div class="tr-header">
      <div class="tr-side-spacer"></div>
      <div class="tr-title-block">
        <div class="tr-org">${escapeHtml(nameZh)}</div>
        <div class="tr-doc">院友體溫記錄</div>
      </div>
      <div class="tr-logo-block">
        <img class="tr-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(logoAlt)}">
        <div class="tr-logo-text">${escapeHtml(nameEn)}</div>
      </div>
    </div>
  `;
};

const renderInfoRow = (patient: PatientRow, pageLabel: string): string => `
  <div class="tr-info">
    <div class="tr-info-item"><span class="tr-info-label">姓名：</span><span class="tr-info-value">${escapeHtml(patient.中文姓名 ?? '')}</span></div>
    <div class="tr-info-item"><span class="tr-info-label">床號：</span><span class="tr-info-value">${escapeHtml(patient.床號 ?? '')}</span></div>
    <div class="tr-info-item"><span class="tr-info-label">性別/年齡：</span><span class="tr-info-value">${escapeHtml(formatGenderAge(patient))}</span></div>
    <div class="tr-info-item"><span class="tr-info-label">頁數：</span><span class="tr-info-value">${escapeHtml(pageLabel)}</span></div>
  </div>
`;

const renderTable = (cells: TempCell[]): string => {
  const grid = buildGrid(cells);
  const headerCells = Array.from({ length: PAIRS_PER_PAGE }, () =>
    '<th class="tr-th-date">日期</th><th class="tr-th-temp">體溫 C°</th>'
  ).join('');
  const bodyRows = grid.map(row => {
    const tds = row.map(cell => {
      const dateText = cell ? escapeHtml(cell.date) : '';
      const valueText = cell ? escapeHtml(cell.value) : '';
      return `<td class="tr-td-date">${dateText}</td><td class="tr-td-temp">${valueText}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `
    <table class="tr-table">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
};

const renderPage = (patient: PatientRow, cells: TempCell[], pageLabel: string): string => `
  <section class="tr-page">
    ${renderHeader()}
    ${renderInfoRow(patient, pageLabel)}
    ${renderTable(cells)}
    <div class="tr-footer">${escapeHtml(FOOTER_LABEL)}</div>
  </section>
`;

const buildHtml = (pages: string[]): string => `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>院友體溫記錄</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "標楷體", "DFKai-SB", "BiauKai", "KaiTi", "TW-Kai", "AR PL UKai TW", serif;
    color: #000;
  }
  .tr-page {
    width: 190mm;
    min-height: 277mm;
    margin: 0 auto;
    padding: 0;
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }
  .tr-page:last-child { page-break-after: auto; }

  /* 抬頭 */
  .tr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4mm;
  }
  .tr-side-spacer {
    width: 34mm;
    flex-shrink: 0;
  }
  .tr-title-block {
    flex: 1;
    text-align: center;
  }
  .tr-org { font-size: 24pt; font-weight: 700; letter-spacing: 2px; }
  .tr-doc { font-size: 20pt; font-weight: 700; margin-top: 1mm; }
  .tr-logo-block {
    width: 34mm;
    text-align: center;
    flex-shrink: 0;
  }
  .tr-logo { max-width: 30mm; max-height: 16mm; object-fit: contain; }
  .tr-logo-text { font-size: 8pt; font-weight: 700; margin-top: 0.5mm; }

  /* 院友資訊列 */
  .tr-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 4mm;
    margin-bottom: 2.5mm;
    padding: 0 1mm;
    font-size: 11pt;
  }
  .tr-info-item {
    display: flex;
    align-items: baseline;
    white-space: nowrap;
    flex: 1;
  }
  .tr-info-label { font-weight: 600; flex-shrink: 0; }
  .tr-info-value {
    flex: 1;
    border-bottom: 0.3mm solid #000;
    min-width: 14mm;
    padding: 0 1mm;
    min-height: 5mm;
    text-align: center;
  }

  /* 表格 */
  .tr-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .tr-table th, .tr-table td {
    border: 0.3mm solid #000;
    text-align: center;
    vertical-align: middle;
    font-size: 10.5pt;
  }
  /* 每一對「日期+體溫」之間加粗分隔線（體溫欄為每對最右欄） */
  .tr-th-temp, .tr-td-temp {
    border-right: 0.7mm solid #000;
  }
  /* 表格最左緣加粗，與右側分隔線對稱 */
  .tr-th-date:first-child, .tr-td-date:first-child {
    border-left: 0.7mm solid #000;
  }
  .tr-table th {
    height: 7mm;
    font-weight: 700;
    background: #fff;
  }
  .tr-table td {
    height: 7.2mm;
  }
  .tr-th-date, .tr-td-date { width: 11%; }
  .tr-th-temp, .tr-td-temp { width: 9%; }

  /* 頁尾 */
  .tr-footer {
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
 * 產生院友體溫記錄表並開啟列印視窗。
 * @param startDate 起始日期 (YYYY-MM-DD)
 * @param endDate 結束日期 (YYYY-MM-DD)
 */
export const generateTemperatureRecordWorksheet = async (
  startDate: string,
  endDate: string,
  patientIds?: number[]
): Promise<void> => {
  activeFacility = await getFacilitySettings();

  const [patients, records] = await Promise.all([
    fetchInResidencePatients(patientIds),
    fetchTemperatureRecords(startDate, endDate),
  ]);

  // 依院友分組記錄
  const recordsByPatient = new Map<number, TempRecord[]>();
  records.forEach(record => {
    const list = recordsByPatient.get(record.院友id) ?? [];
    list.push(record);
    recordsByPatient.set(record.院友id, list);
  });

  const pagesHtml: string[] = [];
  patients.forEach(patient => {
    const patientRecords = recordsByPatient.get(patient.院友id) ?? [];
    const pages = chunkRecordsIntoPages(patientRecords);
    pages.forEach((cells, index) => {
      const pageLabel = pages.length > 1 ? `${index + 1} / ${pages.length}` : '1';
      pagesHtml.push(renderPage(patient, cells, pageLabel));
    });
  });

  const html = buildHtml(pagesHtml);
  openPrintWindow(html);
};
