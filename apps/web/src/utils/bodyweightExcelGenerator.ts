import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';

interface BodyweightExportData {
  記錄id?: number;
  床號: string;
  中文姓氏: string;
  中文名字: string;
  中文姓名?: string; // Legacy field for compatibility
  性別: string;
  出生日期: string;
  記錄日期: string;
  記錄時間: string;
  體重?: number;
  備註?: string;
  記錄人員?: string;
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
  };
  records: BodyweightExportData[];
}

// 從範本文件提取格式
export const extractBodyweightTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
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
    images: []
  };

  // 提取欄寬 (A 到 L = 1 到 12)
  for (let col = 1; col <= 12; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  // 提取列高 (1 到 50)
  for (let row = 1; row <= 50; row++) {
    let height = worksheet.getRow(row).height;
    if (height === null || height === undefined) height = 15;
    extractedTemplate.rowHeights.push(Math.round(height * 100) / 100);
  }

  // 提取合併儲存格（僅表頭）
  if (worksheet.model && worksheet.model.merges) {
    worksheet.model.merges.forEach(merge => {
      const rowNum = parseInt(merge.match(/\d+/)?.[0] || '0');
      if (rowNum <= 5) {
        extractedTemplate.mergedCells.push(merge);
      }
    });
    console.log(`提取表頭合併儲存格: ${extractedTemplate.mergedCells.join(', ') || '無'}`);
  }

  // 提取列印設定
  if (worksheet.pageSetup) {
    extractedTemplate.printSettings = { ...worksheet.pageSetup };
    console.log(`提取列印設定:`, JSON.stringify(extractedTemplate.printSettings));
  }

  // 提取儲存格資料 (A1:L50，僅表頭)
  for (let row = 1; row <= 50; row++) {
    for (let col = 1; col <= 12; col++) {
      const cell = worksheet.getCell(row, col);
      const address = cell.address;

      const cellData: any = {};

      // 提取值
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        cellData.value = cell.value;
      }

      // 提取字型
      if (cell.font) {
        cellData.font = { ...cell.font };
      }

      // 提取對齊方式
      if (cell.alignment) {
        cellData.alignment = { ...cell.alignment };
      }

      // 提取邊框（僅表頭）
      if (cell.border && row <= 5) {
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

      // 提取填充
      if (cell.fill) {
        cellData.fill = { ...cell.fill };
      }

      // 提取數字格式
      if (cell.numFmt) {
        cellData.numFmt = cell.numFmt;
      }

      // 僅儲存有屬性的儲存格資料
      if (Object.keys(cellData).length > 0) {
        extractedTemplate.cellData[address] = cellData;
      }
    }
  }

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

// 計算體重變化（使用最遠記錄邏輯）
const calculateWeightChange = (currentWeight: number, allRecords: BodyweightExportData[], currentDate: string, patientBedNumber: string): string => {
  // 篩選出該院友的所有體重記錄，根據記錄時間排序（最早到最晚）
  const patientRecords = allRecords
    .filter(r => r.床號 === patientBedNumber && typeof r.體重 === 'number')
    .map(r => ({ 體重: r.體重, 記錄日期: r.記錄日期, 記錄時間: r.記錄時間 }))
    .sort((a, b) => new Date(`${a.記錄日期} ${a.記錄時間}`).getTime() - new Date(`${b.記錄日期} ${b.記錄時間}`).getTime());

  // 如果沒有其他記錄，這是最遠記錄
  if (patientRecords.length === 0) {
    return '最遠記錄';
  }

  // 找到最遠記錄（最早的記錄）
  const earliestRecord = patientRecords[0];
  
  // 檢查當前記錄是否比最遠記錄更早
  const currentDateTime = new Date(`${currentDate} 00:00`).getTime();
  const earliestDateTime = new Date(`${earliestRecord.記錄日期} ${earliestRecord.記錄時間}`).getTime();
  
  if (currentDateTime <= earliestDateTime) {
    return '最遠記錄';
  }
  
  // 找到當前記錄時間之前最近的記錄
  const previousRecords = patientRecords.filter(r => 
    new Date(`${r.記錄日期} ${r.記錄時間}`).getTime() < currentDateTime
  );
  
  if (previousRecords.length === 0) {
    return '最遠記錄';
  }

  // 取最近的前一筆記錄
  const previousRecord = previousRecords[previousRecords.length - 1];
  const difference = currentWeight - previousRecord.體重!;

  if (difference === 0) {
    return '無變化';
  }

  const percentage = (difference / previousRecord.體重!) * 100;
  const sign = difference > 0 ? '+' : '';
  return `${sign}${difference.toFixed(1)}kg (${sign}${percentage.toFixed(1)}%)`;
};

// 應用範本格式並填入體重記錄資料
const applyBodyweightTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: {
    床號: string;
    中文姓名: string;
    性別: string;
    出生日期: string;
  },
  records: BodyweightExportData[],
  pageNumber?: number
): void => {
  console.log('=== 開始應用體重記錄表範本格式 ===');

  // Step 1: 設置欄寬
  template.columnWidths.forEach((width, idx) => {
    if (idx < 12) {
      worksheet.getColumn(idx + 1).width = width;
      console.log(`設置欄 ${idx + 1} 寬度: ${width}`);
    }
  });

  // Step 2: 設置表頭列高（1 到 5）
  template.rowHeights.forEach((height, idx) => {
    if (idx < 5) {
      worksheet.getRow(idx + 1).height = height;
      console.log(`設置表頭第 ${idx + 1} 行列高: ${height}`);
    }
  });

  // Step 3: 應用表頭儲存格資料（1-5 行：值、字型、對齊、邊框、填充）
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const rowNum = parseInt(address.match(/\d+/)?.[0] || '0');
    if (rowNum <= 5) {
      const cell = worksheet.getCell(address);

      // 應用值
      if (cellData.value !== undefined) {
        cell.value = cellData.value;
      }

      // 應用字型
      if (cellData.font) {
        cell.font = { ...cellData.font };
      }

      // 應用對齊方式
      if (cellData.alignment) {
        cell.alignment = { 
          ...cellData.alignment,
         horizontal: cellData.alignment.horizontal || 'center',
         vertical: 'bottom'
        };
      }

      // 應用邊框
      if (cellData.border) {
        cell.border = { ...cellData.border };
      }

      // 應用填充
      if (cellData.fill) {
        cell.fill = { ...cellData.fill };
      }

      // 應用數字格式
      if (cellData.numFmt) {
        cell.numFmt = cellData.numFmt;
      }
      console.log(`應用表頭儲存格 ${address} 格式`);
    }
  });

  // Step 3.5: 強制設置表頭所有單元格置中對齊
  console.log('第3.5步: 強制設置表頭所有單元格置中對齊...');
  for (let row = 1; row <= 5; row++) {
    for (let col = 1; col <= 12; col++) {
      const cell = worksheet.getCell(row, col);
      // 強制設置所有表頭單元格置中對齊，無論是否有內容
      cell.alignment = {
       horizontal: 'center',
       vertical: 'bottom'
      };
      console.log(`強制設置 ${cell.address} 置中對齊`);
    }
  }

  // Step 4: 應用表頭合併儲存格
  console.log('第4步: 應用表頭合併儲存格...');
  template.mergedCells.forEach(merge => {
    try {
      worksheet.mergeCells(merge);
      console.log(`應用合併儲存格: ${merge}`);
    } catch (error) {
      console.warn(`合併儲存格失敗 (${merge}):`, error);
    }
  });

  // Step 5: 硬編碼設置 G5:L5 合併格右邊框為黑色細邊框
  console.log('第5步: 硬編碼設置 G5:L5 合併格右邊框...');
  const g5l5Cell = worksheet.getCell('L5');
  g5l5Cell.border = {
    ...g5l5Cell.border,
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };
  console.log('為 G5:L5 合併格右邊設置黑色細邊框');

  // Step 6: 應用圖片
  console.log('第6步: 應用圖片...');
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

  // Step 7: 填充院友表頭資料
  console.log('第7步: 填充院友表頭資料...');
  if (patient) {
    worksheet.getCell('B3').value = `${patient.中文姓氏}${patient.中文名字}` || '';
    worksheet.getCell('D3').value = patient.床號 || '';
    worksheet.getCell('H3').value = patient.性別 || '';
    if (patient.出生日期) {
      const age = calculateAge(patient.出生日期);
      worksheet.getCell('J3').value = `${age}歲`;
    }
    // 填充頁數到 L3
    if (pageNumber !== undefined) {
      worksheet.getCell('L3').value = String(pageNumber);
      console.log(`填充頁數到 L3: ${pageNumber}`);
    }
    console.log(`填充院友資料: 姓名=${patient.中文姓氏}${patient.中文名字}, 床號=${patient.床號}, 性別=${patient.性別}`);
  }

  // Step 8: 填充體重記錄資料（從第6行開始）
  console.log('第8步: 填充體重記錄資料...');
  records.forEach((record, index) => {
    const rowIndex = 6 + index;

    // 設置資料行列高
    worksheet.getRow(rowIndex).height = 22;
    console.log(`設置第${rowIndex}行列高: 22`);

    // 硬編碼合併儲存格
    try {
      worksheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
      console.log(`硬編碼合併 A${rowIndex}:B${rowIndex}`);
      worksheet.mergeCells(`C${rowIndex}:F${rowIndex}`);
      console.log(`硬編碼合併 C${rowIndex}:F${rowIndex}`);
      worksheet.mergeCells(`G${rowIndex}:H${rowIndex}`);
      console.log(`硬編碼合併 G${rowIndex}:H${rowIndex}`);
      worksheet.mergeCells(`I${rowIndex}:L${rowIndex}`);
      console.log(`硬編碼合併 I${rowIndex}:L${rowIndex}`);
    } catch (error) {
      console.warn(`硬編碼合併儲存格失敗 (行=${rowIndex}):`, error);
    }

    // 硬編碼四邊黑色細邊框（A 到 L）並設置置中
    const dataColumns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    dataColumns.forEach(col => {
      const cell = worksheet.getCell(`${col}${rowIndex}`);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
      if (col === 'A') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        console.log(`為第${rowIndex}行 ${col} 設置日期時間置中對齊`);
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        console.log(`為第${rowIndex}行 ${col} 設置置中對齊`);
      }
    });

    // 填充資料，考慮硬編碼合併儲存格
    const getTargetCell = (col: string, row: number): string => {
      if (['A', 'B'].includes(col)) {
        console.log(`欄 ${col}${row} 在 AB 合併範圍內，寫入 A${row}`);
        return `A${row}`;
      }
      if (['C', 'D', 'E', 'F'].includes(col)) {
        console.log(`欄 ${col}${row} 在 CDEF 合併範圍內，寫入 C${row}`);
        return `C${row}`;
      }
      if (['G', 'H'].includes(col)) {
        console.log(`欄 ${col}${row} 在 GH 合併範圍內，寫入 G${row}`);
        return `G${row}`;
      }
      if (['I', 'J', 'K', 'L'].includes(col)) {
        console.log(`欄 ${col}${row} 在 IJKL 合併範圍內，寫入 I${row}`);
        return `I${row}`;
      }
      return `${col}${row}`;
    };

    // A: 日期時間 (YYYY-MM-DD HH:MM)
    // AB: 日期時間 (AB 合併)
    const dateTimeStr = `${record.記錄日期} ${record.記錄時間.slice(0, 5)}`;
    worksheet.getCell(getTargetCell('A', rowIndex)).value = dateTimeStr;

    // C: 體重 (CDEF 合併)
    worksheet.getCell(getTargetCell('C', rowIndex)).value = record.體重 || '';

    // G: 體重變化 (GH 合併)
    let weightChange = '';
    if (record.體重) {
      weightChange = calculateWeightChange(record.體重, records, record.記錄日期, patient.床號);
    }
    worksheet.getCell(getTargetCell('G', rowIndex)).value = weightChange;

    // I: 備註 (IJKL 合併)
    worksheet.getCell(getTargetCell('I', rowIndex)).value = record.備註 || '';

    console.log(`填充第${rowIndex}行資料完成`);
  });

  // Step 9: 設置動態列印範圍
  console.log('第9步: 設置動態列印範圍...');
  const lastRow = 6 + records.length - 1;
  const printArea = `A1:L${lastRow}`;
  worksheet.pageSetup = {
    ...template.printSettings,
    printArea: printArea
  };
  console.log(`設置列印範圍: ${printArea}`);

  console.log('=== 體重記錄表範本格式應用完成 ===');
};

// 創建體重記錄表工作簿
const createBodyweightWorkbook = async (
  sheetsConfig: SheetConfig[]
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();

  for (let i = 0; i < sheetsConfig.length; i++) {
    const config = sheetsConfig[i];
    console.log(`創建體重記錄表工作表: ${config.name}`);
    const worksheet = workbook.addWorksheet(config.name);

    applyBodyweightTemplateFormat(worksheet, config.template, config.patient, config.records, i + 1);
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
  console.log(`體重記錄表 Excel 檔案 ${filename} 保存成功`);
};

// 匯出體重記錄表到 Excel
export const exportBodyweightToExcel = async (
  records: BodyweightExportData[],
  patients: any[],
  filename?: string
): Promise<void> => {
  try {
    // 從 Supabase 獲取體重記錄表範本
    const templatesData = await getTemplatesMetadata();
    const bodyweightTemplate = templatesData.find(t => t.type === 'weight-control');

    if (!bodyweightTemplate || !bodyweightTemplate.extracted_format ||
        typeof bodyweightTemplate.extracted_format !== 'object') {
      console.warn('無有效範本或格式，使用簡單匯出方式');
      await exportBodyweightToExcelSimple(records, patients, filename);
      return;
    }

    const extractedFormat = bodyweightTemplate.extracted_format;

    // 檢查範本格式是否有效
    if (!extractedFormat.cellData || !extractedFormat.columnWidths || !extractedFormat.rowHeights) {
      console.warn('範本格式無效，使用簡單匯出方式');
      await exportBodyweightToExcelSimple(records, patients, filename);
      return;
    }

    // 確保 images 屬性存在
    if (!Array.isArray(extractedFormat.images)) {
      console.warn('extractedFormat.images 不是陣列，初始化為空陣列');
      extractedFormat.images = [];
    }

    // 按院友分組記錄
    const groupedRecords: { [key: string]: BodyweightExportData[] } = {};
    records.forEach(record => {
      const key = `${record.床號}_${record.中文姓名}`;
      if (!groupedRecords[key]) {
        groupedRecords[key] = [];
      }
      groupedRecords[key].push(record);
    });

    // 構建工作表配置
    const sheetsConfig: SheetConfig[] = [];
    Object.entries(groupedRecords).forEach(([key, recordGroup]) => {
      const firstRecord = recordGroup[0];
      const patient = patients.find(p => p.床號 === firstRecord.床號 && `${p.中文姓氏}${p.中文名字}` === `${firstRecord.中文姓氏}${firstRecord.中文名字}`);

      if (patient) {
        sheetsConfig.push({
          name: `${firstRecord.床號}${firstRecord.中文姓氏}${firstRecord.中文名字}體重記錄表`,
          template: extractedFormat,
          patient: {
            床號: patient.床號,
            中文姓氏: patient.中文姓氏,
            中文名字: patient.中文名字,
            性別: patient.性別,
            出生日期: patient.出生日期
          },
          records: recordGroup.sort((a, b) =>
            new Date(`${a.記錄日期} ${a.記錄時間}`).getTime() -
            new Date(`${b.記錄日期} ${b.記錄時間}`).getTime()
          )
        });
      }
    });

    if (sheetsConfig.length === 0) {
      alert('沒有可匯出的體重記錄資料');
      return;
    }

    // 決定檔案名稱
    const finalFilename = filename ||
      (sheetsConfig.length === 1
        ? `${sheetsConfig[0].patient.床號}_${sheetsConfig[0].patient.中文姓氏}${sheetsConfig[0].patient.中文名字}_體重記錄表.xlsx`
        : `體重記錄表(${sheetsConfig.length}名院友).xlsx`);

    // 創建工作簿並匯出
    const workbook = await createBodyweightWorkbook(sheetsConfig);
    await saveExcelFile(workbook, finalFilename);

  } catch (error) {
    console.error('匯出體重記錄表失敗:', error);
    throw error;
  }
};

// 簡單的體重記錄表匯出（當沒有範本時使用）
const exportBodyweightToExcelSimple = async (
  records: BodyweightExportData[],
  patients: any[],
  filename?: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();

  // 按院友分組記錄
  const groupedRecords: { [key: string]: BodyweightExportData[] } = {};
  records.forEach(record => {
    const key = `${record.床號}_${record.中文姓名}`;
    if (!groupedRecords[key]) {
      groupedRecords[key] = [];
    }
    groupedRecords[key].push(record);
  });

  // 為每個院友創建工作表
  Object.entries(groupedRecords).forEach(([key, recordGroup]) => {
    const firstRecord = recordGroup[0];
    const patient = patients.find(p => p.床號 === firstRecord.床號 && `${p.中文姓氏}${p.中文名字}` === `${firstRecord.中文姓氏}${firstRecord.中文名字}`);

    if (!patient) return;

    const sheetName = `${firstRecord.床號}${firstRecord.中文姓氏}${firstRecord.中文名字}體重記錄表`;
    const worksheet = workbook.addWorksheet(sheetName);

    // 設定欄寬
    worksheet.columns = [
      { width: 18 }, // 日期時間 (A)
      { width: 8 },  // B
      { width: 12 }, // 體重 (CDEF)
      { width: 8 },
      { width: 8 },
      { width: 8 },
      { width: 15 }, // 體重變化 (GH)
      { width: 8 },
      { width: 20 }, // 備註 (IJKL)
      { width: 8 },
      { width: 8 },
      { width: 8 }
    ];

    // 標題
    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${patient.中文姓氏}${patient.中文名字} 體重記錄表`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F7FF' }
    };

    // 院友資訊
    worksheet.getCell('A3').value = `院友姓名: ${patient.中文姓氏}${patient.中文名字}`;
    worksheet.getCell('C3').value = `床號: ${patient.床號}`;
    worksheet.getCell('F3').value = `性別: ${patient.性別}`;
    if (patient.出生日期) {
      const age = calculateAge(patient.出生日期);
      worksheet.getCell('I3').value = `年齡: ${age}歲`;
    }

    // 表頭
    const headers = ['日期時間', '', '體重(kg)', '', '', '', '體重變化', '', '備註', '', '', ''];
    const headerRow = worksheet.getRow(5);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (index < 12) { // A 到 L
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      }
      if (index === 11) { // L5
        cell.border = {
          ...cell.border,
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        console.log(`設置簡單匯出 ${cell.address} 右邊框為黑色細邊框`);
      }
    });

    // 強制設置所有表頭單元格置中對齊
    for (let col = 1; col <= 12; col++) {
      const cell = headerRow.getCell(col);
     cell.alignment = { horizontal: 'center', vertical: 'bottom' };
    }

    // 合併表頭中的 CDEF、GH、IJKL
    worksheet.mergeCells('A5:B5');
    worksheet.mergeCells('C5:F5');
    worksheet.mergeCells('G5:H5');
    worksheet.mergeCells('I5:L5');
    console.log('簡單匯出設置表頭合併: A5:B5, C5:F5, G5:H5, I5:L5');

    // 資料行
    const sortedRecords = recordGroup.sort((a, b) =>
      new Date(`${a.記錄日期} ${a.記錄時間}`).getTime() -
      new Date(`${b.記錄日期} ${b.記錄時間}`).getTime()
    );

    sortedRecords.forEach((record, index) => {
      const rowIndex = 6 + index;
      const row = worksheet.getOrCreateRow(rowIndex);
      row.height = 22;
      console.log(`設置簡單匯出第${rowIndex}行列高: 22`);

      // 硬編碼合併儲存格
      worksheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
      worksheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
      worksheet.mergeCells(`C${rowIndex}:F${rowIndex}`);
      worksheet.mergeCells(`G${rowIndex}:H${rowIndex}`);
      worksheet.mergeCells(`I${rowIndex}:L${rowIndex}`);
      console.log(`簡單匯出硬編碼合併 A${rowIndex}:B${rowIndex}, C${rowIndex}:F${rowIndex}, G${rowIndex}:H${rowIndex}, I${rowIndex}:L${rowIndex}`);

      // 硬編碼邊框（A 到 L）並設置置中
      for (let col = 1; col <= 12; col++) {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        if (col === 1) { // A 欄
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          console.log(`為第${rowIndex}行 A 欄設置日期時間置中對齊`);
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          console.log(`為第${rowIndex}行 ${col} 設置置中對齊`);
        }
      }

      // 計算體重變化
      let weightChange = '';
      if (record.體重) {
        weightChange = calculateWeightChange(record.體重, sortedRecords, record.記錄日期, patient.床號);
      }

      const values = [
        `${record.記錄日期} ${record.記錄時間.slice(0, 5)}`, // A (AB 合併)
        '', // B (與A合併)
        record.體重 || '', // C
        '', // D
        '', // E
        '', // F
        weightChange, // G
        '', // H
        record.備註 || '', // I
        '', // J
        '', // K
        ''  // L
      ];

      values.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;
        // 交替行顏色
        if (index % 2 === 1 && colIndex < 12) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' }
          };
        }
      });
    });

    // 設置動態列印範圍
    const lastRow = 6 + sortedRecords.length - 1;
    worksheet.pageSetup.printArea = `A1:L${lastRow}`;
    console.log(`簡單匯出設置列印範圍: A1:L${lastRow}`);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const finalFilename = filename || `體重記錄表_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, finalFilename);
  console.log(`體重記錄表 Excel 檔案 ${finalFilename} 匯出成功`);
};