import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { isTaskScheduledForDate } from '../utils/taskScheduler';

interface TaskHistoryModalProps {
  task: any;
  patient: any;
  healthRecords: any[];
  initialDate?: Date | null;
  cutoffDateStr?: string;
  specificTime?: string;  // [新增] 如果指定，只檢查這個時間點
  onClose: () => void;
  onDateSelect: (date: string) => void;
}

const TaskHistoryModal: React.FC<TaskHistoryModalProps> = ({
  task,
  patient,
  healthRecords,
  initialDate,
  cutoffDateStr,
  specificTime,
  onClose,
  onDateSelect
}) => {
  if (!task || !patient) {
    return null;
  }

  // [新增] ESC 鍵關閉功能
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [currentDate, setCurrentDate] = useState(initialDate || new Date());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getDayStatus = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const checkDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 輔助函數：正確格式化本地日期為 YYYY-MM-DD（避免時區偏移）
    const formatLocalDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // [調試] 記錄基本信息
    console.log(`[日曆調試] ===== 檢查日期: ${dateStr} =====`);
    console.log(`[日曆調試] 任務類型: ${task.health_record_type}`);
    console.log(`[日曆調試] 院友ID: ${task.patient_id}`);
    console.log(`[日曆調試] 分界日期: ${cutoffDateStr}`);
    console.log(`[日曆調試] 指定時間: ${specificTime}`);
    console.log(`[日曆調試] 任務時間點: ${JSON.stringify(task.specific_times)}`);
    console.log(`[日曆調試] 今天: ${formatLocalDate(today)}`);

    // [修正] 如果日期早於分界線，不應顯示任何狀態（任務還未開始）
    if (cutoffDateStr && dateStr < cutoffDateStr) {
      console.log(`[日曆調試] ${dateStr} < ${cutoffDateStr} -> 任務未開始，返回 none`);
      return 'none';
    }

    // [修改] 如果指定了 specificTime，只檢查那個時間點
    if (specificTime) {
      console.log(`[日曆調試] 進入 specificTime 分支 - 檢查時間: ${specificTime}`);

      // [修正] 標準化時間格式為 HH:MM
      const normalizeTime = (time: string) => {
        if (!time) return '';
        return time.substring(0, 5); // 取前5個字符 "HH:MM"
      };

      const matchingRecords = healthRecords.filter(r => {
        const match = r.記錄日期 === dateStr;
        if (match) {
          console.log(`[日曆調試] 找到該日期的記錄:`, {
            記錄類型: r.記錄類型,
            記錄時間: r.記錄時間,
            院友id: r.院友id,
            task_id: r.task_id
          });
        }
        return match;
      });
      console.log(`[日曆調試] ${dateStr} 該日期共有 ${matchingRecords.length} 筆記錄`);

      const normalizedSpecificTime = normalizeTime(specificTime);

      const hasRecord = healthRecords.some(r => {
        const normalizedRecordTime = normalizeTime(r.記錄時間);

        if (r.task_id && r.task_id === task.id) {
          return r.記錄日期 === dateStr && normalizedRecordTime === normalizedSpecificTime;
        }
        // [增強] 更容錯的匹配邏輯
        const patientMatch = r.院友id?.toString() === task.patient_id?.toString();
        const typeMatch = r.記錄類型 === task.health_record_type;
        const dateMatch = r.記錄日期 === dateStr;
        const timeMatch = normalizedRecordTime === normalizedSpecificTime;

        return patientMatch && typeMatch && dateMatch && timeMatch;
      });

      console.log(`[日曆調試] hasRecord = ${hasRecord}`);

      // 未來日期不顯示為逾期
      if (checkDate > today) {
        console.log(`[日曆調試] ${dateStr} -> future (未來日期)`);
        return 'future';
      }

      // [修復] 先檢查是否應該排程在這一天
      const isScheduled = isTaskScheduledForDate(task, checkDate);
      console.log(`[日曆調試] isScheduled = ${isScheduled}`);

      if (hasRecord) {
        // 只有在應該排程的日期才顯示綠點
        if (isScheduled) {
          console.log(`[日曆調試] ${dateStr} -> completed (有記錄且應排程)`);
          return 'completed';
        } else {
          console.log(`[日曆調試] ${dateStr} -> none (有記錄但不應排程)`);
          return 'none';
        }
      }

      if (isScheduled) {
        if (checkDate.getTime() === today.getTime()) {
          console.log(`[日曆調試] ${dateStr} -> pending (今天待辦)`);
          return 'pending';
        }
        console.log(`[日曆調試] ${dateStr} -> missed (逾期)`);
        return 'missed';
      }

      console.log(`[日曆調試] ${dateStr} -> none (不應排程)`);
      return 'none';
    }

    // [關鍵修正] 對於多時間點任務，需要檢查每個時間點
    if (task.specific_times && task.specific_times.length > 0) {
      console.log(`[日曆調試] 進入多時間點任務分支 - 需要時間點: ${task.specific_times.join(', ')}`);

      const timeRecords = healthRecords.filter(r => {
        if (r.task_id && r.task_id === task.id) {
          return r.記錄日期 === dateStr;
        }
        // [增強] 更容錯的匹配邏輯
        const patientMatch = r.院友id?.toString() === task.patient_id?.toString();
        const typeMatch = r.記錄類型 === task.health_record_type;
        const dateMatch = r.記錄日期 === dateStr;

        return patientMatch && typeMatch && dateMatch;
      });

      console.log(`[日曆調試] ${dateStr} 找到 ${timeRecords.length} 筆該日期的記錄`);
      if (timeRecords.length > 0) {
        console.log(`[日曆調試] 記錄時間點: ${timeRecords.map(r => r.記錄時間).join(', ')}`);
      }

      // 檢查所有時間點是否都有記錄
      // [修正] 標準化時間格式為 HH:MM (去掉秒數)
      const normalizeTime = (time: string) => {
        if (!time) return '';
        return time.substring(0, 5); // 取前5個字符 "HH:MM"
      };

      const completedTimes = new Set(timeRecords.map(r => normalizeTime(r.記錄時間)));
      const normalizedTaskTimes = task.specific_times.map(normalizeTime);
      const allTimesCompleted = normalizedTaskTimes.every(time => completedTimes.has(time));

      console.log(`[日曆調試] 已完成時間點: ${Array.from(completedTimes).join(', ')}`);
      console.log(`[日曆調試] 標準化後的任務時間點: ${normalizedTaskTimes.join(', ')}`);
      console.log(`[日曆調試] allTimesCompleted = ${allTimesCompleted}`);

      // 未來日期不顯示為逾期
      if (checkDate > today) {
        console.log(`[日曆調試] ${dateStr} -> future (未來日期)`);
        return 'future';
      }

      // [修復] 先檢查是否應該排程在這一天
      const isScheduled = isTaskScheduledForDate(task, checkDate);
      console.log(`[日曆調試] isScheduled = ${isScheduled}`);

      if (allTimesCompleted) {
        // 只有在應該排程的日期才顯示綠點
        if (isScheduled) {
          console.log(`[日曆調試] ${dateStr} -> completed (所有時間點已完成且應排程)`);
          return 'completed';
        } else {
          console.log(`[日曆調試] ${dateStr} -> none (有記錄但不應排程)`);
          return 'none';
        }
      }

      if (isScheduled) {
        if (checkDate.getTime() === today.getTime()) {
          console.log(`[日曆調試] ${dateStr} -> pending (今天待辦)`);
          return 'pending';
        }
        console.log(`[日曆調試] ${dateStr} -> missed (逾期)`);
        return 'missed';
      }

      console.log(`[日曆調試] ${dateStr} -> none (不應排程)`);
      return 'none';
    } else {
      // 單時間點任務
      console.log(`[日曆調試] 進入單時間點任務分支`);

      const matchingDateRecords = healthRecords.filter(r => r.記錄日期 === dateStr);
      console.log(`[日曆調試] ${dateStr} 該日期共有 ${matchingDateRecords.length} 筆記錄`);

      if (matchingDateRecords.length > 0) {
        console.log(`[日曆調試] ${dateStr} 該日期的記錄詳情:`, matchingDateRecords.map(r => ({
          記錄類型: r.記錄類型,
          記錄時間: r.記錄時間,
          院友id: r.院友id,
          task_id: r.task_id
        })));
      }

      const hasRecord = healthRecords.some(r => {
        if (r.task_id && r.task_id === task.id) {
          const match = r.記錄日期 === dateStr;
          if (match) {
            console.log(`[日曆調試] ${dateStr} 通過 task_id 匹配成功`);
          }
          return match;
        }
        // [增強] 更容錯的匹配邏輯，並添加調試信息
        const patientMatch = r.院友id?.toString() === task.patient_id?.toString();
        const typeMatch = r.記錄類型 === task.health_record_type;
        const dateMatch = r.記錄日期 === dateStr;

        // [調試] 記錄匹配失敗的原因
        if (dateMatch && !patientMatch) {
          console.log(`[日曆調試] ${dateStr} 院友ID不匹配: 記錄=${r.院友id}, 任務=${task.patient_id}`);
        }
        if (dateMatch && patientMatch && !typeMatch) {
          console.log(`[日曆調試] ${dateStr} 記錄類型不匹配: 記錄="${r.記錄類型}", 任務="${task.health_record_type}"`);
        }

        const fullMatch = patientMatch && typeMatch && dateMatch;
        if (fullMatch) {
          console.log(`[日曆調試] ${dateStr} 通過容錯邏輯匹配成功`);
        }

        return fullMatch;
      });

      console.log(`[日曆調試] hasRecord = ${hasRecord}`);

      // 未來日期不顯示為逾期
      if (checkDate > today) {
        console.log(`[日曆調試] ${dateStr} -> future (未來日期)`);
        return 'future';
      }

      // [修復] 先檢查是否應該排程在這一天
      const isScheduled = isTaskScheduledForDate(task, checkDate);
      console.log(`[日曆調試] isScheduled = ${isScheduled}`);

      if (hasRecord) {
        // 只有在應該排程的日期才顯示綠點
        if (isScheduled) {
          console.log(`[日曆調試] ${dateStr} -> completed (有記錄且應排程)`);
          return 'completed';
        } else {
          console.log(`[日曆調試] ${dateStr} -> none (有記錄但不應排程)`);
          return 'none';
        }
      }

      if (isScheduled) {
        // [調試] 記錄為什麼判定為逾期
        if (checkDate.getTime() !== today.getTime()) {
          console.log(`[日曆調試] ${dateStr} 判定為逾期 - 任務類型: ${task.health_record_type}, 院友: ${task.patient_id}`);
        }
        if (checkDate.getTime() === today.getTime()) {
          console.log(`[日曆調試] ${dateStr} -> pending (今天待辦)`);
          return 'pending';
        }
        console.log(`[日曆調試] ${dateStr} -> missed (逾期)`);
        return 'missed';
      }

      console.log(`[日曆調試] ${dateStr} -> none (不應排程)`);
      return 'none';
    }
  };

  const renderCalendarDays = () => {
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const status = getDayStatus(day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      let statusStyle = '';
      let dot = null;
      let isClickable = false;

      switch (status) {
        case 'completed':
          statusStyle = 'text-gray-400 cursor-default opacity-60';
          dot = <div className="w-1.5 h-1.5 rounded-full bg-green-500 mx-auto mt-1"></div>;
          break;
        case 'missed':
          statusStyle = 'hover:bg-red-50 cursor-pointer font-medium text-red-700 bg-red-50/30';
          dot = <div className="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto mt-1"></div>;
          isClickable = true;
          break;
        case 'pending':
          statusStyle = 'hover:bg-blue-50 cursor-pointer font-medium text-blue-700';
          dot = <div className="w-1.5 h-1.5 rounded-full border border-blue-500 mx-auto mt-1"></div>;
          isClickable = true;
          break;
        case 'future':
        case 'none':
        default:
          statusStyle = 'text-gray-300 cursor-default';
          break;
      }

      days.push(
        <div 
          key={day} 
          onClick={() => {
            if (isClickable) {
              onDateSelect(dateStr);
            }
          }}
          className={`h-10 flex flex-col items-center justify-center rounded-lg transition-colors ${statusStyle}`}
        >
          <span className="text-sm">{day}</span>
          {dot}
        </div>
      );
    }
    return days;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {patient?.中文姓氏}{patient?.中文名字} - {task?.health_record_type}
            </h3>
            <p className="text-xs text-gray-500">點擊紅色日期進行補錄</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="font-medium text-gray-900 text-sm">
              {year}年 {month + 1}月
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-full">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} className="text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {renderCalendarDays()}
          </div>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-center space-x-4">
          <div className="flex items-center opacity-60"><div className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></div>已完成</div>
          <div className="flex items-center text-red-600 font-medium"><div className="w-2 h-2 rounded-full bg-red-500 mr-1.5"></div>逾期</div>
          <div className="flex items-center text-blue-600"><div className="w-2 h-2 rounded-full border border-blue-500 mr-1.5"></div>待辦</div>
        </div>
      </div>
    </div>
  );
};

export default TaskHistoryModal;