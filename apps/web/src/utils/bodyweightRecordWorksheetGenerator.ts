import { supabase } from '../lib/supabase';
import {
  getFacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
  type FacilitySettings,
} from './facilitySettings';
import { MR_LOGO_DATA_URI } from './medicationRecordLogo';

// ─────────────────────────────────────────────────────────────────────────────
// 院友體重記錄表（A4 直印）
// 嚴格複刻體溫記錄表版式，惟表頭字眼改為體重，並將欄位改為 2 組
// 「日期 / 體重 Kg / 比較上次 / 跟進行動」（共 8 欄），其中「跟進行動」欄寬為其他欄的兩倍。
// 「比較上次」= 該筆體重與上一筆記錄比較的增/減百分比（沿用體重控制的計算邏輯）。
// 映射關係：每位在住院友的「健康監測記錄（監測類型 = 體重）」依日期/時間排序，
// 以欄為主（column-major）由左組到右組、由上而下填入。
// ─────────────────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 32; // 每頁資料列數（不計表頭）
const GROUPS_PER_PAGE = 2; // 每頁「日期/體重/比較上次/跟進行動」組數
const CELLS_PER_PAGE = ROWS_PER_PAGE * GROUPS_PER_PAGE; // 每頁可容納的記錄數 = 64
const FOOTER_LABEL = '更新 B26 FK (09/2016)';

interface PatientRow {
  院友id: number;
  中文姓名: string | null;
  床號: string | null;
  性別: string | null;
  出生日期: string | null;
}

interface WeightRecord {
  院友id: number;
  記錄日期: string;
  記錄時間: string | null;
  數值: number | null;
}

interface WeightCell {
  date: string;
  weight: string;
  compare: string;
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

const formatWeight = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

// 沿用體重控制的比較邏輯：與上一筆記錄比較的增/減百分比
const formatCompare = (current: number | null, previous: number | null): string => {
  if (current == null || Number.isNaN(current)) return '';
  if (previous == null || Number.isNaN(previous) || previous === 0) return '—';
  const difference = current - previous;
  if (difference === 0) return '無變化';
  const percentage = (difference / previous) * 100;
  const sign = difference > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
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

// 取得指定日期範圍內的所有體重記錄
const fetchWeightRecords = async (startDate: string, endDate: string): Promise<WeightRecord[]> => {
  const { data, error } = await supabase
    .from('健康監測記錄')
    .select('院友id, 記錄日期, 記錄時間, 數值')
    .eq('監測類型', '體重')
    .gte('記錄日期', startDate)
    .lte('記錄日期', endDate)
    .order('記錄日期', { ascending: true })
    .order('記錄時間', { ascending: true });
  if (error) {
    console.error('讀取體重記錄失敗:', error);
    throw error;
  }
  return (data ?? []) as WeightRecord[];
};

// 將一位院友的體重記錄轉為含「比較上次」的儲存格（依日期/時間排序）
const buildCells = (records: WeightRecord[]): WeightCell[] => {
  const sorted = [...records].sort((a, b) =>
    new Date(`${a.記錄日期} ${a.記錄時間 ?? '00:00'}`).getTime()
    - new Date(`${b.記錄日期} ${b.記錄時間 ?? '00:00'}`).getTime()
  );
  return sorted.map((record, index) => ({
    date: formatShortDate(record.記錄日期),
    weight: formatWeight(record.數值),
    compare: formatCompare(record.數值, index > 0 ? sorted[index - 1].數值 : null),
  }));
};

// 將院友的儲存格切成多頁
const chunkCellsIntoPages = (cells: WeightCell[]): WeightCell[][] => {
  const pages: WeightCell[][] = [];
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

// 將一頁的記錄以「欄為主」排成 32 列 × 2 組
const buildGrid = (cells: WeightCell[]): (WeightCell | null)[][] => {
  const grid: (WeightCell | null)[][] = Array.from({ length: ROWS_PER_PAGE }, () =>
    Array.from({ length: GROUPS_PER_PAGE }, () => null as WeightCell | null)
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
    <div class="wr-header">
      <div class="wr-side-spacer"></div>
      <div class="wr-title-block">
        <div class="wr-org">${escapeHtml(nameZh)}</div>
        <div class="wr-doc">院友體重記錄</div>
      </div>
      <div class="wr-logo-block">
        <img class="wr-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(logoAlt)}">
        ${nameEn ? `<div class="wr-logo-text">${escapeHtml(nameEn)}</div>` : ''}
      </div>
    </div>
  `;
};

const renderInfoRow = (patient: PatientRow, pageLabel: string): string => `
  <div class="wr-info">
    <div class="wr-info-item"><span class="wr-info-label">姓名：</span><span class="wr-info-value">${escapeHtml(patient.中文姓名 ?? '')}</span></div>
    <div class="wr-info-item"><span class="wr-info-label">床號：</span><span class="wr-info-value">${escapeHtml(patient.床號 ?? '')}</span></div>
    <div class="wr-info-item"><span class="wr-info-label">性別/年齡：</span><span class="wr-info-value">${escapeHtml(formatGenderAge(patient))}</span></div>
    <div class="wr-info-item"><span class="wr-info-label">頁數：</span><span class="wr-info-value">${escapeHtml(pageLabel)}</span></div>
  </div>
`;

const renderTable = (cells: WeightCell[]): string => {
  const grid = buildGrid(cells);
  const headerCells = Array.from({ length: GROUPS_PER_PAGE }, () =>
    '<th class="wr-th-date">日期</th><th class="wr-th-weight">體重 Kg</th><th class="wr-th-compare">比較上次</th><th class="wr-th-action">跟進行動</th>'
  ).join('');
  const bodyRows = grid.map(row => {
    const tds = row.map(cell => {
      const dateText = cell ? escapeHtml(cell.date) : '';
      const weightText = cell ? escapeHtml(cell.weight) : '';
      const compareText = cell ? escapeHtml(cell.compare) : '';
      return `<td class="wr-td-date">${dateText}</td><td class="wr-td-weight">${weightText}</td><td class="wr-td-compare">${compareText}</td><td class="wr-td-action"></td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `
    <table class="wr-table">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
};

const renderPage = (patient: PatientRow, cells: WeightCell[], pageLabel: string): string => `
  <section class="wr-page">
    ${renderHeader()}
    ${renderInfoRow(patient, pageLabel)}
    ${renderTable(cells)}
    <div class="wr-footer">${escapeHtml(FOOTER_LABEL)}</div>
  </section>
`;

const buildHtml = (pages: string[]): string => `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>院友體重記錄</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "標楷體", "DFKai-SB", "BiauKai", "KaiTi", "TW-Kai", "AR PL UKai TW", serif;
    color: #000;
  }
  .wr-page {
    width: 190mm;
    min-height: 277mm;
    margin: 0 auto;
    padding: 0;
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }
  .wr-page:last-child { page-break-after: auto; }

  /* 抬頭 */
  .wr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4mm;
  }
  .wr-side-spacer {
    width: 34mm;
    flex-shrink: 0;
  }
  .wr-title-block {
    flex: 1;
    text-align: center;
  }
  .wr-org { font-size: 24pt; font-weight: 700; letter-spacing: 2px; }
  .wr-doc { font-size: 20pt; font-weight: 700; margin-top: 1mm; }
  .wr-logo-block {
    width: 34mm;
    text-align: center;
    flex-shrink: 0;
  }
  .wr-logo { max-width: 30mm; max-height: 16mm; object-fit: contain; }
  .wr-logo-text { font-size: 8pt; font-weight: 700; margin-top: 0.5mm; }

  /* 院友資訊列 */
  .wr-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 4mm;
    margin-bottom: 2.5mm;
    padding: 0 1mm;
    font-size: 11pt;
  }
  .wr-info-item {
    display: flex;
    align-items: baseline;
    white-space: nowrap;
    flex: 1;
  }
  .wr-info-label { font-weight: 600; flex-shrink: 0; }
  .wr-info-value {
    flex: 1;
    border-bottom: 0.3mm solid #000;
    min-width: 14mm;
    padding: 0 1mm;
    min-height: 5mm;
    text-align: center;
  }

  /* 表格 */
  .wr-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .wr-table th, .wr-table td {
    border: 0.3mm solid #000;
    text-align: center;
    vertical-align: middle;
    font-size: 10.5pt;
  }
  /* 每組（日期/體重/比較上次/跟進行動）之間加粗分隔線（跟進行動欄為每組最右欄） */
  .wr-th-action, .wr-td-action {
    border-right: 0.7mm solid #000;
  }
  /* 表格最左緣加粗，與右側分隔線對稱 */
  .wr-th-date:first-child, .wr-td-date:first-child {
    border-left: 0.7mm solid #000;
  }
  .wr-table th {
    height: 7mm;
    font-weight: 700;
    background: #fff;
  }
  .wr-table td {
    height: 7.2mm;
  }
  /* 欄寬：日期/體重/比較上次均寬，跟進行動為兩倍寬 */
  .wr-th-date, .wr-td-date { width: 10%; }
  .wr-th-weight, .wr-td-weight { width: 10%; }
  .wr-th-compare, .wr-td-compare { width: 10%; }
  .wr-th-action, .wr-td-action { width: 20%; }

  /* 頁尾 */
  .wr-footer {
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
 * 產生院友體重記錄表並開啟列印視窗。
 * @param startDate 起始日期 (YYYY-MM-DD)
 * @param endDate 結束日期 (YYYY-MM-DD)
 */
export const generateBodyweightRecordWorksheet = async (
  startDate: string,
  endDate: string,
  patientIds?: number[]
): Promise<void> => {
  activeFacility = await getFacilitySettings();

  const [patients, records] = await Promise.all([
    fetchInResidencePatients(patientIds),
    fetchWeightRecords(startDate, endDate),
  ]);

  // 依院友分組記錄
  const recordsByPatient = new Map<number, WeightRecord[]>();
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
