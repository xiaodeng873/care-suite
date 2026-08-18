import { X, Calendar } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';
import React, { useState, useEffect } from 'react';
import DateInput from './DateInput';

interface ScheduleModalProps {
  schedule?: any;
  onClose: () => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ schedule, onClose }) => {
  const { addSchedule, updateSchedule } = usePatientData();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // GMT+8
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    到診日期: schedule?.到診日期 || getHongKongDate()
  });

  // 當 schedule 改變時更新 formData
  useEffect(() => {
    if (schedule) {
      setFormData({
        到診日期: schedule.到診日期 || getHongKongDate()
      });
    }
  }, [schedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (schedule) {
        // 只傳送資料庫中實際存在的欄位
        await updateSchedule({
          排程id: schedule.排程id,
          到診日期: formData.到診日期
        });
      } else {
        await addSchedule({
          到診日期: formData.到診日期
        });
      }
      onClose();
    } catch (err: any) {
      const isUniqueViolation = err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate');
      if (isUniqueViolation) {
        alert(`${formData.到診日期} 已有排程，請直接在現有排程加入院友。`);
      } else {
        alert(`儲存失敗：${err?.message ?? '請重試'}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {schedule ? '編輯排程' : '新增排程'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600">
            
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-2" />
              到診日期
            </label>
            <DateInput

              value={formData.到診日期}

              className="form-input"
              required onChange={(value) => setFormData((prev) => ({ ...prev, 到診日期: value }))} />
            
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <button
              type="submit"
              className="btn-primary flex-1">
              
              {schedule ? '更新排程' : '建立排程'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1">
              
              取消
            </button>
          </div>
        </form>
      </div>
    </div>);

};

export default ScheduleModal;