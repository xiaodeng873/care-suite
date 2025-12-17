import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';

interface DiaperChangeExportData {
  床號: string;
  中文姓氏: string;
  中文名字: string;
  中文姓名?: string; // Legacy field for compatibility
  性別: string;
  出生日期: string;
  身份證號碼: string;
  護理等級?: string;
  入住類型?: string;
  入住日期?: string;
  社會福利?: any;
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
  images: Array<{
    imageId: number;
    base64: string;
    extension: string;
    range: string;
  }>;
  pageBreaks?: {
    rowBreaks?: number[];
    colBreaks?: number[];
  };
}

// 工作表配置介面
interface SheetConfig {
  name: string;
  template: ExtractedTemplate;
  patient: {
    床號: string;
    中文姓氏: string;
    中文名字: string;
    性別: string;
    出生日期: string;
    身份證號碼: string;
    護理等級?: string;
    入住類型?: string;
    入住日期?: string;
    社會福利?: any;
  };
  yearMonth: string; // 格式: XXXX年XX月
}

// 從範本文件提取完整格式
export const extractDiaperChangeTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
  let extractedCellCount = 0;
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await templateFile.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('找不到工作表');
  }

  console.log(`Worker: ExcelJS 識別到的實際列數: ${worksheet.actualColumnCount}`);
  console.log(`Worker: ExcelJS 識別到的實際行數: ${worksheet.actualRowCount}`);
  console.log(`Worker: ExcelJS 識別到的維度: ${worksheet.dimensions}`);

  // 使用固定範圍 A1:AE140 來確保所有行都被處理
  const dimension = worksheet.dimension;
  console.log(`Worker: ExcelJS 識別到的工作表範圍: ${dimension?.top},${dimension?.left} - ${dimension?.bottom},${dimension?.right}`);

  const extractedTemplate: ExtractedTemplate = {
    columnWidths: [],
    rowHeights: [],
    mergedCells: [],
    cellData: {},
    images: [], // Initialize images array
    // pageBreaks: { rowBreaks: [], colBreaks: [] } // Removed as per previous discussion, but keeping for reference if needed
    pageBreaks: {
      rowBreaks: [],
      colBreaks: []
    },
  };

  // 固定範圍 A1:AE140 (AE = 31欄, 140行) - 強制使用完整範圍
  const actualMaxCol = 31; // AE欄 = 31
  const actualMaxRow = 140; // 固定140行

  console.log(`Worker: 使用固定提取範圍: A1:AE140 (31 欄 x 140 行)`);

  // Extract column widths (A到AE = 1到31)
  extractedTemplate.columnWidths = []; // Clear to ensure fresh extraction
  
  for (let col = 1; col <= actualMaxCol; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }
  console.log(`Worker: 提取了 ${extractedTemplate.columnWidths.length} 欄的寬度`);

  // Extract row heights (1到140)
  extractedTemplate.rowHeights = []; // Clear to ensure fresh extraction
  for (let row = 1; row <= 140; row++) {
    let height = worksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    extractedTemplate.rowHeights.push(Math.round(height * 100) / 100); // Always extract up to 140 rows for consistency
  }
  console.log(`Worker: 提取了 ${extractedTemplate.rowHeights.length} 行的高度`);

  // Extract merged cells
  if (worksheet.model && worksheet.model.merges) {
    worksheet.model.merges.forEach(merge => {
      extractedTemplate.mergedCells.push(merge);
    });
    console.log(`Worker: 提取合併儲存格: ${extractedTemplate.mergedCells.length} 個`);
  }
  
  // Extract print settings
  if (worksheet.pageSetup) {
    extractedTemplate.printSettings = { ...worksheet.pageSetup };
    console.log(`Worker: 提取列印設定:`, JSON.stringify(extractedTemplate.printSettings));
  }

  // Extract page breaks
  console.log('提取分頁符...');
  try {
    const rowBreaks: number[] = [];
    const colBreaks: number[] = [];
    
    // Multiple methods to extract page breaks
    if (worksheet.rowBreaks && Array.isArray(worksheet.rowBreaks)) {
      rowBreaks.push(...worksheet.rowBreaks);
    }
    
    if (worksheet.colBreaks && Array.isArray(worksheet.colBreaks)) {
      colBreaks.push(...worksheet.colBreaks);
    }
    
    if ((worksheet as any).model?.rowBreaks) {
      const modelRowBreaks = (worksheet as any).model.rowBreaks;
      if (Array.isArray(modelRowBreaks)) {
        rowBreaks.push(...modelRowBreaks);
      }
    }
    
    if ((worksheet as any).model?.colBreaks) {
      const modelColBreaks = (worksheet as any).model.colBreaks;
      if (Array.isArray(modelColBreaks)) {
        colBreaks.push(...modelColBreaks);
      }
    }
    
    extractedTemplate.pageBreaks!.rowBreaks = [...new Set(rowBreaks)];
    extractedTemplate.pageBreaks!.colBreaks = [...new Set(colBreaks)];
    
    console.log('Worker: 分頁符統計:', {
      rowBreaks: extractedTemplate.pageBreaks!.rowBreaks.length,
      colBreaks: extractedTemplate.pageBreaks!.colBreaks.length
    });
    
  } catch (error) {
    console.error('Worker: 提取分頁符失敗:', error);
    extractedTemplate.pageBreaks = { rowBreaks: [], colBreaks: [] };
  }

  // Extract cell data for entire worksheet
  let rowsWithData = new Set<number>();
  let colsWithData = new Set<number>();
  
  // 遍歷完整範圍 A1:AE140
  for (let row = 1; row <= actualMaxRow; row++) {
    for (let col = 1; col <= actualMaxCol; col++) {
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
        // 處理 Segoe UI Symbol 字體以避免亂碼
        if (cellData.font.name === 'Segoe UI Symbol' || cellData.font.name === 'Segoe UI Emoji') { // Also handle Segoe UI Emoji
          cellData.font.name = 'Arial Unicode MS';
        }
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
        extractedCellCount++; // Increment count only if data is stored
        rowsWithData.add(row); // Track rows with data
        colsWithData.add(col); // Track columns with data
      }
    }
  }
  console.log(`Worker: 提取了 ${extractedCellCount} 個儲存格的格式`);
  console.log(`Worker: 包含數據的行範圍: ${Math.min(...rowsWithData)} - ${Math.max(...rowsWithData)}`);
  console.log(`Worker: 包含數據的欄範圍: ${Math.min(...colsWithData)} - ${Math.max(...colsWithData)}`);
  console.log(`Worker: 完成提取 ${extractedCellCount} 個儲存格的格式，涵蓋 ${rowsWithData.size} 行`);
  console.log(`Worker: 包含數據的行範圍: ${Math.min(...rowsWithData)} - ${Math.max(...rowsWithData)}`);
  
  return extractedTemplate;
};

// 應用換片記錄範本格式到工作表
const applyDiaperChangeTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: any,
  yearMonth: string
): void => {
  console.log(`Worker: === 開始應用換片記錄範本格式: ${patient.中文姓氏}${patient.中文名字} ===`);

  // Step 1: Set column widths
  console.log('第1步: 設定欄寬...');
  template.columnWidths.forEach((width, idx) => {
    const colNum = idx + 1;
    worksheet.getColumn(colNum).width = width;
  });
  console.log(`設定了 ${template.columnWidths.length} 欄的寬度`);

  // Step 2: Set row heights
  console.log('第2步: 設定行高...');
  template.rowHeights.forEach((height, idx) => {
    const rowNum = idx + 1;
    worksheet.getRow(rowNum).height = height;
  });
  console.log(`設定了 ${template.rowHeights.length} 行的高度`);

  // Step 3: Apply cell styles and data
  console.log('第3步: 應用儲存格樣式...');
  let appliedCells = 0;
  let problemCells = 0;
  
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    try {
      const cell = worksheet.getCell(address);
      const rowNum = parseInt(address.match(/\d+/)?.[0] || '0');
      
      // Apply value
      if (cellData.value !== undefined) {
        cell.value = cellData.value;
      }
      
      // Apply font
      if (cellData.font) {
        cell.font = cellData.font;
      }
      
      // Apply alignment
      if (cellData.alignment) {
        cell.alignment = cellData.alignment;
      }
      
      // Apply border
      if (cellData.border) {
        cell.border = cellData.border;
      }
      
      // Apply fill
      if (cellData.fill) {
        cell.fill = cellData.fill;
      }
      
      // Apply number format
      if (cellData.numFmt) {
        cell.numFmt = cellData.numFmt;
      }
      
      appliedCells++;
      
      // 特別關注第100行以後的儲存格
      if (rowNum >= 100) {
        console.log(`✅ 成功應用第${rowNum}行儲存格 ${address}`);
      }
    } catch (error) {
      console.error(`❌ 應用儲存格 ${address} 樣式失敗:`, error);
      if (rowNum >= 100) {
        problemCells++;
        console.error(`❌ 第${rowNum}行問題儲存格 ${address} 失敗:`, error);
      }
    }
  });
  console.log(`成功應用了 ${appliedCells} 個儲存格的樣式`);
  if (problemCells > 0) {
    console.warn(`⚠️ 第100行以後有 ${problemCells} 個儲存格應用失敗`);
  }

  // Step 4: Merge cells
  let mergedCount = 0;
  template.mergedCells.forEach(merge => {
    try {
      worksheet.mergeCells(merge);
      mergedCount++;
    } catch (e: any) {
      console.warn(`合併儲存格失敗: ${merge}`, e);
    }
  });
  console.log(`成功合併了 ${mergedCount} 個儲存格範圍`);

  // Step 5: Apply page breaks
  if (template.pageBreaks) {
    try {
      if (template.pageBreaks.rowBreaks && template.pageBreaks.rowBreaks.length > 0) {
        template.pageBreaks.rowBreaks.forEach(rowNum => {
          try {
            worksheet.addPageBreak(rowNum, 0);
            console.log(`添加行分頁符於第 ${rowNum} 行`);
          } catch (error) {
            console.warn(`添加行分頁符失敗 (第 ${rowNum} 行):`, error);
          }
        });
      }
      
      if (template.pageBreaks.colBreaks && template.pageBreaks.colBreaks.length > 0) {
        template.pageBreaks.colBreaks.forEach(colNum => {
          try {
            worksheet.addPageBreak(0, colNum);
            console.log(`添加欄分頁符於第 ${colNum} 欄`);
          } catch (error) {
            console.warn(`添加欄分頁符失敗 (第 ${colNum} 欄):`, error);
          }
        });
      }
    } catch (error) {
      console.error('應用分頁符失敗:', error);
    }
  }

  // Step 6: Apply images
  console.log('應用圖片...');
  if (Array.isArray(template.images)) {
    template.images.forEach(img => {
      try {
        const imageId = worksheet.workbook.addImage({
          base64: img.base64,
          extension: img.extension as 'png' | 'jpeg' | 'gif'
        });
        worksheet.addImage(imageId, img.range);
        console.log(`Worker: 應用圖片: ID=${img.imageId}, 範圍=${img.range}, 格式=${img.extension}`);
      } catch (error: any) {
        console.error(`應用圖片失敗 (範圍=${img.range}):`, error);
      }
    });
  }

  // Step 7: Fill patient data according to mapping
  console.log('第6步: 填充院友資料...');
  
  // D3: 院友中文姓名
  worksheet.getCell('D3').value = `${patient.中文姓氏}${patient.中文名字}`;
  console.log(`Worker: 填入 D3: 院友中文姓名 = ${patient.中文姓氏}${patient.中文名字}`);
  
  // L3: 床號
  worksheet.getCell('L3').value = patient.床號;
  console.log(`Worker: 填入 L3: 床號 = ${patient.床號}`);
  
  // AB3: 月份/年份 (格式: XXXX年XX月)
  worksheet.getCell('AB3').value = yearMonth;
  console.log(`Worker: 填入 AB3: 月份/年份 = ${yearMonth}`);

  // Step 8: Apply print settings and page breaks
  console.log('第8步: 應用列印設定和分頁符...');
  
  // 完全忽略範本中的所有分頁符，只設定我們需要的分頁符
  try {
    // 完全清除所有現有分頁符
    delete (worksheet as any).rowBreaks;
    delete (worksheet as any).colBreaks;
    if ((worksheet as any).model) {
      delete (worksheet as any).model.rowBreaks;
      delete (worksheet as any).model.colBreaks;
    }
    
    // 設定頁面配置，避免自動分頁
    worksheet.pageSetup = {
      orientation: 'landscape',
      paperSize: 9, // A4
      printArea: 'A1:AE140',
      fitToPage: false, // 禁用適應頁面
      fitToWidth: 1,    // 1頁寬
      fitToHeight: 0,   // 無限高，避免自動分頁
      scale: undefined, // 讓Excel自動計算縮放比例
      margins: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        header: 0,
        footer: 0
      }
    };
    
    // 只設定我們需要的分頁符：第35、70、105行後
    (worksheet as any).rowBreaks = [
      { id: 35, max: 16383, man: true },
      { id: 70, max: 16383, man: true },
      { id: 105, max: 16383, man: true }
    ];
    (worksheet as any).colBreaks = []; // 不設定欄分頁符
    
    // 確保 model 也只有我們指定的分頁符
    if (!(worksheet as any).model) {
      (worksheet as any).model = {};
    }
    (worksheet as any).model.rowBreaks = [35, 70, 105];
    (worksheet as any).model.colBreaks = [];
    
    console.log('✅ 換片記錄分頁符強制設定完成：只在第35、70、105行後分頁');
    
    // 最終驗證
    console.log('=== 最終分頁符驗證 ===');
    console.log('實際 rowBreaks:', (worksheet as any).rowBreaks);
    console.log('實際 colBreaks:', (worksheet as any).colBreaks);
    console.log('model rowBreaks:', (worksheet as any).model?.rowBreaks);
    console.log('model colBreaks:', (worksheet as any).model?.colBreaks);
    console.log('=== 分頁符驗證完成 ===');
    
  } catch (error) {
    console.error('❌ 強制設定分頁符失敗:', error);
  }
  
  if (template.printSettings) {
    try {
      // 只保留部分範本設定，其他使用我們的自訂設定
      const customSettings = {
        orientation: 'landscape',
        paperSize: 9,
        printArea: 'A1:AE140',
        fitToPage: false,
        fitToWidth: 1, // 1頁寬
        fitToHeight: 0,
        margins: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          header: 0,
          footer: 0
        }
      };
      
      worksheet.pageSetup = {
        ...template.printSettings,
        ...customSettings // 覆蓋範本設定
      };
      console.log('Worker: 自訂列印設定應用成功');
    } catch (error: any) {
      console.warn('應用列印設定失敗:', error);
    }
  } else {
    // 如果沒有範本設定，使用預設設定
    worksheet.pageSetup = {
      orientation: 'portrait',
      paperSize: 9,
      printArea: 'A1:AE140',
      fitToPage: false,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        header: 0,
        footer: 0
      }
    };
  }
  
  console.log(`Worker: === 換片記錄範本格式應用完成: ${patient.中文姓氏}${patient.中文名字} ===`);
};

// 創建換片記錄工作簿
const createDiaperChangeWorkbook = async (
  sheetsConfig: SheetConfig[]
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();

  for (const config of sheetsConfig) {
    console.log(`Worker: 創建換片記錄工作表: ${config.name}`);
    
    // 確保工作表名稱符合 Excel 限制
    let sheetName = config.name;
    if (sheetName.length > 31) {
      sheetName = sheetName.substring(0, 31);
    }
    
    const worksheet = workbook.addWorksheet(sheetName);
    applyDiaperChangeTemplateFormat(worksheet, config.template, config.patient, config.yearMonth);
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
  console.log(`Worker: 換片記錄 Excel 檔案 ${filename} 保存成功`);
};

// 匯出換片記錄到 Excel
export const exportDiaperChangeToExcel = async (
  selectedPatients: any[],
  template: any,
  yearMonth: string,
  filename?: string
): Promise<void> => {
  try {
    if (!template.extracted_format) {
      throw new Error('範本格式無效');
    }

    const extractedFormat = template.extracted_format;
    
    // 構建工作表配置
    const sheetsConfig: SheetConfig[] = selectedPatients.map(patient => ({
      name: `${patient.床號}${patient.中文姓氏}${patient.中文名字}`,
      template: extractedFormat,
      patient: {
        床號: patient.床號,
        中文姓氏: patient.中文姓氏,
        中文名字: patient.中文名字,
        性別: patient.性別,
        出生日期: patient.出生日期,
        身份證號碼: patient.身份證號碼,
        護理等級: patient.護理等級,
        入住類型: patient.入住類型,
        入住日期: patient.入住日期,
        社會福利: patient.社會福利
      },
      yearMonth: yearMonth
    }));
    
    if (sheetsConfig.length === 0) {
      throw new Error('沒有可匯出的院友資料');
    }
    
    // 決定檔案名稱
    const templateBaseName = template.original_name.replace(/\.(xlsx|xls)$/i, '');
    const finalFilename = filename || 
      (sheetsConfig.length === 1 
        ? `${sheetsConfig[0].patient.床號}_${sheetsConfig[0].patient.中文姓氏}${sheetsConfig[0].patient.中文名字}_${templateBaseName}_${yearMonth}.xlsx`
        : `${templateBaseName}_${yearMonth}(${sheetsConfig.length}名院友).xlsx`);
    
    // 創建工作簿並匯出
    const workbook = await createDiaperChangeWorkbook(sheetsConfig);
    await saveExcelFile(workbook, finalFilename);
    
    console.log(`Worker: 換片記錄匯出完成: ${finalFilename}`);
    
  } catch (error: any) {
    console.error('匯出換片記錄失敗:', error);
    throw error;
  }
};