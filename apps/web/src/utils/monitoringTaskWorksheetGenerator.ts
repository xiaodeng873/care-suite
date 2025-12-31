import { supabase } from '../lib/supabase';
import { isTaskScheduledForDate } from './taskScheduler';
interface MonitoringTask {
  床號: string;
  姓名: string;
  任務類型: string;
  備註: string;
  時間: string;
}
interface TimeSlotTasks {
  早餐: MonitoringTask[];
  午餐: MonitoringTask[];
  晚餐: MonitoringTask[];
  宵夜: MonitoringTask[];
}
interface DayData {
  date: string;
  weekday: string;
  tasks: TimeSlotTasks;
}
const getWeekdayName = (date: Date): string => {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return days[date.getDay()];
};
const getTimeSlot = (time: string): '早餐' | '午餐' | '晚餐' | '宵夜' | null => {
  const hour = parseInt(time.split(':')[0]);
  const minute = parseInt(time.split(':')[1]);
  const totalMinutes = hour * 60 + minute;
  if (totalMinutes >= 7 * 60 && totalMinutes < 10 * 60) return '早餐';
  if (totalMinutes >= 10 * 60 && totalMinutes < 13 * 60) return '午餐';
  if (totalMinutes >= 13 * 60 && totalMinutes < 18 * 60) return '晚餐';
  if (totalMinutes >= 18 * 60 && totalMinutes <= 20 * 60) return '宵夜';
  return null;
};
const fetchTasksForDate = async (targetDate: Date): Promise<TimeSlotTasks> => {
  const { data: allTasks, error } = await supabase
    .from('patient_health_tasks')
    .select(`
      *,
      院友主表!inner(床號, 中文姓名, 在住狀態)
    `)
    .in('health_record_type', ['生命表徵', '血糖控制', '體重控制'])
    .order('next_due_at', { ascending: true });
  if (error) {
    console.error('獲取任務失敗:', error);
    return { 早餐: [], 午餐: [], 晚餐: [], 宵夜: [] };
  }
  const timeSlotTasks: TimeSlotTasks = {
    早餐: [],
    午餐: [],
    晚餐: [],
    宵夜: []
  };
  const targetDateCopy = new Date(targetDate);
  targetDateCopy.setHours(0, 0, 0, 0);
  allTasks?.forEach((task: any) => {
    if (task.院友主表.在住狀態 !== '在住') return;
    const isScheduled = isTaskScheduledForDate(task, targetDateCopy);
    if (!isScheduled) return;
    const taskType = task.health_record_type === '生命表徵' ? '生命表徵' :
                     task.health_record_type === '血糖控制' ? '血糖控制' : '體重控制';
    const specificTimes = task.specific_times || [];
    if (specificTimes.length > 0) {
      specificTimes.forEach((timeStr: string) => {
        const timeSlot = getTimeSlot(timeStr);
        if (timeSlot) {
          timeSlotTasks[timeSlot].push({
            床號: task.院友主表.床號,
            姓名: task.院友主表.中文姓名,
            任務類型: taskType,
            備註: task.notes || '',
            時間: timeStr
          });
        }
      });
    } else {
      const dueDate = new Date(task.next_due_at);
      const time = dueDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      const timeSlot = getTimeSlot(time);
      if (timeSlot) {
        timeSlotTasks[timeSlot].push({
          床號: task.院友主表.床號,
          姓名: task.院友主表.中文姓名,
          任務類型: taskType,
          備註: task.notes || '',
          時間: time
        });
      }
    }
  });
  const getNotePriority = (note: string): number => {
    if (note.includes('注射前')) return 1;
    if (note.includes('服藥前')) return 2;
    if (note.includes('特別關顧')) return 3;
    if (note.includes('定期')) return 4;
    return 5;
  };
  Object.keys(timeSlotTasks).forEach(slot => {
    const tasks = timeSlotTasks[slot as keyof TimeSlotTasks];
    tasks.sort((a, b) => {
      if (a.時間 !== b.時間) return a.時間.localeCompare(b.時間);
      const priorityA = getNotePriority(a.備註);
      const priorityB = getNotePriority(b.備註);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.床號.localeCompare(b.床號);
    });
  });
  return timeSlotTasks;
};
export const generateMonitoringTaskWorksheet = async (startDate: Date) => {
  const daysData: DayData[] = [];
  for (let i = 0; i < 4; i++) {
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + i);
    const tasks = await fetchTasksForDate(targetDate);
    console.log(`第 ${i + 1} 天任務數量:`, {
      早餐: tasks.早餐.length,
      午餐: tasks.午餐.length,
      晚餐: tasks.晚餐.length,
      宵夜: tasks.宵夜.length
    });
    daysData.push({
      date: targetDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }),
      weekday: getWeekdayName(targetDate),
      tasks
    });
  }
  // 配對：Day1+Day2 和 Day3+Day4，每對放在一張A4上（上半A5+下半A5）
  const html = generatePairedHTML(daysData);
  openPrintWindow(html);
};
// 生成時段表格的HTML
const generateTimeSlotTableHTML = (tasks: MonitoringTask[], slotName: string, day: DayData): string => {
  if (tasks.length === 0) return '';
  return `
    <table class="task-table">
      <thead>
        <tr class="page-header-row">
          <th colspan="9" class="page-header-cell">
            <div class="running-header">
              <span class="date-text">${day.date}（${day.weekday}）</span>
              <span class="title-text">監測任務工作紙</span>
            </div>
            <div class="header-line"></div>
            <div class="slot-title">${slotName}</div>
          </th>
        </tr>
        <tr class="column-header-row">
          <th style="width: 9%">床號</th>
          <th style="width: 9%">姓名</th>
          <th style="width: 9%">任務</th>
          <th style="width: 9%">備註</th>
          <th style="width: 7%">時間</th>
          <th style="width: 14%">上壓</th>
          <th style="width: 14%">下壓</th>
          <th style="width: 14%">脈搏</th>
          <th style="width: 15%">血糖</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(task => {
          const isVitalSigns = task.任務類型 === '生命表徵';
          const isBloodSugar = task.任務類型 === '血糖控制';
          return `
            <tr>
              <td>${task.床號}</td>
              <td>${task.姓名}</td>
              <td>${task.任務類型}</td>
              <td>${task.備註}</td>
              <td>${task.時間}</td>
              <td class="${isBloodSugar ? 'disabled-cell' : 'value-cell'}"></td>
              <td class="${isBloodSugar ? 'disabled-cell' : 'value-cell'}"></td>
              <td class="${isBloodSugar ? 'disabled-cell' : 'value-cell'}"></td>
              <td class="${isVitalSigns ? 'disabled-cell' : 'value-cell'}"></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
};
// 生成單天的內容HTML（不含外層wrapper）
const generateDayContent = (day: DayData): string => {
  const hasSupper = day.tasks.宵夜.length > 0;
  return `
    <div class="day-header-main">
      <span class="date-text">${day.date}（${day.weekday}）</span>
      <span class="title-text">監測任務工作紙</span>
    </div>
    <div class="header-line-main"></div>
    <div class="time-slot">
      <h3 class="slot-title-main">早餐 (07:00-09:59)</h3>
      ${generateTimeSlotTableHTML(day.tasks.早餐, '早餐 (07:00-09:59)', day)}
    </div>
    <div class="time-slot">
      <h3 class="slot-title-main">午餐 (10:00-12:59)</h3>
      ${generateTimeSlotTableHTML(day.tasks.午餐, '午餐 (10:00-12:59)', day)}
    </div>
    <div class="time-slot">
      <h3 class="slot-title-main">晚餐 (13:00-17:59)</h3>
      ${generateTimeSlotTableHTML(day.tasks.晚餐, '晚餐 (13:00-17:59)', day)}
    </div>
    ${hasSupper ? `
    <div class="time-slot">
      <h3 class="slot-title-main">宵夜 (18:00-20:00)</h3>
      ${generateTimeSlotTableHTML(day.tasks.宵夜, '宵夜 (18:00-20:00)', day)}
    </div>
    ` : ''}
  `;
};
// 高度估算常數 (單位: mm) - A5高度210mm，扣除margin後約202mm
// 估算值比實際稍大10%，確保不會溢出
const A5_CONTENT_HEIGHT = 200; // A5可用內容高度
const HEADER_HEIGHT = 5.5;     // 頁眉高度
const SLOT_TITLE_HEIGHT = 4.5; // 時段標題高度
const TABLE_HEADER_HEIGHT = 4.5; // 表格欄位標題高度（14px ≈ 4mm + 10%）
const ROW_HEIGHT = 4.6;        // 每行數據高度（16px ≈ 4.2mm + 10%）
const SLOT_MARGIN = 1.5;       // 時段之間的間距
// 計算單個時段需要的高度
const calculateSlotHeight = (taskCount: number): number => {
  if (taskCount === 0) return 0;
  return SLOT_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + (taskCount * ROW_HEIGHT) + SLOT_MARGIN;
};
// 定義頁面內容結構
interface PageContent {
  slots: Array<{
    name: string;
    fullName: string;
    tasks: MonitoringTask[];
    startIndex: number;  // 從第幾個任務開始
    endIndex: number;    // 到第幾個任務結束
  }>;
}
// 將一天的內容分割成多個A5頁面
const splitDayIntoPages = (day: DayData): PageContent[] => {
  const pages: PageContent[] = [];
  let currentPage: PageContent = { slots: [] };
  let currentHeight = HEADER_HEIGHT;
  const slots = [
    { name: '早餐', fullName: '早餐 (07:00-09:59)', tasks: day.tasks.早餐 },
    { name: '午餐', fullName: '午餐 (10:00-12:59)', tasks: day.tasks.午餐 },
    { name: '晚餐', fullName: '晚餐 (13:00-17:59)', tasks: day.tasks.晚餐 },
    { name: '宵夜', fullName: '宵夜 (18:00-20:00)', tasks: day.tasks.宵夜 }
  ];
  for (const slot of slots) {
    if (slot.tasks.length === 0) continue;
    let taskIndex = 0;
    while (taskIndex < slot.tasks.length) {
      // 計算這個時段標題+表頭需要的基礎高度
      const baseSlotHeight = SLOT_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + SLOT_MARGIN;
      // 計算當前頁面還能容納多少行
      const remainingHeight = A5_CONTENT_HEIGHT - currentHeight - baseSlotHeight;
      const maxRowsInCurrentPage = Math.max(0, Math.floor(remainingHeight / ROW_HEIGHT));
      if (maxRowsInCurrentPage <= 0) {
        // 當前頁放不下，開新頁
        if (currentPage.slots.length > 0) {
          pages.push(currentPage);
          currentPage = { slots: [] };
          currentHeight = HEADER_HEIGHT;
        }
        continue;
      }
      // 確定這一頁能放多少個任務
      const tasksForThisPage = Math.min(maxRowsInCurrentPage, slot.tasks.length - taskIndex);
      currentPage.slots.push({
        name: slot.name,
        fullName: slot.fullName,
        tasks: slot.tasks.slice(taskIndex, taskIndex + tasksForThisPage),
        startIndex: taskIndex,
        endIndex: taskIndex + tasksForThisPage - 1
      });
      currentHeight += baseSlotHeight + (tasksForThisPage * ROW_HEIGHT);
      taskIndex += tasksForThisPage;
      // 如果這個時段還沒處理完，開新頁繼續
      if (taskIndex < slot.tasks.length) {
        pages.push(currentPage);
        currentPage = { slots: [] };
        currentHeight = HEADER_HEIGHT;
      }
    }
  }
  // 最後一頁
  if (currentPage.slots.length > 0) {
    pages.push(currentPage);
  }
  // 如果沒有任何內容，至少返回一個空白頁
  if (pages.length === 0) {
    pages.push({ slots: [] });
  }
  return pages;
};
// 生成單個A5頁面的HTML內容
const generateA5PageContent = (
  day: DayData, 
  pageContent: PageContent, 
  pageNumber: number, 
  totalPages: number,
  isLeftHalf: boolean
): string => {
  const dayNum = day.date.match(/(\d+)日/)?.[1] || '';
  let slotsHTML = '';
  for (const slot of pageContent.slots) {
    slotsHTML += `
      <div class="time-slot">
        <h3 class="slot-title-main">${slot.fullName}${slot.startIndex > 0 ? ' (續)' : ''}</h3>
        ${generateTimeSlotTableHTMLForPage(slot.tasks, slot.fullName, day)}
      </div>
    `;
  }
  // 如果沒有內容，顯示空白頁提示
  if (pageContent.slots.length === 0) {
    slotsHTML = '<div class="empty-page">（無監測任務）</div>';
  }
  return `
    <div class="day-header-main">
      <span class="date-text">${day.date}（${day.weekday}）</span>
      <span class="title-text">監測任務工作紙</span>
    </div>
    <div class="header-line-main"></div>
    ${slotsHTML}
    <div class="page-number-inline">${dayNum}日 - 第${pageNumber}頁${totalPages > 1 ? ` / 共${totalPages}頁` : ''}</div>
    ${isLeftHalf ? '<div class="print-note">雙面列印：長邊翻轉</div>' : ''}
  `;
};
// 為頁面生成時段表格HTML（不含page-header-row）
const generateTimeSlotTableHTMLForPage = (tasks: MonitoringTask[], slotName: string, day: DayData): string => {
  if (tasks.length === 0) return '';
  return `
    <table class="task-table">
      <thead>
        <tr class="column-header-row">
          <th style="width: 9%">床號</th>
          <th style="width: 9%">姓名</th>
          <th style="width: 9%">任務</th>
          <th style="width: 9%">備註</th>
          <th style="width: 7%">時間</th>
          <th style="width: 14%">上壓</th>
          <th style="width: 14%">下壓</th>
          <th style="width: 14%">脈搏</th>
          <th style="width: 15%">血糖</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(task => {
          const isVitalSigns = task.任務類型 === '生命表徵';
          const isBloodSugar = task.任務類型 === '血糖控制';
          return `
            <tr>
              <td>${task.床號}</td>
              <td>${task.姓名}</td>
              <td>${task.任務類型}</td>
              <td>${task.備註}</td>
              <td>${task.時間}</td>
              <td class="${isBloodSugar ? 'disabled-cell' : 'value-cell'}"></td>
              <td class="${isBloodSugar ? 'disabled-cell' : 'value-cell'}"></td>
              <td class="${isBloodSugar ? 'disabled-cell' : 'value-cell'}"></td>
              <td class="${isVitalSigns ? 'disabled-cell' : 'value-cell'}"></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
};
// 生成配對的HTML：Day1+Day2配對，Day3+Day4配對
// A4橫向，雙面列印後可剪開
// 
// 布局邏輯（長邊翻轉）：
// - 第1張A4正面：左=Day1-P1，右=Day2-P1
// - 第1張A4背面：左=Day2-P2，右=Day1-P2（交換！）
// 
// 長邊翻轉後，正面左半對應背面右半，正面右半對應背面左半
// 剪開後：
// - 左半紙：正面Day1-P1，背面Day1-P2 ✓
// - 右半紙：正面Day2-P1，背面Day2-P2 ✓
const generatePairedHTML = (daysData: DayData[]): string => {
  // 將每天的內容分割成頁面（最多2頁）
  const day1Pages = splitDayIntoPages(daysData[0]);
  const day2Pages = splitDayIntoPages(daysData[1]);
  const day3Pages = splitDayIntoPages(daysData[2]);
  const day4Pages = splitDayIntoPages(daysData[3]);
  // 確保最多2頁
  const d1p1 = day1Pages[0] || { slots: [] };
  const d1p2 = day1Pages[1] || null;
  const d2p1 = day2Pages[0] || { slots: [] };
  const d2p2 = day2Pages[1] || null;
  const d3p1 = day3Pages[0] || { slots: [] };
  const d3p2 = day3Pages[1] || null;
  const d4p1 = day4Pages[0] || { slots: [] };
  const d4p2 = day4Pages[1] || null;
  // 判斷是否需要第2張A4
  const pair1NeedsPage2 = d1p2 !== null || d2p2 !== null;
  const pair2NeedsPage2 = d3p2 !== null || d4p2 !== null;
  let a4PagesHTML = '';
  // === 第一組：Day1 + Day2 ===
  // 第1張A4（正面）：左=Day1-P1，右=Day2-P1
  a4PagesHTML += `
    <div class="a4-page">
      <div class="a5-left">
        ${generateA5PageContent(daysData[0], d1p1, 1, day1Pages.length, true)}
      </div>
      <div class="a5-right">
        ${generateA5PageContent(daysData[1], d2p1, 1, day2Pages.length, false)}
      </div>
    </div>
  `;
  // 第2張A4（背面）：左=Day2-P2，右=Day1-P2（交換位置！）
  if (pair1NeedsPage2) {
    const leftContent = d2p2 
      ? generateA5PageContent(daysData[1], d2p2, 2, day2Pages.length, true)
      : '<div class="empty-page"></div>';
    const rightContent = d1p2 
      ? generateA5PageContent(daysData[0], d1p2, 2, day1Pages.length, false)
      : '<div class="empty-page"></div>';
    a4PagesHTML += `
      <div class="a4-page">
        <div class="a5-left">${leftContent}</div>
        <div class="a5-right">${rightContent}</div>
      </div>
    `;
  }
  // === 第二組：Day3 + Day4 ===
  // 第1張A4（正面）：左=Day3-P1，右=Day4-P1
  a4PagesHTML += `
    <div class="a4-page">
      <div class="a5-left">
        ${generateA5PageContent(daysData[2], d3p1, 1, day3Pages.length, true)}
      </div>
      <div class="a5-right">
        ${generateA5PageContent(daysData[3], d4p1, 1, day4Pages.length, false)}
      </div>
    </div>
  `;
  // 第2張A4（背面）：左=Day4-P2，右=Day3-P2（交換位置！）
  if (pair2NeedsPage2) {
    const leftContent = d4p2 
      ? generateA5PageContent(daysData[3], d4p2, 2, day4Pages.length, true)
      : '<div class="empty-page"></div>';
    const rightContent = d3p2 
      ? generateA5PageContent(daysData[2], d3p2, 2, day3Pages.length, false)
      : '<div class="empty-page"></div>';
    a4PagesHTML += `
      <div class="a4-page">
        <div class="a5-left">${leftContent}</div>
        <div class="a5-right">${rightContent}</div>
      </div>
    `;
  }
  return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>監測任務工作紙</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 4mm;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Microsoft JhengHei', 'Arial', sans-serif;
          font-size: 8pt;
          line-height: 1.15;
        }
        /* A4橫向頁面容器 */
        .a4-page {
          display: flex;
          flex-direction: row;
          width: 289mm;
          height: 202mm;
          page-break-after: always;
          overflow: hidden;
        }
        .a4-page:last-child {
          page-break-after: auto;
        }
        /* 左半部A5 */
        .a5-left {
          width: 50%;
          height: 100%;
          padding: 2mm;
          border-right: 1px dashed #999;
          overflow: hidden;
          position: relative;
        }
        /* 右半部A5 */
        .a5-right {
          width: 50%;
          height: 100%;
          padding: 2mm;
          overflow: hidden;
          position: relative;
        }
        .day-header-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1px 4px;
          background-color: #f0f0f0;
        }
        .day-header-main .date-text,
        .day-header-main .title-text {
          font-size: 9pt;
          font-weight: bold;
        }
        .header-line-main {
          height: 1.5px;
          background-color: #333;
          margin-bottom: 2px;
        }
        .time-slot {
          margin-bottom: 2px;
        }
        .slot-title-main {
          font-size: 9pt;
          font-weight: bold;
          padding: 0px 4px;
          background-color: #e8e8e8;
          margin: 0 0 1px 0;
        }
        .task-table {
          width: 100%;
          border-collapse: collapse;
        }
        .column-header-row th {
          background-color: #d0d0d0;
          font-weight: bold;
          border: 1px solid #666;
          padding: 0px 2px;
          text-align: center;
          font-size: 7pt;
          height: 14px;
        }
        .task-table tbody td {
          border: 1px solid #666;
          padding: 0px 1px;
          text-align: center;
          font-size: 8pt;
          height: 18px;
          line-height: 17px;
        }
        .task-table tbody td:first-child {
          white-space: nowrap;
        }
        .value-cell {
          background-color: #f9f9f9;
        }
        .disabled-cell {
          background-color: #d0d0d0;
        }
        .page-number-inline {
          position: absolute;
          bottom: 1mm;
          right: 2mm;
          font-size: 7pt;
          color: #666;
        }
        .print-note {
          position: absolute;
          bottom: 1mm;
          left: 2mm;
          font-size: 6pt;
          color: #999;
        }
        .empty-page {
          color: #999;
          font-style: italic;
          text-align: center;
          padding-top: 50mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-note {
            display: none;
          }
        }
        @media screen {
          body {
            background: #ccc;
            padding: 10px;
          }
          .a4-page {
            background: white;
            margin: 10px auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
        }
      </style>
    </head>
    <body>
      ${a4PagesHTML}
    </body>
    </html>
  `;
};
const openPrintWindow = (html: string) => {
  // 創建一個隱藏的 iframe 來處理打印
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    // 等待內容載入後打開打印對話框
    iframe.contentWindow?.addEventListener('load', () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        // 打印完成後移除 iframe（延遲以確保打印對話框已關閉）
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    });
  }
};
