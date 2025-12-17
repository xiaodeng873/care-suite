import React, { useState } from 'react';
import { X, CheckCircle, Hospital, Home, XCircle, AlertTriangle, Pause, AlertCircle, Syringe } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface DispenseConfirmModalProps {
  workflowRecord: any;
  prescription: any;
  onClose: () => void;
  onConfirm: (action: 'success' | 'failure', reason?: string, customReason?: string) => void;
}

const DispenseConfirmModal: React.FC<DispenseConfirmModalProps> = ({
  workflowRecord,
  prescription,
  onClose,
  onConfirm
}) => {
  const { patients } = usePatients();
  const [selectedOption, setSelectedOption] = useState<string>('success');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const patient = patients.find(p => p.院友id === workflowRecord.patient_id);
  const isHospitalized = patient?.is_hospitalized || false;
  const isImmediatePreparation = prescription?.preparation_method === 'immediate';
  const isInjection = prescription?.administration_route === '注射';

  const dispenseOptions = [
    {
      value: 'success',
      label: '順利派藥',
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'green',
      description: '院友已順利服藥或接受治療',
      isSuccess: true
    },
    {
      value: '入院',
      label: '入院中',
      icon: <Hospital className="h-5 w-5" />,
      color: 'blue',
      description: '院友正在醫院住院，無法派藥',
      isSuccess: false
    },
    {
      value: '回家',
      label: '回家渡假中',
      icon: <Home className="h-5 w-5" />,
      color: 'purple',
      description: '院友回家渡假，不在院舍',
      isSuccess: false
    },
    {
      value: '拒服',
      label: '院友拒絕服藥',
      icon: <XCircle className="h-5 w-5" />,
      color: 'red',
      description: '院友拒絕接受藥物治療',
      isSuccess: false
    },
    {
      value: '暫停',
      label: '暫停該次派藥',
      icon: <Pause className="h-5 w-5" />,
      color: 'gray',
      description: '暫時跳過本次派藥，稍後處理',
      isSuccess: false
    },
    {
      value: '其他',
      label: '其他原因',
      icon: <AlertCircle className="h-5 w-5" />,
      color: 'gray',
      description: '其他未能派藥的原因（請說明）',
      isSuccess: false
    }
  ];

  const selectedOptionData = dispenseOptions.find(o => o.value === selectedOption);

  const getColorClasses = (color: string, isSelected: boolean) => {
    const baseClasses = 'transition-all duration-200';

    if (isSelected) {
      switch (color) {
        case 'green':
          return `${baseClasses} border-green-500 bg-green-50 shadow-md`;
        case 'blue':
          return `${baseClasses} border-blue-500 bg-blue-50 shadow-md`;
        case 'purple':
          return `${baseClasses} border-purple-500 bg-purple-50 shadow-md`;
        case 'red':
          return `${baseClasses} border-red-500 bg-red-50 shadow-md`;
        case 'orange':
          return `${baseClasses} border-orange-500 bg-orange-50 shadow-md`;
        case 'gray':
          return `${baseClasses} border-gray-500 bg-gray-50 shadow-md`;
        default:
          return `${baseClasses} border-gray-300 bg-gray-50 shadow-md`;
      }
    }

    return `${baseClasses} border-gray-200 hover:border-gray-300 hover:bg-gray-50`;
  };

  const getIconColorClass = (color: string) => {
    switch (color) {
      case 'green': return 'text-green-600';
      case 'blue': return 'text-blue-600';
      case 'purple': return 'text-purple-600';
      case 'red': return 'text-red-600';
      case 'orange': return 'text-orange-600';
      case 'gray': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const handleConfirm = async () => {
    if (selectedOption === '其他' && !customReason.trim()) {
      alert('請輸入其他原因的詳細說明');
      return;
    }

    setIsSubmitting(true);

    try {
      if (selectedOption === 'success') {
        await onConfirm('success');
      } else {
        await onConfirm('failure', selectedOption, selectedOption === '其他' ? customReason : undefined);
      }
      onClose();
    } catch (error) {
      console.error('派藥確認失敗:', error);
      alert(`操作失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">派藥確認</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {isHospitalized && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>注意：</strong>此院友目前標記為入院中狀態。如院友已出院，請先到「缺席管理」更新狀態。
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">院友</div>
                <div className="font-medium text-gray-900">
                  {patient?.中文姓氏}{patient?.中文名字} ({patient?.床號})
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">性別</div>
                <div className="font-medium text-gray-900">{patient?.性別}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">藥物名稱</div>
                <div className="font-medium text-gray-900">{prescription?.medication_name}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">劑量</div>
                <div className="font-medium text-gray-900">
                  {prescription?.dosage_amount || '1'}{prescription?.dosage_unit || ''}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">給藥途徑</div>
                <div className="font-medium text-gray-900 flex items-center space-x-1">
                  {isInjection && <Syringe className="h-4 w-4 text-orange-600" />}
                  <span>{prescription?.administration_route || '口服'}</span>
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">派藥時間</div>
                <div className="font-medium text-gray-900">
                  {new Date(workflowRecord.scheduled_date).toLocaleDateString('zh-TW')} {workflowRecord.scheduled_time}
                </div>
              </div>
              {prescription?.meal_timing && (
                <div>
                  <div className="text-gray-500 mb-1">用藥時機</div>
                  <div className="font-medium text-gray-900">{prescription.meal_timing}</div>
                </div>
              )}
              {isImmediatePreparation && (
                <div className="col-span-2">
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-blue-800">
                    <strong>即時備藥：</strong>確認後將自動完成執藥、核藥、派藥三個步驟
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <label className="form-label text-base">請選擇派藥執行結果：</label>

            {dispenseOptions.map(option => (
              <label
                key={option.value}
                className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer ${getColorClasses(option.color, selectedOption === option.value)}`}
              >
                <input
                  type="radio"
                  name="dispense_option"
                  value={option.value}
                  checked={selectedOption === option.value}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  className="h-5 w-5 mt-0.5 flex-shrink-0"
                  style={{ accentColor: option.color === 'green' ? '#16a34a' : undefined }}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={getIconColorClass(option.color)}>{option.icon}</span>
                    <span className="font-medium text-gray-900 text-base">{option.label}</span>
                    {option.isSuccess && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                        
                      </span>
                    )}
                    {option.value === '入院' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isHospitalized
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-gray-100 text-gray-600 border border-gray-300'
                      }`}>
                        {isHospitalized ? '✓ 目前入院中' : '目前非入院'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </div>
              </label>
            ))}

            {selectedOption === '其他' && (
              <div className="ml-11 mt-3">
                <label className="form-label">請詳細說明其他原因：</label>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="form-input"
                  rows={3}
                  placeholder="請輸入詳細的未能派藥原因..."
                  required
                />
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || (selectedOption === '其他' && !customReason.trim())}
              className={`flex-1 flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                selectedOptionData?.isSuccess
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>處理中...</span>
                </>
              ) : (
                <>
                  {selectedOptionData?.icon}
                  <span>
                    {selectedOptionData?.isSuccess ? '確認順利派藥' : '確認並記錄'}
                  </span>
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
    </div>
  );
};

export default DispenseConfirmModal;
