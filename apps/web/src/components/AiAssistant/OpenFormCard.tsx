import React from 'react';
import BedNumberImprint from '../BedNumberImprint';
import type { PrefillData } from '../../hooks/useAiAssistant';

interface OpenFormCardProps {
  prefillData: PrefillData;
  onOpenForm: (prefillData: PrefillData) => void;
  /** id_card 動作卡專用：該院友「身份證相片」存檔狀態（loading/none/has） */
  idCardPhotoStatus?: 'loading' | 'none' | 'has';
}

const docTypeLabels: Record<string, { label: string; icon: string }> = {
  followup: { label: '覆診預約', icon: '🏥' },
  prescription: { label: '處方記錄', icon: '💊' },
  diagnosis: { label: '診斷記錄', icon: '📋' },
  vaccination: { label: '疫苗記錄', icon: '💉' },
  id_card: { label: '身份證', icon: '🪪' },
  health_worksheet: { label: '監測工作紙', icon: '🩺' },
  portrait: { label: '院友相片', icon: '📷' },
};

export const OpenFormCard: React.FC<OpenFormCardProps> = ({ prefillData, onOpenForm, idCardPhotoStatus }) => {
  const info = docTypeLabels[prefillData.documentType] || { label: '記錄', icon: '📄' };
  const patient = prefillData.matchedPatient;
  const recordCount = Array.isArray(prefillData.extractedData) ? prefillData.extractedData.length : 0;
  const isHypothesis = prefillData.documentType === 'portrait' && prefillData.hypothesis === true;
  // id_card 有匹配院友：按「身份證相片」存檔狀態切換文案（loading 先顯示留檔版並禁用按鈕；查詢失敗當無存檔）
  const isIdCardArchive = prefillData.documentType === 'id_card' && !!patient;
  const hasIdCardPhoto = isIdCardArchive && idCardPhotoStatus === 'has';
  const idCardPhotoLoading = isIdCardArchive && idCardPhotoStatus === 'loading';

  const buttonText =
    prefillData.documentType === 'id_card'
      ? patient
        ? hasIdCardPhoto
          ? '確認更換'
          : `身份證圖留檔到 ${patient.中文姓名} 的記錄`
        : '開啟新增院友表單（已預填）'
      : prefillData.documentType === 'health_worksheet'
        ? `開啟監測記錄核對（已預填 ${recordCount} 筆）`
        : prefillData.documentType === 'portrait'
          ? isHypothesis ? '確認設為院友相片' : '設為院友相片'
          : patient
            ? `開啟${info.label}表單（已預填）`
            : `開啟${info.label}表單（未匹配院友，請手選）`;

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{info.icon}</span>
        <span className="font-medium text-sm">
          {isHypothesis
            ? `假設這是 ${patient?.中文姓名 || '該院友'}（${patient?.床號 || '無床號'}）的相片？`
            : hasIdCardPhoto
              ? `${patient.中文姓名} 已有身份證相片存檔，是否更換新的智能身份證？`
              : `已識別${info.label}資料${prefillData.documentType === 'health_worksheet' && recordCount > 0 ? `（共 ${recordCount} 筆）` : ''}`}
        </span>
      </div>

      {patient && !isHypothesis && !hasIdCardPhoto && (
        <div className="text-xs text-gray-600 mb-2">
          院友：{patient.中文姓名}{patient.床號 ? <span>（<BedNumberImprint patient={patient as any} size="sm" />）</span> : ''}
        </div>
      )}

      {!patient && !['id_card', 'health_worksheet', 'portrait'].includes(prefillData.documentType) && (
        <div className="text-xs text-amber-700 mb-2">
          ⚠️ 未自動匹配院友，請在表單中手動選擇院友後再儲存。
        </div>
      )}

      <button
        onClick={() => onOpenForm(prefillData)}
        disabled={idCardPhotoLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <span>{info.icon}</span>
        {buttonText}
      </button>
    </div>
  );
};
