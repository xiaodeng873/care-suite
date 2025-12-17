import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';
import { getFormattedEnglishName } from './nameFormatter';

export interface WaitingListExportData {
  床號: string;
  中文姓氏: string;
  中文名字: string;
  英文姓氏?: string;
  英文名字?: string;
  中文姓名?: string; // Legacy field for compatibility
  英文姓名?: string; // Legacy field for compatibility
  性別: string;
  身份證號碼: string;
  出生日期: string;
  看診原因?: string[];
  症狀說明?: string;
  藥物敏感?: string[];
  不良藥物反應?: string[];
  備註?: string;
  到診日期?: string;
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
  patients: WaitingListExportData[];
  visitDate: string;
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

// 從範本文件提取格式（A1:L28）
export const extractWaitingListTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
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

  // Extract row heights (1 to 28)
  for (let row = 1; row <= 28; row++) {
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

  // Extract cell data (A1:L28)
  for (let row = 1; row <= 28; row++) {
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
export const applyWaitingListTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patients: WaitingListExportData[],
  visitDate: string
): void => {
  console.log('=== 開始應用院友候診記錄表範本格式 ===');
  
  // Step 1: Set column widths
  template.columnWidths.forEach((width, idx) => {
    if (idx < 12) {
      worksheet.getColumn(idx + 1).width = width;
    }
  });

  // Step 2: Set row heights
  template.rowHeights.forEach((height, idx) => {
    if (idx < 28) {
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

  // Step 5: Fill patient data starting from row 14

  // Fill visit date in header (assuming it goes in a specific cell, e.g., A5)
  const visitDateText = visitDate ? `到診日期：${new Date(visitDate).toLocaleDateString('zh-TW')}` : '';
  worksheet.getCell('G6').value = visitDateText;

  patients.forEach((patient, index) => {
    const rowIndex = 14 + index; // 14為起始行
    
    // B: 床號
    worksheet.getCell(`B${rowIndex}`).value = patient.床號;
    
    // C: 中文姓名
    worksheet.getCell(`C${rowIndex}`).value = `${patient.中文姓氏}${patient.中文名字}`;
    
    // D: 英文姓名
    worksheet.getCell(`D${rowIndex}`).value = getFormattedEnglishName(patient.英文姓氏, patient.英文名字) || patient.英文姓名 || '';
    
    // E: 身份證號碼
    worksheet.getCell(`E${rowIndex}`).value = patient.身份證號碼;
    
    // F: 性別
    worksheet.getCell(`F${rowIndex}`).value = patient.性別;
    
    // G: 出生日期
    worksheet.getCell(`G${rowIndex}`).value = patient.出生日期 ? 
      new Date(patient.出生日期).toLocaleDateString('zh-TW') : '';
    
    // H: 症狀說明 
    worksheet.getCell(`H${rowIndex}`).value = patient.症狀說明;
    
    // I: 藥物敏感 (如有:"✓"; 如無:NKDA)
    const hasAllergies = patient.藥物敏感 && Array.isArray(patient.藥物敏感) && patient.藥物敏感.length > 0;
    worksheet.getCell(`I${rowIndex}`).value = hasAllergies ? '✓' : 'NKDA';
    
    // J: 年度體檢 (如有:"✓")
    const hasAnnualCheckup = patient.看診原因 && patient.看診原因.includes('年度體檢');
    worksheet.getCell(`J${rowIndex}`).value = hasAnnualCheckup ? '✓' : '';
    
    // K: 約束物品同意書 (如有:"✓")
    const hasConsentForm = patient.看診原因 && patient.看診原因.includes('約束物品同意書');
    worksheet.getCell(`K${rowIndex}`).value = hasConsentForm ? '✓' : '';
    
    // L: 備註
    worksheet.getCell(`L${rowIndex}`).value = patient.備註 || '';
  });

  // Step 5.5: Add statistics counts
  const symptomCount = patients.filter(p => p.症狀說明).length;
  const annualCheckupCount = patients.filter(p => p.看診原因 && p.看診原因.includes('年度體檢')).length;
  const consentFormCount = patients.filter(p => p.看診原因 && p.看診原因.includes('約束物品同意書')).length;

  worksheet.getCell('J9').value = symptomCount;
  worksheet.getCell('J10').value = annualCheckupCount;
  worksheet.getCell('J11').value = consentFormCount;

  // Step 6: Copy print settings from template
  if (template.printSettings) {
    try {
      worksheet.pageSetup = { ...template.printSettings };
    } catch (error) {
      console.warn('複製列印設定失敗:', error);
    }
  }
  
  console.log('=== 院友候診記錄表範本格式應用完成 ===');
};

// 創建候診記錄表工作簿
const createWaitingListWorkbook = async (
  sheetsConfig: SheetConfig[]
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();

  for (const config of sheetsConfig) {
    console.log(`創建候診記錄表工作表: ${config.name}`);
    const worksheet = workbook.addWorksheet(config.name);
    
    applyWaitingListTemplateFormat(worksheet, config.template, config.patients, config.visitDate);
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
  console.log(`候診記錄表 Excel 檔案 ${filename} 保存成功`);
};

// 匯出候診記錄表到 Excel
export const exportWaitingListToExcel = async (
  patients: WaitingListExportData[],
  filename?: string,
  title?: string
): Promise<void> => {
  try {
    // 從 Supabase 獲取候診記錄表範本
    worksheet.getCell('AF1').value = `${patient.中文姓氏}${patient.中文名字}` || '';
    const waitingListTemplate = templatesData.find(t => t.type === 'waiting-list');
    
    if (!waitingListTemplate) {
      // 如果沒有範本，使用原來的簡單匯出方式
      await exportWaitingListToExcelSimple(patients, filename, title);
      return;
    }

    const extractedFormat = waitingListTemplate.extracted_format;
    
    // 按到診日期分組
    const groupedPatients: { [date: string]: WaitingListExportData[] } = {};
    
    patients.forEach(patient => {
      const visitDate = patient.到診日期 || new Date().toISOString().split('T')[0];
      
      if (!groupedPatients[visitDate]) {
        groupedPatients[visitDate] = [];
      }
      groupedPatients[visitDate].push(patient);
    });
    
    // 構建工作表配置
    const sheetsConfig: SheetConfig[] = [];
    
    Object.entries(groupedPatients).forEach(([visitDate, patientGroup]) => {
      sheetsConfig.push({
        name: `院友候診記錄表${visitDate}`,
        template: extractedFormat,
        patients: patientGroup,
        visitDate: visitDate
      });
    });
    
    if (sheetsConfig.length === 0) {
      alert('沒有可匯出的候診資料');
      return;
    }
    
    // 決定檔案名稱
    const finalFilename = filename || 
      (sheetsConfig.length === 1 
        ? `院友候診記錄表_${sheetsConfig[0].visitDate}.xlsx`
        : `院友候診記錄表(${sheetsConfig.length}個日期).xlsx`);
    
    // 創建工作簿並匯出
    const workbook = await createWaitingListWorkbook(sheetsConfig);
    await saveExcelFile(workbook, finalFilename);
    
  } catch (error) {
    console.error('匯出候診記錄表失敗:', error);
    throw error;
  }
};

// 簡單的候診記錄表匯出（當沒有範本時使用）
const exportWaitingListToExcelSimple = async (
  patients: WaitingListExportData[],
  filename?: string,
  title?: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('院友候診記錄表');

  // 設定欄寬
  worksheet.columns = [
    { width: 8 },  // 床號
    { width: 12 }, // 中文姓名
    { width: 15 }, // 英文姓名
    { width: 6 },  // 性別
    { width: 12 }, // 身份證號碼
    { width: 12 }, // 出生日期
    { width: 15 }, // 看診原因
    { width: 20 }, // 症狀說明
    { width: 15 }, // 藥物敏感
    { width: 15 }, // 不良藥物反應
    { width: 20 }, // 備註
    { width: 12 }  // 到診日期
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
      fgColor: { argb: 'FFE6F7FF' }
    };
  }

  // 生成資訊
  const infoRow = title ? 3 : 1;
  worksheet.mergeCells(`A${infoRow}:L${infoRow}`);
  const infoCell = worksheet.getCell(`A${infoRow}`);
  infoCell.value = `生成時間: ${new Date().toLocaleString('zh-TW')} | 總記錄數: ${patients.length}`;
  infoCell.font = { size: 10, italic: true };
  infoCell.alignment = { horizontal: 'center' };

  // 表頭
  const headerRow = title ? 5 : 3;
  const headers = [
    '床號', '中文姓名', '英文姓名', '性別', '身份證號碼', '出生日期',
    '看診原因', '症狀說明', '藥物敏感', '不良藥物反應', '備註', '到診日期'
  ];

  const headerRowObj = worksheet.getRow(headerRow);
  headers.forEach((header, index) => {
    const cell = headerRowObj.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
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
  patients.forEach((patient, index) => {
    const rowIndex = headerRow + 1 + index;
    const row = worksheet.getOrCreateRow(rowIndex);
    
    const values = [
      patient.床號,
      `${patient.中文姓氏}${patient.中文名字}`,
      getFormattedEnglishName(patient.英文姓氏, patient.英文名字) || patient.英文姓名 || '',
      patient.性別,
      patient.身份證號碼,
      patient.出生日期 ? new Date(patient.出生日期).toLocaleDateString('zh-TW') : '',
      Array.isArray(patient.看診原因) ? patient.看診原因.join(', ') : (patient.看診原因 || ''),
      patient.症狀說明 || '',
      Array.isArray(patient.藥物敏感) ? (patient.藥物敏感.length ? patient.藥物敏感.join(', ') : '無') : (patient.藥物敏感 || '無'),
      Array.isArray(patient.不良藥物反應) ? (patient.不良藥物反應.length ? patient.不良藥物反應.join(', ') : '無') : (patient.不良藥物反應 || '無'),
      patient.備註 || '',
      patient.到診日期 ? new Date(patient.到診日期).toLocaleDateString('zh-TW') : ''
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
  
  const finalFilename = filename || `院友候診記錄表_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, finalFilename);
  
  console.log(`候診記錄表 Excel 檔案 ${finalFilename} 匯出成功`);
};