import React from 'react';
import type { PrefillData } from '../../hooks/useAiAssistant';

interface OpenFormCardProps {
  prefillData: PrefillData;
  onOpenForm: (prefillData: PrefillData) => void;
}

const docTypeLabels: Record<string, { label: string; icon: string }> = {
  followup: { label: '覆診預約', icon: '🏥' },
  prescription: { label: '處方記錄', icon: '💊' },
  diagnosis: { label: '診斷記錄', icon: '📋' },
  vaccination: { label: '疫苗記錄', icon: '💉' },
};

export const OpenFormCard: React.FC<OpenFormCardProps> = ({ prefillData, onOpenForm }) => {
  const info = docTypeLabels[prefillData.documentType] || { label: '記錄', icon: '📄' };
  const patient = prefillData.matchedPatient;

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{info.icon}</span>
        <span className="font-medium text-sm">
          已識別{info.label}資料
        </span>
      </div>

      {patient && (
        <div className="text-xs text-gray-600 mb-2">
          院友：{patient.中文姓名}{patient.床號 ? `（${patient.床號}）` : ''}
        </div>
      )}

      <button
        onClick={() => onOpenForm(prefillData)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <span>{info.icon}</span>
        開啟{info.label}表單（已預填）
      </button>
    </div>
  );
};
