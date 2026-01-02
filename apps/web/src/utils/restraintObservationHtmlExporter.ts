/**
 * 身體約束物品觀察記錄表 HTML 匯出器
 * 將約束觀察記錄匯出為可列印的 HTML 格式 (A4 紙張，4天/頁)
 */

import type { RestraintObservationRecord, PatientRestraintAssessment, Patient } from '../lib/database';

// 觀察時段定義 (每2小時一次) - 顯示格式
const OBSERVATION_TIME_SLOTS_DISPLAY = [
  '0700-0900',
  '0900-1100',
  '1100-1300',
  '1300-1500',
  '1500-1700',
  '1700-1900',
  '1900-2100',
  '2100-2300',
  '2300-0100',
  '0100-0300',
  '0300-0500',
  '0500-0700'
];

// 資料庫中的 scheduled_time 格式 -> 顯示格式的映射
const SCHEDULED_TIME_TO_DISPLAY: Record<string, string> = {
  '07:00': '0700-0900',
  '09:00': '0900-1100',
  '11:00': '1100-1300',
  '13:00': '1300-1500',
  '15:00': '1500-1700',
  '17:00': '1700-1900',
  '19:00': '1900-2100',
  '21:00': '2100-2300',
  '23:00': '2300-0100',
  '01:00': '0100-0300',
  '03:00': '0300-0500',
  '05:00': '0500-0700'
};

// 約束物品類型對照 - 用於將 used_restraints 中的key映射到編號
const RESTRAINT_KEY_TO_NUMBER: Record<string, string> = {
  '約束衣': '1',
  '約束背心': '1',
  '約束腰帶': '2',
  '輪椅安全帶': '2',
  '手腕帶': '3',
  '手部約束帶': '3',
  '約束手套': '4',
  '連指手套': '4',
  '手套': '4',
  '防滑褲': '5',
  '防滑褲帶': '5',
  '枱板': '6',
  '輪椅餐桌板': '6',
  '床欄': '7',
  '其他：': '7'
};

interface ExportData {
  patient: Patient;
  records: RestraintObservationRecord[];
  assessment: PatientRestraintAssessment | null;
  dateRange: { start: string; end: string };
  facilityName: string;
}

// 格式化日期為中文格式
const formatDateChinese = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
};

// 格式化日期為短格式
const formatDateShort = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
};

// 獲取使用的約束物品編號 - 從觀察記錄的 used_restraints 中提取
const getUsedRestraintNumbers = (usedRestraints: any): string => {
  if (!usedRestraints) return '';
  const numbers = new Set<string>();
  
  Object.keys(usedRestraints).forEach(key => {
    if (usedRestraints[key]) {
      // 直接查找映射
      const num = RESTRAINT_KEY_TO_NUMBER[key];
      if (num) {
        numbers.add(num);
      } else {
        // 嘗試部分匹配
        for (const [k, v] of Object.entries(RESTRAINT_KEY_TO_NUMBER)) {
          if (key.includes(k) || k.includes(key)) {
            numbers.add(v);
            break;
          }
        }
      }
    }
  });
  
  return Array.from(numbers).sort().join(',');
};

// 約束物品配置項目的結構
interface RestraintConfigItem {
  category: string;
  label: string;
  dbKey: string;  // 資料庫中的鍵名
  checked: boolean;
  usageConditions: string;
  dayTime: boolean;
  dayStartTime: string;
  dayEndTime: string;
  nightTime: boolean;
  nightStartTime: string;
  nightEndTime: string;
  allDay: boolean;
  otherTime: string;
  otherRestraintType: string;
}

// 約束物品定義 - 與 RestraintAssessmentModal 中的 restraintOptions 完全對應
const RESTRAINT_ITEMS: { category: string; label: string; dbKey: string }[] = [
  { category: '1', label: '約束衣', dbKey: '約束衣' },
  { category: '2', label: '約束腰帶', dbKey: '約束腰帶' },
  { category: '3', label: '手腕帶', dbKey: '手腕帶' },
  { category: '4', label: '約束手套/連指手套', dbKey: '約束手套/連指手套' },
  { category: '5', label: '防滑褲/防滑褲帶', dbKey: '防滑褲/防滑褲帶' },
  { category: '6', label: '枱板', dbKey: '枱板' },
  { category: '7', label: '其他', dbKey: '其他：' }
];

// 從評估資料中提取約束物品配置 - 對應 RestraintAssessmentModal 的數據結構
const extractRestraintConfig = (assessment: PatientRestraintAssessment | null): {
  items: RestraintConfigItem[];
} => {
  // 初始化7項約束物品 - 始終顯示全部項目
  const items: RestraintConfigItem[] = RESTRAINT_ITEMS.map(item => ({
    category: item.category,
    label: item.label,
    dbKey: item.dbKey,
    checked: false,
    usageConditions: '',
    dayTime: false,
    dayStartTime: '',
    dayEndTime: '',
    nightTime: false,
    nightStartTime: '',
    nightEndTime: '',
    allDay: false,
    otherTime: '',
    otherRestraintType: ''
  }));

  if (!assessment?.suggested_restraints) return { items };

  const restraints = assessment.suggested_restraints;

  // 遍歷每個約束物品，檢查資料庫中是否有對應的配置
  items.forEach((item, idx) => {
    const value = restraints[item.dbKey];
    if (typeof value === 'object' && value?.checked) {
      items[idx].checked = true;
      items[idx].usageConditions = value.usageConditions || '';
      items[idx].dayTime = value.dayTime || false;
      items[idx].dayStartTime = value.dayStartTime || '';
      items[idx].dayEndTime = value.dayEndTime || '';
      items[idx].nightTime = value.nightTime || false;
      items[idx].nightStartTime = value.nightStartTime || '';
      items[idx].nightEndTime = value.nightEndTime || '';
      items[idx].allDay = value.allDay || false;
      items[idx].otherTime = value.otherTime || '';
      items[idx].otherRestraintType = value.otherRestraintType || '';
    }
  });

  return { items };
};

// 生成觀察表格 HTML (單日)
const generateDayObservationTable = (
  date: string,
  records: RestraintObservationRecord[]
): string => {
  // 過濾當日的記錄
  const dayRecords = records.filter(r => r.observation_date === date);
  
  const rows = OBSERVATION_TIME_SLOTS_DISPLAY.map(displaySlot => {
    // 根據顯示時段找到對應的 scheduled_time
    // 例如 "0700-0900" 對應 "07:00"
    const scheduledTime = Object.entries(SCHEDULED_TIME_TO_DISPLAY)
      .find(([_, display]) => display === displaySlot)?.[0];
    
    // 找到匹配的記錄
    const record = dayRecords.find(r => r.scheduled_time === scheduledTime);
    
    // 格式化實際觀察時間為 HH:MM
    const formatObservationTime = (time: string | null | undefined): string => {
      if (!time) return '';
      // 如果已經是 HH:MM 格式，直接返回
      if (/^\d{2}:\d{2}$/.test(time)) return time;
      // 如果是 ISO 時間字串，提取時和分
      const dateObj = new Date(time);
      if (!isNaN(dateObj.getTime())) {
        return `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
      }
      return time;
    };
    
    // 備註欄：顯示觀察狀態，如有 notes 則一起顯示（如 "N (外出)"）
    const remarksDisplay = record?.observation_status 
      ? (record.notes ? `${record.observation_status} (${record.notes})` : record.observation_status)
      : (record?.notes || '');
    
    return `
      <tr>
        <td>${displaySlot}</td>
        <td>${formatObservationTime(record?.observation_time)}</td>
        <td>${record ? getUsedRestraintNumbers(record.used_restraints) : ''}</td>
        <td>${remarksDisplay}</td>
        <td>${record?.recorder || ''}</td>
        <td>${record?.co_signer || ''}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="observation-table-container">
      <table class="data-table observation-table">
        <thead>
          <tr><th colspan="6">日期：${formatDateShort(date)}</th></tr>
          <tr>
            <th class="time-slot">觀察時段</th>
            <th class="actual-time">實際觀察時間</th>
            <th class="item-id">約束物品編號</th>
            <th class="remarks">備註<br/>N/P/S</th>
            <th class="signature">簽署/姓名</th>
            <th class="countersign">加簽*/姓名</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
};

// 生成約束物品配置表格 - 對應評估中的建議約束物品
const generateConstraintTable = (config: {
  items: RestraintConfigItem[];
}): string => {
  const rows = config.items.map(item => {
    // 約束情況選項 - 始終顯示，根據選取狀態決定是否打勾
    const conditionOptions = item.category === '6' 
      ? `<label class="checkbox-label"><span class="checkbox${item.checked && item.usageConditions === '坐在椅上/輪椅上' ? ' checked' : ''}"></span>坐在椅上/輪椅上</label>`
      : `
        <label class="checkbox-label"><span class="checkbox${item.checked && item.usageConditions === '坐在椅上' ? ' checked' : ''}"></span>坐在椅上</label>
        <label class="checkbox-label"><span class="checkbox${item.checked && item.usageConditions === '躺在床上' ? ' checked' : ''}"></span>躺在床上</label>
        <label class="checkbox-label"><span class="checkbox${item.checked && item.usageConditions === '坐在椅上及躺在床上' ? ' checked' : ''}"></span>坐在椅上及躺在床上</label>
      `;

    // 時段選項 - 顯示具體時間（僅當該項目被選中且有設定時間時才顯示）
    const dayTimeText = item.checked && item.dayTime && item.dayStartTime && item.dayEndTime 
      ? ` (由${item.dayStartTime}時至${item.dayEndTime}時)` 
      : '';
    const nightTimeText = item.checked && item.nightTime && item.nightStartTime && item.nightEndTime 
      ? ` (由${item.nightStartTime}時至${item.nightEndTime}時)` 
      : '';

    // 標籤顯示（其他類型顯示具體名稱）
    const labelText = item.category === '7' && item.checked && item.otherRestraintType 
      ? `其他：${item.otherRestraintType}` 
      : item.label;

    // 時段選項 - 始終顯示，根據選取狀態決定是否打勾
    const timeOptions = `
      <label class="checkbox-label"><span class="checkbox${item.checked && item.dayTime ? ' checked' : ''}"></span>日間${dayTimeText}</label>
      <label class="checkbox-label"><span class="checkbox${item.checked && item.nightTime ? ' checked' : ''}"></span>晚上${nightTimeText}</label>
      <label class="checkbox-label"><span class="checkbox${item.checked && item.allDay ? ' checked' : ''}"></span>全日</label>
      ${item.checked && item.otherTime ? `<label class="checkbox-label"><span class="checkbox checked"></span>其他：${item.otherTime}</label>` : ''}
    `;

    return `
      <tr>
        <td class="item-no">${item.category}<br/><label class="checkbox-label"><span class="checkbox${item.checked ? ' checked' : ''}"></span>${labelText}</label></td>
        <td>${conditionOptions}</td>
        <td>${timeOptions}</td>
      </tr>
    `;
  }).join('');

  return `
    <table class="data-table constraint-table">
      <thead>
        <tr>
          <th style="width: 25%;">約束物品<br/>編號及類別</th>
          <th style="width: 35%;">約束情況</th>
          <th style="width: 40%;">約束時段</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

// 生成完整 HTML
export const generateRestraintObservationHtml = (data: ExportData): string => {
  const { patient, records, assessment, dateRange, facilityName } = data;
  const config = extractRestraintConfig(assessment);

  // 計算4天日期
  const startDate = new Date(dateRange.start);
  const dates: string[] = [];
  for (let i = 0; i < 4; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  const observationTables = dates.map(date => generateDayObservationTable(date, records)).join('');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>身體約束物品觀察記錄表</title>
<style>
@page {
  size: A4;
  margin: 4.75mm;
}
@media print {
  html, body {
    width: 210mm;
    height: 297mm;
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
  .form-container {
    box-shadow: none;
    border: none;
    max-width: 100%;
    padding: 2.85mm;
    margin: 0;
    height: 287mm;
    display: flex;
    flex-direction: column;
  }
}
body {
  font-family: "Microsoft JhengHei", "微軟正黑體", "PingFang TC", "Heiti TC", sans-serif;
  margin: 0;
  padding: 2px;
  background-color: #f4f4f4;
  font-size: 9.5px;
  line-height: 1.24;
  color: #333;
}
.form-container {
  max-width: 210mm;
  margin: 0 auto;
  background-color: #fff;
  border: 1px solid #ccc;
  box-shadow: 0 0 9.5px rgba(0, 0, 0, 0.1);
  padding: 3.8mm;
}
.header-section {
  text-align: center;
  margin-bottom: 2.85px;
  border-bottom: 1.4px solid #000;
  padding-bottom: 2px;
}
.main-title {
  font-size: 13.3px;
  font-weight: bold;
  margin: 0 0 1px 0;
}
.sub-title {
  font-size: 8.55px;
  color: #555;
  margin: 0;
}
.info-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3.8px;
  font-size: 10.45px;
}
.info-item {
  display: flex;
  align-items: center;
}
.info-item span {
  margin-right: 2.85px;
}
.underline-input {
  border-bottom: 1px solid #000;
  padding: 0 3.8px;
  min-width: 85.5px;
  height: 15.2px;
  display: inline-block;
}
.prefilled {
  font-weight: bold;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 3.8px;
}
.data-table th,
.data-table td {
  border: 1px solid #000;
  padding: 2px 2.85px;
  vertical-align: middle;
  text-align: left;
  font-size: 8.55px;
}
.data-table th {
  background-color: #e9ecef;
  font-weight: bold;
  text-align: center;
}
.constraint-table {
  margin-bottom: 2.85px;
}
.constraint-table .item-no {
  width: 22%;
  text-align: left;
  font-weight: bold;
  font-size: 9.5px;
  padding: 2.85px 2px;
}
.constraint-table td {
  font-size: 9.5px;
  padding: 2.85px 3.8px;
  line-height: 1.33;
}
.checkbox-label {
  display: inline-flex;
  align-items: center;
  margin-right: 7.6px;
  margin-bottom: 1px;
  font-size: 9.5px;
}
.checkbox {
  width: 10.45px;
  height: 10.45px;
  border: 1px solid #333;
  display: inline-block;
  margin-right: 2px;
  background-color: #fff;
  flex-shrink: 0;
}
.checkbox.checked {
  background-color: #333;
  position: relative;
}
.checkbox.checked::after {
  content: '✓';
  color: #fff;
  font-size: 8.55px;
  position: absolute;
  top: -1px;
  left: 1px;
}
.notes-section {
  display: flex;
  gap: 7.6px;
  margin-bottom: 3.8px;
  padding: 2.85px 4.75px;
  border: 1px solid #ccc;
  background-color: #fafafa;
  font-size: 7.6px;
}
.notes-column {
  flex: 1;
}
.notes-column h4 {
  font-size: 8.55px;
  margin-top: 0;
  margin-bottom: 2.85px;
  border-bottom: 1px solid #ccc;
  padding-bottom: 2px;
  font-weight: bold;
}
.notes-column p, .notes-column div {
  margin: 0 0 2px 0;
}
.notes-column ul, .notes-column ol {
  padding-left: 13.3px;
  margin: 0;
}
.notes-column li {
  margin-bottom: 1px;
}
.observation-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4.75px;
  flex: 1;
}
.observation-table-container {
  page-break-inside: avoid;
}
.observation-table th[colspan="6"] {
  font-size: 9.5px;
  padding: 2.85px;
  background-color: #d9d9d9;
}
.observation-table th,
.observation-table td {
  padding: 2.85px 2px;
  text-align: center;
  height: 17.1px;
  font-size: 8.55px;
}
.observation-table thead tr:nth-child(2) th {
  font-size: 7.6px;
  padding: 2px;
}
.observation-table .time-slot { width: 17%; }
.observation-table .actual-time { width: 18%; }
.observation-table .item-id { width: 17%; }
.observation-table .remarks { width: 14%; }
.observation-table .signature { width: 17%; }
.observation-table .countersign { width: 17%; }
.footer-note {
  margin-top: 2.85px;
  padding-top: 2.85px;
  border-top: 1px solid #000;
  font-size: 7.6px;
  color: #333;
}
.print-btn-container {
  text-align: center;
  margin: 14.25px 0;
}
.print-btn {
  padding: 9.5px 23.75px;
  font-size: 13.3px;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 5.7px;
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
<div class="form-container">
<header class="header-section">
<h1 class="main-title">身體約束物品觀察記錄表 (${formatDateChinese(dates[0])} 至 ${formatDateChinese(dates[3])})</h1>
<p class="sub-title">(須最少每2小時檢查一次住客使用約束的情況)</p>
</header>
<section class="info-section">
<div class="info-item">
<span>院舍名稱：</span>
<span class="underline-input prefilled">${facilityName}</span>
</div>
<div class="info-item">
<span>住客姓名：</span>
<span class="underline-input prefilled">${patient.中文姓氏}${patient.中文名字}</span>
</div>
<div class="info-item">
<span>房及/或床號：</span>
<span class="underline-input prefilled">${patient.床號}</span>
</div>
</section>
${generateConstraintTable(config)}
<section class="notes-section">
<div class="notes-column">
<h4>觀察及留意事項</h4>
<ol>
<li>必須最少每2小時放鬆受約束的部位，讓住客舒展和活動身體。</li>
<li>放鬆受約束的部位後觀察和檢查受約束住客的情況，包括：住客的血液循環、皮膚狀況、呼吸狀況、約束程度、清醒程度，情緒反應、約束的位置有否移位或鬆脫，住客的飲食及如厠需要。</li>
</ol>
</div>
<div class="notes-column">
<h4>備註代號</h4>
<ul>
<li><strong>N</strong> – 所有觀察項目正常</li>
<li><strong>P</strong> – 有不正常跡象 (應立即向主管、護士或保健員報告，加以了解及作出評估，並作適當記錄)</li>
<li><strong>S</strong> – 暫停使用約束物品</li>
</ul>
</div>
</section>
<div class="observation-grid">
${observationTables}
</div>
<footer class="footer-note">
<p><strong>*加簽：</strong>主管/護士/保健員須每日最少一次抽查每位受約束住客的情況，以持續監察員工是否按照正確程序使用約束，並於抽查後在加簽格內簽署作實。</p>
</footer>
</div>
</body>
</html>`;
};

// 使用 iframe 列印
export const exportRestraintObservationHtml = (
  patient: Patient,
  records: RestraintObservationRecord[],
  assessment: PatientRestraintAssessment | null,
  startDate: string,
  facilityName: string = '善頤(福群)護老院'
): void => {
  // 計算結束日期 (4天)
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 3);
  const endDate = end.toISOString().split('T')[0];

  const html = generateRestraintObservationHtml({
    patient,
    records,
    assessment,
    dateRange: { start: startDate, end: endDate },
    facilityName
  });

  // 移除舊的 iframe（如果存在）
  const existingIframe = document.getElementById('restraint-print-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  // 創建隱藏的 iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'restraint-print-iframe';
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
