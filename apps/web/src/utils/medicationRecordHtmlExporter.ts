import type { Patient, Prescription } from '../lib/database';
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

type RouteKind = 'oral' | 'topical' | 'injection';
type MedicationPrescription = Prescription & Record<string, any>;
type PatientWithPrescriptions = Patient & { prescriptions?: MedicationPrescription[] };

interface TemplateConfig {
  routeKind: RouteKind;
  title: string;
  sheetHtml: string;
}

interface PageData {
  patient: PatientWithPrescriptions;
  routeKind: RouteKind;
  prescriptions: MedicationPrescription[];
  pageNumber: number;
  totalPages: number;
}

const TEMPLATE_CONFIGS: TemplateConfig[] = [
  { routeKind: 'oral', title: '個人備藥及給藥記錄 (口服)', sheetHtml: sheet001Html },
  { routeKind: 'topical', title: '個人備藥及給藥記錄 (外用)', sheetHtml: sheet002Html },
  { routeKind: 'injection', title: '個人備藥及給藥記錄 (注射)', sheetHtml: sheet003Html },
];

const PRESCRIPTIONS_PER_PAGE = 5;
const FIRST_PAGE_ROW_COUNT = 38;
const BLOCK_START_ROWS = [7, 12, 17, 22, 27];
const DAY_COUNT = 31;
const DAY_CELL_START = 3;
const SIGNATURE_ROW_RANGE = [32, 33, 34, 35, 36];

const ROUTE_LABELS: Record<RouteKind, string> = {
  oral: '口服藥物',
  topical: '外用藥物',
  injection: '注射藥物',
};

const TIME_SLOTS = ['08:00', '12:00', '18:00', '22:00'];

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
    const workflowRecords = includeWorkflowRecords
      ? await fetchWorkflowRecordsForMonth(patient.院友id, prescriptions.map((prescription) => getPrescriptionId(prescription)), selectedMonth)
      : [];
    const staffMapping = generateStaffCodeMapping(extractStaffNamesFromWorkflowRecords(workflowRecords));

    const pages = preparePages(patient, prescriptions);
    for (const page of pages) {
      renderedPages.push(renderPage(page, selectedMonth, workflowRecords, staffMapping));
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>個人備藥及給藥記錄</title>
<style>
${normalizeExcelHtml(templateStylesheet)}
.medication-record-page { page-break-after: always; }
.medication-record-page:last-child { page-break-after: auto; }
@media print { .medication-record-page { page-break-after: always; } .medication-record-page:last-child { page-break-after: auto; } }
</style>
</head>
<body link=blue vlink=purple>
${renderedPages.join('\n')}
</body>
</html>`;
};

const preparePages = (patient: PatientWithPrescriptions, prescriptions: MedicationPrescription[]): PageData[] => {
  const categorized = categorizePrescriptionsByRoute(prescriptions);
  const pages: PageData[] = [];

  for (const config of TEMPLATE_CONFIGS) {
    const routePrescriptions = categorized[config.routeKind];
    if (routePrescriptions.length === 0) continue;

    const totalPages = Math.ceil(routePrescriptions.length / PRESCRIPTIONS_PER_PAGE);
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const startIndex = (pageNumber - 1) * PRESCRIPTIONS_PER_PAGE;
      pages.push({
        patient,
        routeKind: config.routeKind,
        prescriptions: routePrescriptions.slice(startIndex, startIndex + PRESCRIPTIONS_PER_PAGE),
        pageNumber,
        totalPages,
      });
    }
  }

  return pages;
};

const renderPage = (
  page: PageData,
  selectedMonth: string,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping
): string => {
  const config = TEMPLATE_CONFIGS.find((template) => template.routeKind === page.routeKind) ?? TEMPLATE_CONFIGS[0];
  const tableHtml = extractFirstPageTable(config.sheetHtml);
  const tableOpen = tableHtml.match(/<table\b[\s\S]*?(?=<tr\b)/i)?.[0] ?? '';
  const rows = [...tableHtml.matchAll(/<tr\b[\s\S]*?(?=<tr\b|<\/table>)/gi)].map((match) => match[0]);

  fillHeader(rows, page, selectedMonth);
  fillPrescriptionBlocks(rows, page, selectedMonth, workflowRecords, staffMapping);
  fillSignatureRows(rows, page, selectedMonth, workflowRecords, staffMapping);

  return `<div class="medication-record-page">${tableOpen}${rows.join('\n')}\n</table></div>`;
};

const fillHeader = (rows: string[], page: PageData, selectedMonth: string): void => {
  const patient = page.patient;
  const headerInfo = [
    `姓名：${patient.中文姓名 ?? ''}`,
    `院號：${patient.院友id ?? ''}`,
    `床號：${patient.床號 ?? ''}`,
    `${formatYearMonth(selectedMonth)}`,
    `第 ${page.pageNumber}/${page.totalPages} 頁`,
  ].filter((item) => !item.endsWith('：')).join('&nbsp;&nbsp;');

  setRowCellContent(rows, 0, 1, joinList(patient.藥物敏感));
  setRowCellContent(rows, 2, 0, ROUTE_LABELS[page.routeKind]);
  setRowCellContent(rows, 2, 1, `性別 /年齡: ${patient.性別 ?? ''}${calculateAge(patient.出生日期) ? ` / ${calculateAge(patient.出生日期)}` : ''}`);
  setRowCellContent(rows, 2, 3, escapeHtml(headerInfo));
  setRowCellContent(rows, 2, 5, `出生日期：${escapeHtml(formatDate(patient.出生日期))}`);
  setRowCellContent(rows, 3, 1, joinList(patient.不良藥物反應));
};

const fillPrescriptionBlocks = (
  rows: string[],
  page: PageData,
  selectedMonth: string,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping
): void => {
  page.prescriptions.forEach((prescription, index) => {
    const startRow = BLOCK_START_ROWS[index];
    if (startRow === undefined) return;

    setRowCellContent(rows, startRow, 0, escapeHtml(formatDate(getPrescriptionStartDate(prescription))));
    setRowCellContent(rows, startRow, 1, formatPrescriptionName(prescription));
    setRowCellContent(rows, startRow, 2, formatRouteFrequency(prescription));

    const slots = getPrescriptionTimeSlots(prescription);
    for (let slotIndex = 0; slotIndex < 4; slotIndex += 1) {
      const rowIndex = startRow + 1 + slotIndex;
      setRowCellContent(rows, rowIndex, 1, escapeHtml(slots[slotIndex] ?? ''));

      for (let day = 1; day <= DAY_COUNT; day += 1) {
        const date = toDateString(selectedMonth, day);
        const content = getWorkflowCellContent(prescription, date, slots[slotIndex], workflowRecords, staffMapping);
        setRowCellContent(rows, rowIndex, DAY_CELL_START + day - 1, escapeHtml(content) || '&nbsp;');
      }
    }
  });
};

const fillSignatureRows = (
  rows: string[],
  page: PageData,
  selectedMonth: string,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping
): void => {
  for (const rowIndex of SIGNATURE_ROW_RANGE) {
    for (let day = 1; day <= DAY_COUNT; day += 1) {
      const date = toDateString(selectedMonth, day);
      const content = page.prescriptions
        .map((prescription) => getDispenseCellContent(prescription, date, workflowRecords, staffMapping))
        .filter(Boolean);
      setRowCellContent(rows, rowIndex, DAY_CELL_START + day - 1, unique(content).map(escapeHtml).join('<br>') || '&nbsp;');
    }
  }
};

const getWorkflowCellContent = (
  prescription: MedicationPrescription,
  date: string,
  timeSlot: string | undefined,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping
): string => {
  if (!isDateInPrescriptionRange(prescription, date)) return '';
  if (!timeSlot) return '';

  const record = getWorkflowRecordForPrescriptionDateTimeSlot(
    workflowRecords,
    getPrescriptionId(prescription),
    date,
    timeSlot
  );
  return formatWorkflowCellContent(record, staffMapping);
};

const getDispenseCellContent = (
  prescription: MedicationPrescription,
  date: string,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping
): string => {
  if (!isDateInPrescriptionRange(prescription, date)) return '';

  const record = workflowRecords.find((workflowRecord) =>
    workflowRecord.prescription_id === getPrescriptionId(prescription) && workflowRecord.scheduled_date === date
  ) ?? null;

  return formatDispenseCellContent(record, staffMapping);
};

const categorizePrescriptionsByRoute = (prescriptions: MedicationPrescription[]): Record<RouteKind, MedicationPrescription[]> => {
  const categorized: Record<RouteKind, MedicationPrescription[]> = { oral: [], topical: [], injection: [] };

  for (const prescription of prescriptions) {
    categorized[classifyRoute(prescription)].push(prescription);
  }

  return categorized;
};

const classifyRoute = (prescription: MedicationPrescription): RouteKind => {
  const route = String(prescription.administration_route ?? prescription.服用途徑 ?? '');
  if (route.includes('注射')) return 'injection';
  if (route.includes('口服')) return 'oral';
  return 'topical';
};

const extractFirstPageTable = (html: string): string => {
  const normalized = normalizeExcelHtml(html);
  const tableStart = normalized.indexOf('<table border=0');
  const tableEnd = normalized.lastIndexOf('</table>');

  if (tableStart < 0 || tableEnd < 0) {
    throw new Error('個人備藥及給藥記錄 HTML 範本缺少 Excel table');
  }

  const tableHtml = normalized.slice(tableStart, tableEnd + '</table>'.length);
  const tableOpen = tableHtml.match(/<table\b[\s\S]*?(?=<tr\b)/i)?.[0] ?? '';
  const rows = [...tableHtml.matchAll(/<tr\b[\s\S]*?(?=<tr\b|<\/table>)/gi)].map((match) => match[0]);
  return `${tableOpen}${rows.slice(0, FIRST_PAGE_ROW_COUNT).join('\n')}\n</table>`;
};

const setRowCellContent = (rows: string[], rowIndex: number, cellIndex: number, content: string): void => {
  if (!rows[rowIndex]) return;
  let currentCellIndex = -1;

  rows[rowIndex] = rows[rowIndex].replace(/<td\b([^>]*)>[\s\S]*?<\/td>/gi, (cell, attributes) => {
    currentCellIndex += 1;
    if (currentCellIndex !== cellIndex) return cell;
    return `<td${attributes}>${content || '&nbsp;'}</td>`;
  });
};

const normalizeExcelHtml = (html: string): string => html
  .replace(/charset=windows-1252/gi, 'charset=UTF-8')
  .replace(/<meta[^>]*charset=[^>]*>/i, '<meta charset="UTF-8">')
  .replace(/&#(x?[0-9a-fA-F]+);/g, (_, value: string) => {
    const codePoint = value.toLowerCase().startsWith('x') ? parseInt(value.slice(1), 16) : parseInt(value, 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
  });

const formatPrescriptionName = (prescription: MedicationPrescription): string => {
  const name = prescription.medication_name ?? prescription.藥物名稱 ?? '';
  const form = prescription.dosage_form ?? prescription.劑型 ?? '';
  const dose = prescription.dosage ?? prescription.服用份量 ?? '';
  return [name, form, dose].filter(Boolean).map(escapeHtml).join('<br>');
};

const formatRouteFrequency = (prescription: MedicationPrescription): string => {
  const route = prescription.administration_route ?? prescription.服用途徑 ?? '';
  const frequency = prescription.frequency ?? prescription.服用次數 ?? '';
  return [route, frequency].filter(Boolean).map(escapeHtml).join('<br>');
};

const getPrescriptionTimeSlots = (prescription: MedicationPrescription): string[] => {
  const rawSlots = prescription.time_slots ?? prescription.服用時間 ?? [];
  const slots = Array.isArray(rawSlots) ? rawSlots : String(rawSlots).split(/[、,，/]/);
  return [...slots.map((slot) => normalizeTimeSlot(String(slot))).filter(Boolean), ...TIME_SLOTS].slice(0, 4);
};

const normalizeTimeSlot = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  if (/早|晨|morning/i.test(trimmed)) return '08:00';
  if (/午|noon/i.test(trimmed)) return '12:00';
  if (/晚|evening/i.test(trimmed)) return '18:00';
  if (/睡|眠|bed|night/i.test(trimmed)) return '22:00';
  return trimmed;
};

const isDateInPrescriptionRange = (prescription: MedicationPrescription, dateString: string): boolean => {
  const date = new Date(dateString);
  const start = parseDate(getPrescriptionStartDate(prescription));
  const end = parseDate(prescription.end_date ?? prescription.結束日期 ?? prescription.discontinued_at);

  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};

const getPrescriptionId = (prescription: MedicationPrescription): string => String(prescription.id ?? prescription.處方id ?? '');

const getPrescriptionStartDate = (prescription: MedicationPrescription): string =>
  prescription.prescription_date ?? prescription.處方日期 ?? prescription.start_date ?? prescription.created_at ?? '';

const toDateString = (selectedMonth: string, day: number): string => `${selectedMonth}-${String(day).padStart(2, '0')}`;

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const formatDate = (value: unknown): string => {
  const date = parseDate(value);
  if (!date) return value ? String(value) : '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatYearMonth = (selectedMonth: string): string => {
  const [year, month] = selectedMonth.split('-');
  return `${year}年${Number(month)}月`;
};

const calculateAge = (birthDate: unknown): string => {
  const date = parseDate(birthDate);
  if (!date) return '';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age > 0 ? String(age) : '';
};

const joinList = (values: string[] | undefined): string => values?.length ? values.map(escapeHtml).join('、') : '&nbsp;';
const unique = (values: string[]): string[] => Array.from(new Set(values));

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

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