import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';
import type { PatientRestraintAssessment } from '../context/PatientContext';

interface RestraintConsentExportData {
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
  };
  assessment: RestraintConsentExportData;
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

// 從範本文件提取約束物品同意書格式
export const extractRestraintConsentTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
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

  // Extract column widths (A to X = 1 to 24)
  for (let col = 1; col <= 24; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }
  console.log(`提取欄寬: ${extractedTemplate.columnWidths.length} 個`);

  // Extract row heights (1 to 110)
  for (let row = 1; row <= 110; row++) {
    let height = worksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    extractedTemplate.rowHeights.push(Math.round(height * 100) / 100);
  }
  console.log(`提取列高: ${extractedTemplate.rowHeights.length} 個`);

  // Extract merged cells
  if (worksheet.model && worksheet.model.merges) {
    worksheet.model.merges.forEach(merge => {
      // Only include merges within A1:X110
      const rowMatch = merge.match(/(\d+)/g);
      if (rowMatch) {
        const maxRow = Math.max(...rowMatch.map(r => parseInt(r)));
        if (maxRow <= 110) {
          extractedTemplate.mergedCells.push(merge);
        }
      } else {
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
    // 完全忽略範本中的分頁符，只設定我們需要的分頁符
    console.log('完全忽略範本分頁符，只設定第49行分頁符...');
    
    // 只設定我們需要的分頁符：第49行後
    extractedTemplate.pageBreaks!.rowBreaks = [49];
    extractedTemplate.pageBreaks!.colBreaks = [];
    
    console.log('分頁符設定完成: 只在第49行後分頁');
    
  } catch (error) {
    console.error('提取分頁符失敗:', error);
    extractedTemplate.pageBreaks = { rowBreaks: [49], colBreaks: [] };
  }

  // Extract cell data (A1:X110)
  console.log('開始提取儲存格資料 (A1:X110)...');
  let extractedCellCount = 0;
  let problemAreaCellCount = 0;
  for (let row = 1; row <= 110; row++) {
    for (let col = 1; col <= 24; col++) {
      const cell = worksheet.getCell(row, col);
      const address = cell.address;
      
      // 檢查是否為問題區域 (P欄及以後，且50行及以後)
      const colLetter = String.fromCharCode(64 + col); // A=65, P=80
      const isProblemArea = col >= 16 && row >= 50; // P=16, 50行開始
      
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
        
        if (isProblemArea) {
          problemAreaCellCount++;
          if (problemAreaCellCount <= 10) {
            console.log(`✅ 問題區域儲存格 ${address} (行${row},欄${col}) 提取成功:`, Object.keys(cellData));
          }
        }
      }
    }
  }

  // 診斷：檢查提取的儲存格資料
  console.log('=== 範本提取診斷 ===');
  console.log(`總提取儲存格數: ${extractedCellCount}`);
  console.log(`問題區域 (P欄50行後) 儲存格數量: ${problemAreaCellCount}`);
  
  // 檢查問題區域的儲存格
  const testCells = ['P51', 'Q50', 'R55', 'S60', 'X110'];
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
    '50-110': 0
  };
  
  Object.keys(extractedTemplate.cellData).forEach(address => {
    const rowMatch = address.match(/(\d+)$/);
    if (rowMatch) {
      const row = parseInt(rowMatch[1]);
      if (row <= 49) {
        rowStats['1-49']++;
      } else {
        rowStats['50-110']++;
      }
    }
  });
  
  console.log('行範圍儲存格統計:', rowStats);
  console.log('=== 範本提取診斷完成 ===');
  
  // 提取圖片
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
          } else {
            console.warn(`圖片 ID=${img.imageId} 無有效 media 或 buffer`);
          }
        } else {
          console.warn(`圖片索引 ${index} 缺少 imageId 或 range`);
        }
      });
    }
    if (extractedTemplate.images.length === 0) {
      console.warn('範本中未找到有效圖片');
    }
  } catch (error) {
    console.error('提取圖片失敗:', error);
    extractedTemplate.images = [];
  }

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

// 應用約束物品同意書範本格式並填入資料
const applyRestraintConsentTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: {
    床號: string;
    中文姓氏: string;
    中文名字: string;
    性別: string;
    出生日期: string;
    身份證號碼: string;
  },
  assessment: RestraintConsentExportData
): void => {
  console.log('=== 開始應用約束物品同意書範本格式 ===');
  
  // 診斷：檢查範本資料完整性
  console.log('=== 應用階段診斷 ===');
  console.log(`範本 cellData 總數: ${Object.keys(template.cellData).length}`);
  
  // 檢查問題區域的儲存格
  const testCells = ['P51', 'Q50', 'R55', 'S60', 'X110'];
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
  
  // Step 1: Set column widths (A to X = 1 to 24)
  console.log('第1步: 設置欄寬 (1-24)...');
  template.columnWidths.forEach((width, idx) => {
    if (idx < 24) {
      worksheet.getColumn(idx + 1).width = width;
    }
  });
  console.log(`完成設置 ${Math.min(template.columnWidths.length, 24)} 個欄寬`);

  // Step 2: Set row heights (1 to 110)
  console.log('第2步: 設置列高 (1-110)...');
  template.rowHeights.forEach((height, idx) => {
    if (idx < 110) {
      worksheet.getRow(idx + 1).height = height;
    }
  });
  console.log(`完成設置 ${Math.min(template.rowHeights.length, 110)} 個列高`);



  // Step 3: Apply cell data (value, font, alignment, border, fill) for A1:X110
  console.log('第3步: 開始應用儲存格格式 (A1:X110)...');
  let appliedCellCount = 0;
  let problemAreaAppliedCount = 0;
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    // 檢查是否為問題區域
    const colMatch = address.match(/^([A-Z]+)/);
    const rowMatch = address.match(/(\d+)$/);
    let isProblemArea = false;
    if (colMatch && rowMatch) {
      const col = colMatch[1];
      const rowNum = parseInt(rowMatch[1]);
      isProblemArea = (col >= 'P' && rowNum >= 50) || (col > 'P');
    }
    
    const cell = worksheet.getCell(address);
    
    try {
      // Apply value
      if (isProblemArea && problemAreaAppliedCount < 10) {
        console.log(`🔍 處理問題區域儲存格 ${address}:`, {
          hasValue: cellData.value !== undefined,
          hasFont: !!cellData.font,
          hasBorder: !!cellData.border,
          hasFill: !!cellData.fill
        });
      }
      
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
        if (problemAreaAppliedCount <= 10) {
          console.log(`✅ 問題區域儲存格 ${address} 應用成功:`, Object.keys(cellData));
        }
      }
      if (appliedCellCount % 500 === 0) {
        console.log(`應用儲存格格式進度: ${appliedCellCount}`);
      }
    } catch (error) {
      console.error(`❌ 應用儲存格 ${address} 失敗:`, error);
      if (isProblemArea) {
        console.error(`❌ 問題區域儲存格 ${address} 應用失敗 (行${rowNum},欄${col}):`, error);
      }
    }
  });
  console.log(`完成應用 ${appliedCellCount} 個儲存格的格式`);
  console.log(`問題區域成功應用: ${problemAreaAppliedCount} 個儲存格`);

  // Step 4: Merge cells
  console.log('開始合併儲存格...');
  let mergedCount = 0;
  template.mergedCells.forEach((merge, index) => {
    try {
      worksheet.mergeCells(merge);
      mergedCount++;
    } catch (e) {
      console.warn(`合併儲存格失敗: ${merge}`, e);
    }
  });
  
  // 檢查是否有涉及問題區域的合併儲存格
  const problemAreaMerges = template.mergedCells.filter(merge => {
    return merge.includes('P') || merge.includes('Q') || merge.includes('R') || merge.includes('S') || merge.includes('T') || merge.includes('U') || merge.includes('V') || merge.includes('W') || merge.includes('X');
  });
  console.log(`涉及問題區域 (P-X欄) 的合併儲存格: ${problemAreaMerges.length} 個`, problemAreaMerges);
  console.log(`完成合併 ${mergedCount} 個儲存格範圍`);

  // Step 5: Fill patient and assessment data
  console.log('第5步: 填充院友和評估資料...');
  
  // 院友基本資料
  worksheet.getCell('F4').value = `${patient.中文姓氏}${patient.中文名字}`;
  worksheet.getCell('F80').value = `${patient.中文姓氏}${patient.中文名字}`;
  worksheet.getCell('O82').value = `${patient.中文姓氏}${patient.中文名字}`;
  worksheet.getCell('I91').value = `${patient.中文姓氏}${patient.中文名字}`;
  
  worksheet.getCell('F5').value = patient.床號;
  
  // 性別/年齡組合
  if (patient.性別 && patient.出生日期) {
    const age = calculateAge(patient.出生日期);
    worksheet.getCell('N4').value = `${patient.性別}/`;
    worksheet.getCell('O4').value = `${age}歲`;
  }
  
  worksheet.getCell('U4').value = patient.身份證號碼;
  
  // 上次評估日期
  if (assessment.doctor_signature_date) {
    worksheet.getCell('P5').value = new Date(assessment.doctor_signature_date).toLocaleDateString('zh-TW');
  } else {
    worksheet.getCell('P5').value = '首次';
  }

  // Step 6: Fill risk factors data
  console.log('第6步: 填充風險因素資料...');
  
  if (assessment.risk_factors && typeof assessment.risk_factors === 'object') {
    // 精神及/或行為異常的情況
    worksheet.getCell('C11').value = getCheckboxSymbol(assessment.risk_factors['精神及/或行為異常的情況'] || false);
    
    // 子項目
    worksheet.getCell('D12').value = getCheckboxSymbol(assessment.risk_factors['情緒問題/神志昏亂'] || false);
    worksheet.getCell('I12').value = getCheckboxSymbol(assessment.risk_factors['遊走'] || false);
    worksheet.getCell('K12').value = getCheckboxSymbol(assessment.risk_factors['傷害自己的行為，請註明：'] || false);
    if (assessment.risk_factors['傷害自己的行為說明']) {
      worksheet.getCell('R12').value = assessment.risk_factors['傷害自己的行為說明'];
    }
    worksheet.getCell('D13').value = getCheckboxSymbol(assessment.risk_factors['傷害/騷擾他人的行為，請註明：'] || false);
    if (assessment.risk_factors['傷害/騷擾他人的行為說明']) {
      worksheet.getCell('L13').value = assessment.risk_factors['傷害/騷擾他人的行為說明'];
    }

    // 未能保持正確坐姿
    worksheet.getCell('C14').value = getCheckboxSymbol(assessment.risk_factors['未能保持正確坐姿'] || false);
    worksheet.getCell('D15').value = getCheckboxSymbol(assessment.risk_factors['背部及腰肢肌肉無力'] || false);
    worksheet.getCell('I15').value = getCheckboxSymbol(assessment.risk_factors['癱瘓'] || false);
    worksheet.getCell('K15').value = getCheckboxSymbol(assessment.risk_factors['關節退化'] || false);
    worksheet.getCell('N15').value = getCheckboxSymbol(assessment.risk_factors['其他，請註明：'] || false);
    if (assessment.risk_factors['其他未能保持正確坐姿說明']) {
      worksheet.getCell('S15').value = assessment.risk_factors['其他未能保持正確坐姿說明'];
    }

    // 有跌倒風險
    worksheet.getCell('C16').value = getCheckboxSymbol(assessment.risk_factors['有跌倒風險'] || false);
    worksheet.getCell('D17').value = getCheckboxSymbol(assessment.risk_factors['步履失平衡'] || false);
    worksheet.getCell('H17').value = getCheckboxSymbol(assessment.risk_factors['住院期間曾經跌倒'] || false);
    worksheet.getCell('M17').value = getCheckboxSymbol(assessment.risk_factors['視/聽力衰退'] || false);
    worksheet.getCell('D18').value = getCheckboxSymbol(assessment.risk_factors['受藥物影響'] || false);
    worksheet.getCell('H18').value = getCheckboxSymbol(assessment.risk_factors['其他跌倒的風險，請註明：'] || false);
    if (assessment.risk_factors['其他跌倒的風險說明']) {
      worksheet.getCell('O18').value = assessment.risk_factors['其他跌倒的風險說明'];
    }

    // 曾除去治療用之醫療器材及／或維護身體的用品
    worksheet.getCell('C19').value = getCheckboxSymbol(assessment.risk_factors['曾除去治療用之醫療器材及／或維護身體的用品'] || false);
    worksheet.getCell('D20').value = getCheckboxSymbol(assessment.risk_factors['餵食管'] || false);
    worksheet.getCell('G20').value = getCheckboxSymbol(assessment.risk_factors['氧氣喉管或面罩'] || false);
    worksheet.getCell('K20').value = getCheckboxSymbol(assessment.risk_factors['尿片或衣服'] || false);
    worksheet.getCell('O20').value = getCheckboxSymbol(assessment.risk_factors['其他造口護理裝置'] || false);
    worksheet.getCell('D21').value = getCheckboxSymbol(assessment.risk_factors['導尿管'] || false);
    worksheet.getCell('G21').value = getCheckboxSymbol(assessment.risk_factors['其他醫療器材，請註明：'] || false);
    if (assessment.risk_factors['其他醫療器材說明']) {
      worksheet.getCell('K21').value = assessment.risk_factors['其他醫療器材說明'];
    }
  }

  // Step 7: Fill alternatives data
  console.log('第7步: 填充折衷辦法資料...');
  
  if (assessment.alternatives && typeof assessment.alternatives === 'object') {
    // 折衷辦法選項 (C27-C37, T27-T37)
    const alternativeOptions = [
      '延醫診治，找出影響情緒或神志昏亂的原因並處理',
      '與註冊醫生/註冊中醫/表列中醫商討療程或調校藥物',
      '尋求物理治療師/職業治療師/臨床心理學家/社工的介入',
      '改善家具：使用更合適的座椅、座墊或其他配件',
      '改善環境：令住客對環境感安全、舒適及熟悉',
      '提供消閒及分散注意力的活動',
      '多與住客傾談，建立融洽互信的關係',
      '安老院員工定期觀察及巡視',
      '調節日常護理程序以配合住客的特殊需要',
      '請家人/親友探望協助',
      '其他，請註明：'
    ];

    alternativeOptions.forEach((option, index) => {
      const row = 27 + index;
      const isChecked = assessment.alternatives[option] || false;
      
      // 左側勾選框 (C欄)
      worksheet.getCell(`C${row}`).value = getCheckboxSymbol(isChecked);
      // 右側勾選框 (T欄)
      worksheet.getCell(`T${row}`).value = getCheckboxSymbol(isChecked);
    });

    // 其他說明
    if (assessment.alternatives['其他說明']) {
      worksheet.getCell('C37').value = assessment.alternatives['其他說明'];
      worksheet.getCell('T37').value = assessment.alternatives['其他說明'];
    }
  }

  // Step 8: Fill suggested restraints data
  console.log('第8步: 填充約束物品建議資料...');
  
  if (assessment.suggested_restraints && typeof assessment.suggested_restraints === 'object') {
    // 約束衣 (rows 42-43)
    const restraintVest = assessment.suggested_restraints['約束衣'] || {};
    worksheet.getCell('C42').value = getCheckboxSymbol(restraintVest.checked || false);
    if (restraintVest.checked) {
      // 使用情況
      worksheet.getCell('F42').value = getCheckboxSymbol(restraintVest.usageConditions === '坐在椅上');
      worksheet.getCell('I42').value = getCheckboxSymbol(restraintVest.usageConditions === '躺在床上');
      worksheet.getCell('F43').value = getCheckboxSymbol(restraintVest.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('L42').value = getCheckboxSymbol(restraintVest.dayTime || false);
      worksheet.getCell('O42').value = restraintVest.dayStartTime || '';
      worksheet.getCell('Q42').value = restraintVest.dayEndTime || '';
      worksheet.getCell('L43').value = getCheckboxSymbol(restraintVest.nightTime || false);
      worksheet.getCell('O43').value = restraintVest.nightStartTime || '';
      worksheet.getCell('Q43').value = restraintVest.nightEndTime || '';
      worksheet.getCell('S42').value = getCheckboxSymbol(restraintVest.allDay || false);
      worksheet.getCell('S43').value = getCheckboxSymbol(!!restraintVest.otherTime);
      worksheet.getCell('U43').value = restraintVest.otherTime || '';
    }

    // 約束腰帶 (rows 45-46)
    const restraintBelt = assessment.suggested_restraints['約束腰帶'] || {};
    worksheet.getCell('C45').value = getCheckboxSymbol(restraintBelt.checked || false);
    if (restraintBelt.checked) {
      // 使用情況
      worksheet.getCell('F45').value = getCheckboxSymbol(restraintBelt.usageConditions === '坐在椅上');
      worksheet.getCell('I45').value = getCheckboxSymbol(restraintBelt.usageConditions === '躺在床上');
      worksheet.getCell('F46').value = getCheckboxSymbol(restraintBelt.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('L45').value = getCheckboxSymbol(restraintBelt.dayTime || false);
      worksheet.getCell('O45').value = restraintBelt.dayStartTime || '';
      worksheet.getCell('Q45').value = restraintBelt.dayEndTime || '';
      worksheet.getCell('L46').value = getCheckboxSymbol(restraintBelt.nightTime || false);
      worksheet.getCell('O46').value = restraintBelt.nightStartTime || '';
      worksheet.getCell('Q46').value = restraintBelt.nightEndTime || '';
      worksheet.getCell('S45').value = getCheckboxSymbol(restraintBelt.allDay || false);
      worksheet.getCell('S46').value = getCheckboxSymbol(!!restraintBelt.otherTime);
      worksheet.getCell('U46').value = restraintBelt.otherTime || '';
    }

    // 手腕帶 (rows 53-54)
    const wristBand = assessment.suggested_restraints['手腕帶'] || {};
    worksheet.getCell('C53').value = getCheckboxSymbol(wristBand.checked || false);
    if (wristBand.checked) {
      // 使用情況
      worksheet.getCell('F53').value = getCheckboxSymbol(wristBand.usageConditions === '坐在椅上');
      worksheet.getCell('I53').value = getCheckboxSymbol(wristBand.usageConditions === '躺在床上');
      worksheet.getCell('F54').value = getCheckboxSymbol(wristBand.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('L53').value = getCheckboxSymbol(wristBand.dayTime || false);
      worksheet.getCell('O53').value = wristBand.dayStartTime || '';
      worksheet.getCell('Q53').value = wristBand.dayEndTime || '';
      worksheet.getCell('L54').value = getCheckboxSymbol(wristBand.nightTime || false);
      worksheet.getCell('O54').value = wristBand.nightStartTime || '';
      worksheet.getCell('Q54').value = wristBand.nightEndTime || '';
      worksheet.getCell('S53').value = getCheckboxSymbol(wristBand.allDay || false);
      worksheet.getCell('S54').value = getCheckboxSymbol(!!wristBand.otherTime);
      worksheet.getCell('U54').value = wristBand.otherTime || '';
    }

    // 約束手套/連指手套 (rows 56-57)
    const restraintGloves = assessment.suggested_restraints['約束手套/連指手套'] || {};
    worksheet.getCell('C56').value = getCheckboxSymbol(restraintGloves.checked || false);
    if (restraintGloves.checked) {
      // 使用情況
      worksheet.getCell('F56').value = getCheckboxSymbol(restraintGloves.usageConditions === '坐在椅上');
      worksheet.getCell('I56').value = getCheckboxSymbol(restraintGloves.usageConditions === '躺在床上');
      worksheet.getCell('F57').value = getCheckboxSymbol(restraintGloves.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('L56').value = getCheckboxSymbol(restraintGloves.dayTime || false);
      worksheet.getCell('O56').value = restraintGloves.dayStartTime || '';
      worksheet.getCell('Q56').value = restraintGloves.dayEndTime || '';
      worksheet.getCell('L57').value = getCheckboxSymbol(restraintGloves.nightTime || false);
      worksheet.getCell('O57').value = restraintGloves.nightStartTime || '';
      worksheet.getCell('Q57').value = restraintGloves.nightEndTime || '';
      worksheet.getCell('S56').value = getCheckboxSymbol(restraintGloves.allDay || false);
      worksheet.getCell('S57').value = getCheckboxSymbol(!!restraintGloves.otherTime);
      worksheet.getCell('U57').value = restraintGloves.otherTime || '';
    }

    // 防滑褲/防滑褲帶 (rows 59-60)
    const antiSlipPants = assessment.suggested_restraints['防滑褲/防滑褲帶'] || {};
    worksheet.getCell('C59').value = getCheckboxSymbol(antiSlipPants.checked || false);
    if (antiSlipPants.checked) {
      // 使用情況
      worksheet.getCell('F59').value = getCheckboxSymbol(antiSlipPants.usageConditions === '坐在椅上');
      worksheet.getCell('I59').value = getCheckboxSymbol(antiSlipPants.usageConditions === '躺在床上');
      worksheet.getCell('F60').value = getCheckboxSymbol(antiSlipPants.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('L59').value = getCheckboxSymbol(antiSlipPants.dayTime || false);
      worksheet.getCell('O59').value = antiSlipPants.dayStartTime || '';
      worksheet.getCell('Q59').value = antiSlipPants.dayEndTime || '';
      worksheet.getCell('L60').value = getCheckboxSymbol(antiSlipPants.nightTime || false);
      worksheet.getCell('O60').value = antiSlipPants.nightStartTime || '';
      worksheet.getCell('Q60').value = antiSlipPants.nightEndTime || '';
      worksheet.getCell('S59').value = getCheckboxSymbol(antiSlipPants.allDay || false);
      worksheet.getCell('S60').value = getCheckboxSymbol(!!antiSlipPants.otherTime);
      worksheet.getCell('U60').value = antiSlipPants.otherTime || '';
    }

    // 枱板 (rows 62-63)
    const tableBoard = assessment.suggested_restraints['枱板'] || {};
    worksheet.getCell('C62').value = getCheckboxSymbol(tableBoard.checked || false);
    if (tableBoard.checked) {
      // 使用情況 (枱板只有一個選項：坐在椅上/輪椅上)
      worksheet.getCell('F62').value = getCheckboxSymbol(tableBoard.usageConditions === '坐在椅上/輪椅上');
      
      // 時段
      worksheet.getCell('L62').value = getCheckboxSymbol(tableBoard.dayTime || false);
      worksheet.getCell('O62').value = tableBoard.dayStartTime || '';
      worksheet.getCell('Q62').value = tableBoard.dayEndTime || '';
      worksheet.getCell('L63').value = getCheckboxSymbol(tableBoard.nightTime || false);
      worksheet.getCell('O63').value = tableBoard.nightStartTime || '';
      worksheet.getCell('Q63').value = tableBoard.nightEndTime || '';
      worksheet.getCell('S62').value = getCheckboxSymbol(tableBoard.allDay || false);
      worksheet.getCell('S63').value = getCheckboxSymbol(!!tableBoard.otherTime);
      worksheet.getCell('U63').value = tableBoard.otherTime || '';
    }

    // 其他 (rows 65-66)
    const otherRestraint = assessment.suggested_restraints['其他：'] || {};
    worksheet.getCell('C65').value = getCheckboxSymbol(otherRestraint.checked || false);
    if (otherRestraint.checked) {
      // 使用情況
      worksheet.getCell('F65').value = getCheckboxSymbol(otherRestraint.usageConditions === '坐在椅上');
      worksheet.getCell('I65').value = getCheckboxSymbol(otherRestraint.usageConditions === '躺在床上');
      worksheet.getCell('F66').value = getCheckboxSymbol(otherRestraint.usageConditions === '坐在椅上及躺在床上');
      
      // 時段
      worksheet.getCell('L65').value = getCheckboxSymbol(otherRestraint.dayTime || false);
      worksheet.getCell('O65').value = otherRestraint.dayStartTime || '';
      worksheet.getCell('Q65').value = otherRestraint.dayEndTime || '';
      worksheet.getCell('L66').value = getCheckboxSymbol(otherRestraint.nightTime || false);
      worksheet.getCell('O66').value = otherRestraint.nightStartTime || '';
      worksheet.getCell('Q66').value = otherRestraint.nightEndTime || '';
      worksheet.getCell('S65').value = getCheckboxSymbol(otherRestraint.allDay || false);
      worksheet.getCell('S66').value = getCheckboxSymbol(!!otherRestraint.otherTime);
      worksheet.getCell('U66').value = otherRestraint.otherTime || '';
    }
  }

  // Step 9: Apply images
  console.log('第9步: 應用圖片...');
  if (!Array.isArray(template.images)) {
    console.warn('template.images 不是陣列，初始化為空陣列');
    template.images = [];
  }
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

  // Step 9: Apply print settings
  console.log('第9步: 複製列印設定...');
  if (template.printSettings) {
    try {
      console.log('將要應用的列印設定:', JSON.stringify(template.printSettings, null, 2));
      worksheet.pageSetup = { ...template.printSettings };
      console.log('列印設定複製成功');
    } catch (error) {
      console.warn('複製列印設定失敗:', error);
    }
  }
  
  // Step 10: Apply page breaks
  console.log('第10步: 應用分頁符...');
  try {
    // 完全忽略範本中的所有分頁符，只設定我們需要的分頁符
    console.log('完全忽略範本分頁符，只設定第49行分頁符...');
    
    // 完全清除任何現有的分頁符設定
    delete (worksheet as any).rowBreaks;
    delete (worksheet as any).colBreaks;
    if ((worksheet as any).model) {
      delete (worksheet as any).model.rowBreaks;
      delete (worksheet as any).model.colBreaks;
    }
    
    // 設定頁面配置，避免自動分頁
    worksheet.pageSetup = {
      orientation: 'portrait',
      paperSize: 9, // A4
      printArea: 'A1:X110',
      fitToPage: false,
      fitToWidth: 1, // 1頁寬
      fitToHeight: 0, // 無限高，避免自動分頁
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.3,
        bottom: 0.3,
        header: 0.3,
        footer: 0.3
      },
      scale: 100
    };
    
    // 只設定我們需要的分頁符：第49行後
    (worksheet as any).rowBreaks = [{ id: 49, max: 16383, man: true }];
    (worksheet as any).colBreaks = []; // 不設定欄分頁符
    
    // 確保 model 也只有我們指定的分頁符
    if (!(worksheet as any).model) {
      (worksheet as any).model = {};
    }
    (worksheet as any).model.rowBreaks = [49];
    (worksheet as any).model.colBreaks = [];
    
    // 最終驗證
    console.log('=== 最終分頁符驗證 ===');
    console.log('worksheet.rowBreaks:', (worksheet as any).rowBreaks);
    console.log('worksheet.colBreaks:', (worksheet as any).colBreaks);
    console.log('=== 分頁符驗證完成 ===');
    
    console.log('✅ 約束物品同意書分頁符設定完成：只在第49行後分頁');
  } catch (error) {
    console.error('❌ 應用分頁符失敗:', error);
  }
};

// 創建約束物品同意書工作簿
const createRestraintConsentWorkbook = async (sheetsConfig: SheetConfig[]): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  
  for (const config of sheetsConfig) {
    const worksheet = workbook.addWorksheet(config.name);
    applyRestraintConsentTemplateFormat(worksheet, config.template, config.patient, config.assessment);
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
  console.log(`約束物品同意書 Excel 檔案 ${filename} 保存成功`);
};

// 匯出約束物品同意書到 Excel
export const exportRestraintConsentsToExcel = async (
  assessments: PatientRestraintAssessment[],
  patients: any[],
  filename?: string
): Promise<void> => {
  try {
    // 從 Supabase 獲取約束物品同意書範本
    const templatesData = await getTemplatesMetadata();
    const consentTemplate = templatesData.find(t => t.type === 'consent-form');
    
    if (!consentTemplate || !consentTemplate.extracted_format) {
      // 如果沒有範本，使用簡單匯出方式
      await exportRestraintConsentsToExcelSimple(assessments, patients, filename);
      return;
    }

    const extractedFormat = consentTemplate.extracted_format;
    
    // 準備匯出資料
    const exportData: RestraintConsentExportData[] = assessments.map(assessment => {
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
      name: `${data.院友.床號}_${data.院友.中文姓氏}${data.院友.中文名字}_約束物品同意書`,
      template: extractedFormat,
      patient: data.院友,
      assessment: data
    }));
    
    if (sheetsConfig.length === 0) {
      alert('沒有可匯出的約束物品同意書資料');
      return;
    }
    
    // 決定檔案名稱
    const finalFilename = filename || 
      (sheetsConfig.length === 1 
        ? `${sheetsConfig[0].patient.床號}_${sheetsConfig[0].patient.中文姓氏}${sheetsConfig[0].patient.中文名字}_約束物品同意書.xlsx`
        : `約束物品同意書(${sheetsConfig.length}名院友).xlsx`);
    
    // 創建工作簿並匯出
    const workbook = await createRestraintConsentWorkbook(sheetsConfig);
    await saveExcelFile(workbook, finalFilename);
    
  } catch (error) {
    console.error('匯出約束物品同意書失敗:', error);
    throw error;
  }
};

// 簡單的約束物品同意書匯出（當沒有範本時使用）
const exportRestraintConsentsToExcelSimple = async (
  assessments: PatientRestraintAssessment[],
  patients: any[],
  filename?: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();

  // 為每個評估創建同意書
  assessments.forEach((assessment, index) => {
    const patient = patients.find(p => p.院友id === assessment.patient_id);
    if (!patient) return;

    const sheetName = `${patient.床號}_${patient.中文姓氏}${patient.中文名字}_約束物品同意書`;
    const worksheet = workbook.addWorksheet(sheetName);

    // 設定欄寬
    worksheet.columns = [
      { width: 8 },  // 床號
      { width: 12 }, // 中文姓名
      { width: 6 },  // 性別
      { width: 8 },  // 年齡
      { width: 15 }, // 身份證號碼
      { width: 12 }, // 醫生簽署日期
      { width: 12 }, // 下次到期日期
      { width: 20 }, // 風險因素
      { width: 20 }, // 折衷辦法
      { width: 20 }, // 約束物品建議
      { width: 25 }, // 其他備註
      { width: 12 }  // 建立日期
    ];

    // 標題
    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${patient.中文姓氏}${patient.中文名字} 約束物品同意書`;
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
    const headers = ['項目', '內容', '勾選狀態', '備註'];
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

    // 根據評估資料創建內容行
    let rowIndex = 6;
    
    // 風險因素
    if (assessment.risk_factors && typeof assessment.risk_factors === 'object') {
      Object.entries(assessment.risk_factors).forEach(([factor, value]) => {
        if (!factor.includes('說明') && value) {
          const row = worksheet.getRow(rowIndex);
          const values = ['風險因素', factor, '✓', ''];

          values.forEach((value, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            cell.value = value;
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
          
          rowIndex++;
        }
      });
    }

    // 約束物品建議
    if (assessment.suggested_restraints && typeof assessment.suggested_restraints === 'object') {
      Object.entries(assessment.suggested_restraints).forEach(([restraint, config]: [string, any]) => {
        if (config.checked) {
          const row = worksheet.getRow(rowIndex);
          const values = [
            '約束物品', 
            restraint, 
            '✓', 
            `${config.usageConditions || ''} ${config.dayTime ? '日間' : ''} ${config.nightTime ? '晚上' : ''} ${config.allDay ? '全日' : ''}`
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
          });
          
          rowIndex++;
        }
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const finalFilename = filename || `約束物品同意書_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, finalFilename);
  
  console.log(`約束物品同意書 Excel 檔案 ${finalFilename} 匯出成功`);
};