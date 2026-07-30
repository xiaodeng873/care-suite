import ExcelJS from '@zurmokeeper/exceljs';
import { saveAs } from 'file-saver';
import { getTemplatesMetadata } from '../lib/database';
import { 
  extractWaitingListTemplateFormat, 
  applyWaitingListTemplateFormat,
  type WaitingListExportData 
} from './waitingListExcelGenerator';
import { 
  extractPrescriptionTemplateFormat, 
  applyPrescriptionTemplateFormat,
  type PrescriptionExportData 
} from './prescriptionExcelGenerator';
import { getFormattedEnglishName } from './nameFormatter';
import { getPrintBedNumber } from './bedTransferUtils';
// 定義 ScheduleWithDetails 介面
interface Patient {
  院友id: number;
  床號: string;
  中文姓氏: string;
  中文名字: string;
  英文姓氏?: string;
  英文名字?: string;
  英文姓名?: string;
  性別?: string;
  身份證號碼?: string;
  出生日期?: string;
  藥物敏感?: string[];
  不良藥物反應?: string[];
}
interface ScheduleItem {
  院友id: number;
  細項id: number;
  reasons?: { 原因名稱: string }[];
  症狀說明?: string;
  備註?: string;
  patient: Patient;
}
interface ScheduleWithDetails {
  排程id: number;
  到診日期: string;
  院友列表: ScheduleItem[];
}
// 居住區分組類型
export interface StationGroup {
  label: string;  // 居住區名稱（顯示用）
  items: ScheduleItem[];
}

// 把 ScheduleItem[] 轉為 WaitingListExportData[]
function toWaitingListData(items: ScheduleItem[], visitDate: string): WaitingListExportData[] {
  return items
    .map((item) => {
      if (!item.patient) return null;
      return {
        床號: getPrintBedNumber(item.patient),
        中文姓氏: item.patient.中文姓氏 || '',
        中文名字: item.patient.中文名字 || '',
        英文姓氏: item.patient.英文姓氏 || '',
        英文名字: item.patient.英文名字 || '',
        中文姓名: `${item.patient.中文姓氏 || ''}${item.patient.中文名字 || ''}`,
        英文姓名: getFormattedEnglishName(item.patient.英文姓氏, item.patient.英文名字) || item.patient.英文姓名 || '',
        性別: item.patient.性別 || '',
        身份證號碼: item.patient.身份證號碼 || '',
        出生日期: item.patient.出生日期 ? new Date(item.patient.出生日期).toLocaleDateString('zh-TW') : '',
        看診原因: item.reasons?.map(r => r.原因名稱) || [],
        症狀說明: item.症狀說明 || '',
        藥物敏感: item.patient.藥物敏感 || [],
        不良藥物反應: item.patient.不良藥物反應 || [],
        備註: item.備註 || '',
        到診日期: visitDate,
      } as WaitingListExportData;
    })
    .filter((item): item is WaitingListExportData => item !== null);
}

// 合併匯出排程的候診表和處方箋
export const exportCombinedScheduleToExcel = async (
  schedule: ScheduleWithDetails,
  options?: { stationGroups?: StationGroup[]; filenameSuffix?: string }
): Promise<void> => {
  try {
    console.log('傳入的 schedule:', JSON.stringify(schedule, null, 2));
    // 從 Supabase 獲取範本
    const templatesData = await getTemplatesMetadata();
    const waitingListTemplate = templatesData.find(t => t.type === 'waiting-list');
    const prescriptionTemplate = templatesData.find(t => t.type === 'prescription');
    // 創建工作簿
    const workbook = new ExcelJS.Workbook();
    const stationGroups = options?.stationGroups;

    // ── 候診記錄表：多居住區 → 各自獨立 sheet；單一或無分組 → 舊有單 sheet ──
    if (stationGroups && stationGroups.length > 0) {
      let totalCount = 0;
      for (const group of stationGroups) {
        const groupData = toWaitingListData(group.items, schedule.到診日期);
        if (groupData.length === 0) continue;
        totalCount += groupData.length;
        const sheetName = `候診_${group.label}`.slice(0, 31); // Excel sheet 名 ≤31 字元
        const ws = workbook.addWorksheet(sheetName);
        if (waitingListTemplate?.extracted_format) {
          applyWaitingListTemplateFormat(ws, waitingListTemplate.extracted_format, groupData, schedule.到診日期);
        } else {
          await createSimpleWaitingListWorksheet(ws, groupData, schedule.到診日期);
        }
      }
      if (totalCount === 0) throw new Error('無有效的院友資料可匯出到候診記錄表');
    } else {
      // 準備候診記錄表資料
      const waitingListData = toWaitingListData(
        schedule.院友列表.filter((item) => {
          if (!item.patient) {
            console.warn(`院友資料缺失，細項id: ${item.細項id}`);
            return false;
          }
          return true;
        }),
        schedule.到診日期
      );
    // 檢查是否有有效資料
    if (waitingListData.length === 0) {
      console.warn('無有效的候診記錄表資料可匯出');
      throw new Error('無有效的院友資料可匯出到候診記錄表');
    }
    // 創建候診記錄表工作表
    const waitingListWorksheet = workbook.addWorksheet('院友候診記錄表');
    if (waitingListTemplate && waitingListTemplate.extracted_format) {
      applyWaitingListTemplateFormat(
        waitingListWorksheet, 
        waitingListTemplate.extracted_format, 
        waitingListData, 
        schedule.到診日期
      );
    } else {
      await createSimpleWaitingListWorksheet(waitingListWorksheet, waitingListData, schedule.到診日期);
    }
    } // end else (no stationGroups)

    // ── 處方箋：不受居住區分組影響，使用全部可見院友 ──
    const allItems: ScheduleItem[] = stationGroups && stationGroups.length > 0
      ? stationGroups.flatMap(g => g.items)
      : (schedule.院友列表 as ScheduleItem[]);
    const prescriptionPatients = allItems.filter((item: ScheduleItem) => {
      const hasComplaint = item.reasons?.some(reason => reason.原因名稱 === '申訴不適');
      console.log(`檢查院友 ${item.細項id} 是否需要處方箋:`, hasComplaint, JSON.stringify(item.reasons, null, 2));
      return hasComplaint;
    });
    let prescriptionCount = 0;
    if (prescriptionPatients.length > 0) {
      // 為每個需要處方箋的院友創建工作表
      for (const patient of prescriptionPatients) {
        if (!patient.patient) {
          console.warn(`院友資料缺失，細項id: ${patient.細項id}`);
          continue;
        }
        const prescriptionData: PrescriptionExportData = {
          床號: getPrintBedNumber(patient.patient),
          中文姓氏: patient.patient.中文姓氏 || '',
          中文名字: patient.patient.中文名字 || '',
          中文姓名: `${patient.patient.中文姓氏 || ''}${patient.patient.中文名字 || ''}`,
          性別: patient.patient.性別 || '',
          身份證號碼: patient.patient.身份證號碼 || '',
          出生日期: patient.patient.出生日期 || '',
          藥物敏感: patient.patient.藥物敏感 || [],
          不良藥物反應: patient.patient.不良藥物反應 || [],
          處方日期: schedule.到診日期,
          藥物名稱: '',
          劑型: '',
          服用途徑: '',
          服用次數: '',
          服用份量: '',
          服用日數: '',
          藥物來源: '',
          需要時: false,
          醫生簽名: ''
        };
        console.log(`生成的 prescriptionData:`, JSON.stringify(prescriptionData, null, 2));
        // 創建處方箋工作表
        const prescriptionWorksheetName = `${getPrintBedNumber(patient.patient)}_${patient.patient.中文姓氏}${patient.patient.中文名字}_處方箋`;
        const prescriptionWorksheet = workbook.addWorksheet(prescriptionWorksheetName);
        if (prescriptionTemplate && prescriptionTemplate.extracted_format) {
          applyPrescriptionTemplateFormat(
            prescriptionWorksheet, 
            prescriptionTemplate.extracted_format, 
            prescriptionData
          );
        } else {
          await createSimplePrescriptionWorksheet(prescriptionWorksheet, prescriptionData);
        }
        prescriptionCount++;
      }
    } // end if prescriptionPatients
    // 決定檔案名稱
    const datePart = new Date(schedule.到診日期).toISOString().split('T')[0];
    const suffix = options?.filenameSuffix ? `_${options.filenameSuffix}` : '';
    const filename = `到診資料_${datePart}${suffix}.xlsx`;
    // 儲存檔案
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
    // 顯示完成訊息
    const totalCount = allItems.filter(i => i.patient).length;
    const sheetDesc = stationGroups && stationGroups.length > 1
      ? `（${stationGroups.length} 個居住區分頁）`
      : '';
    const message = prescriptionCount > 0
      ? `匯出完成！\n✅ 候診記錄表：${totalCount} 位院友${sheetDesc}\n✅ 處方箋：${prescriptionCount} 位院友（申訴不適）\n📁 檔案：${filename}`
      : `匯出完成！\n✅ 候診記錄表：${totalCount} 位院友${sheetDesc}\n⚠️ 無院友需要處方箋（無「申訴不適」）\n📁 檔案：${filename}`;
    alert(message);
  } catch (error) {
    console.error('合併匯出失敗:', error);
    throw error;
  }
};
// 創建簡單的候診記錄表工作表（當沒有範本時使用）
const createSimpleWaitingListWorksheet = async (
  worksheet: ExcelJS.Worksheet,
  patients: WaitingListExportData[],
  visitDate: string
): Promise<void> => {
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
  ];
  // 標題
  worksheet.mergeCells('A1:K1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `院友候診記錄表 - ${new Date(visitDate).toLocaleDateString('zh-TW')}`;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F7FF' }
  };
  // 表頭
  const headers = [
    '床號', '中文姓名', '英文姓名', '性別', '身份證號碼', '出生日期',
    '看診原因', '症狀說明', '藥物敏感', '不良藥物反應', '備註'
  ];
  const headerRow = worksheet.getRow(3);
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
  patients.forEach((patient, index) => {
    const rowIndex = 4 + index;
    const row = worksheet.getRow(rowIndex);
    const values = [
      getPrintBedNumber(patient),
      `${patient.中文姓氏}${patient.中文名字}`,
      getFormattedEnglishName(patient.英文姓氏, patient.英文名字) || patient.英文姓名 || '',
      patient.性別,
      patient.身份證號碼,
      patient.出生日期,
      Array.isArray(patient.看診原因) ? patient.看診原因.join(', ') : (patient.看診原因 || ''),
      patient.症狀說明 || '',
      Array.isArray(patient.藥物敏感) ? (patient.藥物敏感.length ? patient.藥物敏感.join(', ') : '無') : (patient.藥物敏感 || '無'),
      Array.isArray(patient.不良藥物反應) ? (patient.不良藥物反應.length ? patient.不良藥物反應.join(', ') : '無') : (patient.不良藥物反應 || '無'),
      patient.備註 || ''
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
};
// 創建簡單的處方箋工作表（當沒有範本時使用）
const createSimplePrescriptionWorksheet = async (
  worksheet: ExcelJS.Worksheet,
  prescription: PrescriptionExportData
): Promise<void> => {
  // 設定欄寬
  worksheet.columns = [
    { width: 10 }, // 床號
    { width: 15 }, // 中文姓名
    { width: 12 }, // 處方日期
    { width: 20 }, // 藥物名稱
    { width: 10 }, // 劑型
    { width: 10 }, // 服用途徑
    { width: 12 }, // 服用次數
    { width: 12 }, // 服用份量
    { width: 10 }, // 服用日數
    { width: 15 }, // 藥物來源
    { width: 8 },  // 需要時
    { width: 12 }  // 醫生簽名
  ];
  // 標題
  worksheet.mergeCells('A1:L1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `VMO處方箋 - ${prescription.中文姓氏}${prescription.中文名字} (${getPrintBedNumber(prescription)})`;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F3FF' }
  };
  // 院友資訊
  worksheet.getCell('A3').value = '院友姓名:';
  worksheet.getCell('B3').value = `${prescription.中文姓氏}${prescription.中文名字}`;
  worksheet.getCell('D3').value = '性別:';
  worksheet.getCell('E3').value = prescription.性別;
  worksheet.getCell('G3').value = '身份證號碼:';
  worksheet.getCell('H3').value = prescription.身份證號碼;
  worksheet.getCell('J3').value = '出生日期:';
  worksheet.getCell('K3').value = prescription.出生日期;
  // 藥物敏感資訊
  worksheet.getCell('A4').value = '藥物敏感:';
  const allergies = Array.isArray(prescription.藥物敏感) 
    ? (prescription.藥物敏感.length ? prescription.藥物敏感.join(', ') : 'NKDA')
    : (prescription.藥物敏感 || 'NKDA');
  worksheet.getCell('B4').value = allergies;
  // 不良藥物反應
  worksheet.getCell('A5').value = '不良藥物反應:';
  const reactions = Array.isArray(prescription.不良藥物反應)
    ? (prescription.不良藥物反應.length ? prescription.不良藥物反應.join(', ') : 'NKADR')
    : (prescription.不良藥物反應 || 'NKADR');
  worksheet.getCell('B5').value = reactions;
  // 表頭
  const headers = [
    '床號', '中文姓名', '處方日期', '藥物名稱', '劑型', '服用途徑',
    '服用次數', '服用份量', '服用日數', '藥物來源', '需要時', '醫生簽名'
  ];
  const headerRow = worksheet.getRow(7);
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
  // 空白資料行供填寫
  for (let i = 0; i < 10; i++) {
    const rowIndex = 8 + i;
    const row = worksheet.getRow(rowIndex);
    const values = [
      getPrintBedNumber(prescription),
      `${prescription.中文姓氏}${prescription.中文名字}`,
      prescription.處方日期,
      '', // 藥物名稱 - 空白供填寫
      '', // 劑型
      '', // 服用途徑
      '', // 服用次數
      '', // 服用份量
      '', // 服用日數
      '', // 藥物來源
      '', // 需要時
      ''  // 醫生簽名
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
  }
};