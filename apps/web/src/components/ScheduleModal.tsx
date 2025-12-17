import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface ScheduleModalProps {
  schedule?: any;
  onClose: () => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ schedule, onClose }) => {
  const { addSchedule, updateSchedule } = usePatients();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // GMT+8
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (schedule) {
      // 只傳送資料庫中實際存在的欄位
      updateSchedule({
        排程id: schedule.排程id,
        到診日期: formData.到診日期
      });
    } else {
      addSchedule({
        到診日期: formData.到診日期
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {schedule ? '編輯排程' : '新增排程'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-2" />
              到診日期
            </label>
            <input
              type="date"
              value={formData.到診日期}
              onChange={(e) => setFormData(prev => ({ ...prev, 到診日期: e.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {schedule ? '更新排程' : '建立排程'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleModal;