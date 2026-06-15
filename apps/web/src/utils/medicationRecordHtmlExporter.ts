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

const FACILITY_NAME = '善頤 (福群) 護老院';
const MAX_PRESCRIPTIONS_PER_PAGE = 5;
const MAX_SUMMARY_TIME_SLOTS = 6;
const ROUTE_LABELS: Record<RouteType, string> = { oral: '口服藥物', topical: '外用藥物', injection: '注射藥物' };
const ROUTE_PURPOSES: Record<RouteType, string> = {
  oral: '追蹤每一個服藥時間的執藥與核藥責任，底部彙總派藥簽署。',
  topical: '追蹤外用、滴眼、滴耳、吸入等非口服藥物的使用時間與核對責任。',
  injection: '追蹤注射藥物的給藥時間、核對責任與注射位置紀錄。'
};
const SPECIAL_CODE_ITEMS = [['A', '入院'], ['S', '自理'], ['R', '拒服 / 拒用'], ['HL', '回家 / 外出'], ['LM', '缺藥中'], ['P/O', '暫停 / 其他，需註明及跟進']];

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
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, medication_time_slots } = prescription;
  const count = medication_time_slots?.length || 0;
  const countLabel = count === 1 ? 'QD' : count === 2 ? 'BD' : count === 3 ? 'TDS' : count === 4 ? 'QID' : count ? `${count}次/日` : '';
  switch (frequency_type) {
    case 'daily': return countLabel;
    case 'every_x_days': return `隔${frequency_value}日`;
    case 'every_x_months': return `隔${frequency_value}月`;
    case 'weekly_days': {
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') || '';
      return `逢${days}`;
    }
    case 'odd_even_days': return is_odd_even_day === 'odd' ? '單日' : is_odd_even_day === 'even' ? '雙日' : '單雙日';
    case 'hourly': return `每${frequency_value}小時`;
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
  const timeSlotsMap: Record<number, string[]> = {};
  if (routeType === 'injection') {
    timeSlots.forEach((timeSlot: string) => { if (!timeSlotsMap[1]) timeSlotsMap[1] = []; timeSlotsMap[1].push(timeSlot); });
    return timeSlotsMap;
  }
  if (shouldBreakTimeRangeRule(timeSlots)) return mapTimeSlotsSequentially(timeSlots);
  timeSlots.forEach((timeSlot: string) => { const rowOffset = getTimeSlotRowOffset(timeSlot); if (!timeSlotsMap[rowOffset]) timeSlotsMap[rowOffset] = []; timeSlotsMap[rowOffset].push(timeSlot); });
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
  let prescriptionIndex = 0;
  let pageNumber = 1;
  while (prescriptionIndex < processedPrescriptions.length) {
    const pageTimeSlots: string[] = [];
    const pagePrescriptions: any[] = [];
    while (prescriptionIndex < processedPrescriptions.length && pagePrescriptions.length < MAX_PRESCRIPTIONS_PER_PAGE) {
      const prescription = processedPrescriptions[prescriptionIndex];
      const prescriptionTimeSlots = prescription.medication_time_slots || [];
      const uniqueCount = new Set([...pageTimeSlots, ...prescriptionTimeSlots]).size;
      if (uniqueCount <= MAX_SUMMARY_TIME_SLOTS || pagePrescriptions.length === 0) {
        pagePrescriptions.push(prescription);
        pageTimeSlots.push(...prescriptionTimeSlots);
        prescriptionIndex++;
      } else break;
    }
    pages.push({ patient: config.patient, routeType: config.routeType, selectedMonth: config.selectedMonth, prescriptions: pagePrescriptions, timeSlots: [...new Set(pageTimeSlots)].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)), workflowRecords, staffCodeMapping, pageNumber });
    pageNumber++;
  }
  return pages;
};

const getAdministrationCell = (page: PageData, prescription: any, dateStr: string, slotsInRow: string[]) => {
  const isInRange = slotsInRow.some(timeSlot => isDateInPrescriptionRange(dateStr, timeSlot, prescription));
  if (!isInRange) return { content: '', className: 'not-required', title: '處方未生效或已停用' };
  if (prescription.preparation_method === 'custom') return { content: 'S', className: 'special-code', title: '自理藥物' };
  if (page.workflowRecords.length === 0) return { content: '', className: 'required', title: '應執行，未包含工作流程記錄' };
  for (const timeSlot of slotsInRow) {
    const record = getWorkflowRecordForPrescriptionDateTimeSlot(page.workflowRecords, prescription.id, dateStr, timeSlot);
    const formatted = formatWorkflowCellContent(record, page.staffCodeMapping);
    if (formatted) return { content: formatted, className: ['A', 'S', 'R', 'O', 'HL'].includes(formatted) ? 'special-code' : 'signed', title: '執藥 / 核藥簽署' };
  }
  return { content: '', className: 'required', title: '應執行，尚未簽署' };
};
const getDispenseCell = (page: PageData, dateStr: string, timeSlot: string) => {
  let hasRequiredPrescription = false;
  for (const prescription of page.prescriptions) {
    if (!(prescription.medication_time_slots || []).includes(timeSlot)) continue;
    if (!isDateInPrescriptionRange(dateStr, timeSlot, prescription)) continue;
    hasRequiredPrescription = true;
    if (prescription.preparation_method === 'custom') return { content: 'S', className: 'special-code', title: '自理藥物' };
    const record = getWorkflowRecordForPrescriptionDateTimeSlot(page.workflowRecords, prescription.id, dateStr, timeSlot);
    const formatted = formatDispenseCellContent(record, page.staffCodeMapping);
    if (formatted) return { content: formatted, className: ['A', 'S', 'R', 'O', 'HL'].includes(formatted) ? 'special-code' : 'signed', title: '派藥簽署' };
  }
  return hasRequiredPrescription ? { content: '', className: 'required', title: '應派藥，尚未簽署' } : { content: '', className: 'not-required', title: '此時間沒有應派藥物' };
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
const renderDayHeader = (selectedMonth: string): string => {
  const daysInMonth = getDaysInMonth(selectedMonth);
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return `<th class="day-heading ${day > daysInMonth ? 'outside-month' : ''}">${day}</th>`;
  }).join('');
};
const renderAdministrationCells = (page: PageData, prescription: any, slotsInRow: string[], rowKind: 'admin' | 'site'): string => {
  const daysInMonth = getDaysInMonth(page.selectedMonth);
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    if (day > daysInMonth) return '<td class="mark-cell outside-month"></td>';
    const dateStr = getDateString(page.selectedMonth, day);
    if (rowKind === 'site') {
      const site = getInjectionSiteText(page, prescription, dateStr, slotsInRow);
      const isRequired = slotsInRow.some(timeSlot => isDateInPrescriptionRange(dateStr, timeSlot, prescription));
      return `<td class="mark-cell ${isRequired ? 'site-cell' : 'not-required'}">${htmlEscape(site)}</td>`;
    }
    const cell = getAdministrationCell(page, prescription, dateStr, slotsInRow);
    return `<td class="mark-cell ${cell.className}" title="${htmlEscape(cell.title)}">${htmlEscape(cell.content)}</td>`;
  }).join('');
};
const renderPrescriptionRows = (page: PageData): string => page.prescriptions.map((prescription, index) => {
  const timeSlotsMap = getTimeSlotsMap(prescription, page.routeType);
  const timeRows = page.routeType === 'injection'
    ? [{ label: '執 / 核', slots: timeSlotsMap[1] || [], kind: 'admin' as const }, { label: '注射位置', slots: timeSlotsMap[1] || [], kind: 'site' as const }]
    : [1, 2, 3, 4].map(offset => ({ label: offset === 1 ? '早上' : offset === 2 ? '中午 / 下午' : offset === 3 ? '傍晚' : '晚上', slots: timeSlotsMap[offset] || [], kind: 'admin' as const }));
  const rowSpan = timeRows.length;
  const instruction = getPrescriptionInstruction(prescription);
  return timeRows.map((row, rowIndex) => `
    <tr class="prescription-entry ${index % 2 === 0 ? 'entry-even' : 'entry-odd'}">
      ${rowIndex === 0 ? `<td class="rx-index" rowspan="${rowSpan}">${index + 1}</td><td class="rx-date" rowspan="${rowSpan}">${htmlEscape(formatDate(prescription.prescription_date || prescription.start_date))}</td><td class="rx-medication" rowspan="${rowSpan}"><div class="rx-name">${htmlEscape(prescription.medication_name || '')}</div><div class="rx-subline">${htmlEscape(prescription.medication_source ? `來源：${prescription.medication_source}` : '')}</div></td><td class="rx-order" rowspan="${rowSpan}"><div>${htmlEscape(prescription.administration_route || '')}</div><div>${htmlEscape(getFrequencyDescription(prescription))}</div><div>${htmlEscape(getDosageText(prescription))}</div><div>${htmlEscape(instruction)}</div></td>` : ''}
      <td class="rx-time-band"><div class="time-band-label">${htmlEscape(row.label)}</div><div class="time-band-slots">${htmlEscape(row.slots.join(', '))}</div></td>${renderAdministrationCells(page, prescription, row.slots, row.kind)}
    </tr>`).join('');
}).join('');
const renderDispenseSummaryRows = (page: PageData): string => {
  const rows = page.timeSlots.slice(0, MAX_SUMMARY_TIME_SLOTS);
  while (rows.length < MAX_SUMMARY_TIME_SLOTS) rows.push('');
  const daysInMonth = getDaysInMonth(page.selectedMonth);
  return rows.map(timeSlot => `<tr><td class="summary-time" colspan="5">${htmlEscape(timeSlot)}</td>${Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    if (!timeSlot || day > daysInMonth) return '<td class="mark-cell not-required"></td>';
    const cell = getDispenseCell(page, getDateString(page.selectedMonth, day), timeSlot);
    return `<td class="mark-cell ${cell.className}" title="${htmlEscape(cell.title)}">${htmlEscape(cell.content)}</td>`;
  }).join('')}</tr>`).join('');
};
const renderPatientHeader = (page: PageData): string => {
  const patient = page.patient;
  return `<header class="record-header"><div class="record-title-block"><div class="facility-name">${FACILITY_NAME}</div><h1>院友個人備藥及給藥記錄</h1><div class="route-name">${ROUTE_LABELS[page.routeType]}</div><div class="route-purpose">${ROUTE_PURPOSES[page.routeType]}</div></div><div class="resident-panel"><div><span>姓名</span><strong>${htmlEscape(getPatientName(patient))}</strong></div><div><span>院號 / 床號</span><strong>${htmlEscape(patient.床號 || '')}</strong></div><div><span>性別 / 年齡</span><strong>${htmlEscape(`${patient.性別 || ''}/${calculateAge(patient.出生日期)}`)}</strong></div><div><span>出生日期</span><strong>${htmlEscape(formatDate(patient.出生日期))}</strong></div><div><span>月份</span><strong>${htmlEscape(formatMonthLabel(page.selectedMonth))}</strong></div><div><span>頁次</span><strong>${page.pageNumber}</strong></div></div></header><section class="risk-strip"><div><span>藥物過敏反應</span><strong>${htmlEscape(getListText(patient.藥物敏感, 'NKDA'))}</strong></div><div><span>藥物不良反應</span><strong>${htmlEscape(getListText(patient.不良藥物反應, 'NKADR'))}</strong></div></section>`;
};
const renderLegend = (page: PageData): string => {
  const { line1, line2 } = formatStaffCodeNotation(page.staffCodeMapping);
  return `<section class="legend-section"><div class="legend-card"><h2>代號說明</h2><div class="code-grid">${SPECIAL_CODE_ITEMS.map(([code, meaning]) => `<div><strong>${code}</strong><span>${meaning}</span></div>`).join('')}</div></div><div class="legend-card staff-card"><h2>職員簽署代號</h2><p>${htmlEscape(line1 || '未產生職員代號')}</p><p>${htmlEscape(line2)}</p></div><div class="legend-card audit-card"><h2>表格邏輯</h2><p>每一格交叉點代表「指定日期」與「指定處方時間」的一次給藥責任；空白但未灰格代表應執行但尚未簽署。</p></div></section>`;
};
const renderPage = (page: PageData): string => `<section class="medication-page">${renderPatientHeader(page)}<table class="record-table prescription-table"><thead><tr><th class="rx-index">項</th><th class="rx-date">處方日期</th><th class="rx-medication">藥物名稱及劑型</th><th class="rx-order">途徑 / 次數 / 份量</th><th class="rx-time-band">時間 / 指向</th>${renderDayHeader(page.selectedMonth)}</tr></thead><tbody>${renderPrescriptionRows(page)}</tbody></table><table class="record-table dispense-table"><thead><tr><th colspan="5">給藥簽署總結</th>${renderDayHeader(page.selectedMonth)}</tr></thead><tbody>${renderDispenseSummaryRows(page)}</tbody></table>${renderLegend(page)}</section>`;

const generateMedicationRecordHtml = (pages: PageData[]): string => `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>個人備藥及給藥記錄</title><style>
@page{size:A4 landscape;margin:6mm}@media print{body{background:#fff;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.print-toolbar{display:none!important}.medication-page{page-break-after:always;break-after:page;box-shadow:none;margin:0}.medication-page:last-child{page-break-after:auto;break-after:auto}}*{box-sizing:border-box}body{margin:0;padding:12px;background:#e5e7eb;color:#0f172a;font-family:"Microsoft JhengHei","微軟正黑體",Arial,sans-serif}.print-toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:center;padding:8px;background:#fff;border-bottom:1px solid #cbd5e1}.print-toolbar button{border:1px solid #0f766e;background:#0f766e;color:#fff;border-radius:4px;padding:7px 14px;font-size:14px;cursor:pointer}.medication-page{width:285mm;min-height:198mm;margin:0 auto 12px;padding:7mm;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.18)}.record-header{display:grid;grid-template-columns:1.2fr 1fr;gap:8px;align-items:stretch;margin-bottom:6px}.record-title-block{border:2px solid #111827;padding:6px 8px;text-align:center}.facility-name{font-size:12px;font-weight:700}h1{margin:1px 0;font-size:19px;line-height:1.2}.route-name{font-size:18px;font-weight:700;text-decoration:underline}.route-purpose{margin-top:2px;font-size:9px;color:#334155}.resident-panel{display:grid;grid-template-columns:repeat(3,1fr);border-top:2px solid #111827;border-left:2px solid #111827}.resident-panel div{min-height:30px;padding:3px 5px;border-right:2px solid #111827;border-bottom:2px solid #111827}.resident-panel span,.risk-strip span{display:block;margin-bottom:1px;font-size:8px;color:#475569}.resident-panel strong{font-size:13px}.risk-strip{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px}.risk-strip div{min-height:28px;border:2px solid #111827;padding:3px 6px}.risk-strip strong{font-size:12px}.record-table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:6px}.record-table th,.record-table td{border:1px solid #111827;padding:2px;text-align:center;vertical-align:middle;overflow:hidden}.record-table th{background:#e2e8f0;font-size:8px;line-height:1.05;font-weight:700}.prescription-table,.dispense-table{border:2px solid #111827}.rx-index{width:6mm}.rx-date{width:17mm}.rx-medication{width:44mm}.rx-order{width:26mm}.rx-time-band{width:20mm}.day-heading{width:4.8mm}.prescription-entry td{height:8.7mm}.entry-even .rx-medication,.entry-even .rx-order,.entry-even .rx-date,.entry-even .rx-index{background:#f8fafc}.rx-index,.rx-date{font-size:9px;font-weight:700}.rx-medication{text-align:left!important;padding:3px 4px!important}.rx-name{font-size:10px;font-weight:700;line-height:1.2}.rx-subline{margin-top:4px;font-size:8px;color:#475569}.rx-order{font-size:8.5px;line-height:1.35}.time-band-label{font-size:8px;color:#475569}.time-band-slots{margin-top:1px;font-size:9px;font-weight:700}.mark-cell{width:4.8mm;height:7mm;font-size:8px;line-height:1;font-weight:700}.required{background:linear-gradient(135deg,transparent 48%,#94a3b8 49%,#94a3b8 51%,transparent 52%)}.signed{background:#ecfeff;color:#0e7490}.special-code{background:#fef3c7;color:#92400e}.not-required,.outside-month{background:#d1d5db!important;color:transparent}.site-cell{background:#fff;color:#111827;font-size:7px}.dispense-table th{background:#ccfbf1}.dispense-table td{height:6.4mm}.summary-time{font-size:9px;font-weight:700;background:#f8fafc}.legend-section{display:grid;grid-template-columns:1.05fr 1fr 1.15fr;gap:6px}.legend-card{min-height:21mm;border:1.5px solid #111827;padding:4px 5px}.legend-card h2{margin:0 0 3px;font-size:10px}.legend-card p{margin:2px 0;font-size:8px;line-height:1.3}.code-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px 5px}.code-grid div{display:flex;gap:3px;align-items:baseline}.code-grid strong{min-width:20px;font-size:9px}.code-grid span{font-size:8px}
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
