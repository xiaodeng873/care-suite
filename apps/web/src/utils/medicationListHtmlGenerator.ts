import { formatDisplayDate } from './dateFormat';
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
  special_dosage_instruction?: string;
  is_prn?: boolean;
  cannot_crush?: boolean;
  medication_source?: string;
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
  // 頻率以每日次數為準，沒有才按服用時間點數目推算（PRN 可每日3次但只設一個時間點）
  const perDay = p.daily_frequency || slots.length || p.frequency_value || 1;
  switch (p.frequency_type) {
    case 'daily': return dailyCount(perDay);
    case 'every_x_days': return `隔${p.frequency_value}日${perDay}次`;
    case 'every_x_weeks': return `隔${p.frequency_value}星期${perDay}次`;
    case 'every_x_months': return `隔${p.frequency_value}月${perDay}次`;
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
  if (p.dosage_form) parts.push(escapeHtml(p.dosage_form));
  if (p.dosage_amount != null && p.dosage_amount !== '') {
    parts.push(`${escapeHtml(String(p.dosage_amount))}${escapeHtml(p.dosage_unit ?? '')}`);
  }
  if (p.special_dosage_instruction) {
    parts.push(escapeHtml(p.special_dosage_instruction));
  }
  const freq = getFrequencyDescription(p);
  if (freq) parts.push(escapeHtml(freq));
  if (p.meal_timing) parts.push(escapeHtml(p.meal_timing));
  if (p.administration_route) parts.push(escapeHtml(p.administration_route));
  if (p.is_prn) parts.push('需要時');
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
    block_dispensing: '停服',
    warning_only: '警告',
  };
  return p.inspection_rules.map(r => {
    const op = opMap[r.condition_operator ?? ''] ?? '';
    const action = actionMap[r.action_if_met ?? ''] ?? r.action_if_met ?? '';
    return `${r.vital_sign_type ?? ''}${op}${r.condition_value ?? ''}${action}`;
  }).join(',');
}

function formatNoticeCell(p: MedicationPrescription): string {
  const parts: string[] = [];
  const inspection = formatInspectionRules(p);
  if (inspection) parts.push(inspection);
  if (p.cannot_crush) parts.push('不可碎藥');
  if (p.notes) parts.push(escapeHtml(p.notes));
  if (p.special_instructions) parts.push(escapeHtml(p.special_instructions));
  return parts.join(',');
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

function renderMedicationRow(p: MedicationPrescription): string {
  return `<tr class="data-row">
    <td><textarea class="db-text-cell">${formatDrugCell(p)}</textarea></td>
    <td><textarea class="db-text-cell" style="text-align:center;">${escapeHtml(p.medication_source ?? '')}</textarea></td>
    <td><input type="text" class="db-text-cell" style="text-align:center;" value="${escapeHtml(formatDate(p.start_date || p.prescription_date))}"></td>
    <td><input type="text" class="db-text-cell" style="text-align:center;" value="${escapeHtml(p.end_date ? formatDate(p.end_date) : '')}"></td>
    <td><textarea class="db-text-cell">${formatNoticeCell(p)}</textarea></td>
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

function renderPage(
  template: string,
  patient: PatientForMedicationList,
  prescriptions: MedicationPrescription[],
  termType: MedicationTermType,
  pageIndex: number,
  totalPages: number,
  facilityNameZh: string,
  headerLabel?: string | null
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
  // 右上角「頁數」欄顯示固定靜態頁碼 2
  html = html.replace(
    /<td>頁數：<\/td>\s*<td><input type="text" class="db-line-input"><\/td>/,
    `<td>頁數：</td><td><input type="text" class="db-line-input" value="2"></td>`
  );

  // Replace allergy info
  const nkdaChecked = isNKDA ? 'checked' : '';
  html = html.replace(
    /<input type="checkbox" class="db-checkbox">NKDA/,
    `<input type="checkbox" class="db-checkbox" ${nkdaChecked}>NKDA`
  );
  html = html.replace(
    /<input type="checkbox" class="db-checkbox">如有：\s*<input type="text" class="db-line-input" style="width: 80px;">/,
    `<input type="checkbox" class="db-checkbox" ${isNKDA ? '' : 'checked'}>如有：<textarea class="db-line-input allergy-textarea" rows="2" style="width: 160px;">${escapeHtml(allergyText)}</textarea>`
  );
  html = html.replace(
    /<td style="text-align: right; padding-right: 15px;">\s*身份證號碼：<input type="text" class="db-line-input" style="width: 200px;">\s*<\/td>/,
    `<td style="text-align: right; padding-right: 15px;">身份證號碼：<input type="text" class="db-line-input" style="width: 200px;" value="${escapeHtml(hkid)}"></td>`
  );

  // Replace main table rows
  const rows = prescriptions.map(renderMedicationRow).join('') + renderEmptyRows(Math.max(0, 24 - prescriptions.length));
  html = html.replace(
    /<tbody>[\s\S]*?<\/tbody>/,
    `<tbody>${rows}</tbody>`
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
    /* 覆蓋：欄寬調整 */
    .col-drug { width: 45% !important; }
    .col-notice { width: 11% !important; }
    /* 覆蓋：標題區 */
    .title-box { margin-right: 0 !important; text-align: center; }
    .title-box h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 2px; }
    .title-box h2 { margin: 4px 0 0 0; font-size: 22px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
    .header-section { position: relative; }
    .long-term-box, .short-term-box { position: absolute; left: 0; top: 0; margin-left: 0; border: 2px solid black; padding: 5px 15px; font-size: 22px; font-weight: bold; }
    .page-num { font-size: 24px !important; }
    .doc-code { font-size: 11px !important; align-self: flex-end; }
    /* 覆蓋：藥物敏感「如有」輸入框加長，支援兩行小字 */
    .allergy-textarea {
      width: 160px !important;
      min-height: 28px;
      font-size: 7.5px !important;
      line-height: 1.2;
      vertical-align: bottom;
      resize: none;
      overflow: hidden;
    }
    .print-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
    .print-page .container { display: flex; flex-direction: column; }
    .print-page .footer { margin-top: auto !important; }
    @media print {
      .print-page { page-break-after: always; }
      .print-page:last-child { page-break-after: auto; }
    }
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

    const addPages = (prescriptions: MedicationPrescription[], type: MedicationTermType) => {
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
      const totalPages = Math.ceil(prescriptions.length / 24);
      const label = type === 'short' ? '短期藥' : '長期藥';
      for (let i = 0; i < totalPages; i++) {
        const pagePrescriptions = prescriptions.slice(i * 24, (i + 1) * 24);
        pages.push(renderPage(template, patient, pagePrescriptions, type, i + 1, totalPages, facilityNameZh, label));
      }
    };

    if (termType === 'short') {
      addPages(shortTerm, 'short');
    } else if (termType === 'long') {
      addPages(longTerm, 'long');
    } else {
      addPages(shortTerm, 'short');
      addPages(longTerm, 'long');
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
.medication-attachment .title-box { margin-right: 0 !important; }
.medication-attachment .col-drug { width: 45% !important; }
.medication-attachment .col-notice { width: 11% !important; }
.medication-attachment .allergy-textarea {
  width: 160px !important;
  min-height: 28px;
  font-size: 7.5px !important;
  line-height: 1.2;
  vertical-align: bottom;
  resize: none;
  overflow: hidden;
}`;
}

export async function generateMedicationListAttachment(
  patient: PatientForMedicationList,
  prescriptions: MedicationPrescription[]
): Promise<{ css: string; pages: string[] }> {
  const facility = await getFacilitySettings();
  const facilityNameZh = facility.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;

  const template = longTermTemplate;
  const totalPages = Math.max(1, Math.ceil(prescriptions.length / 24));
  const pages: string[] = [];
  for (let i = 0; i < totalPages; i++) {
    const pagePrescriptions = prescriptions.slice(i * 24, (i + 1) * 24);
    pages.push(renderPage(template, patient, pagePrescriptions, 'long', i + 1, totalPages, facilityNameZh, null));
  }

  return { css: scopeCssForAttachment(extractTemplateCss(template)), pages };
}
