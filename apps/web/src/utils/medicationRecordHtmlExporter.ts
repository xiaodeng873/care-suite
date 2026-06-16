import sheet001Html from '../assets/medication-record-template/sheet001.htm?raw';
import sheet002Html from '../assets/medication-record-template/sheet002.htm?raw';
import sheet003Html from '../assets/medication-record-template/sheet003.htm?raw';
import templateStylesheet from '../assets/medication-record-template/stylesheet.css?raw';
import {
  extractStaffNamesFromWorkflowRecords,
  fetchWorkflowRecordsForMonth,
  formatDispenseCellContent,
  formatWorkflowCellContent,
  generateStaffCodeMapping,
  getWorkflowRecordForPrescriptionDateTimeSlot,
  type StaffCodeMapping,
  type WorkflowRecord,
} from './medicationWorkflowHelper';

// 此匯出器嚴格使用上傳的 Excel HTML 範本 (sheet001/002/003.htm + stylesheet.css)。
// 版面、字型、欄寬、線條完全來自原始檔，程式只負責把資料填入既有儲存格。

type RouteKind = 'oral' | 'topical' | 'injection';
type MedicationPrescription = Record<string, any>;
type PatientWithPrescriptions = Record<string, any> & { prescriptions?: MedicationPrescription[] };

interface TemplateConfig {
  routeKind: RouteKind;
  sheetHtml: string;
}

interface PageData {
  patient: PatientWithPrescriptions;
  routeKind: RouteKind;
  prescriptions: MedicationPrescription[];
}

const TEMPLATE_CONFIGS: TemplateConfig[] = [
  { routeKind: 'oral', sheetHtml: sheet001Html },
  { routeKind: 'topical', sheetHtml: sheet002Html },
  { routeKind: 'injection', sheetHtml: sheet003Html },
];

// 第一頁固定 38 列 (table.rows 索引 0-37)。
const FIRST_PAGE_ROW_COUNT = 38;
const PRESCRIPTIONS_PER_PAGE = 5;
// 每個處方區塊的起始列 (table.rows 索引)。
const BLOCK_START_ROWS = [6, 11, 16, 21, 26];
// 底部「給藥簽署」總結區起始列。
const DISPENSE_START_ROW = 31;
const DISPENSE_ROW_COUNT = 6;
const DAY_COUNT = 31;

// 表頭儲存格位置 (rowIndex, cellIndex) — 由原始範本實際結構推導。
const HEADER_CELLS = {
  allergy: { row: 0, cell: 1 }, // B1 藥物敏感
  name: { row: 0, cell: 4 }, // AF1 姓名
  bedNumber: { row: 0, cell: 8 }, // AO1 床號 (顯示於「院號」格)
  genderAge: { row: 1, cell: 2 }, // AF2 性別/年齡
  birthDate: { row: 1, cell: 6 }, // AO2 出生日期
  adverseReaction: { row: 2, cell: 1 }, // B3 不良藥物反應
};

export const exportMedicationRecordToHtml = async (
  patients: PatientWithPrescriptions[],
  selectedMonth: string,
  includeWorkflowRecords = false
): Promise<void> => {
  const html = await buildMedicationRecordHtml(patients, selectedMonth, includeWorkflowRecords);
  openHtmlInNewWindow(html);
};

export const exportSelectedMedicationRecordToHtml = async (
  patient: PatientWithPrescriptions,
  prescriptions: MedicationPrescription[],
  selectedMonth: string,
  includeWorkflowRecords = false
): Promise<void> => {
  await exportMedicationRecordToHtml([{ ...patient, prescriptions }], selectedMonth, includeWorkflowRecords);
};

const buildMedicationRecordHtml = async (
  patients: PatientWithPrescriptions[],
  selectedMonth: string,
  includeWorkflowRecords: boolean
): Promise<string> => {
  const renderedPages: string[] = [];

  for (const patient of patients) {
    const prescriptions = patient.prescriptions ?? [];

    let workflowRecords: WorkflowRecord[] = [];
    if (includeWorkflowRecords && prescriptions.length > 0) {
      const prescriptionIds = prescriptions.map((prescription) => prescription.id);
      workflowRecords = await fetchWorkflowRecordsForMonth(patient.院友id, prescriptionIds, selectedMonth);
    }
    const staffMapping = generateStaffCodeMapping(extractStaffNamesFromWorkflowRecords(workflowRecords));

    for (const page of preparePages(patient, prescriptions)) {
      renderedPages.push(renderPage(page, selectedMonth, workflowRecords, staffMapping));
    }
  }

  return assembleDocument(renderedPages);
};

const preparePages = (patient: PatientWithPrescriptions, prescriptions: MedicationPrescription[]): PageData[] => {
  const categorized: Record<RouteKind, MedicationPrescription[]> = { oral: [], topical: [], injection: [] };
  for (const prescription of prescriptions) {
    categorized[classifyRoute(prescription)].push(prescription);
  }

  const pages: PageData[] = [];
  for (const config of TEMPLATE_CONFIGS) {
    const routePrescriptions = categorized[config.routeKind];
    for (let start = 0; start < routePrescriptions.length; start += PRESCRIPTIONS_PER_PAGE) {
      pages.push({
        patient,
        routeKind: config.routeKind,
        prescriptions: routePrescriptions.slice(start, start + PRESCRIPTIONS_PER_PAGE),
      });
    }
  }
  return pages;
};

const classifyRoute = (prescription: MedicationPrescription): RouteKind => {
  const route = String(prescription.administration_route ?? '').trim();
  if (route === '注射') return 'injection';
  if (route === '口服') return 'oral';
  if (!route) return 'oral';
  return 'topical';
};

const renderPage = (
  page: PageData,
  selectedMonth: string,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping
): string => {
  const config = TEMPLATE_CONFIGS.find((template) => template.routeKind === page.routeKind) ?? TEMPLATE_CONFIGS[0];
  const table = parseFirstPageTable(config.sheetHtml);

  const rows = Array.from(table.rows);
  fillHeader(rows, page.patient);
  fillPrescriptionBlocks(rows, page, selectedMonth, workflowRecords, staffMapping);
  fillDispenseSummary(rows, page, selectedMonth, workflowRecords, staffMapping);

  return `<div class="medication-record-page">${table.outerHTML}</div>`;
};

// 用瀏覽器 DOMParser 解析原始 Excel HTML，取出主表並只保留第一頁 (前 38 列)。
// 字元實體 (&#xXXXX;) 由 DOMParser 正確解碼；windows-1252 的 0xA0 在 Vite ?raw 讀取時
// 變成 U+FFFD，這裡還原為不換行空格，避免亂碼。
const parseFirstPageTable = (sheetHtml: string): HTMLTableElement => {
  const cleaned = sheetHtml.replace(/\uFFFD/g, '\u00a0');
  const doc = new DOMParser().parseFromString(cleaned, 'text/html');
  const table = doc.querySelector('body > table') as HTMLTableElement | null;
  if (!table) {
    throw new Error('個人備藥及給藥記錄範本缺少主表格');
  }

  const allRows = Array.from(table.rows);
  for (let index = allRows.length - 1; index >= FIRST_PAGE_ROW_COUNT; index -= 1) {
    allRows[index].remove();
  }
  return table;
};

const fillHeader = (rows: HTMLTableRowElement[], patient: PatientWithPrescriptions): void => {
  const name = patient.中文姓氏 != null || patient.中文名字 != null
    ? `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`
    : (patient.中文姓名 ?? '');

  setCellText(rows, HEADER_CELLS.allergy, joinList(patient.藥物敏感));
  setCellText(rows, HEADER_CELLS.name, name);
  setCellText(rows, HEADER_CELLS.bedNumber, patient.床號 ?? '');
  setCellText(rows, HEADER_CELLS.genderAge, formatGenderAge(patient));
  setCellText(rows, HEADER_CELLS.birthDate, formatDate(patient.出生日期));
  setCellText(rows, HEADER_CELLS.adverseReaction, joinList(patient.不良藥物反應));
};

const fillPrescriptionBlocks = (
  rows: HTMLTableRowElement[],
  page: PageData,
  selectedMonth: string,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping
): void => {
  const daysInMonth = getDaysInMonth(selectedMonth);

  page.prescriptions.forEach((prescription, index) => {
    const blockStart = BLOCK_START_ROWS[index];
    if (blockStart === undefined) return;

    // 區塊標頭列：處方日期 / 藥物名稱 / 途徑。
    setCellText(rows, { row: blockStart, cell: 0 }, formatDate(prescription.prescription_date));
    setCellText(rows, { row: blockStart, cell: 1 }, prescription.medication_name ?? '');
    setCellText(rows, { row: blockStart, cell: 2 }, prescription.administration_route ?? '');

    // 途徑/次數欄 (各資料列 cell[1])：頻率 / 份量 / 需要時。
    setCellText(rows, { row: blockStart + 1, cell: 1 }, getFrequencyDescription(prescription));
    setCellText(rows, { row: blockStart + 2, cell: 1 }, getDosageText(prescription));
    setCellText(rows, { row: blockStart + 3, cell: 1 }, prescription.is_prn ? '需要時' : '');
    if (prescription.medication_source) {
      setCellText(rows, { row: blockStart + 4, cell: 0 }, `藥物來源: ${prescription.medication_source}`);
    }

    const timeSlots: string[] = prescription.medication_time_slots ?? [];
    const timeSlotsMap = mapTimeSlots(timeSlots, page.routeKind);

    Object.entries(timeSlotsMap).forEach(([offsetText, slots]) => {
      const offset = Number(offsetText);
      if (page.routeKind === 'injection' && offset === 2) return; // 注射類不觸碰第 2 列

      const slotRow = blockStart + offset;
      // 服用時間欄 (cell[2])。
      setCellText(rows, { row: slotRow, cell: 2 }, slots.join(', '));

      // 逐日 執/核 簽署：cell 索引 = 2 + day。
      for (let day = 1; day <= daysInMonth; day += 1) {
        const dateStr = toDateString(selectedMonth, day);
        const representativeSlot = slots[0];
        if (!isDateInPrescriptionRange(dateStr, representativeSlot, prescription)) continue;

        const record = getWorkflowRecordForPrescriptionDateTimeSlot(
          workflowRecords,
          prescription.id,
          dateStr,
          representativeSlot
        );
        const content = formatWorkflowCellContent(record, staffMapping);
        if (content) {
          setCellHtml(rows, { row: slotRow, cell: 2 + day }, escapeHtml(content));
        }
      }
    });
  });
};

const fillDispenseSummary = (
  rows: HTMLTableRowElement[],
  page: PageData,
  selectedMonth: string,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping
): void => {
  const daysInMonth = getDaysInMonth(selectedMonth);
  const pageTimeSlots = [...new Set(page.prescriptions.flatMap((prescription) => prescription.medication_time_slots ?? []))]
    .sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b))
    .slice(0, DISPENSE_ROW_COUNT);

  pageTimeSlots.forEach((timeSlot, timeSlotIndex) => {
    const rowIndex = DISPENSE_START_ROW + timeSlotIndex;
    // 第一列 (R31) 多了「給藥簽署」標籤格，日格索引 = 2 + day；其後列為 1 + day。
    const dayCellBase = rowIndex === DISPENSE_START_ROW ? 2 : 1;

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = toDateString(selectedMonth, day);
      let dispenseContent = '';

      for (const prescription of page.prescriptions) {
        if (!(prescription.medication_time_slots ?? []).includes(timeSlot)) continue;
        if (!isDateInPrescriptionRange(dateStr, timeSlot, prescription)) continue;

        if (prescription.preparation_method === 'custom') {
          dispenseContent = 'S';
          break;
        }
        const record = getWorkflowRecordForPrescriptionDateTimeSlot(workflowRecords, prescription.id, dateStr, timeSlot);
        const content = formatDispenseCellContent(record, staffMapping);
        if (content) {
          dispenseContent = content;
          break;
        }
      }

      if (dispenseContent) {
        setCellHtml(rows, { row: rowIndex, cell: dayCellBase + day }, escapeHtml(dispenseContent));
      }
    }
  });
};

// ---- 資料對映輔助 (與 Excel 匯出器一致) ----

const mapTimeSlots = (timeSlots: string[], routeKind: RouteKind): Record<number, string[]> => {
  const map: Record<number, string[]> = {};

  if (routeKind === 'injection') {
    timeSlots.forEach((slot) => {
      (map[1] ??= []).push(slot);
    });
    return map;
  }

  if (shouldBreakTimeRangeRule(timeSlots)) {
    return mapTimeSlotsSequentially(timeSlots);
  }

  timeSlots.forEach((slot) => {
    const offset = getTimeSlotRowOffset(slot);
    (map[offset] ??= []).push(slot);
  });
  return map;
};

const getTimeSlotRowOffset = (timeStr: string): number => {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes < 0) return 1;
  if (minutes >= 7 * 60 && minutes < 12 * 60) return 1;
  if (minutes >= 12 * 60 && minutes < 16 * 60) return 2;
  if (minutes >= 16 * 60 && minutes < 20 * 60) return 3;
  if (minutes >= 20 * 60 && minutes <= 22 * 60) return 4;
  return 1;
};

const shouldBreakTimeRangeRule = (timeSlots: string[]): boolean => {
  const rangeCounts = [0, 0, 0, 0];
  timeSlots.forEach((timeSlot) => {
    const minutes = parseTimeToMinutes(timeSlot);
    if (minutes >= 7 * 60 && minutes < 12 * 60) rangeCounts[0] += 1;
    else if (minutes >= 12 * 60 && minutes < 16 * 60) rangeCounts[1] += 1;
    else if (minutes >= 16 * 60 && minutes < 20 * 60) rangeCounts[2] += 1;
    else if (minutes >= 20 * 60 && minutes <= 22 * 60) rangeCounts[3] += 1;
  });
  return rangeCounts.some((count) => count >= 2);
};

const mapTimeSlotsSequentially = (timeSlots: string[]): Record<number, string[]> => {
  const sorted = [...timeSlots].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
  const map: Record<number, string[]> = {};
  sorted.slice(0, 4).forEach((slot, index) => {
    map[index + 1] = [slot];
  });
  return map;
};

const parseTimeToMinutes = (timeStr: string): number => {
  const match = String(timeStr ?? '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return -1;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
};

const getFrequencyDescription = (prescription: MedicationPrescription): string => {
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, medication_time_slots } = prescription;
  const abbreviation = (count: number): string => {
    switch (count) {
      case 1: return 'QD';
      case 2: return 'BD';
      case 3: return 'TDS';
      case 4: return 'QID';
      default: return `${count}次/日`;
    }
  };
  const timeSlotsCount = medication_time_slots?.length ?? 0;

  switch (frequency_type) {
    case 'every_x_days': return `隔${frequency_value}日服`;
    case 'every_x_months': return `隔${frequency_value}月服`;
    case 'weekly_days': {
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') ?? '';
      return `逢${days}服`;
    }
    case 'odd_even_days':
      return is_odd_even_day === 'odd' ? '單日服' : is_odd_even_day === 'even' ? '雙日服' : '單雙日服';
    case 'hourly': return `每${frequency_value}小時服用`;
    case 'daily':
    default: return abbreviation(timeSlotsCount);
  }
};

const getDosageText = (prescription: MedicationPrescription): string => {
  if (prescription.special_dosage_instruction) return prescription.special_dosage_instruction;
  if (prescription.dosage_amount) return `每次${prescription.dosage_amount}${prescription.dosage_unit ?? ''}`;
  return '';
};

const isDateInPrescriptionRange = (dateStr: string, timeSlot: string | undefined, prescription: MedicationPrescription): boolean => {
  const checkDate = new Date(dateStr);
  const startDate = prescription.start_date ? new Date(prescription.start_date) : null;
  const endDate = prescription.end_date ? new Date(prescription.end_date) : null;
  const normalizeTime = (time: string | null | undefined): string => (time ? time.substring(0, 5) : '00:00');
  const startTime = normalizeTime(prescription.start_time) || '00:00';
  const endTime = normalizeTime(prescription.end_time) || '23:59';
  const normalizedTimeSlot = normalizeTime(timeSlot);

  if (startDate) {
    if (checkDate < startDate) return false;
    if (dateStr === prescription.start_date && normalizedTimeSlot < startTime) return false;
  }
  if (endDate) {
    if (checkDate > endDate) return false;
    if (dateStr === prescription.end_date && normalizedTimeSlot > endTime) return false;
  }
  return true;
};

// ---- DOM 與格式化輔助 ----

const setCellText = (
  rows: HTMLTableRowElement[],
  position: { row: number; cell: number },
  value: string
): void => {
  const cell = rows[position.row]?.cells[position.cell];
  if (!cell) return;
  cell.textContent = value && value.length > 0 ? value : '\u00a0';
};

const setCellHtml = (
  rows: HTMLTableRowElement[],
  position: { row: number; cell: number },
  html: string
): void => {
  const cell = rows[position.row]?.cells[position.cell];
  if (!cell) return;
  cell.innerHTML = html && html.length > 0 ? html : '&nbsp;';
};

const formatGenderAge = (patient: PatientWithPrescriptions): string => {
  const gender = patient.性別 ?? '';
  const age = calculateAge(patient.出生日期);
  if (!gender && !age) return '';
  return age ? `${gender}/${age}` : `${gender}`;
};

const calculateAge = (birthDate: unknown): string => {
  if (!birthDate) return '';
  const date = new Date(String(birthDate));
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age > 0 ? String(age) : '';
};

const formatDate = (value: unknown): string => {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('zh-TW');
};

const toDateString = (selectedMonth: string, day: number): string => `${selectedMonth}-${String(day).padStart(2, '0')}`;

const getDaysInMonth = (selectedMonth: string): number => {
  const [year, month] = selectedMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

const joinList = (values: unknown): string => (Array.isArray(values) && values.length > 0 ? values.join('、') : '');

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const assembleDocument = (renderedPages: string[]): string => `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<style>
${templateStylesheet}
@page { size: landscape; margin: 0.2in 0in 0in 0.04in; }
html, body { margin: 0; padding: 0; background: #fff; }
.medication-record-page { page-break-after: always; }
.medication-record-page:last-child { page-break-after: auto; }
@media print {
  .medication-record-page { page-break-after: always; }
  .medication-record-page:last-child { page-break-after: auto; }
}
</style>
</head>
<body link="blue" vlink="purple">
${renderedPages.join('\n')}
</body>
</html>`;

const openHtmlInNewWindow = (html: string): void => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, '_blank');

  if (!popup) {
    const link = document.createElement('a');
    link.href = url;
    link.download = '個人備藥及給藥記錄.html';
    link.click();
  }

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
