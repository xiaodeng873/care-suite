import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';
import { getFormattedEnglishName } from './nameFormatter';

export interface FollowUpExportData {
  覆診id: string;
  院友id: number;
  覆診日期: string;
  出發時間?: string;
  覆診時間?: string;
  覆診地點?: string;
  覆診專科?: string;
  交通安排?: string;
  陪診人員?: string;
  備註?: string;
  院友: {
    床號: string;
    中文姓氏: string;
    中文名字: string;
    英文姓氏?: string;
    英文名字?: string;
    英文姓名?: string; // Legacy field for compatibility
  };
}

// 範本格式提取介面
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
      border?: Partial<ExcelJS.Borders>;
      fill?: Partial<ExcelJS.Fill>;
      numFmt?: string;
    };
  };
}

// 從範本文件提取覆診記錄表格式（A1:J18）
export const extractFollowUpTemplateFormat = async (templateFile: File): Promise<{
  followUpSheet: ExtractedTemplate;
  coverSheet: ExtractedTemplate;
}> => {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await templateFile.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  // 提取覆診記錄表工作表
  const followUpWorksheet = workbook.getWorksheet('覆診記錄表');
  if (!followUpWorksheet) {
    throw new Error('找不到「覆診記錄表」工作表');
  }

  // 提取覆診袋封面工作表
  const coverWorksheet = workbook.getWorksheet('覆診袋封面');
  if (!coverWorksheet) {
    throw new Error('找不到「覆診袋封面」工作表');
  }

  const followUpTemplate: ExtractedTemplate = {
    columnWidths: [],
    rowHeights: [],
    mergedCells: [],
    cellData: {}
  };

  const coverTemplate: ExtractedTemplate = {
    columnWidths: [],
    rowHeights: [],
    mergedCells: [],
    cellData: {}
  };

  // 提取覆診記錄表格式 (A1:J18)
  console.log('提取覆診記錄表格式 (A1:J18)...');
  
  // Extract column widths (A to J = 1 to 10)
  for (let col = 1; col <= 10; col++) {
    let width = followUpWorksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    followUpTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  // Extract row heights (1 to 18)
  for (let row = 1; row <= 18; row++) {
    let height = followUpWorksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    followUpTemplate.rowHeights.push(Math.round(height * 100) / 100);
  }

  // Extract merged cells for followUp sheet
  if (followUpWorksheet.model && followUpWorksheet.model.merges) {
    followUpWorksheet.model.merges.forEach(merge => {
      // Only include merges within A1:J18
      const rowMatch = merge.match(/(\d+)/g);
      const colMatch = merge.match(/([A-J])/g);
      if (rowMatch && colMatch) {
        const maxRow = Math.max(...rowMatch.map(r => parseInt(r)));
        if (maxRow <= 18) {
          followUpTemplate.mergedCells.push(merge);
        }
      }
    });
  }
  
  // Extract print settings for followUp sheet
  if (followUpWorksheet.pageSetup) {
    followUpTemplate.printSettings = { ...followUpWorksheet.pageSetup };
  }

  // Extract cell data for followUp sheet (A1:J18)
  for (let row = 1; row <= 18; row++) {
    for (let col = 1; col <= 10; col++) {
      const cell = followUpWorksheet.getCell(row, col);
      const address = cell.address;
      
      const cellData: any = {};
      
      // Extract value
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        cellData.value = cell.value;
      }
      
      // Extract font
      if (cell.font) {
        cellData.font = { ...cell.font };
      }
      
      // Extract alignment
      if (cell.alignment) {
        cellData.alignment = { ...cell.alignment };
      }
      
      // Extract border
      if (cell.border) {
        cellData.border = {
          top: cell.border.top ? { ...cell.border.top } : undefined,
          left: cell.border.left ? { ...cell.border.left } : undefined,
          bottom: cell.border.bottom ? { ...cell.border.bottom } : undefined,
          right: cell.border.right ? { ...cell.border.right } : undefined,
          diagonal: cell.border.diagonal ? { ...cell.border.diagonal } : undefined,
          diagonalUp: cell.border.diagonalUp,
          diagonalDown: cell.border.diagonalDown
        };
      }
      
      // Extract fill
      if (cell.fill) {
        cellData.fill = { ...cell.fill };
      }
      
      // Extract number format
      if (cell.numFmt) {
        cellData.numFmt = cell.numFmt;
      }
      
      // Only store cell data if it has any properties
      if (Object.keys(cellData).length > 0) {
        followUpTemplate.cellData[address] = cellData;
      }
    }
  }

  // 提取覆診袋封面格式 (A1:Q68)
  console.log('提取覆診袋封面格式 (A1:Q68)...');
  
  // Extract column widths (A to Q = 1 to 17)
  for (let col = 1; col <= 17; col++) {
    let width = coverWorksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    coverTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  // Extract row heights (1 to 68)
  for (let row = 1; row <= 68; row++) {
    let height = coverWorksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    coverTemplate.rowHeights.push(Math.round(height * 100) / 100);
  }

  // Extract merged cells for cover sheet
  if (coverWorksheet.model && coverWorksheet.model.merges) {
    coverWorksheet.model.merges.forEach(merge => {
      // Only include merges within A1:Q68
      const rowMatch = merge.match(/(\d+)/g);
      if (rowMatch) {
        const maxRow = Math.max(...rowMatch.map(r => parseInt(r)));
        if (maxRow <= 68) {
          coverTemplate.mergedCells.push(merge);
        }
      }
    });
  }
  
  // Extract print settings for cover sheet
  if (coverWorksheet.pageSetup) {
    coverTemplate.printSettings = { ...coverWorksheet.pageSetup };
  }

  // Extract cell data for cover sheet (A1:Q68)
  for (let row = 1; row <= 68; row++) {
    for (let col = 1; col <= 17; col++) {
      const cell = coverWorksheet.getCell(row, col);
      const address = cell.address;
      
      const cellData: any = {};
      
      // Extract value
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        cellData.value = cell.value;
      }
      
      // Extract font
      if (cell.font) {
        cellData.font = { ...cell.font };
      }
      
      // Extract alignment
      if (cell.alignment) {
        cellData.alignment = { ...cell.alignment };
      }
      
      // Extract border
      if (cell.border) {
        cellData.border = {
          top: cell.border.top ? { ...cell.border.top } : undefined,
          left: cell.border.left ? { ...cell.border.left } : undefined,
          bottom: cell.border.bottom ? { ...cell.border.bottom } : undefined,
          right: cell.border.right ? { ...cell.border.right } : undefined,
          diagonal: cell.border.diagonal ? { ...cell.border.diagonal } : undefined,
          diagonalUp: cell.border.diagonalUp,
          diagonalDown: cell.border.diagonalDown
        };
      }
      
      // Extract fill
      if (cell.fill) {
        cellData.fill = { ...cell.fill };
      }
      
      // Extract number format
      if (cell.numFmt) {
        cellData.numFmt = cell.numFmt;
      }
      
      // Only store cell data if it has any properties
      if (Object.keys(cellData).length > 0) {
        coverTemplate.cellData[address] = cellData;
      }
    }
  }

  return {
    followUpSheet: followUpTemplate,
    coverSheet: coverTemplate
  };
};

// 生成特殊格式的院友姓名：中文姓氏+英文名字首字母+中文名字最後一字
const generateSpecialPatientName = (patient: FollowUpExportData['院友']): string => {
  const 中文姓氏 = patient.中文姓氏 || '';
  const 中文名字 = patient.中文名字 || '';
  
  // 獲取英文名字的首字母
  let 英文名字首字母 = '';
  if (patient.英文名字) {
    // 取英文名字的第一個字母並轉為大寫
    英文名字首字母 = patient.英文名字.charAt(0).toUpperCase();
  } else if (patient.英文姓名) {
    // 如果沒有新的英文名字欄位，嘗試從舊的英文姓名欄位提取
    const parts = patient.英文姓名.split(',');
    if (parts.length > 1) {
      const givenName = parts[1].trim();
      if (givenName) {
        英文名字首字母 = givenName.charAt(0).toUpperCase();
      }
    }
  }
  
  // 獲取中文名字的最後一個字
  const 中文名字最後字 = 中文名字 ? 中文名字.charAt(中文名字.length - 1) : '';
  
  return `${中文姓氏}${英文名字首字母}${中文名字最後字}`;
};

// 格式化時間為 HH:MM 格式
const formatTimeToHHMM = (timeStr: string): string => {
  if (!timeStr) return '';
  
  // 如果已經是 HH:MM 格式，直接返回
  if (timeStr.match(/^\d{2}:\d{2}$/)) {
    return timeStr;
  }
  
  // 如果是 HH:MM:SS 格式，截取前5位
  if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return timeStr.slice(0, 5);
  }
  
  // 其他格式嘗試解析
  try {
    const date = new Date(`2000-01-01T${timeStr}`);
    if (!isNaN(date.getTime())) {
      return date.toTimeString().slice(0, 5);
    }
  } catch (error) {
    console.warn('無法解析時間格式:', timeStr);
  }
  
  return timeStr;
};

// 應用覆診記錄表範本格式並填入資料
const applyFollowUpTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  appointments: FollowUpExportData[]
): void => {
  console.log('=== 開始應用覆診記錄表範本格式 ===');
  
  // Step 1: Set column widths
  template.columnWidths.forEach((width, idx) => {
    if (idx < 10) {
      worksheet.getColumn(idx + 1).width = width;
    }
  });

  // Step 2: Set row heights
  template.rowHeights.forEach((height, idx) => {
    if (idx < 18) {
      worksheet.getRow(idx + 1).height = height;
    }
  });

  // Step 3: Apply cell data (value, font, alignment, border, fill)
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const cell = worksheet.getCell(address);
    
    // Apply value
    if (cellData.value !== undefined) {
      cell.value = cellData.value;
    }
    
    // Apply font
    if (cellData.font) {
      cell.font = { ...cellData.font };
    }
    
    // Apply alignment
    if (cellData.alignment) {
      cell.alignment = { ...cellData.alignment };
    }
    
    // Apply border
    if (cellData.border) {
      cell.border = { ...cellData.border };
    }
    
    // Apply fill
    if (cellData.fill) {
      cell.fill = { ...cellData.fill };
    }
    
    // Apply number format
    if (cellData.numFmt) {
      cell.numFmt = cellData.numFmt;
    }
  });

  // Step 4: Merge cells
  template.mergedCells.forEach(merge => {
    try {
      worksheet.mergeCells(merge);
    } catch (e) {
      console.warn(`合併儲存格失敗: ${merge}`, e);
    }
  });

  // Step 5: Fill appointment data starting from row 2
  appointments.forEach((appointment, index) => {
    const rowIndex = 2 + index; // 第2行開始為資料行
    
    // A: 日期 (M月D日)
    const appointmentDate = new Date(appointment.覆診日期);
    const formattedDate = `${appointmentDate.getMonth() + 1}月${appointmentDate.getDate()}日`;
    worksheet.getCell(`A${rowIndex}`).value = formattedDate;
    
    // B: 床號
    worksheet.getCell(`B${rowIndex}`).value = appointment.院友.床號;
    
    // C: 院友姓名（特殊格式：中文姓氏+英文名字首字母+中文名字最後一字）
    const specialName = generateSpecialPatientName(appointment.院友);
    worksheet.getCell(`C${rowIndex}`).value = specialName;
    
    // D: 出發時間 (HH:MM，如無就留空)
    worksheet.getCell(`D${rowIndex}`).value = appointment.出發時間 ? formatTimeToHHMM(appointment.出發時間) : '';
    
    // E: 覆診時間 (HH:MM，如無就留空)
    worksheet.getCell(`E${rowIndex}`).value = appointment.覆診時間 ? formatTimeToHHMM(appointment.覆診時間) : '';
    
    // F: 覆診地點 (如無就留空)
    worksheet.getCell(`F${rowIndex}`).value = appointment.覆診地點 || '';
    
    // G: 覆診專科 (如無就留空)
    worksheet.getCell(`G${rowIndex}`).value = appointment.覆診專科 || '';
    
    // H: 陪診 (如無就留空)
    worksheet.getCell(`H${rowIndex}`).value = appointment.陪診人員 || '';
    
    // I: 交通 (如無就留空)
    worksheet.getCell(`I${rowIndex}`).value = appointment.交通安排 || '';
    
    // J: 備註 (如無就留空)
    worksheet.getCell(`J${rowIndex}`).value = appointment.備註 || '';
  });

  // Step 6: Copy print settings from template
  if (template.printSettings) {
    try {
      worksheet.pageSetup = { ...template.printSettings };
    } catch (error) {
      console.warn('複製列印設定失敗:', error);
    }
  }
  
  console.log('=== 覆診記錄表範本格式應用完成 ===');
};

// 應用覆診袋封面範本格式
const applyCoverTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate
): void => {
  console.log('=== 開始應用覆診袋封面範本格式 ===');
  
  // Step 1: Set column widths
  template.columnWidths.forEach((width, idx) => {
    if (idx < 17) {
      worksheet.getColumn(idx + 1).width = width + 0.20;
    }
  });

  // Step 2: Set row heights
  template.rowHeights.forEach((height, idx) => {
    if (idx < 68) {
      worksheet.getRow(idx + 1).height = height;
    }
  });

  // Step 3: Apply cell data (value, font, alignment, border, fill, numFmt)
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const cell = worksheet.getCell(address);
    
    // Apply value
    if (cellData.value !== undefined) {
      cell.value = cellData.value;
    }
    
    // Apply font
    if (cellData.font) {
      cell.font = { ...cellData.font };
    }
    
    // Apply alignment
    if (cellData.alignment) {
      cell.alignment = { ...cellData.alignment };
    }
    
    // Apply border
    if (cellData.border) {
      cell.border = {
        top: cellData.border.top ? { ...cellData.border.top } : undefined,
        left: cellData.border.left ? { ...cellData.border.left } : undefined,
        bottom: cellData.border.bottom ? { ...cellData.border.bottom } : undefined,
        right: cellData.border.right ? { ...cellData.border.right } : undefined,
        diagonal: cellData.border.diagonal ? { ...cellData.border.diagonal } : undefined,
        diagonalUp: cellData.border.diagonalUp,
        diagonalDown: cellData.border.diagonalDown
      };
    }
    
    // Apply fill
    if (cellData.fill) {
      cell.fill = { ...cellData.fill };
    }
    
    // Apply number format
    if (cellData.numFmt) {
      cell.numFmt = cellData.numFmt;
    }
  });

  // Step 4: Merge cells
  template.mergedCells.forEach(merge => {
    try {
      worksheet.mergeCells(merge);
    } catch (e) {
      console.warn(`合併儲存格失敗: ${merge}`, e);
    }
  });

  // Step 5: Set print settings
  if (template.printSettings) {
    try {
      worksheet.pageSetup = {
        ...template.printSettings,
        paperSize: 9,
        orientation: 'landscape',
        printArea: 'A1:Q17,A18:Q34,A35:Q50,A52:Q68'
      };
    } catch (error) {
      console.warn('複製列印設定失敗:', error);
    }
  } else {
    worksheet.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      printArea: 'A1:Q17,A18:Q34,A35:Q50,A52:Q68'
    };
  }
  
  console.log('=== 覆診袋封面範本格式應用完成 ===');
};

// 創建覆診記錄表工作簿
const createFollowUpWorkbook = async (
  appointments: FollowUpExportData[],
  followUpTemplate: ExtractedTemplate,
  coverTemplate: ExtractedTemplate
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();

  // 創建覆診記錄表工作表
  console.log('創建覆診記錄表工作表...');
  const followUpWorksheet = workbook.addWorksheet('覆診記錄表');
  applyFollowUpTemplateFormat(followUpWorksheet, followUpTemplate, appointments);

  // 創建覆診袋封面工作表
  console.log('創建覆診袋封面工作表...');
  const coverWorksheet = workbook.addWorksheet('覆診袋封面');
  applyCoverTemplateFormat(coverWorksheet, coverTemplate);

  return workbook;
};

// 儲存 Excel 檔案
const saveExcelFile = async (
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<void> => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
  console.log(`覆診記錄表 Excel 檔案 ${filename} 保存成功`);
};

// 匯出覆診記錄表到 Excel
export const exportFollowUpListToExcel = async (
  appointments: FollowUpExportData[],
  filename?: string
): Promise<void> => {
  try {
    // 檢查資料數量限制
    if (appointments.length > 17) {
      throw new Error(`選擇的覆診記錄超過限制！\n\n最多只能匯出 17 筆記錄，您選擇了 ${appointments.length} 筆。\n\n請返回重新選擇不超過 17 筆的記錄。`);
    }

    if (appointments.length === 0) {
      throw new Error('沒有選擇任何覆診記錄');
    }

    // 從 Supabase 獲取覆診記錄表範本
    const templatesData = await getTemplatesMetadata();
    const followUpTemplate = templatesData.find(t => t.type === 'follow-up-list');
    
    if (!followUpTemplate || !followUpTemplate.extracted_format) {
      // 如果沒有範本，使用簡單匯出方式
      await exportFollowUpListToExcelSimple(appointments, filename);
      return;
    }

    const { followUpSheet, coverSheet } = followUpTemplate.extracted_format;
    
    if (!followUpSheet || !coverSheet) {
      throw new Error('範本格式不完整，缺少覆診記錄表或覆診袋封面工作表');
    }
    
    // 決定檔案名稱
    const finalFilename = filename || `覆診記錄表_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // 創建工作簿並匯出
    const workbook = await createFollowUpWorkbook(appointments, followUpSheet, coverSheet);
    await saveExcelFile(workbook, finalFilename);
    
  } catch (error) {
    console.error('匯出覆診記錄表失敗:', error);
    throw error;
  }
};

// 簡單的覆診記錄表匯出（當沒有範本時使用）
const exportFollowUpListToExcelSimple = async (
  appointments: FollowUpExportData[],
  filename?: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('覆診記錄表');

  // 設定欄寬
  worksheet.columns = [
    { width: 12 }, // 日期
    { width: 8 },  // 床號
    { width: 15 }, // 院友姓名
    { width: 10 }, // 出發時間
    { width: 10 }, // 覆診時間
    { width: 20 }, // 覆診地點
    { width: 15 }, // 覆診專科
    { width: 12 }, // 陪診
    { width: 12 }, // 交通
    { width: 25 }  // 備註
  ];

  // 表頭
  const headers = [
    '日期', '床號', '院友姓名', '出發時間', '覆診時間', 
    '覆診地點', '覆診專科', '陪診', '交通', '備註'
  ];

  const headerRow = worksheet.getRow(1);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // 資料行
  appointments.forEach((appointment, index) => {
    const rowIndex = 2 + index;
    const row = worksheet.getRow(rowIndex);
    
    // 格式化日期為 M月D日
    const appointmentDate = new Date(appointment.覆診日期);
    const formattedDate = `${appointmentDate.getMonth() + 1}月${appointmentDate.getDate()}日`;
    
    // 生成特殊格式的院友姓名
    const specialName = generateSpecialPatientName(appointment.院友);
    
    const values = [
      formattedDate,
      appointment.院友.床號,
      specialName,
      appointment.出發時間 ? formatTimeToHHMM(appointment.出發時間) : '',
      appointment.覆診時間 ? formatTimeToHHMM(appointment.覆診時間) : '',
      appointment.覆診地點 || '',
      appointment.覆診專科 || '',
      appointment.陪診人員 || '',
      appointment.交通安排 || '',
      appointment.備註 || ''
    ];

    values.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      cell.value = value;
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      
      // 交替行顏色
      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8F9FA' }
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const finalFilename = filename || `覆診記錄表_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, finalFilename);
  
  console.log(`覆診記錄表 Excel 檔案 ${finalFilename} 匯出成功`);
};