import React, { useState } from 'react';
import { X, Calendar, User, Stethoscope, Users, FileText } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface DoctorVisitScheduleModalProps {
  schedule?: any;
  onClose: () => void;
}

const DoctorVisitScheduleModal: React.FC<DoctorVisitScheduleModalProps> = ({ schedule, onClose }) => {
  const { addDoctorVisitSchedule, updateDoctorVisitSchedule } = usePatients();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    visit_date: schedule?.visit_date || getHongKongDate(),
    doctor_name: schedule?.doctor_name || '',
    specialty: schedule?.specialty || '',
    available_slots: schedule?.available_slots || 10,
    notes: schedule?.notes || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'available_slots' ? parseInt(value) || 1 : value
    }));
    
    // 清除相關錯誤
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // 驗證表單
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.visit_date) {
      newErrors.visit_date = '請選擇到診日期';
    }
    
    if (!formData.doctor_name.trim()) {
      newErrors.doctor_name = '請輸入醫生姓名';
    }
    
    if (!formData.available_slots || formData.available_slots < 1) {
      newErrors.available_slots = '可用名額必須大於0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const submitData = {
        ...formData,
        doctor_name: formData.doctor_name.trim(),
        specialty: formData.specialty.trim() || null,
        notes: formData.notes.trim() || null
      };

      if (schedule) {
        await updateDoctorVisitSchedule({ ...submitData, id: schedule.id });
      } else {
        await addDoctorVisitSchedule(submitData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存醫生到診排程失敗:', error);
      alert(`儲存失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Stethoscope className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {schedule ? '編輯醫生到診排程' : '新增醫生到診排程'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 到診資訊 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">到診資訊</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  到診日期 *
                </label>
                <input
                  type="date"
                  name="visit_date"
                  value={formData.visit_date}
                  onChange={handleChange}
                  className={`form-input ${errors.visit_date ? 'border-red-300' : ''}`}
                  required
                />
                {errors.visit_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.visit_date}</p>
                )}
              </div>

              <div>
                <label className="form-label">
                  <User className="h-4 w-4 inline mr-1" />
                  醫生姓名 *
                </label>
                <input
                  type="text"
                  name="doctor_name"
                  value={formData.doctor_name}
                  onChange={handleChange}
                  className={`form-input ${errors.doctor_name ? 'border-red-300' : ''}`}
                  placeholder="輸入醫生姓名"
                  required
                />
                {errors.doctor_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.doctor_name}</p>
                )}
              </div>

              <div>
                <label className="form-label">
                  <Stethoscope className="h-4 w-4 inline mr-1" />
                  專科
                </label>
                <select
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="">請選擇專科</option>
                  <option value="內科">內科</option>
                  <option value="外科">外科</option>
                  <option value="骨科">骨科</option>
                  <option value="心臟科">心臟科</option>
                  <option value="腦神經科">腦神經科</option>
                  <option value="精神科">精神科</option>
                  <option value="皮膚科">皮膚科</option>
                  <option value="眼科">眼科</option>
                  <option value="耳鼻喉科">耳鼻喉科</option>
                  <option value="泌尿科">泌尿科</option>
                  <option value="婦科">婦科</option>
                  <option value="兒科">兒科</option>
                  <option value="老人科">老人科</option>
                  <option value="家庭醫學科">家庭醫學科</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              <div>
                <label className="form-label">
                  <Users className="h-4 w-4 inline mr-1" />
                  可用名額 *
                </label>
                <input
                  type="number"
                  name="available_slots"
                  value={formData.available_slots}
                  onChange={handleChange}
                  className={`form-input ${errors.available_slots ? 'border-red-300' : ''}`}
                  min="1"
                  max="50"
                  required
                />
                {errors.available_slots && (
                  <p className="text-red-500 text-sm mt-1">{errors.available_slots}</p>
                )}
              </div>
            </div>
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">
              <FileText className="h-4 w-4 inline mr-1" />
              備註
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="form-input"
              rows={3}
              placeholder="輸入相關備註或特殊說明..."
            />
          </div>

          {/* 提交按鈕 */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              {schedule ? '更新排程' : '新增排程'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DoctorVisitScheduleModal;