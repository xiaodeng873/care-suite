import React, { useState } from 'react';
import { X, AlertTriangle, Home, Guitar as Hospital, XCircle, Pill, AlertCircleIcon } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface DispenseReasonModalProps {
  workflowRecord: any;
  onClose: () => void;
  onConfirm: (reason: string, customReason?: string) => void;
}

const DispenseReasonModal: React.FC<DispenseReasonModalProps> = ({
  workflowRecord,
  onClose,
  onConfirm
}) => {
  const { patients, batchSetDispenseFailure } = usePatients();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const patient = patients.find(p => p.院友id === workflowRecord.patient_id);

  const failureReasons = [
    { 
      value: '回家',
      label: '渡假', 
      icon: <Home className="h-4 w-4" />,
      description: '院友回家，無法派藥',
      isBatch: true
    },
    { 
      value: '入院',
      label: '入院', 
      icon: <Hospital className="h-4 w-4" />,
      description: '院友入院，無法派藥',
      isBatch: true
    },
    { 
      value: '拒服',
      label: '拒服', 
      icon: <XCircle className="h-4 w-4" />,
      description: '院友拒絕服藥',
      isBatch: false
    },
    { 
      value: '略去',
      label: '略去（因不符合檢測項）', 
      icon: <AlertTriangle className="h-4 w-4" />,
      description: '因檢測項條件不符而略去',
      isBatch: false
    },
    { 
      value: '藥物不足',
      label: '藥物不足', 
      icon: <Pill className="h-4 w-4" />,
      description: '藥物庫存不足',
      isBatch: false
    },
    { 
      value: '其他',
      label: '其他', 
      icon: <AlertCircleIcon className="h-4 w-4" />,
      description: '其他原因（請說明）',
      isBatch: false
    }
  ];

  const selectedReasonData = failureReasons.find(r => r.value === selectedReason);

  const handleConfirm = async () => {
    if (!selectedReason) {
      alert('請選擇未能派發的原因');
      return;
    }

    if (selectedReason === '其他' && !customReason.trim()) {
      alert('請輸入其他原因的詳細說明');
      return;
    }

    setIsSubmitting(true);

    try {
      // 如果是「回家」或「入院」，需要批量設定該院友該時間的所有處方
      if (selectedReasonData?.isBatch) {
        await batchSetDispenseFailure(
          workflowRecord.patient_id,
          workflowRecord.scheduled_date,
          workflowRecord.scheduled_time,
          selectedReason
        );
      } else {
        // 單一處方設定
        await onConfirm(selectedReason, selectedReason === '其他' ? customReason : undefined);
      }
      
      onClose();
    } catch (error) {
      console.error('設定派藥失敗原因失敗:', error);
      alert(`設定失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">未能派發原因</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 院友和藥物資訊 */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm">
            <div className="font-medium text-gray-900">
              {patient?.中文姓氏}{patient?.中文名字} ({patient?.床號})
            </div>
            <div className="text-gray-600 mt-1">
              日期: {new Date(workflowRecord.scheduled_date).toLocaleDateString('zh-TW')}
            </div>
            <div className="text-gray-600">
              時間: {workflowRecord.scheduled_time}
            </div>
          </div>
        </div>

        {/* 原因選擇 */}
        <div className="space-y-3 mb-6">
          <label className="form-label">請選擇未能派發的原因：</label>
          
          {failureReasons.map(reason => (
            <label
              key={reason.value}
              className={`flex items-start space-x-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                selectedReason === reason.value
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="failure_reason"
                value={reason.value}
                checked={selectedReason === reason.value}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  {reason.icon}
                  <span className="font-medium text-gray-900">{reason.label}</span>
                  {reason.isBatch && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                      批量設定
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{reason.description}</p>
                {reason.isBatch && selectedReason === reason.value && (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                    <p className="text-xs text-orange-800">
                      <strong>注意：</strong>選擇此原因將自動設定該院友在 {workflowRecord.scheduled_time} 的所有在服處方為「未能派發」
                    </p>
                  </div>
                )}
              </div>
            </label>
          ))}

          {/* 自定義原因輸入 */}
          {selectedReason === '其他' && (
            <div className="ml-7">
              <label className="form-label">請詳細說明其他原因：</label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="form-input"
                rows={3}
                placeholder="請輸入詳細的未能派發原因..."
                required
              />
            </div>
          )}
        </div>

        {/* 確認按鈕 */}
        <div className="flex space-x-3">
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || isSubmitting || (selectedReason === '其他' && !customReason.trim())}
            className="btn-danger flex-1 flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>處理中...</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                <span>確認未能派發</span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={isSubmitting}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default DispenseReasonModal;