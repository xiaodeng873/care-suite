import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Home, Guitar as Hospital, XCircle, Pill, AlertCircleIcon, Clock, CheckSquare, Users } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface FailureReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowRecord: any;
  step: 'preparation' | 'verification' | 'dispensing';
  onConfirm: (reason: string, customReason?: string) => void;
}

const FailureReasonModal: React.FC<FailureReasonModalProps> = ({
  isOpen,
  onClose,
  workflowRecord,
  step,
  onConfirm
}) => {
  const { patients, prescriptions } = usePatients();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens or step changes
  useEffect(() => {
    if (isOpen) {
      setSelectedReason('');
      setCustomReason('');
      setIsSubmitting(false);
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  const patient = patients.find(p => p.院友id === workflowRecord.patient_id);
  const prescription = prescriptions.find(p => p.id === workflowRecord.prescription_id);

  const getStepLabel = (step: string) => {
    switch (step) {
      case 'preparation': return '執藥';
      case 'verification': return '核藥';
      case 'dispensing': return '派藥';
      default: return step;
    }
  };

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'preparation': return <Pill className="h-4 w-4" />;
      case 'verification': return <CheckSquare className="h-4 w-4" />;
      case 'dispensing': return <Users className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // 根據步驟類型提供不同的失敗原因
  const getFailureReasons = (step: string) => {
    const commonReasons = [
      { 
        value: '回家',
        label: '回家', 
        icon: <Home className="h-4 w-4" />,
        description: '院友回家，無法執行'
      },
      { 
        value: '入院',
        label: '入院', 
        icon: <Hospital className="h-4 w-4" />,
        description: '院友入院，無法執行'
      },
      { 
        value: '其他',
        label: '其他', 
        icon: <AlertCircleIcon className="h-4 w-4" />,
        description: '其他原因（請說明）'
      }
    ];

    if (step === 'preparation') {
      return [
        ...commonReasons.slice(0, 2), // 回家、入院
        { 
          value: '藥物不足',
          label: '藥物不足', 
          icon: <Pill className="h-4 w-4" />,
          description: '藥物庫存不足，無法執藥'
        },
        commonReasons[2] // 其他
      ];
    } else if (step === 'verification') {
      return [
        ...commonReasons.slice(0, 2), // 回家、入院
        { 
          value: '其他',
          label: '執藥錯誤', 
          icon: <XCircle className="h-4 w-4" />,
          description: '發現執藥錯誤，需要重新執藥'
        },
        { 
          value: '其他',
          label: '藥物不符', 
          icon: <Pill className="h-4 w-4" />,
          description: '藥物與處方不符'
        },
        commonReasons[2] // 其他
      ];
    } else if (step === 'dispensing') {
      return [
        ...commonReasons.slice(0, 2), // 回家、入院
        { 
          value: '拒服',
          label: '拒服', 
          icon: <XCircle className="h-4 w-4" />,
          description: '院友拒絕服藥'
        },
        { 
          value: '略去',
          label: '略去（因不符合檢測項）', 
          icon: <AlertTriangle className="h-4 w-4" />,
          description: '因檢測項條件不符而略去'
        },
        commonReasons[2] // 其他
      ];
    }

    return commonReasons;
  };

  const failureReasons = getFailureReasons(step);

  const handleConfirm = async () => {
    if (!selectedReason) {
      alert('請選擇未能完成的原因');
      return;
    }

    if (selectedReason === '其他' && !customReason.trim()) {
      alert('請輸入其他原因的詳細說明');
      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm(selectedReason, selectedReason === '其他' ? customReason : undefined);
      onClose();
    } catch (error) {
      console.error('設定失敗原因失敗:', error);
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
            <h2 className="text-xl font-semibold text-gray-900">
              {getStepLabel(step)}未能完成
            </h2>
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
            <div className="font-medium text-gray-900 mb-1">
              {patient?.中文姓氏}{patient?.中文名字} ({patient?.床號})
            </div>
            <div className="text-gray-600 mb-1">
              藥物: {prescription?.medication_name}
            </div>
            <div className="text-gray-600 mb-1">
              日期: {new Date(workflowRecord.scheduled_date).toLocaleDateString('zh-TW')}
            </div>
            <div className="text-gray-600">
              時間: {workflowRecord.scheduled_time}
            </div>
          </div>
        </div>

        {/* 原因選擇 */}
        <div className="space-y-3 mb-6">
          <label className="form-label">請選擇{getStepLabel(step)}未能完成的原因：</label>
          
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
                </div>
                <p className="text-sm text-gray-600 mt-1">{reason.description}</p>
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
                placeholder="請輸入詳細的未能完成原因..."
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
                <span>確認未能完成</span>
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

export default FailureReasonModal;