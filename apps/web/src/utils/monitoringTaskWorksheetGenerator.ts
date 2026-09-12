import { supabase } from '../lib/supabase';
import { isTaskScheduledForDate } from './taskScheduler';
import { getExemptedMonitoringTaskIds } from './monitoringCoverage';
import { formatDisplayDate } from './dateFormat';
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
  dateShort: string;
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
// 監測任務類型 → 工作紙分類（沿用上壓/下壓/脈搏/血糖欄位版面）。
// 新版任務改為逐項生命表徵（血壓/脈搏/血含氧量/呼吸）以及血糖值，
// 在此映射回兩大分類，並於同一時段、同一院友去重，避免逐項任務產生多列。
// 註：體溫任務改由「一鍵生成體溫」流程處理；體重任務亦不納入監測工作紙。
const WORKSHEET_CATEGORY_MAP: Record<string, '生命表徵' | '血糖控制'> = {
  '血壓': '生命表徵', '脈搏': '生命表徵',
  '血含氧量': '生命表徵', '呼吸': '生命表徵', '生命表徵': '生命表徵',
  '血糖值': '血糖控制', '血糖控制': '血糖控制',
};
// 注意：health_record_type 為 Postgres enum (health_task_type)，
// 只可查詢實際存在於 enum 的值。傳入舊版彙總值（生命表徵/血糖控制/體重控制）
// 會令整個查詢拋出 22P02 enum 錯誤，導致工作紙空白。
// 體溫、體重不納入工作紙（體溫改由一鍵生成體溫流程處理）。
const MONITORING_WORKSHEET_TYPES = [
  '生命表徵', '血壓', '脈搏', '血含氧量', '呼吸', '血糖值',
];
const fetchTasksForDate = async (targetDate: Date, patientIds?: Set<number>): Promise<TimeSlotTasks> => {
  const { data: allTasks, error } = await supabase
    .from('patient_health_tasks')
    .select(`
      *,
      院友主表!inner(床號, 中文姓名, 在住狀態)
    `)
    .in('health_record_type', MONITORING_WORKSHEET_TYPES)
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
  // 豁免狀態的每週監測任務（同一院友同一項已有密過每週一次任務）不列入工作紙
  const exemptedTaskIds = getExemptedMonitoringTaskIds(allTasks || []);
  const targetDateCopy = new Date(targetDate);
  targetDateCopy.setHours(0, 0, 0, 0);
  const seen = new Set<string>();
  const pushTask = (slot: keyof TimeSlotTasks, time: string, task: any, taskType: string) => {
    const key = `${slot}|${task.院友主表.床號}|${time}|${taskType}`;
    if (seen.has(key)) return;
    seen.add(key);
    timeSlotTasks[slot].push({
      床號: task.院友主表.床號,
      姓名: task.院友主表.中文姓名,
      任務類型: taskType,
      備註: task.notes || '',
      時間: time
    });
  };
  allTasks?.forEach((task: any) => {
    if (task.院友主表.在住狀態 !== '在住') return;
    if (patientIds && !patientIds.has(task.patient_id)) return;
    if (exemptedTaskIds.has(task.id)) return;
    const isScheduled = isTaskScheduledForDate(task, targetDateCopy);
    if (!isScheduled) return;
    const taskType = WORKSHEET_CATEGORY_MAP[task.health_record_type as string];
    if (!taskType) return;
    const specificTimes = task.specific_times || [];
    if (specificTimes.length > 0) {
      specificTimes.forEach((timeStr: string) => {
        const timeSlot = getTimeSlot(timeStr);
        if (timeSlot) {
          pushTask(timeSlot, timeStr, task, taskType);
        }
      });
    } else {
      const dueDate = new Date(task.next_due_at);
      const time = dueDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      const timeSlot = getTimeSlot(time);
      if (timeSlot) {
        pushTask(timeSlot, time, task, taskType);
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
export type WorksheetLayout = 'half' | 'full';

export const generateMonitoringTaskWorksheet = async (
  startDate: Date,
  patientIds?: Set<number>,
  options?: { layout?: WorksheetLayout }
) => {
  const layout = options?.layout ?? 'half';
  const daysData: DayData[] = [];
  for (let i = 0; i < 4; i++) {
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + i);
    const tasks = await fetchTasksForDate(targetDate, patientIds);
    console.log(`第 ${i + 1} 天任務數量:`, {
      早餐: tasks.早餐.length,
      午餐: tasks.午餐.length,
      晚餐: tasks.晚餐.length,
      宵夜: tasks.宵夜.length
    });
    daysData.push({
      date: formatDisplayDate(targetDate),
      dateShort: `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${targetDate.getFullYear()}`,
      weekday: getWeekdayName(targetDate),
      tasks
    });
  }
  // 配對：Day1+Day2 和 Day3+Day4，每對放在一張A4上（half=上半A5+下半A5；full=每天佔滿整張A4）
  const html = generatePairedHTML(daysData, layout);
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
// 高度估算常數 (單位: mm)
// 對半模式：A5高度210mm，扣除margin後約202mm；全頁直立模式：A4高度297mm，扣除margin後約289mm
// 估算值比實際稍大10%，確保不會溢出
const A5_CONTENT_HEIGHT = 200;         // 對半模式（A4橫向對半=A5）可用內容高度；全頁模式同用此預算再 zoom 放大
const HEADER_HEIGHT = 5.5;     // 頁眉高度
const SLOT_TITLE_HEIGHT = 4.5; // 時段標題高度
const TABLE_HEADER_HEIGHT = 4.5; // 表格欄位標題高度（14px ≈ 4mm + 10%）
const ROW_HEIGHT = 4.6;        // 每行數據高度（16px ≈ 4.2mm + 10%）
const RECHECK_ROW_HEIGHT = ROW_HEIGHT * 2; // 複檢空白列係雙倍行高
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
  /** 本頁已用高度(mm)，供「複檢」空白列計算剩餘空間 */
  usedHeight: number;
}
// 將一天的內容分割成多個頁面（預算高度依版面而定：對半=A5、全頁直立=A4 portrait）
const splitDayIntoPages = (day: DayData, contentHeight: number = A5_CONTENT_HEIGHT): PageContent[] => {
  const pages: PageContent[] = [];
  let currentPage: PageContent = { slots: [], usedHeight: HEADER_HEIGHT };
  let currentHeight = HEADER_HEIGHT;
  const slots = [
    { name: '早餐', fullName: '早餐 (07:00-09:59)', tasks: day.tasks.早餐 },
    { name: '午餐', fullName: '午餐 (10:00-12:59)', tasks: day.tasks.午餐 },
    { name: '晚餐', fullName: '晚餐 (13:00-17:59)', tasks: day.tasks.晚餐 },
    { name: '宵夜', fullName: '宵夜 (18:00-20:00)', tasks: day.tasks.宵夜 }
  ];
  for (const slot of slots) {
    if (slot.tasks.length === 0) continue;
    // 餐段不可跨頁中斷（avoid-break）：整段高度計晒先決定放唔放得落
    const baseSlotHeight = SLOT_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + SLOT_MARGIN;
    const slotHeight = baseSlotHeight + (slot.tasks.length * ROW_HEIGHT);
    if (slotHeight <= contentHeight - currentHeight) {
      currentPage.slots.push({
        name: slot.name,
        fullName: slot.fullName,
        tasks: slot.tasks,
        startIndex: 0,
        endIndex: slot.tasks.length - 1
      });
      currentHeight += slotHeight;
      continue;
    }
    // 放唔落：封起現頁，成段搬去新頁
    if (currentPage.slots.length > 0) {
      currentPage.usedHeight = currentHeight;
      pages.push(currentPage);
      currentPage = { slots: [], usedHeight: HEADER_HEIGHT };
      currentHeight = HEADER_HEIGHT;
    }
    if (slotHeight <= contentHeight - currentHeight) {
      currentPage.slots.push({
        name: slot.name,
        fullName: slot.fullName,
        tasks: slot.tasks,
        startIndex: 0,
        endIndex: slot.tasks.length - 1
      });
      currentHeight += slotHeight;
      continue;
    }
    // 單一餐段已經超過一頁（極端情況）：退而求其次逐行分配
    let taskIndex = 0;
    while (taskIndex < slot.tasks.length) {
      const remainingHeight = contentHeight - currentHeight - baseSlotHeight;
      const maxRows = Math.max(1, Math.floor(remainingHeight / ROW_HEIGHT));
      const tasksForThisPage = Math.min(maxRows, slot.tasks.length - taskIndex);
      currentPage.slots.push({
        name: slot.name,
        fullName: slot.fullName,
        tasks: slot.tasks.slice(taskIndex, taskIndex + tasksForThisPage),
        startIndex: taskIndex,
        endIndex: taskIndex + tasksForThisPage - 1
      });
      currentHeight += baseSlotHeight + (tasksForThisPage * ROW_HEIGHT);
      taskIndex += tasksForThisPage;
      if (taskIndex < slot.tasks.length) {
        currentPage.usedHeight = currentHeight;
        pages.push(currentPage);
        currentPage = { slots: [], usedHeight: HEADER_HEIGHT };
        currentHeight = HEADER_HEIGHT;
      }
    }
  }
  // 最後一頁
  if (currentPage.slots.length > 0) {
    currentPage.usedHeight = currentHeight;
    pages.push(currentPage);
  }
  // 如果沒有任何內容，至少返回一個空白頁
  if (pages.length === 0) {
    pages.push({ slots: [], usedHeight: HEADER_HEIGHT });
  }
  return pages;
};
// 生成單個A5頁面的HTML內容
const generateA5PageContent = (
  day: DayData,
  pageContent: PageContent,
  pageNumber: number,
  totalPages: number,
  isLeftHalf: boolean,
  contentHeight: number = A5_CONTENT_HEIGHT
): string => {
  let slotsHTML = '';
  for (const slot of pageContent.slots) {
    slotsHTML += `
      <div class="time-slot">
        <h3 class="slot-title-main">${slot.fullName}${slot.startIndex > 0 ? ' (續)' : ''}</h3>
        ${generateTimeSlotTableHTMLForPage(slot.tasks, slot.fullName, day)}
      </div>
    `;
  }
  // 複檢：只在每天最後一頁，於四個時段後加空白手寫列，填到 footer 前為止
  let recheckHTML = '';
  const isLastPage = pageNumber === totalPages;
  if (isLastPage) {
    const recheckRows = computeRecheckRows(pageContent.usedHeight ?? HEADER_HEIGHT, contentHeight);
    if (pageContent.slots.length === 0 && recheckRows === 0) {
      slotsHTML = '<div class="empty-page">（無監測任務）</div>';
    } else {
      recheckHTML = generateRecheckTableHTML(recheckRows);
    }
  } else if (pageContent.slots.length === 0) {
    slotsHTML = '<div class="empty-page">（無監測任務）</div>';
  }
  return `
    <div class="day-header-main">
      <span class="date-text">${day.date}（${day.weekday}）</span>
      <span class="title-text">監測任務工作紙</span>
    </div>
    <div class="header-line-main"></div>
    ${slotsHTML}
    ${recheckHTML}
    <div class="page-number-inline">${day.dateShort}-${day.weekday}-第${pageNumber}/${totalPages}頁</div>
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
// 「複檢」空白列：填滿每天最後一頁四個時段之後的剩餘空間（預留 footer 高度），供手寫數值
const FOOTER_RESERVE = 7; // footer（頁碼/列印提示）預留高度(mm)
const computeRecheckRows = (usedHeight: number, contentHeight: number): number => {
  const base = SLOT_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + SLOT_MARGIN + FOOTER_RESERVE;
  return Math.max(0, Math.floor((contentHeight - usedHeight - base) / RECHECK_ROW_HEIGHT));
};
const generateRecheckTableHTML = (rowCount: number): string => {
  const blankRow = `
            <tr class="recheck-row">
              <td></td>
              <td></td>
              <td></td>
              <td class="value-cell"></td>
              <td class="value-cell"></td>
              <td class="value-cell"></td>
              <td class="value-cell"></td>
            </tr>
          `;
  return `
      <div class="time-slot">
        <h3 class="slot-title-main">複檢</h3>
        <table class="task-table">
          <thead>
            <tr class="column-header-row">
              <th style="width: 9%">床號</th>
              <th style="width: 18%">姓名</th>
              <th style="width: 16%">時間</th>
              <th style="width: 14%">上壓</th>
              <th style="width: 14%">下壓</th>
              <th style="width: 14%">脈搏</th>
              <th style="width: 15%">血糖</th>
            </tr>
          </thead>
          <tbody>
            ${Array(Math.max(0, rowCount)).fill(blankRow).join('')}
          </tbody>
        </table>
      </div>
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
const generatePairedHTML = (daysData: DayData[], layout: WorksheetLayout = 'half'): string => {
  let a4PagesHTML = '';
  if (layout === 'full') {
    // 全頁模式：每天佔一整張 A4 直立；內容仍是 A5 半頁版面（分頁/時段/複檢邏輯與對半模式完全一致），
    // 輸出時以 CSS zoom=√2 等比放大（A5→A4 恰好 √2 倍），字格同步變大方便手寫
    daysData.forEach((day) => {
      const pages = splitDayIntoPages(day);
      pages.forEach((page, pIdx) => {
        a4PagesHTML += `
    <div class="a4-page">
      <div class="a5-zoomed">
        ${generateA5PageContent(day, page, pIdx + 1, pages.length, true)}
      </div>
    </div>
  `;
      });
    });
  } else {
  // 將每天的內容分割成頁面；餐段 avoid-break 後一日可能有兩頁以上，配對邏輯要支援任意頁數
  const day1Pages = splitDayIntoPages(daysData[0]);
  const day2Pages = splitDayIntoPages(daysData[1]);
  const day3Pages = splitDayIntoPages(daysData[2]);
  const day4Pages = splitDayIntoPages(daysData[3]);
  // 生成指定日指定頁嘅內容；該日冇呢一頁就留白
  const makeContent = (dayIdx: number, pageIdx: number, isLeftHalf: boolean): string => {
    const pagesArr = [day1Pages, day2Pages, day3Pages, day4Pages][dayIdx];
    const pc = pagesArr[pageIdx];
    if (!pc) return '<div class="empty-page"></div>';
    return generateA5PageContent(daysData[dayIdx], pc, pageIdx + 1, pagesArr.length, isLeftHalf);
  };
  // 輸出一對日（DayA+DayB）嘅雙面A4：每張正面 左=DayA-Pk/右=DayB-Pk，背面 左=DayB-P(k+1)/右=DayA-P(k+1)（交換！）
  const emitPair = (dayA: number, dayB: number) => {
    const maxPages = Math.max(
      [day1Pages, day2Pages, day3Pages, day4Pages][dayA].length,
      [day1Pages, day2Pages, day3Pages, day4Pages][dayB].length
    );
    for (let k = 0; k < maxPages; k += 2) {
      // 正面
      a4PagesHTML += `
    <div class="a4-page">
      <div class="a5-left">${makeContent(dayA, k, true)}</div>
      <div class="a5-right">${makeContent(dayB, k, false)}</div>
    </div>
  `;
      // 背面（其中一日有第 k+1 頁先印）
      if (k + 1 < maxPages) {
        a4PagesHTML += `
      <div class="a4-page">
        <div class="a5-left">${makeContent(dayB, k + 1, true)}</div>
        <div class="a5-right">${makeContent(dayA, k + 1, false)}</div>
      </div>
    `;
      }
    }
  };
  // === 第一組：Day1 + Day2 ===
  emitPair(0, 1);
  // === 第二組：Day3 + Day4 ===
  emitPair(2, 3);
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
          size: ${layout === 'full' ? 'A4 portrait' : 'A4 landscape'};
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
        /* 頁面容器：對半=A4橫向(289×202mm)、全頁=A4直立(202×289mm) */
        .a4-page {
          display: flex;
          flex-direction: row;
          width: ${layout === 'full' ? '202mm' : '289mm'};
          height: ${layout === 'full' ? '289mm' : '202mm'};
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
        /* 全頁模式：A5 半頁版面等比放大 √2 倍（A5→A4），內容幾何與對半模式完全一致 */
        .a5-zoomed {
          zoom: 1.414;
          width: 142.5mm;   /* 放大後 ≈201.5mm，剛好放入 A4 直立內容闊 202mm */
          height: 202mm;    /* 與對半模式半頁同高；放大後 ≈285.6mm ≤ 289mm */
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
        /* 複檢空白列：雙倍行高，方便手寫數值 */
        .task-table tbody tr.recheck-row td {
          height: 36px;
          line-height: 34px;
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
