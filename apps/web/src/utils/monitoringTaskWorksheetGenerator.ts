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
  console.log('開始生成工作紙，起始日期:', startDate);
  const daysData: DayData[] = [];

  for (let i = 0; i < 4; i++) {
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + i);

    console.log(`正在獲取第 ${i + 1} 天的任務:`, targetDate);
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

  console.log('生成 HTML...');
  const html = generateHTML(daysData);
  console.log('HTML 長度:', html.length);
  console.log('開啟打印窗口...');
  openPrintWindow(html);
};

const generateHTML = (daysData: DayData[]): string => {
  // 計算每天的總行數以確定是否需要縮放
  const calculateTotalRows = (dayData: DayData): number => {
    let totalRows = 0;
    totalRows += dayData.tasks.早餐.length || 1; // 至少1行（無任務提示）
    totalRows += dayData.tasks.午餐.length || 1;
    totalRows += dayData.tasks.晚餐.length || 1;
    if (dayData.tasks.宵夜.length > 0) {
      totalRows += dayData.tasks.宵夜.length;
    }
    return totalRows;
  };

  // 計算縮放比例
  const calculateScale = (daysData: DayData[]): number => {
    const maxRows = Math.max(
      calculateTotalRows(daysData[0]),
      calculateTotalRows(daysData[1]),
      calculateTotalRows(daysData[2]),
      calculateTotalRows(daysData[3])
    );

    // 假設每行約需20px，加上標題和邊距，一頁最多約35行
    const maxRowsPerPage = 35;

    if (maxRows > maxRowsPerPage) {
      // 計算需要縮小的比例
      const scale = maxRowsPerPage / maxRows;
      return Math.max(scale, 0.65); // 最小縮放到65%
    }

    return 1; // 不需要縮放
  };

  const scale = calculateScale(daysData);

  const generateTimeSlotTable = (tasks: MonitoringTask[], showSlot: boolean) => {
    // 只在有任務時才顯示時段
    if (!showSlot || tasks.length === 0) return '';

    return `
      <table class="task-table">
        <thead>
          <tr>
            <th style="width: 8%">床號</th>
            <th style="width: 10%">姓名</th>
            <th style="width: 12%">任務</th>
            <th style="width: 10%">備註</th>
            <th style="width: 8%">時間</th>
            <th style="width: 13%">上壓</th>
            <th style="width: 13%">下壓</th>
            <th style="width: 13%">脈搏</th>
            <th style="width: 13%">血糖</th>
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

  const generateDayColumn = (day: DayData) => {
    const hasSupper = day.tasks.宵夜.length > 0;

    return `
      <div class="day-column">
        <div class="day-header">
          <span class="date-text">${day.date}（${day.weekday}）</span>
          <span class="title-text">監測任務工作紙</span>
        </div>

        <div class="time-slot">
          <h3>早餐 (07:00-09:59)</h3>
          ${generateTimeSlotTable(day.tasks.早餐, true)}
        </div>

        <div class="time-slot">
          <h3>午餐 (10:00-12:59)</h3>
          ${generateTimeSlotTable(day.tasks.午餐, true)}
        </div>

        <div class="time-slot">
          <h3>晚餐 (13:00-17:59)</h3>
          ${generateTimeSlotTable(day.tasks.晚餐, true)}
        </div>

        ${hasSupper ? `
        <div class="time-slot">
          <h3>宵夜 (18:00-20:00)</h3>
          ${generateTimeSlotTable(day.tasks.宵夜, true)}
        </div>
        ` : ''}
      </div>
    `;
  };

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
          margin: 8mm;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Microsoft JhengHei', 'Arial', sans-serif;
          font-size: ${7 * scale}pt;
          line-height: 1.2;
        }

        .page {
          page-break-after: always;
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .page:last-child {
          page-break-after: auto;
        }

        .page-header {
          display: none;
        }

        .page-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: ${10 * scale}px;
          flex: 1;
          transform-origin: top left;
        }

        .day-column {
          border: 1px solid #333;
          padding: ${5 * scale}px;
          display: flex;
          flex-direction: column;
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: ${4 * scale}px;
          background-color: #f0f0f0;
          border-bottom: 2px solid #333;
          margin-bottom: ${5 * scale}px;
        }

        .day-header .date-text {
          font-size: 8pt;
          font-weight: bold;
        }

        .day-header .title-text {
          font-size: 8pt;
          font-weight: bold;
        }

        .time-slot {
          margin-bottom: ${5 * scale}px;
        }

        .time-slot h3 {
          font-size: ${8 * scale}pt;
          font-weight: bold;
          margin-bottom: ${2 * scale}px;
          padding: ${2 * scale}px ${4 * scale}px;
          background-color: #e8e8e8;
        }

        .task-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: ${3 * scale}px;
        }

        .task-table th,
        .task-table td {
          border: 1px solid #666;
          padding: ${2 * scale}px ${3 * scale}px;
          text-align: center;
          font-size: ${7 * scale}pt;
        }

        .task-table th {
          background-color: #d0d0d0;
          font-weight: bold;
        }

        .task-table td {
          min-height: ${20 * scale}px;
        }

        .value-cell {
          background-color: #f9f9f9;
        }

        .disabled-cell {
          background-color: #d0d0d0;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="page-content">
          ${generateDayColumn(daysData[0])}
          ${generateDayColumn(daysData[1])}
        </div>
      </div>

      <div class="page">
        <div class="page-content">
          ${generateDayColumn(daysData[2])}
          ${generateDayColumn(daysData[3])}
        </div>
      </div>
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
