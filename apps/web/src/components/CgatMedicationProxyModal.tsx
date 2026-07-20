import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CgatMedicationProxyModalProps {
  onClose: () => void;
  onConfirm: (proxyDate: string, responsiblePerson: string, prescriptionPaperCount: string) => void;
}

const CgatMedicationProxyModal: React.FC<CgatMedicationProxyModalProps> = ({ onClose, onConfirm }) => {
  const [proxyDate, setProxyDate] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [prescriptionPaperCount, setPrescriptionPaperCount] = useState('');

  const handleConfirm = () => {
    onConfirm(proxyDate, responsiblePerson.trim(), prescriptionPaperCount.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">列印取藥委託書</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="form-label">委託書日期</label>
            <input
              type="date"
              value={proxyDate}
              onChange={(e) => setProxyDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">負責人</label>
            <input
              type="text"
              value={responsiblePerson}
              onChange={(e) => setResponsiblePerson(e.target.value)}
              placeholder="請輸入負責人姓名"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">藥單紙數量</label>
            <input
              type="text"
              value={prescriptionPaperCount}
              onChange={(e) => setPrescriptionPaperCount(e.target.value)}
              placeholder="請輸入藥單紙數量"
              className="form-input"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button onClick={handleConfirm} className="btn-primary">
            確認列印
          </button>
        </div>
      </div>
    </div>
  );
};

export default CgatMedicationProxyModal;
