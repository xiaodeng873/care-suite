import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { formatDisplayDate } from './dateFormat';
import type { VaccinationRecord, Patient } from '../lib/database';

export interface VaccinationRecordExportRow {
  record: VaccinationRecord;
  patient: Patient | undefined;
}

export interface ExportVaccinationRecordsOptions {
  patients: Patient[];
  records: VaccinationRecord[];
  startDate?: string;
  endDate?: string;
  separateSheetsPerPatient?: boolean;
  filename?: string;
}

const HEADERS = ['床號', '院友姓名', '疫苗項目', '接種日期', '接種單位', '備註'];
const COLUMN_WIDTHS = [12, 18, 30, 15, 25, 40];

function patientDisplayName(patient: Patient | undefined): string {
  if (!patient) return '未知院友';
  return `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`.trim() || patient.中文姓名 || '未知院友';
}

function isDateInRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return true;
  if (!dateStr) return false;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

function createSheetCore(worksheet: ExcelJS.Worksheet, title?: string, exportDate?: string) {
  if (title) {
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Arial', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;
  }

  if (exportDate) {
    worksheet.getCell('A2').value = `匯出日期：${exportDate}`;
    worksheet.getCell('A2').font = { name: 'Arial', size: 10 };
  }

  const headerRow = worksheet.getRow(4);
  HEADERS.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  worksheet.getRow(4).height = 22;

  COLUMN_WIDTHS.forEach((width, idx) => {
    worksheet.getColumn(idx + 1).width = width;
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

function fillRows(
  worksheet: ExcelJS.Worksheet,
  rows: VaccinationRecordExportRow[],
  startRow: number
) {
  rows.forEach((row, index) => {
    const dataRow = worksheet.getRow(startRow + index);
    const patient = row.patient;
    const record = row.record;

    const values = [
      patient?.床號 || '',
      patientDisplayName(patient),
      record.vaccine_item,
      formatDisplayDate(record.vaccination_date),
      record.vaccination_unit,
      record.remarks || ''
    ];

    values.forEach((value, idx) => {
      const cell = dataRow.getCell(idx + 1);
      cell.value = value;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { horizontal: idx === 3 ? 'center' : 'left', vertical: 'middle' };
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

/**
 * 匯出疫苗接種記錄為 Excel。
 * 可選按院友分開工作表，或全部院友合併在同一張工作表。
 * 日期範圍會對 vaccination_date 生效。
 */
export const exportVaccinationRecordsToExcel = async (options: ExportVaccinationRecordsOptions): Promise<void> => {
  const {
    patients,
    records,
    startDate,
    endDate,
    separateSheetsPerPatient = false,
    filename
  } = options;

  const filteredRecords = records.filter(r => isDateInRange(r.vaccination_date, startDate, endDate));
  if (filteredRecords.length === 0) {
    alert('日期範圍內沒有疫苗接種記錄');
    return;
  }

  const patientMap = new Map(patients.map(p => [p.院友id, p]));
  const rows: VaccinationRecordExportRow[] = filteredRecords.map(record => ({
    record,
    patient: patientMap.get(record.patient_id)
  }));

  // 排序：先床號，再院友姓名，最後接種日期（新到舊）
  rows.sort((a, b) => {
    const bedA = a.patient?.床號 || '';
    const bedB = b.patient?.床號 || '';
    if (bedA !== bedB) return bedA.localeCompare(bedB, 'zh-Hant');
    const nameA = patientDisplayName(a.patient);
    const nameB = patientDisplayName(b.patient);
    if (nameA !== nameB) return nameA.localeCompare(nameB, 'zh-Hant');
    return (b.record.vaccination_date || '').localeCompare(a.record.vaccination_date || '');
  });

  const workbook = new ExcelJS.Workbook();
  const exportDate = formatDisplayDate(new Date());

  if (separateSheetsPerPatient) {
    const rowsByPatient = new Map<number, VaccinationRecordExportRow[]>();
    rows.forEach(row => {
      const list = rowsByPatient.get(row.record.patient_id) || [];
      list.push(row);
      rowsByPatient.set(row.record.patient_id, list);
    });

    for (const [patientId, patientRows] of rowsByPatient) {
      const patient = patientMap.get(patientId);
      const sheetName = patient
        ? `${patient.床號 || '無床號'}_${patientDisplayName(patient)}`.slice(0, 31)
        : `未知院友_${patientId}`;
      const worksheet = workbook.addWorksheet(sheetName);
      createSheetCore(worksheet, `${patientDisplayName(patient)} 疫苗接種記錄`, exportDate);
      fillRows(worksheet, patientRows, 5);
    }
  } else {
    const worksheet = workbook.addWorksheet('疫苗接種記錄');
    createSheetCore(worksheet, '疫苗接種記錄表', exportDate);
    fillRows(worksheet, rows, 5);
  }

  const defaultFilename = `疫苗接種記錄_${new Date().toISOString().split('T')[0]}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename || defaultFilename);
};

/** 向後兼容：舊的單一 sheet 匯出接口 */
export const exportVaccinationRecordRowsToExcel = async (
  rows: VaccinationRecordExportRow[],
  filename?: string
): Promise<void> => {
  const patients = rows.map(r => r.patient).filter((p): p is Patient => p !== undefined);
  const records = rows.map(r => r.record);
  return exportVaccinationRecordsToExcel({ patients, records, filename, separateSheetsPerPatient: false });
};
