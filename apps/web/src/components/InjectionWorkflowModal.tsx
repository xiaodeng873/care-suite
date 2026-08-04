import React, { useState, useEffect } from 'react';
import { X, Syringe, MapPin, CheckCircle, UserPlus, Lock } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { isInjectionQualified } from '@care-suite/shared';
import { isQuickSignEnabled } from '../utils/toolsSettings';
import { getRecentInjectionSites, RecentInjectionSite } from '../lib/database';
import BedNumberImprint from './BedNumberImprint';

// 注射區域定義（與 InjectionSiteModal 一致）
export const INJECTION_AREAS = [
  { value: 'left_arm', label: '左上臂區', prefix: 'A', bgColor: '#3b82f6' },
  { value: 'right_arm', label: '右上臂區', prefix: 'B', bgColor: '#10b981' },
  { value: 'abdomen_left', label: '腹部左區', prefix: 'C', bgColor: '#eab308' },
  { value: 'abdomen_right', label: '腹部右區', prefix: 'D', bgColor: '#f97316' },
  { value: 'left_thigh', label: '左大腿區', prefix: 'E', bgColor: '#a855f7' },
  { value: 'right_thigh', label: '右大腿區', prefix: 'F', bgColor: '#ec4899' },
];

type StepKey = 'preparation' | 'verification' | 'dispensing';

interface Signer {
  name: string;   // 顯示名稱（含職位）
  id: string;     // 用戶唯一識別
  position: string; // 護理職位
}

export interface InjectionWorkflowPayload {
  preparationStaff: string;
  verificationStaff: string;
  dispensingStaff: string;
  site: string;
}

interface InjectionWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowRecord: any;
  onComplete: (payload: InjectionWorkflowPayload) => void;
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

const InjectionWorkflowModal: React.FC<InjectionWorkflowModalProps> = ({
  isOpen,
  onClose,
  workflowRecord,
  onComplete,
}) => {
  const { patients, prescriptions } = usePatients();
  const { user, userProfile, displayName, verifyStaffIdentity } = useAuth();

  const [signatures, setSignatures] = useState<Record<StepKey, Signer | null>>({
    preparation: null,
    verification: null,
    dispensing: null,
  });
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [recentSites, setRecentSites] = useState<RecentInjectionSite[]>([]);

  // 身份確認彈窗狀態
  const [confirmStep, setConfirmStep] = useState<StepKey | null>(null);
  const [confirmUsername, setConfirmUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmVerifying, setConfirmVerifying] = useState(false);

  const patient = patients.find(p => p.院友id === workflowRecord?.patient_id);
  const prescription = prescriptions.find(p => p.id === workflowRecord?.prescription_id);

  // 目前登入者是否具備注射簽署資格
  const currentUserQualified = isInjectionQualified(userProfile);
  const currentUserId = userProfile?.id || user?.id || '';
  const currentUserPosition = userProfile?.nursing_position || '';

  // 開啟時：初始化簽署與載入近兩次注射位置
  useEffect(() => {
    if (!isOpen || !workflowRecord) return;
    // 快速簽署已啟用才自動帶入當前登入者首簽①②（合資格時），③須另一人點擊確認；
    // 快速簽署關閉時，三簽全部須手動身份確認
    const autoSign: Signer | null = currentUserQualified && isQuickSignEnabled()
      ? { name: displayName || '未知', id: currentUserId, position: currentUserPosition }
      : null;
    setSignatures({ preparation: autoSign, verification: autoSign, dispensing: null });
    setSelectedArea('');
    setSelectedPosition('');

    let cancelled = false;
    (async () => {
      try {
        const sites = await getRecentInjectionSites(
          workflowRecord.patient_id,
          workflowRecord.scheduled_date,
          2
        );
        if (!cancelled) setRecentSites(sites);
      } catch (err) {
        console.error('讀取近兩次注射位置失敗:', err);
        if (!cancelled) setRecentSites([]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, workflowRecord?.id]);

  if (!isOpen || !workflowRecord) return null;

  const areaInfo = INJECTION_AREAS.find(a => a.value === selectedArea);
  const positions = Array.from({ length: 8 }, (_, i) => i + 1);
  const getFullSiteName = () =>
    selectedArea && selectedPosition ? `${areaInfo?.prefix}${selectedPosition}` : '';

  // 已簽署人數（不同人）
  const distinctSignerCount = new Set(
    Object.values(signatures).filter(Boolean).map(s => (s as Signer).id)
  ).size;
  const allSigned = signatures.preparation && signatures.verification && signatures.dispensing;
  const canComplete = !!allSigned && distinctSignerCount >= 2 && !!getFullSiteName();

  // 開啟身份確認
  const openConfirm = (step: StepKey) => {
    setConfirmStep(step);
    setConfirmUsername('');
    setConfirmPassword('');
    setConfirmError('');
  };

  // 清除某格簽署
  const clearSignature = (step: StepKey) => {
    setSignatures(prev => ({ ...prev, [step]: null }));
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
      // 職位資格檢查
      if (!isInjectionQualified(verified)) {
        setConfirmError('職位不符（須註冊/登記護士或保健員）');
        return;
      }
      // 不可與其他格簽署者相同（排除當前欄位本身）
      const existingIds = Object.entries(signatures)
        .filter(([k, v]) => k !== confirmStep && Boolean(v))
        .map(([, v]) => (v as Signer).id);
      if (existingIds.includes(verified.id)) {
        setConfirmError('此人已在其他欄位簽署，須由不同人員簽署');
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
      site: getFullSiteName(),
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
            <div className="p-2 rounded-lg bg-blue-100">
              <Syringe className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">注射類藥物給藥程序</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {patient?.中文姓氏}{patient?.中文名字} {patient && <BedNumberImprint patient={patient} size="sm" />}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* 藥物資訊列 */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
          <span>藥物：<span className="font-medium text-gray-900">{prescription?.medication_name}</span></span>
          <span>日期：{workflowRecord.scheduled_date}</span>
          <span>時間點：{String(workflowRecord.scheduled_time || '').substring(0, 5)}</span>
        </div>

        {/* 三簽署卡 */}
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

        {/* 注射位置 */}
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-800 mb-2">
            注射位置 <span className="text-red-500">（必填）</span>
          </div>

          {/* 近兩次位置提醒 */}
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <div className="flex items-center gap-1 font-medium mb-1">
              <MapPin className="h-4 w-4" /> 最近2次注射位置：
            </div>
            {recentSites.length > 0 ? (
              <ul className="space-y-0.5 ml-5 list-disc">
                {recentSites.map((s, i) => (
                  <li key={i}>
                    {s.scheduled_date} {String(s.scheduled_time).substring(0, 5)} → {s.site}
                    {s.areaLabel ? `（${s.areaLabel}）` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ml-5 text-amber-600">無近期注射記錄</div>
            )}
          </div>

          {/* 區域 */}
          <div className="flex flex-wrap gap-2 mb-2">
            {INJECTION_AREAS.map(area => (
              <button
                key={area.value}
                onClick={() => { setSelectedArea(area.value); setSelectedPosition(''); }}
                className={`px-3 py-1.5 text-xs rounded-lg border-2 transition-all ${
                  selectedArea === area.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                {area.label}（{area.prefix}）
              </button>
            ))}
          </div>

          {/* 位置 */}
          {selectedArea && (
            <div className="grid grid-cols-8 gap-1.5 mb-2">
              {positions.map(pos => (
                <button
                  key={pos}
                  onClick={() => setSelectedPosition(String(pos))}
                  className={`py-2 text-sm font-bold rounded-lg border-2 transition-all ${
                    selectedPosition === String(pos)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-800'
                  }`}
                >
                  {areaInfo?.prefix}{pos}
                </button>
              ))}
            </div>
          )}

          {getFullSiteName() && (
            <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
              <CheckCircle className="h-4 w-4" /> 已選：{getFullSiteName()}
            </div>
          )}
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
              ⚠️ 注射須至少兩位合資格人員（註冊/登記護士或保健員）參與，三簽不可全為同一人。
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

export default InjectionWorkflowModal;
