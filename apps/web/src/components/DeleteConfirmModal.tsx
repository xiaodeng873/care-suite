import React from 'react';
import { X, AlertTriangle, User, Calendar, Clock, FileText } from 'lucide-react';

interface RecordDetail {
  label: string;
  value: string | undefined;
  icon?: React.ReactNode;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  recordType: string;
  patientInfo?: {
    name: string;
    bedNumber?: string;
    patientId?: number;
  };
  recordDetails: RecordDetail[];
  warningMessage?: string;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  recordType,
  patientInfo,
  recordDetails,
  warningMessage = '此操作無法撤銷，請確認是否要刪除此記錄？'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* 標題欄 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容區 */}
        <div className="p-6 space-y-6">
          {/* 院友資訊 */}
          {patientInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">院友資訊</h3>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">姓名:</span>
                  <span className="font-medium text-gray-900">{patientInfo.name}</span>
                </div>
                {patientInfo.bedNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">床號:</span>
                    <span className="font-medium text-gray-900">{patientInfo.bedNumber}</span>
                  </div>
                )}
                {patientInfo.patientId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">院友ID:</span>
                    <span className="font-medium text-gray-900">{patientInfo.patientId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 記錄詳情 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">{recordType}詳情</h3>
            </div>
            <div className="space-y-2">
              {recordDetails.map((detail, index) => {
                if (!detail.value) return null;
                return (
                  <div key={index} className="flex justify-between items-start text-sm">
                    <div className="flex items-center space-x-2">
                      {detail.icon}
                      <span className="text-gray-600">{detail.label}:</span>
                    </div>
                    <span className="font-medium text-gray-900 text-right max-w-xs">
                      {detail.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 警告訊息 */}
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 mb-1">警告</p>
                <p className="text-sm text-red-700">{warningMessage}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 按鈕區 */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
          >
            取消
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            確定刪除
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
