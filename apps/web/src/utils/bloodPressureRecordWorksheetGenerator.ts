import { supabase } from '../lib/supabase';
import {
  getFacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
  type FacilitySettings,
} from './facilitySettings';
import { MR_LOGO_DATA_URI } from './medicationRecordLogo';

// ─────────────────────────────────────────────────────────────────────────────
// 院友血壓記錄表（A4 直印）
// 嚴格複刻體溫記錄表版式，惟表頭字眼改為血壓，並將欄位改為 2 組
// 「日期 / 時間 / 血壓 mmHg / 脈搏 /min / 備註」（共 10 欄）。
// 血壓顯示為「收縮/舒張」（如 120/80），脈搏另從同日期時間的脈搏記錄取得。
// 「備註」欄寬為其他欄的兩倍。
// ─────────────────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 32;
const GROUPS_PER_PAGE = 2;
const CELLS_PER_PAGE = ROWS_PER_PAGE * GROUPS_PER_PAGE; // 64
const FOOTER_LABEL = '更新 B26 FK (09/2016)';

interface PatientRow {
  院友id: number;
  中文姓名: string | null;
  床號: string | null;
  性別: string | null;
  出生日期: string | null;
}

interface BpRecord {
  院友id: number;
  記錄日期: string;
  記錄時間: string | null;
  數值: number | null;       // 收縮壓
  數值_副: number | null;    // 舒張壓
  備註: string | null;
}

interface PulseRecord {
  院友id: number;
  記錄日期: string;
  記錄時間: string | null;
  數值: number | null;
}

interface BpCell {
  date: string;
  time: string;
  bp: string;
  pulse: string;
  remark: string;
}

let activeFacility: FacilitySettings = DEFAULT_FACILITY_SETTINGS;

const escapeHtml = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttr = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const calculateAge = (birthDate: string | null): string => {
  if (!birthDate) return '';
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
  return age > 0 ? String(age) : '';
};

const formatGenderAge = (p: PatientRow): string => {
  const g = p.性別 ?? '';
  const a = calculateAge(p.出生日期);
  if (!g && !a) return '';
  return a ? `${g} / ${a}` : g;
};

const formatShortDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  return `${yy}/${d.getMonth() + 1}/${d.getDate()}`;
};

const formatTime = (t: string | null): string => (t ? t.slice(0, 5) : '');

const formatBp = (sys: number | null, dia: number | null): string => {
  if (sys == null && dia == null) return '';
  const s = sys != null ? String(Math.round(sys)) : '-';
  const d = dia != null ? String(Math.round(dia)) : '-';
  return `${s}/${d}`;
};

const formatPulse = (v: number | null): string =>
  v != null && !Number.isNaN(v) ? String(Math.round(v)) : '';

// 取得院友（依床號排序）
const fetchPatients = async (patientIds?: number[]): Promise<PatientRow[]> => {
  let q = supabase.from('院友主表').select('院友id, 中文姓名, 床號, 性別, 出生日期');
  if (patientIds && patientIds.length > 0) {
    q = q.in('院友id', patientIds);
  } else {
    q = q.eq('在住狀態', '在住');
  }
  const { data, error } = await q.order('床號', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PatientRow[];
};

// 取得血壓記錄
const fetchBpRecords = async (start: string, end: string): Promise<BpRecord[]> => {
  const { data, error } = await supabase
    .from('健康監測記錄')
    .select('院友id, 記錄日期, 記錄時間, 數值, 數值_副, 備註')
    .eq('監測類型', '血壓')
    .gte('記錄日期', start)
    .lte('記錄日期', end)
    .order('記錄日期', { ascending: true })
    .order('記錄時間', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BpRecord[];
};

// 取得脈搏記錄
const fetchPulseRecords = async (start: string, end: string): Promise<PulseRecord[]> => {
  const { data, error } = await supabase
    .from('健康監測記錄')
    .select('院友id, 記錄日期, 記錄時間, 數值')
    .eq('監測類型', '脈搏')
    .gte('記錄日期', start)
    .lte('記錄日期', end);
  if (error) throw error;
  return (data ?? []) as PulseRecord[];
};

// 建立脈搏快查 key：院友id + 日期 + 時間
const pulseKey = (id: number, date: string, time: string | null) =>
  `${id}|${date}|${(time ?? '').slice(0, 5)}`;

// 將一位院友的血壓記錄轉為儲存格
const buildCells = (
  bpRecords: BpRecord[],
  pulseMap: Map<string, number | null>
): BpCell[] => {
  const sorted = [...bpRecords].sort((a, b) =>
    new Date(`${a.記錄日期} ${a.記錄時間 ?? '00:00'}`).getTime()
    - new Date(`${b.記錄日期} ${b.記錄時間 ?? '00:00'}`).getTime()
  );
  return sorted.map(r => ({
    date: formatShortDate(r.記錄日期),
    time: formatTime(r.記錄時間),
    bp: formatBp(r.數值, r.數值_副),
    pulse: formatPulse(pulseMap.get(pulseKey(r.院友id, r.記錄日期, r.記錄時間)) ?? null),
    remark: r.備註 ?? '',
  }));
};

const chunkCellsIntoPages = (cells: BpCell[]): BpCell[][] => {
  if (cells.length === 0) return [[]];
  const pages: BpCell[][] = [];
  for (let i = 0; i < cells.length; i += CELLS_PER_PAGE) {
    pages.push(cells.slice(i, i + CELLS_PER_PAGE));
  }
  return pages;
};

const buildGrid = (cells: BpCell[]): (BpCell | null)[][] => {
  const grid: (BpCell | null)[][] = Array.from({ length: ROWS_PER_PAGE }, () =>
    Array.from({ length: GROUPS_PER_PAGE }, () => null as BpCell | null)
  );
  cells.forEach((cell, i) => {
    const group = Math.floor(i / ROWS_PER_PAGE);
    const row = i % ROWS_PER_PAGE;
    if (group < GROUPS_PER_PAGE) grid[row][group] = cell;
  });
  return grid;
};

const renderHeader = (): string => {
  const logo = activeFacility.logoDataUri || MR_LOGO_DATA_URI;
  const nameZh = activeFacility.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;
  const nameEn = activeFacility.facilityNameEn?.trim() || '';
  const logoAlt = nameEn ? `${nameZh} ${nameEn}` : nameZh;
  return `
    <div class="bp-header">
      <div class="bp-side-spacer"></div>
      <div class="bp-title-block">
        <div class="bp-org">${escapeHtml(nameZh)}</div>
        <div class="bp-doc">院友血壓記錄</div>
      </div>
      <div class="bp-logo-block">
        <img class="bp-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(logoAlt)}">
        ${nameEn ? `<div class="bp-logo-text">${escapeHtml(nameEn)}</div>` : ''}
      </div>
    </div>
  `;
};

const renderInfoRow = (patient: PatientRow, pageLabel: string): string => `
  <div class="bp-info">
    <div class="bp-info-item"><span class="bp-info-label">姓名：</span><span class="bp-info-value">${escapeHtml(patient.中文姓名 ?? '')}</span></div>
    <div class="bp-info-item"><span class="bp-info-label">床號：</span><span class="bp-info-value">${escapeHtml(patient.床號 ?? '')}</span></div>
    <div class="bp-info-item"><span class="bp-info-label">性別/年齡：</span><span class="bp-info-value">${escapeHtml(formatGenderAge(patient))}</span></div>
    <div class="bp-info-item"><span class="bp-info-label">頁數：</span><span class="bp-info-value">${escapeHtml(pageLabel)}</span></div>
  </div>
`;

const renderTable = (cells: BpCell[]): string => {
  const grid = buildGrid(cells);
  const headerCells = Array.from({ length: GROUPS_PER_PAGE }, () =>
    '<th class="bp-th-date">日期</th><th class="bp-th-time">時間</th><th class="bp-th-bp">血壓 mmHg</th><th class="bp-th-pulse">脈搏 /min</th><th class="bp-th-remark">備註</th>'
  ).join('');
  const bodyRows = grid.map(row => {
    const tds = row.map(cell => `
      <td class="bp-td-date">${cell ? escapeHtml(cell.date) : ''}</td>
      <td class="bp-td-time">${cell ? escapeHtml(cell.time) : ''}</td>
      <td class="bp-td-bp">${cell ? escapeHtml(cell.bp) : ''}</td>
      <td class="bp-td-pulse">${cell ? escapeHtml(cell.pulse) : ''}</td>
      <td class="bp-td-remark">${cell ? escapeHtml(cell.remark) : ''}</td>
    `).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `
    <table class="bp-table">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
};

const renderPage = (patient: PatientRow, cells: BpCell[], pageLabel: string): string => `
  <section class="bp-page">
    ${renderHeader()}
    ${renderInfoRow(patient, pageLabel)}
    ${renderTable(cells)}
    <div class="bp-footer">${escapeHtml(FOOTER_LABEL)}</div>
  </section>
`;

const buildHtml = (pages: string[]): string => `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>院友血壓記錄</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "標楷體", "DFKai-SB", "BiauKai", "KaiTi", "TW-Kai", "AR PL UKai TW", serif;
    color: #000;
  }
  .bp-page {
    width: 190mm;
    min-height: 277mm;
    margin: 0 auto;
    padding: 0;
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }
  .bp-page:last-child { page-break-after: auto; }

  /* 抬頭 */
  .bp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4mm;
  }
  .bp-side-spacer { width: 34mm; flex-shrink: 0; }
  .bp-title-block { flex: 1; text-align: center; }
  .bp-org { font-size: 24pt; font-weight: 700; letter-spacing: 2px; }
  .bp-doc { font-size: 20pt; font-weight: 700; margin-top: 1mm; }
  .bp-logo-block { width: 34mm; text-align: center; flex-shrink: 0; }
  .bp-logo { max-width: 30mm; max-height: 16mm; object-fit: contain; }
  .bp-logo-text { font-size: 8pt; font-weight: 700; margin-top: 0.5mm; }

  /* 院友資訊列 */
  .bp-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 4mm;
    margin-bottom: 2.5mm;
    padding: 0 1mm;
    font-size: 11pt;
  }
  .bp-info-item { display: flex; align-items: baseline; white-space: nowrap; flex: 1; }
  .bp-info-label { font-weight: 600; flex-shrink: 0; }
  .bp-info-value {
    flex: 1;
    border-bottom: 0.3mm solid #000;
    min-width: 14mm;
    padding: 0 1mm;
    min-height: 5mm;
    text-align: center;
  }

  /* 表格 */
  .bp-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .bp-table th, .bp-table td {
    border: 0.3mm solid #000;
    text-align: center;
    vertical-align: middle;
    font-size: 9.5pt;
  }
  /* 每組最右欄（備註）加粗分隔線 */
  .bp-th-remark, .bp-td-remark {
    border-right: 0.7mm solid #000;
    text-align: left;
    padding-left: 1mm;
  }
  /* 表格最左緣加粗 */
  .bp-th-date:first-child, .bp-td-date:first-child {
    border-left: 0.7mm solid #000;
  }
  .bp-table th { height: 7mm; font-weight: 700; background: #fff; }
  .bp-table td { height: 7.2mm; }

  /* 欄寬
     2 組 × (date + time + bp + pulse + remark)
     均寬欄 8%，備註 18%（≥ 2×8%）
     2 × (8+8+8+8+18) = 100%
  */
  .bp-th-date,  .bp-td-date  { width: 8%; }
  .bp-th-time,  .bp-td-time  { width: 8%; }
  .bp-th-bp,    .bp-td-bp    { width: 8%; }
  .bp-th-pulse, .bp-td-pulse { width: 8%; }
  .bp-th-remark,.bp-td-remark{ width: 18%; }

  /* 頁尾 */
  .bp-footer { margin-top: auto; padding-top: 2mm; text-align: right; font-size: 9pt; }
</style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;

const openPrintWindow = (html: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.addEventListener('load', () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    });
  }
};

/**
 * 產生院友血壓記錄表並開啟列印視窗。
 * @param startDate 起始日期 (YYYY-MM-DD)
 * @param endDate   結束日期 (YYYY-MM-DD)
 */
export const generateBloodPressureRecordWorksheet = async (
  startDate: string,
  endDate: string,
  patientIds?: number[]
): Promise<void> => {
  activeFacility = await getFacilitySettings();

  const [patients, bpRecords, pulseRecords] = await Promise.all([
    fetchPatients(patientIds),
    fetchBpRecords(startDate, endDate),
    fetchPulseRecords(startDate, endDate),
  ]);

  // 建立脈搏快查表
  const pulseMap = new Map<string, number | null>();
  pulseRecords.forEach(r => {
    pulseMap.set(pulseKey(r.院友id, r.記錄日期, r.記錄時間), r.數值);
  });

  // 依院友分組血壓記錄
  const bpByPatient = new Map<number, BpRecord[]>();
  bpRecords.forEach(r => {
    const list = bpByPatient.get(r.院友id) ?? [];
    list.push(r);
    bpByPatient.set(r.院友id, list);
  });

  const pagesHtml: string[] = [];
  patients.forEach(patient => {
    const patientBp = bpByPatient.get(patient.院友id) ?? [];
    const cells = buildCells(patientBp, pulseMap);
    const pages = chunkCellsIntoPages(cells);
    pages.forEach((pageCells, idx) => {
      const label = pages.length > 1 ? `${idx + 1} / ${pages.length}` : '1';
      pagesHtml.push(renderPage(patient, pageCells, label));
    });
  });

  openPrintWindow(buildHtml(pagesHtml));
};
