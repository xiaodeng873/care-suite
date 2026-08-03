import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { formatDisplayDate } from './dateFormat';
import type {
  Patient,
  Station,
  MealGuidance,
  PatientHealthTask,
  PatientTubeCareRecord,
  InfectionControlRecord,
  VitalSignType,
  MonitoringTaskNotes,
  DiaperChangeRecord,
  PatientCareTab
} from '../lib/database';
import { formatFrequencyDescription } from './taskScheduler';

export interface BaseStatisticsReportOptions {
  patients: Patient[];
  stations: Station[];
  separateSheetsPerStation?: boolean;
  filename?: string;
}

export interface MealStatisticsReportOptions extends BaseStatisticsReportOptions {
  mealGuidances: MealGuidance[];
}

export interface TubeCareStatisticsReportOptions extends BaseStatisticsReportOptions {
  patientTubeCareRecords: PatientTubeCareRecord[];
}

export interface InfectionControlStatisticsReportOptions extends BaseStatisticsReportOptions {
  infectionControlRecords: InfectionControlRecord[];
}

export interface SpecialCareStatisticsReportOptions extends BaseStatisticsReportOptions {
  patientHealthTasks: PatientHealthTask[];
}

export interface DrugSensitivityStatisticsReportOptions extends BaseStatisticsReportOptions {
  /** no extra data needed; patient fields are used */
}

export interface DiaperStatisticsReportOptions extends BaseStatisticsReportOptions {
  diaperChangeRecords: DiaperChangeRecord[];
  /** 床頭記錄開啟「換片記錄」tab 的院友（is_hidden=false），用於決定列入報表的院友名單 */
  patientCareTabs?: PatientCareTab[];
  /** 指定統計月份範圍（YYYY-MM）；未指定則預設最近 9 個月（以最後記錄月份為結束） */
  monthRange?: { startMonth: string; endMonth: string };
}

/** 月份字串（YYYY-MM）加減月數 */
function shiftDiaperMonth(month: string, delta: number): string {
  let year = Number(month.slice(0, 4));
  let monthNum = Number(month.slice(5, 7)) + delta;
  while (monthNum > 12) { monthNum -= 12; year += 1; }
  while (monthNum < 1) { monthNum += 12; year -= 1; }
  return `${year}-${String(monthNum).padStart(2, '0')}`;
}

/** 產生連續月份陣列（YYYY-MM，含起訖） */
function buildDiaperMonthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  let current = startMonth;
  let guard = 0;
  while (current <= endMonth && guard < 600) {
    months.push(current);
    current = shiftDiaperMonth(current, 1);
    guard += 1;
  }
  return months;
}

function patientDisplayName(patient: Patient | undefined): string {
  if (!patient) return '未知院友';
  return `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`.trim() || patient.中文姓名 || '未知院友';
}

function getReportStationId(p: Patient): string | null | undefined {
  if (p.在住狀態 === '在住') return p.station_id;
  return p.last_station_id || p.station_id;
}

function patientBedNumber(patient: Patient | undefined): string {
  if (!patient) return '';
  return patient.床號 || '';
}

function groupPatientsByStation(
  patients: Patient[],
  stations: Station[]
): { stationId: string; stationName: string; patients: Patient[] }[] {
  const stationMap = new Map(stations.map(s => [s.id, s]));
  const byStation = new Map<string, Patient[]>();
  for (const p of patients) {
    const stationId = getReportStationId(p) || 'unknown';
    const list = byStation.get(stationId) || [];
    list.push(p);
    byStation.set(stationId, list);
  }
  const groups: { stationId: string; stationName: string; patients: Patient[] }[] = [];
  for (const [stationId, groupPatients] of byStation) {
    groups.push({
      stationId,
      stationName: stationMap.get(stationId)?.name || '未分區',
      patients: groupPatients,
    });
  }
  groups.sort((a, b) => {
    const idxA = stations.findIndex(s => s.id === a.stationId);
    const idxB = stations.findIndex(s => s.id === b.stationId);
    if (idxA === -1 && idxB === -1) return a.stationName.localeCompare(b.stationName, 'zh-Hant');
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
  return groups;
}

interface SheetColumn {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

function createSheetCore(
  worksheet: ExcelJS.Worksheet,
  title: string,
  exportDate: string,
  columns: SheetColumn[]
) {
  worksheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Arial', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  worksheet.getCell(2, 1).value = `匯出日期：${exportDate}`;
  worksheet.getCell(2, 1).font = { name: 'Arial', size: 10 };

  const headerRow = worksheet.getRow(4);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    cell.alignment = { horizontal: column.align || 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  worksheet.getRow(4).height = 22;

  columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width;
  });

  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9
  };

  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
}

function fillDataRows(
  worksheet: ExcelJS.Worksheet,
  rows: (string | number | null)[][],
  startRow: number,
  columns: SheetColumn[]
) {
  rows.forEach((rowValues, rowIndex) => {
    const dataRow = worksheet.getRow(startRow + rowIndex);
    rowValues.forEach((value, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      cell.value = value ?? '';
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { horizontal: columns[colIndex].align || 'left', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    dataRow.height = 20;
  });
}

function writeWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
) {
  return workbook.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// 餐膳統計報表
// ───────────────────────────────────────────────────────────────────────────────

const MEAL_COLUMNS: SheetColumn[] = [
  { header: '居住區', width: 18 },
  { header: '床號', width: 12, align: 'center' },
  { header: '姓名', width: 18 },
  { header: '餐膳組合', width: 20 },
  { header: '特殊餐膳', width: 30 },
  { header: '凝固粉', width: 10, align: 'center' },
  { header: '雞蛋數量', width: 12, align: 'center' },
  { header: '鼻胃飼', width: 10, align: 'center' },
  { header: '備註', width: 40 },
];

const MEAL_SUMMARY_COLUMNS: SheetColumn[] = [
  { header: '居住區', width: 18 },
  { header: '餐膳總數', width: 12, align: 'center' },
  { header: '需要凝固粉', width: 14, align: 'center' },
  { header: '正飯', width: 10, align: 'center' },
  { header: '軟飯', width: 10, align: 'center' },
  { header: '糊飯', width: 10, align: 'center' },
  { header: '正餸', width: 10, align: 'center' },
  { header: '碎餸', width: 10, align: 'center' },
  { header: '糊餸', width: 10, align: 'center' },
  { header: '糖尿餐', width: 10, align: 'center' },
  { header: '痛風餐', width: 10, align: 'center' },
  { header: '低鹽餐', width: 10, align: 'center' },
  { header: '雞蛋總數', width: 12, align: 'center' },
];

interface MealKitchenStats {
  餐膳總數: number;
  需要凝固粉: number;
  正飯: number;
  軟飯: number;
  糊飯: number;
  正餸: number;
  碎餸: number;
  糊餸: number;
  糖尿餐: number;
  痛風餐: number;
  低鹽餐: number;
  雞蛋總數: number;
}

function computeMealKitchenStats(guidances: MealGuidance[]): MealKitchenStats {
  return {
    餐膳總數: guidances.length,
    需要凝固粉: guidances.filter(g => g.needs_thickener).length,
    正飯: guidances.filter(g => g.meal_combination?.includes('正飯')).length,
    軟飯: guidances.filter(g => g.meal_combination?.includes('軟飯')).length,
    糊飯: guidances.filter(g => g.meal_combination?.includes('糊飯')).length,
    正餸: guidances.filter(g => g.meal_combination?.includes('正餸')).length,
    碎餸: guidances.filter(g => g.meal_combination?.includes('碎餸')).length,
    糊餸: guidances.filter(g => g.meal_combination?.includes('糊餸')).length,
    糖尿餐: guidances.filter(g => g.special_diets?.includes('糖尿餐')).length,
    痛風餐: guidances.filter(g => g.special_diets?.includes('痛風餐')).length,
    低鹽餐: guidances.filter(g => g.special_diets?.includes('低鹽餐')).length,
    雞蛋總數: guidances
      .filter(g => g.special_diets?.includes('雞蛋') && g.egg_quantity)
      .reduce((sum, g) => sum + (g.egg_quantity || 0), 0),
  };
}

export async function exportMealStatisticsToExcel(options: MealStatisticsReportOptions): Promise<void> {
  const { patients, stations, mealGuidances, separateSheetsPerStation = false, filename } = options;
  const guidanceMap = new Map<number, MealGuidance[]>();
  for (const mg of mealGuidances) {
    const list = guidanceMap.get(mg.patient_id) || [];
    list.push(mg);
    guidanceMap.set(mg.patient_id, list);
  }
  const activePatients = patients.filter(p => p.在住狀態 === '在住');
  const groups = groupPatientsByStation(activePatients, stations);
  const exportDate = formatDisplayDate(new Date());

  if (!activePatients.some(p => guidanceMap.has(p.院友id))) {
    alert('沒有可匯出的餐膳記錄');
    return;
  }

  const buildRows = (groupPatients: Patient[]) => {
    const rows: (string | number | null)[][] = [];
    const sortedPatients = [...groupPatients].sort((a, b) => {
      const bedA = a.床號 || '';
      const bedB = b.床號 || '';
      if (bedA !== bedB) return bedA.localeCompare(bedB, 'zh-Hant');
      return patientDisplayName(a).localeCompare(patientDisplayName(b), 'zh-Hant');
    });
    for (const patient of sortedPatients) {
      const guidances = guidanceMap.get(patient.院友id) || [];
      for (const g of guidances) {
        rows.push([
          '',
          patientBedNumber(patient),
          patientDisplayName(patient),
          g.meal_combination || '',
          (g.special_diets || []).join('、'),
          g.needs_thickener ? '是' : '否',
          g.egg_quantity ?? '',
          g.special_diets?.includes('鼻胃飼') ? '是' : '否',
          g.remarks || ''
        ]);
      }
    }
    return rows;
  };

  const buildSummaryRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [];
    const allGuidances = groups.flatMap(g => (g.patients || []).flatMap(p => guidanceMap.get(p.院友id) || []));
    const allStats = computeMealKitchenStats(allGuidances);
    rows.push(['全部', ...Object.values(allStats)]);
    for (const group of groups) {
      const groupGuidances = group.patients.flatMap(p => guidanceMap.get(p.院友id) || []);
      if (groupGuidances.length === 0) continue;
      const stats = computeMealKitchenStats(groupGuidances);
      rows.push([group.stationName, ...Object.values(stats)]);
    }
    return rows;
  };

  const workbook = new ExcelJS.Workbook();

  // 先加入每居住區廚房統計摘要 sheet
  const summaryRows = buildSummaryRows();
  const summarySheet = workbook.addWorksheet('廚房統計摘要');
  summarySheet.mergeCells('A1:M1');
  const summaryTitleCell = summarySheet.getCell('A1');
  summaryTitleCell.value = '餐膳廚房統計摘要';
  summaryTitleCell.font = { name: 'Arial', size: 16, bold: true };
  summaryTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(1).height = 30;
  summarySheet.getCell('A2').value = `匯出日期：${exportDate}`;
  summarySheet.getCell('A2').font = { name: 'Arial', size: 10 };
  const summaryHeaderRow = summarySheet.getRow(4);
  MEAL_SUMMARY_COLUMNS.forEach((column, index) => {
    const cell = summaryHeaderRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    cell.alignment = { horizontal: column.align || 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  summarySheet.getRow(4).height = 22;
  MEAL_SUMMARY_COLUMNS.forEach((column, index) => {
    summarySheet.getColumn(index + 1).width = column.width;
  });
  summaryRows.forEach((rowValues, rowIndex) => {
    const dataRow = summarySheet.getRow(5 + rowIndex);
    rowValues.forEach((value, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      cell.value = value;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    dataRow.height = 20;
  });
  summarySheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
  summarySheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9
  };

  if (separateSheetsPerStation) {
    for (const group of groups) {
      const rows = buildRows(group.patients);
      const worksheet = workbook.addWorksheet(group.stationName.slice(0, 31));
      createSheetCore(worksheet, `${group.stationName} 餐膳統計報表`, exportDate, MEAL_COLUMNS);
      fillDataRows(worksheet, rows, 5, MEAL_COLUMNS);
    }
  } else {
    const allRows: (string | number | null)[][] = [];
    for (const group of groups) {
      const groupRows = buildRows(group.patients);
      for (const row of groupRows) {
        row[0] = group.stationName;
      }
      allRows.push(...groupRows);
    }
    const worksheet = workbook.addWorksheet('餐膳明細');
    createSheetCore(worksheet, '餐膳統計報表', exportDate, MEAL_COLUMNS);
    fillDataRows(worksheet, allRows, 5, MEAL_COLUMNS);
  }

  await writeWorkbook(workbook, filename || `餐膳統計報表_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ───────────────────────────────────────────────────────────────────────────────
// 喉管護理報表
// ───────────────────────────────────────────────────────────────────────────────

const TUBE_COLUMNS: SheetColumn[] = [
  { header: '居住區', width: 18 },
  { header: '床號', width: 12, align: 'center' },
  { header: '姓名', width: 18 },
  { header: '喉管護理類型', width: 20 },
  { header: '喉管性質', width: 20 },
  { header: '管徑', width: 12, align: 'center' },
  { header: '上次完成', width: 16, align: 'center' },
  { header: '下次到期', width: 16, align: 'center' },
  { header: '備註', width: 40 },
];

export async function exportTubeCareStatisticsToExcel(options: TubeCareStatisticsReportOptions): Promise<void> {
  const { patients, stations, patientTubeCareRecords, separateSheetsPerStation = false, filename } = options;
  const patientMap = new Map(patients.map(p => [p.院友id, p]));

  // 只取每個院友每種 care_type 的當前（最新）非終止記錄，排除歷史
  const currentRecordByKey = new Map<string, PatientTubeCareRecord>();
  for (const record of patientTubeCareRecords) {
    if (record.is_terminated) continue;
    const key = `${record.patient_id}_${record.care_type}`;
    const existing = currentRecordByKey.get(key);
    const recordDate = record.execution_date || record.updated_at || record.created_at;
    const existingDate = existing ? (existing.execution_date || existing.updated_at || existing.created_at) : '';
    if (!existing || recordDate > existingDate) {
      currentRecordByKey.set(key, record);
    }
  }
  const recordMap = new Map<number, PatientTubeCareRecord[]>();
  for (const record of currentRecordByKey.values()) {
    const list = recordMap.get(record.patient_id) || [];
    list.push(record);
    recordMap.set(record.patient_id, list);
  }

  const activePatients = patients.filter(p => p.在住狀態 === '在住');
  const groups = groupPatientsByStation(activePatients, stations);
  const exportDate = formatDisplayDate(new Date());

  if (!activePatients.some(p => recordMap.has(p.院友id))) {
    alert('沒有可匯出的喉管護理記錄');
    return;
  }

  const buildRows = (groupPatients: Patient[]) => {
    const rows: (string | number | null)[][] = [];
    const sortedPatients = [...groupPatients].sort((a, b) => {
      const bedA = a.床號 || '';
      const bedB = b.床號 || '';
      if (bedA !== bedB) return bedA.localeCompare(bedB, 'zh-Hant');
      return patientDisplayName(a).localeCompare(patientDisplayName(b), 'zh-Hant');
    });
    for (const patient of sortedPatients) {
      const records = recordMap.get(patient.院友id) || [];
      if (records.length === 0) continue;
      const sortedRecords = [...records].sort((a, b) =>
        (a.care_type || '').localeCompare(b.care_type || '', 'zh-Hant')
      );
      for (const record of sortedRecords) {
        const natureParts = [record.tube_material, record.oxygen_action].filter(Boolean);
        rows.push([
          '',
          patientBedNumber(patient),
          patientDisplayName(patient),
          record.care_type,
          natureParts.join(' / '),
          record.tube_size || '',
          record.execution_date ? formatDisplayDate(record.execution_date) : '',
          record.next_due_date ? formatDisplayDate(record.next_due_date) : '',
          record.notes || ''
        ]);
      }
    }
    return rows;
  };

  const workbook = new ExcelJS.Workbook();
  if (separateSheetsPerStation) {
    for (const group of groups) {
      const rows = buildRows(group.patients);
      const worksheet = workbook.addWorksheet(group.stationName.slice(0, 31));
      createSheetCore(worksheet, `${group.stationName} 喉管護理報表`, exportDate, TUBE_COLUMNS);
      fillDataRows(worksheet, rows, 5, TUBE_COLUMNS);
    }
  } else {
    const allRows: (string | number | null)[][] = [];
    for (const group of groups) {
      const groupRows = buildRows(group.patients);
      for (const row of groupRows) {
        row[0] = group.stationName;
      }
      allRows.push(...groupRows);
    }
    const worksheet = workbook.addWorksheet('喉管護理報表');
    createSheetCore(worksheet, '喉管護理報表', exportDate, TUBE_COLUMNS);
    fillDataRows(worksheet, allRows, 5, TUBE_COLUMNS);
  }

  await writeWorkbook(workbook, filename || `喉管護理報表_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ───────────────────────────────────────────────────────────────────────────────
// 感染控制報表
// ───────────────────────────────────────────────────────────────────────────────

const INFECTION_COLUMNS: SheetColumn[] = [
  { header: '居住區', width: 18 },
  { header: '床號', width: 12, align: 'center' },
  { header: '姓名', width: 18 },
  { header: '感染類型', width: 22 },
  { header: '診斷日期', width: 16, align: 'center' },
  { header: '康復日期', width: 16, align: 'center' },
  { header: '備註', width: 50 },
];

export async function exportInfectionControlStatisticsToExcel(options: InfectionControlStatisticsReportOptions): Promise<void> {
  const { patients, stations, infectionControlRecords, separateSheetsPerStation = false, filename } = options;
  const patientMap = new Map(patients.map(p => [p.院友id, p]));
  const recordMap = new Map<number, InfectionControlRecord[]>();
  for (const record of infectionControlRecords) {
    const list = recordMap.get(record.patient_id) || [];
    list.push(record);
    recordMap.set(record.patient_id, list);
  }
  const activePatients = patients.filter(p => p.在住狀態 === '在住');
  const groups = groupPatientsByStation(activePatients, stations);
  const exportDate = formatDisplayDate(new Date());

  if (!activePatients.some(p => recordMap.has(p.院友id))) {
    alert('沒有可匯出的感染控制記錄');
    return;
  }

  const buildRows = (groupPatients: Patient[]) => {
    const rows: (string | number | null)[][] = [];
    const sortedPatients = [...groupPatients].sort((a, b) => {
      const bedA = a.床號 || '';
      const bedB = b.床號 || '';
      if (bedA !== bedB) return bedA.localeCompare(bedB, 'zh-Hant');
      return patientDisplayName(a).localeCompare(patientDisplayName(b), 'zh-Hant');
    });
    for (const patient of sortedPatients) {
      const records = recordMap.get(patient.院友id) || [];
      if (records.length === 0) continue;
      const sortedRecords = [...records].sort((a, b) =>
        (b.diagnosis_date || '').localeCompare(a.diagnosis_date || '')
      );
      for (const record of sortedRecords) {
        rows.push([
          '',
          patientBedNumber(patient),
          patientDisplayName(patient),
          record.infection_type || '未分類',
          record.diagnosis_date ? formatDisplayDate(record.diagnosis_date) : '',
          record.recovery_date ? formatDisplayDate(record.recovery_date) : '',
          record.notes || ''
        ]);
      }
    }
    return rows;
  };

  const workbook = new ExcelJS.Workbook();
  if (separateSheetsPerStation) {
    for (const group of groups) {
      const rows = buildRows(group.patients);
      const worksheet = workbook.addWorksheet(group.stationName.slice(0, 31));
      createSheetCore(worksheet, `${group.stationName} 感染控制報表`, exportDate, INFECTION_COLUMNS);
      fillDataRows(worksheet, rows, 5, INFECTION_COLUMNS);
    }
  } else {
    const allRows: (string | number | null)[][] = [];
    for (const group of groups) {
      const groupRows = buildRows(group.patients);
      for (const row of groupRows) {
        row[0] = group.stationName;
      }
      allRows.push(...groupRows);
    }
    const worksheet = workbook.addWorksheet('感染控制報表');
    createSheetCore(worksheet, '感染控制報表', exportDate, INFECTION_COLUMNS);
    fillDataRows(worksheet, allRows, 5, INFECTION_COLUMNS);
  }

  await writeWorkbook(workbook, filename || `感染控制報表_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ───────────────────────────────────────────────────────────────────────────────
// 特別關顧報表
// ───────────────────────────────────────────────────────────────────────────────

const SPECIAL_CARE_COLUMNS: SheetColumn[] = [
  { header: '居住區', width: 18 },
  { header: '床號', width: 12, align: 'center' },
  { header: '姓名', width: 18 },
  { header: '監測項目', width: 16, align: 'center' },
  { header: '頻率', width: 20 },
  { header: '指定時間', width: 16, align: 'center' },
  { header: '下次到期', width: 18, align: 'center' },
  { header: '備註', width: 40 },
];

function formatTaskFrequency(task: PatientHealthTask): string {
  try {
    return formatFrequencyDescription(task);
  } catch {
    return `${task.frequency_value} ${task.frequency_unit}`;
  }
}

export async function exportSpecialCareStatisticsToExcel(options: SpecialCareStatisticsReportOptions): Promise<void> {
  const { patients, stations, patientHealthTasks, separateSheetsPerStation = false, filename } = options;
  const patientMap = new Map(patients.map(p => [p.院友id, p]));
  const taskMap = new Map<number, PatientHealthTask[]>();
  for (const task of patientHealthTasks) {
    if (task.notes !== '特別關顧') continue;
    const list = taskMap.get(task.patient_id) || [];
    list.push(task);
    taskMap.set(task.patient_id, list);
  }
  const activePatients = patients.filter(p => p.在住狀態 === '在住');
  const groups = groupPatientsByStation(activePatients, stations);
  const exportDate = formatDisplayDate(new Date());

  if (!activePatients.some(p => taskMap.has(p.院友id))) {
    alert('沒有可匯出的特別關顧記錄');
    return;
  }

  const buildRows = (groupPatients: Patient[]) => {
    const rows: (string | number | null)[][] = [];
    const sortedPatients = [...groupPatients].sort((a, b) => {
      const bedA = a.床號 || '';
      const bedB = b.床號 || '';
      if (bedA !== bedB) return bedA.localeCompare(bedB, 'zh-Hant');
      return patientDisplayName(a).localeCompare(patientDisplayName(b), 'zh-Hant');
    });
    for (const patient of sortedPatients) {
      const tasks = taskMap.get(patient.院友id) || [];
      if (tasks.length === 0) continue;
      const sortedTasks = [...tasks].sort((a, b) =>
        (a.next_due_at || '').localeCompare(b.next_due_at || '')
      );
      for (const task of sortedTasks) {
        rows.push([
          '',
          patientBedNumber(patient),
          patientDisplayName(patient),
          task.health_record_type,
          formatTaskFrequency(task),
          task.specific_times?.join(', ') || '',
          task.next_due_at ? formatDisplayDate(task.next_due_at) : '',
          task.notes || ''
        ]);
      }
    }
    return rows;
  };

  const workbook = new ExcelJS.Workbook();
  if (separateSheetsPerStation) {
    for (const group of groups) {
      const rows = buildRows(group.patients);
      const worksheet = workbook.addWorksheet(group.stationName.slice(0, 31));
      createSheetCore(worksheet, `${group.stationName} 特別關顧報表`, exportDate, SPECIAL_CARE_COLUMNS);
      fillDataRows(worksheet, rows, 5, SPECIAL_CARE_COLUMNS);
    }
  } else {
    const allRows: (string | number | null)[][] = [];
    for (const group of groups) {
      const groupRows = buildRows(group.patients);
      for (const row of groupRows) {
        row[0] = group.stationName;
      }
      allRows.push(...groupRows);
    }
    const worksheet = workbook.addWorksheet('特別關顧報表');
    createSheetCore(worksheet, '特別關顧報表', exportDate, SPECIAL_CARE_COLUMNS);
    fillDataRows(worksheet, allRows, 5, SPECIAL_CARE_COLUMNS);
  }

  await writeWorkbook(workbook, filename || `特別關顧報表_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ───────────────────────────────────────────────────────────────────────────────
// 藥物敏感報表
// ───────────────────────────────────────────────────────────────────────────────

const DRUG_SENSITIVITY_COLUMNS: SheetColumn[] = [
  { header: '居住區', width: 18 },
  { header: '床號', width: 12, align: 'center' },
  { header: '姓名', width: 18 },
  { header: '藥物敏感', width: 40 },
  { header: '不良藥物反應', width: 40 },
];

function parseDrugArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value) {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch { /* fall through */ }
    }
    return trimmed.split('、').filter(Boolean);
  }
  return [];
}

export async function exportDrugSensitivityStatisticsToExcel(options: DrugSensitivityStatisticsReportOptions): Promise<void> {
  const { patients, stations, separateSheetsPerStation = false, filename } = options;
  const activePatients = patients.filter(p => p.在住狀態 === '在住');
  const groups = groupPatientsByStation(activePatients, stations);
  const exportDate = formatDisplayDate(new Date());

  if (!activePatients.some(p => {
    const allergies = parseDrugArray(p.藥物敏感);
    const adverseReactions = parseDrugArray(p.不良藥物反應);
    return allergies.length > 0 || adverseReactions.length > 0;
  })) {
    alert('沒有可匯出的藥物敏感記錄');
    return;
  }

  const buildRows = (groupPatients: Patient[]) => {
    const rows: (string | number | null)[][] = [];
    const sortedPatients = [...groupPatients].sort((a, b) => {
      const bedA = a.床號 || '';
      const bedB = b.床號 || '';
      if (bedA !== bedB) return bedA.localeCompare(bedB, 'zh-Hant');
      return patientDisplayName(a).localeCompare(patientDisplayName(b), 'zh-Hant');
    });
    for (const patient of sortedPatients) {
      const allergies = parseDrugArray(patient.藥物敏感);
      const adverseReactions = parseDrugArray(patient.不良藥物反應);
      if (allergies.length === 0 && adverseReactions.length === 0) continue;
      rows.push([
        '',
        patientBedNumber(patient),
        patientDisplayName(patient),
        allergies.join('、'),
        adverseReactions.join('、')
      ]);
    }
    return rows;
  };

  const workbook = new ExcelJS.Workbook();
  if (separateSheetsPerStation) {
    for (const group of groups) {
      const rows = buildRows(group.patients);
      const worksheet = workbook.addWorksheet(group.stationName.slice(0, 31));
      createSheetCore(worksheet, `${group.stationName} 藥物敏感報表`, exportDate, DRUG_SENSITIVITY_COLUMNS);
      fillDataRows(worksheet, rows, 5, DRUG_SENSITIVITY_COLUMNS);
    }
  } else {
    const allRows: (string | number | null)[][] = [];
    for (const group of groups) {
      const groupRows = buildRows(group.patients);
      for (const row of groupRows) {
        row[0] = group.stationName;
      }
      allRows.push(...groupRows);
    }
    const worksheet = workbook.addWorksheet('藥物敏感報表');
    createSheetCore(worksheet, '藥物敏感報表', exportDate, DRUG_SENSITIVITY_COLUMNS);
    fillDataRows(worksheet, allRows, 5, DRUG_SENSITIVITY_COLUMNS);
  }

  await writeWorkbook(workbook, filename || `藥物敏感報表_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ───────────────────────────────────────────────────────────────────────────────
// 尿片統計報表
// ───────────────────────────────────────────────────────────────────────────────

interface DiaperMonthTotal {
  urineCount: number;
  coreCount: number;
}

interface DiaperMatrixPatient {
  patientId: number;
  patient: Patient | undefined;
  bed: string;
  name: string;
}

interface DiaperMatrixGroup {
  stationId: string;
  stationName: string;
  patients: DiaperMatrixPatient[];
}

export async function exportDiaperStatisticsToExcel(options: DiaperStatisticsReportOptions): Promise<void> {
  const { patients, stations, diaperChangeRecords, patientCareTabs, monthRange, separateSheetsPerStation = false, filename } = options;

  const monthTotalsByPatient = new Map<number, Map<string, DiaperMonthTotal>>();
  let minMonth: string | null = null;
  let maxMonth: string | null = null;
  for (const record of diaperChangeRecords) {
    const month = record.change_date.slice(0, 7);
    if (!minMonth || month < minMonth) minMonth = month;
    if (!maxMonth || month > maxMonth) maxMonth = month;
    const patientMonthMap = monthTotalsByPatient.get(record.patient_id) || new Map<string, DiaperMonthTotal>();
    const existing = patientMonthMap.get(month) || { urineCount: 0, coreCount: 0 };
    existing.urineCount += record.urine_count ?? 0;
    existing.coreCount += record.core_count ?? 0;
    patientMonthMap.set(month, existing);
    monthTotalsByPatient.set(record.patient_id, patientMonthMap);
  }

  if (monthTotalsByPatient.size === 0 || !minMonth || !maxMonth) {
    alert('沒有可匯出的尿片記錄');
    return;
  }

  // 月份範圍：指定範圍優先，否則預設最近 9 個月（以最後記錄月份為結束）
  let months: string[];
  if (monthRange && monthRange.startMonth && monthRange.endMonth) {
    const start = monthRange.startMonth <= monthRange.endMonth ? monthRange.startMonth : monthRange.endMonth;
    const end = monthRange.startMonth <= monthRange.endMonth ? monthRange.endMonth : monthRange.startMonth;
    months = buildDiaperMonthRange(start, end);
  } else {
    months = buildDiaperMonthRange(shiftDiaperMonth(maxMonth, -8), maxMonth);
  }

  const patientById = new Map(patients.map(p => [p.院友id, p]));

  // 列入院友 = 床頭記錄開啟「換片記錄」tab 的院友 ∪ 有換片記錄行的院友（不作在住狀態過濾）
  const diaperPatientIds = new Set<number>(monthTotalsByPatient.keys());
  for (const tab of (patientCareTabs || [])) {
    if (tab.tab_type === 'diaper') diaperPatientIds.add(tab.patient_id);
  }

  const byStation = new Map<string, DiaperMatrixPatient[]>();
  for (const patientId of diaperPatientIds) {
    const patient = patientById.get(patientId);
    const stationId = (patient ? getReportStationId(patient) : null) || 'unknown';
    const list = byStation.get(stationId) || [];
    list.push({
      patientId,
      patient,
      bed: patientBedNumber(patient),
      name: patient ? patientDisplayName(patient) : `院友 #${patientId}`,
    });
    byStation.set(stationId, list);
  }

  const sortMatrixPatients = (list: DiaperMatrixPatient[]) => [...list].sort((a, b) => {
    if (a.bed !== b.bed) return a.bed.localeCompare(b.bed, 'zh-Hant');
    return a.name.localeCompare(b.name, 'zh-Hant');
  });

  const knownStationIds = new Set(stations.map(s => s.id));
  const groups: DiaperMatrixGroup[] = stations.map(station => ({
    stationId: station.id,
    stationName: station.name,
    patients: sortMatrixPatients(byStation.get(station.id) || []),
  }));
  const unassigned: DiaperMatrixPatient[] = [];
  for (const [stationId, list] of byStation) {
    if (!knownStationIds.has(stationId)) unassigned.push(...list);
  }
  if (unassigned.length > 0) {
    groups.push({ stationId: 'unknown', stationName: '未分區', patients: sortMatrixPatients(unassigned) });
  }

  const getPatientMonth = (patientId: number, month: string): DiaperMonthTotal =>
    monthTotalsByPatient.get(patientId)?.get(month) || { urineCount: 0, coreCount: 0 };

  const getGroupMonthTotals = (group: DiaperMatrixGroup, month: string): DiaperMonthTotal => {
    let urineCount = 0;
    let coreCount = 0;
    for (const p of group.patients) {
      const total = getPatientMonth(p.patientId, month);
      urineCount += total.urineCount;
      coreCount += total.coreCount;
    }
    return { urineCount, coreCount };
  };

  const exportDate = formatDisplayDate(new Date());
  const totalColumns = 2 + months.length * 2;

  const applyBorder = (cell: ExcelJS.Cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  };

  type MatrixRowStyle = 'header' | 'group' | 'subtotal' | 'grand' | 'data';

  const styleMatrixRow = (worksheet: ExcelJS.Worksheet, rowNumber: number, style: MatrixRowStyle) => {
    const row = worksheet.getRow(rowNumber);
    for (let col = 1; col <= totalColumns; col++) {
      const cell = row.getCell(col);
      applyBorder(cell);
      cell.alignment = { horizontal: col === 2 ? 'left' : 'center', vertical: 'middle' };
      if (style === 'header') {
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
      } else {
        cell.font = { name: 'Arial', size: 10, bold: style !== 'data' };
        if (style === 'group') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        } else if (style === 'subtotal') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        } else if (style === 'grand') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
        }
      }
    }
    row.height = style === 'header' ? 22 : 20;
  };

  const writeMatrixHeader = (worksheet: ExcelJS.Worksheet, title: string) => {
    worksheet.mergeCells(1, 1, 1, totalColumns);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { name: 'Arial', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    worksheet.getCell(2, 1).value = `匯出日期：${exportDate}`;
    worksheet.getCell(2, 1).font = { name: 'Arial', size: 10 };

    const headerRow1 = worksheet.getRow(4);
    const headerRow2 = worksheet.getRow(5);
    worksheet.mergeCells(4, 1, 5, 1);
    worksheet.mergeCells(4, 2, 5, 2);
    headerRow1.getCell(1).value = '床號';
    headerRow1.getCell(2).value = '姓名';
    months.forEach((month, index) => {
      const col = 3 + index * 2;
      worksheet.mergeCells(4, col, 4, col + 1);
      headerRow1.getCell(col).value = month;
      headerRow2.getCell(col).value = '尿片';
      headerRow2.getCell(col + 1).value = '片芯';
    });

    styleMatrixRow(worksheet, 4, 'header');
    styleMatrixRow(worksheet, 5, 'header');

    worksheet.getColumn(1).width = 10;
    worksheet.getColumn(2).width = 16;
    for (let col = 3; col <= totalColumns; col++) {
      worksheet.getColumn(col).width = 9;
    }

    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9
    };
    worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 5 }];
  };

  const writeGroupRows = (
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    group: DiaperMatrixGroup,
    includeStationHeader: boolean
  ): number => {
    let rowNumber = startRow;
    if (includeStationHeader) {
      worksheet.mergeCells(rowNumber, 1, rowNumber, totalColumns);
      worksheet.getCell(rowNumber, 1).value = group.stationName;
      styleMatrixRow(worksheet, rowNumber, 'group');
      rowNumber += 1;
    }
    for (const matrixPatient of group.patients) {
      const row = worksheet.getRow(rowNumber);
      row.getCell(1).value = matrixPatient.bed;
      row.getCell(2).value = matrixPatient.name;
      months.forEach((month, index) => {
        const monthTotal = getPatientMonth(matrixPatient.patientId, month);
        row.getCell(3 + index * 2).value = monthTotal.urineCount;
        row.getCell(3 + index * 2 + 1).value = monthTotal.coreCount;
      });
      styleMatrixRow(worksheet, rowNumber, 'data');
      rowNumber += 1;
    }
    worksheet.mergeCells(rowNumber, 1, rowNumber, 2);
    worksheet.getCell(rowNumber, 1).value = `${group.stationName} 小計`;
    const subtotalRow = worksheet.getRow(rowNumber);
    months.forEach((month, index) => {
      const monthTotal = getGroupMonthTotals(group, month);
      subtotalRow.getCell(3 + index * 2).value = monthTotal.urineCount;
      subtotalRow.getCell(3 + index * 2 + 1).value = monthTotal.coreCount;
    });
    styleMatrixRow(worksheet, rowNumber, 'subtotal');
    rowNumber += 1;
    return rowNumber;
  };

  const workbook = new ExcelJS.Workbook();
  const mainSheet = workbook.addWorksheet('尿片統計');
  writeMatrixHeader(mainSheet, '尿片統計報表');
  let rowNumber = 6;
  for (const group of groups) {
    rowNumber = writeGroupRows(mainSheet, rowNumber, group, true);
  }

  mainSheet.mergeCells(rowNumber, 1, rowNumber, 2);
  mainSheet.getCell(rowNumber, 1).value = '所有居住區總計';
  const grandRow = mainSheet.getRow(rowNumber);
  months.forEach((month, index) => {
    let urine = 0;
    let core = 0;
    for (const group of groups) {
      const monthTotal = getGroupMonthTotals(group, month);
      urine += monthTotal.urineCount;
      core += monthTotal.coreCount;
    }
    grandRow.getCell(3 + index * 2).value = urine;
    grandRow.getCell(3 + index * 2 + 1).value = core;
  });
  styleMatrixRow(mainSheet, rowNumber, 'grand');

  if (separateSheetsPerStation) {
    for (const group of groups) {
      const worksheet = workbook.addWorksheet(group.stationName.slice(0, 31));
      writeMatrixHeader(worksheet, `${group.stationName} 尿片統計`);
      writeGroupRows(worksheet, 6, group, false);
    }
  }

  await writeWorkbook(workbook, filename || `尿片統計報表_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ───────────────────────────────────────────────────────────────────────────────
// 集中路由：依 document ID 匯出
// ───────────────────────────────────────────────────────────────────────────────

export type StatisticsReportDocumentId =
  | 'meal_statistics_report'
  | 'tube_care_statistics_report'
  | 'infection_control_statistics_report'
  | 'special_care_statistics_report'
  | 'drug_sensitivity_statistics_report'
  | 'diaper_statistics_report';

export interface StatisticsReportBundleOptions {
  documentId: StatisticsReportDocumentId;
  patients: Patient[];
  stations: Station[];
  mealGuidances?: MealGuidance[];
  patientHealthTasks?: PatientHealthTask[];
  patientTubeCareRecords?: PatientTubeCareRecord[];
  infectionControlRecords?: InfectionControlRecord[];
  diaperChangeRecords?: DiaperChangeRecord[];
  patientCareTabs?: PatientCareTab[];
  /** 尿片統計：指定月份範圍（YYYY-MM） */
  diaperMonthRange?: { startMonth: string; endMonth: string };
  separateSheetsPerStation?: boolean;
}

export async function exportStatisticsReportToExcel(options: StatisticsReportBundleOptions): Promise<void> {
  const { documentId, patients, stations, mealGuidances, patientHealthTasks, patientTubeCareRecords, infectionControlRecords, diaperChangeRecords, patientCareTabs, diaperMonthRange, separateSheetsPerStation } = options;
  switch (documentId) {
    case 'meal_statistics_report':
      await exportMealStatisticsToExcel({ patients, stations, mealGuidances: mealGuidances || [], separateSheetsPerStation });
      break;
    case 'tube_care_statistics_report':
      await exportTubeCareStatisticsToExcel({ patients, stations, patientTubeCareRecords: patientTubeCareRecords || [], separateSheetsPerStation });
      break;
    case 'infection_control_statistics_report':
      await exportInfectionControlStatisticsToExcel({ patients, stations, infectionControlRecords: infectionControlRecords || [], separateSheetsPerStation });
      break;
    case 'special_care_statistics_report':
      await exportSpecialCareStatisticsToExcel({ patients, stations, patientHealthTasks: patientHealthTasks || [], separateSheetsPerStation });
      break;
    case 'drug_sensitivity_statistics_report':
      await exportDrugSensitivityStatisticsToExcel({ patients, stations, separateSheetsPerStation });
      break;
    case 'diaper_statistics_report':
      await exportDiaperStatisticsToExcel({ patients, stations, diaperChangeRecords: diaperChangeRecords || [], patientCareTabs, monthRange: diaperMonthRange, separateSheetsPerStation });
      break;
    default:
      throw new Error(`未知的統計報表類型: ${documentId}`);
  }
}
