import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';

interface BedLayoutExportData {
  床號: string;
  床位名稱?: string;
  院友姓名?: string;
  性別?: string;
  年齡?: number;
  護理等級?: string;
  入住類型?: string;
  入住日期?: string;
  身份證號碼?: string;
  藥物敏感?: string[];
  不良藥物反應?: string[];
  備註?: string;
  佔用狀態: '已佔用' | '空置';
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
  station: {
    id: string;
    name: string;
    description?: string;
  };
  bedData: BedLayoutExportData[];
}

// 從範本文件提取床位表格式
const extractBedLayoutTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
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

  console.log(`檢測到床位表工作表範圍: ${maxCol} 欄 x ${maxRow} 行`);

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

  console.log(`床位表範本格式提取完成: ${extractedCellCount} 個儲存格, ${extractedTemplate.images.length} 個圖片`);
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

// 應用床位表範本格式並填入資料
const applyBedLayoutTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  station: {
    id: string;
    name: string;
    description?: string;
  },
  bedData: BedLayoutExportData[]
): void => {
  console.log(`=== 開始應用床位表範本格式: ${station.name} ===`);
  
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
      // Apply value (but don't overwrite station data placeholders)
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

  // Step 7: 使用具體的床位映射填充院友姓名
  console.log('使用具體床位映射填充院友姓名...');
  
  // 床位到儲存格的映射表
  const bedToExcelMapping: { [bedNumber: string]: string } = {
    'C202-1': 'C3', 'C202-2': 'C4',
    'C205-1': 'F3',
    'C206-1': 'I3', 'C206-2': 'I4', 'C206-3': 'I5',
    'C208-1': 'L3', 'C208-2': 'L4', 'C208-3': 'L5', 'C208-4': 'L6',
    'C209-1': 'O3', 'C209-2': 'O4',
    'C210-1': 'R3', 'C210-2': 'R4',
    'C211-1': 'C8', 'C211-2': 'C9',
    'C212-1': 'F8', 'C212-2': 'F9',
    'C213-1': 'I8', 'C213-2': 'I9',
    'C215-1': 'L8', 'C215-2': 'L9',
    'C216-1': 'O8', 'C216-2': 'O9',
    'C217-1': 'R8', 'C217-2': 'R9',
    'C218-1': 'C11', 'C218-2': 'C12',
    'C219-1': 'F11', 'C219-2': 'F12', 'C219-3': 'F13', 'C219-4': 'F14', 'C219-5': 'F15',
    'C220-1': 'I11', 'C220-2': 'I12',
    'C221-1': 'L11', 'C221-2': 'L12', 'C221-3': 'L13', 'C221-4': 'L14', 'C221-5': 'L15',
    'C222-1': 'O11', 'C222-2': 'O12',
    'C223-1': 'R11', 'C223-2': 'R12',
    'C225-1': 'C17', 'C225-2': 'C18',
    'C226-1': 'F17', 'C226-2': 'F18', 'C226-3': 'F19',
    'C227-1': 'I17',
    'C228-1': 'L17',
    'C229-1': 'O17', 'C229-2': 'O18',
    'C230-1': 'R17', 'C230-2': 'R18',
    'C231-1': 'C21', 'C231-2': 'C22',
    'C232-1': 'F21', 'C232-2': 'F22',
    'C233-1': 'I21', 'C233-2': 'I22', 'C233-3': 'I23', 'C233-4': 'I24',
    'C235-1': 'L21', 'C235-2': 'L22', 'C235-3': 'L23', 'C235-4': 'L24',
    'C236-1': 'O21', 'C236-2': 'O22', 'C236-3': 'O23', 'C236-4': 'O24',
    'C237-1': 'R21', 'C237-2': 'R22', 'C237-3': 'R23', 'C237-4': 'R24'
  };
  
  // 填充院友姓名到對應的儲存格
  bedData.forEach(bed => {
    const targetCell = bedToExcelMapping[bed.床號];
    if (targetCell && bed.院友姓名) {
      try {
        worksheet.getCell(targetCell).value = bed.院友姓名;
        console.log(`填入 ${targetCell}: ${bed.床號} = ${bed.院友姓名}`);
      } catch (error) {
        console.warn(`填入 ${targetCell} 失敗:`, error);
      }
    } else if (targetCell) {
      // 空置床位，填入空字串
      try {
        worksheet.getCell(targetCell).value = '';
        console.log(`填入 ${targetCell}: ${bed.床號} = 空置`);
      } catch (error) {
        console.warn(`填入 ${targetCell} 失敗:`, error);
      }
    } else {
      console.warn(`床號 ${bed.床號} 沒有對應的儲存格映射`);
    }
  });
  
  // Step 8: 填充統計資料（僅針對C站）
  if (station.name === 'C站') {
    console.log('填充C站統計資料...');
    
    // 計算統計數據
    const occupiedBeds = bedData.filter(bed => bed.院友姓名);
    const availableBeds = bedData.filter(bed => !bed.院友姓名);
    const malePatients = occupiedBeds.filter(bed => bed.性別 === '男');
    const femalePatients = occupiedBeds.filter(bed => bed.性別 === '女');
    
    // 按護理等級分類
    const maleFullCare = occupiedBeds.filter(bed => bed.性別 === '男' && bed.護理等級 === '全護理');
    const femaleFullCare = occupiedBeds.filter(bed => bed.性別 === '女' && bed.護理等級 === '全護理');
    const maleHalfCare = occupiedBeds.filter(bed => bed.性別 === '男' && bed.護理等級 === '半護理');
    const femaleHalfCare = occupiedBeds.filter(bed => bed.性別 === '女' && bed.護理等級 === '半護理');
    
    // 填充統計資料到指定儲存格
    const statisticsMappings = [
      { cell: 'D26', value: maleHalfCare.length, label: 'C站半護理男性人數' },
      { cell: 'F26', value: femaleHalfCare.length, label: 'C站半護理女性人數' },
      { cell: 'D27', value: maleFullCare.length, label: 'C站全護理男性人數' },
      { cell: 'F27', value: femaleFullCare.length, label: 'C站全護理女性人數' },
      { cell: 'L26', value: bedData.length, label: 'C站總床位數' },
      { cell: 'O26', value: occupiedBeds.length, label: 'C站在住人數' },
      { cell: 'L27', value: malePatients.length, label: 'C站男性人數' },
      { cell: 'O27', value: femalePatients.length, label: 'C站女性人數' },
      { cell: 'R26', value: availableBeds.length, label: 'C站可用床位' }
    ];
    
    statisticsMappings.forEach(mapping => {
      try {
        worksheet.getCell(mapping.cell).value = mapping.value;
        console.log(`填入統計 ${mapping.cell}: ${mapping.label} = ${mapping.value}`);
      } catch (error) {
        console.warn(`填入統計 ${mapping.cell} 失敗:`, error);
      }
    });
    
    // 填充列印日期 (Q28)
    try {
      const today = new Date();
      const printDate = `${today.getFullYear()}年${(today.getMonth() + 1).toString().padStart(2, '0')}月${today.getDate().toString().padStart(2, '0')}日`;
      worksheet.getCell('Q28').value = printDate;
      console.log(`填入列印日期 Q28: ${printDate}`);
    } catch (error) {
      console.warn('填入列印日期失敗:', error);
    }
  }

  // Step 9: Apply print settings
  if (template.printSettings) {
    try {
      worksheet.pageSetup = { ...template.printSettings };
      console.log('列印設定應用成功');
    } catch (error) {
      console.warn('應用列印設定失敗:', error);
    }
  }
  
  console.log(`=== 床位表範本格式應用完成: ${station.name} ===`);
};

// 創建床位表工作簿
const createBedLayoutWorkbook = async (
  sheetsConfig: SheetConfig[]
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();

  for (const config of sheetsConfig) {
    console.log(`創建床位表工作表: ${config.name}`);
    
    // 確保工作表名稱符合 Excel 限制
    let sheetName = config.name;
    if (sheetName.length > 31) {
      sheetName = sheetName.substring(0, 31);
    }
    
    const worksheet = workbook.addWorksheet(sheetName);
    applyBedLayoutTemplateFormat(worksheet, config.template, config.station, config.bedData);
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
  console.log(`床位表 Excel 檔案 ${filename} 保存成功`);
};

// 匯出床位表到 Excel
export const exportBedLayoutToExcel = async (
  selectedStations: any[],
  allBeds: any[],
  allPatients: any[],
  filename?: string
): Promise<void> => {
  try {
    // 從 Supabase 獲取入住排版範本
    const templatesData = await getTemplatesMetadata();
    const bedLayoutTemplate = templatesData.find(t => t.type === 'bed-layout');
    
    if (!bedLayoutTemplate || !bedLayoutTemplate.extracted_format) {
      // 如果沒有範本，使用簡單匯出方式
      await exportBedLayoutToExcelSimple(selectedStations, allBeds, allPatients, filename);
      return;
    }

    const extractedFormat = bedLayoutTemplate.extracted_format;
    
    // 構建工作表配置
    const sheetsConfig: SheetConfig[] = [];
    
    selectedStations.forEach(station => {
      // 獲取該站點的所有床位
      const stationBeds = allBeds.filter(bed => bed.station_id === station.id);
      
      // 準備床位資料
      const bedData: BedLayoutExportData[] = stationBeds.map(bed => {
        // 找到床位上的院友
        const patient = allPatients.find(p => p.bed_id === bed.id && p.在住狀態 === '在住');
        
        return {
          床號: bed.bed_number,
          床位名稱: bed.bed_name,
          院友姓名: patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
          性別: patient?.性別,
          年齡: patient?.出生日期 ? calculateAge(patient.出生日期) : undefined,
          護理等級: patient?.護理等級,
          入住類型: patient?.入住類型,
          入住日期: patient?.入住日期 ? new Date(patient.入住日期).toLocaleDateString('zh-TW') : '',
          身份證號碼: patient?.身份證號碼,
          藥物敏感: patient?.藥物敏感,
          不良藥物反應: patient?.不良藥物反應,
          備註: '',
          佔用狀態: patient ? '已佔用' : '空置'
        };
      });
      
      // 按床號排序
      bedData.sort((a, b) => a.床號.localeCompare(b.床號, 'zh-Hant', { numeric: true }));
      
      sheetsConfig.push({
        name: `${station.name}床位表`,
        template: extractedFormat,
        station: station,
        bedData: bedData
      });
    });
    
    if (sheetsConfig.length === 0) {
      throw new Error('沒有可匯出的床位資料');
    }
    
    // 決定檔案名稱
    const finalFilename = filename || 
      (sheetsConfig.length === 1 
        ? `${sheetsConfig[0].station.name}_床位表.xlsx`
        : `床位表(${sheetsConfig.length}個站點).xlsx`);
    
    // 創建工作簿並匯出
    const workbook = await createBedLayoutWorkbook(sheetsConfig);
    await saveExcelFile(workbook, finalFilename);
    
    console.log(`床位表匯出完成: ${finalFilename}`);
    
  } catch (error) {
    console.error('匯出床位表失敗:', error);
    throw error;
  }
};

// 簡單的床位表匯出（當沒有範本時使用）
const exportBedLayoutToExcelSimple = async (
  selectedStations: any[],
  allBeds: any[],
  allPatients: any[],
  filename?: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();

  selectedStations.forEach(station => {
    // 獲取該站點的所有床位
    const stationBeds = allBeds.filter(bed => bed.station_id === station.id);
    
    const sheetName = `${station.name}床位表`;
    const worksheet = workbook.addWorksheet(sheetName);

    // 設定欄寬
    worksheet.columns = [
      { width: 10 }, // 床號
      { width: 12 }, // 床位名稱
      { width: 15 }, // 院友姓名
      { width: 6 },  // 性別
      { width: 8 },  // 年齡
      { width: 12 }, // 護理等級
      { width: 12 }, // 入住類型
      { width: 12 }, // 入住日期
      { width: 15 }, // 身份證號碼
      { width: 15 }, // 藥物敏感
      { width: 15 }, // 不良藥物反應
      { width: 10 }, // 佔用狀態
      { width: 20 }  // 備註
    ];

    // 標題
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${station.name} 床位表`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F7FF' }
    };

    // 站點資訊
    worksheet.getCell('A3').value = `站點名稱: ${station.name}`;
    if (station.description) {
      worksheet.getCell('E3').value = `描述: ${station.description}`;
    }
    worksheet.getCell('I3').value = `生成日期: ${new Date().toLocaleDateString('zh-TW')}`;

    // 表頭
    const headers = [
      '床號', '床位名稱', '院友姓名', '性別', '年齡', '護理等級', 
      '入住類型', '入住日期', '身份證號碼', '藥物敏感', '不良藥物反應', '佔用狀態', '備註'
    ];

    const headerRow = worksheet.getRow(5);
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
    const sortedBeds = stationBeds.sort((a, b) => 
      a.bed_number.localeCompare(b.bed_number, 'zh-Hant', { numeric: true })
    );

    sortedBeds.forEach((bed, index) => {
      const rowIndex = 6 + index;
      const row = worksheet.getRow(rowIndex);
      
      // 找到床位上的院友
      const patient = allPatients.find(p => p.bed_id === bed.id && p.在住狀態 === '在住');
      
      const values = [
        bed.bed_number,
        bed.bed_name || bed.bed_number,
        patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
        patient?.性別 || '',
        patient?.出生日期 ? `${calculateAge(patient.出生日期)}歲` : '',
        patient?.護理等級 || '',
        patient?.入住類型 || '',
        patient?.入住日期 ? new Date(patient.入住日期).toLocaleDateString('zh-TW') : '',
        patient?.身份證號碼 || '',
        Array.isArray(patient?.藥物敏感) ? (patient.藥物敏感.length ? patient.藥物敏感.join(', ') : '無') : (patient?.藥物敏感 || '無'),
        Array.isArray(patient?.不良藥物反應) ? (patient.不良藥物反應.length ? patient.不良藥物反應.join(', ') : '無') : (patient?.不良藥物反應 || '無'),
        patient ? '已佔用' : '空置',
        ''
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
        
        // 空置床位使用不同顏色
        if (!patient) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF0F0' } // 淺紅色
          };
        } else if (index % 2 === 1) {
          // 已佔用床位的交替行顏色
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' }
          };
        }
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const finalFilename = filename || `床位表_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, finalFilename);
  
  console.log(`床位表 Excel 檔案 ${finalFilename} 匯出成功`);
};