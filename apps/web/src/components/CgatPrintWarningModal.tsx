import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import BedNumberImprint from './BedNumberImprint';
import type { Patient } from '../lib/database';

export type CgatPrintWarningType = 'duplicate' | 'individual_pickup';

interface CgatPrintWarningModalProps {
  type: CgatPrintWarningType;
  patients: Patient[];
  onClose: () => void;
}

const titles: Record<CgatPrintWarningType, string> = {
  duplicate: '重複院友警告',
  individual_pickup: '個別取藥院友警告',
};

const messages: Record<CgatPrintWarningType, string> = {
  duplicate: '以下院友在選取的記錄中出現多於一次，請先修正選取後再列印：',
  individual_pickup: '以下院友屬個別取藥，不得列入取藥委託書，請先修正選取後再列印：',
};

const CgatPrintWarningModal: React.FC<CgatPrintWarningModalProps> = ({
  type,
  patients,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="text-lg font-medium">{titles[type]}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-gray-700">{messages[type]}</p>
          <ul className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {patients.map(patient => (
              <li key={patient.院友id} className="px-4 py-2 text-sm text-gray-900">
                <BedNumberImprint patient={patient} size="sm" className="text-gray-500" /> - {patient.中文姓氏}{patient.中文名字}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50">
          <button onClick={onClose} className="btn-secondary">
            返回
          </button>
        </div>
      </div>
    </div>
  );
};

export default CgatPrintWarningModal;
