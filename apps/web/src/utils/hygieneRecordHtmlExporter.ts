/**
 * 個人衛生記錄表 HTML 匯出器
 * 將衛生記錄匯出為可列印的 HTML 格式 (A4 紙張，一頁一個月)
 * 格式：日期在行（1-31），項目在列
 */

import type { HygieneRecord, Patient } from '../lib/database';

// 衛生項目配置 - 按圖片中的順序，對應 HygieneRecord 資料庫欄位
const HYGIENE_ITEMS = [
  { key: 'has_bath', label: '沖涼洗頭' },
  { key: 'has_face_wash', label: '洗面' },
  { key: 'has_oral_care', label: '刷牙漱口' },
  { key: 'has_denture_care', label: '洗口浸假牙' },
  { key: 'has_haircut', label: '剪髮' },
  { key: 'has_shave', label: '剃鬚' },
  { key: 'has_nail_trim', label: '剪指甲' },
  { key: 'has_bedding_change', label: '換被套' },
  { key: 'has_sheet_pillow_change', label: '換床單枕袋' },
  { key: 'has_cup_wash', label: '洗杯' },
  { key: 'has_bedside_cabinet', label: '整理床頭櫃' },
  { key: 'has_wardrobe', label: '整理衣箱' },
];

// 大便記錄項目
const BOWEL_ITEMS = [
  { key: 'bowel_count', label: '#大便次數' },
  { key: 'bowel_amount', label: '*大便量' },
  { key: 'bowel_consistency', label: '>大便性質' },
  { key: 'bowel_medication', label: '+大便藥' },
];

interface ExportData {
  patient: Patient;
  records: HygieneRecord[];
  year: number;
  month: number; // 1-12
  facilityName: string;
}

// 獲取某個月的天數
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

// 格式化日期為 YYYY-MM-DD
const formatDateString = (year: number, month: number, day: number): string => {
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

// 生成表格數據行（每行是一個日期）
const generateDataRows = (
  records: HygieneRecord[],
  year: number,
  month: number,
  daysInMonth: number
): string => {
  let rows = '';
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateString(year, month, day);
    const record = records.find(r => r.record_date === dateStr);
    
    let cells = '';
    let hasAnyItem = false; // 追蹤是否有任何項目被勾選
    
    // 衛生項目（布林值顯示 ✓）
    for (const item of HYGIENE_ITEMS) {
      let cellContent = '';
      if (record && item.key) {
        const value = (record as any)[item.key];
        if (value === true) {
          cellContent = '✓';
          hasAnyItem = true;
        }
      }
      cells += `<td>${cellContent}</td>`;
    }
    
    // 大便項目（數值/文字）
    for (const item of BOWEL_ITEMS) {
      let cellContent = '';
      if (record) {
        const value = (record as any)[item.key];
        if (value !== null && value !== undefined && value !== '') {
          cellContent = String(value);
          hasAnyItem = true;
        }
      }
      cells += `<td>${cellContent}</td>`;
    }
    
    // 備註欄
    let remarksContent = '';
    if (record) {
      const notes = record.notes || record.status_notes || '';
      if (notes) {
        remarksContent = notes;
        hasAnyItem = true;
      }
    }
    cells += `<td>${remarksContent}</td>`;
    
    // 職員簽名 - 只有在有任何項目時才顯示
    let recorderContent = '';
    if (record && hasAnyItem) {
      recorderContent = record.recorder || '';
    }
    cells += `<td>${recorderContent}</td>`;
    
    rows += `
    <tr>
      <td>${day}</td>
      ${cells}
    </tr>`;
  }
  
  return rows;
};

// 生成完整 HTML - 完全按照圖片格式
export const generateHygieneRecordHtml = (data: ExportData): string => {
  const { patient, records, year, month, facilityName } = data;
  const daysInMonth = getDaysInMonth(year, month);
  
  // 過濾當月記錄
  const monthStr = month.toString().padStart(2, '0');
  const monthRecords = records.filter(r => {
    return r.record_date.startsWith(`${year}-${monthStr}-`);
  });

  // 生成數據行
  const dataRows = generateDataRows(monthRecords, year, month, daysInMonth);

  const patientName = patient.中文姓名 || (patient.中文姓氏 || '') + (patient.中文名字 || '');

  // 計算年齡
  let age = '';
  if (patient.出生日期) {
    const birthDate = new Date(patient.出生日期);
    const today = new Date();
    age = String(today.getFullYear() - birthDate.getFullYear());
  }

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>個人衛生、清潔及大便記錄</title>
<style>
  @page {
    size: A4 portrait;
    margin: 3mm;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print {
      display: none !important;
    }
    html, body {
      height: 100%;
    }
  }
  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: "微軟正黑體", "Microsoft JhengHei", sans-serif;
    font-size: 10px;
    padding: 3mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .page-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 280mm;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 3px;
  }
  .header-left {
    font-size: 14px;
    font-weight: bold;
    color: #336699;
  }
  .header-center {
    text-align: center;
  }
  .header-center h1 {
    font-size: 16px;
    font-weight: bold;
    color: #336699;
    margin: 0;
  }
  .header-center h2 {
    font-size: 14px;
    font-weight: normal;
    margin: 2px 0 0 0;
  }
  .info-row {
    display: flex;
    justify-content: flex-start;
    gap: 40px;
    margin-bottom: 3px;
    font-size: 12px;
    border: 1px solid #333;
    padding: 6px 12px;
  }
  .info-row span {
    white-space: nowrap;
  }
  .table-container {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    table-layout: fixed;
    font-size: 10px;
    flex: 1;
  }
  th, td {
    border: 1px solid #333;
    padding: 2px;
    text-align: center;
    word-wrap: break-word;
    vertical-align: middle;
  }
  th {
    background-color: #f0f0f0;
    font-weight: bold;
    font-size: 9px;
  }
  thead th {
    height: 70px;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    white-space: nowrap;
    padding: 4px 2px;
    font-size: 11px;
  }
  thead th:first-child {
    writing-mode: horizontal-tb;
    width: 28px;
  }
  thead th:last-child,
  thead th:nth-last-child(2) {
    writing-mode: horizontal-tb;
    width: 55px;
    font-size: 9px;
    white-space: normal;
  }
  tbody tr {
    height: 20px;
  }
  tbody td {
    height: 20px;
    font-size: 11px;
  }
  tbody td:first-child {
    font-weight: bold;
    background-color: #f8f8f8;
    font-size: 12px;
  }
  .footer-notes {
    margin-top: 5px;
    font-size: 10px;
    border: 1px solid #333;
    padding: 6px 10px;
  }
  .footer-notes p {
    margin: 3px 0;
  }
  .print-btn-container {
    text-align: center;
    margin: 10px 0;
  }
  .print-btn {
    padding: 8px 20px;
    font-size: 14px;
    background-color: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
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

<div class="page-content">
<div class="header">
  <div class="header-left">${year}年<br/>${month}月</div>
  <div class="header-center">
    <h1>${facilityName}</h1>
    <h2>個人衛生、清潔及大便記錄</h2>
  </div>
  <div></div>
</div>

<div class="info-row">
  <span>院友姓名：${patientName}</span>
  <span>年齡：${age}</span>
  <span>性別：${patient.性別 || ''}</span>
  <span>床號：${patient.床號 || ''}</span>
</div>

<div class="table-container">
<table>
  <thead>
    <tr>
      <th>日期</th>
      <th>沖涼洗頭</th>
      <th>洗面</th>
      <th>刷牙漱口</th>
      <th>洗口浸假牙</th>
      <th>剪髮</th>
      <th>剃鬚</th>
      <th>剪指甲</th>
      <th>換被套</th>
      <th>換床單枕袋</th>
      <th>洗杯</th>
      <th>整理床頭櫃</th>
      <th>整理衣箱</th>
      <th>#大便次數</th>
      <th>*大便量</th>
      <th>>大便性質</th>
      <th>+大便藥</th>
      <th>備註(如大便有血、渣或黑糞)</th>
      <th>職員簽名</th>
    </tr>
  </thead>
  <tbody>${dataRows}
  </tbody>
</table>
</div>

<div class="footer-notes">
  <p>#大便次數：以"正"字表示</p>
  <p>*大便量：大量"+++" 中量以"++" 少量以"+"表示。</p>
  <p>>大便性質：硬=H 軟=S 稀/水狀=W</p>
  <p>+按醫囑給予口服大便藥以「★」記錄；按醫囑給予栓劑以「▲」記錄。</p>
</div>
</div>

</body>
</html>`;
};

// 使用 iframe 列印
export const exportHygieneRecordHtml = (
  patient: Patient,
  records: HygieneRecord[],
  year: number,
  month: number,
  facilityName: string = '善頤(福群)護老院'
): void => {
  const html = generateHygieneRecordHtml({
    patient,
    records,
    year,
    month,
    facilityName
  });

  // 移除舊的 iframe（如果存在）
  const existingIframe = document.getElementById('hygiene-print-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  // 創建隱藏的 iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'hygiene-print-iframe';
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
