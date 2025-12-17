import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertTriangle, Calculator } from 'lucide-react';

interface PrescriptionEndDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: any;
  targetStatus: 'active' | 'pending_change' | 'inactive';
  onConfirm: (endDate: string | null) => void;
}

const PrescriptionEndDateModal: React.FC<PrescriptionEndDateModalProps> = ({
  isOpen,
  onClose,
  prescription,
  targetStatus,
  onConfirm
}) => {
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  // 初始化結束日期
  useEffect(() => {
    if (isOpen) {
      if (targetStatus === 'inactive') {
        // 轉移到停用處方：如果已有結束日期則使用，否則使用今天
        setEndDate(prescription?.end_date || getHongKongDate());
      } else {
        // 轉移到在服/待變更處方：保留原有的結束日期（如果有）
        setEndDate(prescription?.end_date || '');
      }
      setError('');
    }
  }, [isOpen, prescription, targetStatus]);

  if (!isOpen) return null;

  // 計算天數
  const calculateDays = () => {
    if (!prescription?.start_date || !endDate) return null;
    
    const start = new Date(prescription.start_date);
    const end = new Date(endDate);
    
    if (end < start) {
      return null; // 結束日期不能早於開始日期
    }
    
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 包含開始日期
    return diffDays;
  };

  const totalDays = calculateDays();

  // 驗證表單
  const validateForm = () => {
    setError('');

    if (targetStatus === 'inactive') {
      if (!endDate) {
        setError('停用處方必須設定結束日期');
        return false;
      }

      if (!prescription?.start_date) {
        setError('處方缺少開始日期，無法設定結束日期');
        return false;
      }

      const start = new Date(prescription.start_date);
      const end = new Date(endDate);

      if (end < start) {
        setError('結束日期不能早於開始日期');
        return false;
      }

      // 檢查結束日期是否過於久遠（超過10年）
      const maxDate = new Date(start);
      maxDate.setFullYear(maxDate.getFullYear() + 10);
      if (end > maxDate) {
        setError('結束日期不能超過開始日期10年後');
        return false;
      }
    }

    return true;
  };

  const handleConfirm = () => {
    if (!validateForm()) {
      return;
    }

    // 如果有輸入結束日期，則使用；否則傳遞 null
    onConfirm(endDate || null);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '在服處方';
      case 'pending_change': return '待變更處方';
      case 'inactive': return '停用處方';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'pending_change': return 'text-yellow-600';
      case 'inactive': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              targetStatus === 'inactive' ? 'bg-orange-100' : 'bg-blue-100'
            }`}>
              {targetStatus === 'inactive' ? (
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              ) : (
                <Calendar className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {targetStatus === 'inactive' ? '設定處方結束日期' : '確認處方結束日期'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 處方資訊 */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm space-y-1">
            <div>
              <span className="text-gray-600">藥物：</span>
              <span className="font-medium text-gray-900">{prescription?.medication_name}</span>
            </div>
            <div>
              <span className="text-gray-600">當前狀態：</span>
              <span className={`font-medium ${getStatusColor(prescription?.status)}`}>
                {getStatusLabel(prescription?.status)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">目標狀態：</span>
              <span className={`font-medium ${getStatusColor(targetStatus)}`}>
                {getStatusLabel(targetStatus)}
              </span>
            </div>
          </div>
        </div>

        {/* 日期資訊 */}
        <div className="mb-6 space-y-4">
          {/* 開始日期（只讀） */}
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-1" />
              開始日期
            </label>
            <input
              type="date"
              value={prescription?.start_date || ''}
              className="form-input bg-gray-50"
              readOnly
            />
          </div>

          {/* 結束日期 */}
          <div>
            <label className="form-label">
              <Clock className="h-4 w-4 inline mr-1" />
              結束日期 {targetStatus === 'inactive' && <span className="text-red-500">*</span>}
              <span className="text-xs text-gray-500 ml-2">(可選，留空表示無結束日期)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`form-input ${error ? 'border-red-300' : ''}`}
              min={prescription?.start_date}
              required={targetStatus === 'inactive'}
            />
            {error && (
              <p className="text-red-500 text-sm mt-1">{error}</p>
            )}
            {targetStatus !== 'inactive' && endDate && (
              <p className="text-xs text-blue-600 mt-1">
                到期後此處方將自動轉為停用
              </p>
            )}
          </div>

          {/* 天數計算 */}
          {targetStatus === 'inactive' && totalDays !== null && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 text-green-800">
                <Calculator className="h-4 w-4" />
                <span className="text-sm font-medium">
                  處方期間：{totalDays} 天
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                從 {new Date(prescription?.start_date).toLocaleDateString('zh-TW')} 
                至 {new Date(endDate).toLocaleDateString('zh-TW')}
              </p>
            </div>
          )}
        </div>

        {/* 說明文字 */}
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            <div className="font-medium mb-1">處方日期管理規則：</div>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li><strong>停用處方：</strong>必須有開始日期和結束日期</li>
              <li><strong>在服處方：</strong>只需要開始日期，結束日期可選（到期後自動轉為停用）</li>
              <li><strong>待變更處方：</strong>只需要開始日期，結束日期可選</li>
            </ul>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex space-x-3">
          <button
            onClick={handleConfirm}
            disabled={targetStatus === 'inactive' && (!endDate || !!error)}
            className="btn-primary flex-1"
          >
            {targetStatus === 'inactive' ? '設定結束日期並轉移' : endDate ? '保留結束日期並轉移' : '移除結束日期並轉移'}
          </button>
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionEndDateModal;