import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getPrintBedNumber } from './bedTransferUtils';
interface ExtractedTemplate {
  columnWidths: number[];
  rowHeights: number[];
  mergedCells: string[];
  printSettings?: Partial<ExcelJS.PageSetup>;
  cellData: {
    [address: string]: {
      value?: any;
      font?: Partial<ExcelJS.Font>;
      alignment?: Partial<ExcelJS.Alignment>;
      border?: any;
      fill?: any;
      numFmt?: string;
    };
  };
}
type SortOption = 'medication_name' | 'prescription_date' | 'start_date' | 'medication_source';
const extractSheetFormat = async (worksheet: ExcelJS.Worksheet): Promise<ExtractedTemplate> => {
  const extractedTemplate: ExtractedTemplate = {
    columnWidths: [],
    rowHeights: [],
    mergedCells: [],
    cellData: {}
  };
  const maxCol = 9;
  const maxRow = 8;
  for (let col = 1; col <= maxCol; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }
  for (let row = 1; row <= maxRow; row++) {
    let height = worksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    extractedTemplate.rowHeights.push(Math.round(height * 100) / 100);
  }
  if (worksheet.model && worksheet.model.merges) {
    worksheet.model.merges.forEach(merge => {
      extractedTemplate.mergedCells.push(merge);
    });
  }
  if (worksheet.pageSetup) {
    extractedTemplate.printSettings = { ...worksheet.pageSetup };
  }
  let extractedCellCount = 0;
  for (let row = 1; row <= maxRow; row++) {
    for (let col = 1; col <= maxCol; col++) {
      const cell = worksheet.getCell(row, col);
      const address = cell.address;
      const cellData: any = {};
      // CRITICAL: Always extract value, even if null or empty
      // This ensures template cells like A6 and I7 are preserved
      cellData.value = cell.value;
      // Debug: Log I column cells
      if (col === 9 && (row === 7 || row === 8)) {
        console.log(`🔍 提取範本 ${address}:`, {
          value: cell.value,
          hasFont: !!cell.font,
          hasBorder: !!cell.border,
          hasAlignment: !!cell.alignment,
          hasFill: !!cell.fill
        });
      }
      if (cell.font) {
        cellData.font = { ...cell.font, name: 'MingLiU' };
      } else {
        cellData.font = { name: 'MingLiU' };
      }
      if (cell.alignment) {
        cellData.alignment = { ...cell.alignment };
      }
      if (cell.border) {
        (cellData.border as any) = {
          top: cell.border.top ? { ...cell.border.top } : undefined,
          left: cell.border.left ? { ...cell.border.left } : undefined,
          bottom: cell.border.bottom ? { ...cell.border.bottom } : undefined,
          right: cell.border.right ? { ...cell.border.right } : undefined,
          diagonal: cell.border.diagonal ? { ...cell.border.diagonal } : undefined,
          diagonalUp: (cell.border as any).diagonalUp,
          diagonalDown: (cell.border as any).diagonalDown
        };
      }
      if (cell.fill) {
        (cellData.fill as any) = { ...cell.fill };
      }
      if (cell.numFmt) {
        cellData.numFmt = cell.numFmt;
      }
      // Always save cell data to preserve all template cells
      extractedTemplate.cellData[address] = cellData;
      extractedCellCount++;
    }
  }
  // Debug: 檢查 I7 和 I8 是否被提取
  if (extractedTemplate.cellData['I7']) {
    console.log('✅ I7 已提取:', {
      value: extractedTemplate.cellData['I7'].value,
      font: extractedTemplate.cellData['I7'].font,
      border: extractedTemplate.cellData['I7'].border,
      fill: extractedTemplate.cellData['I7'].fill
    });
  } else {
    console.warn('⚠️ I7 未被提取到 cellData 中！');
  }
  if (extractedTemplate.cellData['I8']) {
    console.log('✅ I8 已提取:', {
      value: extractedTemplate.cellData['I8'].value,
      font: extractedTemplate.cellData['I8'].font,
      border: extractedTemplate.cellData['I8'].border,
      fill: extractedTemplate.cellData['I8'].fill
    });
  } else {
    console.warn('⚠️ I8 未被提取到 cellData 中！');
  }
  return extractedTemplate;
};
export const extractPersonalMedicationListTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await templateFile.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  if (workbook.worksheets.length < 1) {
    throw new Error('範本格式錯誤：找不到工作表');
  }
  const worksheet = workbook.worksheets[0];
  const format = await extractSheetFormat(worksheet);
  return format;
};
const deepCopyRange = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  sourceRow: number,
  targetRow: number
) => {
  if (sourceRow - 1 < template.rowHeights.length) {
    worksheet.getRow(targetRow).height = template.rowHeights[sourceRow - 1];
  }
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const cell = worksheet.getCell(address);
    const rowNum = Number(cell.row);
    if (rowNum === sourceRow) {
      const colLetter = address.replace(/\d+/, '');
      const targetAddress = colLetter + targetRow;
      const targetCell = worksheet.getCell(targetAddress);
      // Always copy value to preserve template format (including column I)
      targetCell.value = cellData.value;
      if (cellData.font) {
        targetCell.font = { ...cellData.font, name: 'MingLiU' };
      } else {
        targetCell.font = { name: 'MingLiU' };
      }
      if (cellData.alignment) {
        targetCell.alignment = cellData.alignment;
      }
      if (cellData.border) {
        targetCell.border = cellData.border;
      }
      if (cellData.fill) {
        targetCell.fill = cellData.fill;
      }
      if (cellData.numFmt) {
        targetCell.numFmt = cellData.numFmt;
      }
    }
  });
  template.mergedCells.forEach(merge => {
    const match = merge.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    if (match) {
      const startCol = match[1];
      const startRowNum = parseInt(match[2]);
      const endCol = match[3];
      const endRowNum = parseInt(match[4]);
      if (startRowNum === sourceRow && endRowNum === sourceRow) {
        const targetMerge = startCol + targetRow + ':' + endCol + targetRow;
        try {
          worksheet.mergeCells(targetMerge);
        } catch (e) {
          console.warn('合併儲存格失敗:', targetMerge);
        }
      }
    }
  });
};
const sortPrescriptions = (prescriptions: any[], sortBy: SortOption): any[] => {
  const sorted = [...prescriptions];
  switch (sortBy) {
    case 'medication_name':
      sorted.sort((a, b) => (a.medication_name || '').localeCompare(b.medication_name || '', 'zh-Hant'));
      break;
    case 'prescription_date':
      sorted.sort((a, b) => {
        const dateA = a.prescription_date ? new Date(a.prescription_date).getTime() : 0;
        const dateB = b.prescription_date ? new Date(b.prescription_date).getTime() : 0;
        return dateB - dateA;
      });
      break;
    case 'start_date':
      sorted.sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
        return dateB - dateA;
      });
      break;
    case 'medication_source':
      sorted.sort((a, b) => (a.medication_source || '').localeCompare(b.medication_source || '', 'zh-Hant'));
      break;
    default:
      break;
  }
  return sorted;
};
const formatMedicationDetails = (prescription: any): string[] => {
  const details: string[] = [];
  if (prescription.dosage_form) {
    details.push(prescription.dosage_form);
  }
  if (prescription.dosage_amount && prescription.dosage_unit) {
    details.push(`${prescription.dosage_amount}${prescription.dosage_unit}`);
  }
  if (prescription.special_dosage_instruction) {
    details.push(prescription.special_dosage_instruction);
  }
  const frequencyDesc = getFrequencyDescription(prescription);
  if (frequencyDesc) {
    details.push(frequencyDesc);
  }
  if (prescription.administration_route) {
    details.push(prescription.administration_route);
  }
  return details;
};
const getFrequencyDescription = (prescription: any): string => {
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, medication_time_slots, daily_frequency } = prescription;
  const getFrequencyAbbreviation = (count: number): string => {
    switch (count) {
      case 1: return 'QD';
      case 2: return 'BD';
      case 3: return 'TDS';
      case 4: return 'QID';
      default: return count + '次/日';
    }
  };
  const timeSlotsCount = medication_time_slots?.length || 0;
  const perDay = daily_frequency || timeSlotsCount || frequency_value || 1;
  switch (frequency_type) {
    case 'daily':
      return getFrequencyAbbreviation(perDay);
    case 'every_x_days':
      return '隔' + frequency_value + '日' + perDay + '次';
    case 'every_x_weeks':
      return '隔' + frequency_value + '星期' + perDay + '次';
    case 'every_x_months':
      return '隔' + frequency_value + '月' + perDay + '次';
    case 'weekly_days':
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') || '';
      return '逢' + days + perDay + '次';
    case 'odd_even_days':
      return is_odd_even_day === 'odd' ? '單日' + perDay + '次' : is_odd_even_day === 'even' ? '雙日' + perDay + '次' : '單雙日' + perDay + '次';
    case 'hourly':
      return '每' + frequency_value + '小時1次';
    default:
      return getFrequencyAbbreviation(perDay);
  }
};
export const applyPersonalMedicationListTemplate = async (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: any,
  prescriptions: any[],
  sortBy: SortOption = 'medication_name'
): Promise<void> => {
  template.columnWidths.forEach((width, idx) => {
    worksheet.getColumn(idx + 1).width = width;
  });
  template.rowHeights.forEach((height, idx) => {
    worksheet.getRow(idx + 1).height = height;
  });
  // Debug: Check if I7 is in template.cellData
  console.log('🔍 範本 cellData 包含的儲存格數量:', Object.keys(template.cellData).length);
  if (template.cellData['I7']) {
  } else {
    console.warn('⚠️ template.cellData 不包含 I7！');
  }
  if (template.cellData['I8']) {
  } else {
    console.warn('⚠️ template.cellData 不包含 I8！');
  }
  // Apply all template cells including A6 and I7
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const cell = worksheet.getCell(address);
    // Always apply value (even if null) to preserve template defaults
    cell.value = cellData.value;
    // Debug logging for A6 and I7
    if (address === 'A6' || address === 'I7') {
      console.log(`📝 應用範本儲存格 ${address}:`, {
        value: cellData.value,
        hasFont: !!cellData.font,
        hasBorder: !!cellData.border,
        hasFill: !!cellData.fill
      });
    }
    if (cellData.font) {
      cell.font = cellData.font;
    }
    if (cellData.alignment) {
      cell.alignment = cellData.alignment;
    }
    if (cellData.border) {
      cell.border = cellData.border;
    }
    if (cellData.fill) {
      cell.fill = cellData.fill;
    }
    if (cellData.numFmt) {
      cell.numFmt = cellData.numFmt;
    }
  });
  template.mergedCells.forEach(merge => {
    try {
      worksheet.mergeCells(merge);
    } catch (e) {
      console.warn('合併儲存格失敗:', merge);
    }
  });
  worksheet.getCell('B3').value = patient.中文姓氏 + patient.中文名字;
  const englishName = patient.英文姓氏 && patient.英文名字
    ? `${patient.英文姓氏} ${patient.英文名字}`
    : patient.英文姓名 || '';
  worksheet.getCell('C3').value = englishName;
  worksheet.getCell('F3').value = patient.身份證號碼 || '';
  worksheet.getCell('I3').value = getPrintBedNumber(patient);
  const allergies = patient.藥物敏感 && patient.藥物敏感.length > 0
    ? patient.藥物敏感.join('、')
    : 'NKDA';
  worksheet.getCell('C4').value = allergies;
  const reactions = patient.不良藥物反應 && patient.不良藥物反應.length > 0
    ? patient.不良藥物反應.join('、')
    : 'NKADR';
  worksheet.getCell('C5').value = reactions;
  // 記錄 A6 在填入日期前的狀態
  console.log('🔍 填入日期前的 A6:', {
    value: worksheet.getCell('A6').value,
    isMerged: worksheet.getCell('A6').isMerged
  });
  const updateDate = new Date().toLocaleDateString('zh-TW');
  if (worksheet.getCell('C6').value) {
    worksheet.getCell('C6').value = updateDate;
    worksheet.getCell('C6').font = { name: 'MingLiU' };
  } else if (worksheet.getCell('F6').value) {
    worksheet.getCell('F6').value = updateDate;
    worksheet.getCell('F6').font = { name: 'MingLiU' };
  }
  // 記錄 A6 在填入日期後的狀態
  console.log('🔍 填入日期後的 A6:', {
    value: worksheet.getCell('A6').value,
    isMerged: worksheet.getCell('A6').isMerged
  });
  // 明確保持 A6 從範本的預設內容，不覆寫
  // A6 will keep its template default value
  // 如果 A6 被意外覆寫，強制恢復範本值
  if (template.cellData['A6']) {
    const a6TemplateValue = template.cellData['A6'].value;
    if (worksheet.getCell('A6').value !== a6TemplateValue) {
      console.warn('⚠️ A6 被覆寫！恢復範本值:', a6TemplateValue);
      worksheet.getCell('A6').value = a6TemplateValue;
    }
  }
  // 檢查 I7 的完整格式
  const i7Cell = worksheet.getCell('I7');
  console.log('📊 I7 的完整格式:', {
    value: i7Cell.value,
    font: i7Cell.font,
    border: i7Cell.border,
    alignment: i7Cell.alignment,
    fill: i7Cell.fill
  });
  worksheet.getCell('B3').font = { name: 'MingLiU' };
  worksheet.getCell('C3').font = { name: 'MingLiU' };
  worksheet.getCell('F3').font = { name: 'MingLiU' };
  worksheet.getCell('I3').font = { name: 'MingLiU' };
  worksheet.getCell('C4').font = { name: 'MingLiU' };
  worksheet.getCell('C5').font = { name: 'MingLiU' };
  const sortedPrescriptions = sortPrescriptions(prescriptions, sortBy);
  const itemsPerPage = 15;
  let currentPage = 1;
  let currentRow = 8;
  sortedPrescriptions.forEach((prescription, index) => {
    const pageIndex = Math.floor(index / itemsPerPage);
    const isNewPage = pageIndex >= currentPage;
    if (isNewPage) {
      currentPage = pageIndex + 1;
      const pageStartRow = 1 + (currentPage - 1) * (7 + itemsPerPage);
      // Copy all header rows (1-7) including A6 and I7
      for (let headerRow = 1; headerRow <= 7; headerRow++) {
        const targetRow = pageStartRow + headerRow - 1;
        Object.entries(template.cellData).forEach(([address, cellData]) => {
          const cell = worksheet.getCell(address);
          if (Number(cell.row) === headerRow) {
            const colLetter = address.replace(/\d+/, '');
            const targetCell = worksheet.getCell(colLetter + targetRow);
            // Always copy value to preserve template defaults (including A6 and I7)
            targetCell.value = cellData.value;
            if (cellData.font) targetCell.font = { ...cellData.font, name: 'MingLiU' };
            if (cellData.alignment) targetCell.alignment = cellData.alignment;
            if (cellData.border) targetCell.border = cellData.border;
            if (cellData.fill) targetCell.fill = cellData.fill;
            if (cellData.numFmt) targetCell.numFmt = cellData.numFmt;
          }
        });
      }
      worksheet.getCell('B' + (pageStartRow + 2)).value = patient.中文姓氏 + patient.中文名字;
      worksheet.getCell('B' + (pageStartRow + 2)).font = { name: 'MingLiU' };
      worksheet.getCell('C' + (pageStartRow + 2)).value = englishName;
      worksheet.getCell('C' + (pageStartRow + 2)).font = { name: 'MingLiU' };
      worksheet.getCell('F' + (pageStartRow + 2)).value = patient.身份證號碼 || '';
      worksheet.getCell('F' + (pageStartRow + 2)).font = { name: 'MingLiU' };
      worksheet.getCell('I' + (pageStartRow + 2)).value = getPrintBedNumber(patient);
      worksheet.getCell('I' + (pageStartRow + 2)).font = { name: 'MingLiU' };
      worksheet.getCell('C' + (pageStartRow + 3)).value = allergies;
      worksheet.getCell('C' + (pageStartRow + 3)).font = { name: 'MingLiU' };
      worksheet.getCell('C' + (pageStartRow + 4)).value = reactions;
      worksheet.getCell('C' + (pageStartRow + 4)).font = { name: 'MingLiU' };
      if (worksheet.getCell('C' + (pageStartRow + 5)).value) {
        worksheet.getCell('C' + (pageStartRow + 5)).value = updateDate;
        worksheet.getCell('C' + (pageStartRow + 5)).font = { name: 'MingLiU' };
      } else if (worksheet.getCell('F' + (pageStartRow + 5)).value) {
        worksheet.getCell('F' + (pageStartRow + 5)).value = updateDate;
        worksheet.getCell('F' + (pageStartRow + 5)).font = { name: 'MingLiU' };
      }
      // 明確保持 A + (pageStartRow + 5) 從範本的預設內容，不覆寫
      // Preserve A6 equivalent on each page with template default
      currentRow = pageStartRow + 7;
    }
    const itemRow = currentRow + (index % itemsPerPage);
    // CRITICAL: Always copy template format for all prescription rows
    // This ensures I column formatting is preserved for all rows including first row
    if (index % itemsPerPage > 0 || isNewPage) {
      deepCopyRange(worksheet, template, 8, itemRow);
    } else if (index === 0) {
      // First prescription on first page: Row 8 already has template format applied
      // No need to deepCopyRange as template format is already in place
    }
    worksheet.getCell('A' + itemRow).value = (index + 1) + '.';
    worksheet.getCell('A' + itemRow).font = { name: 'MingLiU' };
    const medicationNameCell = worksheet.getCell('B' + itemRow);
    const details = formatMedicationDetails(prescription);
    if (details.length > 0) {
      medicationNameCell.value = {
        richText: [
          {
            font: { bold: true, name: 'MingLiU' },
            text: prescription.medication_name || ''
          },
          {
            font: { name: 'MingLiU' },
            text: '\n' + details.join(', ')
          }
        ]
      };
    } else {
      medicationNameCell.value = prescription.medication_name || '';
      medicationNameCell.font = { bold: true, name: 'MingLiU' };
    }
    // D欄：需要時
    const prnCell = worksheet.getCell('D' + itemRow);
    prnCell.value = prescription.is_prn ? '需要時' : '';
    prnCell.font = { name: 'MingLiU' };
    // E欄：開始日期
    const startDateCell = worksheet.getCell('E' + itemRow);
    startDateCell.value = prescription.start_date
      ? new Date(prescription.start_date).toLocaleDateString('zh-TW')
      : '';
    startDateCell.font = { name: 'MingLiU' };
    // F欄：結束日期
    const endDateCell = worksheet.getCell('F' + itemRow);
    endDateCell.value = prescription.end_date
      ? new Date(prescription.end_date).toLocaleDateString('zh-TW')
      : '';
    endDateCell.font = { name: 'MingLiU' };
    // G欄：藥物來源
    const sourceCell = worksheet.getCell('G' + itemRow);
    sourceCell.value = prescription.medication_source || '';
    sourceCell.font = { name: 'MingLiU' };
    // H欄：處方備註
    const notesCell = worksheet.getCell('H' + itemRow);
    notesCell.value = prescription.notes || prescription.special_instructions || '';
    notesCell.font = { name: 'MingLiU' };
    // I欄：修改者（登入者）
    const modifiedByCell = worksheet.getCell('I' + itemRow);
    const modifiedByValue = prescription.last_modified_by || prescription.created_by || '';
    modifiedByCell.value = modifiedByValue;
    // CRITICAL: Preserve existing font attributes from template, only ensure MingLiU font name
    const existingFont = modifiedByCell.font || {};
    modifiedByCell.font = { ...existingFont, name: 'MingLiU' };
    // Debug logging for first prescription
    if (index === 0) {
      console.log('📊 第一筆處方的 I 欄資料:', {
        itemRow,
        last_modified_by: prescription.last_modified_by,
        created_by: prescription.created_by,
        finalValue: modifiedByValue,
        prescriptionId: prescription.id
      });
      console.log('📊 I8 的完整格式:', {
        value: modifiedByCell.value,
        font: modifiedByCell.font,
        border: modifiedByCell.border,
        alignment: modifiedByCell.alignment,
        fill: modifiedByCell.fill
      });
    }
  });
  if (template.printSettings) {
    (worksheet.pageSetup as any) = {
      ...template.printSettings,
      printTitlesRow: '1:7'
    };
  }
};
export const exportPersonalMedicationListToExcel = async (
  selectedPatients: any[],
  template: any,
  sortBy: SortOption = 'medication_name',
  filename?: string
): Promise<void> => {
  try {
    if (!template.extracted_format) {
      throw new Error('範本格式無效');
    }
    const templateFormat = template.extracted_format as ExtractedTemplate;
    const workbook = new ExcelJS.Workbook();
    for (const patient of selectedPatients) {
      const allPrescriptions = patient.prescriptions || [];
      const activePrescriptions = allPrescriptions.filter((p: any) =>
        p.status === 'active'
      );
      if (activePrescriptions.length === 0) {
        console.warn(`  警告: 院友 ${getPrintBedNumber(patient)} ${patient.中文姓氏}${patient.中文名字} 沒有在服處方，跳過`);
        continue;
      }
      const sheetName = getPrintBedNumber(patient) + patient.中文姓氏 + patient.中文名字;
      const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
      await applyPersonalMedicationListTemplate(worksheet, templateFormat, patient, activePrescriptions, sortBy);
    }
    if (workbook.worksheets.length === 0) {
      throw new Error('沒有可匯出的資料。所有選中的院友可能都沒有在服處方。');
    }
    const finalFilename = filename ||
      (selectedPatients.length === 1
        ? getPrintBedNumber(selectedPatients[0]) + '_' + selectedPatients[0].中文姓氏 + selectedPatients[0].中文名字 + '_個人藥物記錄.xlsx'
        : '個人藥物記錄_' + selectedPatients.length + '名院友.xlsx');
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, finalFilename);
  } catch (error: any) {
    console.error('匯出個人藥物記錄失敗:', error);
    throw error;
  }
};
export const exportSelectedPersonalMedicationListToExcel = async (
  selectedPrescriptionIds: string[],
  currentPatient: any,
  allPrescriptions: any[],
  template: any,
  sortBy: SortOption = 'medication_name',
  includeInactive: boolean = false
): Promise<void> => {
  try {
    if (!template.extracted_format) {
      throw new Error('範本格式無效');
    }
    const templateFormat = template.extracted_format as ExtractedTemplate;
    const isExportAll = selectedPrescriptionIds.length === 0;
    let prescriptionsToExport: any[];
    if (isExportAll) {
      prescriptionsToExport = allPrescriptions.filter(p => {
        if (p.patient_id !== currentPatient.院友id) return false;
        if (p.status === 'pending_change') return false;
        if (p.status === 'inactive' && !includeInactive) return false;
        return true;
      });
    } else {
      prescriptionsToExport = allPrescriptions.filter(p =>
        selectedPrescriptionIds.includes(p.id) &&
        p.patient_id === currentPatient.院友id
      );
    }
    if (prescriptionsToExport.length === 0) {
      throw new Error('沒有可匯出的處方');
    }
    const workbook = new ExcelJS.Workbook();
    const sheetName = getPrintBedNumber(currentPatient) + currentPatient.中文姓氏 + currentPatient.中文名字;
    const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
    await applyPersonalMedicationListTemplate(worksheet, templateFormat, currentPatient, prescriptionsToExport, sortBy);
    const finalFilename = getPrintBedNumber(currentPatient) + '_' + currentPatient.中文姓氏 + currentPatient.中文名字 + '_個人藥物記錄.xlsx';
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, finalFilename);
  } catch (error: any) {
    console.error('匯出選中處方失敗:', error);
    throw error;
  }
};
