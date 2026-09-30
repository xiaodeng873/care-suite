/**
 * 身體約束物品觀察記錄表 HTML 匯出器
 * 將約束觀察記錄匯出為可列印的 HTML 格式 (A4 紙張，4天/頁)
 */

import type { RestraintObservationRecord, PatientRestraintAssessment, Patient } from '../lib/database';
import { getPrintBedNumber } from './bedTransferUtils';



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
  includeDayNumber?: boolean;
}

// 標題日期永遠顯示完整日子，不受「不顯示日子」設定影響
const formatTitleDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}年${month}月${day}日`;
};

// 卡片日期可依 includeDayNumber 隱藏日子（保留「日」字，日子以可視空白區域佔位，供手寫）
const formatCardDate = (dateStr: string, includeDayNumber: boolean = true): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return includeDayNumber
    ? `${year}年${month}月${day}日`
    : `${year}年${month}月<span class="blank-day"></span>日`;
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
  { category: '4', label: '約束手套/<s>連指手套</s>', dbKey: '約束手套/連指手套' },
  { category: '5', label: '<s>防滑褲</s>/防滑褲帶', dbKey: '防滑褲/防滑褲帶' },
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

// checkbox 顯示（checked 狀態以黑底白勾表示）
const cb = (on: boolean): string => `<span class="cb${on ? ' on' : ''}"></span>`;

// 生成觀察表格 HTML (單日)
const generateDayObservationTable = (
  date: string,
  records: RestraintObservationRecord[],
  includeDayNumber: boolean = true
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
    <table class="day-table">
      <thead>
        <tr><th colspan="6" class="day-date">日期：${formatCardDate(date, includeDayNumber)}</th></tr>
        <tr>
          <th style="width:17%;">觀察時段</th>
          <th style="width:18%;">實際觀察時間</th>
          <th style="width:17%;">約束物品編號</th>
          <th style="width:14%;">備註<br/>N/P/S</th>
          <th style="width:17%;">簽署/姓名</th>
          <th style="width:17%;">加簽*/姓名</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

// 生成約束物品配置表格 - 對應評估中的建議約束物品
const generateConstraintTable = (config: {
  items: RestraintConfigItem[];
}): string => {
  const rows = config.items.map(item => {
    // 約束情況選項 - 始終顯示，根據選取狀態決定是否打勾
    const conditionOptions = item.category === '6'
      ? `<span class="opt">${cb(item.checked && item.usageConditions === '坐在椅上/輪椅上')}坐在椅上/輪椅上</span>`
      : `
        <span class="opt">${cb(item.checked && item.usageConditions === '坐在椅上')}坐在椅上</span>
        <span class="opt">${cb(item.checked && item.usageConditions === '躺在床上')}躺在床上</span>
        <span class="opt">${cb(item.checked && item.usageConditions === '坐在椅上及躺在床上')}坐在椅上及躺在床上</span>
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
      <span class="opt">${cb(item.checked && item.dayTime)}日間${dayTimeText}</span>
      <span class="opt">${cb(item.checked && item.nightTime)}晚上${nightTimeText}</span>
      <span class="opt">${cb(item.checked && item.allDay)}全日</span>
      <span class="opt">${cb(item.checked && !!item.otherTime)}其他：${item.checked && item.otherTime ? item.otherTime : ''}</span>
    `;

    return `
      <tr>
        <td class="item-no">${item.category}<br/>${cb(item.checked)}${labelText}</td>
        <td>${conditionOptions}</td>
        <td>${timeOptions}</td>
      </tr>
    `;
  }).join('');

  return `
    <table class="constraint-table">
      <thead>
        <tr>
          <th style="width:25%;">約束物品種類<br/>編號及類別</th>
          <th style="width:35%;">使用約束物品情況</th>
          <th style="width:40%;">使用約束物品的時段</th>
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
  const { patient, records, assessment, dateRange, facilityName, includeDayNumber = true } = data;
  const config = extractRestraintConfig(assessment);

  // 計算最多4天日期，但不超過 dateRange.end
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  const dates: string[] = [];
  for (let i = 0; i < 4; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    if (date > endDate) break;
    dates.push(dateStr);
  }

  const observationTables = dates.map(date => generateDayObservationTable(date, records, includeDayNumber)).join('');

  const startDateLabel = formatTitleDate(dates[0]);
  const endDateLabel = formatTitleDate(dates[dates.length - 1]);

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>身體約束物品觀察記錄表</title>
<style>
/* 基礎（螢幕）樣式在前；@media print 放最後，確保列印規則永遠贏
   （printCombinedHtml 會拆殼 @media print，靠次序保證層疊正確） */
@page {
  size: A4;
  margin: 5mm;
}
* {
  box-sizing: border-box;
}
body {
  font-family: "Microsoft JhengHei", "微軟正黑體", "PingFang TC", "Heiti TC", sans-serif;
  margin: 0;
  padding: 8px;
  background-color: #f4f4f4;
  font-size: 12px;
  line-height: 1.3;
  color: #222;
}
.page {
  width: 200mm;
  margin: 0 auto;
  background-color: #fff;
}
.header {
  text-align: center;
  border-bottom: 1.5px solid #000;
  padding-bottom: 0.5mm;
  margin-bottom: 1mm;
}
.header h1 {
  font-size: 18px;
  font-weight: bold;
  margin: 0 0 0.5mm 0;
}
.header .sub {
  font-size: 11px;
  color: #444;
  margin: 0;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  margin-bottom: 1mm;
}
.info-row .v {
  border-bottom: 1px solid #000;
  padding: 0 2mm;
  min-width: 30mm;
  display: inline-block;
  font-weight: bold;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border: 1px solid #000;
  padding: 0.4mm 1.2mm;
  vertical-align: middle;
  font-size: 11px;
  text-align: left;
  line-height: 1.2;
}
th {
  background-color: #e9ecef;
  font-weight: bold;
  text-align: center;
}
.cb {
  display: inline-block;
  width: 11px;
  height: 11px;
  border: 1px solid #333;
  background: #fff;
  margin-right: 1mm;
  vertical-align: -1px;
  position: relative;
}
.cb.on {
  background: #333;
}
.cb.on::after {
  content: '✓';
  color: #fff;
  font-size: 10px;
  position: absolute;
  top: -1px;
  left: 1px;
}
.opt {
  display: inline-flex;
  align-items: center;
  margin-right: 1mm;
  white-space: nowrap;
}
.constraint-table {
  margin-bottom: 1mm;
}
.constraint-table td.item-no {
  font-weight: bold;
}
.notes {
  display: flex;
  gap: 4mm;
  border: 1px solid #999;
  padding: 0.5mm 2mm;
  margin-bottom: 1mm;
  font-size: 10px;
  line-height: 1.2;
}
.notes .col {
  flex: 1;
}
.notes h4 {
  font-size: 11px;
  margin: 0 0 0.5mm 0;
  border-bottom: 1px solid #999;
  padding-bottom: 0.5mm;
}
.notes ol, .notes ul {
  margin: 0;
  padding-left: 4mm;
}
.day-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1mm;
}
.day-table {
  page-break-inside: avoid;
}
.day-table .day-date {
  font-size: 11px;
  background-color: #d9d9d9;
}
.day-table th, .day-table td {
  text-align: center;
  font-size: 9.5px;
  padding: 0.5mm 1mm;
  height: 6mm;
}
.day-table thead tr:nth-child(2) th {
  font-size: 9px;
}
.blank-day {
  display: inline-block;
  width: 40px;
  min-height: 1em;
  border-bottom: 1px solid #000;
  margin: 0 4px;
  vertical-align: bottom;
}
.footer {
  margin-top: 1.5mm;
  border-top: 1px solid #000;
  padding-top: 0.5mm;
  font-size: 10px;
}
.footer p {
  margin: 0;
}
.print-btn-container {
  text-align: center;
  margin: 14px 0;
}
.print-btn {
  padding: 9px 24px;
  font-size: 14px;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
@media print {
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    padding: 0;
    margin: 0;
    background-color: #fff;
  }
  .no-print {
    display: none !important;
  }
  .page {
    width: 100%;
    margin: 0;
    /* 內容唔夠一頁時，footer 釘喺頁底，唔留大段空白；內容超頁時自然流向第二頁（唔會被裁） */
    min-height: 286mm;
    display: flex;
    flex-direction: column;
  }
  .footer {
    margin-top: auto;
  }
}
</style>
</head>
<body>
<div class="print-btn-container no-print">
  <button class="print-btn" onclick="window.print()">列印此頁</button>
</div>
<div class="page">
<header class="header">
<h1>身體約束物品觀察記錄表 (${startDateLabel} 至 ${endDateLabel})</h1>
<p class="sub">(須最少每2小時檢查一次住客使用約束的情況)</p>
</header>
<div class="info-row">
<span>院舍名稱：<span class="v">${facilityName}</span></span>
<span>住客姓名：<span class="v">${patient.中文姓氏}${patient.中文名字}</span></span>
<span>房及/或床號：<span class="v">${getPrintBedNumber(patient)}</span></span>
</div>
${generateConstraintTable(config)}
<div class="notes">
<div class="col">
<h4>觀察及留意事項</h4>
<ol>
<li>必須最少每2小時放鬆受約束的部位，讓住客舒展和活動身體。</li>
<li>放鬆受約束的部位後觀察和檢查受約束住客的情況，包括：住客的血液循環、皮膚狀況、呼吸狀況、約束程度、清醒程度，情緒反應、約束的位置有否移位或鬆脫，住客的飲食及如厠需要。</li>
</ol>
</div>
<div class="col">
<h4>備註代號</h4>
<ul>
<li><strong>N</strong> – 所有觀察項目正常</li>
<li><strong>P</strong> – 有不正常跡象 (應立即向主管、護士或保健員報告，加以了解及作出評估，並作適當記錄)</li>
<li><strong>S</strong> – 暫停使用約束物品</li>
</ul>
</div>
</div>
<div class="day-grid">
${observationTables}
</div>
<footer class="footer">
<p><strong>*加簽：</strong>主管/護士/保健員須每日最少一次抽查每位受約束住客的情況，以持續監察員工是否按照正確程序使用約束，並於抽查後在加簽格內簽署作實。</p>
</footer>
</div>
</body>
</html>`;
};

// 使用 iframe 列印（單一院友、單一 4 天區塊）
// facilityName 未提供時自動從院舍設定讀取，避免誤用品牌後備名 eHMS
export const exportRestraintObservationHtml = async (
  patient: Patient,
  records: RestraintObservationRecord[],
  assessment: PatientRestraintAssessment | null,
  startDate: string,
  includeDayNumber: boolean = true,
  facilityName?: string
): Promise<void> => {
  const resolvedFacilityName =
    facilityName ?? (await (await import('./facilitySettings')).getFacilitySettings()).facilityNameZh;
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
    facilityName: resolvedFacilityName,
    includeDayNumber,
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

// ── 日期範圍版產生（每4天一頁，單一院友）──────────────────────────────────
export const generateRestraintObservationRangeHtml = (
  patient: Patient,
  records: RestraintObservationRecord[],
  assessment: PatientRestraintAssessment | null,
  startDate: string,
  endDate: string,
  includeDayNumber: boolean = true,
  facilityName: string
): string[] => {
  const chunks: string[] = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    chunks.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 4);
  }
  return chunks.map(chunkStart => {
    const chunkStartDate = new Date(chunkStart);
    const chunkEndDate = new Date(chunkStartDate);
    chunkEndDate.setDate(chunkStartDate.getDate() + 3);
    const chunkEnd = chunkEndDate.toISOString().split('T')[0];
    const actualChunkEnd = chunkEnd < endDate ? chunkEnd : endDate;
    return generateRestraintObservationHtml({
      patient, records, assessment,
      dateRange: { start: chunkStart, end: actualChunkEnd },
      facilityName,
      includeDayNumber,
    });
  });
};

// ── 日期範圍版匯出（每4天一頁，單一院友）──────────────────────────────────
// facilityName 未提供時自動從院舍設定讀取，避免誤用品牌後備名 eHMS
export const exportRestraintObservationRangeHtml = async (
  patient: Patient,
  records: RestraintObservationRecord[],
  assessment: PatientRestraintAssessment | null,
  startDate: string,
  endDate: string,
  includeDayNumber: boolean = true,
  facilityName?: string
): Promise<void> => {
  const resolvedFacilityName =
    facilityName ?? (await (await import('./facilitySettings')).getFacilitySettings()).facilityNameZh;
  import('./printUtils').then(({ printCombinedHtml }) => {
    const pages = generateRestraintObservationRangeHtml(patient, records, assessment, startDate, endDate, includeDayNumber, resolvedFacilityName);
    // 單面列印：多頁文件之間唔補空白頁
    printCombinedHtml(pages, 'restraint-print-iframe', false, false);
  });
};

// ── 日期範圍版匯出（每4天一頁，多院友）──────────────────────────────────
export const exportRestraintObservationsRangeHtml = async (
  items: {
    patient: Patient;
    records: RestraintObservationRecord[];
    assessment: PatientRestraintAssessment | null;
  }[],
  startDate: string,
  endDate: string,
  includeDayNumber: boolean = true,
  facilityName?: string
): Promise<void> => {
  const resolvedFacilityName =
    facilityName ?? (await (await import('./facilitySettings')).getFacilitySettings()).facilityNameZh;
  import('./printUtils').then(({ printCombinedHtml }) => {
    const pages: string[] = [];
    items.forEach(({ patient, records, assessment }) => {
      pages.push(...generateRestraintObservationRangeHtml(patient, records, assessment, startDate, endDate, includeDayNumber, resolvedFacilityName));
    });
    // 單面列印：多頁文件之間唔補空白頁
    printCombinedHtml(pages, 'restraint-print-iframe', false, false);
  });
};
