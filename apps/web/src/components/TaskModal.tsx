import React, { useState } from 'react';
import { X, CheckSquare, User, Calendar, Clock, Activity, Droplets, Scale, FileText, Stethoscope } from 'lucide-react';
import PatientAutocomplete from './PatientAutocomplete';
import { usePatients, type PatientHealthTask, type HealthTaskType, type FrequencyUnit, type MonitoringTaskNotes } from '../context/PatientContext';
import { calculateNextDueDate } from '../utils/taskScheduler';

interface TaskModalProps {
  task?: PatientHealthTask | null;
  onClose: () => void;
  // 為了相容性，這裡可以接受 patient 但主要由內部 autocomplete 控制
  patient?: any; 
  onUpdate?: () => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, onClose, onUpdate }) => {
  const { addPatientHealthTask, updatePatientHealthTask, refreshData } = usePatients();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const getHongKongTime = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[1].slice(0, 5);
  };

  // 根據任務類型設置默認頻率
  const getDefaultFrequency = (type: HealthTaskType): { unit: FrequencyUnit; value: number } => {
    switch (type) {
      case '生命表徵':
      case '血糖控制':
      case '體重控制':
        return { unit: 'daily', value: 1 };
      case '約束物品同意書':
      case '藥物自存同意書':
        return { unit: 'monthly', value: 6 };
      case '晚晴計劃':
        return { unit: 'yearly', value: 1 };
      default:
        return { unit: 'monthly', value: 1 };
    }
  };

  const defaultFrequency = getDefaultFrequency(task?.health_record_type || '生命表徵');
  const [formData, setFormData] = useState({
    patient_id: task?.patient_id?.toString() || '',
    health_record_type: task?.health_record_type || '生命表徵' as HealthTaskType,
    frequency_unit: task?.frequency_unit || defaultFrequency.unit,
    frequency_value: task?.frequency_value || defaultFrequency.value,
    specific_times: task?.specific_times?.[0] || '',
    specific_days_of_week: task?.specific_days_of_week || [],
    specific_days_of_month: task?.specific_days_of_month || [],
    notes: task?.notes || '',
    last_completed_at: task?.last_completed_at || '',
    is_recurring: task?.is_recurring ?? true,
    end_date: task?.end_date || '',
    end_time: task?.end_time || '',
    tube_type: task?.tube_type || '',
    tube_size: task?.tube_size || '',
    start_date: task?.last_completed_at
      ? new Date(task.last_completed_at).toISOString().split('T')[0]
      : getHongKongDate(),
    start_time: task?.last_completed_at
      ? new Date(task.last_completed_at).toTimeString().slice(0, 5)
      : getHongKongTime(),
  });

  // ... (handleChange 等輔助函式保持不變) ...
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked,
      }));
    } else if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || 1,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleDayOfWeekChange = (day: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      specific_days_of_week: checked
        ? [...prev.specific_days_of_week, day].sort()
        : prev.specific_days_of_week.filter(d => d !== day),
    }));
  };

  const handleDayOfMonthChange = (day: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      specific_days_of_month: checked
        ? [...prev.specific_days_of_month, day].sort()
        : prev.specific_days_of_month.filter(d => d !== day),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patient_id) {
      alert('請選擇院友');
      return;
    }

    if (!formData.is_recurring) {
      if (!formData.end_date) {
        alert('非循環任務必須設定結束日期');
        return;
      }
      if (!formData.end_time) {
        alert('非循環任務必須設定結束時間');
        return;
      }
    }

    try {
      let baseDateTime: Date;
      let lastCompletedAt: string;
      
      if (formData.start_date && formData.start_time) {
        baseDateTime = new Date(`${formData.start_date}T${formData.start_time}:00+08:00`);
        lastCompletedAt = baseDateTime.toISOString();
      } else {
        baseDateTime = new Date();
        baseDateTime.setTime(baseDateTime.getTime() + 8 * 60 * 60 * 1000);
        lastCompletedAt = baseDateTime.toISOString();
      }
      
      const mockTask: PatientHealthTask = {
        id: '',
        patient_id: parseInt(formData.patient_id),
        health_record_type: formData.health_record_type,
        frequency_unit: formData.frequency_unit,
        frequency_value: formData.frequency_value,
        specific_times: formData.specific_times ? [formData.specific_times] : [],
        specific_days_of_week: formData.specific_days_of_week,
        specific_days_of_month: formData.specific_days_of_month,
        last_completed_at: lastCompletedAt,
        next_due_at: '',
        created_at: '',
        updated_at: '',
        is_recurring: formData.is_recurring,
        end_date: formData.end_date,
        end_time: formData.end_time,
      };

      const nextDueAt = calculateNextDueDate(mockTask, baseDateTime);
      const taskData = {
        patient_id: parseInt(formData.patient_id),
        health_record_type: formData.health_record_type,
        frequency_unit: formData.frequency_unit,
        frequency_value: formData.frequency_value,
        specific_times: formData.specific_times ? [formData.specific_times] : [],
        specific_days_of_week: formData.specific_days_of_week,
        specific_days_of_month: formData.specific_days_of_month,
        last_completed_at: lastCompletedAt,
        next_due_at: nextDueAt.toISOString(),
        tube_type: formData.tube_type || null,
        tube_size: formData.tube_size || null,
        notes: (formData.notes && formData.notes.trim() !== '') ? formData.notes as MonitoringTaskNotes : null,
        is_recurring: formData.is_recurring,
        end_date: formData.is_recurring ? null : formData.end_date,
        end_time: formData.is_recurring ? null : formData.end_time,
      };

      if (task && task.id) {
        // [Optimistic Update] 這裡會直接更新本地狀態，介面會立即反應
        await updatePatientHealthTask({
          ...task,
          ...taskData,
        });
      } else {
        // [Optimistic Update] 這裡會等待 DB 回傳新 ID 後更新本地狀態
        await addPatientHealthTask(taskData);
      }

      // [移除] 不再呼叫全量刷新，大幅提升速度
      // await refreshData(); 
      
      if (onUpdate) await onUpdate();
      onClose();
    } catch (error) {
      console.error('儲存任務失敗:', error);
      alert('儲存任務失敗，請重試');
    }
  };
  
  // ... (其餘渲染代碼保持不變，與您之前提供的檔案一致) ...
  // 為節省篇幅，這部分請使用您現有的 UI 代碼
  const getTypeIcon = (type: HealthTaskType) => {
    switch (type) {
      case '生命表徵': return <Activity className="h-5 w-5" />;
      case '血糖控制': return <Droplets className="h-5 w-5" />;
      case '體重控制': return <Scale className="h-5 w-5" />;
      case '藥物自存同意書': return <FileText className="h-5 w-5" />;
      case '晚晴計劃': return <FileText className="h-5 w-5" />;
      default: return <CheckSquare className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: HealthTaskType) => {
    switch (type) {
      case '生命表徵': return 'text-blue-600';
      case '血糖控制': return 'text-red-600';
      case '體重控制': return 'text-green-600';
      case '藥物自存同意書': return 'text-gray-600';
      case '晚晴計劃': return 'text-pink-600';
      default: return 'text-purple-600';
    }
  };

  const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const noteOptions = ['注射前', '服藥前', '定期', '特別關顧', '社康'];
  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, '0');
    const minutes = (i % 2 === 0) ? '00' : '30';
    return `${hours}:${minutes}`;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${getTypeColor(formData.health_record_type)} bg-opacity-10`}>
                {getTypeIcon(formData.health_record_type)}
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {task ? '編輯健康任務' : '新增健康任務'}
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <User className="h-4 w-4 inline mr-1" />
                院友 *
              </label>
              <PatientAutocomplete
                value={formData.patient_id}
                onChange={(patientId) => setFormData(prev => ({ ...prev, patient_id: patientId }))}
                placeholder="搜索院友..."
              />
            </div>

            <div>
              <label className="form-label">任務類型 *</label>
              <select
                name="health_record_type"
                value={formData.health_record_type}
                onChange={handleChange}
                className="form-input"
                required
              >
                <optgroup label="監測任務">
                  <option value="生命表徵">生命表徵</option>
                  <option value="血糖控制">血糖控制</option>
                  <option value="體重控制">體重控制</option>
                </optgroup>
                <optgroup label="護理任務">
                  <option value="尿導管更換">尿導管更換</option>
                  <option value="鼻胃飼管更換">鼻胃飼管更換</option>
                  <option value="傷口換症">傷口換症</option>
                  <option value="氧氣喉管清洗/更換">氧氣喉管清洗/更換</option>
                </optgroup>
                <optgroup label="文件任務">
                  <option value="約束物品同意書">約束物品同意書</option>
                  <option value="年度體檢">年度體檢</option>
                  <option value="藥物自存同意書">藥物自存同意書</option>
                  <option value="晚晴計劃">晚晴計劃</option>
                </optgroup>
              </select>
            </div>
          </div>

          {(formData.health_record_type === '藥物自存同意書' || formData.health_record_type === '晚晴計劃') && (
            <div>
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                上次醫生簽署日期
              </label>
              <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="form-input" />
            </div>
          )}

          {(formData.health_record_type === '尿導管更換' || formData.health_record_type === '鼻胃飼管更換' ||
            formData.health_record_type === '傷口換症' || formData.health_record_type === '氧氣喉管清洗/更換') && (
            <div>
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                上次執行日期
              </label>
              <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="form-input" />
            </div>
          )}

          {(formData.health_record_type === '生命表徵' || formData.health_record_type === '血糖控制' || formData.health_record_type === '體重控制') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label"><Calendar className="h-4 w-4 inline mr-1" />開始日期</label>
                <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="form-input" />
              </div>
              <div>
                <label className="form-label"><Clock className="h-4 w-4 inline mr-1" />開始時間</label>
                <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} className="form-input" />
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">任務類型設定</h3>
            <div className="flex items-center space-x-3">
              <input type="checkbox" id="is_recurring" name="is_recurring" checked={formData.is_recurring} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
              <label htmlFor="is_recurring" className="text-sm font-medium text-gray-700">循環任務</label>
            </div>
            {!formData.is_recurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div><label className="form-label">結束日期 *</label><input type="date" name="end_date" value={formData.end_date} onChange={handleChange} className="form-input" required={!formData.is_recurring} /></div>
                <div><label className="form-label">結束時間 *</label><input type="time" name="end_time" value={formData.end_time} onChange={handleChange} className="form-input" required={!formData.is_recurring} /></div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">頻率設定</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">頻率單位 *</label>
                <select name="frequency_unit" value={formData.frequency_unit} onChange={handleChange} className="form-input" required>
                  <option value="daily">每天</option>
                  <option value="weekly">每週</option>
                  <option value="monthly">每月</option>
                  <option value="yearly">每年</option>
                </select>
              </div>
              <div>
                <label className="form-label">頻率數值 *</label>
                <input type="number" name="frequency_value" value={formData.frequency_value} onChange={handleChange} className="form-input" min="1" required />
              </div>
            </div>

            {(formData.frequency_unit === 'daily' || formData.frequency_unit === 'weekly' || formData.frequency_unit === 'monthly') && 
             (formData.health_record_type === '生命表徵' || formData.health_record_type === '血糖控制' || formData.health_record_type === '體重控制') && (
              <div>
                <label className="form-label">特定時間</label>
                <select name="specific_times" value={formData.specific_times} onChange={handleChange} className="form-input">
                  <option value="">無</option>
                  {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
                </select>
              </div>
            )}

            {formData.frequency_unit === 'weekly' && (
              <div>
                <label className="form-label">特定星期幾</label>
                <div className="grid grid-cols-7 gap-2">
                  {dayNames.map((dayName, index) => (
                    <label key={index} className="flex items-center space-x-1">
                      <input type="checkbox" checked={formData.specific_days_of_week.includes(index + 1)} onChange={(e) => handleDayOfWeekChange(index + 1, e.target.checked)} className="form-checkbox" />
                      <span className="text-sm">{dayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {formData.frequency_unit === 'monthly' && (
              <div>
                <label className="form-label">特定日期</label>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <label key={day} className="flex items-center space-x-1">
                      <input type="checkbox" checked={formData.specific_days_of_month.includes(day)} onChange={(e) => handleDayOfMonthChange(day, e.target.checked)} className="form-checkbox" />
                      <span className="text-sm">{day}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(formData.health_record_type === '尿導管更換' || formData.health_record_type === '鼻胃飼管更換') && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">喉管設定</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">喉管類型</label>
                  <select name="tube_type" value={formData.tube_type || ''} onChange={handleChange} className="form-input">
                    <option value="">請選擇</option>
                    <option value="Latex">Latex</option>
                    <option value="Silicon">Silicon</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">管徑</label>
                  <select name="tube_size" value={formData.tube_size || ''} onChange={handleChange} className="form-input">
                    <option value="">請選擇</option>
                    <option value="Fr. 8">Fr. 8</option>
                    {/* ... other sizes */}
                    <option value="Fr. 14">Fr. 14</option>
                    <option value="Fr. 16">Fr. 16</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {(formData.health_record_type === '生命表徵' || formData.health_record_type === '血糖控制' || formData.health_record_type === '體重控制') ? (
            <div>
              <label className="form-label">備註</label>
              <select name="notes" value={formData.notes} onChange={handleChange} className="form-input">
                <option value="">無</option>
                {noteOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="form-label">備註</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} className="form-input" rows={3} placeholder="請輸入備註..." />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-secondary">取消</button>
            <button type="submit" className="btn-primary">{task ? '更新任務' : '建立任務'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;