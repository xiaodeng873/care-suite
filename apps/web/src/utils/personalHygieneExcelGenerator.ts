import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';

interface PersonalHygieneExportData {
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
  months: {
    firstMonth: string;
    secondMonth: string;
  };
}

// 計算年齡
const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

// 從範本文件提取完整格式
const extractPersonalHygieneTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
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
    cellData: {},
    images: [],
    pageBreaks: {
      rowBreaks: [],
      colBreaks: []
    }
  };

  // 動態檢測工作表範圍，但最少使用 A1:AL40
  const dimension = worksheet.dimension;
  const maxCol = Math.max(dimension?.right || 38, 38); // AL = 38
  const maxRow = Math.max(dimension?.bottom || 40, 40);

  console.log(`檢測到個人衛生記錄工作表範圍: ${maxCol} 欄 x ${maxRow} 行`);

  // Extract column widths (A to AL = 1 to 38)
  for (let col = 1; col <= maxCol; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  // Extract row heights (1 to maxRow)
  for (let row = 1; row <= maxRow; row++) {
    let height = worksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    extractedTemplate.rowHeights.push(Math.round(height * 100) / 100);
  }

  // Extract merged cells
  if (worksheet.model && worksheet.model.merges) {
    worksheet.model.merges.forEach(merge => {
      extractedTemplate.mergedCells.push(merge);
    });
    console.log(`提取合併儲存格: ${extractedTemplate.mergedCells.length} 個`);
  }
  
  // Extract print settings
  if (worksheet.pageSetup) {
    extractedTemplate.printSettings = { ...worksheet.pageSetup };
    console.log(`提取列印設定:`, JSON.stringify(extractedTemplate.printSettings));
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
    
    console.log('分頁符統計:', {
      rowBreaks: extractedTemplate.pageBreaks!.rowBreaks.length,
      colBreaks: extractedTemplate.pageBreaks!.colBreaks.length
    });
    
  } catch (error) {
    console.error('提取分頁符失敗:', error);
    extractedTemplate.pageBreaks = { rowBreaks: [], colBreaks: [] };
  }

  // Extract cell data for entire worksheet
  console.log(`開始提取儲存格資料 (1-${maxRow} 行, 1-${maxCol} 欄)...`);
  let extractedCellCount = 0;
  
  for (let row = 1; row <= maxRow; row++) {
    for (let col = 1; col <= maxCol; col++) {
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
        extractedCellCount++;
      }
    }
  }

  // Extract images
  console.log('提取圖片...');
  try {
    const images = (worksheet as any).getImages ? (worksheet as any).getImages() : [];
    if (!Array.isArray(images)) {
      console.warn('getImages 未返回陣列，初始化為空陣列');
      extractedTemplate.images = [];
    } else {
      images.forEach((img: any, index: number) => {
        if (img.imageId && img.range) {
          const media = workbook.model.media.find((m: any) => m.index === img.imageId);
          if (media && media.buffer) {
            const base64 = Buffer.from(media.buffer).toString('base64');
            extractedTemplate.images.push({
              imageId: img.imageId,
              base64: `data:image/${media.extension};base64,${base64}`,
              extension: media.extension,
              range: img.range
            });
            console.log(`提取圖片: ID=${img.imageId}, 範圍=${img.range}, 格式=${media.extension}`);
          }
        }
      });
    }
  } catch (error) {
    console.error('提取圖片失敗:', error);
    extractedTemplate.images = [];
  }

  console.log(`個人衛生記錄範本格式提取完成: ${extractedCellCount} 個儲存格, ${extractedTemplate.images.length} 個圖片`);
  return extractedTemplate;
};

// 應用個人衛生記錄範本格式並填入院友資料
const applyPersonalHygieneTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
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
  },
  months: {
    firstMonth: string;
    secondMonth: string;
  }
): void => {
  console.log(`=== 開始應用個人衛生記錄範本格式: ${patient.中文姓氏}${patient.中文名字} ===`);
  
  // Step 1: Set column widths
  template.columnWidths.forEach((width, idx) => {
    worksheet.getColumn(idx + 1).width = width;
  });
  console.log(`設定了 ${template.columnWidths.length} 個欄寬`);

  // Step 2: Set row heights
  template.rowHeights.forEach((height, idx) => {
    worksheet.getRow(idx + 1).height = height;
  });
  console.log(`設定了 ${template.rowHeights.length} 個列高`);

  // Step 3: Apply cell data (value, font, alignment, border, fill)
  let appliedCells = 0;
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const cell = worksheet.getCell(address);
    
    try {
      // Apply value (but don't overwrite patient data placeholders)
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
      
      appliedCells++;
    } catch (error) {
      console.warn(`應用儲存格 ${address} 樣式失敗:`, error);
    }
  });
  console.log(`成功應用了 ${appliedCells} 個儲存格的樣式`);

  // Step 4: Merge cells
  let mergedCount = 0;
  template.mergedCells.forEach(merge => {
    try {
      worksheet.mergeCells(merge);
      mergedCount++;
    } catch (e) {
      console.warn(`合併儲存格失敗: ${merge}`, e);
    }
  });
  console.log(`成功合併了 ${mergedCount} 個儲存格範圍`);

  // Step 5: Apply images
  console.log('應用圖片...');
  if (Array.isArray(template.images)) {
    template.images.forEach(img => {
      try {
        const imageId = worksheet.workbook.addImage({
          base64: img.base64,
          extension: img.extension as 'png' | 'jpeg' | 'gif'
        });
        worksheet.addImage(imageId, img.range);
        console.log(`應用圖片: ID=${img.imageId}, 範圍=${img.range}, 格式=${img.extension}`);
      } catch (error) {
        console.error(`應用圖片失敗 (範圍=${img.range}):`, error);
      }
    });
  }

  // Step 6: Fill patient data according to requirements
  console.log('填充院友資料...');
  
  // 解析月份資料
  const firstMonthMatch = months.firstMonth.match(/(\d{4})年(\d{2})月/);
  const secondMonthMatch = months.secondMonth.match(/(\d{4})年(\d{2})月/);
  
  if (firstMonthMatch) {
    // A2: 第一個年份 (YYYY年)
    worksheet.getCell('A2').value = `${firstMonthMatch[1]}年`;
    console.log(`填入 A2: 第一個年份 = ${firstMonthMatch[1]}年`);
    
    // A3: 第一個月份 (XX月)
    worksheet.getCell('A3').value = `${firstMonthMatch[2]}月`;
    console.log(`填入 A3: 第一個月份 = ${firstMonthMatch[2]}月`);
  }
  
  if (secondMonthMatch) {
    // T2: 第二個年份 (YYYY年)
    worksheet.getCell('T2').value = `${secondMonthMatch[1]}年`;
    console.log(`填入 T2: 第二個年份 = ${secondMonthMatch[1]}年`);
    
    // T3: 第二個月份 (XX月)
    worksheet.getCell('T3').value = `${secondMonthMatch[2]}月`;
    console.log(`填入 T3: 第二個月份 = ${secondMonthMatch[2]}月`);
  }
  
  // D4: 院友中文姓名
  worksheet.getCell('D4').value = `${patient.中文姓氏}${patient.中文名字}`;
  console.log(`填入 D4: 院友中文姓名 = ${patient.中文姓氏}${patient.中文名字}`);
  
  // I4: 年齡
  if (patient.出生日期) {
    const age = calculateAge(patient.出生日期);
    worksheet.getCell('I4').value = `${age}歲`;
    console.log(`填入 I4: 年齡 = ${age}歲`);
  }
  
  // N4: 性別
  worksheet.getCell('N4').value = patient.性別;
  console.log(`填入 N4: 性別 = ${patient.性別}`);
  
  // R4: 床號
  worksheet.getCell('R4').value = patient.床號;
  console.log(`填入 R4: 床號 = ${patient.床號}`);

  // Step 7: Apply print settings and page breaks
  console.log('應用列印設定和分頁符...');
  
  try {
    // 完全清除所有現有分頁符
    delete (worksheet as any).rowBreaks;
    delete (worksheet as any).colBreaks;
    if ((worksheet as any).model) {
      delete (worksheet as any).model.rowBreaks;
      delete (worksheet as any).model.colBreaks;
    }
    
    // 設定頁面配置
    worksheet.pageSetup = {
      orientation: 'portrait',
      paperSize: 9, // A4
      printArea: 'A1:AL40',
      fitToPage: false,
      fitToWidth: 0,
      fitToHeight: 0,
      scale: 82, // 設定縮放比例為82%
      horizontalCentered: true, // 水平置中
      verticalCentered: true,   // 垂直置中
      margins: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        header: 0,
        footer: 0
      }
    };
    
    // 設定分頁符：在S與T欄之間（S=19欄）
    (worksheet as any).colBreaks = [{ id: 19, max: 1048575, man: true }];
    (worksheet as any).rowBreaks = []; // 不設定行分頁符
    
    // 確保 model 也有正確的分頁符
    if (!(worksheet as any).model) {
      (worksheet as any).model = {};
    }
    (worksheet as any).model.colBreaks = [19];
    (worksheet as any).model.rowBreaks = [];
    
    console.log('✅ 個人衛生記錄分頁符設定完成：在S與T欄之間分頁');
    
  } catch (error) {
    console.error('❌ 設定分頁符失敗:', error);
  }
  
  console.log(`=== 個人衛生記錄範本格式應用完成: ${patient.中文姓氏}${patient.中文名字} ===`);
};

// 創建個人衛生記錄工作簿
const createPersonalHygieneWorkbook = async (
  sheetsConfig: SheetConfig[]
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();

  for (const config of sheetsConfig) {
    console.log(`創建個人衛生記錄工作表: ${config.name}`);
    
    // 確保工作表名稱符合 Excel 限制
    let sheetName = config.name;
    if (sheetName.length > 31) {
      sheetName = sheetName.substring(0, 31);
    }
    
    const worksheet = workbook.addWorksheet(sheetName);
    applyPersonalHygieneTemplateFormat(worksheet, config.template, config.patient, config.months);
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
  console.log(`個人衛生記錄 Excel 檔案 ${filename} 保存成功`);
};

// 匯出個人衛生記錄到 Excel
export const exportPersonalHygieneToExcel = async (
  selectedPatients: any[],
  template: any,
  months: { firstMonth: string; secondMonth: string },
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
      months: months
    }));
    
    if (sheetsConfig.length === 0) {
      throw new Error('沒有可匯出的院友資料');
    }
    
    // 決定檔案名稱
    const templateBaseName = template.original_name.replace(/\.(xlsx|xls)$/i, '');
    const finalFilename = filename || 
      (sheetsConfig.length === 1 
        ? `${sheetsConfig[0].patient.床號}_${sheetsConfig[0].patient.中文姓氏}${sheetsConfig[0].patient.中文名字}_${templateBaseName}_${months.firstMonth}_${months.secondMonth}.xlsx`
        : `${templateBaseName}_${months.firstMonth}_${months.secondMonth}(${sheetsConfig.length}名院友).xlsx`);
    
    // 創建工作簿並匯出
    const workbook = await createPersonalHygieneWorkbook(sheetsConfig);
    await saveExcelFile(workbook, finalFilename);
    
    console.log(`個人衛生記錄匯出完成: ${finalFilename}`);
    
  } catch (error) {
    console.error('匯出個人衛生記錄失敗:', error);
    throw error;
  }
};