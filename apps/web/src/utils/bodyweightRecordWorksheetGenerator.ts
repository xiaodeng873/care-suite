import { supabase } from '../lib/supabase';
import {
  getFacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
  type FacilitySettings,
} from './facilitySettings';
import { MR_LOGO_DATA_URI } from './medicationRecordLogo';

// ─────────────────────────────────────────────────────────────────────────────
// 院友體重記錄表（A4 直印）
// 完全複刻 doc_html/院友體重記錄.html 的版面、CSS 與欄位結構：
// 每頁 2 組「日期 / 體重(Kg) / 淨改變% / 跟進行動(註) / 記錄職員」× 33 列。
// 欄位映射（doc_html 標籤 → 健康監測記錄資料庫欄位）：
//   日期 → 記錄日期；體重(Kg) → 數值；淨改變% → 與上一筆記錄比較的百分比（計算得出）；
//   跟進行動(註) → 備註；記錄職員 → 記錄人員。
// 右上角新增院舍 logo，與大標題（h1/h2）頂部對齊。
// ─────────────────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 33; // 每組資料列數（不計表頭），與 doc_html 一致
const SETS_PER_PAGE = 2; // 每頁「日期/體重/淨改變%/跟進行動/記錄職員」組數
const CELLS_PER_PAGE = ROWS_PER_PAGE * SETS_PER_PAGE; // 每頁可容納的記錄數 = 66
const DOC_CODE = 'B4C FK (3.2025)';

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
  備註: string | null;
  記錄人員: string | null;
}

interface WeightCell {
  date: string;
  weight: string;
  compare: string;
  note: string;
  recorder: string;
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
    .select('院友id, 記錄日期, 記錄時間, 數值, 備註, 記錄人員')
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

// 將一位院友的體重記錄轉為含「淨改變%」的儲存格（依日期/時間排序）
const buildCells = (records: WeightRecord[]): WeightCell[] => {
  const sorted = [...records].sort((a, b) =>
    new Date(`${a.記錄日期} ${a.記錄時間 ?? '00:00'}`).getTime()
    - new Date(`${b.記錄日期} ${b.記錄時間 ?? '00:00'}`).getTime()
  );
  return sorted.map((record, index) => ({
    date: formatShortDate(record.記錄日期),
    weight: formatWeight(record.數值),
    compare: formatCompare(record.數值, index > 0 ? sorted[index - 1].數值 : null),
    note: record.備註 ?? '',
    recorder: record.記錄人員 ?? '',
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

// 將一頁的記錄以「欄為主」排成 33 列 × 2 組
const buildGrid = (cells: WeightCell[]): (WeightCell | null)[][] => {
  const grid: (WeightCell | null)[][] = Array.from({ length: ROWS_PER_PAGE }, () =>
    Array.from({ length: SETS_PER_PAGE }, () => null as WeightCell | null)
  );
  cells.forEach((cell, index) => {
    const set = Math.floor(index / ROWS_PER_PAGE); // 0..1
    const row = index % ROWS_PER_PAGE; // 0..32
    if (set < SETS_PER_PAGE) {
      grid[row][set] = cell;
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
    <div class="title-section">
      <div class="header-spacer"></div>
      <div class="header-center">
        <h1>${escapeHtml(nameZh)}</h1>
        <h2>院友體重記錄</h2>
      </div>
      <div class="header-right"><img class="logo-img" src="${escapeAttr(logo)}" alt="${escapeAttr(logoAlt)}"></div>
    </div>
  `;
};

const renderInfoRow = (patient: PatientRow, pageLabel: string): string => `
  <table class="info-table">
    <colgroup><col style="width: 25%;"><col style="width: 18%;"><col style="width: 18%;"><col style="width: 18%;"><col style="width: 21%;"></colgroup>
    <tr>
      <td>院友姓名：<input type="text" class="db-line-input" style="width: 60%;" value="${escapeAttr(patient.中文姓名 ?? '')}" readonly></td>
      <td>床號：<input type="text" class="db-line-input" style="width: 60%;" value="${escapeAttr(patient.床號 ?? '')}" readonly></td>
      <td>性別：<input type="text" class="db-line-input" style="width: 60%;" value="${escapeAttr(patient.性別 ?? '')}" readonly></td>
      <td>年齡：<input type="text" class="db-line-input" style="width: 60%;" value="${escapeAttr(calculateAge(patient.出生日期))}" readonly></td>
      <td>頁數：<input type="text" class="db-line-input" style="width: 70%;" value="${escapeAttr(pageLabel)}" readonly></td>
    </tr>
  </table>
`;

const renderTable = (cells: WeightCell[]): string => {
  const grid = buildGrid(cells);
  const colgroup = Array.from({ length: SETS_PER_PAGE }, () =>
    '<col style="width: 10%;"><col style="width: 8%;"><col style="width: 8%;"><col style="width: 16%;"><col style="width: 8%;">'
  ).join('');
  const headerCells = Array.from({ length: SETS_PER_PAGE }, (_, setIdx) => {
    const isLastSet = setIdx === SETS_PER_PAGE - 1;
    const dividerAttr = isLastSet ? '' : ' class="set-divider"';
    return `<th>日期</th><th>體重(Kg)</th><th>淨改變%</th><th>跟進行動(註)</th><th${dividerAttr}>記錄職員</th>`;
  }).join('');
  const bodyRows = grid.map(row => {
    const tds = row.map((cell, setIdx) => {
      const isLastSet = setIdx === SETS_PER_PAGE - 1;
      const dividerAttr = isLastSet ? '' : ' class="set-divider"';
      const dateText = cell ? escapeHtml(cell.date) : '';
      const weightText = cell ? escapeHtml(cell.weight) : '';
      const compareText = cell ? escapeHtml(cell.compare) : '';
      const noteText = cell ? escapeHtml(cell.note) : '';
      const recorderText = cell ? escapeHtml(cell.recorder) : '';
      return `<td><input class="db-text-cell" value="${dateText}" readonly></td><td><input class="db-text-cell" value="${weightText}" readonly></td><td><input class="db-text-cell" value="${compareText}" readonly></td><td><input class="db-text-cell" value="${noteText}" readonly></td><td${dividerAttr}><input class="db-text-cell" value="${recorderText}" readonly></td>`;
    }).join('');
    return `<tr class="data-row">${tds}</tr>`;
  }).join('');
  return `
    <table class="main-table">
      <colgroup>${colgroup}</colgroup>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
};

const renderPage = (patient: PatientRow, cells: WeightCell[], pageLabel: string): string => `
  <div class="container">
    ${renderHeader()}
    ${renderInfoRow(patient, pageLabel)}
    ${renderTable(cells)}
    <div class="footer">
      <div class="page-num">5</div>
      <div class="doc-code">${escapeHtml(DOC_CODE)}</div>
    </div>
  </div>
`;

const buildHtml = (pages: string[]): string => `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>院友體重記錄</title>
<style>
  @page { size: A4; margin: 5mm 0.25in; }
  * { box-sizing: border-box; }
  body { font-family: "DFKai-SB", "BiauKai", "標楷體", serif; margin: 0; padding: 0; background-color: #fff; color: #000; line-height: 1.2; }
  .container { width: 100%; box-sizing: border-box; page-break-after: always; }
  .container:last-of-type { page-break-after: auto; }
  .title-section { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
  .header-spacer { width: 18%; }
  .header-center { flex: 1; text-align: center; }
  .header-right { width: 18%; display: flex; align-items: flex-start; justify-content: flex-end; }
  .logo-img { max-height: 50px; max-width: 100%; object-fit: contain; }
  .title-section h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
  .title-section h2 { margin: 4px 0 0 0; font-size: 22px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; }
  .info-table td { border: none; padding: 2px 0; vertical-align: bottom; font-size: 16px; font-weight: bold; white-space: nowrap; }
  .db-line-input { width: 90%; border: none; border-bottom: 1px solid black; background: transparent; font-family: inherit; font-size: 16px; outline: none; padding: 0 0 1px 5px; box-sizing: border-box; }
  table.main-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid black; }
  table.main-table th, table.main-table td { border: 1px solid black; text-align: center; vertical-align: middle; padding: 0; }
  table.main-table th { font-size: 13px; font-weight: bold; background-color: #fff; height: 38px; line-height: 1.1; }
  .data-row { height: 30px; }
  .db-text-cell { width: 100%; height: 100%; border: none; background: transparent; font-family: inherit; font-size: 13px; text-align: center; outline: none; display: block; box-sizing: border-box; }
  .set-divider { border-right: 3px solid black !important; }
  .footer { margin-top: 8px; display: flex; justify-content: flex-end; position: relative; height: 30px; }
  .page-num { position: absolute; left: 50%; transform: translateX(-50%); font-size: 24px; font-weight: bold; bottom: 0; }
  .doc-code { font-size: 11px; font-weight: bold; align-self: flex-end; }
  @media print { .no-print { display: none !important; } }
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

