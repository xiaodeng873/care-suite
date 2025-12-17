import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';
import type { PatientRestraintAssessment } from '../context/PatientContext';

interface RestraintObservationExportData {
  id: string;
  patient_id: number;
  doctor_signature_date?: string;
  next_due_date?: string;
  risk_factors: any;
  alternatives: any;
  suggested_restraints: any;
  other_restraint_notes?: string;
  created_at: string;
  updated_at: string;
  院友: {
    床號: string;
    中文姓氏: string;
    中文名字: string;
    性別: string;
    出生日期: string;
    身份證號碼: string;
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
  };
  assessment: RestraintObservationExportData;
  startDate: string;
  endDate: string;
}

// 從範本文件提取約束物品觀察表格式
export const extractRestraintObservationTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
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
    cellData: {},
    pageBreaks: {
      rowBreaks: [],
      colBreaks: []
    }
  };

  // Extract column widths (A to AL = 1 to 38)
  for (let col = 1; col <= 38; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  // Extract row heights (1 to 108)
  for (let row = 1; row <= 108; row++) {
    let height = worksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    extractedTemplate.rowHeights.push(Math.round(height * 100) / 100);
  }

  // Extract merged cells
  if (worksheet.model && worksheet.model.merges) {
    worksheet.model.merges.forEach(merge => {
      // Only include merges within A1:AL108
      const rowMatch = merge.match(/(\d+)/g);
      if (rowMatch) {
        const maxRow = Math.max(...rowMatch.map(r => parseInt(r)));
        if (maxRow <= 108) {
          extractedTemplate.mergedCells.push(merge);
        }
      } else {
        // If no row numbers found, include the merge (might be column-only merge)
        extractedTemplate.mergedCells.push(merge);
      }
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
    // 使用更直接的方法提取分頁符
    const pageBreaks = {
      rowBreaks: [] as number[],
      colBreaks: [] as number[]
    };
    
    // 從多個來源提取分頁符
    // 完全忽略範本中的所有分頁符，只設定我們需要的固定分頁符
    console.log('完全忽略範本分頁符，只設定固定分頁符...');
    
    // 徹底清除所有現有分頁符
    delete (worksheet as any).rowBreaks;
    delete (worksheet as any).colBreaks;
    if ((worksheet as any).model) {
      delete (worksheet as any).model.rowBreaks;
      delete (worksheet as any).model.colBreaks;
    }
    
    // 設定頁面配置，完全禁用自動分頁和適應頁面功能
    worksheet.pageSetup = {
      orientation: 'landscape',
      paperSize: 9, // A4
      printArea: 'A1:AL108',
      fitToPage: false,    // 完全禁用適應頁面
      fitToWidth: 0,       // 禁用適應寬度
      fitToHeight: 0,      // 禁用適應高度
      scale: 100,          // 固定100%縮放
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3
      }
    };
    
    // 只設定我們需要的兩個分頁符：第54行後和第19欄後
    (worksheet as any).rowBreaks = [{ id: 54, max: 16383, man: true }];
    (worksheet as any).colBreaks = [{ id: 19, max: 1048575, man: true }];
    
    // 確保 model 也只有我們指定的分頁符
    if (!(worksheet as any).model) {
      (worksheet as any).model = {};
    }
    (worksheet as any).model.rowBreaks = [54];
    (worksheet as any).model.colBreaks = [19];
    
    console.log('✅ 分頁符強制設定完成：只在第54行後和第19欄後分頁');
    
    // 最終驗證
    console.log('=== 最終分頁符驗證 ===');
    console.log('實際 rowBreaks:', (worksheet as any).rowBreaks);
    console.log('實際 colBreaks:', (worksheet as any).colBreaks);
    console.log('model rowBreaks:', (worksheet as any).model?.rowBreaks);
    console.log('model colBreaks:', (worksheet as any).model?.colBreaks);
    console.log('=== 分頁符驗證完成 ===');
    
  } catch (error) {
    console.error('提取分頁符失敗:', error);
    // 即使提取失敗，也設定我們需要的分頁符
    extractedTemplate.pageBreaks = { 
      rowBreaks: [54], 
      colBreaks: [19] 
    };
  }

  // Extract cell data (A1:AL108)
  console.log('開始提取儲存格資料 (A1:AL108)...');
  extractedCellCount = 0;
  for (let row = 1; row <= 108; row++) {
    for (let col = 1; col <= 38; col++) {
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


  // 診斷：檢查提取的儲存格資料
  console.log('=== 範本提取診斷 ===');
  console.log(`總提取儲存格數: ${extractedCellCount}`);
  
  // 檢查問題區域的儲存格
  const testCells = ['P51', 'Q50', 'R55', 'S60', 'AL108'];
  testCells.forEach(address => {
    if (extractedTemplate.cellData[address]) {
      console.log(`✅ ${address} 存在於範本資料中:`, Object.keys(extractedTemplate.cellData[address]));
    } else {
      console.log(`❌ ${address} 不存在於範本資料中`);
    }
  });
  
  // 統計各欄的儲存格數量
  const columnStats: { [col: string]: number } = {};
  Object.keys(extractedTemplate.cellData).forEach(address => {
    const colMatch = address.match(/^([A-Z]+)/);
    if (colMatch) {
      const col = colMatch[1];
      columnStats[col] = (columnStats[col] || 0) + 1;
    }
  });
  
  console.log('各欄儲存格統計:', columnStats);
  
  // 檢查第 50 行後的儲存格數量
  const rowStats: { [range: string]: number } = {
    '1-49': 0,
    '50-108': 0
  };
  
  Object.keys(extractedTemplate.cellData).forEach(address => {
    const rowMatch = address.match(/(\d+)$/);
    if (rowMatch) {
      const row = parseInt(rowMatch[1]);
      if (row <= 49) {
        rowStats['1-49']++;
      } else {
        rowStats['50-108']++;
      }
    }
  });
  
  console.log('行範圍儲存格統計:', rowStats);
  console.log('=== 範本提取診斷完成 ===');
  console.log(`提取完成: ${extractedCellCount} 個儲存格有格式資料`);
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

// 輔助函數：根據布林值返回勾選符號
const getCheckboxSymbol = (checked: boolean): string => {
  return checked ? '☑' : '☐';
};

// 輔助函數：格式化日期為中文格式
const formatDateToChinese = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年 ${month.toString().padStart(2, '0')}月 ${day.toString().padStart(2, '0')}日`;
};

// 應用約束物品觀察表範本格式並填入資料
const applyRestraintObservationTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: {
    床號: string;
    中文姓氏: string;
    中文名字: string;
    性別: string;
    身份證號碼: string;
    出生日期: string;
    身份證號碼: string;
  },
  assessment: RestraintObservationExportData,
  startDate: string,
  endDate: string
): void => {
  console.log('=== 開始應用約束物品觀察表範本格式 ===');
  
  // 診斷：檢查範本資料完整性
  console.log('=== 應用階段診斷 ===');
  console.log(`範本 cellData 總數: ${Object.keys(template.cellData).length}`);
  
  // 檢查問題區域的儲存格
  const testCells = ['P51', 'Q50', 'R55', 'S60', 'AL108'];
  testCells.forEach(address => {
    if (template.cellData[address]) {
      console.log(`✅ 應用階段 ${address} 存在:`, Object.keys(template.cellData[address]));
    } else {
      console.log(`❌ 應用階段 ${address} 不存在`);
    }
  });
  
  // 統計問題區域的儲存格數量
  let problemAreaCells = 0;
  Object.keys(template.cellData).forEach(address => {
    const colMatch = address.match(/^([A-Z]+)/);
    const rowMatch = address.match(/(\d+)$/);
    if (colMatch && rowMatch) {
      const col = colMatch[1];
      const row = parseInt(rowMatch[1]);
      // P 欄之後且第 50 行之後
      if ((col >= 'P' && row >= 50) || (col > 'P')) {
        problemAreaCells++;
      }
    }
  });
  console.log(`問題區域 (P欄50行後) 儲存格數量: ${problemAreaCells}`);
  console.log('=== 應用階段診斷完成 ===');
  
  // Step 1: Set column widths (A to AL = 1 to 38)
  console.log('第1步: 設置欄寬 (1-38)...');
  template.columnWidths.forEach((width, idx) => {
    if (idx < 38) {
      worksheet.getColumn(idx + 1).width = width;
    }
  });
  console.log(`完成設置 ${Math.min(template.columnWidths.length, 38)} 個欄寬`);

  // Step 2: Set row heights (1 to 108)
  console.log('第2步: 設置列高 (1-108)...');
  template.rowHeights.forEach((height, idx) => {
    if (idx < 108) {
      worksheet.getRow(idx + 1).height = height;
    }
  });
  console.log(`完成設置 ${Math.min(template.rowHeights.length, 108)} 個列高`);

  // Step 2.5: Apply default thin borders to all cells in the range A1:AL108
  console.log('第2.5步: 應用預設網格線 (A1:AL108)...');
  for (let row = 1; row <= 108; row++) {
    for (let col = 1; col <= 38; col++) { // AL is column 38
      const cell = worksheet.getCell(row, col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    }
  }
  console.log('預設網格線應用完成 (4,104 個儲存格)');
  // Step 3: Apply cell data (value, font, alignment, border, fill) for A1:AL108
  console.log('開始應用儲存格格式...');
  let appliedCellCount = 0;
  let problemAreaAppliedCount = 0;
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    // 檢查是否為問題區域
    const colMatch = address.match(/^([A-Z]+)/);
    const rowMatch = address.match(/(\d+)$/);
    let isProblemArea = false;
    if (colMatch && rowMatch) {
      const col = colMatch[1];
      const row = parseInt(rowMatch[1]);
      isProblemArea = (col >= 'P' && row >= 50) || (col > 'P');
    }
    
    const cell = worksheet.getCell(address);
    
    try {
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
    
    appliedCellCount++;
      if (isProblemArea) {
        problemAreaAppliedCount++;
        if (problemAreaAppliedCount <= 5) {
          console.log(`✅ 問題區域儲存格 ${address} 應用成功:`, Object.keys(cellData));
        }
      }
    if (appliedCellCount % 500 === 0) {
      console.log(`應用儲存格格式進度: ${appliedCellCount}`);
    }
    } catch (error) {
      console.error(`❌ 應用儲存格 ${address} 失敗:`, error);
      if (isProblemArea) {
        console.error(`❌ 問題區域儲存格 ${address} 應用失敗:`, error);
      }
    }
  });
  console.log(`完成應用 ${appliedCellCount} 個儲存格的格式`);
  console.log(`問題區域成功應用: ${problemAreaAppliedCount} 個儲存格`);

  // Step 4: Merge cells
  console.log('開始合併儲存格...');
  let mergedCount = 0;
  template.mergedCells.forEach(merge => {
    try {
      worksheet.mergeCells(merge);
      mergedCount++;
    } catch (e) {
      console.warn(`合併儲存格失敗: ${merge}`, e);
    }
  });
  console.log(`完成合併 ${mergedCount} 個儲存格範圍`);

  // Step 5: Fill patient and assessment data
  console.log('第5步: 填充院友和評估資料...');
  
  // A1: 標題與日期範圍
  const titleWithDateRange = `身體約束物品觀察記錄表 ( ${formatDateToChinese(startDate)} 至 ${formatDateToChinese(endDate)} )`;
  worksheet.getCell('A1').value = titleWithDateRange;
  console.log(`設置標題: ${titleWithDateRange}`);
  
  // J3: 院友姓名
  worksheet.getCell('J3').value = `${patient.中文姓氏}${patient.中文名字}`;
  console.log(`設置院友姓名: ${patient.中文姓氏}${patient.中文名字}`);
  
  // R3: 床號
  worksheet.getCell('R3').value = patient.床號;
  console.log(`設置床號: ${patient.床號}`);
  
  // 格式化 C25 的日期 - 使用開始日期的年份和月份
  const startDateObj = new Date(startDate);
  const c25DateFormatted = `${startDateObj.getFullYear()}年${(startDateObj.getMonth() + 1).toString().padStart(2, '0')}月          日`;
  
  // 設定 C25 的日期格式
  worksheet.getCell('C25').value = c25DateFormatted;

  // Step 6: Fill restraint data based on assessment
  console.log('第6步: 填充約束物品評估資料...');
  
  if (assessment.suggested_restraints && typeof assessment.suggested_restraints === 'object') {
    // 約束衣 (rows 6-7)
    const restraintVest = assessment.suggested_restraints['約束衣'] || {};
    worksheet.getCell('B6').value = getCheckboxSymbol(restraintVest.checked || false);
    console.log(`約束衣勾選狀態: ${restraintVest.checked ? '☑' : '☐'}`);
    if (restraintVest.checked) {
      // 使用情況
      worksheet.getCell('D6').value = getCheckboxSymbol(restraintVest.usageConditions === '坐在椅上');
      worksheet.getCell('H6').value = getCheckboxSymbol(restraintVest.usageConditions === '躺在床上');
      worksheet.getCell('D7').value = getCheckboxSymbol(restraintVest.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('J6').value = getCheckboxSymbol(restraintVest.dayTime || false);
      worksheet.getCell('M6').value = restraintVest.dayStartTime || '';
      worksheet.getCell('O6').value = restraintVest.dayEndTime || '';
      worksheet.getCell('J7').value = getCheckboxSymbol(restraintVest.nightTime || false);
      worksheet.getCell('M7').value = restraintVest.nightStartTime || '';
      worksheet.getCell('O7').value = restraintVest.nightEndTime || '';
      worksheet.getCell('Q6').value = getCheckboxSymbol(restraintVest.allDay || false);
      worksheet.getCell('Q7').value = getCheckboxSymbol(!!restraintVest.otherTime);
      worksheet.getCell('S7').value = restraintVest.otherTime || '';
      console.log(`約束衣詳細設定已填充`);
    }

    // 約束腰帶 (rows 8-9)
    const restraintBelt = assessment.suggested_restraints['約束腰帶'] || {};
    worksheet.getCell('B8').value = getCheckboxSymbol(restraintBelt.checked || false);
    if (restraintBelt.checked) {
      // 使用情況
      worksheet.getCell('D8').value = getCheckboxSymbol(restraintBelt.usageConditions === '坐在椅上');
      worksheet.getCell('H8').value = getCheckboxSymbol(restraintBelt.usageConditions === '躺在床上');
      worksheet.getCell('D9').value = getCheckboxSymbol(restraintBelt.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('J8').value = getCheckboxSymbol(restraintBelt.dayTime || false);
      worksheet.getCell('M8').value = restraintBelt.dayStartTime || '';
      worksheet.getCell('O8').value = restraintBelt.dayEndTime || '';
      worksheet.getCell('J9').value = getCheckboxSymbol(restraintBelt.nightTime || false);
      worksheet.getCell('M9').value = restraintBelt.nightStartTime || '';
      worksheet.getCell('O9').value = restraintBelt.nightEndTime || '';
      worksheet.getCell('Q8').value = getCheckboxSymbol(restraintBelt.allDay || false);
      worksheet.getCell('Q9').value = getCheckboxSymbol(!!restraintBelt.otherTime);
      worksheet.getCell('S9').value = restraintBelt.otherTime || '';
    }

    // 手腕帶 (rows 10-11)
    const wristBand = assessment.suggested_restraints['手腕帶'] || {};
    worksheet.getCell('B10').value = getCheckboxSymbol(wristBand.checked || false);
    if (wristBand.checked) {
      // 使用情況
      worksheet.getCell('D10').value = getCheckboxSymbol(wristBand.usageConditions === '坐在椅上');
      worksheet.getCell('H10').value = getCheckboxSymbol(wristBand.usageConditions === '躺在床上');
      worksheet.getCell('D11').value = getCheckboxSymbol(wristBand.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('J10').value = getCheckboxSymbol(wristBand.dayTime || false);
      worksheet.getCell('M10').value = wristBand.dayStartTime || '';
      worksheet.getCell('O10').value = wristBand.dayEndTime || '';
      worksheet.getCell('J11').value = getCheckboxSymbol(wristBand.nightTime || false);
      worksheet.getCell('M11').value = wristBand.nightStartTime || '';
      worksheet.getCell('O11').value = wristBand.nightEndTime || '';
      worksheet.getCell('Q10').value = getCheckboxSymbol(wristBand.allDay || false);
      worksheet.getCell('Q11').value = getCheckboxSymbol(!!wristBand.otherTime);
      worksheet.getCell('S11').value = wristBand.otherTime || '';
    }

    // 約束手套/連指手套 (rows 12-13)
    const restraintGloves = assessment.suggested_restraints['約束手套/連指手套'] || {};
    worksheet.getCell('B12').value = getCheckboxSymbol(restraintGloves.checked || false);
    if (restraintGloves.checked) {
      // 使用情況
      worksheet.getCell('D12').value = getCheckboxSymbol(restraintGloves.usageConditions === '坐在椅上');
      worksheet.getCell('H12').value = getCheckboxSymbol(restraintGloves.usageConditions === '躺在床上');
      worksheet.getCell('D13').value = getCheckboxSymbol(restraintGloves.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('J12').value = getCheckboxSymbol(restraintGloves.dayTime || false);
      worksheet.getCell('M12').value = restraintGloves.dayStartTime || '';
      worksheet.getCell('O12').value = restraintGloves.dayEndTime || '';
      worksheet.getCell('J13').value = getCheckboxSymbol(restraintGloves.nightTime || false);
      worksheet.getCell('M13').value = restraintGloves.nightStartTime || '';
      worksheet.getCell('O13').value = restraintGloves.nightEndTime || '';
      worksheet.getCell('Q12').value = getCheckboxSymbol(restraintGloves.allDay || false);
      worksheet.getCell('Q13').value = getCheckboxSymbol(!!restraintGloves.otherTime);
      worksheet.getCell('S13').value = restraintGloves.otherTime || '';
    }

    // 防滑褲/防滑褲帶 (rows 14-15)
    const antiSlipPants = assessment.suggested_restraints['防滑褲/防滑褲帶'] || {};
    worksheet.getCell('B14').value = getCheckboxSymbol(antiSlipPants.checked || false);
    if (antiSlipPants.checked) {
      // 使用情況
      worksheet.getCell('D14').value = getCheckboxSymbol(antiSlipPants.usageConditions === '坐在椅上');
      worksheet.getCell('H14').value = getCheckboxSymbol(antiSlipPants.usageConditions === '躺在床上');
      worksheet.getCell('D15').value = getCheckboxSymbol(antiSlipPants.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('J14').value = getCheckboxSymbol(antiSlipPants.dayTime || false);
      worksheet.getCell('M14').value = antiSlipPants.dayStartTime || '';
      worksheet.getCell('O14').value = antiSlipPants.dayEndTime || '';
      worksheet.getCell('J15').value = getCheckboxSymbol(antiSlipPants.nightTime || false);
      worksheet.getCell('M15').value = antiSlipPants.nightStartTime || '';
      worksheet.getCell('O15').value = antiSlipPants.nightEndTime || '';
      worksheet.getCell('Q14').value = getCheckboxSymbol(antiSlipPants.allDay || false);
      worksheet.getCell('Q15').value = getCheckboxSymbol(!!antiSlipPants.otherTime);
      worksheet.getCell('S15').value = antiSlipPants.otherTime || '';
    }

    // 枱板 (rows 16-17)
    const tableBoard = assessment.suggested_restraints['枱板'] || {};
    worksheet.getCell('B16').value = getCheckboxSymbol(tableBoard.checked || false);
    if (tableBoard.checked) {
      // 使用情況 (枱板只有一個選項：坐在椅上/輪椅上)
      worksheet.getCell('D16').value = getCheckboxSymbol(tableBoard.usageConditions === '坐在椅上/輪椅上');
      
      // 時段
      worksheet.getCell('J16').value = getCheckboxSymbol(tableBoard.dayTime || false);
      worksheet.getCell('M16').value = tableBoard.dayStartTime || '';
      worksheet.getCell('O16').value = tableBoard.dayEndTime || '';
      worksheet.getCell('J17').value = getCheckboxSymbol(tableBoard.nightTime || false);
      worksheet.getCell('M17').value = tableBoard.nightStartTime || '';
      worksheet.getCell('O17').value = tableBoard.nightEndTime || '';
      worksheet.getCell('Q16').value = getCheckboxSymbol(tableBoard.allDay || false);
      worksheet.getCell('Q17').value = getCheckboxSymbol(!!tableBoard.otherTime);
      worksheet.getCell('S17').value = tableBoard.otherTime || '';
    }
  }
    // 使用 ExcelJS 標準語法設定分頁符
    console.log('使用標準 ExcelJS 語法設定分頁符...');
    
    // 設定行分頁符：在第54行後分頁
    try {
      worksheet.getRow(54).addPageBreak();
      console.log('✅ 行分頁符設定成功：第54行後分頁');
    } catch (error) {
      console.warn('❌ 行分頁符設定失敗:', error);
    }
    
    // 設定欄分頁符：在S欄後分頁
    try {
      worksheet.getColumn('S').addPageBreak();
      console.log('✅ 欄分頁符設定成功：S欄後分頁');
    } catch (error) {
      console.warn('❌ 欄分頁符設定失敗:', error);
    }
    
    // 驗證分頁符設定
    console.log('=== 分頁符設定驗證 ===');
    console.log('worksheet.rowBreaks:', (worksheet as any).rowBreaks);
    console.log('worksheet.colBreaks:', (worksheet as any).colBreaks);
    console.log('model.rowBreaks:', (worksheet as any).model?.rowBreaks);
    console.log('model.colBreaks:', (worksheet as any).model?.colBreaks);
    
    console.log('✅ 約束物品觀察表分頁符設定完成');
  
  console.log('=== 約束物品觀察表範本格式應用完成 ===');
  
  // Step 11: 完全忽略範本分頁符，只設定指定位置的分頁符
  console.log('第11步: 完全忽略範本分頁符，只設定指定位置的分頁符...');
  try {
    // 完全清除所有現有分頁符（包括從範本載入的）
    delete (worksheet as any).rowBreaks;
    delete (worksheet as any).colBreaks;
    if ((worksheet as any).model) {
      delete (worksheet as any).model.rowBreaks;
      delete (worksheet as any).model.colBreaks;
    }
    
    // 設定頁面配置，使用適應頁面來避免自動分頁
    worksheet.pageSetup = {
      orientation: 'portrait',
      paperSize: 9, // A4
      printArea: 'A1:AL108',
     fitToPage: false, // 禁用適應頁面
      fitToWidth: 2,    // 適應為2頁寬：A-S, T-AL
      fitToHeight: 0,  // 禁用自動適應高度
      scale: undefined, // 讓Excel自動計算縮放比例
      margins: {
        left: 0.3,      // 縮小邊距以容納更多內容
        right: 0.3,
        top: 0.3,
        bottom: 0.3,
        header: 0.3,
        footer: 0.3
      }
    };
    
    // 完全忽略範本中的分頁符，只設定我們明確需要的分頁符：第54行後和第19欄後
    (worksheet as any).rowBreaks = [{ id: 54, max: 16383, man: true }];
    (worksheet as any).colBreaks = [{ id: 19, max: 1048575, man: true }];
    
    // 確保 model 也只有我們指定的分頁符
    if (!(worksheet as any).model) {
      (worksheet as any).model = {};
    }
    (worksheet as any).model.rowBreaks = [54];
    (worksheet as any).model.colBreaks = [19];
    
    console.log('✅ 分頁符強制設定完成：僅在第54行後和第19欄後分頁，使用適應頁面避免自動分頁');
    
    // 驗證最終分頁符設定
    console.log('=== 最終分頁符驗證 ===');
    console.log('實際設定的 rowBreaks:', (worksheet as any).rowBreaks);
    console.log('實際設定的 colBreaks:', (worksheet as any).colBreaks);
    console.log('=== 分頁符驗證完成 ===');
    
    console.log('✅ 約束物品觀察表分頁符設定完成，已避免自動分頁');
  } catch (error) {
    console.error('❌ 強制設定分頁符失敗:', error);
  }
  
  console.log('=== 約束物品觀察表範本格式應用完成 ===');
};

// 創建約束物品觀察表工作簿
const createRestraintObservationWorkbook = async (
  sheetsConfig: SheetConfig[]
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  
  for (const config of sheetsConfig) {
    const worksheet = workbook.addWorksheet(config.name);
    
    // 應用範本格式並填入資料
    applyRestraintObservationTemplateFormat(
      worksheet,
      config.template, 
      config.patient, 
      config.assessment,
      config.startDate,
      config.endDate
    );
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
  console.log(`約束物品觀察表 Excel 檔案 ${filename} 保存成功`);
};

// 匯出約束物品觀察表到 Excel (帶日期範圍)
export const exportRestraintObservationsToExcel = async (
  assessments: PatientRestraintAssessment[],
  patients: any[],
  startDate: string,
  endDate: string,
  filename?: string
): Promise<void> => {
  try {
    // 從 Supabase 獲取約束物品觀察表範本
    const templatesData = await getTemplatesMetadata();
    const observationTemplate = templatesData.find(t => t.type === 'restraint-observation');
    
    if (!observationTemplate || !observationTemplate.extracted_format) {
      // 如果沒有範本，使用簡單匯出方式
      await exportRestraintObservationsToExcelSimple(assessments, patients, startDate, endDate, filename);
      return;
    }

    // 檢查 cellData 是否存在且有效
    if (!observationTemplate.extracted_format.cellData || 
        typeof observationTemplate.extracted_format.cellData !== 'object') {
      console.warn('範本的 cellData 無效，使用簡單匯出方式');
      await exportRestraintObservationsToExcelSimple(assessments, patients, startDate, endDate, filename);
      return;
    }

    const extractedFormat = observationTemplate.extracted_format;
    
    // 準備匯出資料
    const exportData: RestraintObservationExportData[] = assessments.map(assessment => {
      const patient = patients.find(p => p.院友id === assessment.patient_id);
      return {
        ...assessment,
        院友: {
          床號: patient?.床號 || '',
          中文姓氏: patient?.中文姓氏 || '',
          中文名字: patient?.中文名字 || '',
          性別: patient?.性別 || '',
          出生日期: patient?.出生日期 || '',
          身份證號碼: patient?.身份證號碼 || ''
        }
      };
    });
    
    // 構建工作表配置
    const sheetsConfig: SheetConfig[] = exportData.map(data => ({
      name: `${data.院友.床號}_${data.院友.中文姓氏}${data.院友.中文名字}`,
      template: extractedFormat,
      patient: data.院友,
      assessment: data,
      startDate: startDate,
      endDate: endDate
    }));
    
    if (sheetsConfig.length === 0) {
      alert('沒有可匯出的約束物品觀察表資料');
      return;
    }
    
    // 決定檔案名稱
    const finalFilename = filename || 
      (sheetsConfig.length === 1 
        ? `${sheetsConfig[0].patient.床號}_${sheetsConfig[0].patient.中文姓氏}${sheetsConfig[0].patient.中文名字}_約束物品觀察表.xlsx`
        : `約束物品觀察表(${sheetsConfig.length}名院友)_${startDate}_${endDate}.xlsx`);
    
    // 創建工作簿並匯出
    const workbook = await createRestraintObservationWorkbook(sheetsConfig);
    await saveExcelFile(workbook, finalFilename);
    
  } catch (error) {
    console.error('匯出約束物品觀察表失敗:', error);
    throw error;
  }
};

// 簡單的約束物品觀察表匯出（當沒有範本時使用）
const exportRestraintObservationsToExcelSimple = async (
  assessments: PatientRestraintAssessment[],
  patients: any[],
  startDate: string,
  endDate: string,
  filename?: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();

  // 為每個評估創建觀察表
  assessments.forEach((assessment, index) => {
    const patient = patients.find(p => p.院友id === assessment.patient_id);
    if (!patient) return;

    const sheetName = `${patient.床號}_${patient.中文姓氏}${patient.中文名字}_約束物品觀察表`;
    const worksheet = workbook.addWorksheet(sheetName);

    // 設定欄寬
    worksheet.columns = [
      { width: 12 }, // 日期
      { width: 8 },  // 時間
      { width: 15 }, // 約束物品類型
      { width: 15 }, // 使用原因
      { width: 20 }, // 觀察記錄
      { width: 12 }, // 檢查人員
      { width: 15 }, // 備註
    ];

    // 標題
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${patient.中文姓氏}${patient.中文名字} 約束物品觀察表 (${formatDateToChinese(startDate)} 至 ${formatDateToChinese(endDate)})`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD700' }
    };

    // 院友資訊
    worksheet.getCell('A3').value = `院友姓名: ${patient.中文姓氏}${patient.中文名字}`;
    worksheet.getCell('C3').value = `床號: ${patient.床號}`;
    worksheet.getCell('E3').value = `性別: ${patient.性別}`;
    if (patient.出生日期) {
      const age = calculateAge(patient.出生日期);
      worksheet.getCell('G3').value = `年齡: ${age}歲`;
    }

    // 表頭
    const headers = ['日期', '時間', '約束物品類型', '使用原因', '觀察記錄', '檢查人員', '備註'];
    const headerRow = worksheet.getRow(5);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF8C00' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // 根據評估中的約束物品建議創建觀察記錄行
    let rowIndex = 6;
    if (assessment.suggested_restraints && typeof assessment.suggested_restraints === 'object') {
      Object.entries(assessment.suggested_restraints).forEach(([restraint, config]: [string, any]) => {
        if (config.checked) {
          // 為每個約束物品創建多行觀察記錄（一週的記錄）
          for (let day = 0; day < 7; day++) {
            const observationDate = new Date(startDate);
            observationDate.setDate(observationDate.getDate() + day);
            
            const row = worksheet.getRow(rowIndex);
            const values = [
              observationDate.toLocaleDateString('zh-TW'),
              '', // 時間 - 空白供填寫
              restraint,
              config.usageConditions || '',
              '', // 觀察記錄 - 空白供填寫
              '', // 檢查人員 - 空白供填寫
              ''  // 備註 - 空白供填寫
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
              if (day % 2 === 1) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFF8DC' }
                };
              }
            });
            
            rowIndex++;
          }
        }
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const finalFilename = filename || `約束物品觀察表_${startDate}_${endDate}.xlsx`;
  saveAs(blob, finalFilename);
  
  console.log(`約束物品觀察表 Excel 檔案 ${finalFilename} 匯出成功`);
};