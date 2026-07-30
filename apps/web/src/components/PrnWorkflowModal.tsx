import React, { useState, useEffect } from 'react';
import { X, Pill, CheckCircle, UserPlus, Lock, Clock } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import BedNumberImprint from './BedNumberImprint';
import { useAuth } from '../context/AuthContext';
import { isInjectionQualified } from '@care-suite/shared';

type StepKey = 'preparation' | 'verification' | 'dispensing';

interface Signer {
  name: string;   // 顯示名稱（含職位）
  id: string;     // 用戶唯一識別
  position: string; // 護理職位
}

export interface PrnWorkflowPayload {
  preparationStaff: string;
  verificationStaff: string;
  dispensingStaff: string;
  administrationTime: string; // HH:MM
}

interface PrnWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 供 modal 顯示的 PRN 上下文（非資料庫記錄，記錄於完成時才建立） */
  prnContext: {
    prescription_id: string;
    patient_id: number;
    scheduled_date: string;
  } | null;
  /** 預填的實際給藥時間 HH:MM（通常為當下） */
  defaultTime: string;
  onComplete: (payload: PrnWorkflowPayload) => void;
}

const STEP_LABELS: Record<StepKey, string> = {
  preparation: '執藥',
  verification: '核藥',
  dispensing: '派藥',
};

const STEP_ORDER: { key: StepKey; index: string }[] = [
  { key: 'preparation', index: '①' },
  { key: 'verification', index: '②' },
  { key: 'dispensing', index: '③' },
];

const PrnWorkflowModal: React.FC<PrnWorkflowModalProps> = ({
  isOpen,
  onClose,
  prnContext,
  defaultTime,
  onComplete,
}) => {
  const { patients, prescriptions } = usePatients();
  const { user, userProfile, displayName, verifyStaffIdentity } = useAuth();

  const [signatures, setSignatures] = useState<Record<StepKey, Signer | null>>({
    preparation: null,
    verification: null,
    dispensing: null,
  });
  const [administrationTime, setAdministrationTime] = useState('');

  // 身份確認彈窗狀態
  const [confirmStep, setConfirmStep] = useState<StepKey | null>(null);
  const [confirmUsername, setConfirmUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmVerifying, setConfirmVerifying] = useState(false);

  const patient = patients.find(p => p.院友id === prnContext?.patient_id);
  const prescription = prescriptions.find(p => p.id === prnContext?.prescription_id);

  // 目前登入者是否具備簽署資格（護理員不可）
  const currentUserQualified = isInjectionQualified(userProfile);
  const currentUserId = userProfile?.id || user?.id || '';
  const currentUserPosition = userProfile?.nursing_position || '';

  // 開啟時：三簽署自動填當前登入者（合資格時，普通 PRN 可一人完成三簽）
  useEffect(() => {
    if (!isOpen || !prnContext) return;
    const autoSign: Signer | null = currentUserQualified
      ? { name: displayName || '未知', id: currentUserId, position: currentUserPosition }
      : null;
    setSignatures({ preparation: autoSign, verification: autoSign, dispensing: autoSign });
    setAdministrationTime(defaultTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prnContext?.prescription_id, prnContext?.scheduled_date, defaultTime]);

  if (!isOpen || !prnContext) return null;

  const allSigned = signatures.preparation && signatures.verification && signatures.dispensing;
  const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(administrationTime);
  const canComplete = !!allSigned && timeValid;

  // 開啟身份確認
  const openConfirm = (step: StepKey) => {
    setConfirmStep(step);
    setConfirmUsername('');
    setConfirmPassword('');
    setConfirmError('');
  };

  // 提交身份確認
  const submitConfirm = async () => {
    if (!confirmStep) return;
    if (!confirmUsername.trim() || !confirmPassword) {
      setConfirmError('請輸入帳號與密碼');
      return;
    }
    setConfirmVerifying(true);
    setConfirmError('');
    try {
      const { user: verified, error } = await verifyStaffIdentity(
        confirmUsername.trim(),
        confirmPassword
      );
      if (error || !verified) {
        setConfirmError(typeof error === 'string' ? error : '帳號或密碼錯誤');
        return;
      }
      // 職位資格檢查（護理員不可）
      if (!isInjectionQualified(verified)) {
        setConfirmError('職位不符（須註冊/登記護士或保健員）');
        return;
      }
      const signer: Signer = {
        name: verified.name_zh
          ? `${verified.name_zh}${verified.nursing_position ? ` (${verified.nursing_position})` : ''}`
          : verified.username,
        id: verified.id,
        position: verified.nursing_position || '',
      };
      setSignatures(prev => ({ ...prev, [confirmStep]: signer }));
      setConfirmStep(null);
    } finally {
      setConfirmVerifying(false);
    }
  };

  const handleComplete = () => {
    if (!canComplete) return;
    onComplete({
      preparationStaff: signatures.preparation!.name,
      verificationStaff: signatures.verification!.name,
      dispensingStaff: signatures.dispensing!.name,
      administrationTime,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full p-6 my-8 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Pill className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">需要時給藥程序</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {patient?.中文姓氏}{patient?.中文名字} <BedNumberImprint patient={patient as any} size="sm" />
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* 藥物資訊列 */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
          <span>藥物：<span className="font-medium text-gray-900">{prescription?.medication_name}</span></span>
          <span>日期：{prnContext.scheduled_date}</span>
          {prescription?.is_prn && (
            <span className="text-red-600 font-medium">需要時</span>
          )}
        </div>

        {/* 給藥時間（可手調） */}
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
            <Clock className="h-4 w-4" /> 給藥時間 <span className="text-red-500">（必填）</span>
          </div>
          <input
            type="time"
            value={administrationTime}
            onChange={(e) => setAdministrationTime(e.target.value)}
            className="form-input w-40"
          />
        </div>

        {/* 三簽署卡（普通 PRN：可一人完成三簽） */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {STEP_ORDER.map(({ key, index }) => {
            const signed = signatures[key];
            return (
              <div
                key={key}
                className={`border-2 rounded-lg p-3 text-center ${
                  signed ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="text-sm font-medium text-gray-800 mb-1">
                  {index} {STEP_LABELS[key]}
                </div>
                {signed ? (
                  <>
                    <div className="flex items-center justify-center gap-1 text-green-700 text-xs mb-1">
                      <CheckCircle className="h-3.5 w-3.5" /> 已簽
                    </div>
                    <div className="text-xs text-gray-800 break-all">{signed.name}</div>
                    <button
                      onClick={() => openConfirm(key)}
                      className="mt-1 text-[11px] text-blue-400 hover:text-blue-600 underline"
                    >
                      另填
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openConfirm(key)}
                    className="mt-2 inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> 點擊簽署
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部按鈕 */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button
            onClick={handleComplete}
            disabled={!canComplete}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            完成
          </button>
        </div>
      </div>

      {/* 身份確認彈窗 */}
      {confirmStep && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]"
          onClick={() => setConfirmStep(null)}
        >
          <div
            className="bg-white rounded-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">簽署身份確認</h3>
              </div>
              <button onClick={() => setConfirmStep(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-sm text-gray-700 mb-1">
              正在簽署：<span className="font-medium">{STEP_LABELS[confirmStep]}</span>
            </div>
            <div className="text-xs text-amber-600 mb-3">
              ⚠️ 簽署人員須為註冊/登記護士或保健員（護理員不可）。
            </div>

            <div className="space-y-2 mb-2">
              <input
                type="text"
                value={confirmUsername}
                onChange={(e) => setConfirmUsername(e.target.value)}
                placeholder="帳號"
                autoComplete="off"
                className="form-input w-full"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitConfirm(); }}
                placeholder="密碼"
                autoComplete="new-password"
                className="form-input w-full"
              />
            </div>

            {confirmError && (
              <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                ❌ {confirmError}
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setConfirmStep(null)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={submitConfirm}
                disabled={confirmVerifying}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {confirmVerifying ? '驗證中…' : '確認簽署'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrnWorkflowModal;
