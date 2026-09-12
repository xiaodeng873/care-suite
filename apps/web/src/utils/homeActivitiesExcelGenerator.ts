import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { formatDisplayDate } from './dateFormat';
import type { HomeActivity } from '../lib/homeActivities';

const HEADERS = ['項目', '日期', '時間', '主辦機構/團體', '活動名稱', '地點（如外出，請列明）', '義工人數', '參加人數'];
const COLUMN_WIDTHS = [8, 14, 14, 30, 36, 24, 12, 12];

const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '');

export function exportHomeActivitiesExcel(records: HomeActivity[], filename?: string): void {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('院舍活動資料');
  ws.columns = COLUMN_WIDTHS.map(width => ({ width }));

  const titleRow = ws.addRow(['院舍活動資料（附件3.2 每月院舍活動資料）']);
  titleRow.font = { bold: true, size: 14 };
  ws.mergeCells(1, 1, 1, HEADERS.length);
  ws.addRow([]);

  const headerRow = ws.addRow(HEADERS);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  records.forEach((r, i) => {
    const row = ws.addRow([
      i + 1,
      formatDisplayDate(r.activity_date, ''),
      `${fmtTime(r.start_time)}${r.start_time || r.end_time ? '-' : ''}${fmtTime(r.end_time)}`,
      r.organizer || '',
      r.activity_name,
      r.location || '',
      r.volunteer_count,
      r.participant_count,
    ]);
    row.eachCell(cell => {
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
  });

  const totalRow = ws.addRow([
    '合計',
    '',
    '',
    '',
    `${records.length} 場活動`,
    '',
    records.reduce((s, r) => s + (r.volunteer_count || 0), 0),
    records.reduce((s, r) => s + (r.participant_count || 0), 0),
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell(cell => {
    cell.border = { top: { style: 'double' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const name = filename || `院舍活動資料_${stamp}.xlsx`;
  wb.xlsx.writeBuffer().then(buffer => {
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  });
}
