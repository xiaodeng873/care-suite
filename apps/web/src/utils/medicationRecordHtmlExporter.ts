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

const ROUTE_LABELS: Record<RouteType, string> = {
  oral: '口服藥物',
  topical: '外用藥物',
  injection: '注射藥物'
};

const FACILITY_NAME = '善頤 (福群) 護老院';

const htmlEscape = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const calculateAge = (birthDate: string): number | '' => {
  if (!birthDate) return '';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Number.isFinite(age) ? age : '';
};

const parseTimeToMinutes = (timeStr: string): number => {
  const match = timeStr?.match(/(\d{1,2}):(\d{2})/);
  if (!match) return -1;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
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

const formatDate = (dateString: string): string => dateString
  ? new Date(dateString).toLocaleDateString('zh-TW')
  : '';

const getFrequencyDescription = (prescription: any): string => {
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, medication_time_slots } = prescription;
  const getFrequencyAbbreviation = (count: number): string => {
    switch (count) {
      case 1: return 'QD';
      case 2: return 'BD';
      case 3: return 'TDS';
      case 4: return 'QID';
      default: return count ? `${count}次/日` : '';
    }
  };
  const timeSlotsCount = medication_time_slots?.length || 0;
  switch (frequency_type) {
    case 'daily':
      return getFrequencyAbbreviation(timeSlotsCount);
    case 'every_x_days':
      return `隔${frequency_value}日服`;
    case 'every_x_months':
      return `隔${frequency_value}月服`;
    case 'weekly_days': {
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') || '';
      return `逢${days}服`;
    }
    case 'odd_even_days':
      return is_odd_even_day === 'odd' ? '單日服' : is_odd_even_day === 'even' ? '雙日服' : '單雙日服';
    case 'hourly':
      return `每${frequency_value}小時服用`;
    default:
      return getFrequencyAbbreviation(timeSlotsCount);
  }
};

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
  [...timeSlots]
    .sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b))
    .slice(0, 4)
    .forEach((slot, index) => {
      timeSlotsMap[index + 1] = [slot];
    });
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
    timeSlots.forEach((timeSlot: string) => {
      if (!timeSlotsMap[1]) timeSlotsMap[1] = [];
      timeSlotsMap[1].push(timeSlot);
    });
    return timeSlotsMap;
  }
  if (shouldBreakTimeRangeRule(timeSlots)) {
    return mapTimeSlotsSequentially(timeSlots);
  }
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
    return [...timeSlots]
      .sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b))
      .map(timeSlot => ({ ...prescription, medication_time_slots: [timeSlot] }));
  });
};

const expandOralTopicalPrescriptions = (prescriptions: any[], routeType: RouteType): any[] => {
  if (routeType === 'injection') return prescriptions;
  return prescriptions.flatMap(prescription => {
    const timeSlots = prescription.medication_time_slots || [];
    if (timeSlots.length <= 4) return [prescription];
    const sortedTimeSlots = [...timeSlots].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
    const batches = [];
    for (let i = 0; i < sortedTimeSlots.length; i += 4) {
      batches.push({ ...prescription, medication_time_slots: sortedTimeSlots.slice(i, i + 4) });
    }
    return batches;
  });
};

const categorizePrescriptionsByRoute = (prescriptions: any[]) => {
  const oral: any[] = [];
  const injection: any[] = [];
  const topical: any[] = [];
  const noRoute: any[] = [];
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

const getDosageText = (prescription: any): string => {
  if (prescription.special_dosage_instruction) return prescription.special_dosage_instruction;
  if (prescription.dosage_amount) return `每次${prescription.dosage_amount}${prescription.dosage_unit || ''}`;
  return '';
};

const preparePages = async (config: HtmlSheetConfig): Promise<PageData[]> => {
  let processedPrescriptions = expandInjectionPrescriptions(config.prescriptions, config.routeType);
  processedPrescriptions = expandOralTopicalPrescriptions(processedPrescriptions, config.routeType);
  const prescriptionIds = processedPrescriptions.map(p => p.id);
  const workflowRecords = config.includeWorkflowRecords
    ? await fetchWorkflowRecordsForMonth(config.patient.院友id, prescriptionIds, config.selectedMonth)
    : [];
  const staffCodeMapping = config.includeWorkflowRecords
    ? generateStaffCodeMapping(extractStaffNamesFromWorkflowRecords(workflowRecords))
    : {};
  const pages: PageData[] = [];
  let prescriptionIndex = 0;
  let pageNumber = 1;
  while (prescriptionIndex < processedPrescriptions.length) {
    const pageTimeSlots: string[] = [];
    const pagePrescriptions: any[] = [];
    while (prescriptionIndex < processedPrescriptions.length && pagePrescriptions.length < 5) {
      const prescription = processedPrescriptions[prescriptionIndex];
      const prescriptionTimeSlots = prescription.medication_time_slots || [];
      const uniqueCount = new Set([...pageTimeSlots, ...prescriptionTimeSlots]).size;
      if (uniqueCount <= 6 || pagePrescriptions.length === 0) {
        pagePrescriptions.push(prescription);
        pageTimeSlots.push(...prescriptionTimeSlots);
        prescriptionIndex++;
      } else {
        break;
      }
    }
    pages.push({
      patient: config.patient,
      routeType: config.routeType,
      selectedMonth: config.selectedMonth,
      prescriptions: pagePrescriptions,
      timeSlots: [...new Set(pageTimeSlots)].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)),
      workflowRecords,
      staffCodeMapping,
      pageNumber
    });
    pageNumber++;
  }
  return pages;
};

const dayHeaders = () => Array.from({ length: 31 }, (_, index) => `<th class="day-col">${index + 1}</th>`).join('');

const renderHeaderRows = (page: PageData): string => {
  const patient = page.patient;
  const age = calculateAge(patient.出生日期);
  const name = `${patient.中文姓氏 || ''}${patient.中文名字 || ''}` || patient.中文姓名 || '';
  const allergy = patient.藥物敏感 && patient.藥物敏感.length > 0 ? patient.藥物敏感.join('、') : 'NKDA';
  const adverse = patient.不良藥物反應 && patient.不良藥物反應.length > 0 ? patient.不良藥物反應.join('、') : 'NKADR';
  return `
    <tr class="header-row tall-row">
      <td class="vertical-label" rowspan="2">藥物過敏反應 :</td>
      <td class="allergy-cell" colspan="9" rowspan="2">${htmlEscape(allergy)}</td>
      <td class="title-cell" colspan="17">${FACILITY_NAME} - 院友個人備藥及給藥記錄</td>
      <td class="field-label" colspan="3">姓名:</td>
      <td class="field-value spacer-cell"></td>
      <td class="field-value" colspan="5">${htmlEscape(name)}</td>
      <td class="field-label spacer-cell"></td>
      <td class="field-label" colspan="3">院號:</td>
      <td class="field-value" colspan="3">${htmlEscape(patient.床號 || '')}</td>
      <td></td>
    </tr>
    <tr class="header-row tall-row">
      <td class="route-title" colspan="17">${ROUTE_LABELS[page.routeType]}</td>
      <td class="field-label" colspan="3">性別 /年齡:</td>
      <td class="field-value spacer-cell"></td>
      <td class="field-value" colspan="5">${htmlEscape(`${patient.性別 || ''}/${age}`)}</td>
      <td class="field-label spacer-cell"></td>
      <td class="field-label" colspan="3">出生日期：</td>
      <td class="field-value" colspan="3">${htmlEscape(formatDate(patient.出生日期))}</td>
      <td></td>
    </tr>
    <tr class="header-row tall-row">
      <td class="vertical-label">藥物不良反應 :</td>
      <td colspan="9">${htmlEscape(adverse)}</td>
      <td colspan="17">${htmlEscape(formatMonthLabel(page.selectedMonth))}</td>
      <td colspan="3">相片</td>
      <td></td>
      <td colspan="5">${patient.院友相片 ? `<img class="patient-photo" src="${htmlEscape(patient.院友相片)}" alt="" />` : ''}</td>
      <td></td>
      <td colspan="3"></td>
      <td colspan="3"></td>
      <td></td>
    </tr>`;
};

const renderTableHeaders = (): string => `
  <tr class="section-header short-row">
    <th rowspan="2">處方日期</th>
    <th colspan="8" rowspan="2">藥物名稱及劑型</th>
    <th colspan="2" rowspan="2">途徑 / 次數</th>
    <th colspan="2" rowspan="2">時間</th>
    <th colspan="31">日期</th>
  </tr>
  <tr class="section-header short-row">
    ${dayHeaders()}
  </tr>`;

const renderDayCells = (
  page: PageData,
  prescription: any,
  rowOffset: number,
  slotsInRow: string[]
): string => {
  const daysInMonth = getDaysInMonth(page.selectedMonth);
  const cells: string[] = [];
  for (let day = 1; day <= 31; day++) {
    const isOverflowDay = day > daysInMonth;
    let content = '';
    let outsideRange = isOverflowDay;
    if (!isOverflowDay && slotsInRow.length > 0) {
      const dateStr = getDateString(page.selectedMonth, day);
      outsideRange = !slotsInRow.some(timeSlot => isDateInPrescriptionRange(dateStr, timeSlot, prescription));
      if (!outsideRange && page.workflowRecords.length > 0) {
        const isSelfCare = prescription.preparation_method === 'custom';
        if (isSelfCare) {
          content = 'S';
        } else {
          for (const timeSlot of slotsInRow) {
            const record = getWorkflowRecordForPrescriptionDateTimeSlot(page.workflowRecords, prescription.id, dateStr, timeSlot);
            const formatted = formatWorkflowCellContent(record, page.staffCodeMapping);
            if (formatted) {
              content = formatted;
              break;
            }
          }
        }
      }
    }
    cells.push(`<td class="day-cell ${outsideRange ? 'disabled-day' : ''}">${htmlEscape(content)}</td>`);
  }
  return cells.join('');
};

const renderPrescriptionRows = (page: PageData, prescription: any, index: number): string => {
  const timeSlotsMap = getTimeSlotsMap(prescription, page.routeType);
  const rows: string[] = [];
  for (let offset = 0; offset < 5; offset++) {
    const slots = timeSlotsMap[offset] || [];
    const timeText = slots.join(', ');
    const cells: string[] = [];
    if (offset === 0) {
      cells.push(`<td class="date-cell" rowspan="2">${htmlEscape(formatDate(prescription.prescription_date))}</td>`);
      cells.push(`<td class="drug-cell" colspan="8" rowspan="4">${htmlEscape(prescription.medication_name || '')}</td>`);
    }
    if (offset === 4) {
      cells.push(`<td class="source-cell" colspan="8">${htmlEscape(prescription.medication_source ? `藥物來源: ${prescription.medication_source}` : '')}</td>`);
    }
    const routeText = offset === 0
      ? prescription.administration_route || ''
      : offset === 1
        ? getFrequencyDescription(prescription)
        : offset === 2
          ? getDosageText(prescription)
          : offset === 3
            ? (prescription.is_prn ? '需要時' : '')
            : '';
    cells.push(`<td class="route-cell" colspan="2">${htmlEscape(routeText)}</td>`);
    cells.push(`<td class="time-cell" colspan="2">${htmlEscape(timeText)}</td>`);
    cells.push(renderDayCells(page, prescription, offset, slots));
    rows.push(`<tr class="prescription-row prescription-${index}">${cells.join('')}</tr>`);
  }
  return rows.join('');
};

const renderEmptyPrescriptionRows = (count: number): string => {
  let html = '';
  for (let group = 0; group < count; group++) {
    for (let offset = 0; offset < 5; offset++) {
      const cells = [];
      if (offset === 0) {
        cells.push('<td rowspan="2"></td><td colspan="8" rowspan="4"></td>');
      }
      if (offset === 4) {
        cells.push('<td colspan="8"></td>');
      }
      cells.push('<td colspan="2"></td><td colspan="2"></td>');
      cells.push(Array.from({ length: 31 }, () => '<td class="day-cell"></td>').join(''));
      html += `<tr class="prescription-row empty-row">${cells.join('')}</tr>`;
    }
  }
  return html;
};

const renderSummaryRows = (page: PageData): string => {
  const daysInMonth = getDaysInMonth(page.selectedMonth);
  const { line1, line2 } = formatStaffCodeNotation(page.staffCodeMapping);
  let html = '';
  for (let index = 0; index < 6; index++) {
    const timeSlot = page.timeSlots[index] || '';
    const rowCells = [];
    if (index === 0) {
      rowCells.push('<td class="summary-label" colspan="7" rowspan="4">給藥簽署</td>');
      rowCells.push('<td class="photo-block" colspan="4" rowspan="6"></td>');
    } else if (index === 4) {
      rowCells.push(`<td class="staff-legend" colspan="7">${htmlEscape(line1)}</td>`);
    } else if (index === 5) {
      rowCells.push(`<td class="staff-legend" colspan="7">${htmlEscape(line2)}</td>`);
    }
    rowCells.push(`<td class="time-cell" colspan="2">${htmlEscape(timeSlot)}</td>`);
    for (let day = 1; day <= 31; day++) {
      const isOverflowDay = day > daysInMonth;
      let content = '';
      let shouldBeGray = isOverflowDay || !timeSlot;
      if (!isOverflowDay && timeSlot && page.workflowRecords.length > 0) {
        const dateStr = getDateString(page.selectedMonth, day);
        for (const prescription of page.prescriptions) {
          if (!(prescription.medication_time_slots || []).includes(timeSlot)) continue;
          const isWithinRange = isDateInPrescriptionRange(dateStr, timeSlot, prescription);
          if (isWithinRange) shouldBeGray = false;
          if (!isWithinRange) continue;
          if (prescription.preparation_method === 'custom') {
            content = 'S';
            break;
          }
          const record = getWorkflowRecordForPrescriptionDateTimeSlot(page.workflowRecords, prescription.id, dateStr, timeSlot);
          const formatted = formatDispenseCellContent(record, page.staffCodeMapping);
          if (formatted) {
            content = formatted;
            break;
          }
        }
      }
      rowCells.push(`<td class="day-cell ${shouldBeGray ? 'disabled-day' : ''}">${htmlEscape(content)}</td>`);
    }
    html += `<tr class="summary-row">${rowCells.join('')}</tr>`;
  }
  return html;
};

const renderPage = (page: PageData): string => {
  const prescriptionRows = page.prescriptions.map((prescription, index) => renderPrescriptionRows(page, prescription, index)).join('');
  const emptyRows = renderEmptyPrescriptionRows(Math.max(0, 5 - page.prescriptions.length));
  return `
    <section class="medication-page">
      <table class="medication-sheet">
        <colgroup>
          <col class="col-a" />
          ${Array.from({ length: 8 }, () => '<col class="col-bi" />').join('')}
          <col class="col-j" /><col class="col-k" />
          <col class="col-l" /><col class="col-m" />
          ${Array.from({ length: 31 }, () => '<col class="day-col" />').join('')}
        </colgroup>
        <tbody>
          ${renderHeaderRows(page)}
          <tr class="gap-row">${Array.from({ length: 44 }, () => '<td></td>').join('')}</tr>
          ${renderTableHeaders()}
          ${prescriptionRows}
          ${emptyRows}
          ${renderSummaryRows(page)}
        </tbody>
      </table>
    </section>`;
};

const generateMedicationRecordHtml = (pages: PageData[]): string => `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>個人備藥及給藥記錄</title>
<style>
  @page { size: A4 landscape; margin: 4mm; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .print-toolbar { display: none !important; }
    .medication-page { page-break-after: always; break-after: page; box-shadow: none; margin: 0; }
    .medication-page:last-child { page-break-after: auto; break-after: auto; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px;
    background: #e5e7eb;
    font-family: "Microsoft JhengHei", "微軟正黑體", Arial, sans-serif;
    color: #111827;
  }
  .print-toolbar { position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; justify-content: center; padding: 8px; background: #ffffff; border-bottom: 1px solid #d1d5db; }
  .print-toolbar button { border: 1px solid #2563eb; background: #2563eb; color: #fff; border-radius: 6px; padding: 8px 14px; font-size: 14px; cursor: pointer; }
  .medication-page {
    width: 289mm;
    min-height: 202mm;
    margin: 0 auto 12px auto;
    padding: 0;
    background: white;
    box-shadow: 0 6px 18px rgba(0,0,0,0.16);
  }
  .medication-sheet {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8px;
    line-height: 1.12;
  }
  .medication-sheet th,
  .medication-sheet td {
    border: 1px solid #111;
    padding: 1px 2px;
    text-align: center;
    vertical-align: middle;
    word-break: break-word;
    overflow: hidden;
  }
  .col-a { width: 21.9mm; }
  .col-bi { width: 5.8mm; }
  .col-j, .col-k { width: 8mm; }
  .col-l { width: 4.3mm; }
  .col-m { width: 6.2mm; }
  .day-col { width: 4.85mm; }
  .tall-row td { height: 9.8mm; }
  .short-row th { height: 4mm; }
  .gap-row td { height: 1.5mm; border-left-color: transparent; border-right-color: transparent; }
  .prescription-row td, .summary-row td { height: 7mm; }
  .title-cell, .route-title { color: #1f4e79; font-size: 13px; font-weight: 700; }
  .route-title { font-size: 12px; }
  .vertical-label { font-weight: 700; writing-mode: vertical-rl; letter-spacing: 0; }
  .field-label { font-weight: 700; text-align: left; }
  .field-value, .allergy-cell { text-align: left; font-size: 11px; }
  .section-header th { background: #f3f4f6; font-weight: 700; }
  .drug-cell { text-align: left; font-size: 10px; font-weight: 600; }
  .source-cell { text-align: left; color: #374151; }
  .date-cell, .route-cell, .time-cell { font-size: 8px; }
  .day-cell { font-size: 8px; white-space: pre-line; }
  .disabled-day { background: #d9d9d9 !important; }
  .summary-label { font-size: 11px; font-weight: 700; }
  .staff-legend { text-align: left !important; font-size: 8px; }
  .photo-block { background: #fff; }
  .patient-photo { max-width: 100%; max-height: 20mm; object-fit: contain; }
</style>
</head>
<body>
  <div class="print-toolbar"><button onclick="window.print()">列印 HTML 藥紙</button></div>
  ${pages.map(renderPage).join('')}
</body>
</html>`;

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

const buildPagesForPatients = async (
  selectedPatients: any[],
  selectedMonth: string,
  includeWorkflowRecords: boolean
): Promise<PageData[]> => {
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
      const pages = await preparePages({
        patient,
        prescriptions: routeConfig.prescriptions,
        routeType: routeConfig.routeType,
        selectedMonth,
        includeWorkflowRecords
      });
      allPages.push(...pages);
    }
  }
  return allPages;
};

export const exportMedicationRecordToHtml = async (
  selectedPatients: any[],
  selectedMonth: string,
  includeWorkflowRecords: boolean = false
): Promise<void> => {
  const pages = await buildPagesForPatients(selectedPatients, selectedMonth, includeWorkflowRecords);
  if (pages.length === 0) {
    throw new Error('沒有可匯出的處方資料。所有處方可能都缺少途徑資訊或不符合匯出條件。');
  }
  openPrintableHtml(generateMedicationRecordHtml(pages));
};

export const exportSelectedMedicationRecordToHtml = async (
  selectedPrescriptionIds: string[],
  currentPatient: any,
  allPrescriptions: any[],
  selectedMonth: string,
  includeInactive: boolean = false,
  includeWorkflowRecords: boolean = false
): Promise<void> => {
  let prescriptionsToExport: any[];
  if (selectedPrescriptionIds.length === 0) {
    prescriptionsToExport = allPrescriptions.filter(p => {
      if (p.patient_id !== currentPatient.院友id) return false;
      if (p.status === 'pending_change') return false;
      if (p.status === 'inactive' && !includeInactive) return false;
      return true;
    });
  } else {
    prescriptionsToExport = allPrescriptions.filter(p =>
      selectedPrescriptionIds.includes(p.id) && p.patient_id === currentPatient.院友id
    );
  }
  if (prescriptionsToExport.length === 0) {
    throw new Error('沒有可匯出的處方');
  }
  await exportMedicationRecordToHtml([
    {
      ...currentPatient,
      prescriptions: prescriptionsToExport
    }
  ], selectedMonth, includeWorkflowRecords);
};
