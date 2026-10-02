import React, { useState, useCallback, useRef } from 'react';
import { X, FileText, ChevronDown, ChevronUp, Loader, CheckCircle, AlertTriangle, Save, Plus, Trash2 } from 'lucide-react';
import { usePatientData, type FollowUpAppointment } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import DateInput from './DateInput';
import { mapOCRDataToPrescriptionForm } from '../utils/ocrFieldMapper';
import { getMedicationSettings } from '../utils/medicationSettings';
import { isDuplicateFollowUp } from '../utils/followUpDuplicate';

interface DiagEntry {
  tempId: string;
  diagnosis_date: string;
  diagnosis_item: string;
  diagnosis_unit: string;
}

type AlertType = '藥物敏感' | '不良藥物反應' | '感染控制';
const ALERT_TYPES: AlertType[] = ['藥物敏感', '不良藥物反應', '感染控制'];

interface AlertEntry {
  tempId: string;
  類型: AlertType;
  內容: string;
}

interface FUEntry {
  tempId: string;
  覆診日期: string;
  覆診時間: string;
  覆診地點: string;
  覆診專科: string;
}

interface DischargeSlipModalProps {
  onClose: () => void;
  extractedData: any;
  matchedPatientId?: number | null;
  sourceImagePreviews?: string[];
}

type SectionKey = 'diagnoses' | 'allergies' | 'followups';

const tempId = () => Math.random().toString(36).slice(2, 10);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const timeStr = (v: unknown): string => str(v).slice(0, 5);

const getHongKongDate = () => {
  const now = new Date();
  const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return hongKongTime.toISOString().split('T')[0];
};

const asArray = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter(r => r && typeof r === 'object') : [];

const DischargeSlipModal: React.FC<DischargeSlipModalProps> = ({
  onClose,
  extractedData,
  matchedPatientId,
  sourceImagePreviews,
}) => {
  const {
    patients,
    addDiagnosisRecord,
    addFollowUpAppointment,
    followUpAppointments,
    updatePatient,
  } = usePatientData();

  const ed = extractedData || {};
  const dischargeDate = str(ed.出院日期) || getHongKongDate();
  const hospitalName = str(ed.醫院名稱);

  // 初始映射只建一次（modal 生命週期內不重建）
  const initialRef = useRef<{
    diagnoses: DiagEntry[];
    allergies: AlertEntry[];
    followups: FUEntry[];
  } | null>(null);
  if (!initialRef.current) {
    initialRef.current = {
      diagnoses: asArray(ed.diagnoses).map(d => ({
        tempId: tempId(),
        // 診斷日期預設出院日期
        diagnosis_date: str(d.診斷日期) || dischargeDate,
        diagnosis_item: str(d.診斷項目),
        diagnosis_unit: str(d.診斷單位) || hospitalName,
      })),
      allergies: asArray(ed.allergies).map(a => ({
        tempId: tempId(),
        類型: ALERT_TYPES.includes(a.類型 as AlertType) ? (a.類型 as AlertType) : '藥物敏感',
        內容: str(a.內容),
      })),
      followups: asArray(ed.followups).map(f => ({
        tempId: tempId(),
        覆診日期: str(f.覆診日期),
        覆診時間: timeStr(f.覆診時間),
        覆診地點: str(f.覆診地點),
        覆診專科: str(f.覆診專科),
      })),
    };
  }
  const initial = initialRef.current;

  const [diagnoses, setDiagnoses] = useState<DiagEntry[]>(initial.diagnoses);
  const [allergies, setAllergies] = useState<AlertEntry[]>(initial.allergies);
  const [followups, setFollowups] = useState<FUEntry[]>(initial.followups);

  // 未提供 matchedPatientId 時，用頂層院友姓名經現行 mapper 匹配邏輯補匹配
  const [院友id, set院友id] = useState<number | null>(() => {
    if (matchedPatientId != null) return matchedPatientId;
    if (patients?.length) {
      const { formData: m } = mapOCRDataToPrescriptionForm(ed as any, {}, patients, getMedicationSettings().服用時段);
      const pid = m.patient_id ? Number(m.patient_id) : NaN;
      if (Number.isFinite(pid)) return pid;
    }
    return null;
  });

  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set());
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [sectionResults, setSectionResults] = useState<Partial<Record<SectionKey, { saved: number; failed: number }>>>({});
  const [forceAddIds, setForceAddIds] = useState<Set<string>>(new Set());
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const patient = patients?.find(p => p.院友id === 院友id);

  const toggleCollapsed = (key: SectionKey) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const toggleForceAdd = useCallback((id: string) => {
    setForceAddIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const clearRowError = (id: string) =>
    setRowErrors(prev => { const n = { ...prev }; delete n[id]; return n; });

  // ── 敏感與警示：已存在檢查（內容相同者預設剔除，可勾「仍要新增」） ──
  const isExistingAlert = (a: AlertEntry): boolean => {
    if (!a.內容.trim() || !patient) return false;
    const existing = (patient[a.類型] as string[] | undefined) || [];
    return existing.some(x => String(x).trim() === a.內容.trim());
  };
  const isExcludedAlert = (a: AlertEntry) => isExistingAlert(a) && !forceAddIds.has(a.tempId);

  // ── 覆診：重用 followUpDuplicate 重複檢查 ──
  const isDupFU = (f: FUEntry): boolean =>
    isDuplicateFollowUp(followUpAppointments || [], {
      院友id,
      覆診日期: f.覆診日期,
      覆診時間: f.覆診時間,
      覆診地點: f.覆診地點,
    });
  const isExcludedFU = (f: FUEntry) => isDupFU(f) && !forceAddIds.has(f.tempId);

  // ── 各段儲存 ──
  const saveDiagnoses = async () => {
    setSavingSection('diagnoses');
    setSectionErrors(prev => ({ ...prev, diagnoses: undefined }));
    let saved = 0, failed = 0;
    for (const item of [...diagnoses]) {
      if (!院友id) { failed++; setRowErrors(prev => ({ ...prev, [item.tempId]: '必須選擇院友' })); continue; }
      if (!item.diagnosis_item.trim()) { failed++; setRowErrors(prev => ({ ...prev, [item.tempId]: '缺少診斷項目' })); continue; }
      if (!item.diagnosis_date) { failed++; setRowErrors(prev => ({ ...prev, [item.tempId]: '缺少診斷日期' })); continue; }
      try {
        // 與 DiagnosisRecordModal.handleSubmit 相同的寫入 API
        await addDiagnosisRecord({
          patient_id: 院友id,
          diagnosis_date: item.diagnosis_date,
          diagnosis_item: item.diagnosis_item.trim(),
          diagnosis_unit: item.diagnosis_unit.trim(),
          remarks: '',
        });
        saved++;
        setDiagnoses(prev => prev.filter(d => d.tempId !== item.tempId));
      } catch (e: any) {
        failed++;
        setRowErrors(prev => ({ ...prev, [item.tempId]: e?.message || '儲存失敗' }));
      }
    }
    setSectionResults(prev => ({
      ...prev,
      diagnoses: { saved: (prev.diagnoses?.saved ?? 0) + saved, failed },
    }));
    setSavingSection(null);
  };

  const saveAllergies = async () => {
    setSavingSection('allergies');
    setSectionErrors(prev => ({ ...prev, allergies: undefined }));
    if (!院友id || !patient) {
      setSectionErrors(prev => ({ ...prev, allergies: '必須選擇院友' }));
      setSavingSection(null);
      return;
    }
    const savable: AlertEntry[] = [];
    let skipped = 0;
    for (const a of allergies) {
      if (!a.內容.trim()) { skipped++; setRowErrors(prev => ({ ...prev, [a.tempId]: '缺少內容' })); continue; }
      if (isExcludedAlert(a)) continue; // 已存在且未勾「仍要新增」→ 剔除
      savable.push(a);
    }
    try {
      // 按類型分組追加（讀現有值 → 去重 → 合併），一次 updatePatient
      const merged: Record<AlertType, string[]> = {
        藥物敏感: [...((patient.藥物敏感 as string[] | undefined) || [])],
        不良藥物反應: [...((patient.不良藥物反應 as string[] | undefined) || [])],
        感染控制: [...((patient.感染控制 as string[] | undefined) || [])],
      };
      for (const a of savable) {
        const content = a.內容.trim();
        if (!merged[a.類型].some(x => String(x).trim() === content)) merged[a.類型].push(content);
      }
      await updatePatient({
        ...patient,
        藥物敏感: merged.藥物敏感,
        不良藥物反應: merged.不良藥物反應,
        感染控制: merged.感染控制,
      });
      const savedIds = new Set(savable.map(a => a.tempId));
      setAllergies(prev => prev.filter(a => !savedIds.has(a.tempId)));
      setSectionResults(prev => ({
        ...prev,
        allergies: { saved: (prev.allergies?.saved ?? 0) + savable.length, failed: skipped },
      }));
    } catch (e: any) {
      setSectionErrors(prev => ({ ...prev, allergies: e?.message || '儲存失敗' }));
    }
    setSavingSection(null);
  };

  const saveFollowups = async () => {
    setSavingSection('followups');
    setSectionErrors(prev => ({ ...prev, followups: undefined }));
    let saved = 0, failed = 0;
    for (const f of [...followups]) {
      if (isExcludedFU(f)) continue; // 重複已剔除
      if (!院友id) { failed++; setRowErrors(prev => ({ ...prev, [f.tempId]: '必須選擇院友' })); continue; }
      if (!f.覆診日期) { failed++; setRowErrors(prev => ({ ...prev, [f.tempId]: '缺少覆診日期' })); continue; }
      try {
        const appt = {
          院友id,
          覆診日期: f.覆診日期,
          出發時間: null as string | null,
          覆診時間: f.覆診時間 || null,
          覆診地點: f.覆診地點 || null,
          覆診專科: f.覆診專科 || null,
          交通安排: null as string | null,
          陪診人員: null as string | null,
          備註: null as string | null,
          狀態: '尚未安排' as FollowUpAppointment['狀態'],
        } as Omit<FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>;
        await addFollowUpAppointment(appt);
        saved++;
        setFollowups(prev => prev.filter(x => x.tempId !== f.tempId));
      } catch (e: any) {
        failed++;
        setRowErrors(prev => ({ ...prev, [f.tempId]: e?.message || '儲存失敗' }));
      }
    }
    setSectionResults(prev => ({
      ...prev,
      followups: { saved: (prev.followups?.saved ?? 0) + saved, failed },
    }));
    setSavingSection(null);
  };

  // ── 更新 helpers ──
  const updateDiag = (id: string, patch: Partial<DiagEntry>) => {
    setDiagnoses(prev => prev.map(d => (d.tempId === id ? { ...d, ...patch } : d)));
    clearRowError(id);
  };
  const updateAlert = (id: string, patch: Partial<AlertEntry>) => {
    setAllergies(prev => prev.map(a => (a.tempId === id ? { ...a, ...patch } : a)));
    clearRowError(id);
  };
  const updateFU = (id: string, patch: Partial<FUEntry>) => {
    setFollowups(prev => prev.map(f => (f.tempId === id ? { ...f, ...patch } : f)));
    clearRowError(id);
  };

  const sectionShell = (
    key: SectionKey,
    title: string,
    count: number,
    initialCount: number,
    savableCount: number,
    onSave: () => void,
    children: React.ReactNode,
  ) => {
    if (initialCount === 0) return null; // 無該段資料整段不顯示
    const isCollapsed = collapsed.has(key);
    const result = sectionResults[key];
    const sectionError = sectionErrors[key];
    return (
      <div className="border border-gray-200 rounded-lg">
        <div
          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${isCollapsed ? 'rounded-lg hover:bg-gray-50' : 'bg-gray-50 border-b border-gray-200 rounded-t-lg'}`}
          onClick={() => toggleCollapsed(key)}
        >
          <span className="text-sm font-medium text-gray-900">{title}</span>
          {count > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{count} 項待核對</span>
          )}
          {count === 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />已完成
            </span>
          )}
          {isCollapsed ? (
            <ChevronDown className="ml-auto h-4 w-4 text-gray-400" />
          ) : (
            <ChevronUp className="ml-auto h-4 w-4 text-gray-400" />
          )}
        </div>
        {!isCollapsed && (
          <div className="p-4 space-y-3">
            {result && count > 0 && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${result.failed ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>已儲存 {result.saved} 筆{result.failed > 0 ? `，${result.failed} 筆失敗／略過` : ''}</span>
              </div>
            )}
            {sectionError && (
              <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border bg-red-50 border-red-200 text-red-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{sectionError}</span>
              </div>
            )}
            {count === 0 ? (
              <div className="text-center py-4 text-gray-400">
                <CheckCircle className="h-8 w-8 mx-auto mb-1 text-green-400" />
                <p className="text-sm">此段已全部儲存完成</p>
              </div>
            ) : (
              <>
                {children}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={savingSection !== null || !院友id || savableCount === 0}
                    className="btn-primary text-sm !bg-green-600 hover:!bg-green-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingSection === key ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    儲存此段（{savableCount} 項）
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const savableAlerts = allergies.filter(a => a.內容.trim() && !isExcludedAlert(a)).length;
  const savableFUs = followups.filter(f => !isExcludedFU(f)).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div className="bg-white rounded-lg w-full max-w-6xl my-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><FileText className="h-5 w-5 text-blue-600" /></div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">出院紙核對</h2>
              <p className="text-xs text-gray-500">
                {dischargeDate ? `出院日期：${dischargeDate}` : ''}{hospitalName ? ` · ${hospitalName}` : ''} · 請分段核對識別結果，修正後儲存
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sourceImagePreviews && sourceImagePreviews.length > 0 && (
              <div className="flex -space-x-2">
                {sourceImagePreviews.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`來源圖片${i + 1}`}
                    onClick={() => setLightboxSrc(src)}
                    className="w-10 h-10 rounded border-2 border-white shadow object-cover cursor-pointer hover:opacity-80"
                  />
                ))}
              </div>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* 院友列（全部段共用） */}
          <div className="flex flex-wrap items-end gap-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex-1 min-w-[260px]">
              <label className="form-label">院友 *（全部段共用）</label>
              <PatientAutocomplete
                value={院友id ?? ''}
                onChange={id => set院友id(id ? Number(id) : null)}
                placeholder="搜索院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
            </div>
            <div className="text-xs text-blue-700 pb-2">
              {院友id ? '由 OCR 姓名／身份證自動匹配 · 如識別錯誤請在此更正' : '未能自動匹配院友，請手動選擇'}
            </div>
          </div>

          {/* 診斷段 */}
          {sectionShell(
            'diagnoses',
            '診斷',
            diagnoses.length,
            initial.diagnoses.length,
            diagnoses.filter(d => d.diagnosis_item.trim()).length,
            saveDiagnoses,
            <>
              {diagnoses.map(d => (
                <div key={d.tempId} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-40">
                      <DateInput
                        value={d.diagnosis_date}
                        onChange={value => updateDiag(d.tempId, { diagnosis_date: value })}
                        className="form-input h-9"
                      />
                    </div>
                    <input
                      type="text"
                      value={d.diagnosis_item}
                      onChange={e => updateDiag(d.tempId, { diagnosis_item: e.target.value })}
                      className={`form-input h-9 flex-1 min-w-[200px] ${!d.diagnosis_item.trim() ? '!border-red-400' : ''}`}
                      placeholder="診斷項目 *"
                    />
                    <input
                      type="text"
                      value={d.diagnosis_unit}
                      onChange={e => updateDiag(d.tempId, { diagnosis_unit: e.target.value })}
                      className="form-input h-9 w-44"
                      placeholder="診斷單位"
                    />
                    <button type="button" onClick={() => setDiagnoses(prev => prev.filter(x => x.tempId !== d.tempId))} className="text-red-600 hover:text-red-800 p-1" title="刪除此項">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {rowErrors[d.tempId] && <p className="text-[11px] text-red-600">⚠ {rowErrors[d.tempId]}</p>}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDiagnoses(prev => [...prev, { tempId: tempId(), diagnosis_date: dischargeDate, diagnosis_item: '', diagnosis_unit: hospitalName }])}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />新增診斷
              </button>
            </>,
          )}

          {/* 藥物敏感與警示段 */}
          {sectionShell(
            'allergies',
            '藥物敏感與警示',
            allergies.length,
            initial.allergies.length,
            savableAlerts,
            saveAllergies,
            <>
              {allergies.map(a => {
                const existing = isExistingAlert(a);
                const excluded = isExcludedAlert(a);
                return (
                  <div key={a.tempId} className="space-y-1">
                    <div className={`flex flex-wrap items-center gap-2 ${excluded ? 'opacity-60' : ''}`}>
                      <select
                        value={a.類型}
                        onChange={e => updateAlert(a.tempId, { 類型: e.target.value as AlertType })}
                        className="form-input h-9 w-36"
                      >
                        {ALERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        type="text"
                        value={a.內容}
                        onChange={e => updateAlert(a.tempId, { 內容: e.target.value })}
                        className={`form-input h-9 flex-1 min-w-[200px] ${!a.內容.trim() ? '!border-red-400' : ''}`}
                        placeholder="內容 *"
                      />
                      {existing && (
                        <>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 flex-shrink-0">已存在</span>
                          <label className="flex items-center gap-1 text-xs text-blue-600 flex-shrink-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={forceAddIds.has(a.tempId)}
                              onChange={() => toggleForceAdd(a.tempId)}
                              className="rounded border-gray-300"
                            />
                            仍要新增
                          </label>
                        </>
                      )}
                      <button type="button" onClick={() => setAllergies(prev => prev.filter(x => x.tempId !== a.tempId))} className="text-red-600 hover:text-red-800 p-1" title="刪除此項">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {rowErrors[a.tempId] && <p className="text-[11px] text-red-600">⚠ {rowErrors[a.tempId]}</p>}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setAllergies(prev => [...prev, { tempId: tempId(), 類型: '藥物敏感', 內容: '' }])}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />新增項目
              </button>
            </>,
          )}

          {/* 覆診段 */}
          {sectionShell(
            'followups',
            '覆診',
            followups.length,
            initial.followups.length,
            savableFUs,
            saveFollowups,
            <>
              {followups.map(f => {
                const dup = isDupFU(f);
                const excluded = isExcludedFU(f);
                return (
                  <div key={f.tempId} className="space-y-1">
                    <div className={`flex flex-wrap items-center gap-2 ${excluded ? 'opacity-60' : ''}`}>
                      <div className="w-40">
                        <DateInput
                          value={f.覆診日期}
                          onChange={value => updateFU(f.tempId, { 覆診日期: value })}
                          className={`form-input h-9 ${!f.覆診日期 ? '!border-red-400' : ''}`}
                        />
                      </div>
                      <input
                        type="time"
                        value={f.覆診時間}
                        onChange={e => updateFU(f.tempId, { 覆診時間: e.target.value })}
                        className="form-input h-9 w-28"
                      />
                      <input
                        type="text"
                        value={f.覆診地點}
                        onChange={e => updateFU(f.tempId, { 覆診地點: e.target.value })}
                        className="form-input h-9 flex-1 min-w-[160px]"
                        placeholder="覆診地點"
                      />
                      <input
                        type="text"
                        value={f.覆診專科}
                        onChange={e => updateFU(f.tempId, { 覆診專科: e.target.value })}
                        className="form-input h-9 w-36"
                        placeholder="覆診專科"
                      />
                      {dup && (
                        <>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 flex-shrink-0">已存在</span>
                          <label className="flex items-center gap-1 text-xs text-blue-600 flex-shrink-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={forceAddIds.has(f.tempId)}
                              onChange={() => toggleForceAdd(f.tempId)}
                              className="rounded border-gray-300"
                            />
                            仍要新增
                          </label>
                        </>
                      )}
                      <button type="button" onClick={() => setFollowups(prev => prev.filter(x => x.tempId !== f.tempId))} className="text-red-600 hover:text-red-800 p-1" title="刪除此項">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {rowErrors[f.tempId] && <p className="text-[11px] text-red-600">⚠ {rowErrors[f.tempId]}</p>}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setFollowups(prev => [...prev, { tempId: tempId(), 覆診日期: '', 覆診時間: '', 覆診地點: '', 覆診專科: '' }])}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />新增覆診
              </button>
            </>,
          )}
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-200 bg-white rounded-b-lg">
          <span className="text-xs text-gray-500">每段獨立儲存：診斷 → 診斷記錄；警示 → 院友主表（追加不覆蓋）；覆診 → 覆診安排（出院藥物請用處方識別流程）</span>
          <button onClick={onClose} className="btn-secondary text-sm">關閉</button>
        </div>
      </div>

      {/* 來源圖片放大 */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black bg-opacity-80 flex items-center justify-center p-6"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="來源圖片" className="max-w-full max-h-full object-contain rounded-lg" />
          <button className="absolute top-4 right-4 text-white hover:text-gray-300">
            <X className="h-8 w-8" />
          </button>
        </div>
      )}
    </div>
  );
};

export default DischargeSlipModal;
