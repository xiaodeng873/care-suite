import {
  fetchWorkflowRecordsForMonth,
  generateStaffCodeMapping,
  formatStaffCodeNotation,
  extractStaffNamesFromWorkflowRecords,
  getWorkflowRecordForPrescriptionDateTimeSlot,
  formatWorkflowCellContent,
  formatDispenseCellContent,
  type WorkflowRecord,
  type StaffCodeMapping
} from './medicationWorkflowHelper';

type RouteType = 'oral' | 'topical' | 'injection';

type MarkCell = { content: string; className: string; title: string };

interface HtmlSheetConfig {
  patient: any;
  prescriptions: any[];
  routeType: RouteType;
  selectedMonth: string;
  includeWorkflowRecords: boolean;
}

interface PageData {
  patient: any;
  routeType: RouteType;
  selectedMonth: string;
  prescriptions: any[];
  timeSlots: string[];
  workflowRecords: WorkflowRecord[];
  staffCodeMapping: StaffCodeMapping;
  pageNumber: number;
}

const FACILITY_NAME = '善頤 (福群) 護老院 - 院友個人備藥及給藥記錄';
const MAX_PRESCRIPTIONS_PER_PAGE = 5;
const MAX_SUMMARY_TIME_SLOTS = 6;
const DAY_COUNT = 31;
const ROUTE_LABELS: Record<RouteType, string> = { oral: '口服藥物', topical: '外用藥物', injection: '注射藥物' };
const SPECIAL_CODE_ITEMS = [['HL', '因事回家'], ['A', '入院'], ['S', '自理'], ['LM', '缺藥中'], ['C', '已痊愈'], ['P', '暫停'], ['R', '拒絕一種或以上藥物'], ['O', '其他 (請註明)']];
const SPECIAL_CODES = ['A', 'S', 'R', 'O', 'HL', 'LM', 'P', 'C'];

const htmlEscape = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const parseTimeToMinutes = (timeStr: string): number => {
  const match = timeStr?.match(/(\d{1,2}):(\d{2})/);
  if (!match) return -1;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
};

const calculateAge = (birthDate: string): number | '' => {
  if (!birthDate) return '';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return Number.isFinite(age) ? age : '';
};

const getDaysInMonth = (selectedMonth: string): number => {
  const [year, month] = selectedMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};
const getDateString = (selectedMonth: string, day: number): string => {
  const [year, month] = selectedMonth.split('-');
  return `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};
const formatMonthLabel = (selectedMonth: string): string => {
  const [year, month] = selectedMonth.split('-');
  return `${year}年${month}月`;
};
const formatDate = (dateString: string): string => dateString ? new Date(dateString).toLocaleDateString('zh-TW') : '';
const getPatientName = (patient: any): string => `${patient.中文姓氏 || ''}${patient.中文名字 || ''}` || patient.中文姓名 || patient.name || '';
const getListText = (value: unknown, fallback: string): string => Array.isArray(value) && value.length > 0 ? value.join('、') : typeof value === 'string' && value.trim() ? value : fallback;

const getFrequencyDescription = (prescription: any): string => {
  const count = prescription.medication_time_slots?.length || 0;
  const countLabel = count === 1 ? 'QD' : count === 2 ? 'BD' : count === 3 ? 'TDS' : count === 4 ? 'QID' : count ? `${count}次/日` : '';
  switch (prescription.frequency_type) {
    case 'daily': return countLabel;
    case 'every_x_days': return `隔${prescription.frequency_value}日`;
    case 'every_x_months': return `隔${prescription.frequency_value}月`;
    case 'weekly_days': {
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = prescription.specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') || '';
      return `逢${days}`;
    }
    case 'odd_even_days': return prescription.is_odd_even_day === 'odd' ? '單日' : prescription.is_odd_even_day === 'even' ? '雙日' : '單雙日';
    case 'hourly': return `每${prescription.frequency_value}小時`;
    default: return countLabel;
  }
};

const getDosageText = (prescription: any): string => {
  if (prescription.special_dosage_instruction) return prescription.special_dosage_instruction;
  if (prescription.dosage_amount) return `${prescription.dosage_amount}${prescription.dosage_unit || ''}`;
  return '';
};
const getPrescriptionInstruction = (prescription: any): string => [prescription.meal_timing, prescription.is_prn ? '需要時' : '', prescription.preparation_method === 'custom' ? '自理' : '', prescription.notes].filter(Boolean).join(' / ');

const shouldBreakTimeRangeRule = (timeSlots: string[]): boolean => {
  const rangeCounts = [0, 0, 0, 0];
  timeSlots.forEach(timeSlot => {
    const minutes = parseTimeToMinutes(timeSlot);
    if (minutes >= 7 * 60 && minutes < 12 * 60) rangeCounts[0]++;
    else if (minutes >= 12 * 60 && minutes < 16 * 60) rangeCounts[1]++;
    else if (minutes >= 16 * 60 && minutes < 20 * 60) rangeCounts[2]++;
    else if (minutes >= 20 * 60 && minutes <= 22 * 60) rangeCounts[3]++;
  });
  return rangeCounts.some(count => count >= 2);
};
const mapTimeSlotsSequentially = (timeSlots: string[]): Record<number, string[]> => {
  const timeSlotsMap: Record<number, string[]> = {};
  [...timeSlots].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)).slice(0, 4).forEach((slot, index) => { timeSlotsMap[index + 1] = [slot]; });
  return timeSlotsMap;
};
const getTimeSlotRowOffset = (timeStr: string): number => {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes >= 7 * 60 && minutes < 12 * 60) return 1;
  if (minutes >= 12 * 60 && minutes < 16 * 60) return 2;
  if (minutes >= 16 * 60 && minutes < 20 * 60) return 3;
  if (minutes >= 20 * 60 && minutes <= 22 * 60) return 4;
  return 1;
};
const getTimeSlotsMap = (prescription: any, routeType: RouteType): Record<number, string[]> => {
  const timeSlots = prescription.medication_time_slots || [];
  if (routeType === 'injection') return { 1: timeSlots };
  if (shouldBreakTimeRangeRule(timeSlots)) return mapTimeSlotsSequentially(timeSlots);
  const timeSlotsMap: Record<number, string[]> = {};
  timeSlots.forEach((timeSlot: string) => {
    const rowOffset = getTimeSlotRowOffset(timeSlot);
    if (!timeSlotsMap[rowOffset]) timeSlotsMap[rowOffset] = [];
    timeSlotsMap[rowOffset].push(timeSlot);
  });
  return timeSlotsMap;
};

const expandInjectionPrescriptions = (prescriptions: any[], routeType: RouteType): any[] => {
  if (routeType !== 'injection') return prescriptions;
  return prescriptions.flatMap(prescription => {
    const timeSlots = prescription.medication_time_slots || [];
    if (timeSlots.length === 0) return [prescription];
    return [...timeSlots].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)).map(timeSlot => ({ ...prescription, medication_time_slots: [timeSlot] }));
  });
};
const expandOralTopicalPrescriptions = (prescriptions: any[], routeType: RouteType): any[] => {
  if (routeType === 'injection') return prescriptions;
  return prescriptions.flatMap(prescription => {
    const timeSlots = prescription.medication_time_slots || [];
    if (timeSlots.length <= 4) return [prescription];
    const sortedTimeSlots = [...timeSlots].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
    const batches = [];
    for (let index = 0; index < sortedTimeSlots.length; index += 4) batches.push({ ...prescription, medication_time_slots: sortedTimeSlots.slice(index, index + 4) });
    return batches;
  });
};
const categorizePrescriptionsByRoute = (prescriptions: any[]) => {
  const oral: any[] = [], injection: any[] = [], topical: any[] = [], noRoute: any[] = [];
  prescriptions.forEach(prescription => {
    const route = prescription.administration_route?.trim();
    if (!route) noRoute.push(prescription);
    else if (route === '口服') oral.push(prescription);
    else if (route === '注射') injection.push(prescription);
    else topical.push(prescription);
  });
  return { oral, injection, topical, noRoute };
};
const isDateInPrescriptionRange = (dateStr: string, timeSlot: string, prescription: any): boolean => {
  const checkDate = new Date(dateStr);
  const startDate = prescription.start_date ? new Date(prescription.start_date) : null;
  const endDate = prescription.end_date ? new Date(prescription.end_date) : null;
  const normalizeTime = (time: string | null | undefined): string => time ? time.substring(0, 5) : '00:00';
  const startTime = normalizeTime(prescription.start_time);
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
const preparePages = async (config: HtmlSheetConfig): Promise<PageData[]> => {
  let processedPrescriptions = expandInjectionPrescriptions(config.prescriptions, config.routeType);
  processedPrescriptions = expandOralTopicalPrescriptions(processedPrescriptions, config.routeType);
  const prescriptionIds = processedPrescriptions.map(p => p.id);
  const workflowRecords = config.includeWorkflowRecords ? await fetchWorkflowRecordsForMonth(config.patient.院友id, prescriptionIds, config.selectedMonth) : [];
  const staffCodeMapping = config.includeWorkflowRecords ? generateStaffCodeMapping(extractStaffNamesFromWorkflowRecords(workflowRecords)) : {};
  const pages: PageData[] = [];
  for (let index = 0; index < processedPrescriptions.length; index += MAX_PRESCRIPTIONS_PER_PAGE) {
    const prescriptions = processedPrescriptions.slice(index, index + MAX_PRESCRIPTIONS_PER_PAGE);
    const timeSlots = [...new Set(prescriptions.flatMap(p => p.medication_time_slots || []))].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
    pages.push({ patient: config.patient, routeType: config.routeType, selectedMonth: config.selectedMonth, prescriptions, timeSlots, workflowRecords, staffCodeMapping, pageNumber: pages.length + 1 });
  }
  return pages;
};

const isSpecialCode = (content: string): boolean => SPECIAL_CODES.includes(content);
const getAdministrationCell = (page: PageData, prescription: any, dateStr: string, slotsInRow: string[]): MarkCell => {
  const isInRange = slotsInRow.some(timeSlot => isDateInPrescriptionRange(dateStr, timeSlot, prescription));
  if (!isInRange) return { content: '', className: 'not-required', title: '處方未生效或已停用' };
  if (prescription.preparation_method === 'custom') return { content: 'S', className: 'special-code', title: '自理藥物' };
  if (page.workflowRecords.length === 0) return { content: '', className: 'required', title: '應執行，尚未簽署' };
  for (const timeSlot of slotsInRow) {
    const record = getWorkflowRecordForPrescriptionDateTimeSlot(page.workflowRecords, prescription.id, dateStr, timeSlot);
    const formatted = formatWorkflowCellContent(record, page.staffCodeMapping);
    if (formatted) return { content: formatted, className: isSpecialCode(formatted) ? 'special-code' : 'signed', title: '執 / 核藥職員簽署' };
  }
  return { content: '', className: 'required', title: '應執行，尚未簽署' };
};
const getDispenseCell = (page: PageData, dateStr: string, timeSlot: string): MarkCell => {
  let hasRequiredPrescription = false;
  for (const prescription of page.prescriptions) {
    if (!(prescription.medication_time_slots || []).includes(timeSlot)) continue;
    if (!isDateInPrescriptionRange(dateStr, timeSlot, prescription)) continue;
    hasRequiredPrescription = true;
    if (prescription.preparation_method === 'custom') return { content: 'S', className: 'special-code', title: '自理藥物' };
    const record = getWorkflowRecordForPrescriptionDateTimeSlot(page.workflowRecords, prescription.id, dateStr, timeSlot);
    const formatted = formatDispenseCellContent(record, page.staffCodeMapping);
    if (formatted) return { content: formatted, className: isSpecialCode(formatted) ? 'special-code' : 'signed', title: '給藥簽署' };
  }
  return hasRequiredPrescription ? { content: '', className: 'required', title: '應給藥，尚未簽署' } : { content: '', className: 'not-required', title: '此時間沒有應給藥物' };
};
const getInjectionSiteText = (page: PageData, prescription: any, dateStr: string, slotsInRow: string[]): string => {
  for (const timeSlot of slotsInRow) {
    const record = getWorkflowRecordForPrescriptionDateTimeSlot(page.workflowRecords, prescription.id, dateStr, timeSlot);
    const inspectionResult = record?.inspection_check_result as any;
    const site = inspectionResult?.injection_site || inspectionResult?.site || record?.notes;
    if (site) return String(site);
  }
  return '';
};
const renderDayCells = (renderer: (day: number) => string): string => Array.from({ length: DAY_COUNT }, (_, index) => renderer(index + 1)).join('');
const renderDayHeaderCells = (selectedMonth: string): string => {
  const daysInMonth = getDaysInMonth(selectedMonth);
  return renderDayCells(day => `<th class="day-heading ${day > daysInMonth ? 'outside-month' : ''}">${day}</th>`);
};
const renderMarkCells = (page: PageData, prescription: any, slotsInRow: string[], rowKind: 'admin' | 'site'): string => {
  const daysInMonth = getDaysInMonth(page.selectedMonth);
  return renderDayCells(day => {
    if (day > daysInMonth || !prescription?.id) return '<td class="day-cell outside-month"></td>';
    const dateStr = getDateString(page.selectedMonth, day);
    if (rowKind === 'site') {
      const isRequired = slotsInRow.some(timeSlot => isDateInPrescriptionRange(dateStr, timeSlot, prescription));
      const site = getInjectionSiteText(page, prescription, dateStr, slotsInRow);
      return `<td class="day-cell ${isRequired ? 'site-cell' : 'not-required'}">${htmlEscape(site)}</td>`;
    }
    const cell = getAdministrationCell(page, prescription, dateStr, slotsInRow);
    return `<td class="day-cell ${cell.className}" title="${htmlEscape(cell.title)}">${htmlEscape(cell.content)}</td>`;
  });
};
const renderPrescriptionBlock = (page: PageData, prescription: any | undefined): string => {
  const isInjection = page.routeType === 'injection';
  const timeSlotsMap = prescription ? getTimeSlotsMap(prescription, page.routeType) : {};
  const medicationText = prescription ? [prescription.medication_name, prescription.medication_source ? `來源：${prescription.medication_source}` : ''].filter(Boolean).join('\n') : '';
  const orderText = prescription ? [prescription.administration_route, getFrequencyDescription(prescription), getDosageText(prescription), getPrescriptionInstruction(prescription)].filter(Boolean).join('\n') : '';
  const firstSlots = timeSlotsMap[1] || [];
  const secondSlots = timeSlotsMap[2] || [];
  const thirdSlots = timeSlotsMap[3] || [];
  const fourthSlots = timeSlotsMap[4] || [];
  const rows = isInjection
    ? [
        { label: '服用時間', slots: firstSlots, kind: 'admin' as const, classes: 'block-top' },
        { label: firstSlots.join(', '), slots: firstSlots, kind: 'admin' as const, classes: '' },
        { label: '注射位置', slots: firstSlots, kind: 'site' as const, classes: '' },
        { label: '執: 核：', slots: firstSlots, kind: 'admin' as const, classes: 'block-sign' },
        { label: '', slots: firstSlots, kind: 'admin' as const, classes: 'block-bottom' }
      ]
    : [
        { label: '服用時間', slots: firstSlots, kind: 'admin' as const, classes: 'block-top' },
        { label: firstSlots.join(', '), slots: firstSlots, kind: 'admin' as const, classes: '' },
        { label: secondSlots.concat(thirdSlots).join(', '), slots: secondSlots.concat(thirdSlots), kind: 'admin' as const, classes: '' },
        { label: '執: 核：', slots: fourthSlots.length ? fourthSlots : firstSlots, kind: 'admin' as const, classes: 'block-sign' },
        { label: fourthSlots.join(', '), slots: fourthSlots, kind: 'admin' as const, classes: 'block-bottom' }
      ];
  return rows.map((row, rowIndex) => `<tr class="rx-block-row ${row.classes}">${rowIndex === 0 ? `<td class="rx-date" rowspan="5">${htmlEscape(formatDate(prescription?.prescription_date || prescription?.start_date || ''))}</td><td class="rx-name" rowspan="5" colspan="8">${htmlEscape(medicationText)}</td><td class="rx-order" rowspan="5" colspan="2">${htmlEscape(orderText)}</td>` : ''}<td class="time-label" colspan="2">${htmlEscape(row.label)}</td>${renderMarkCells(page, prescription, row.slots, row.kind)}</tr>`).join('');
};
const renderPrescriptionBlocks = (page: PageData): string => Array.from({ length: MAX_PRESCRIPTIONS_PER_PAGE }, (_, index) => renderPrescriptionBlock(page, page.prescriptions[index])).join('');
const renderDispenseSummaryRows = (page: PageData): string => {
  const rows = page.timeSlots.slice(0, MAX_SUMMARY_TIME_SLOTS);
  while (rows.length < MAX_SUMMARY_TIME_SLOTS) rows.push('');
  const daysInMonth = getDaysInMonth(page.selectedMonth);
  return rows.map((timeSlot, index) => `<tr class="summary-row">${index === 0 ? '<td class="guide-cell" rowspan="6" colspan="10"><strong>給藥記錄簽署指引：</strong>簽名=已服藥; HL=因事回家; A=入院;<br/>S=自理; LM=缺藥中; C=已痊愈; P=暫停; R=拒絕一種或以上藥物; O=其他 (請註明);<br/>R或O 請通知護士/保健員作出跟進並作適當記錄; 處方日期=該藥物第一次被處方的使用日期。</td><td class="summary-title" rowspan="6" colspan="2">給藥簽署</td>' : ''}<td class="summary-time">${htmlEscape(timeSlot)}</td>${renderDayCells(day => {
    if (!timeSlot || day > daysInMonth) return '<td class="day-cell not-required"></td>';
    const cell = getDispenseCell(page, getDateString(page.selectedMonth, day), timeSlot);
    return `<td class="day-cell ${cell.className}" title="${htmlEscape(cell.title)}">${htmlEscape(cell.content)}</td>`;
  })}</tr>`).join('');
};
const renderPatientHeader = (page: PageData): string => {
  const patient = page.patient;
  return `<tr class="top-row"><td class="risk-label" rowspan="2">藥物過敏反應：</td><td class="risk-value" rowspan="2" colspan="9">${htmlEscape(getListText(patient.藥物敏感, 'NKDA'))}</td><td class="title-cell" colspan="17">${FACILITY_NAME}</td><td class="field-label" colspan="3">姓名:</td><td class="field-value" colspan="6">${htmlEscape(getPatientName(patient))}</td><td class="field-label" colspan="3">院號:</td><td class="field-value" colspan="3">${htmlEscape(patient.床號 || '')}</td></tr><tr class="top-row"><td class="route-title" colspan="17">${ROUTE_LABELS[page.routeType]}</td><td class="field-label" colspan="3">性別 / 年齡:</td><td class="field-value" colspan="6">${htmlEscape(`${patient.性別 || ''}/${calculateAge(patient.出生日期)}`)}</td><td class="field-label" colspan="3">出生日期：</td><td class="field-value" colspan="3">${htmlEscape(formatDate(patient.出生日期))}</td></tr><tr class="risk-row"><td class="risk-label">藥物不良反應：</td><td class="risk-value" colspan="9">${htmlEscape(getListText(patient.不良藥物反應, 'NKADR'))}</td><td class="month-cell" colspan="5">${htmlEscape(formatMonthLabel(page.selectedMonth))}</td><td class="page-cell" colspan="12">第 ${page.pageNumber} 頁</td><td class="field-label" colspan="3">床號:</td><td class="field-value" colspan="6">${htmlEscape(patient.床號 || '')}</td><td class="field-label" colspan="3">列印日期:</td><td class="field-value" colspan="3">${htmlEscape(formatDate(new Date().toISOString()))}</td></tr>`;
};
const renderTableHeader = (page: PageData): string => `<tr class="spacer-row"><td colspan="44"></td></tr><tr class="rx-heading-row"><th class="rx-date" rowspan="2">處方日期</th><th class="rx-name" rowspan="2" colspan="8">藥物名稱及劑型</th><th class="rx-order" rowspan="2" colspan="2">途徑 / 次數</th><th class="sign-heading" rowspan="2" colspan="33">執 / 核 藥 職 員 簽 署</th></tr><tr></tr><tr class="day-heading-row"><th colspan="11"></th><th class="time-label" colspan="2">服用時間</th>${renderDayHeaderCells(page.selectedMonth)}</tr>`;
const renderStaffLegend = (page: PageData): string => {
  const { line1, line2 } = formatStaffCodeNotation(page.staffCodeMapping);
  return `<div class="staff-legend"><strong>職員代號：</strong>${htmlEscape(line1 || '未產生職員代號')} ${htmlEscape(line2)}</div>`;
};
const renderPage = (page: PageData): string => `<section class="medication-page"><table class="excel-sheet"><colgroup><col class="c-date" />${Array.from({ length: 8 }, () => '<col class="c-name" />').join('')}${Array.from({ length: 2 }, () => '<col class="c-order" />').join('')}${Array.from({ length: 2 }, () => '<col class="c-time" />').join('')}${Array.from({ length: DAY_COUNT }, () => '<col class="c-day" />').join('')}</colgroup><tbody>${renderPatientHeader(page)}${renderTableHeader(page)}${renderPrescriptionBlocks(page)}${renderDispenseSummaryRows(page)}</tbody></table><div class="code-strip">${SPECIAL_CODE_ITEMS.map(([code, text]) => `<span><strong>${code}</strong>=${htmlEscape(text)}</span>`).join('')}</div>${renderStaffLegend(page)}</section>`;

const generateMedicationRecordHtml = (pages: PageData[]): string => `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>個人備藥及給藥記錄</title><style>
@page{size:A4 landscape;margin:5mm 0 0 1mm}@media print{body{background:#fff;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.print-toolbar{display:none!important}.medication-page{page-break-after:always;break-after:page;box-shadow:none;margin:0}.medication-page:last-child{page-break-after:auto;break-after:auto}}*{box-sizing:border-box}body{margin:0;padding:10px;background:#e5e7eb;color:#000;font-family:"PMingLiU","新細明體","Microsoft JhengHei",serif}.print-toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:center;padding:8px;background:#fff;border-bottom:1px solid #cbd5e1}.print-toolbar button{border:1px solid #0f766e;background:#0f766e;color:#fff;border-radius:4px;padding:7px 14px;font-size:14px;cursor:pointer}.medication-page{width:293.4mm;min-height:203mm;margin:0 auto 12px;padding:0;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.18);overflow:hidden}.excel-sheet{width:293.4mm;border-collapse:collapse;table-layout:fixed;font-size:8pt;line-height:1.05}.excel-sheet th,.excel-sheet td{border:.5pt solid #000;padding:0 2px;height:9.8mm;text-align:center;vertical-align:middle;white-space:pre-line;overflow:hidden}.c-date{width:12.1mm}.c-name{width:3.3mm}.c-order{width:4.6mm}.c-time{width:3.2mm}.c-day{width:2.8mm}.top-row td,.risk-row td{height:13.1mm}.risk-label{width:12.1mm;font-size:11pt;text-align:left!important;vertical-align:top!important}.risk-value{text-align:left!important;vertical-align:top!important;font-size:11pt}.title-cell{font-size:12pt;font-weight:700}.route-title{font-size:16pt;font-weight:700}.field-label{font-size:11pt;text-align:left!important}.field-value{font-size:11pt;text-align:left!important}.month-cell,.page-cell{font-size:11pt;font-weight:700}.spacer-row td{height:3.7mm;border-left:none;border-right:none}.rx-heading-row th{height:5.3mm;font-size:10pt;font-weight:700}.day-heading-row th{height:9.8mm;font-size:10pt;font-weight:700}.rx-block-row td{height:9.8mm}.rx-date{width:12.1mm;font-size:8pt}.rx-name{text-align:left!important;font-size:8pt;padding-left:3px!important}.rx-order{font-size:7.5pt}.time-label{font-size:8pt;font-weight:700}.sign-heading{font-size:10pt;letter-spacing:1px}.day-heading,.day-cell{width:2.8mm;min-width:2.8mm;max-width:2.8mm;padding:0!important;font-size:7pt}.day-cell{height:9.8mm}.block-top td{border-top:1.5pt solid #000}.block-bottom td{border-bottom:1.5pt solid #000}.block-sign .time-label{font-size:9pt}.required{background:#fff}.signed{color:#000;font-weight:700}.special-code{color:#000;font-weight:700;background:#fff7cc}.not-required,.outside-month{background:#d9d9d9!important;color:transparent}.site-cell{font-size:6pt;color:#000}.summary-row td{height:9.8mm}.guide-cell{text-align:left!important;font-size:8pt;line-height:1.25;padding:2px 4px!important}.summary-title{font-size:10pt;font-weight:700;writing-mode:vertical-rl;letter-spacing:2px}.summary-time{width:6.4mm;font-size:8pt;font-weight:700}.code-strip{display:flex;flex-wrap:wrap;gap:8px;padding:2px 4px;font-size:7.5pt}.staff-legend{padding:0 4px 4px;font-size:7.5pt}
</style></head><body><div class="print-toolbar"><button onclick="window.print()">列印 HTML 藥紙</button></div>${pages.map(renderPage).join('')}</body></html>`;

const openPrintableHtml = (html: string): void => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('無法開啟列印視窗，請檢查瀏覽器彈出視窗設定');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
};

const buildPagesForPatients = async (selectedPatients: any[], selectedMonth: string, includeWorkflowRecords: boolean): Promise<PageData[]> => {
  const allPages: PageData[] = [];
  for (const patient of selectedPatients) {
    const categorized = categorizePrescriptionsByRoute(patient.prescriptions || []);
    const routeConfigs: Array<{ routeType: RouteType; prescriptions: any[] }> = [
      { routeType: 'oral', prescriptions: categorized.oral },
      { routeType: 'injection', prescriptions: categorized.injection },
      { routeType: 'topical', prescriptions: categorized.topical }
    ];
    for (const routeConfig of routeConfigs) {
      if (routeConfig.prescriptions.length === 0) continue;
      const pages = await preparePages({ patient, prescriptions: routeConfig.prescriptions, routeType: routeConfig.routeType, selectedMonth, includeWorkflowRecords });
      allPages.push(...pages);
    }
  }
  return allPages;
};

export const exportMedicationRecordToHtml = async (selectedPatients: any[], selectedMonth: string, includeWorkflowRecords: boolean = false): Promise<void> => {
  const pages = await buildPagesForPatients(selectedPatients, selectedMonth, includeWorkflowRecords);
  if (pages.length === 0) throw new Error('沒有可匯出的處方資料。所有處方可能都缺少途徑資訊或不符合匯出條件。');
  openPrintableHtml(generateMedicationRecordHtml(pages));
};

export const exportSelectedMedicationRecordToHtml = async (selectedPrescriptionIds: string[], currentPatient: any, allPrescriptions: any[], selectedMonth: string, includeInactive: boolean = false, includeWorkflowRecords: boolean = false): Promise<void> => {
  const prescriptionsToExport = selectedPrescriptionIds.length === 0
    ? allPrescriptions.filter(p => p.patient_id === currentPatient.院友id && p.status !== 'pending_change' && (p.status !== 'inactive' || includeInactive))
    : allPrescriptions.filter(p => selectedPrescriptionIds.includes(p.id) && p.patient_id === currentPatient.院友id);
  if (prescriptionsToExport.length === 0) throw new Error('沒有可匯出的處方');
  await exportMedicationRecordToHtml([{ ...currentPatient, prescriptions: prescriptionsToExport }], selectedMonth, includeWorkflowRecords);
};
