import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../lib/supabase';
import {
  fetchWorkflowRecordsForMonth,
  generateStaffCodeMapping,
  formatStaffCodeNotation,
  extractStaffNamesFromWorkflowRecords,
  getWorkflowRecordForPrescriptionDateTimeSlot,
  formatWorkflowCellContent,
  formatDispenseCellContent,
  type WorkflowRecord,
  type StaffCodeMapping
} from './medicationWorkflowHelper';

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

// 多工作表範本格式
interface MedicationRecordTemplateFormat {
  oral: ExtractedTemplate;
  topical: ExtractedTemplate;
  injection: ExtractedTemplate;
}

// 工作表配置
interface SheetConfig {
  name: string;
  template: ExtractedTemplate;
  patient: any;
  prescriptions: any[];
  routeType: 'oral' | 'topical' | 'injection';
}

const extractSheetFormat = async (worksheet: ExcelJS.Worksheet): Promise<ExtractedTemplate> => {
  console.log('提取工作表格式:', worksheet.name);
  
  const extractedTemplate: ExtractedTemplate = {
    columnWidths: [],
    rowHeights: [],
    mergedCells: [],
    cellData: {},
    images: [],
    pageBreaks: {
      rowBreaks: [],
      colBreaks: []
    },
  };

  const actualMaxCol = 44;
  const actualMaxRow = 37;

  console.log('使用固定提取範圍: A1:AR37 (44 欄 x 37 行)');

  for (let col = 1; col <= actualMaxCol; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  for (let row = 1; row <= actualMaxRow; row++) {
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
    
  } catch (error) {
    console.error('提取分頁符失敗:', error);
    extractedTemplate.pageBreaks = { rowBreaks: [], colBreaks: [] };
  }

  let extractedCellCount = 0;
  
  for (let row = 1; row <= actualMaxRow; row++) {
    for (let col = 1; col <= actualMaxCol; col++) {
      const cell = worksheet.getCell(row, col);
      const address = cell.address;
      
      const cellData: any = {};
      
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        cellData.value = cell.value;
      }
      
      if (cell.font) {
        cellData.font = { ...cell.font };
        if (cellData.font.name === 'Segoe UI Symbol' || cellData.font.name === 'Segoe UI Emoji') {
          cellData.font.name = 'Arial Unicode MS';
        }
      }
      
      if (cell.alignment) {
        cellData.alignment = { ...cell.alignment };
      }
      
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
      
      if (cell.fill) {
        cellData.fill = { ...cell.fill };
      }
      
      if (cell.numFmt) {
        cellData.numFmt = cell.numFmt;
      }
      
      if (Object.keys(cellData).length > 0) {
        extractedTemplate.cellData[address] = cellData;
        extractedCellCount++;
      }
    }
  }
  console.log('提取了', extractedCellCount, '個儲存格的格式');
  
  return extractedTemplate;
};

export const categorizePrescriptionsByRoute = (prescriptions: any[]) => {
  const oral: any[] = [];
  const injection: any[] = [];
  const topical: any[] = [];
  const noRoute: any[] = [];

  prescriptions.forEach(prescription => {
    const route = prescription.administration_route?.trim();

    if (!route) {
      noRoute.push(prescription);
    } else if (route === '口服') {
      oral.push(prescription);
    } else if (route === '注射') {
      injection.push(prescription);
    } else {
      topical.push(prescription);
    }
  });

  return { oral, injection, topical, noRoute };
};

export const extractMedicationRecordTemplateFormat = async (templateFile: File): Promise<MedicationRecordTemplateFormat> => {
  console.log('開始提取個人備藥及給藥記錄範本格式...');
  
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await templateFile.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  console.log('工作簿包含', workbook.worksheets.length, '個工作表');

  if (workbook.worksheets.length < 3) {
    throw new Error('範本格式錯誤：需要至少3個工作表（口服、外用、注射），但只找到 ' + workbook.worksheets.length + ' 個');
  }

  const oralSheet = workbook.worksheets[0];
  const topicalSheet = workbook.worksheets[1];
  const injectionSheet = workbook.worksheets[2];

  console.log('工作表名稱:');
  console.log('  1.', oralSheet.name, '(口服)');
  console.log('  2.', topicalSheet.name, '(外用)');
  console.log('  3.', injectionSheet.name, '(注射)');

  const oralFormat = await extractSheetFormat(oralSheet);
  const topicalFormat = await extractSheetFormat(topicalSheet);
  const injectionFormat = await extractSheetFormat(injectionSheet);

  console.log('個人備藥及給藥記錄範本格式提取完成！');

  return {
    oral: oralFormat,
    topical: topicalFormat,
    injection: injectionFormat
  };
};

// 計算年齡
const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// 獲取服用頻率描述
const getFrequencyDescription = (prescription: any): string => {
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, medication_time_slots } = prescription;
  
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
  
  switch (frequency_type) {
    case 'daily':
      return getFrequencyAbbreviation(timeSlotsCount);
    case 'every_x_days':
      return '隔' + frequency_value + '日服';
    case 'every_x_months':
      return '隔' + frequency_value + '月服';
    case 'weekly_days':
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') || '';
      return '逢' + days + '服';
    case 'odd_even_days':
      return is_odd_even_day === 'odd' ? '單日服' : is_odd_even_day === 'even' ? '雙日服' : '單雙日服';
    case 'hourly':
      return '每' + frequency_value + '小時服用';
    default:
      return getFrequencyAbbreviation(timeSlotsCount);
  }
};

// 深層複製範圍內的所有格式和內容
const deepCopyRange = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  startRow: number,
  endRow: number,
  targetStartRow: number
) => {
  console.log('深層複製範圍: 第', startRow, '-', endRow, '列到第', targetStartRow, '列');
  
  const rowCount = endRow - startRow + 1;
  
  // 複製列高
  for (let i = 0; i < rowCount; i++) {
    const sourceRowIndex = startRow + i - 1;
    const targetRowIndex = targetStartRow + i - 1;
    if (sourceRowIndex < template.rowHeights.length) {
      worksheet.getRow(targetRowIndex + 1).height = template.rowHeights[sourceRowIndex];
    }
  }
  
  // 複製儲存格內容和格式
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const cell = worksheet.getCell(address);
    const rowNum = cell.row;
    
    if (rowNum >= startRow && rowNum <= endRow) {
      const offset = targetStartRow - startRow;
      const targetRow = rowNum + offset;
      const targetAddress = cell.address.replace(/\d+/, targetRow.toString());
      const targetCell = worksheet.getCell(targetAddress);
      
      if (cellData.value !== undefined) {
        targetCell.value = cellData.value;
      }
      if (cellData.font) {
        targetCell.font = cellData.font;
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
  
  // 複製合併儲存格
  template.mergedCells.forEach(merge => {
    const match = merge.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    if (match) {
      const startCol = match[1];
      const startRowNum = parseInt(match[2]);
      const endCol = match[3];
      const endRowNum = parseInt(match[4]);
      
      if (startRowNum >= startRow && endRowNum <= endRow) {
        const offset = targetStartRow - startRow;
        const targetMerge = startCol + (startRowNum + offset) + ':' + endCol + (endRowNum + offset);
        try {
          worksheet.mergeCells(targetMerge);
        } catch (e) {
          console.warn('合併儲存格失敗:', targetMerge);
        }
      }
    }
  });
};

// 拆分注射類處方：將每個時間點拆分為獨立的處方條目
const expandInjectionPrescriptions = (prescriptions: any[], routeType: 'oral' | 'topical' | 'injection'): any[] => {
  if (routeType !== 'injection') {
    return prescriptions;
  }

  const expandedPrescriptions: any[] = [];

  prescriptions.forEach(prescription => {
    const timeSlots = prescription.medication_time_slots || [];

    if (timeSlots.length === 0) {
      expandedPrescriptions.push(prescription);
    } else {
      const sortedTimeSlots = [...timeSlots].sort((a, b) => {
        return parseTimeToMinutes(a) - parseTimeToMinutes(b);
      });

      sortedTimeSlots.forEach(timeSlot => {
        expandedPrescriptions.push({
          ...prescription,
          medication_time_slots: [timeSlot]
        });
      });
    }
  });

  console.log(`注射類處方拆分: 原始 ${prescriptions.length} 個 -> 拆分後 ${expandedPrescriptions.length} 個`);
  return expandedPrescriptions;
};

// 拆分口服和外用處方：將超過4個時間點的處方拆分為多個條目
const expandOralTopicalPrescriptions = (
  prescriptions: any[],
  routeType: 'oral' | 'topical' | 'injection'
): any[] => {
  // 仅对口服和外用类型处理
  if (routeType === 'injection') {
    return prescriptions;
  }

  const expandedPrescriptions: any[] = [];

  prescriptions.forEach(prescription => {
    const timeSlots = prescription.medication_time_slots || [];

    // 如果时间点 <= 4，保持原样
    if (timeSlots.length <= 4) {
      expandedPrescriptions.push(prescription);
    } else {
      // 如果时间点 > 4，需要拆分
      // 先按时间排序
      const sortedTimeSlots = [...timeSlots].sort((a, b) =>
        parseTimeToMinutes(a) - parseTimeToMinutes(b)
      );

      // 按每4个一组拆分
      for (let i = 0; i < sortedTimeSlots.length; i += 4) {
        const batch = sortedTimeSlots.slice(i, i + 4);
        expandedPrescriptions.push({
          ...prescription,
          medication_time_slots: batch
        });
      }
    }
  });

  if (expandedPrescriptions.length !== prescriptions.length) {
    console.log(`口服/外用處方拆分: 原始 ${prescriptions.length} 個 -> 拆分後 ${expandedPrescriptions.length} 個`);
  }

  return expandedPrescriptions;
};

// 應用範本格式並填入資料
const applyMedicationRecordTemplate = async (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: any,
  prescriptions: any[],
  selectedMonth: string,
  routeType: 'oral' | 'topical' | 'injection',
  includeWorkflowRecords: boolean = false
): Promise<void> => {
  console.log('開始應用個人備藥及給藥記錄範本: ', patient.中文姓氏 + patient.中文名字);
  console.log('是否包含執核派記錄:', includeWorkflowRecords);

  // 先进行注射类型拆分，再进行口服外用拆分
  let processedPrescriptions = expandInjectionPrescriptions(prescriptions, routeType);
  processedPrescriptions = expandOralTopicalPrescriptions(processedPrescriptions, routeType);

  // 獲取執核派記錄（如果需要）
  let workflowRecords: WorkflowRecord[] = [];
  let staffCodeMapping: StaffCodeMapping = {};
  if (includeWorkflowRecords) {
    console.log('\n========== 處方ID驗證與去重 ==========');
    console.log(`院友: ${patient.床號}${patient.中文姓氏}${patient.中文名字} (ID: ${patient.院友id})`);
    console.log(`途徑類型: ${routeType}`);
    console.log(`原始處方數量: ${prescriptions.length}`);
    console.log(`拆分後處方數量: ${processedPrescriptions.length}`);

    const prescriptionIds = processedPrescriptions.map(p => p.id);
    const uniquePrescriptionIds = [...new Set(prescriptionIds)];

    console.log(`提取的處方ID數量 (去重前): ${prescriptionIds.length}`);
    console.log(`提取的處方ID數量 (去重後): ${uniquePrescriptionIds.length}`);

    if (prescriptionIds.length !== uniquePrescriptionIds.length) {
      console.warn(`⚠️ 警告：處方ID有重複！重複數量: ${prescriptionIds.length - uniquePrescriptionIds.length}`);
      const duplicateIds = prescriptionIds.filter((id, index) => prescriptionIds.indexOf(id) !== index);
      console.warn('重複的處方ID:', [...new Set(duplicateIds)]);
    }

    console.log('處方ID資料型別檢查:');
    prescriptionIds.forEach((id, idx) => {
      const idType = typeof id;
      const isString = idType === 'string';
      const isUUID = isString && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      console.log(`  [${idx + 1}] ID: ${id}, 型別: ${idType}, 是字串: ${isString}, 是UUID: ${isUUID}`);
    });

    console.log('處方詳細資訊:');
    processedPrescriptions.forEach((p, idx) => {
      console.log(`  [${idx + 1}] ID: ${p.id}, 藥物: ${p.medication_name}, 途徑: ${p.administration_route}, 時間: ${p.meal_timing || p.administration_times}`);
    });

    console.log('開始查詢執核派記錄...');
    workflowRecords = await fetchWorkflowRecordsForMonth(patient.院友id, prescriptionIds, selectedMonth);

    if (workflowRecords.length === 0) {
      console.error('❌ 致命錯誤：查詢返回0條執核派記錄！');
      console.error('這將導致該工作表無法匯出執核派記錄。');
      console.error(`途徑: ${routeType}, 處方數量: ${processedPrescriptions.length}`);
    } else {
      console.log(`✓ 查詢成功，共 ${workflowRecords.length} 條執核派記錄`);
    }

    const staffNames = extractStaffNamesFromWorkflowRecords(workflowRecords);
    console.log('提取的人員姓名:', staffNames);
    console.log('去重後人員數量:', [...new Set(staffNames)].length);

    staffCodeMapping = generateStaffCodeMapping(staffNames);
    console.log('執核派人員代號映射:', staffCodeMapping);
    console.log('映射包含人員數量:', Object.keys(staffCodeMapping).length);
    console.log('========================================\n');
  } else {
    console.log('[applyMedicationRecordTemplate] includeWorkflowRecords = false，跳過執核派記錄');
  }

  // 設定欄寬
  template.columnWidths.forEach((width, idx) => {
    worksheet.getColumn(idx + 1).width = width;
  });

  // 設定列高
  template.rowHeights.forEach((height, idx) => {
    worksheet.getRow(idx + 1).height = height;
  });

  // 應用所有儲存格格式
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const cell = worksheet.getCell(address);

    if (cellData.value !== undefined) {
      cell.value = cellData.value;
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

  // 合併儲存格
  template.mergedCells.forEach(merge => {
    try {
      worksheet.mergeCells(merge);
    } catch (e) {
      console.warn('合併儲存格失敗:', merge);
    }
  });

  // 填入院友基本資訊（第1-6列）
  worksheet.getCell('B1').value = patient.藥物敏感 && patient.藥物敏感.length > 0
    ? patient.藥物敏感.join('、')
    : 'NKDA';

  worksheet.getCell('B3').value = patient.不良藥物反應 && patient.不良藥物反應.length > 0
    ? patient.不良藥物反應.join('、')
    : 'NKADR';

  // K3：填入匯出月份（格式：XXXX年XX月）
  const [year, month] = selectedMonth.split('-');
  worksheet.getCell('K3').value = year + '年' + month + '月';

  worksheet.getCell('AF1').value = patient.中文姓氏 + patient.中文名字;

  const age = calculateAge(patient.出生日期);
  worksheet.getCell('AF2').value = patient.性別 + '/' + age;

  worksheet.getCell('AO1').value = patient.床號;

  worksheet.getCell('AO2').value = patient.出生日期
    ? new Date(patient.出生日期).toLocaleDateString('zh-TW')
    : '';

  // 插入患者相片到H32單元格
  if (patient.院友相片) {
    try {
      console.log('開始處理患者相片:', patient.院友相片);

      // 從 URL 下載圖片並轉換為 base64
      const response = await fetch(patient.院友相片);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // 判斷圖片格式
      let extension: 'png' | 'jpeg' | 'jpg' | 'gif' = 'jpeg';
      if (patient.院友相片.toLowerCase().includes('.png')) {
        extension = 'png';
      } else if (patient.院友相片.toLowerCase().includes('.gif')) {
        extension = 'gif';
      }

      // 添加圖片到工作簿
      const imageId = worksheet.workbook.addImage({
        base64: base64,
        extension: extension
      });

      // 將圖片插入到H32單元格，使用 tl + br 座標方式填滿單元格
      worksheet.addImage(imageId, {
        tl: { col: 7, row: 31 }, // H32 的左上角 (列索引從0開始，所以H=7, 32行=31)
        br: { col: 8, row: 32 }  // H32 的右下角 (填滿整個單元格)
      });

      console.log('患者相片已成功插入到H32單元格');
    } catch (error) {
      console.error('插入患者相片失敗:', error);
    }
  }

  // 填入處方資料（智能分页）
  let currentPage = 1;
  let prescriptionIndex = 0;

  while (prescriptionIndex < processedPrescriptions.length) {
    const startRow = currentPage === 1 ? 7 : ((currentPage - 1) * 31) + 7;

    // 如果是第二頁或之後，需要深層複製第7-37列
    if (currentPage > 1) {
      const targetStartRow = (currentPage - 1) * 31 + 7;
      deepCopyRange(worksheet, template, 7, 37, targetStartRow);
    }

    // 初始化当前页的数据
    const pageTimeSlots: string[] = [];
    const pagePrescriptions: any[] = [];

    // 智能分配处方到当前页
    while (prescriptionIndex < processedPrescriptions.length && pagePrescriptions.length < 5) {
      const prescription = processedPrescriptions[prescriptionIndex];
      const prescriptionTimeSlots = prescription.medication_time_slots || [];

      // 检查是否可以加入当前页
      const combinedTimeSlots = [...pageTimeSlots, ...prescriptionTimeSlots];
      const uniqueCount = new Set(combinedTimeSlots).size;

      // 如果去重后 <= 6 个，或者当前页还没有处方（确保每页至少1个），则加入
      if (uniqueCount <= 6 || pagePrescriptions.length === 0) {
        pagePrescriptions.push(prescription);
        pageTimeSlots.push(...prescriptionTimeSlots);
        prescriptionIndex++;
      } else {
        // 会导致超过6个时间点，开新页
        console.log(`页面 ${currentPage} 时间点已达上限，处方 #${prescriptionIndex + 1} 将移至下一页`);
        break;
      }
    }

    // 填入该页的所有处方条目
    for (let i = 0; i < pagePrescriptions.length; i++) {
      const prescription = pagePrescriptions[i];
      const groupStartRow = startRow + (i * 5);
      fillPrescriptionData(worksheet, prescription, groupStartRow, routeType, selectedMonth, includeWorkflowRecords);
    }

    // 填入頁面時間點總結 (L32-L37)
    fillPageTimeSummary(worksheet, pageTimeSlots, startRow);

    // 填入執核派記錄（如果需要）
    if (includeWorkflowRecords && workflowRecords.length > 0) {
      fillWorkflowRecordsForPage(
        worksheet,
        pagePrescriptions,
        workflowRecords,
        staffCodeMapping,
        startRow,
        selectedMonth,
        routeType
      );

      // 填入人員代號備註到 A36 和 A37
      const notationStartRow = startRow + 29;  // A36的列號 (7 + 29 = 36)
      const notationSecondRow = startRow + 30; // A37的列號 (7 + 30 = 37)
      console.log(`[人員備註] 第${currentPage}頁 startRow=${startRow}, 備註將寫入 A${notationStartRow} 和 A${notationSecondRow}`);

      const { line1, line2 } = formatStaffCodeNotation(staffCodeMapping);
      console.log('[人員備註] line1:', line1);
      console.log('[人員備註] line2:', line2);

      if (line1) {
        const cellAddress = 'A' + notationStartRow;
        const cell = worksheet.getCell(cellAddress);
        const existingValue = cell.value;
        console.log(`[人員備註] ${cellAddress} 原有內容:`, existingValue);
        console.log(`[人員備註] 寫入 ${cellAddress}:`, line1);
        cell.value = line1;
      }
      if (line2) {
        const cellAddress = 'A' + notationSecondRow;
        const cell = worksheet.getCell(cellAddress);
        const existingValue = cell.value;
        console.log(`[人員備註] ${cellAddress} 原有內容:`, existingValue);
        console.log(`[人員備註] 寫入 ${cellAddress}:`, line2);
        cell.value = line2;
      }
    }

    // 修復該頁的邊框
    fixCellBorders(worksheet, startRow);

    currentPage++;
  }
  
  // 設定列印設定
  if (template.printSettings) {
    worksheet.pageSetup = {
      ...template.printSettings,
      printTitlesRow: '1:6'  // 設定第1-6列為列印標題
    };
  }
  
  console.log('個人備藥及給藥記錄範本應用完成');
};

// 填入頁面時間點總結 (L32-L37)
const fillPageTimeSummary = (worksheet: ExcelJS.Worksheet, timeSlots: string[], startRow: number): void => {
  // 去重並排序時間點（按24小時制從早到晚）
  const uniqueTimeSlots = [...new Set(timeSlots)].sort((a, b) => {
    return parseTimeToMinutes(a) - parseTimeToMinutes(b);
  });

  // 計算 L32-L37 的實際列號
  const summaryStartRow = startRow + 25; // 32 - 7 = 25

  // 清空 L32-L37
  for (let i = 0; i < 6; i++) {
    worksheet.getCell('L' + (summaryStartRow + i)).value = '';
  }

  // 填入前6個時間點
  for (let i = 0; i < Math.min(uniqueTimeSlots.length, 6); i++) {
    worksheet.getCell('L' + (summaryStartRow + i)).value = uniqueTimeSlots[i];
  }

  // 如果超過6個時間點，記錄警告（理論上不應該發生，因為分頁時已控制）
  if (uniqueTimeSlots.length > 6) {
    console.warn(`警告：頁面時間點超過6個 (共${uniqueTimeSlots.length}個)，應在分頁時避免此情況`);
  }
};

// 修復特定儲存格的邊框
const fixCellBorders = (worksheet: ExcelJS.Worksheet, startRow: number): void => {
  const thinBorder = { style: 'thin' as const, color: { argb: '00000000' } };

  // 修復 B1 的右邊框（只在第一頁）
  if (startRow === 7) {
    const b1 = worksheet.getCell('B1');
    b1.border = {
      ...b1.border,
      right: thinBorder
    };
  }

  // 修復 J9, J14, J19, J24, J29 的右邊框（每個處方組的J列第二個儲存格，即服用頻率那一格）
  // startRow 是該頁第一個處方組的起始列，每組間隔5列，服用頻率在 startRow + 1
  for (let i = 0; i < 5; i++) {
    const jRow = startRow + (i * 5) + 1; // +1 是服用頻率那一格
    const jCell = worksheet.getCell('J' + jRow);
    jCell.border = {
      ...jCell.border,
      right: thinBorder
    };
  }

  // 修復 A32 的下邊框（只在第一頁）
  if (startRow === 7) {
    const a32 = worksheet.getCell('A32');
    a32.border = {
      ...a32.border,
      bottom: thinBorder
    };
  } else {
    // 後續頁的 A32 對應位置
    const a32Row = startRow + 25; // 32 - 7 = 25
    const a32Cell = worksheet.getCell('A' + a32Row);
    a32Cell.border = {
      ...a32Cell.border,
      bottom: thinBorder
    };
  }

  // 修復 H32:K37 (給藥簽署組) 的右邊框和下邊框
  // 該區域在第一頁是 H32:K37，在後續頁需要根據 startRow 計算
  const signatureBlockStartRow = startRow + 25; // 32 - 7 = 25
  const signatureBlockEndRow = startRow + 30;   // 37 - 7 = 30

  // 修復右邊框 (K列)
  for (let row = signatureBlockStartRow; row <= signatureBlockEndRow; row++) {
    const kCell = worksheet.getCell('K' + row);
    kCell.border = {
      ...kCell.border,
      right: thinBorder
    };
  }

  // 修復下邊框 (H, I, J, K 列的最後一行)
  for (const col of ['H', 'I', 'J', 'K']) {
    const cell = worksheet.getCell(col + signatureBlockEndRow);
    cell.border = {
      ...cell.border,
      bottom: thinBorder
    };
  }
};

// 解析時間字串為分鐘數（方便比較）
const parseTimeToMinutes = (timeStr: string): number => {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return -1;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
};

// 判断是否需要打破时段限制
const shouldBreakTimeRangeRule = (timeSlots: string[]): boolean => {
  const rangeCounts = [0, 0, 0, 0]; // 4个时段的计数器

  timeSlots.forEach(timeSlot => {
    const minutes = parseTimeToMinutes(timeSlot);
    if (minutes >= 7 * 60 && minutes < 12 * 60) {
      rangeCounts[0]++; // 早上时段
    } else if (minutes >= 12 * 60 && minutes < 16 * 60) {
      rangeCounts[1]++; // 中午下午时段
    } else if (minutes >= 16 * 60 && minutes < 20 * 60) {
      rangeCounts[2]++; // 傍晚时段
    } else if (minutes >= 20 * 60 && minutes <= 22 * 60) {
      rangeCounts[3]++; // 晚上时段
    }
  });

  // 如果任意时段包含2个或以上时间点，返回 true
  return rangeCounts.some(count => count >= 2);
};

// 按时序映射时间点到4个单元格
const mapTimeSlotsSequentially = (timeSlots: string[]): { [key: number]: string[] } => {
  // 复制并排序时间点（按24小时制从早到晚）
  const sortedSlots = [...timeSlots].sort((a, b) =>
    parseTimeToMinutes(a) - parseTimeToMinutes(b)
  );

  const timeSlotsMap: { [key: number]: string[] } = {};

  // 最多映射4个时间点
  sortedSlots.slice(0, 4).forEach((slot, index) => {
    timeSlotsMap[index + 1] = [slot];
  });

  return timeSlotsMap;
};

// 根據時間範圍決定放置的列偏移（口服和外用）
const getTimeSlotRowOffset = (timeStr: string): number => {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes < 0) return 1; // 無效時間，預設第一列

  if (minutes >= 7 * 60 && minutes < 12 * 60) {
    return 1; // 07:00-11:59 -> L8 (startRow + 1)
  } else if (minutes >= 12 * 60 && minutes < 16 * 60) {
    return 2; // 12:00-15:59 -> L9 (startRow + 2)
  } else if (minutes >= 16 * 60 && minutes < 20 * 60) {
    return 3; // 16:00-19:59 -> L10 (startRow + 3)
  } else if (minutes >= 20 * 60 && minutes <= 22 * 60) {
    return 4; // 20:00-22:00 -> L11 (startRow + 4)
  }
  return 1; // 其他時間預設第一列
};

// 注射類：時間點只放在第一個位置（startRow + 1），避免覆寫列 9, 14, 19, 24, 29
const getInjectionTimeSlotRowOffset = (timeStr: string): number => {
  return 1; // 所有時間點都放在 L8 (startRow + 1)
};

// 填入單個處方資料
const fillPrescriptionData = (
  worksheet: ExcelJS.Worksheet,
  prescription: any,
  startRow: number,
  routeType?: 'oral' | 'topical' | 'injection',
  selectedMonth?: string,
  includeWorkflowRecords?: boolean
): string[] => {
  // B列：藥物名稱 (第1行)
  worksheet.getCell('B' + startRow).value = prescription.medication_name || '';

  // B列：藥物來源 (第5行)
  worksheet.getCell('B' + (startRow + 4)).value = prescription.medication_source
    ? '藥物來源: ' + prescription.medication_source
    : '';

  // A列：處方日期
  worksheet.getCell('A' + startRow).value = prescription.prescription_date
    ? new Date(prescription.prescription_date).toLocaleDateString('zh-TW')
    : '';

  // J列：途徑
  worksheet.getCell('J' + startRow).value = prescription.administration_route || '';

  // J列：服用頻率+服用次數 (第2行)
  const frequencyDesc = getFrequencyDescription(prescription);
  worksheet.getCell('J' + (startRow + 1)).value = frequencyDesc;

  // J列：服用份量 (第3行)
  let dosageText = '';
  if (prescription.special_dosage_instruction) {
    dosageText = prescription.special_dosage_instruction;
  } else if (prescription.dosage_amount) {
    dosageText = '每次' + prescription.dosage_amount + (prescription.dosage_unit || '');
  }
  worksheet.getCell('J' + (startRow + 2)).value = dosageText;

  // J列：需要時 (第4行)
  worksheet.getCell('J' + (startRow + 3)).value = prescription.is_prn ? '需要時' : '';

  // L列：服用時間，根據時間範圍放置在不同列
  const timeSlots = prescription.medication_time_slots || [];
  let timeSlotsMap: { [key: number]: string[] } = {};

  if (routeType === 'injection') {
    // 注射类型：所有时间点放在第一个位置
    timeSlots.forEach((timeSlot: string) => {
      const rowOffset = 1;
      if (!timeSlotsMap[rowOffset]) {
        timeSlotsMap[rowOffset] = [];
      }
      timeSlotsMap[rowOffset].push(timeSlot);
    });
  } else {
    // 口服和外用类型：判断是否需要打破时段限制
    if (shouldBreakTimeRangeRule(timeSlots)) {
      // 打破时段限制，按时序映射
      timeSlotsMap = mapTimeSlotsSequentially(timeSlots);
    } else {
      // 保持时段映射
      timeSlots.forEach((timeSlot: string) => {
        const rowOffset = getTimeSlotRowOffset(timeSlot);
        if (!timeSlotsMap[rowOffset]) {
          timeSlotsMap[rowOffset] = [];
        }
        timeSlotsMap[rowOffset].push(timeSlot);
      });
    }
  }

  // 清空 L8-L11 (startRow + 1 到 startRow + 4) - 注射類跳過 startRow + 2
  for (let i = 1; i <= 4; i++) {
    if (routeType === 'injection' && i === 2) {
      continue; // 注射類不得觸碰 startRow + 2 (列 9, 14, 19, 24, 29)
    }
    worksheet.getCell('L' + (startRow + i)).value = '';
  }

  // 填入分組後的時間點 - 注射類跳過 startRow + 2
  Object.entries(timeSlotsMap).forEach(([rowOffset, slots]) => {
    const offset = parseInt(rowOffset);
    if (routeType === 'injection' && offset === 2) {
      return; // 注射類不得觸碰 startRow + 2 (列 9, 14, 19, 24, 29)
    }
    const cell = worksheet.getCell('L' + (startRow + offset));
    cell.value = slots.join(', ');
  });

  // 填充灰色背景：無論是否包含執核派記錄，都要對處方範圍外的日期填充灰色
  if (selectedMonth) {
    const [year, month] = selectedMonth.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

    // 對每個時間點行填充灰色背景
    Object.keys(timeSlotsMap).forEach(rowOffsetStr => {
      const rowOffset = parseInt(rowOffsetStr);
      if (routeType === 'injection' && rowOffset === 2) {
        return; // 注射類跳過 startRow + 2
      }

      const timeSlotRow = startRow + rowOffset;
      const timeSlot = timeSlotsMap[rowOffset][0]; // 取第一個時間點作為代表

      // 遍歷當月每一天（N 列開始，第14列）
      for (let day = 1; day <= daysInMonth; day++) {
        const columnIndex = 14 + day - 1;
        const columnLetter = getColumnLetter(columnIndex);
        const cellAddress = columnLetter + timeSlotRow;
        const cell = worksheet.getCell(cellAddress);

        const dateStr = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        // 檢查該日期是否在處方有效範圍內
        const isWithinRange = isDateInPrescriptionRange(dateStr, timeSlot, prescription);

        if (!isWithinRange) {
          // 填充灰色背景
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
          };
          // 移除斜線格式
          if (cell.border) {
            cell.border = {
              top: cell.border.top,
              left: cell.border.left,
              bottom: cell.border.bottom,
              right: cell.border.right,
              diagonal: undefined,
              diagonalUp: false,
              diagonalDown: false
            };
          }
        }
      }

      // 填充超出該月天數的日期格子（例如11月31日）
      for (let day = daysInMonth + 1; day <= 31; day++) {
        const columnIndex = 14 + day - 1;
        const columnLetter = getColumnLetter(columnIndex);
        const cellAddress = columnLetter + timeSlotRow;
        const cell = worksheet.getCell(cellAddress);

        // 填充灰色背景
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' }
        };
        // 移除斜線格式
        if (cell.border) {
          cell.border = {
            top: cell.border.top,
            left: cell.border.left,
            bottom: cell.border.bottom,
            right: cell.border.right,
            diagonal: undefined,
            diagonalUp: false,
            diagonalDown: false
          };
        }
      }
    });
  }

  // 返回所有時間點供頁面總結使用
  return timeSlots;
};

// 獲取列字母（A-Z, AA-AZ, BA-BZ...）
const getColumnLetter = (columnNumber: number): string => {
  let letter = '';
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return letter;
};

// 填入執核派記錄到頁面
const fillWorkflowRecordsForPage = (
  worksheet: ExcelJS.Worksheet,
  pagePrescriptions: any[],
  workflowRecords: WorkflowRecord[],
  staffCodeMapping: StaffCodeMapping,
  startRow: number,
  selectedMonth: string,
  routeType: 'oral' | 'topical' | 'injection'
): void => {
  console.log('[fillWorkflowRecordsForPage] 開始填入執核派記錄');
  console.log('  處方數量:', pagePrescriptions.length);
  console.log('  工作流程記錄數量:', workflowRecords.length);
  console.log('  人員代號映射包含', Object.keys(staffCodeMapping).length, '個人員');
  console.log('  詳細映射:', JSON.stringify(staffCodeMapping, null, 2));
  console.log('  選擇月份:', selectedMonth);
  console.log('  startRow:', startRow);

  const [year, month] = selectedMonth.split('-');
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

  // 處理每個處方條目的執核派記錄
  pagePrescriptions.forEach((prescription, prescriptionIndex) => {
    const groupStartRow = startRow + (prescriptionIndex * 5);
    const timeSlots = prescription.medication_time_slots || [];
    const isSelfCare = prescription.preparation_method === 'custom';

    // 建立時間點到行的映射（與 fillPrescriptionData 使用相同的邏輯）
    let timeSlotsMap: { [key: number]: string[] } = {};

    if (routeType === 'injection') {
      // 注射类型：所有时间点放在第一个位置
      timeSlots.forEach((timeSlot: string) => {
        const rowOffset = 1;
        if (!timeSlotsMap[rowOffset]) {
          timeSlotsMap[rowOffset] = [];
        }
        timeSlotsMap[rowOffset].push(timeSlot);
      });
    } else {
      // 口服和外用类型：判断是否需要打破时段限制
      if (shouldBreakTimeRangeRule(timeSlots)) {
        // 打破时段限制，按时序映射
        timeSlotsMap = mapTimeSlotsSequentially(timeSlots);
      } else {
        // 保持时段映射
        timeSlots.forEach((timeSlot: string) => {
          const rowOffset = getTimeSlotRowOffset(timeSlot);
          if (!timeSlotsMap[rowOffset]) {
            timeSlotsMap[rowOffset] = [];
          }
          timeSlotsMap[rowOffset].push(timeSlot);
        });
      }
    }

    // 為每個時間點填入執核派記錄
    Object.entries(timeSlotsMap).forEach(([rowOffsetStr, slotsInRow]) => {
      const rowOffset = parseInt(rowOffsetStr);
      if (routeType === 'injection' && rowOffset === 2) {
        return; // 注射類跳過 startRow + 2
      }

      const recordRow = groupStartRow + rowOffset;

      // 處理該行的每個時間點
      slotsInRow.forEach((timeSlot: string) => {

      // N 列開始（第14列），共31格（N-AR，即第14-44列）
      for (let day = 1; day <= daysInMonth; day++) {
        const columnIndex = 14 + day - 1;
        const columnLetter = getColumnLetter(columnIndex);
        const cellAddress = columnLetter + recordRow;
        const cell = worksheet.getCell(cellAddress);

        const dateStr = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        // 檢查是否在處方有效期內
        const isWithinRange = isDateInPrescriptionRange(dateStr, timeSlot, prescription);

        // 如果不在範圍內，跳過（灰色背景已由 fillPrescriptionData 設定）
        if (!isWithinRange) {
          continue;
        }

        // 處理自理處方：顯示 'S' 代號，移除斜線，置中對齊
        if (isSelfCare) {
          // 移除斜線格式
          if (cell.border) {
            cell.border = {
              top: cell.border.top,
              left: cell.border.left,
              bottom: cell.border.bottom,
              right: cell.border.right,
              diagonal: undefined,
              diagonalUp: false,
              diagonalDown: false
            };
          }
          cell.value = 'S';
          // 置中對齊
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          continue;
        }

        // 查找對應的工作流程記錄
        console.log(`[查找記錄] 單元格 ${cellAddress} - 處方ID: ${prescription.id}, 日期: ${dateStr}, 時間: ${timeSlot}`);

        const workflowRecord = getWorkflowRecordForPrescriptionDateTimeSlot(
          workflowRecords,
          prescription.id,
          dateStr,
          timeSlot
        );

        console.log(`[查找結果] 單元格 ${cellAddress}:`, workflowRecord ? `找到記錄 ${workflowRecord.id.substring(0, 8)}` : '未找到記錄');

        if (!workflowRecord) {
          // 沒有找到對應的工作流程記錄
          console.log(`[跳過] 單元格 ${cellAddress}: 無對應工作流程記錄`);
          continue;
        }

        // 填入執核記錄
        const content = formatWorkflowCellContent(workflowRecord, staffCodeMapping);
        console.log(`[執核內容] 單元格 ${cellAddress}: "${content}"`);

        if (content) {
          // 如果是特殊執行結果 (A, S, R, O, HL)，先清除斜線格式並置中
          const isSpecialCode = ['A', 'S', 'R', 'O', 'HL'].includes(content);
          if (isSpecialCode) {
            if (cell.border) {
              // 保留其他邊框，移除對角線邊框
              cell.border = {
                top: cell.border.top,
                left: cell.border.left,
                bottom: cell.border.bottom,
                right: cell.border.right,
                diagonal: undefined,
                diagonalUp: false,
                diagonalDown: false
              };
            }
            // 置中對齊
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
          cell.value = content;
          console.log(`  [執核派] 寫入單元格 ${cellAddress}: "${content}"${isSpecialCode ? ' (已清除斜線並置中)' : ''}`);
        } else {
          console.log(`  [警告] 單元格 ${cellAddress}: 執核內容為空`);
        }
      }

      // 填充超出該月天數的日期格子（例如11月31日）
      for (let day = daysInMonth + 1; day <= 31; day++) {
        const columnIndex = 14 + day - 1;
        const columnLetter = getColumnLetter(columnIndex);
        const cellAddress = columnLetter + recordRow;
        const cell = worksheet.getCell(cellAddress);

        // 填充灰色背景
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' }
        };
        // 移除斜線格式
        if (cell.border) {
          cell.border = {
            top: cell.border.top,
            left: cell.border.left,
            bottom: cell.border.bottom,
            right: cell.border.right,
            diagonal: undefined,
            diagonalUp: false,
            diagonalDown: false
          };
        }
      }

      });
    });
  });

  // 填入時間點總結區域的派藥記錄（N32-AR37）
  const pageTimeSlots = [...new Set(pagePrescriptions.flatMap(p => p.medication_time_slots || []))].sort(
    (a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)
  );

  pageTimeSlots.slice(0, 6).forEach((timeSlot, timeSlotIndex) => {
    const summaryRow = startRow + 25 + timeSlotIndex;

    for (let day = 1; day <= daysInMonth; day++) {
      const columnIndex = 14 + day - 1;
      const columnLetter = getColumnLetter(columnIndex);
      const cellAddress = columnLetter + summaryRow;
      const cell = worksheet.getCell(cellAddress);

      const dateStr = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      // 檢查該時間點是否有任何處方成功派藥
      let hasDispensed = false;
      let dispenseContent = '';
      let shouldBeGray = true; // 預設為灰色，直到找到一個在範圍內的處方

      for (const prescription of pagePrescriptions) {
        if (!(prescription.medication_time_slots || []).includes(timeSlot)) continue;

        const isWithinRange = isDateInPrescriptionRange(dateStr, timeSlot, prescription);
        if (isWithinRange) {
          shouldBeGray = false; // 至少有一個處方在範圍內
        }
        if (!isWithinRange) continue;

        const isSelfCare = prescription.preparation_method === 'custom';
        if (isSelfCare) {
          dispenseContent = 'S';
          hasDispensed = true;
          break;
        }

        console.log(`[查找派藥記錄] 單元格 ${cellAddress} - 處方ID: ${prescription.id}, 日期: ${dateStr}, 時間: ${timeSlot}`);

        const workflowRecord = getWorkflowRecordForPrescriptionDateTimeSlot(
          workflowRecords,
          prescription.id,
          dateStr,
          timeSlot
        );

        console.log(`[派藥查找結果] 單元格 ${cellAddress}:`, workflowRecord ? `找到記錄 ${workflowRecord.id.substring(0, 8)}` : '未找到記錄');

        if (!workflowRecord) {
          console.log(`[跳過派藥] 單元格 ${cellAddress}: 無對應工作流程記錄`);
          continue;
        }

        const content = formatDispenseCellContent(workflowRecord, staffCodeMapping);
        console.log(`[派藥內容] 單元格 ${cellAddress}: "${content}"`);

        if (content) {
          dispenseContent = content;
          hasDispensed = true;
          console.log(`  [派藥] 寫入單元格 ${cellAddress}: "${content}"`);
          break;
        } else {
          console.log(`  [警告] 單元格 ${cellAddress}: 派藥內容為空`);
        }
      }

      if (hasDispensed) {
        // 如果是特殊執行結果 (A, S, R, O, HL)，先清除斜線格式並置中
        const isSpecialCode = ['A', 'S', 'R', 'O', 'HL'].includes(dispenseContent);
        if (isSpecialCode) {
          if (cell.border) {
            // 保留其他邊框，移除對角線邊框
            cell.border = {
              top: cell.border.top,
              left: cell.border.left,
              bottom: cell.border.bottom,
              right: cell.border.right,
              diagonal: undefined,
              diagonalUp: false,
              diagonalDown: false
            };
          }
          // 置中對齊
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        cell.value = dispenseContent;
      } else if (shouldBeGray) {
        // 如果所有處方都不在範圍內，填充灰色背景
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' }
        };
        // 移除斜線格式
        if (cell.border) {
          cell.border = {
            top: cell.border.top,
            left: cell.border.left,
            bottom: cell.border.bottom,
            right: cell.border.right,
            diagonal: undefined,
            diagonalUp: false,
            diagonalDown: false
          };
        }
      }
    }

    // 填充超出該月天數的日期格子（例如11月31日）
    for (let day = daysInMonth + 1; day <= 31; day++) {
      const columnIndex = 14 + day - 1;
      const columnLetter = getColumnLetter(columnIndex);
      const cellAddress = columnLetter + summaryRow;
      const cell = worksheet.getCell(cellAddress);

      // 填充灰色背景
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      // 移除斜線格式
      if (cell.border) {
        cell.border = {
          top: cell.border.top,
          left: cell.border.left,
          bottom: cell.border.bottom,
          right: cell.border.right,
          diagonal: undefined,
          diagonalUp: false,
          diagonalDown: false
        };
      }
    }
  });
};

// 判斷日期和時間是否在處方有效範圍內
// 返回 true 表示在範圍內（不填灰色），返回 false 表示不在範圍內（填灰色）
const isDateInPrescriptionRange = (
  dateStr: string,
  timeSlot: string,
  prescription: any
): boolean => {
  const checkDate = new Date(dateStr);
  const startDate = prescription.start_date ? new Date(prescription.start_date) : null;
  const endDate = prescription.end_date ? new Date(prescription.end_date) : null;

  // 處理開始時間（如果沒有設定，預設為 00:00）
  // 標準化時間格式為 HH:MM，移除秒數
  const normalizeTime = (time: string | null | undefined): string => {
    if (!time) return '00:00';
    return time.substring(0, 5); // 取前5個字元 "HH:MM"
  };

  const startTime = normalizeTime(prescription.start_time) || '00:00';
  const endTime = normalizeTime(prescription.end_time) || '23:59';

  // 標準化服藥時間點格式
  const normalizedTimeSlot = normalizeTime(timeSlot);

  // 檢查是否在開始日期之前
  if (startDate) {
    if (checkDate < startDate) {
      // 完全在開始日期之前
      return false;
    }

    // 如果是開始日期當天，需要檢查時間點
    if (dateStr === prescription.start_date) {
      // 比較時間點：服藥時間點必須 >= 開始時間（包含開始時間）
      if (normalizedTimeSlot < startTime) {
        return false;
      }
    }
  }

  // 檢查是否在結束日期之後
  if (endDate) {
    if (checkDate > endDate) {
      // 完全在結束日期之後
      return false;
    }

    // 如果是結束日期當天，需要檢查時間點
    if (dateStr === prescription.end_date) {
      // 比較時間點：服藥時間點必須 <= 結束時間（包含結束時間）
      if (normalizedTimeSlot > endTime) {
        return false;
      }
    }
  }
  // 如果沒有結束日期，表示處方持續有效，不會因為日期過晚而變灰

  return true;
};

// 匯出個人備藥及給藥記錄
export const exportMedicationRecordToExcel = async (
  selectedPatients: any[],
  template: any,
  selectedMonth: string,
  filename?: string,
  includeWorkflowRecords: boolean = false
): Promise<void> => {
  try {
    console.log('開始匯出個人備藥及給藥記錄...');
    console.log('選擇的院友數量:', selectedPatients.length);

    if (!template.extracted_format) {
      throw new Error('範本格式無效');
    }

    const templateFormat = template.extracted_format as MedicationRecordTemplateFormat;

    if (!templateFormat.oral || !templateFormat.topical || !templateFormat.injection) {
      const missingSheets = [];
      if (!templateFormat.oral) missingSheets.push('口服');
      if (!templateFormat.topical) missingSheets.push('外用');
      if (!templateFormat.injection) missingSheets.push('注射');
      throw new Error('範本格式不完整：缺少 ' + missingSheets.join('、') + ' 工作表格式。請確保範本檔案包含三個工作表：「個人備藥及給藥記錄 (口服)」、「個人備藥及給藥記錄 (外用)」、「個人備藥及給藥記錄 (注射)」');
    }

    console.log('範本格式驗證通過，包含三種途徑的工作表格式');

    const workbook = new ExcelJS.Workbook();
    let totalOral = 0;
    let totalInjection = 0;
    let totalTopical = 0;
    let totalNoRoute = 0;
    let totalSheets = 0;

    // 為每位院友創建工作表
    for (const patient of selectedPatients) {
      console.log(`\n處理院友: ${patient.床號} ${patient.中文姓氏}${patient.中文名字}`);

      // 獲取該院友的所有處方
      const allPrescriptions = patient.prescriptions || [];
      console.log(`  總處方數: ${allPrescriptions.length}`);

      // 按途徑分類處方
      const categorized = categorizePrescriptionsByRoute(allPrescriptions);

      console.log(`  途徑分類結果:`);
      console.log(`    口服: ${categorized.oral.length} 個`);
      console.log(`    注射: ${categorized.injection.length} 個`);
      console.log(`    外用: ${categorized.topical.length} 個`);
      console.log(`    缺少途徑: ${categorized.noRoute.length} 個`);

      totalOral += categorized.oral.length;
      totalInjection += categorized.injection.length;
      totalTopical += categorized.topical.length;
      totalNoRoute += categorized.noRoute.length;

      if (categorized.noRoute.length > 0) {
        console.warn(`  警告: 以下處方缺少途徑資訊，將不會被匯出:`);
        categorized.noRoute.forEach((p: any) => {
          console.warn(`    - ${p.medication_name}`);
        });
      }

      // 創建口服工作表
      if (categorized.oral.length > 0) {
        const sheetName = patient.床號 + patient.中文姓氏 + patient.中文名字 + '(口服)';
        console.log(`\n📄 創建工作表: ${sheetName}`);
        console.log(`   途徑: 口服, 處方數量: ${categorized.oral.length}`);
        const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
        await applyMedicationRecordTemplate(worksheet, templateFormat.oral, patient, categorized.oral, selectedMonth, 'oral', includeWorkflowRecords);
        totalSheets++;
        console.log(`✓ 口服工作表創建完成`);
      }

      // 創建注射工作表
      if (categorized.injection.length > 0) {
        const sheetName = patient.床號 + patient.中文姓氏 + patient.中文名字 + '(注射)';
        console.log(`\n📄 創建工作表: ${sheetName}`);
        console.log(`   途徑: 注射, 處方數量: ${categorized.injection.length}`);
        const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
        await applyMedicationRecordTemplate(worksheet, templateFormat.injection, patient, categorized.injection, selectedMonth, 'injection', includeWorkflowRecords);
        totalSheets++;
        console.log(`✓ 注射工作表創建完成`);
      }

      // 創建外用工作表
      if (categorized.topical.length > 0) {
        const sheetName = patient.床號 + patient.中文姓氏 + patient.中文名字 + '(外用)';
        console.log(`\n📄 創建工作表: ${sheetName}`);
        console.log(`   途徑: 外用, 處方數量: ${categorized.topical.length}`);
        const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
        await applyMedicationRecordTemplate(worksheet, templateFormat.topical, patient, categorized.topical, selectedMonth, 'topical', includeWorkflowRecords);
        totalSheets++;
        console.log(`✓ 外用工作表創建完成`);
      }
    }

    if (workbook.worksheets.length === 0) {
      throw new Error('沒有可匯出的處方資料。所有處方可能都缺少途徑資訊或不符合匯出條件。');
    }

    console.log('\n匯出統計:');
    console.log(`  總共創建 ${totalSheets} 個工作表`);
    console.log(`  口服處方: ${totalOral} 個`);
    console.log(`  注射處方: ${totalInjection} 個`);
    console.log(`  外用處方: ${totalTopical} 個`);
    if (totalNoRoute > 0) {
      console.log(`  ⚠️ 警告: ${totalNoRoute} 個處方因缺少途徑資訊而未被匯出`);
    }

    // 生成檔案名稱
    const templateBaseName = template.original_name.replace(/\.(xlsx|xls)$/i, '');
    const finalFilename = filename ||
      (selectedPatients.length === 1
        ? selectedPatients[0].床號 + '_' + selectedPatients[0].中文姓氏 + selectedPatients[0].中文名字 + '_' + templateBaseName + '.xlsx'
        : templateBaseName + '_' + selectedPatients.length + '名院友.xlsx');

    // 儲存檔案
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, finalFilename);

    console.log('個人備藥及給藥記錄匯出完成:', finalFilename);

  } catch (error: any) {
    console.error('匯出個人備藥及給藥記錄失敗:', error);
    throw error;
  }
};

// 匯出選中的處方到個人備藥及給藥記錄
export const exportSelectedMedicationRecordToExcel = async (
  selectedPrescriptionIds: string[],
  currentPatient: any,
  allPrescriptions: any[],
  medicationTemplate: any,
  selectedMonth: string,
  includeInactive: boolean = false,
  includeWorkflowRecords: boolean = false
): Promise<void> => {
  try {
    console.log('開始匯出選中的處方到個人備藥及給藥記錄...');
    console.log('選中的處方數量:', selectedPrescriptionIds.length);
    console.log('當前院友:', currentPatient.中文姓氏 + currentPatient.中文名字);
    console.log('includeWorkflowRecords:', includeWorkflowRecords);

    if (!medicationTemplate.extracted_format) {
      throw new Error('範本格式無效');
    }

    const templateFormat = medicationTemplate.extracted_format as MedicationRecordTemplateFormat;

    if (!templateFormat.oral || !templateFormat.topical || !templateFormat.injection) {
      const missingSheets = [];
      if (!templateFormat.oral) missingSheets.push('口服');
      if (!templateFormat.topical) missingSheets.push('外用');
      if (!templateFormat.injection) missingSheets.push('注射');
      throw new Error('範本格式不完整：缺少 ' + missingSheets.join('、') + ' 工作表格式');
    }

    // 如果需要包含執核派記錄，查詢該月份有執核派記錄的處方
    let prescriptionsWithWorkflowRecords = new Set<string>();
    if (includeWorkflowRecords) {
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('medication_workflow_records')
        .select('prescription_id')
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd);

      if (!error && data) {
        prescriptionsWithWorkflowRecords = new Set(data.map(r => r.prescription_id));
        console.log('查詢到有執核派記錄的處方數量:', prescriptionsWithWorkflowRecords.size);
      }
    }

    // 判斷匯出模式
    const isExportAll = selectedPrescriptionIds.length === 0;
    console.log('匯出模式:', isExportAll ? '全部匯出' : '選中匯出');

    // 過濾處方
    let prescriptionsToExport: any[];

    if (isExportAll) {
      // 全部匯出模式：過濾該院友的所有符合條件的處方
      prescriptionsToExport = allPrescriptions.filter(p => {
        if (p.patient_id !== currentPatient.院友id) return false;
        if (p.status === 'pending_change') return false;
        if (p.status === 'inactive') {
          // 停用處方：需要明確包含或有執核派記錄
          if (!includeInactive && !(includeWorkflowRecords && prescriptionsWithWorkflowRecords.has(p.id))) {
            return false;
          }
        }
        return true;
      });
      console.log('全部匯出模式：共過濾出', prescriptionsToExport.length, '個處方');
    } else {
      // 選中匯出模式：只保留選中的處方並驗證
      prescriptionsToExport = allPrescriptions.filter(p => {
        if (!selectedPrescriptionIds.includes(p.id)) return false;
        if (p.patient_id !== currentPatient.院友id) return false;
        // 選中匯出模式不需要額外檢查停用狀態，因為已經被明確選中
        return true;
      });
      console.log('選中匯出模式：共過濾出', prescriptionsToExport.length, '個處方');

      if (prescriptionsToExport.length !== selectedPrescriptionIds.length) {
        console.warn('警告：部分選中的處方不屬於當前院友，已過濾');
      }
    }

    if (prescriptionsToExport.length === 0) {
      throw new Error('沒有可匯出的處方');
    }

    // 按途徑分類處方
    const categorized = categorizePrescriptionsByRoute(prescriptionsToExport);

    console.log('途徑分類結果:');
    console.log('  口服:', categorized.oral.length, '個');
    console.log('  注射:', categorized.injection.length, '個');
    console.log('  外用:', categorized.topical.length, '個');
    console.log('  缺少途徑:', categorized.noRoute.length, '個');

    if (categorized.noRoute.length > 0) {
      console.warn('警告: 以下處方缺少途徑資訊，將不會被匯出:');
      categorized.noRoute.forEach((p: any) => {
        console.warn('  -', p.medication_name);
      });
    }

    // 創建工作簿
    const workbook = new ExcelJS.Workbook();
    let totalSheets = 0;

    // 創建口服工作表
    if (categorized.oral.length > 0) {
      const sheetName = currentPatient.床號 + currentPatient.中文姓氏 + currentPatient.中文名字 + '(口服)';
      console.log('創建工作表:', sheetName);
      const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
      await applyMedicationRecordTemplate(worksheet, templateFormat.oral, currentPatient, categorized.oral, selectedMonth, 'oral', includeWorkflowRecords);
      totalSheets++;
    }

    // 創建注射工作表
    if (categorized.injection.length > 0) {
      const sheetName = currentPatient.床號 + currentPatient.中文姓氏 + currentPatient.中文名字 + '(注射)';
      console.log('創建工作表:', sheetName);
      const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
      await applyMedicationRecordTemplate(worksheet, templateFormat.injection, currentPatient, categorized.injection, selectedMonth, 'injection', includeWorkflowRecords);
      totalSheets++;
    }

    // 創建外用工作表
    if (categorized.topical.length > 0) {
      const sheetName = currentPatient.床號 + currentPatient.中文姓氏 + currentPatient.中文名字 + '(外用)';
      console.log('創建工作表:', sheetName);
      const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
      await applyMedicationRecordTemplate(worksheet, templateFormat.topical, currentPatient, categorized.topical, selectedMonth, 'topical', includeWorkflowRecords);
      totalSheets++;
    }

    if (workbook.worksheets.length === 0) {
      throw new Error('沒有可匯出的處方資料。所有處方可能都缺少途徑資訊。');
    }

    console.log('匯出統計:');
    console.log('  總共創建', totalSheets, '個工作表');
    console.log('  口服處方:', categorized.oral.length, '個');
    console.log('  注射處方:', categorized.injection.length, '個');
    console.log('  外用處方:', categorized.topical.length, '個');
    if (categorized.noRoute.length > 0) {
      console.log('  ⚠️ 警告:', categorized.noRoute.length, '個處方因缺少途徑資訊而未被匯出');
    }

    // 生成檔案名稱
    const templateBaseName = medicationTemplate.original_name.replace(/\.(xlsx|xls)$/i, '');
    const modeText = isExportAll ? '全部' : '已選' + prescriptionsToExport.length + '個';
    const finalFilename = currentPatient.床號 + '_' + currentPatient.中文姓氏 + currentPatient.中文名字 +
      '_' + modeText + '_' + templateBaseName + '.xlsx';

    // 儲存檔案
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, finalFilename);

    console.log('選中處方的個人備藥及給藥記錄匯出完成:', finalFilename);

  } catch (error: any) {
    console.error('匯出選中處方失敗:', error);
    throw error;
  }
};
