/**
 * 換片及大便記錄 HTML 匯出器
 * 將換片記錄匯出為可列印的 HTML 格式 (橫向A4 紙張，4天/頁)
 */

import type { DiaperChangeRecord, Patient } from '../lib/database';

// 時段定義 (每天6個時段)
const TIME_SLOTS = [
  '7AM-10AM',
  '11AM-2PM',
  '3PM-6PM',
  '7PM-10PM',
  '11PM-2AM',
  '3AM-6AM'
];

interface ExportData {
  patient: Patient;
  records: DiaperChangeRecord[];
  dateRange: { start: string; end: string };
  facilityName: string;
}

// 格式化日期為短格式 MM/DD
const formatDateShort = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${(date.getMonth() + 1)}/${date.getDate()}`;
};

// 生成單天的記錄區塊 (6行: 時間行 + 日期行 + 4個數據行)
const generateDayBlock = (
  date: string,
  records: DiaperChangeRecord[]
): string => {
  // 過濾當天記錄
  const dayRecords = records.filter(r => r.change_date === date);
  const dateDisplay = formatDateShort(date);

  // 時間行: 時間 | 7AM-10AM | 11AM-2PM | ...
  const timeRow = `
    <tr>
      <th class="header-cell">時間</th>
      ${TIME_SLOTS.map(slot => `<th colspan="5" class="header-cell">${slot}</th>`).join('')}
    </tr>
  `;

  // 日期行: 日期 | 小便 | 大便(色、質、量) | 簽名 | ...
  const dateHeaderRow = `
    <tr>
      <th class="header-cell">日期</th>
      ${TIME_SLOTS.map(() => `
        <th class="header-cell">小便</th>
        <th class="header-cell" colspan="3">大便<br/><span class="small-text">(色、質、量)</span></th>
        <th class="header-cell">簽名</th>
      `).join('')}
    </tr>
  `;

  // 數據行1: 日期 | ☐ 多 | ☐ 正常 | ☐ 硬 | ☐ 多 | 簽名 | ...
  const dataRow1 = generateDataRow(dateDisplay, dayRecords, 0);
  // 數據行2: 空 | ☐ 中 | ☐ 有血 | ☐ 軟 | ☐ 中 | 空 | ...
  const dataRow2 = generateDataRow('', dayRecords, 1);
  // 數據行3: 空 | ☐ 少 | ☐ 有潺 | ☐ 稀 | ☐ 少 | 空 | ...
  const dataRow3 = generateDataRow('', dayRecords, 2);
  // 數據行4: 空 | 空 | ☐ 黑便 | 空 | 空 | 空 | ...
  const dataRow4 = generateDataRow('', dayRecords, 3);

  return `${timeRow}${dateHeaderRow}${dataRow1}${dataRow2}${dataRow3}${dataRow4}`;
};

// 生成數據行
// rowIndex: 0=多/正常/硬/多, 1=中/有血/軟/中, 2=少/有潺/稀/少, 3=無/黑便/空/無
const generateDataRow = (
  dateDisplay: string,
  dayRecords: DiaperChangeRecord[],
  rowIndex: number
): string => {
  // 小便量選項
  const urineOptions = ['多', '中', '少', '無'];
  // 大便色選項
  const colorOptions = ['正常', '有血', '有潺', '黑便'];
  // 大便質選項（第4行留空）
  const textureOptions = ['硬', '軟', '稀', ''];
  // 大便量選項
  const amountOptions = ['多', '中', '少', '無'];

  const urineOption = urineOptions[rowIndex];
  const colorOption = colorOptions[rowIndex];
  const textureOption = textureOptions[rowIndex];
  const amountOption = amountOptions[rowIndex];

  // 日期格（第1行顯示日期，其他行為空）
  const dateCell = rowIndex === 0 
    ? `<td class="date-cell" rowspan="4">${dateDisplay}</td>` 
    : '';

  // 生成每個時段的5格
  const slotCells = TIME_SLOTS.map(slot => {
    const record = dayRecords.find(r => r.time_slot === slot);
    
    // 小便量
    // rowIndex 3 (無) 時檢查 has_none，其他時候檢查 has_urine 和 urine_amount
    let urineChecked = false;
    if (rowIndex === 3) {
      // 第4行「無」選項：檢查 has_none
      urineChecked = record?.has_none || false;
    } else {
      // 第1-3行：檢查 has_urine 和 urine_amount
      urineChecked = (record?.has_urine && record?.urine_amount === urineOption) || false;
    }
    const urineCell = `<td class="checkbox-cell">${urineChecked ? '☑' : '☐'} ${urineOption}</td>`;
    
    // 大便色
    const colorChecked = record?.has_stool && record?.stool_color === colorOption;
    const colorCell = `<td class="checkbox-cell">${colorChecked ? '☑' : '☐'} ${colorOption}</td>`;
    
    // 大便質（第4行留空，不顯示「無」）
    const textureChecked = record?.has_stool && record?.stool_texture === textureOption;
    const textureCell = textureOption
      ? `<td class="checkbox-cell">${textureChecked ? '☑' : '☐'} ${textureOption}</td>`
      : `<td class="checkbox-cell"></td>`;
    
    // 大便量
    // rowIndex 3 (無) 時檢查 has_none，其他時候檢查 has_stool 和 stool_amount
    let amountChecked = false;
    if (rowIndex === 3) {
      // 第4行「無」選項：檢查 has_none
      amountChecked = record?.has_none || false;
    } else {
      // 第1-3行：檢查 has_stool 和 stool_amount
      amountChecked = (record?.has_stool && record?.stool_amount === amountOption) || false;
    }
    const amountCell = `<td class="checkbox-cell">${amountChecked ? '☑' : '☐'} ${amountOption}</td>`;
    
    // 簽名（只在第1行顯示，rowspan=4）
    // 如果有 notes（入院/渡假/外出），則顯示 notes 而非 recorder
    const signatureCell = rowIndex === 0 
      ? `<td class="signature-cell" rowspan="4">${record?.notes || record?.recorder || ''}</td>`
      : '';
    
    return `${urineCell}${colorCell}${textureCell}${amountCell}${signatureCell}`;
  }).join('');

  return `<tr>${dateCell}${slotCells}</tr>`;
};

// 生成完整 HTML
export const generateDiaperRecordHtml = (data: ExportData): string => {
  const { patient, records, dateRange, facilityName } = data;

  // 計算4天日期
  const startDate = new Date(dateRange.start);
  const dates: string[] = [];
  for (let i = 0; i < 4; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  // 計算月份/年份顯示
  const monthYear = `${startDate.getFullYear()}年${(startDate.getMonth() + 1).toString().padStart(2, '0')}月`;

  // 生成4天的區塊，中間用空行分隔
  const dayBlocks = dates.map(date => generateDayBlock(date, records)).join(`
    <tr><td colspan="31" class="separator-row"></td></tr>
  `);

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>換片及大便記錄</title>
<style>
@page {
  size: A4 landscape;
  margin: 3mm;
}
@media print {
  html, body {
    width: 297mm;
    height: 210mm;
  }
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    padding: 0;
    margin: 0;
  }
  .no-print {
    display: none !important;
  }
  .page-container {
    box-shadow: none;
    border: none;
    max-width: 100%;
    padding: 4mm;
    margin: 0;
    height: 204mm;
  }
}
* {
  box-sizing: border-box;
}
body {
  font-family: "Microsoft JhengHei", "微軟正黑體", "PingFang TC", "Heiti TC", sans-serif;
  margin: 0;
  padding: 2px;
  background-color: #f4f4f4;
  font-size: 10px;
  line-height: 1.3;
  color: #333;
}
.page-container {
  max-width: 297mm;
  margin: 0 auto;
  background-color: #fff;
  border: 1px solid #ccc;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  padding: 4mm;
}
.institution-header {
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 4px;
}
.form-title {
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
}
.form-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
}
.form-info-item {
  display: flex;
  align-items: center;
}
.form-info-item span {
  margin-right: 5px;
}
.underline-value {
  border-bottom: 1px solid #000;
  padding: 0 10px;
  min-width: 80px;
  font-weight: bold;
}
.record-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9px;
  table-layout: fixed;
}
.record-table th,
.record-table td {
  border: 1px solid #000;
  padding: 3px;
  text-align: center;
  vertical-align: middle;
  overflow: hidden;
}
.record-table .header-cell {
  background-color: #e9ecef;
  font-weight: bold;
  font-size: 9px;
  height: 28px;
}
.record-table .date-cell {
  width: 42px;
  font-weight: bold;
  font-size: 10px;
}
.record-table .checkbox-cell {
  font-size: 9px;
  height: 24px;
  white-space: nowrap;
  padding: 2px 3px;
}
.record-table .signature-cell {
  width: 45px;
  font-size: 8px;
  vertical-align: middle;
}
.record-table .small-text {
  font-size: 7px;
}
.record-table .separator-row {
  height: 8px;
  border: none;
  background-color: transparent;
}
.record-table .separator-row td {
  border: none;
}
.print-btn-container {
  text-align: center;
  margin: 10px 0;
}
.print-btn {
  padding: 8px 20px;
  font-size: 12px;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.print-btn:hover {
  background-color: #1d4ed8;
}
</style>
</head>
<body>
<div class="print-btn-container no-print">
  <button class="print-btn" onclick="window.print()">列印此頁</button>
</div>
<div class="page-container">
  <div class="institution-header">${facilityName}</div>
  <div class="form-title">換片及大便記錄 (B83 FK 06.2025)</div>
  
  <div class="form-info">
    <div class="form-info-item">
      <span>院友姓名：</span>
      <span class="underline-value">${patient.中文姓氏}${patient.中文名字}</span>
    </div>
    <div class="form-info-item">
      <span>床號：</span>
      <span class="underline-value">${patient.床號 || ''}</span>
    </div>
    <div class="form-info-item">
      <span>月份/年份：</span>
      <span class="underline-value">${monthYear}</span>
    </div>
  </div>

  <table class="record-table">
    <tbody>
      ${dayBlocks}
    </tbody>
  </table>
</div>
</body>
</html>`;
};

// 使用 iframe 列印
export const exportDiaperRecordHtml = (
  patient: Patient,
  records: DiaperChangeRecord[],
  startDate: string,
  facilityName: string = '善頤(福群)護老院'
): void => {
  // 計算結束日期 (4天)
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 3);
  const endDate = end.toISOString().split('T')[0];

  const html = generateDiaperRecordHtml({
    patient,
    records,
    dateRange: { start: startDate, end: endDate },
    facilityName
  });

  // 移除舊的 iframe（如果存在）
  const existingIframe = document.getElementById('diaper-print-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  // 創建隱藏的 iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'diaper-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  // 寫入 HTML 並列印
  const iframeDoc = iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // 等待內容載入後列印
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
      }, 100);
    };
  } else {
    alert('無法建立列印框架');
  }
};
