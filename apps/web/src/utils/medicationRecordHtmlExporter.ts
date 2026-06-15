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

const COLUMN_WIDTHS = [
  21.90625, 6, 6, 6, 6, 6, 6, 5.453125, 5.453125, 8.26953125, 8.26953125,
  4.36328125, 6.26953125, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5
];

const ROW_HEIGHTS = [
  37.15, 37.15, 37.15, 10.5, 15, 15,
  ...Array.from({ length: 31 }, () => 26.5)
];

interface GridCell {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  content: string;
  className: string;
}

const gridKey = (row: number, col: number): string => `${row}:${col}`;

const renderGridCell = (cell: GridCell): string => `
  <div class="sheet-cell ${cell.className}" style="grid-row:${cell.row} / span ${cell.rowSpan}; grid-column:${cell.col} / span ${cell.colSpan};">
    ${cell.content}
  </div>`;

const renderDayCells = (
  page: PageData,
  prescription: any,
  rowOffset: number,
  slotsInRow: string[]
): Array<{ content: string; disabled: boolean }> => {
  const daysInMonth = getDaysInMonth(page.selectedMonth);
  const cells: Array<{ content: string; disabled: boolean }> = [];
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
    cells.push({ content, disabled: outsideRange });
  }
  return cells;
};

const renderSummaryDayCells = (page: PageData): Array<Array<{ content: string; disabled: boolean }>> => {
  const daysInMonth = getDaysInMonth(page.selectedMonth);
  const rows: Array<Array<{ content: string; disabled: boolean }>> = [];
  for (let index = 0; index < 6; index++) {
    const timeSlot = page.timeSlots[index] || '';
    const cells: Array<{ content: string; disabled: boolean }> = [];
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
      cells.push({ content, disabled: shouldBeGray });
    }
    rows.push(cells);
  }
  return rows;
};

const renderPage = (page: PageData): string => {
  const patient = page.patient;
  const age = calculateAge(patient.出生日期);
  const name = `${patient.中文姓氏 || ''}${patient.中文名字 || ''}` || patient.中文姓名 || '';
  const allergy = patient.藥物敏感 && patient.藥物敏感.length > 0 ? patient.藥物敏感.join('、') : 'NKDA';
  const adverse = patient.不良藥物反應 && patient.不良藥物反應.length > 0 ? patient.不良藥物反應.join('、') : 'NKADR';
  const cells = new Map<string, GridCell>();
  const covered = new Set<string>();

  const addCell = (
    row: number,
    col: number,
    rowSpan = 1,
    colSpan = 1,
    content = '',
    className = ''
  ) => {
    cells.set(gridKey(row, col), { row, col, rowSpan, colSpan, content, className });
    for (let rowIndex = row; rowIndex < row + rowSpan; rowIndex++) {
      for (let colIndex = col; colIndex < col + colSpan; colIndex++) {
        if (rowIndex !== row || colIndex !== col) covered.add(gridKey(rowIndex, colIndex));
      }
    }
  };

  addCell(1, 1, 2, 1, '藥物過敏反應 :', 'label-lg');
  addCell(1, 2, 2, 9, htmlEscape(allergy), 'text-left value-lg');
  addCell(3, 1, 1, 1, '藥物不良反應 :', 'label-lg');
  addCell(3, 2, 1, 9, htmlEscape(adverse), 'text-left value-lg');
  addCell(1, 11, 1, 17, `${FACILITY_NAME} - 院友個人備藥及給藥記錄`, 'title');
  addCell(2, 11, 1, 17, ROUTE_LABELS[page.routeType], 'route-title');
  addCell(3, 11, 1, 17, htmlEscape(formatMonthLabel(page.selectedMonth)), 'month-title');
  addCell(1, 28, 1, 3, '姓名:', 'field-label');
  addCell(1, 32, 1, 5, htmlEscape(name), 'field-value');
  addCell(1, 38, 1, 3, '院號:', 'field-label');
  addCell(1, 41, 1, 3, htmlEscape(patient.床號 || ''), 'field-value');
  addCell(2, 28, 1, 3, '性別 /年齡:', 'field-label');
  addCell(2, 32, 1, 5, htmlEscape(`${patient.性別 || ''}/${age}`), 'field-value');
  addCell(2, 38, 1, 3, '出生日期:', 'field-label');
  addCell(2, 41, 1, 3, htmlEscape(formatDate(patient.出生日期)), 'field-value');

  addCell(5, 1, 2, 1, '處方日期', 'header-cell');
  addCell(5, 2, 2, 8, '藥物名稱及劑型', 'header-cell drug-header');
  addCell(5, 10, 2, 2, '途徑 / 次數', 'header-cell');
  addCell(5, 14, 2, 31, '執 / 核　藥　職　員　簽　署', 'header-cell sign-header');

  const groupStarts = [7, 12, 17, 22, 27];
  groupStarts.forEach((startRow, prescriptionIndex) => {
    const prescription = page.prescriptions[prescriptionIndex];
    const timeSlotsMap = prescription ? getTimeSlotsMap(prescription, page.routeType) : {};
    addCell(startRow, 1, 2, 1, prescription ? htmlEscape(formatDate(prescription.prescription_date)) : '', 'date-cell');
    addCell(startRow + 3, 1, 2, 1, '<span>執:</span><span>核:</span>', 'diagonal-sign');
    addCell(startRow, 2, 4, 8, prescription ? htmlEscape(prescription.medication_name || '') : '', 'drug-cell');
    addCell(startRow + 4, 2, 1, 8, prescription?.medication_source ? htmlEscape(`藥物來源: ${prescription.medication_source}`) : '', 'source-cell');
    addCell(startRow, 10, 1, 2, prescription ? htmlEscape(prescription.administration_route || '') : '', 'route-cell');
    addCell(startRow + 1, 10, 1, 2, prescription ? htmlEscape(getFrequencyDescription(prescription)) : '', 'route-cell');
    addCell(startRow + 2, 10, 1, 2, prescription ? htmlEscape(getDosageText(prescription)) : '', 'route-cell');
    addCell(startRow + 3, 10, 1, 2, prescription?.is_prn ? '需要時' : '', 'route-cell');
    addCell(startRow + 4, 10, 1, 2, '', 'route-cell');

    for (let offset = 0; offset < 5; offset++) {
      const row = startRow + offset;
      const slots = timeSlotsMap[offset] || [];
      const timeContent = page.routeType === 'injection' && offset === 2 ? '注射位置' : htmlEscape(slots.join(', '));
      addCell(row, 12, 1, 2, offset === 0 ? '服用時間' : timeContent, offset === 0 ? 'time-label' : 'time-cell');
      for (let day = 1; day <= 31; day++) {
        const col = 13 + day;
        if (offset === 0) {
          addCell(row, col, 1, 1, String(day), 'day-header');
          continue;
        }
        if (page.routeType === 'injection' && offset === 2) {
          addCell(row, col, 1, 1, '', 'day-cell');
          continue;
        }
        const dayCell = prescription ? renderDayCells(page, prescription, offset, slots)[day - 1] : { content: '', disabled: false };
        addCell(row, col, 1, 1, htmlEscape(dayCell.content), `day-cell diagonal-day${dayCell.disabled ? ' disabled-day' : ''}`);
      }
    }
  });

  const { line1, line2 } = formatStaffCodeNotation(page.staffCodeMapping);
  addCell(32, 1, 4, 7, '給藥記錄簽署<br />簽名=已服藥; HL=因事回家; A=入院; S=自理;<br />LM=缺藥中; C=已痊愈; P=暫停;<br />R=拒絕一種或以上藥物; O=其他 (請註明);<br />R或O 請通知護士/保健員作出跟進並作適當記錄;<br />處方日期=該藥物第一次被處方的使用日期', 'legend-cell');
  addCell(36, 1, 1, 7, htmlEscape(line1), 'legend-cell staff-code');
  addCell(37, 1, 1, 7, htmlEscape(line2), 'legend-cell staff-code');
  addCell(32, 8, 6, 2, patient.院友相片 ? `<img class="patient-photo" src="${htmlEscape(patient.院友相片)}" alt="" />` : '', 'photo-cell');
  addCell(32, 10, 6, 2, '給藥簽署', 'dispense-title');

  const summaryDayRows = renderSummaryDayCells(page);
  for (let index = 0; index < 6; index++) {
    const row = 32 + index;
    addCell(row, 12, 1, 2, htmlEscape(page.timeSlots[index] || ''), 'time-cell');
    for (let day = 1; day <= 31; day++) {
      const dayCell = summaryDayRows[index]?.[day - 1] || { content: '', disabled: true };
      addCell(row, 13 + day, 1, 1, htmlEscape(dayCell.content), `summary-day${dayCell.disabled ? ' disabled-day' : ''}`);
    }
  }

  const renderedCells: string[] = [];
  for (let row = 1; row <= 37; row++) {
    for (let col = 1; col <= 44; col++) {
      if (covered.has(gridKey(row, col))) continue;
      const existingCell = cells.get(gridKey(row, col));
      renderedCells.push(renderGridCell(existingCell || { row, col, rowSpan: 1, colSpan: 1, content: '', className: '' }));
    }
  }

  return `<section class="medication-page"><div class="medication-sheet-grid">${renderedCells.join('')}</div></section>`;
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
    height: 202mm;
    margin: 0 auto 12px auto;
    padding: 0;
    background: white;
    box-shadow: 0 6px 18px rgba(0,0,0,0.16);
  }
  .medication-sheet-grid {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: ${COLUMN_WIDTHS.map(width => `${width}fr`).join(' ')};
    grid-template-rows: ${ROW_HEIGHTS.map(height => `${height}fr`).join(' ')};
    font-family: "PMingLiU", "新細明體", "MingLiU", serif;
    color: #000;
    background: #fff;
  }
  .sheet-cell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    border: 0.7px solid #111;
    margin: -0.35px 0 0 -0.35px;
    padding: 1px 2px;
    overflow: hidden;
    font-size: 8px;
    line-height: 1.08;
    text-align: center;
    white-space: pre-line;
    word-break: break-word;
  }
  .title { font-size: 16px; }
  .route-title { align-items: flex-start; padding-top: 3px; font-size: 20px; text-decoration: underline; }
  .month-title { font-size: 11px; border-top-color: transparent; }
  .label-lg { font-size: 13px; }
  .value-lg { align-items: flex-start; justify-content: flex-start; padding: 5px; font-size: 12px; }
  .field-label { justify-content: flex-start; padding-left: 3px; font-size: 13px; }
  .field-value { font-size: 14px; font-weight: 700; }
  .header-cell { font-size: 13px; }
  .drug-header { font-size: 15px; }
  .sign-header { font-size: 14px; letter-spacing: 8px; }
  .date-cell, .route-cell, .time-cell, .time-label { font-size: 8px; }
  .drug-cell { align-items: flex-start; justify-content: flex-start; padding: 4px; font-size: 10px; text-align: left; }
  .source-cell { justify-content: flex-start; padding-left: 4px; font-size: 8px; text-align: left; }
  .day-header { font-size: 13px; font-weight: 700; }
  .day-header::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-top: 4px solid #008000;
    border-right: 4px solid transparent;
  }
  .diagonal-day::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, transparent calc(50% - 0.35px), #111 calc(50% - 0.35px), #111 calc(50% + 0.35px), transparent calc(50% + 0.35px));
    pointer-events: none;
  }
  .disabled-day { background: #d3d3d3 !important; }
  .disabled-day::after { display: none; }
  .diagonal-sign {
    align-items: stretch;
    justify-content: space-between;
    padding: 3px;
    font-size: 15px;
  }
  .diagonal-sign::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom right, transparent calc(50% - 0.35px), #111 calc(50% - 0.35px), #111 calc(50% + 0.35px), transparent calc(50% + 0.35px));
    pointer-events: none;
  }
  .diagonal-sign span:first-child { align-self: flex-end; }
  .diagonal-sign span:last-child { align-self: center; }
  .legend-cell { align-items: flex-start; justify-content: flex-start; padding: 2px; font-size: 9px; line-height: 1.2; text-align: left; }
  .staff-code { font-size: 8px; }
  .photo-cell { padding: 1px; }
  .patient-photo { max-width: 100%; max-height: 100%; object-fit: contain; }
  .dispense-title { font-size: 18px; }
  .summary-day { font-size: 8px; }
  .text-left { text-align: left; justify-content: flex-start; }
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
