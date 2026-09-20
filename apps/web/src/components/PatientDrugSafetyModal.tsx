import React, { useState } from 'react';
import { X, AlertTriangle, Heart } from 'lucide-react';

interface PatientDrugSafetyModalProps {
  type: 'allergy' | 'adr';
  patientName: string;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
}

// 新增藥物敏感／不良藥物反應嘅細彈窗（處方管理頁「藥物安全資訊」入面嘅 + 新增連結開啟）
const PatientDrugSafetyModal: React.FC<PatientDrugSafetyModalProps> = ({
  type,
  patientName,
  onClose,
  onSave,
}) => {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const isAllergy = type === 'allergy';
  const title = isAllergy ? '新增藥物敏感' : '新增不良藥物反應';
  const placeholder = isAllergy ? '輸入藥物敏感項目（如 Penicillin）' : '輸入不良藥物反應項目';

  const handleSave = async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await onSave(value);
    } catch (err) {
      console.error(`儲存${title}失敗:`, err);
      alert(`儲存失敗，請重試`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {isAllergy
              ? <AlertTriangle className="h-5 w-5 text-orange-600" />
              : <Heart className="h-5 w-5 text-red-600" />}
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">院友：<span className="font-medium text-gray-900">{patientName}</span></p>
          <input
            type="text"
            className="form-input w-full"
            placeholder={placeholder}
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
          />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button
            onClick={() => void handleSave()}
            disabled={!text.trim() || saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '儲存中…' : '新增'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientDrugSafetyModal;
