import { formatDisplayDate } from './dateFormat';
import { formatMealTimingFrom } from './mealTiming';
import shortTermTemplate from '../../../../upload/doc_html/院友服用藥物一覽表（短期藥）.html?raw';
import longTermTemplate from '../../../../upload/doc_html/院友服用藥物一覽表（長期藥）.html?raw';
import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';
import { getPrintBedNumber } from './bedTransferUtils';


interface MedicationPrescription {
  id?: string;
  patient_id?: number;
  medication_name?: string;
  dosage_form?: string;
  dosage_amount?: number | string;
  dosage_unit?: string;
  administration_route?: string;
  frequency_type?: string;
  frequency_value?: number;
  daily_frequency?: number;
  specific_weekdays?: number[];
  is_odd_even_day?: string;
  medication_time_slots?: string[];
  meal_timing?: string;
  meal_timing_2?: string;
  meal_timing_connector?: '或' | '及';
  meal_timings?: { slots: string[]; connectors: ('或' | '及' | '')[]; replacePrefix?: boolean[] } | null;
  special_dosage_instruction?: string;
  is_prn?: boolean;
  cannot_crush?: boolean;
  medication_source?: string;
  medication_source_specialty?: string;
  prescription_date?: string;
  start_date?: string;
  end_date?: string;
  is_long_term?: boolean;
  estimated_end_date?: string;
  notes?: string;
  special_instructions?: string;
  inspection_rules?: Array<{
    vital_sign_type?: string;
    condition_operator?: string;
    condition_value?: string | number;
    action_if_met?: string;
  }>;
}

interface PatientForMedicationList {
  院友id?: number;
  中文姓氏?: string;
  中文名字?: string;
  中文姓名?: string;
  英文姓氏?: string;
  英文名字?: string;
  英文姓名?: string;
  床號?: string;
  original_bed_number?: string;
  性別?: string;
  出生日期?: string;
  身份證號碼?: string;
  藥物敏感?: string[];
  不良藥物反應?: string[];
  院友相片?: string;
}

interface PatientWithPrescriptions extends PatientForMedicationList {
  prescriptions?: MedicationPrescription[];
}

type MedicationTermType = 'short' | 'long';

function escapeHtml(text: string | number | undefined | null): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr?: string): string {
  return formatDisplayDate(dateStr);
}

function calculateAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatGenderAge(patient: PatientForMedicationList): string {
  const age = calculateAge(patient.出生日期);
  return `${patient.性別 ?? ''}${age != null ? ' / ' + age : ''}`;
}

function formatHKID(id?: string): string {
  if (!id) return '';
  const s = String(id).trim().toUpperCase();
  // 已經有括號結尾，直接回傳，避免重複
  if (s.endsWith(')')) return s;
  if (s.length <= 1) return s;
  return s.slice(0, -1) + '(' + s.slice(-1) + ')';
}

function getFrequencyDescription(p: MedicationPrescription): string {
  const slots = p.medication_time_slots ?? [];
  const dailyCount = (count: number): string => `每日${count}次`;
  // 兩個正交軸：frequency_type 決定「逢邊日施藥」；daily_frequency 決定「施藥當日施幾多次」，
  // 冇登記先按服用時間點數目推算（PRN 可每日3次但只設一個時間點）。
  // frequency_value 係「間隔天數」，唔係當日次數，唔用嚟推算 perDay。
  const perDay = p.daily_frequency || slots.length || 1;
  switch (p.frequency_type) {
    case 'daily': return dailyCount(perDay);
    case 'every_x_days': {
      const gap = Number(p.frequency_value) || 1;
      if (gap === 1) return dailyCount(perDay);
      if (gap === 2) return `隔日${perDay}次`;
      return `每${gap}日${perDay}次`;
    }
    case 'every_x_weeks': return `每${p.frequency_value}星期${perDay}次`;
    case 'every_x_months': return `每${p.frequency_value}月${perDay}次`;
    case 'weekly_days': {
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = p.specific_weekdays?.map(day => dayNames[day === 7 ? 0 : day]).join('、') || '';
      return `逢${days}${perDay}次`;
    }
    case 'odd_even_days':
      return p.is_odd_even_day === 'odd' ? `單日${perDay}次` : p.is_odd_even_day === 'even' ? `雙日${perDay}次` : `單雙日${perDay}次`;
    case 'hourly': return `每${p.frequency_value}小時1次`;
    default: return dailyCount(perDay);
  }
}

function formatDrugCell(p: MedicationPrescription): string {
  const parts: string[] = [];
  if (p.medication_name) parts.push(escapeHtml(p.medication_name));
  if (p.administration_route) parts.push(escapeHtml(p.administration_route));
  if (p.dosage_form) parts.push(escapeHtml(p.dosage_form));
  const mealTimingLabel = formatMealTimingFrom(p);
  if (mealTimingLabel) parts.push(escapeHtml(mealTimingLabel).replace(/\n/g, '<br>'));
  if (p.special_dosage_instruction) parts.push(escapeHtml(p.special_dosage_instruction));
  if (p.is_prn) parts.push('需要時');
  const freq = getFrequencyDescription(p);
  if (freq) parts.push(escapeHtml(freq));
  if (p.dosage_amount != null && p.dosage_amount !== '') {
    parts.push(`每次${escapeHtml(String(p.dosage_amount))}${escapeHtml(p.dosage_unit ?? '')}`);
  }
  // 檢測項規則唔放藥名欄，映射去注意事項欄（見 formatNoticeCell）
  return parts.join(',');
}

function formatInspectionRules(p: MedicationPrescription): string {
  if (!Array.isArray(p.inspection_rules) || p.inspection_rules.length === 0) return '';
  const opMap: Record<string, string> = {
    gt: '大於',
    lt: '小於',
    gte: '大於或等於',
    lte: '小於或等於',
  };
  const actionMap: Record<string, string> = {
    block_dispensing: '停服一次',
    warning_only: '注意',
    dispense_if_met: '才需服用',
  };
  const unitMap: Record<string, string> = {
    上壓: 'mmHg',
    下壓: 'mmHg',
    脈搏: '/min',
    血糖值: 'mmol/L',
    呼吸: '/min',
    血含氧量: '%',
    體溫: '°C',
  };
  return p.inspection_rules.map(r => {
    const op = opMap[r.condition_operator ?? ''] ?? '';
    const action = actionMap[r.action_if_met ?? ''] ?? r.action_if_met ?? '';
    const unit = unitMap[r.vital_sign_type ?? ''] ?? '';
    const value = r.condition_value ?? '';
    return `${r.vital_sign_type ?? ''}${op}${value}${unit}時${action}`;
  }).join(',');
}

function formatNoticeCell(p: MedicationPrescription): string {
  // 注意事項欄映射檢測項規則（如「血糖值小於或等於4mmol/L時注意」）
  return escapeHtml(formatInspectionRules(p));
}

function classifyMedicationTerm(p: MedicationPrescription): MedicationTermType {
  // 用戶定義：有結束日期的就是短期，沒有結束日期的就是長期。
  return p.end_date ? 'short' : 'long';
}

function isPrescriptionInDateRange(p: MedicationPrescription, startDate?: string, endDate?: string): boolean {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const prescStart = p.start_date ? new Date(p.start_date) : (p.prescription_date ? new Date(p.prescription_date) : null);
  const prescEnd = p.end_date ? new Date(p.end_date) : null;

  if (start && end) {
    if (prescStart && prescStart > end) return false;
    if (prescEnd && prescEnd < start) return false;
    return true;
  }
  if (start) {
    if (prescEnd && prescEnd < start) return false;
    return true;
  }
  if (end) {
    if (prescStart && prescStart > end) return false;
    return true;
  }
  return true;
}

function formatSourceCell(p: MedicationPrescription): string {
  const parts = [p.medication_source, p.medication_source_specialty].filter(Boolean);
  return parts.join('/');
}

function renderMedicationRow(p: MedicationPrescription): string {
  // 用 div 唔用 textarea：textarea 固定高度，內容多過兩行會出滾動軸（箭咀），
  // 列印時更加直接截斷；div 行高跟內容自動伸縮，冇滾動軸、列印全顯示
  return `<tr class="data-row">
    <td><div class="db-text-div">${formatDrugCell(p)}</div></td>
    <td><div class="db-text-div" style="text-align:center;">${escapeHtml(formatSourceCell(p))}</div></td>
    <td><input type="text" class="db-text-cell" style="text-align:center;" value="${escapeHtml(formatDate(p.start_date || p.prescription_date))}"></td>
    <td><input type="text" class="db-text-cell" style="text-align:center;" value="${escapeHtml(p.end_date ? formatDate(p.end_date) : '')}"></td>
    <td><div class="db-text-div">${formatNoticeCell(p)}</div></td>
    <td><input type="text" class="db-text-cell"></td>
  </tr>`;
}

function renderEmptyRows(count: number): string {
  return Array(count).fill(0).map(() => `<tr class="data-row">
    <td><textarea class="db-text-cell"></textarea></td>
    <td><textarea class="db-text-cell"></textarea></td>
    <td><input type="text" class="db-text-cell" style="text-align:center;"></td>
    <td><input type="text" class="db-text-cell" style="text-align:center;"></td>
    <td><textarea class="db-text-cell"></textarea></td>
    <td><input type="text" class="db-text-cell"></td>
  </tr>`).join('');
}

function extractTemplateCss(template: string): string {
  const match = template.match(/<style>([\s\S]*?)<\/style>/i);
  return match ? match[1] : '';
}

function extractTemplateBodyContent(template: string): string {
  const match = template.match(/<body>([\s\S]*?)<\/body>/i);
  return match ? match[1].trim() : template;
}

function composePageHtml(
  template: string,
  patient: PatientForMedicationList,
  termType: MedicationTermType,
  totalPages: number,
  facilityNameZh: string,
  headerLabel: string | null | undefined,
  tbodyRowsHtml: string
): string {
  const name = patient.中文姓名 || `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`;
  const allergies = patient.藥物敏感 ?? [];
  const isNKDA = allergies.length === 0;
  const allergyText = isNKDA ? '' : allergies.join('、');
  const hkid = formatHKID(patient.身份證號碼);

  let html = template;

  // Replace facility name in title
  html = html.replace(/<h1>善頤\(福群\)護老院<\/h1>/g, `<h1>${escapeHtml(facilityNameZh)}</h1>`);
  html = html.replace(/<title>院友服用藥物一覽表 - 善頤\(福群\)<\/title>/g, `<title>院友服用藥物一覽表 - ${escapeHtml(facilityNameZh)}</title>`);

  // Replace header label box (no logo)
  const labelHtml = (headerLabel !== null && headerLabel !== undefined)
    ? `<div class="${termType === 'short' ? 'short-term-box' : 'long-term-box'}">${escapeHtml(headerLabel)}</div>`
    : '';
  const newHeader = `<div class="header-section" style="position: relative;">
        ${labelHtml}
        <div class="title-box" style="margin-right: 0;">
            <h1>${escapeHtml(facilityNameZh)}</h1>
            <h2>院友服用藥物一覽表</h2>
        </div>
    </div>`;
  html = html.replace(
    /<div class="header-section">[\s\S]*?<\/div>\s*<\/div>/,
    newHeader
  );

  // Replace patient info inputs
  html = html.replace(
    /<td>院友姓名：<\/td>\s*<td><input type="text" class="db-line-input"><\/td>/,
    `<td>院友姓名：</td><td><input type="text" class="db-line-input" value="${escapeHtml(name)}"></td>`
  );
  html = html.replace(
    /<td>床號：<\/td>\s*<td><input type="text" class="db-line-input"><\/td>/,
    `<td>床號：</td><td><input type="text" class="db-line-input" value="${escapeHtml(getPrintBedNumber(patient))}"></td>`
  );
  html = html.replace(
    /<td>性別\/年齡：<\/td>\s*<td><input type="text" class="db-line-input"><\/td>/,
    `<td>性別/年齡：</td><td><input type="text" class="db-line-input" value="${escapeHtml(formatGenderAge(patient))}"></td>`
  );
  // 右上角「頁數」欄顯示該院友的總頁數
  html = html.replace(
    /<td>頁數：<\/td>\s*<td><input type="text" class="db-line-input"><\/td>/,
    `<td>頁數：</td><td><input type="text" class="db-line-input" value="${totalPages}"></td>`
  );

  // Replace allergy info
  const nkdaChecked = isNKDA ? 'checked' : '';
  html = html.replace(
    /<input type="checkbox" class="db-checkbox">NKDA/,
    `<input type="checkbox" class="db-checkbox" ${nkdaChecked}>NKDA`
  );
  html = html.replace(
    /<input type="checkbox" class="db-checkbox">如有：\s*<input type="text" class="db-line-input" style="width: 80px;">/,
    `<input type="checkbox" class="db-checkbox" ${isNKDA ? '' : 'checked'}>如有：<input type="text" class="db-line-input allergy-textarea" value="${escapeHtml(allergyText)}">`
  );
  // 身份證號碼欄寬度調整：須足夠容納「身份證號碼：」標籤 + 號碼，避免內容溢位蓋到藥物敏感底線
  html = html.replace(
    /<col style="width: 250px;"> <!-- 藥物敏感 -->\s*<col style="width: auto;">  <!-- 身份證號 -->/,
    `<col style="width: auto;"> <!-- 藥物敏感 --><col style="width: 240px;"> <!-- 身份證號 -->`
  );
  // 身份證號碼「標籤」無底線；「號碼」本身用 span 加底線，寬度按內容，不觸碰標籤
  html = html.replace(
    /<td\s+style="text-align:\s*right;\s*padding-right:\s*15px;?">\s*身份證號碼：\s*<input\s+type="text"\s+class="db-line-input"\s+style="width:\s*200px;?">\s*<\/td>/i,
    `<td style="text-align: right; padding-right: 15px;" class="id-number-cell">身份證號碼：<span class="id-number-text">${escapeHtml(hkid)}</span></td>`
  );

  // Replace main table rows（tbody 內容由 caller 提供：正式頁 = 真實列＋空白列；探針 = 量度用列）
  html = html.replace(
    /<tbody>[\s\S]*?<\/tbody>/,
    `<tbody>${tbodyRowsHtml}</tbody>`
  );

  // 底部頁碼固定顯示 2
  html = html.replace(
    /<div class="page-num">\s*\d+\s*<\/div>/g,
    `<div class="page-num">2</div>`
  );

  // Replace facility name in remaining title element if header replacement missed it
  html = html.replace(/<h1>善頤\(福群\)護老院<\/h1>/g, `<h1>${escapeHtml(facilityNameZh)}</h1>`);

  return extractTemplateBodyContent(html);
}

function renderPage(
  template: string,
  patient: PatientForMedicationList,
  prescriptions: MedicationPrescription[],
  termType: MedicationTermType,
  pageIndex: number,
  totalPages: number,
  facilityNameZh: string,
  headerLabel?: string | null,
  padRows?: number
): string {
  const rows = prescriptions.map(renderMedicationRow).join('')
    + renderEmptyRows(padRows ?? Math.max(0, MAX_ROWS_PER_PAGE - prescriptions.length));
  return composePageHtml(template, patient, termType, totalPages, facilityNameZh, headerLabel ?? null, rows);
}

// ---- 高度感知分頁：列高因內容彈性（長藥名/注意事項會令列變高），
// 用 hidden iframe 量度每列真實高度後，按頁預算彈性決定每頁列數（上限維持 24），
// 避免「列高咗但仲係硬塞 24 列」令頁尾（文件編碼/頁碼）超頁。量度失敗 fallback 固定 24 列。

const MM_TO_PX = 96 / 25.4;
const LIST_PAGE_CONTENT_PX = Math.round(287 * MM_TO_PX); // .container min-height（A4 直向減邊距）
const MAX_ROWS_PER_PAGE = 24;
const LIST_SAFETY_PX = Math.round(3 * MM_TO_PX);         // 3mm 安全邊距（渲染差異）

// 以開始日期先後排序（冇開始日期用處方日期；都冇就排最後，保持原有相對次序）
const sortByStartDate = (list: MedicationPrescription[]): MedicationPrescription[] => {
  const timeOf = (p: MedicationPrescription): number => {
    const d = p.start_date || p.prescription_date;
    const t = d ? new Date(d).getTime() : NaN;
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  };
  return [...list].sort((a, b) => timeOf(a) - timeOf(b));
};

interface ListLayoutMetrics {
  fixedPx: number;    // 標題＋院友資料表＋主表表頭＋頁尾
  emptyRowPx: number; // 空白列高度
  rowPx: number[];    // 每條真實處方列高度（與傳入列順序對應）
}

const lengthToPx = (value: string): number | null => {
  const m = value.match(/^([\d.]+)(mm|cm|in|pt|px)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'mm': return n * 96 / 25.4;
    case 'cm': return n * 96 / 2.54;
    case 'in': return n * 96;
    case 'pt': return n * 96 / 72;
    default: return n;
  }
};

// 可印寬度 = A4 闊（210mm）− @page 左右邊距。模板係 margin: 5mm 0.25in → 左右各 0.25in。
// 量度 iframe 必須用可印寬度：用成 794px 會令文字換行比真實列印少，量出嘅列高偏低，導致頁尾超頁。
export const printableWidthPx = (template: string): number => {
  const pageCss = template.match(/@page\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const marginDecl = pageCss.match(/margin\s*:\s*([^;}]+)/)?.[1].trim() ?? '';
  const parts = marginDecl.split(/\s+/).filter(Boolean);
  let horizontalPx = 0.25 * 96; // fallback：0.25in
  if (parts.length === 1) horizontalPx = lengthToPx(parts[0]) ?? horizontalPx;
  else if (parts.length === 2 || parts.length === 3) horizontalPx = lengthToPx(parts[1]) ?? horizontalPx;
  else if (parts.length >= 4) horizontalPx = lengthToPx(parts[3]) ?? horizontalPx;
  return Math.round(210 * 96 / 25.4) - Math.round(horizontalPx * 2);
};

const measureListLayout = async (
  template: string,
  patient: PatientForMedicationList,
  termType: MedicationTermType,
  facilityNameZh: string,
  headerLabel: string | null,
  realRowsHtml: string[]
): Promise<ListLayoutMetrics | null> => {
  if (typeof document === 'undefined' || realRowsHtml.length === 0) return null;
  // 探針頁 = 全部真實列 + 1 空白列（量 emptyRowPx）；唔補滿 24，因為只係量度
  const probeRows = [...realRowsHtml, renderEmptyRows(1)].join('');
  const pageHtml = composePageHtml(template, patient, termType, 1, facilityNameZh, headerLabel, probeRows);
  const css = `${extractTemplateCss(template)}\n${buildOverrideCss()}`;
  const html = `<!DOCTYPE html><html lang="zh-HK"><head><meta charset="UTF-8"><style>${css}</style></head><body>${pageHtml}</body></html>`;
  const probeWidth = printableWidthPx(template);
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${probeWidth}px;height:1123px;border:0;`;
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!win || !doc) { iframe.remove(); resolve(null); return; }
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      try {
        const px = (el: Element | null): number => (el ? el.getBoundingClientRect().height : 0);
        const fixedPx =
          px(doc.querySelector('.header-section'))
          + Array.from(doc.querySelectorAll('table.info-table')).reduce((s, el) => s + px(el), 0)
          + px(doc.querySelector('table.main-table thead'))
          + px(doc.querySelector('.footer'));
        const rows = Array.from(doc.querySelectorAll('tr.data-row')).map(px);
        const emptyRowPx = rows[rows.length - 1] || 0;
        const rowPx = rows.slice(0, realRowsHtml.length);
        resolve({ fixedPx, emptyRowPx, rowPx });
      } catch {
        resolve(null);
      }
      iframe.remove();
    };
    doc.open();
    doc.write(html);
    doc.close();
    Promise.race([
      (doc.fonts?.ready ?? Promise.resolve()).then(() => new Promise<void>((r) => setTimeout(r, 100))),
      new Promise<void>((r) => setTimeout(r, 4000)),
    ]).then(finish);
  });
};

// 按量度高度分頁：模板 .container 係 flex 欄 min-height:287mm、.footer margin-top:auto——
// footer 釘死頁底，空白列純粹裝飾。所以一頁只要求「真實列高度和 ≤ 頁預算」，
// 空白列盡量補滿 24 格（裝唔晒就補到嗰度），唔會因為 padding 塞唔晒就硬拆頁。冇量度則固定 24 列。
export interface ListPageGroup<T> {
  items: T[];
  padRows: number;
}

export const paginateListRows = <T,>(items: T[], metrics: ListLayoutMetrics | null): ListPageGroup<T>[] => {
  const fallbackPage = (slice: T[]): ListPageGroup<T> => ({
    items: slice,
    padRows: MAX_ROWS_PER_PAGE - slice.length,
  });
  if (!metrics || metrics.emptyRowPx <= 0) {
    const pages: ListPageGroup<T>[] = [];
    for (let i = 0; i < items.length; i += MAX_ROWS_PER_PAGE) pages.push(fallbackPage(items.slice(i, i + MAX_ROWS_PER_PAGE)));
    return pages.length > 0 ? pages : [fallbackPage([])];
  }
  const budgetPx = LIST_PAGE_CONTENT_PX - metrics.fixedPx - LIST_SAFETY_PX;
  const buildPage = (pageItems: T[], sumPx: number): ListPageGroup<T> => {
    const fit = Math.floor((budgetPx - sumPx) / metrics.emptyRowPx);
    const padRows = Math.max(0, Math.min(MAX_ROWS_PER_PAGE - pageItems.length, fit));
    return { items: pageItems, padRows };
  };
  const pages: ListPageGroup<T>[] = [];
  let current: T[] = [];
  let sumPx = 0;
  items.forEach((item, i) => {
    const h = metrics.rowPx[i] || metrics.emptyRowPx;
    if (current.length > 0 && (current.length >= MAX_ROWS_PER_PAGE || sumPx + h > budgetPx)) {
      pages.push(buildPage(current, sumPx));
      current = [];
      sumPx = 0;
    }
    current.push(item);
    sumPx += h;
  });
  if (current.length > 0) pages.push(buildPage(current, sumPx));
  return pages.length > 0 ? pages : [fallbackPage([])];
};

function buildOverrideCss(): string {
  return `
    /* 覆蓋：欄寬調整 */
    .col-drug { width: 45% !important; }
    .col-notice { width: 11% !important; }
    /* 藥物內容格（div 版 .db-text-cell）：行高自動伸縮、長藥名任意斷行、無滾動軸 */
    .db-text-div {
      width: 100%; border: none; background: transparent;
      font-family: inherit; font-size: 13px; text-align: left;
      padding: 2px 4px; box-sizing: border-box;
      white-space: pre-wrap; word-break: break-word; line-height: 1.25;
    }
    /* 覆蓋：標題區 */
    .title-box { margin-right: 0 !important; text-align: center; }
    .title-box h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
    .title-box h2 { margin: 4px 0 0 0; font-size: 22px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
    .header-section { position: relative; }
    .long-term-box, .short-term-box { position: absolute; left: 0; top: 0; margin-left: 0; border: 2px solid black; padding: 5px 15px; font-size: 22px; font-weight: bold; }
    .page-num { font-size: 24px !important; }
    .doc-code { font-size: 11px !important; align-self: flex-end; }
    /* 身份證號碼欄：標籤無底線，號碼本身保留底線，與標籤留小間距 */
    .id-number-cell {
      border: none !important;
      background-color: #fff;
    }
    .id-number-text {
      display: inline-block;
      font-size: 15px;
      text-align: left;
      margin-left: 3px;
      padding: 0 2px;
      border-bottom: 1px solid black !important;
    }
    /* 藥物敏感「如有」底線長度固定，不會因欄寬自動延伸而蓋過身份證號碼欄 */
    .allergy-textarea {
      width: 340px !important;
      margin-right: 20px !important;
      font-size: 15px !important;
      line-height: 1.2;
      padding: 0 5px;
      vertical-align: baseline;
      box-sizing: border-box;
    }
    .print-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
    .print-page .container { display: flex; flex-direction: column; }
    .print-page .footer { margin-top: auto !important; }
    @media print {
      .print-page { page-break-after: always; }
      .print-page:last-child { page-break-after: auto; }
    }
  `;
}

function assembleDocument(pages: string[], usedTemplates: string[]): string {
  if (pages.length === 0) return '';
  const css = usedTemplates.map(extractTemplateCss).join('\n');
  const wrapped = pages.map((pageHtml, index) => {
    const isLast = index === pages.length - 1;
    return `<div class="print-page" style="page-break-after: ${isLast ? 'auto' : 'always'};">${pageHtml}</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <title>院友服用藥物一覽表</title>
  <style>
    ${css}
    ${buildOverrideCss()}
  </style>
</head>
<body>
${wrapped}
</body>
</html>`;
}

export async function generateMedicationListHtml(
  patients: PatientWithPrescriptions[],
  options: {
    startDate?: string;
    endDate?: string;
    allowBlankPage?: boolean;
    /** 指定只產生短期或長期藥；未指定則兩者都產生 */
    termType?: MedicationTermType;
  } = {}
): Promise<string> {
  const facility = await getFacilitySettings();
  const facilityNameZh = facility.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;
  const allowBlankPage = options.allowBlankPage ?? false;
  const termType = options.termType;

  const pages: string[] = [];
  const usedTemplates: string[] = [];

  for (const patient of patients) {
    const allPrescriptions = patient.prescriptions ?? [];
    const filtered = allPrescriptions.filter(p => {
      return isPrescriptionInDateRange(p, options.startDate, options.endDate);
    });

    const shortTerm = filtered.filter(p => classifyMedicationTerm(p) === 'short');
    const longTerm = filtered.filter(p => classifyMedicationTerm(p) === 'long');

    const addPages = async (prescriptions: MedicationPrescription[], type: MedicationTermType) => {
      const template = type === 'short' ? shortTermTemplate : longTermTemplate;
      if (prescriptions.length === 0) {
        if (allowBlankPage) {
          if (!usedTemplates.includes(template)) {
            usedTemplates.push(template);
          }
          const label = type === 'short' ? '短期藥' : '長期藥';
          pages.push(renderPage(template, patient, [], type, 1, 1, facilityNameZh, label));
        }
        return;
      }
      if (!usedTemplates.includes(template)) {
        usedTemplates.push(template);
      }
      const label = type === 'short' ? '短期藥' : '長期藥';
      // 開始日期先後排序；高度感知分頁：量度每列實際高度， tall 列多就每頁少啲列，避免頁尾（文件編碼/頁碼）超頁
      const sorted = sortByStartDate(prescriptions);
      const realRowsHtml = sorted.map(renderMedicationRow);
      const metrics = await measureListLayout(template, patient, type, facilityNameZh, label, realRowsHtml);
      const pageGroups = paginateListRows(sorted, metrics);
      const totalPages = pageGroups.length;
      for (let i = 0; i < totalPages; i++) {
        pages.push(renderPage(template, patient, pageGroups[i].items, type, i + 1, totalPages, facilityNameZh, label, pageGroups[i].padRows));
      }
    };

    if (termType === 'short') {
      await addPages(shortTerm, 'short');
    } else if (termType === 'long') {
      await addPages(longTerm, 'long');
    } else {
      await addPages(shortTerm, 'short');
      await addPages(longTerm, 'long');
    }
  }

  return assembleDocument(pages, usedTemplates);
}

export async function exportMedicationListToHtml(
  patients: PatientWithPrescriptions[],
  options: {
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<void> {
  const html = await generateMedicationListHtml(patients, options);
  if (!html) {
    alert('沒有符合條件的藥物記錄');
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const cleanup = (): void => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
  const doc = iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow!;
  win.addEventListener('afterprint', () => setTimeout(cleanup, 200));
  const trigger = (): void => { window.setTimeout(() => { win.focus(); win.print(); }, 400); };
  if (doc.readyState === 'complete') { trigger(); }
  else { win.addEventListener('load', trigger); }
}

export { classifyMedicationTerm, isPrescriptionInDateRange };

function scopeCssForAttachment(css: string): string {
  return css
    .replace(/@page\s*\{[^}]*\}\s*/g, '')
    .replace(/body\b/g, '.medication-attachment')
    + `
/* Attachment overrides to match standalone medication-list rendering */
.medication-attachment .header-section { position: relative; }
.medication-attachment .long-term-box {
  position: absolute;
  left: 0;
  top: 0;
  margin-left: 0;
  border: 2px solid black;
  padding: 5px 15px;
  font-size: 22px;
  font-weight: bold;
}
.medication-attachment .title-box { margin-right: 0 !important; }
.medication-attachment .col-drug { width: 45% !important; }
.medication-attachment .col-notice { width: 11% !important; }
.medication-attachment .allergy-textarea {
  width: 250px !important;
  margin-right: 20px !important;
  font-size: 15px !important;
  line-height: 1.2;
  padding: 0 5px;
  vertical-align: baseline;
  box-sizing: border-box;
}
.medication-attachment .id-number-cell {
  border: none !important;
  background-color: #fff;
}
.medication-attachment .id-number-text {
  display: inline-block;
  font-size: 15px;
  text-align: left;
  margin-left: 3px;
  padding: 0 2px;
  border-bottom: 1px solid black !important;
}
`;
}

export async function generateMedicationListAttachment(
  patient: PatientForMedicationList,
  prescriptions: MedicationPrescription[]
): Promise<{ css: string; pages: string[] }> {
  const facility = await getFacilitySettings();
  const facilityNameZh = facility.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;

  const template = longTermTemplate;
  // 開始日期先後排序；高度感知分頁（同 generateMedicationListHtml）：量度列高後按頁預算裝列
  const sorted = sortByStartDate(prescriptions);
  const realRowsHtml = sorted.map(renderMedicationRow);
  const metrics = await measureListLayout(template, patient, 'long', facilityNameZh, null, realRowsHtml);
  const pageGroups = paginateListRows(sorted, metrics);
  const totalPages = pageGroups.length;
  const pages: string[] = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(renderPage(template, patient, pageGroups[i].items, 'long', i + 1, totalPages, facilityNameZh, null, pageGroups[i].padRows));
  }

  return { css: scopeCssForAttachment(extractTemplateCss(template)), pages };
}
