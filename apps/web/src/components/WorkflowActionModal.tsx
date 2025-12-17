import React from 'react';
import { X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface WorkflowActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowRecord: any;
  step: 'preparation' | 'verification' | 'dispensing';
  onComplete: (recordId: string, step: string) => void;
  onFail: (recordId: string, step: string) => void;
}

const WorkflowActionModal: React.FC<WorkflowActionModalProps> = ({
  isOpen,
  onClose,
  workflowRecord,
  step,
  onComplete,
  onFail
}) => {
  const { patients, prescriptions } = usePatients();

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
      case 'preparation': return <Clock className="h-6 w-6 text-blue-600" />;
      case 'verification': return <CheckCircle className="h-6 w-6 text-yellow-600" />;
      case 'dispensing': return <CheckCircle className="h-6 w-6 text-green-600" />;
      default: return <Clock className="h-6 w-6 text-gray-600" />;
    }
  };

  const handleComplete = () => {
    onComplete(workflowRecord.id, step);
    onClose();
  };

  const handleFail = () => {
    onFail(workflowRecord.id, step);
    // 不要立即關閉，讓父組件處理
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100">
              {getStepIcon(step)}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {getStepLabel(step)}操作
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 院友和藥物資訊 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
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

        {/* 操作說明 */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            請選擇{getStepLabel(step)}的執行結果：
          </p>
        </div>

        {/* 操作按鈕 */}
        <div className="flex space-x-3">
          <button
            onClick={handleComplete}
            className="btn-primary flex-1 flex items-center justify-center space-x-2"
          >
            <CheckCircle className="h-4 w-4" />
            <span>完成{getStepLabel(step)}</span>
          </button>
          <button
            onClick={handleFail}
            className="btn-danger flex-1 flex items-center justify-center space-x-2"
          >
            <XCircle className="h-4 w-4" />
            <span>未能完成</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowActionModal;