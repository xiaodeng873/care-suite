import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, AlertTriangle, Zap } from 'lucide-react';
import {
  getHongKongNow,
  formatHongKongDate,
  formatHongKongTime,
  normalizeTime,
} from '../utils/prescriptionExpiry';

interface PrescriptionEndDateResult {
  endDate: string | null;
  endTime: string | null;
}

interface PrescriptionEndDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: any;
  targetStatus: 'active' | 'pending_change' | 'inactive';
  onConfirm: (result: PrescriptionEndDateResult) => void;
}

const PrescriptionEndDateModal: React.FC<PrescriptionEndDateModalProps> = ({
  isOpen,
  onClose,
  prescription,
  targetStatus,
  onConfirm
}) => {
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [error, setError] = useState('');

  // 初始化結束日期與時間
  useEffect(() => {
    if (!isOpen) return;

    setError('');

    if (targetStatus === 'inactive') {
      // 停用處方：預設為現在（香港時區）
      const now = getHongKongNow();
      setEndDate(formatHongKongDate(now));
      setEndTime(formatHongKongTime(now));
    } else {
      // 在服/待變更：保留原有結束日期與時間
      setEndDate(prescription?.end_date || '');
      setEndTime(normalizeTime(prescription?.end_time) || '23:59');
    }
  }, [isOpen, prescription, targetStatus]);

  if (!isOpen) return null;

  const selectedEndDateTime = useMemo(() => {
    if (!endDate) return null;
    const t = normalizeTime(endTime) || '23:59';
    return new Date(`${endDate}T${t}:00`);
  }, [endDate, endTime]);

  const now = getHongKongNow();
  const isFuture = selectedEndDateTime ? selectedEndDateTime > now : false;
  const isPastOrNow = selectedEndDateTime ? selectedEndDateTime <= now : false;

  const isStopMode = targetStatus === 'inactive';

  const handleImmediateStop = () => {
    const n = getHongKongNow();
    setEndDate(formatHongKongDate(n));
    setEndTime(formatHongKongTime(n));
    setError('');
  };

  const validateForm = () => {
    setError('');

    if (isStopMode) {
      if (!endDate) {
        setError('停用處方必須設定結束日期');
        return false;
      }
      if (!prescription?.start_date) {
        setError('處方缺少開始日期，無法設定結束日期');
        return false;
      }
    }

    if (endDate && prescription?.start_date) {
      const start = new Date(`${prescription.start_date}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      if (end < start) {
        setError('結束日期不能早於開始日期');
        return false;
      }
    }

    if (endDate) {
      // 結束日期不能超過開始日期 10 年
      const start = prescription?.start_date ? new Date(`${prescription.start_date}T00:00:00`) : null;
      const end = new Date(`${endDate}T00:00:00`);
      if (start) {
        const maxDate = new Date(start);
        maxDate.setFullYear(maxDate.getFullYear() + 10);
        if (end > maxDate) {
          setError('結束日期不能超過開始日期10年後');
          return false;
        }
      }
    }

    return true;
  };

  const handleConfirm = () => {
    if (!validateForm()) return;

    onConfirm({
      endDate: endDate || null,
      endTime: endDate ? normalizeTime(endTime) : null,
    });
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isStopMode ? 'bg-orange-100' : 'bg-blue-100'
            }`}>
              {isStopMode ? (
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              ) : (
                <Calendar className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isStopMode ? '設定處方結束日期' : '設定處方結束日期'}
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

          {/* 處方日期（只讀） */}
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-1" />
              處方日期
            </label>
            <input
              type="date"
              value={prescription?.prescription_date || ''}
              className="form-input bg-gray-50"
              readOnly
            />
          </div>

          {/* 結束日期 */}
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-1" />
              結束日期 {isStopMode && <span className="text-red-500">*</span>}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setError('');
              }}
              className={`form-input ${error ? 'border-red-300' : ''}`}
              min={prescription?.start_date}
              required={isStopMode}
            />
          </div>

          {/* 結束時間 */}
          <div>
            <label className="form-label">
              <Clock className="h-4 w-4 inline mr-1" />
              結束時間
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setError('');
              }}
              className={`form-input ${error ? 'border-red-300' : ''}`}
            />
            <p className="text-xs text-gray-500 mt-1">預設 23:59，可調整為實際最後服藥時間</p>
          </div>

          {/* 即將停用 / 停用提示 */}
          {endDate && isFuture && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">即將停用處方</span>
              </div>
              <p className="text-xs text-orange-600 mt-1">
                處方維持在服，直到 {endDate} {normalizeTime(endTime)} 才會轉為停用。
              </p>
            </div>
          )}
          {endDate && isPastOrNow && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">處方將轉為停用</span>
              </div>
              <p className="text-xs text-red-600 mt-1">
                選定的結束日期/時間已屆，確認後處方會轉為停用。
              </p>
            </div>
          )}
          {isStopMode && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-1">停用處方規則：</div>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>結束日期/時間為實際最後服藥時間。</li>
                  <li>結束時間晚於現在：處方維持在服，並標示為「即將停用處方」，到點自動轉為停用。</li>
                  <li>結束時間為現在或之前：處方立即轉為停用。</li>
                </ul>
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex flex-col gap-2">
          {isStopMode && (
            <button
              type="button"
              onClick={handleImmediateStop}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4" />
              立即停用（結束時間設為現在）
            </button>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleConfirm}
              disabled={isStopMode && (!endDate || !!error)}
              className="btn-primary flex-1"
            >
              {isStopMode ? '確認停用' : endDate ? '儲存結束日期' : '移除結束日期'}
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
    </div>
  );
};

export default PrescriptionEndDateModal;
