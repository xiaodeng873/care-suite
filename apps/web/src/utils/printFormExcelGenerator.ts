import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';

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
    英文姓氏?: string;
    英文名字?: string;
    英文姓名?: string;
    性別: string;
    出生日期: string;
    身份證號碼: string;
    護理等級?: string;
    入住類型?: string;
    入住日期?: string;
    社會福利?: any;
  };
}

// 從範本文件提取完整格式
export const extractPrintFormTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
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

  // 動態檢測工作表範圍
  const dimension = worksheet.dimension;
  const maxCol = dimension?.right || 50;
  const maxRow = dimension?.bottom || 100;

  console.log(`檢測到工作表範圍: ${maxCol} 欄 x ${maxRow} 行`);

  // Extract column widths
  for (let col = 1; col <= maxCol; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  // Extract row heights
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
  let printFormExtractedCellCount = 0;
  
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
        printFormExtractedCellCount++;
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

  console.log(`範本格式提取完成: ${printFormExtractedCellCount} 個儲存格, ${extractedTemplate.images.length} 個圖片`);
  return extractedTemplate;
};

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

// 應用範本格式並填入院友資料
const applyPrintFormTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: {
    床號: string;
    中文姓氏: string;
    中文名字: string;
    英文姓氏?: string;
    英文名字?: string;
    英文姓名?: string;
    性別: string;
    出生日期: string;
    身份證號碼: string;
    護理等級?: string;
    入住類型?: string;
    入住日期?: string;
    社會福利?: any;
  }
): void => {
  console.log(`=== 開始應用列印表格範本格式: ${patient.中文姓氏}${patient.中文名字} ===`);
  
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

  // Step 6: Apply page breaks
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

  // Step 7: Fill patient data in common locations
  console.log('填充院友資料...');
  
  // 嘗試在常見位置填入院友資料
  const patientDataMappings = [
    // 常見的院友資料位置
    { cell: 'B3', value: `${patient.中文姓氏}${patient.中文名字}`, label: '中文姓名' },
    { cell: 'D3', value: patient.床號, label: '床號' },
    { cell: 'F3', value: patient.性別, label: '性別' },
    { cell: 'H3', value: patient.身份證號碼, label: '身份證號碼' },
    { cell: 'J3', value: patient.出生日期 ? `${calculateAge(patient.出生日期)}歲` : '', label: '年齡' },
    
    // 其他可能的位置
    { cell: 'B4', value: `${patient.中文姓氏}${patient.中文名字}`, label: '中文姓名' },
    { cell: 'D4', value: patient.床號, label: '床號' },
    { cell: 'F4', value: patient.性別, label: '性別' },
    { cell: 'H4', value: patient.身份證號碼, label: '身份證號碼' },
    
    // 英文姓名
    { cell: 'B5', value: patient.英文姓氏&& patient.英文名字 ? `${patient.英文姓氏}, ${patient.英文名字}` : (patient.英文姓名 || ''), label: '英文姓名' },
    
    // 護理等級和入住類型
    { cell: 'B6', value: patient.護理等級 || '', label: '護理等級' },
    { cell: 'D6', value: patient.入住類型 || '', label: '入住類型' },
    { cell: 'F6', value: patient.入住日期 ? new Date(patient.入住日期).toLocaleDateString('zh-TW') : '', label: '入住日期' },
    
    // 社會福利
    { cell: 'B7', value: patient.社會福利?.type || '', label: '社會福利' },
  ];

  patientDataMappings.forEach(mapping => {
    try {
      const cell = worksheet.getCell(mapping.cell);
      // 只有當儲存格為空或包含佔位符時才填入資料
      const currentValue = cell.value;
      if (!currentValue || 
          (typeof currentValue === 'string' && 
           (currentValue.includes('姓名') || currentValue.includes('床號') || 
            currentValue.includes('性別') || currentValue.includes('年齡') ||
            currentValue === '' || currentValue.trim() === ''))) {
        cell.value = mapping.value;
        console.log(`填入 ${mapping.cell}: ${mapping.label} = ${mapping.value}`);
      }
    } catch (error) {
      console.warn(`填入 ${mapping.cell} 失敗:`, error);
    }
  });

  // Step 8: Apply print settings
  if (template.printSettings) {
    try {
      worksheet.pageSetup = { ...template.printSettings };
      console.log('列印設定應用成功');
    } catch (error) {
      console.warn('應用列印設定失敗:', error);
    }
  }
  
  console.log(`=== 列印表格範本格式應用完成: ${patient.中文姓氏}${patient.中文名字} ===`);
};

// 創建列印表格工作簿
const createPrintFormWorkbook = async (
  sheetsConfig: SheetConfig[]
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();

  for (const config of sheetsConfig) {
    console.log(`創建列印表格工作表: ${config.name}`);
    
    // 確保工作表名稱符合 Excel 限制
    let sheetName = config.name;
    if (sheetName.length > 31) {
      sheetName = sheetName.substring(0, 31);
    }
    
    const worksheet = workbook.addWorksheet(sheetName);
    applyPrintFormTemplateFormat(worksheet, config.template, config.patient);
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
  console.log(`列印表格 Excel 檔案 ${filename} 保存成功`);
};

// 匯出列印表格到 Excel
export const exportPrintFormsToExcel = async (
  selectedPatients: any[],
  template: any,
  filename?: string
): Promise<void> => {
  try {
    if (!template.extracted_format) {
      throw new Error('範本格式無效');
    }

    const extractedFormat = template.extracted_format;
    
    // 構建工作表配置
    const sheetsConfig: SheetConfig[] = selectedPatients.map(patient => ({
      name: `${patient.床號}_${patient.中文姓氏}${patient.中文名字}`,
      template: extractedFormat,
      patient: {
        床號: patient.床號,
        中文姓氏: patient.中文姓氏,
        中文名字: patient.中文名字,
        英文姓氏: patient.英文姓氏,
        英文名字: patient.英文名字,
        英文姓名: patient.英文姓名,
        性別: patient.性別,
        出生日期: patient.出生日期,
        身份證號碼: patient.身份證號碼,
        護理等級: patient.護理等級,
        入住類型: patient.入住類型,
        入住日期: patient.入住日期,
        社會福利: patient.社會福利
      }
    }));
    
    if (sheetsConfig.length === 0) {
      throw new Error('沒有可匯出的院友資料');
    }
    
    // 決定檔案名稱
    const templateBaseName = template.original_name.replace(/\.(xlsx|xls)$/i, '');
    const finalFilename = filename || 
      (sheetsConfig.length === 1 
        ? `${sheetsConfig[0].patient.床號}_${sheetsConfig[0].patient.中文姓氏}${sheetsConfig[0].patient.中文名字}_${templateBaseName}.xlsx`
        : `${templateBaseName}(${sheetsConfig.length}名院友).xlsx`);
    
    // 創建工作簿並匯出
    const workbook = await createPrintFormWorkbook(sheetsConfig);
    await saveExcelFile(workbook, finalFilename);
    
    console.log(`列印表格匯出完成: ${finalFilename}`);
    
  } catch (error) {
    console.error('匯出列印表格失敗:', error);
    throw error;
  }
};