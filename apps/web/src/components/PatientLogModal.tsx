import React, { useState } from 'react';
import { X, FileText, Calendar, User, MessageSquare, AlertTriangle } from 'lucide-react';
import { usePatients, type PatientLog } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';

interface PatientLogModalProps {
  log?: PatientLog;
  onClose: () => void;
  defaultPatientId?: string;
  defaultLogType?: string;
  defaultContent?: string;
}

const PatientLogModal: React.FC<PatientLogModalProps> = ({
  log,
  onClose,
  defaultPatientId,
  defaultLogType,
  defaultContent
}) => {
  const { addPatientLog, updatePatientLog } = usePatients();
  const { user, displayName } = useAuth();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // GMT+8
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    patient_id: log?.patient_id || defaultPatientId || '',
    log_date: log?.log_date || getHongKongDate(),
    log_type: log?.log_type || defaultLogType || '日常護理' as '日常護理' | '文件簽署' | '入院/出院' | '入住/退住' | '醫生到診' | '意外事故' | '覆診返藥' | '其他',
    content: log?.content || defaultContent || '',
    recorder: log?.recorder || displayName || user?.email || ''
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const logTypes = [
    '日常護理',
    '文件簽署',
    '入院/出院',
    '入住/退住',
    '醫生到診',
    '意外事故',
    '覆診返藥',
    '其他'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setHasChanges(true);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (): Promise<boolean> => {
    if (!formData.patient_id || !formData.log_date || !formData.content.trim()) {
      alert('請填寫所有必填欄位');
      return false;
    }

    try {
      const logData = {
        patient_id: parseInt(formData.patient_id),
        log_date: formData.log_date,
        log_type: formData.log_type,
        content: formData.content.trim(),
        recorder: formData.recorder || user?.email || '未知'
      };

      if (log) {
        await updatePatientLog({
          ...log,
          ...logData
        });
      } else {
        await addPatientLog(logData);
      }
      
      return true;
    } catch (error) {
      console.error('儲存院友日誌失敗:', error);
      alert('儲存院友日誌失敗，請重試');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await handleSave();
    if (saved) onClose();
  };

  const handleCloseRequest = () => {
    if (hasChanges) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleSaveAndClose = async () => {
    const saved = await handleSave();
    if (saved) onClose();
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case '日常護理': return 'text-blue-600';
      case '文件簽署': return 'text-green-600';
      case '入院/出院': return 'text-purple-600';
      case '入住/退住': return 'text-orange-600';
      case '醫生到診': return 'text-red-600';
      case '意外事故': return 'text-red-600';
      case '覆診返藥': return 'text-indigo-600';
      case '其他': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={handleCloseRequest}>
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`p-2 rounded-lg ${getLogTypeColor(formData.log_type)} bg-opacity-10`}>
                <FileText className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {log ? '編輯院友日誌' : '新增院友日誌'}
              </h2>
            </div>
            <button
              onClick={handleCloseRequest}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <User className="h-4 w-4 inline mr-1" />
                院友 *
              </label>
              <PatientAutocomplete
                value={formData.patient_id}
                onChange={(patientId) => {
                  setHasChanges(true);
                  setFormData(prev => ({ ...prev, patient_id: patientId }));
                }}
                placeholder="搜索院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
            </div>

            <div>
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                記錄日期 *
              </label>
              <input
                type="date"
                name="log_date"
                value={formData.log_date}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">日誌類型 *</label>
              <select
                name="log_type"
                value={formData.log_type}
                onChange={handleChange}
                className="form-input"
                required
              >
                {logTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">
                <User className="h-4 w-4 inline mr-1" />
                記錄人員
              </label>
              <input
                type="text"
                name="recorder"
                value={formData.recorder}
                onChange={handleChange}
                className="form-input"
                placeholder="記錄人員姓名"
              />
            </div>
          </div>

          {/* 日誌內容 */}
          <div>
            <label className="form-label">
              <MessageSquare className="h-4 w-4 inline mr-1" />
              日誌內容 *
            </label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              className="form-input"
              rows={6}
              placeholder="請輸入有關院友的重要事項..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              記錄院友的重要事項、護理情況、醫療處置等
            </p>
          </div>

          {/* 提交按鈕 */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {log ? '更新日誌' : '新增日誌'}
            </button>
            <button
              type="button"
              onClick={handleCloseRequest}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>

      {showConfirmClose && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]" onClick={() => setShowConfirmClose(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">未儲存的變更</h3>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              您有未儲存的變更，關閉將遺失資料。請選擇儲存或不儲存。
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmClose(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmClose(false);
                  onClose();
                }}
                className="btn-secondary flex-1"
              >
                不儲存
              </button>
              <button
                type="button"
                onClick={handleSaveAndClose}
                className="btn-primary flex-1"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PatientLogModal;