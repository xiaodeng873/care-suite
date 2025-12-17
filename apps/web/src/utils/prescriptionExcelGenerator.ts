import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';
import { getFormattedEnglishName } from './nameFormatter';

export interface PrescriptionExportData {
  床號: string;
  中文姓氏: string;
  中文名字: string;
  中文姓名?: string; // Legacy field for compatibility
  性別: string;
  身份證號碼: string;
  出生日期: string;
  藥物敏感?: string[];
  不良藥物反應?: string[];
  處方日期: string;
  藥物名稱: string;
  劑型?: string;
  服用途徑?: string;
  服用次數?: string;
  服用份量?: string;
  服用日數?: string;
  藥物來源: string;
  需要時?: boolean;
  醫生簽名?: string;
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

// 工作表配置介面
interface SheetConfig {
  name: string;
  template: ExtractedTemplate;
  patient: PrescriptionExportData;
}

// 輔助函數：解析儲存格地址
function parseCellAddress(address: string): { row: number; col: number } {
  const match = address.match(/([A-Z]+)(\d+)/i);
  if (!match) throw new Error('Invalid cell address: ' + address);
  const colLetters = match[1].toUpperCase();
  const row = parseInt(match[2], 10);
  let col = 0;
  for (let i = 0; i < colLetters.length; i++) {
    col = col * 26 + (colLetters.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return { row, col };
}

// 從範本文件提取格式（A1:L49）
export const extractPrescriptionTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
  let extractedCellCount = 0;
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await templateFile.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('找不到工作表');
  }

  const extractedTemplate: ExtractedTemplate = {
    columnWidths: [],
    rowHeights: [],
    mergedCells: [],
    cellData: {}
  };

  // Extract column widths (A to L = 1 to 12)
  for (let col = 1; col <= 12; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  // Extract row heights (1 to 49)
  for (let row = 1; row <= 49; row++) {
    let height = worksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    extractedTemplate.rowHeights.push(Math.round(height * 100) / 100);
  }

  // Extract merged cells
  if (worksheet.model && worksheet.model.merges) {
    worksheet.model.merges.forEach(merge => {
      extractedTemplate.mergedCells.push(merge);
    });
  }
  
  // Extract print settings
  if (worksheet.pageSetup) {
    extractedTemplate.printSettings = { ...worksheet.pageSetup };
  }

  // Extract cell data (A1:L49)
  for (let row = 1; row <= 49; row++) {
    for (let col = 1; col <= 12; col++) {
      const cell = worksheet.getCell(row, col);
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
        extractedTemplate.cellData[address] = cellData;
      }
    }
  }

  return extractedTemplate;
};

// 應用範本格式並填入院友資料
export const applyPrescriptionTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: PrescriptionExportData
): void => {
  console.log('=== 開始應用處方箋範本格式 ===');
  
  // Step 1: Set column widths
  template.columnWidths.forEach((width, idx) => {
    if (idx < 12) {
      worksheet.getColumn(idx + 1).width = width;
    }
  });

  // Step 2: Set row heights
  template.rowHeights.forEach((height, idx) => {
    if (idx < 49) {
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

  // Step 5: Fill patient data according to mapping
  if (patient) {
    // C3: 中文姓名
    worksheet.getCell('C3').value = `${patient.中文姓氏}${patient.中文名字}` || '';
    
    // F3: 性別
    worksheet.getCell('F3').value = patient.性別 || '';
    
    // I3: 身份證號碼
    worksheet.getCell('I3').value = patient.身份證號碼 || '';
    
    // L3: 出生日期
    worksheet.getCell('L3').value = patient.出生日期 || '';
    
    // D4: 藥物敏感
    const allergies = Array.isArray(patient.藥物敏感) 
      ? (patient.藥物敏感.length ? patient.藥物敏感.join(', ') : 'NKDA')
      : (patient.藥物敏感 || 'NKDA');
    worksheet.getCell('D4').value = allergies;
    
    // A9: 不良藥物反應
    const reactions = Array.isArray(patient.不良藥物反應)
      ? (patient.不良藥物反應.length ? patient.不良藥物反應.join(', ') : 'NKADR')
      : (patient.不良藥物反應 || 'NKADR');
    worksheet.getCell('A9').value = reactions;
  }

  // Step 6: Copy print settings from template
  if (template.printSettings) {
    try {
      worksheet.pageSetup = { ...template.printSettings };
    } catch (error) {
      console.warn('複製列印設定失敗:', error);
    }
  }
  
// Step 7: Ensure column L has proper right borders for rows 1-49
console.log('第7步: 確保L欄右邊框完整...');
const rightBorderStyle = {
  style: 'thin',
  color: { argb: 'FF000000' }
};
const bottomBorderStyle = {
  style: 'thin',
  color: { argb: 'FF000000' }
};

for (let row = 1; row <= 49; row++) {
  const cell = worksheet.getCell(`L${row}`);
  const existingBorder = cell.border || {};
  
  cell.border = {
    ...existingBorder,
    right: existingBorder.right || rightBorderStyle
  };
}
// 為 D4 加上 thin black bottom border
const cellD4 = worksheet.getCell('D4');
const borderD4 = cellD4.border || {};
cellD4.border = {
  ...borderD4,
  bottom: bottomBorderStyle
};

// 為 A9 加上 thin black bottom border
const cellA9 = worksheet.getCell('A9');
const borderA9 = cellA9.border || {};
cellA9.border = {
  ...borderA9,
  bottom: bottomBorderStyle
};
  
// Step 8: Ensure G15:G44 have the finest dotted left border
console.log('第8步: 確保G15:G44左邊框為最幼虛線...');
const leftBorderStyle = {
  style: 'dotted', // Use 'dotted' for the finest dashed line
  color: { argb: 'FF000000' } // Black color
};

for (let row = 14; row <= 44; row++) {
  const cell = worksheet.getCell(`G${row}`);
  const existingBorder = cell.border || {};
  
  // Log existing border for debugging
  console.log(`G${row} 現有邊框:`, JSON.stringify(existingBorder));
  
  // Forcefully apply the left border
  cell.border = {
    top: existingBorder.top || undefined,
    right: existingBorder.right || undefined,
    bottom: existingBorder.bottom || undefined,
    left: leftBorderStyle // Overwrite with dotted style
  };
  
  // Log the updated border to confirm
  console.log(`G${row} 更新後邊框:`, JSON.stringify(cell.border));
}
console.log('=== G15:G44左邊框應用完成 ===');

console.log('=== 處方箋範本格式應用完成 ===');
};

// 創建處方箋工作簿
const createPrescriptionWorkbook = async (
  sheetsConfig: SheetConfig[]
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();

  for (const config of sheetsConfig) {
    console.log(`創建處方箋工作表: ${config.name}`);
    const worksheet = workbook.addWorksheet(config.name);
    
    applyPrescriptionTemplateFormat(worksheet, config.template, config.patient);
  }

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
  console.log(`處方箋 Excel 檔案 ${filename} 保存成功`);
};

// 匯出處方箋到 Excel（只匯出有勾選「申訴不適」的院友）
export const exportPrescriptionsToExcel = async (
  prescriptions: PrescriptionExportData[],
  filename?: string,
  title?: string
): Promise<void> => {
  try {
    // 從 Supabase 獲取處方箋範本
    const templatesData = await getTemplatesMetadata();
    const prescriptionTemplate = templatesData.find(t => t.type === 'prescription');
    
    if (!prescriptionTemplate) {
      // 如果沒有範本，使用原來的簡單匯出方式
      await exportPrescriptionsToExcelSimple(prescriptions, filename, title);
      return;
    }

    const extractedFormat = prescriptionTemplate.extracted_format;
    
    // 按院友分組處方
    const groupedPrescriptions: { [key: string]: PrescriptionExportData[] } = {};
    
    prescriptions.forEach(prescription => {
      const key = `${prescription.床號}_${prescription.中文姓名}`;
      
      if (!groupedPrescriptions[key]) {
        groupedPrescriptions[key] = [];
      }
      groupedPrescriptions[key].push(prescription);
    });
    
    // 構建工作表配置
    const sheetsConfig: SheetConfig[] = [];
    
    Object.entries(groupedPrescriptions).forEach(([key, prescriptionGroup]) => {
      const patient = prescriptionGroup[0]; // 取第一筆作為院友資料
      
      sheetsConfig.push({
        name: `${patient.床號}${patient.中文姓名}處方箋`,
        template: extractedFormat,
        patient: patient
      });
    });
    
    if (sheetsConfig.length === 0) {
      alert('沒有可匯出的處方資料');
      return;
    }
    
    // 決定檔案名稱
    const finalFilename = filename || 
      (sheetsConfig.length === 1 
        ? `${sheetsConfig[0].patient.床號}_${sheetsConfig[0].patient.中文姓名}_處方箋.xlsx`
        : `處方箋(${sheetsConfig.length}名院友).xlsx`);
    
    // 創建工作簿並匯出
    const workbook = await createPrescriptionWorkbook(sheetsConfig);
    await saveExcelFile(workbook, finalFilename);
    
  } catch (error) {
    console.error('匯出處方箋失敗:', error);
    throw error;
  }
};

// 簡單的處方箋匯出（當沒有範本時使用）
const exportPrescriptionsToExcelSimple = async (
  prescriptions: PrescriptionExportData[],
  filename?: string,
  title?: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('VMO處方箋');

  // 設定欄寬
  worksheet.columns = [
    { width: 10 }, // 床號
    { width: 15 }, // 中文姓名
    { width: 12 }, // 處方日期
    { width: 20 }, // 藥物名稱
    { width: 10 }, // 劑型
    { width: 10 }, // 服用途徑
    { width: 12 }, // 服用次數
    { width: 12 }, // 服用份量
    { width: 10 }, // 服用日數
    { width: 15 }, // 藥物來源
    { width: 8 },  // 需要時
    { width: 12 }  // 醫生簽名
  ];

  // 標題
  if (title) {
    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };
  }

  // 生成資訊
  const infoRow = title ? 3 : 1;
  worksheet.mergeCells(`A${infoRow}:L${infoRow}`);
  const infoCell = worksheet.getCell(`A${infoRow}`);
  infoCell.value = `生成時間: ${new Date().toLocaleString('zh-TW')} | 總記錄數: ${prescriptions.length}`;
  infoCell.font = { size: 10, italic: true };
  infoCell.alignment = { horizontal: 'center' };

  // 表頭
  const headerRow = title ? 5 : 3;
  const headers = [
    '床號', '中文姓名', '處方日期', '藥物名稱', '劑型', '服用途徑',
    '服用次數', '服用份量', '服用日數', '藥物來源', '需要時', '醫生簽名'
  ];

  const headerRowObj = worksheet.getRow(headerRow);
  headers.forEach((header, index) => {
    const cell = headerRowObj.getCell(index + 1);
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
  prescriptions.forEach((prescription, index) => {
    const rowIndex = headerRow + 1 + index;
    const row = worksheet.getOrCreateRow(rowIndex);
    
    const values = [
      prescription.床號,
      `${prescription.中文姓氏}${prescription.中文名字}`,
      prescription.處方日期,
      prescription.藥物名稱,
      prescription.劑型 || '',
      prescription.服用途徑 || '',
      prescription.服用次數 || '',
      prescription.服用份量 || '',
      prescription.服用日數 || '',
      prescription.藥物來源,
      prescription.需要時 ? '是' : '否',
      prescription.醫生簽名 || ''
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
  
  const finalFilename = filename || `VMO處方箋_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, finalFilename);
  
  console.log(`處方箋 Excel 檔案 ${finalFilename} 匯出成功`);
};