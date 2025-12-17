import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';

export interface HealthRecordExportData {
  記錄id?: number;
  床號: string;
  中文姓氏: string;
  中文名字: string;
  中文姓名?: string; // Legacy field for compatibility
  記錄日期: string;
  記錄時間: string;
  記錄類型: '生命表徵' | '血糖控制' | '體重控制';
  血壓收縮壓?: number;
  血壓舒張壓?: number;
  脈搏?: number;
  體溫?: number;
  血含氧量?: number;
  呼吸頻率?: number;
  血糖值?: number;
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
  records: HealthRecordExportData[];
  recordType: '生命表徵' | '血糖控制' | '體重控制';
}

// 從範本文件提取格式
const extractHealthRecordTemplateFormat = async (templateFile: File): Promise<ExtractedTemplate> => {
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

  // Extract column widths (A to P = 1 to 16)
  for (let col = 1; col <= 16; col++) {
    let width = worksheet.getColumn(col).width;
    if (width === null || width === undefined) width = 8.43;
    extractedTemplate.columnWidths.push(Math.round(width * 100) / 100);
  }

  // Extract row heights (1 to 50)
  for (let row = 1; row <= 50; row++) {
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

  // Extract cell data (A1:P50)
  for (let row = 1; row <= 50; row++) {
    for (let col = 1; col <= 16; col++) {
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

// 應用範本格式並填入監測記錄資料
const applyHealthRecordTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: {
    床號: string;
    中文姓氏: string;
    中文名字: string;
    性別: string;
    出生日期: string;
  },
  records: HealthRecordExportData[],
  recordType: '生命表徵' | '血糖控制' | '體重控制'
): void => {
  console.log(`=== 開始應用${recordType}範本格式 ===`);
  
  // Step 1: Set column widths
  template.columnWidths.forEach((width, idx) => {
    if (idx < 16) {
      worksheet.getColumn(idx + 1).width = width;
    }
  });

  // Step 2: Set row heights
  template.rowHeights.forEach((height, idx) => {
    if (idx < 50) {
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

  // Step 5: Fill patient header data
  console.log('第5步: 填充院友表頭資料...');
  if (patient) {
    // 填充院友基本資訊到表頭 (假設表頭在前幾行)
    worksheet.getCell('B3').value = `${patient.中文姓氏}${patient.中文名字}` || '';
    worksheet.getCell('D3').value = patient.床號 || '';
    worksheet.getCell('H3').value = patient.性別 || '';
    if (patient.出生日期) {
      const age = calculateAge(patient.出生日期);
      worksheet.getCell('J3').value = `${age}歲`;
    }
    console.log(`填充院友資料: 姓名=${patient.中文姓氏}${patient.中文名字}, 床號=${patient.床號}, 性別=${patient.性別}`);
  }

  // Step 6: Fill record data starting from row 6 (after header)
  console.log('第6步: 填充監測記錄資料...');
  records.forEach((record, index) => {
    const rowIndex = 6 + index;
    
    // 設置資料行列高
    worksheet.getRow(rowIndex).height = 22;
  
    // A: 序號
    //worksheet.getCell(`A${rowIndex}`).value = index + 1;
    
    // B: 記錄日期
    worksheet.getCell(`A${rowIndex}`).value = new Date(record.記錄日期).toLocaleDateString('zh-TW');
    
    // C: 記錄時間
    if (recordType !== '體重控制') {
      worksheet.getCell(`B${rowIndex}`).value = record.記錄時間.slice(0, 5);
    }
    
    // 根據記錄類型填入不同欄位
    if (recordType === '生命表徵') {
      // 填充資料，考慮硬編碼合併儲存格
      const getTargetCell = (col: string, row: number): string => {
        if (['F', 'G', 'H'].includes(col)) {
          console.log(`欄 ${col}${row} 在 FGH 合併範圍內，寫入 F${row}`);
          return `F${row}`;
        }
        if (['L', 'M'].includes(col)) {
          console.log(`欄 ${col}${row} 在 LM 合併範圍內，寫入 L${row}`);
          return `L${row}`;
        }
        return `${col}${row}`;
      };

      // A: 日期
      worksheet.getCell(`A${rowIndex}`).value = record.記錄日期 || '';
      
      // B: 時間
      worksheet.getCell(`B${rowIndex}`).value = record.記錄時間.slice(0, 5) || '';
      
      // C: 體溫
      worksheet.getCell(`C${rowIndex}`).value = record.體溫 || '';
      
      // F: 血壓 (FGH 合併)
      let bloodPressure = '';
      if (record.血壓收縮壓 && record.血壓舒張壓) {
        bloodPressure = `${record.血壓收縮壓}/${record.血壓舒張壓}`;
      } else if (record.血壓收縮壓) {
        bloodPressure = `${record.血壓收縮壓}/-`;
      } else if (record.血壓舒張壓) {
        bloodPressure = `-/${record.血壓舒張壓}`;
      }
      worksheet.getCell(getTargetCell('F', rowIndex)).value = bloodPressure;
      
      // I: 脈搏
      worksheet.getCell(`I${rowIndex}`).value = record.脈搏 || '';
      
      // J: 呼吸頻率
      worksheet.getCell(`J${rowIndex}`).value = record.呼吸頻率 || '';
      
      // K: 血含氧量
      worksheet.getCell(`K${rowIndex}`).value = record.血含氧量 || '';
      
      // L: 備註 (LM 合併)
      worksheet.getCell(getTargetCell('L', rowIndex)).value = record.備註 || '';
      
    } else if (recordType === '血糖控制') {
      // C: 血糖值
      worksheet.getCell(`C${rowIndex}`).value = record.血糖值 || '';
      
    } else if (recordType === '體重控制') {
      // 硬編碼合併儲存格
      try {
        worksheet.mergeCells(`F${rowIndex}:H${rowIndex}`);
        console.log(`硬編碼合併 F${rowIndex}:H${rowIndex}`);
        worksheet.mergeCells(`L${rowIndex}:M${rowIndex}`);
        console.log(`硬編碼合併 L${rowIndex}:M${rowIndex}`);
      } catch (error) {
        console.warn(`硬編碼合併儲存格失敗 (行=${rowIndex}):`, error);
      }

      // 硬編碼四邊黑色細邊框（A 到 M）並設置對齊
      const dataColumns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
      dataColumns.forEach(col => {
        const cell = worksheet.getCell(`${col}${rowIndex}`);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        console.log(`為第${rowIndex}行 ${col} 設置硬編碼黑色細邊框和置中對齊`);
      });

      // A: 日期
      worksheet.getCell(`A${rowIndex}`).value = record.記錄日期 || '';
      
      // B: 時間
      worksheet.getCell(`B${rowIndex}`).value = record.記錄時間.slice(0, 5) || '';
      
      // C: 體溫
      worksheet.getCell(`C${rowIndex}`).value = record.體溫 || '';
      
      // F: 血壓 (FGH 合併)
      let bloodPressure = '';
      if (record.血壓收縮壓 && record.血壓舒張壓) {
        bloodPressure = `${record.血壓收縮壓}/${record.血壓舒張壓}`;
      } else if (record.血壓收縮壓) {
        bloodPressure = `${record.血壓收縮壓}/-`;
      } else if (record.血壓舒張壓) {
        bloodPressure = `-/${record.血壓舒張壓}`;
      }
      worksheet.getCell(getTargetCell('F', rowIndex)).value = bloodPressure;
      
      // I: 脈搏
      worksheet.getCell(`I${rowIndex}`).value = record.脈搏 || '';
      
      // J: 呼吸頻率
      worksheet.getCell(`J${rowIndex}`).value = record.呼吸頻率 || '';
      
      // K: 血含氧量
      worksheet.getCell(`K${rowIndex}`).value = record.血含氧量 || '';
      
      // L: 備註 (LM 合併)
      worksheet.getCell(getTargetCell('L', rowIndex)).value = record.備註 || '';
    }
    
    // 記錄人員欄位
    if (recordType === '生命表徵') {
      // 生命表徵的記錄人員不在表格中顯示，或者可以放在最後一欄
      // worksheet.getCell(`H${rowIndex}`).value = record.記錄人員 || '';
    } else if (recordType === '血糖控制') {
      worksheet.getCell(`E${rowIndex}`).value = record.備註 || '';
      worksheet.getCell(`F${rowIndex}`).value = record.記錄人員 || '';
    } else if (recordType === '體重控制') {
      worksheet.getCell(`D${rowIndex}`).value = record.備註 || '';
      worksheet.getCell(`E${rowIndex}`).value = record.記錄人員 || '';
    }
    
    console.log(`填充第${rowIndex}行資料完成`);
  });

  // Step 7: Copy print settings from template
  console.log('第7步: 複製列印設定...');
  if (template.printSettings) {
    try {
      worksheet.pageSetup = { ...template.printSettings };
    } catch (error) {
      console.warn('複製列印設定失敗:', error);
    }
  }
  
  console.log(`=== ${recordType}範本格式應用完成 ===`);
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

// 創建監測記錄工作簿
const createHealthRecordWorkbook = async (
  sheetsConfig: SheetConfig[]
): Promise<ExcelJS.Workbook> => {
  console.log(`🏗️ 開始創建工作簿，共 ${sheetsConfig.length} 個工作表`);
  const workbook = new ExcelJS.Workbook();

  for (let i = 0; i < sheetsConfig.length; i++) {
    const config = sheetsConfig[i];
    console.log(`📊 創建工作表 ${i + 1}/${sheetsConfig.length}: ${config.name} (${config.records.length} 筆記錄)`);
    
    try {
      // 創建工作表名稱，確保符合 Excel 限制
      let sheetName = config.name;
      if (sheetName.length > 31) {
        const parts = sheetName.split('_');
        if (parts.length >= 3) {
          sheetName = `${parts[0]}_${parts[1].substring(0, 10)}_${parts[2].substring(0, 4)}`;
        } else {
          sheetName = sheetName.substring(0, 31);
        }
      }
      
      // 確保工作表名稱唯一
      let finalSheetName = sheetName;
      let counter = 1;
      while (workbook.getWorksheet(finalSheetName)) {
        finalSheetName = `${sheetName.substring(0, 28)}_${counter}`;
        counter++;
      }
      
      console.log(`📝 創建工作表: ${finalSheetName}`);
      const worksheet = workbook.addWorksheet(finalSheetName);
      
      // 深度複製範本以避免引用問題
      const templateCopy = JSON.parse(JSON.stringify(config.template));
      
      console.log(`🎨 應用範本格式...`);
      applyHealthRecordTemplateFormat(
        worksheet, 
        templateCopy, 
        config.patient, 
        config.records, 
        config.recordType
      );
      
      console.log(`✅ 工作表 ${finalSheetName} 創建完成`);
      
    } catch (error) {
      console.error(`❌ 創建工作表 ${config.name} 失敗:`, error);
      // 不要因為單個工作表失敗就停止整個匯出
      // 創建一個簡單的錯誤工作表
      const errorSheet = workbook.addWorksheet(`錯誤_${config.patient.床號}_${config.patient.中文姓氏}${config.patient.中文名字}`);
      errorSheet.getCell('A1').value = `創建 ${config.patient.中文姓氏}${config.patient.中文名字} 的工作表時發生錯誤: ${error.message}`;
      continue;
    }
  }
  
  console.log(`🎉 工作簿創建完成，共 ${workbook.worksheets.length} 個工作表`);
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
  console.log(`監測記錄 Excel 檔案 ${filename} 保存成功`);
};

// 匯出監測記錄到 Excel
export const exportHealthRecordsToExcel = async (
  records: HealthRecordExportData[],
  patients: any[],
  recordType: '生命表徵' | '血糖控制' | '體重控制',
  filename?: string
): Promise<void> => {
  try {
    console.log(`=== 開始匯出${recordType}記錄 ===`, {
      recordCount: records.length,
      patientCount: patients.length,
      recordType,
      estimatedSize: `${(records.length * 0.5 / 1024).toFixed(2)} MB`
    });
    
    // 從 Supabase 獲取對應的範本
    const templatesData = await getTemplatesMetadata();
    const templateTypeMap = {
      '生命表徵': 'vital-signs',
      '血糖控制': 'blood-sugar',
      '體重控制': 'weight-control'
    };
    
    const templateType = templateTypeMap[recordType];
    const template = templatesData.find(t => t.type === templateType);
    
    // Validate data before sending to worker
    if (!records || records.length === 0) {
      throw new Error('沒有記錄可匯出');
    }
    
    if (!patients || patients.length === 0) {
      throw new Error('找不到院友資料');
    }
    
    // Check if this is a large export that needs special handling
    const isLargeExport = records.length > 1000 || patients.length > 50;
    console.log(`資料量評估: ${isLargeExport ? '大量' : '一般'} (${records.length} 筆記錄, ${patients.length} 位院友)`);
    
    return new Promise((resolve, reject) => {
      let worker: Worker | null = null;
      
      // Extended timeout for large exports
      const timeoutDuration = isLargeExport ? 900000 : 300000; // 15 minutes for large, 5 for normal
      const timeout = setTimeout(() => {
        console.error(`Worker timeout after ${timeoutDuration/1000} seconds - terminating...`);
        if (worker) {
          worker.terminate();
        }
        reject(new Error(`匯出超時 (${timeoutDuration/60000} 分鐘)，請重試或減少匯出資料量`));
      }, timeoutDuration);
      
      // Create worker
      try {
        console.log('📤 創建 Web Worker...');
        worker = new Worker(
          new URL('../workers/healthRecordExportWorker.ts', import.meta.url),
          { type: 'module' }
        );
        console.log('✅ Web Worker 創建成功');
      } catch (error) {
        clearTimeout(timeout);
        console.error('Failed to create worker:', error);
        reject(new Error('無法建立背景處理程序'));
        return;
      }

      // Handle worker messages
      worker.onmessage = (event) => {
        try {
          const { type, payload } = event.data;
          
          if (payload?.message) {
            console.log(`📋 ${payload.message}`);
          }

          switch (type) {
            case 'EXPORT_PROGRESS':
              // Progress is already logged above
              break;

            case 'EXPORT_SUCCESS':
              try {
                clearTimeout(timeout);
                console.log('🎉 Worker 匯出成功，準備下載檔案...');
                
                if (!payload.buffer) {
                  throw new Error('Worker 返回的緩衝區為空');
                }
                
                console.log(`📁 檔案緩衝區大小: ${(payload.buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
                
                // Create blob and download file
                const blob = new Blob([payload.buffer], { 
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                });
                
                console.log(`💾 最終檔案大小: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Download immediately
                saveAs(blob, payload.filename);
                console.log(`🚀 ${recordType}記錄表下載開始: ${payload.filename}`);
                
                // Terminate worker after a short delay
                setTimeout(() => {
                  if (worker) {
                    worker.terminate();
                    console.log('🔚 Worker 已終止');
                  }
                }, 1000);
                
                resolve();
              } catch (error) {
                clearTimeout(timeout);
                console.error('💥 檔案下載失敗:', error);
                if (worker) {
                  worker.terminate();
                }
                reject(error);
              }
              break;

            case 'EXPORT_ERROR':
              clearTimeout(timeout);
              console.error('💀 Worker 匯出失敗:', payload.error);
              if (worker) {
                worker.terminate();
              }
              reject(new Error(payload.error));
              break;
          }
        } catch (error) {
          clearTimeout(timeout);
          console.error('🔥 處理 Worker 訊息時發生錯誤:', error);
          if (worker) {
            worker.terminate();
          }
          reject(error);
        }
      };

      // Handle worker errors
      worker.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ Worker 錯誤:', error);
        if (worker) {
          worker.terminate();
        }
        reject(error);
      };
      
      // Handle worker termination
      worker.onmessageerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ Worker 訊息錯誤:', error);
        if (worker) {
          worker.terminate();
        }
        reject(new Error('Worker 通訊錯誤'));
      };

      // Send data to worker
      console.log('📤 發送資料到 Worker...', {
        recordsCount: records.length,
        patientsCount: patients.length,
        hasTemplate: !!template?.extracted_format
      });
      
      worker.postMessage({
        type: 'EXPORT_HEALTH_RECORDS',
        payload: {
          records,
          patients,
          recordType,
          template: template?.extracted_format,
          filename
        }
      });
    });
    
  } catch (error) {
    console.error('❌ 匯出監測記錄失敗:', error);
    throw error;
  }
};

// 計算體重變化（用於Excel匯出，使用最遠記錄邏輯）
const calculateWeightChangeForExcel = (currentWeight: number, allRecords: any[], currentDate: string, currentTime: string, patientBedNumber: string): string => {
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
  const currentDateTime = new Date(`${currentDate} ${currentTime}`).getTime();
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

// 簡單的健康記錄匯出（當沒有範本時使用）
const exportHealthRecordsToExcelSimple = async (
  records: HealthRecordExportData[],
  patients: any[],
  recordType: '生命表徵' | '血糖控制' | '體重控制',
  filename?: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();

  // 按院友分組記錄
  const groupedRecords: { [key: string]: HealthRecordExportData[] } = {};
  records.forEach(record => {
    const key = `${record.床號}_${record.中文姓氏}${record.中文名字}`;
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
    
    const sheetName = `${firstRecord.床號}${firstRecord.中文姓氏}${firstRecord.中文名字}${recordType}記錄表`;
    const worksheet = workbook.addWorksheet(sheetName);
    
    // 根據記錄類型設定不同的表頭
    let headers: string[] = ['序號', '記錄日期'];
    
    if (recordType !== '體重控制') {
      headers.push('記錄時間');
    }
    
    if (recordType === '生命表徵') {
      // 設定欄寬
      worksheet.columns = [
        { width: 12 }, // 日期 (A)
        { width: 8 },  // 時間 (B)
        { width: 10 }, // 體溫 (C)
        { width: 8 },
        { width: 8 },
        { width: 12 }, // 血壓 (F)
        { width: 8 },
        { width: 8 },
        { width: 10 }, // 脈搏 (I)
        { width: 10 }, // 呼吸 (J)
        { width: 10 }, // SPO2 (K)
        { width: 20 }, // 備註 (L)
        { width: 8 }   // M
      ];

      // 標題
      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `${patient.中文姓氏}${patient.中文名字} 生命表徵觀察記錄表`;
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
      const headers = [
        '日期',      // A
        '時間',      // B
        '體溫(°C)',  // C
        '',          // D
        '',          // E
        '血壓(mmHg)', // F
        '',          // G
        '',          // H
        '脈搏(每分鐘)', // I
        '呼吸(每分鐘)', // J
        'SPO2(%)',   // K
        '備註',      // L
        ''           // M
      ];
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
        if (index < 13) { // A 到 M
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        }
        if (index === 12) { // M5
          cell.border = {
            ...cell.border,
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          console.log(`設置簡單匯出 ${cell.address} 右邊框為黑色細邊框`);
        }
      });

      // 合併表頭中的 FGH、LM
      worksheet.mergeCells('F5:H5');
      worksheet.mergeCells('L5:M5');
      console.log('簡單匯出設置表頭合併: F5:H5, L5:M5');

      // 資料行
      const sortedRecords = recordGroup.sort((a, b) =>
        new Date(`${a.記錄日期} ${a.記錄時間}`).getTime() -
        new Date(`${b.記錄日期} ${b.記錄時間}`).getTime()
      );

      sortedRecords.forEach((record, index) => {
        const rowIndex = 6 + index;
        const row = worksheet.getRow(rowIndex);
        row.height = 22;
        console.log(`設置簡單匯出第${rowIndex}行列高: 22`);

        // 硬編碼合併儲存格
        worksheet.mergeCells(`F${rowIndex}:H${rowIndex}`);
        worksheet.mergeCells(`L${rowIndex}:M${rowIndex}`);
        console.log(`簡單匯出硬編碼合併 F${rowIndex}:H${rowIndex}, L${rowIndex}:M${rowIndex}`);

        // 硬編碼邊框（A 到 M）並設置置中
        for (let col = 1; col <= 13; col++) {
          const cell = row.getCell(col);
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          console.log(`為第${rowIndex}行 ${col} 設置置中對齊`);
        }

        let bloodPressure = '';
        if (record.血壓收縮壓 && record.血壓舒張壓) {
          bloodPressure = `${record.血壓收縮壓}/${record.血壓舒張壓}`;
        } else if (record.血壓收縮壓) {
          bloodPressure = `${record.血壓收縮壓}/-`;
        } else if (record.血壓舒張壓) {
          bloodPressure = `-/${record.血壓舒張壓}`;
        }

        const values = [
          record.記錄日期,                    // A
          record.記錄時間.slice(0, 5),        // B
          record.體溫 || '',                  // C
          '',                                 // D
          '',                                 // E
          bloodPressure,                      // F
          '',                                 // G
          '',                                 // H
          record.脈搏 || '',                  // I
          record.呼吸頻率 || '',              // J
          record.血含氧量 || '',              // K
          record.備註 || '',                  // L
          ''                                  // M
        ];

        values.forEach((value, colIndex) => {
          const cell = row.getCell(colIndex + 1);
          cell.value = value;
          // 交替行顏色
          if (index % 2 === 1 && colIndex < 13) {
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
      worksheet.pageSetup.printArea = `A1:M${lastRow}`;
      console.log(`簡單匯出設置列印範圍: A1:M${lastRow}`);
    } else if (recordType === '血糖控制') {
      headers = [...headers, '血糖值', '備註', '記錄人員'];
    } else if (recordType === '體重控制') {
      headers = [...headers, '體重', '備註', '記錄人員'];
    }
    
    // 設定欄寬
    worksheet.columns = headers.map(() => ({ width: 12 }));

    // 標題
    worksheet.mergeCells(`A1:${String.fromCharCode(64 + headers.length)}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${patient.中文姓氏}${patient.中文名字} ${recordType}觀察記錄表`;
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
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // 資料行
    const sortedRecords = recordGroup.sort((a, b) =>
      new Date(`${a.記錄日期} ${a.記錄時間}`).getTime() -
      new Date(`${b.記錄日期} ${b.記錄時間}`).getTime()
    );

    sortedRecords.forEach((record, index) => {
      const rowIndex = 6 + index;
      const row = worksheet.getOrCreateRow(rowIndex);
      
      let values: any[] = [index + 1, new Date(record.記錄日期).toLocaleDateString('zh-TW')];
      
      if (recordType !== '體重控制') {
        values.push(record.記錄時間.slice(0, 5));
      }
      
      if (recordType === '生命表徵') {
        values = [...values, 
          record.體溫 || '',
          record.血壓收縮壓 && record.血壓舒張壓 ? `${record.血壓收縮壓}/${record.血壓舒張壓}` : 
          record.血壓收縮壓 ? `${record.血壓收縮壓}/-` :
          record.血壓舒張壓 ? `-/${record.血壓舒張壓}` : '',
          record.脈搏 || '',
          record.呼吸頻率 || '',
          record.血含氧量 || '',
          record.備註 || ''
        ];
      } else if (recordType === '血糖控制') {
        values = [...values, 
          record.血糖值 || '',
          record.備註 || '',
          record.記錄人員 || ''
        ];
      } else if (recordType === '體重控制') {
        values = [...values, 
          record.體重 || '',
          record.備註 || '',
          record.記錄人員 || ''
        ];
      }

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
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const finalFilename = filename || `${recordType}記錄表_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, finalFilename);
  
  console.log(`${recordType}記錄表 Excel 檔案 ${finalFilename} 匯出成功`);
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
      { width: 8},
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
    const headers = [
      '日期時間',    // A
      '',           // B
      '體重(kg)',   // C
      '',           // D
      '',           // E
      '',           // F
      '體重變化',   // G
      '',           // H
      '備註',       // I
      '',           // J
      '',           // K
      ''            // L
    ];
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
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // 合併表頭中的 CDEF、GH、IJKL
    worksheet.mergeCells('C5:F5');
    worksheet.mergeCells('G5:H5');
    worksheet.mergeCells('I5:L5');
    console.log('簡單匯出設置表頭合併: C5:F5, G5:H5, I5:L5');

    // 資料行
    const sortedRecords = recordGroup.sort((a, b) =>
      new Date(`${a.記錄日期} ${a.記錄時間}`).getTime() -
      new Date(`${b.記錄日期} ${b.記錄時間}`).getTime()
    );

    sortedRecords.forEach((record, index) => {
      const rowIndex = 6 + index;
      const row = worksheet.getRow(rowIndex);
      row.height = 22;
      console.log(`設置簡單匯出第${rowIndex}行列高: 22`);

      // 硬編碼合併儲存格
      worksheet.mergeCells(`C${rowIndex}:F${rowIndex}`);
      worksheet.mergeCells(`G${rowIndex}:H${rowIndex}`);
      worksheet.mergeCells(`I${rowIndex}:L${rowIndex}`);
      console.log(`簡單匯出硬編碼合併 C${rowIndex}:F${rowIndex}, G${rowIndex}:H${rowIndex}, I${rowIndex}:L${rowIndex}`);

      // 硬編碼邊框（A 到 L）並設置置中
      for (let col = 1; col <= 12; col++) {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        console.log(`為第${rowIndex}行 ${col} 設置置中對齊`);
      }

      // 計算體重變化
      let weightChange = '';
      if (record.體重) {
        weightChange = calculateWeightChangeForExcel(record.體重, sortedRecords, record.記錄日期, record.記錄時間, patient.床號);
      }

      const values = [
        `${record.記錄日期} ${record.記錄時間.slice(0, 5)}`, // A
        '', // B
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