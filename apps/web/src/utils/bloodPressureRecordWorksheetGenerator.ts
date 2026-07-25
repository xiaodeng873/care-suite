import { supabase } from '../lib/supabase';
import {
  getFacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
  type FacilitySettings,
} from './facilitySettings';

// ─────────────────────────────────────────────────────────────────────────────
// 生命表徵觀察記錄表（A4 直印）
// 完全複刻 doc_html/生命表徵觀察記錄表.html 的版面、CSS 與欄位結構：
// 每頁 1 組「日期/時間 / 體溫°C / 血壓mmHg / 脈搏 / 呼吸 / SPO2 / 備註」× 33 列（單一寬表，非左右並排）。
// 資料來源：健康監測記錄，監測類型分別為 體溫、血壓（數值=收縮，數值_副=舒張）、脈搏、呼吸、血含氧量。
// 合併規則：必須先有血壓、脈搏、血含氧量或呼吸其中一項記錄才會建立該列；體溫僅在「記錄日期 + 記錄時間」與該列完全相同時才附加。
// 若某日期時間只有體溫記錄、沒有血壓/脈搏/血含氧量/呼吸任一記錄，該筆資料不會列出。
// 備註欄彙整同一列中各監測類型的非空備註（去重後以「; 」join）。
// ─────────────────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 29; // 每頁列數，依 doc_html 行高精算，確保單頁不溢出且標題/表頭在每頁重複
const DOC_CODE = 'B4C FK (3.2025)';

type VitalType = '體溫' | '血壓' | '脈搏' | '呼吸' | '血含氧量';

interface PatientRow {
  院友id: number;
  中文姓名: string | null;
  床號: string | null;
  性別: string | null;
  出生日期: string | null;
}

interface RawVitalRecord {
  院友id: number;
  記錄日期: string;
  記錄時間: string | null;
  數值: number | null;
  數值_副?: number | null;
  備註: string | null;
}

interface MergedRow {
  date: string;
  time: string | null;
  temp: number | null;
  bpSys: number | null;
  bpDia: number | null;
  pulse: number | null;
  resp: number | null;
  spo2: number | null;
  remarks: Set<string>;
}

interface VitalCell {
  datetime: string;
  temp: string;
  bp: string;
  pulse: string;
  resp: string;
  spo2: string;
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

// 日期顯示為 YY/M/D（含兩位年份，與紙本手寫風格一致、欄位較窄）
const formatShortDate = (dateStr: string): string => {
  const match = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dateStr);
  if (!match) return dateStr;
  const [, year, month, day] = match;
  const yy = String(Number(year) % 100).padStart(2, '0');
  return `${yy}/${month}/${day}`;
};

// 時間顯示為 HH:MM（截取前 5 字元）
const formatTime = (timeStr: string | null): string => (timeStr ? timeStr.slice(0, 5) : '');

const formatTemperature = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '';
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
};

const formatBp = (sys: number | null, dia: number | null): string => {
  if (sys == null && dia == null) return '';
  const s = sys != null ? String(Math.round(sys)) : '-';
  const d = dia != null ? String(Math.round(dia)) : '-';
  return `${s}/${d}`;
};

const formatRounded = (value: number | null): string =>
  value != null && !Number.isNaN(value) ? String(Math.round(value)) : '';

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

// 取得指定日期範圍內、指定監測類型的記錄（分頁抓取以避開 Supabase 1000 列限制）
const fetchVitalRecords = async (
  type: VitalType,
  startDate: string,
  endDate: string
): Promise<RawVitalRecord[]> => {
  const columns = type === '血壓'
    ? '院友id, 記錄日期, 記錄時間, 數值, 數值_副, 備註'
    : '院友id, 記錄日期, 記錄時間, 數值, 備註';

  const PAGE_SIZE = 1000;
  const all: RawVitalRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('健康監測記錄')
      .select(columns)
      .eq('監測類型', type)
      .gte('記錄日期', startDate)
      .lte('記錄日期', endDate)
      .order('記錄日期', { ascending: true })
      .order('記錄時間', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`讀取${type}記錄失敗:`, error);
      throw error;
    }

    const rows = (data ?? []) as RawVitalRecord[];
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
};

const mergeKey = (date: string, time: string | null): string => `${date}|${formatTime(time)}`;

// 將五種監測類型的記錄依（院友id + 日期 + 時間）合併為單一列
const buildMergedRowsByPatient = (
  tempRecords: RawVitalRecord[],
  bpRecords: RawVitalRecord[],
  pulseRecords: RawVitalRecord[],
  respRecords: RawVitalRecord[],
  spo2Records: RawVitalRecord[]
): Map<number, Map<string, MergedRow>> => {
  const byPatient = new Map<number, Map<string, MergedRow>>();

  // 血壓、脈搏、血含氧量、呼吸皆可建立新的合併列（此四項任一存在即可成列，體溫只能附加於既有列）
  const createRow = (院友id: number, date: string, time: string | null): MergedRow => {
    const patientMap = byPatient.get(院友id) ?? new Map<string, MergedRow>();
    byPatient.set(院友id, patientMap);
    const key = mergeKey(date, time);
    let row = patientMap.get(key);
    if (!row) {
      row = { date, time, temp: null, bpSys: null, bpDia: null, pulse: null, resp: null, spo2: null, remarks: new Set<string>() };
      patientMap.set(key, row);
    }
    return row;
  };

  // 體溫只在同院友、同日期、同時間已有列（血壓/脈搏/血含氧量/呼吸其一）時才附加；沒有對應列則忽略該筆記錄
  const findRow = (院友id: number, date: string, time: string | null): MergedRow | undefined => {
    const patientMap = byPatient.get(院友id);
    if (!patientMap) return undefined;
    return patientMap.get(mergeKey(date, time));
  };

  const addRemark = (row: MergedRow, remark: string | null) => {
    const trimmed = (remark ?? '').trim();
    if (trimmed) row.remarks.add(trimmed);
  };

  // 先處理血壓、脈搏、血含氧量、呼吸，建立所有合併列的基礎
  bpRecords.forEach(r => {
    const row = createRow(r.院友id, r.記錄日期, r.記錄時間);
    row.bpSys = r.數值;
    row.bpDia = r.數值_副 ?? null;
    addRemark(row, r.備註);
  });
  pulseRecords.forEach(r => {
    const row = createRow(r.院友id, r.記錄日期, r.記錄時間);
    row.pulse = r.數值;
    addRemark(row, r.備註);
  });
  respRecords.forEach(r => {
    const row = createRow(r.院友id, r.記錄日期, r.記錄時間);
    row.resp = r.數值;
    addRemark(row, r.備註);
  });
  spo2Records.forEach(r => {
    const row = createRow(r.院友id, r.記錄日期, r.記錄時間);
    row.spo2 = r.數值;
    addRemark(row, r.備註);
  });

  // 體溫僅在同日同時已有血壓/脈搏/血含氧量/呼吸其中一項記錄時才合併，否則捨棄（不列出）
  tempRecords.forEach(r => {
    const row = findRow(r.院友id, r.記錄日期, r.記錄時間);
    if (!row) return;
    row.temp = r.數值;
    addRemark(row, r.備註);
  });

  return byPatient;
};

// 將一位院友合併後的列轉為儲存格（依日期/時間排序）
const buildCells = (mergedRows: Map<string, MergedRow> | undefined): VitalCell[] => {
  if (!mergedRows) return [];
  const rows = Array.from(mergedRows.values()).sort((a, b) =>
    new Date(`${a.date} ${a.time ?? '00:00'}`).getTime()
    - new Date(`${b.date} ${b.time ?? '00:00'}`).getTime()
  );
  return rows.map(row => ({
    datetime: `${formatShortDate(row.date)} ${formatTime(row.time)}`.trim(),
    temp: formatTemperature(row.temp),
    bp: formatBp(row.bpSys, row.bpDia),
    pulse: formatRounded(row.pulse),
    resp: formatRounded(row.resp),
    spo2: formatRounded(row.spo2),
    remark: Array.from(row.remarks).join('; '),
  }));
};

// 將院友的儲存格切成多頁（每頁 33 列，不足補空白列）
const chunkCellsIntoPages = (cells: VitalCell[]): (VitalCell | null)[][] => {
  const pages: (VitalCell | null)[][] = [];
  const total = Math.max(cells.length, 1);
  for (let i = 0; i < total; i += ROWS_PER_PAGE) {
    const slice: (VitalCell | null)[] = cells.slice(i, i + ROWS_PER_PAGE);
    while (slice.length < ROWS_PER_PAGE) slice.push(null);
    pages.push(slice);
  }
  return pages;
};

const renderHeader = (): string => {
  const nameZh = activeFacility.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;
  return `
    <div class="title-section">
      <div class="header-center">
        <h1>${escapeHtml(nameZh)}</h1>
        <h2>生命表徵觀察記錄表</h2>
      </div>
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

const renderTable = (cells: (VitalCell | null)[]): string => {
  const colgroup = '<col class="col-datetime"><col class="col-temp"><col class="col-bp"><col class="col-pulse"><col class="col-resp"><col class="col-spo2"><col class="col-remark">';
  const headerCells = '<th>日期 / 時間</th><th>體 溫 (°C)</th><th>血 壓 (mmHg)</th><th>脈 搏 (每分鐘)</th><th>呼 吸<br>(每分鐘)</th><th>SPO<sub>2</sub> (%)</th><th>備 註</th>';
  const bodyRows = cells.map(cell => {
    const datetimeText = cell ? escapeHtml(cell.datetime) : '';
    const tempText = cell ? escapeHtml(cell.temp) : '';
    const bpText = cell ? escapeHtml(cell.bp) : '';
    const pulseText = cell ? escapeHtml(cell.pulse) : '';
    const respText = cell ? escapeHtml(cell.resp) : '';
    const spo2Text = cell ? escapeHtml(cell.spo2) : '';
    const remarkText = cell ? escapeHtml(cell.remark) : '';
    return `<tr class="data-row">
      <td><input class="db-text-cell" value="${datetimeText}" readonly></td>
      <td><input class="db-text-cell" value="${tempText}" readonly></td>
      <td><input class="db-text-cell" value="${bpText}" readonly></td>
      <td><input class="db-text-cell" value="${pulseText}" readonly></td>
      <td><input class="db-text-cell" value="${respText}" readonly></td>
      <td><input class="db-text-cell" value="${spo2Text}" readonly></td>
      <td><input class="db-text-cell" value="${remarkText}" readonly style="text-align:left; padding-left:5px;"></td>
    </tr>`;
  }).join('');
  return `
    <table class="main-table">
      <colgroup>${colgroup}</colgroup>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
};

const renderPage = (patient: PatientRow, cells: (VitalCell | null)[], pageLabel: string): string => `
  <div class="container">
    ${renderHeader()}
    <br>
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
<title>生命表徵觀察記錄表</title>
<style>
  @page { size: A4; margin: 5mm 0.25in; }
  * { box-sizing: border-box; }
  body { font-family: "DFKai-SB", "BiauKai", "標楷體", serif; margin: 0; padding: 0; background-color: #fff; color: #000; line-height: 1.2; }
  .container { width: 100%; box-sizing: border-box; page-break-after: always; display: flex; flex-direction: column; min-height: 287mm; }
  .container:last-of-type { page-break-after: auto; }
  .title-section { text-align: center; margin-bottom: 12px; }
  .header-center { text-align: center; }
  .title-section h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
  .title-section h2 { margin: 4px 0 0 0; font-size: 22px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; }
  .info-table td { border: none; padding: 2px 0; vertical-align: bottom; font-size: 16px; font-weight: bold; white-space: nowrap; }
  .db-line-input { width: 90%; border: none; border-bottom: 1px solid black; background: transparent; font-family: inherit; font-size: 16px; outline: none; padding: 0 0 1px 5px; box-sizing: border-box; }
  table.main-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid black; }
  table.main-table th, table.main-table td { border: 1px solid black; text-align: center; vertical-align: middle; padding: 0; }
  table.main-table th { font-size: 14px; font-weight: bold; background-color: #fff; height: 38px; line-height: 1.1; }
  .col-datetime { width: 18%; }
  .col-temp     { width: 10%; }
  .col-bp       { width: 17%; }
  .col-pulse    { width: 15%; }
  .col-resp     { width: 10%; }
  .col-spo2     { width: 10%; }
  .col-remark   { width: auto; }
  .data-row { height: 30px; }
  .db-text-cell { width: 100%; height: 100%; border: none; background: transparent; font-family: inherit; font-size: 14px; text-align: center; outline: none; display: block; box-sizing: border-box; }
  .footer { margin-top: auto; display: flex; justify-content: flex-end; position: relative; height: 30px; }
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

export const generateBloodPressureRecordHtml = async (
  startDate: string,
  endDate: string,
  patientIds?: number[],
  options?: { includeData?: boolean; blankHeader?: boolean }
): Promise<string> => {
  activeFacility = await getFacilitySettings();

  const includeData = options?.includeData !== false;
  const [patientsRaw, tempRecords, bpRecords, pulseRecords, respRecords, spo2Records] = await Promise.all([
    fetchInResidencePatients(patientIds),
    includeData ? fetchVitalRecords('體溫', startDate, endDate) : Promise.resolve([]),
    includeData ? fetchVitalRecords('血壓', startDate, endDate) : Promise.resolve([]),
    includeData ? fetchVitalRecords('脈搏', startDate, endDate) : Promise.resolve([]),
    includeData ? fetchVitalRecords('呼吸', startDate, endDate) : Promise.resolve([]),
    includeData ? fetchVitalRecords('血含氧量', startDate, endDate) : Promise.resolve([]),
  ]);

  const patients = options?.blankHeader
    ? patientsRaw.map(p => ({ ...p, 中文姓名: '', 床號: '', 性別: '', 出生日期: '' }))
    : patientsRaw;

  const mergedByPatient = buildMergedRowsByPatient(tempRecords, bpRecords, pulseRecords, respRecords, spo2Records);

  const pagesHtml: string[] = [];
  patients.forEach(patient => {
    const cells = buildCells(mergedByPatient.get(patient.院友id));
    const pages = chunkCellsIntoPages(cells);
    pages.forEach((pageCells, index) => {
      const pageLabel = pages.length > 1 ? `${index + 1} / ${pages.length}` : '1';
      pagesHtml.push(renderPage(patient, pageCells, pageLabel));
    });
  });

  return buildHtml(pagesHtml);
};

/**
 * 產生生命表徵觀察記錄表並開啟列印視窗。
 * @param startDate 起始日期 (YYYY-MM-DD)
 * @param endDate 結束日期 (YYYY-MM-DD)
 */
export const generateBloodPressureRecordWorksheet = async (
  startDate: string,
  endDate: string,
  patientIds?: number[]
): Promise<void> => {
  const html = await generateBloodPressureRecordHtml(startDate, endDate, patientIds);
  openPrintWindow(html);
};
