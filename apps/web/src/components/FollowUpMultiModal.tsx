import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { X, CalendarCheck, ChevronDown, ChevronUp, Loader, CheckCircle, AlertTriangle, Save, Plus } from 'lucide-react';
import { usePatientData, type FollowUpAppointment } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import InstitutionAutocomplete from './InstitutionAutocomplete';
import DateInput from './DateInput';
import { getMedicationSettings, getMedicationSettingsFromDB, type MedicationSettingsData } from '../utils/medicationSettings';
import { isDuplicateFollowUp } from '../utils/followUpDuplicate';

interface FollowUpEntry {
  tempId: string;
  覆診日期: string;
  覆診時間: string;
  出發時間: string;
  覆診地點: string;
  覆診專科: string;
  交通安排: string;
  陪診人員: string;
  狀態: string;
  備註: string;
}

interface FollowUpMultiModalProps {
  onClose: () => void;
  initialEntries: Record<string, unknown>[];
  matchedPatientId?: number | null;
  sourceImagePreviews?: string[];
}

const transportOptions = ['輪椅的士', '普通的士', '非緊急車', '無需安排'];
const companionOptions = ['家人', '陪診員', '無需陪診'];
const statusOptions = ['尚未安排', '已安排', '已完成', '改期', '取消'];
const autoStatusOptions = ['', '尚未安排', '已安排'];

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const timeStr = (v: unknown): string => str(v).slice(0, 5);

const toEntry = (r: Record<string, unknown>): FollowUpEntry => ({
  tempId: Math.random().toString(36).slice(2, 10),
  覆診日期: str(r['覆診日期']),
  覆診時間: timeStr(r['覆診時間']),
  出發時間: timeStr(r['出發時間']),
  覆診地點: str(r['覆診地點']),
  覆診專科: str(r['覆診專科']),
  交通安排: '',
  陪診人員: '',
  狀態: '',
  // OCR 備註不自動預填（印刷指示易誤抄），由用戶需要時手填
  備註: '',
});

const deriveStatus = (e: FollowUpEntry): string =>
  e.狀態 || (e.交通安排.trim() && e.陪診人員.trim() ? '已安排' : '尚未安排');

const missingRequired = (e: FollowUpEntry): string[] => {
  const missing: string[] = [];
  if (!e.覆診日期) missing.push('覆診日期');
  if (!e.覆診時間) missing.push('覆診時間');
  return missing;
};

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case '尚未安排': return 'bg-amber-100 text-amber-700';
    case '已安排': return 'bg-blue-100 text-blue-700';
    case '已完成': return 'bg-green-100 text-green-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const FollowUpMultiModal: React.FC<FollowUpMultiModalProps> = ({
  onClose,
  initialEntries,
  matchedPatientId,
  sourceImagePreviews,
}) => {
  const { addFollowUpAppointment, followUpAppointments } = usePatientData();

  const initialMappedRef = useRef<FollowUpEntry[] | null>(null);
  if (!initialMappedRef.current) initialMappedRef.current = initialEntries.map(toEntry);
  const [entries, setEntries] = useState<FollowUpEntry[]>(initialMappedRef.current);
  const [院友id, set院友id] = useState<number | null>(matchedPatientId ?? null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    initialMappedRef.current!.forEach((e, i) => {
      if (i === 0 || missingRequired(e).length > 0) ids.add(e.tempId);
    });
    return ids;
  });
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [forceAddIds, setForceAddIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [batchResult, setBatchResult] = useState<{ saved: number; failed: number } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const [medSettings, setMedSettings] = useState<MedicationSettingsData>(() => getMedicationSettings());
  useEffect(() => { getMedicationSettingsFromDB().then(setMedSettings).catch(() => {}); }, []);

  const duplicateMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    entries.forEach(e => {
      map[e.tempId] = isDuplicateFollowUp(followUpAppointments, {
        院友id,
        覆診日期: e.覆診日期,
        覆診時間: e.覆診時間,
        覆診地點: e.覆診地點,
      });
    });
    return map;
  }, [entries, 院友id, followUpAppointments]);

  const isExcludedDuplicate = (tempId: string) => !!duplicateMap[tempId] && !forceAddIds.has(tempId);
  const excludedDuplicateCount = entries.filter(e => isExcludedDuplicate(e.tempId)).length;
  const savableCount = entries.length - excludedDuplicateCount;

  const toggleForceAdd = useCallback((tempId: string) => {
    setForceAddIds(prev => {
      const n = new Set(prev);
      if (n.has(tempId)) n.delete(tempId); else n.add(tempId);
      return n;
    });
  }, []);

  const updateEntry = useCallback((tempId: string, updates: Partial<FollowUpEntry>) => {
    setEntries(prev => prev.map(e => {
      if (e.tempId !== tempId) return e;
      const next = { ...e, ...updates };
      if (('交通安排' in updates || '陪診人員' in updates) && autoStatusOptions.includes(next.狀態)) {
        next.狀態 = next.交通安排.trim() && next.陪診人員.trim() ? '已安排' : '尚未安排';
      }
      return next;
    }));
    setRowErrors(prev => { const n = { ...prev }; delete n[tempId]; return n; });
  }, []);

  const deleteEntry = useCallback((tempId: string) => {
    setEntries(prev => prev.filter(e => e.tempId !== tempId));
    setRowErrors(prev => { const n = { ...prev }; delete n[tempId]; return n; });
  }, []);

  const addBlankEntry = useCallback(() => {
    const entry = toEntry({});
    setEntries(prev => [...prev, entry]);
    setExpandedIds(prev => new Set(prev).add(entry.tempId));
  }, []);

  const toggleExpanded = useCallback((tempId: string) => {
    setExpandedIds(prev => {
      const n = new Set(prev);
      if (n.has(tempId)) n.delete(tempId); else n.add(tempId);
      return n;
    });
  }, []);

  const validateEntry = (e: FollowUpEntry): string | null => {
    if (!院友id) return '必須選擇院友';
    const missing = missingRequired(e);
    if (missing.length > 0) return `缺少必填欄位：${missing.join('、')}`;
    return null;
  };

  const buildAppointment = (e: FollowUpEntry): Omit<FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'> => ({
    院友id: 院友id!,
    覆診日期: e.覆診日期,
    出發時間: e.出發時間 || null,
    覆診時間: e.覆診時間 || null,
    覆診地點: e.覆診地點 || null,
    覆診專科: e.覆診專科 || null,
    交通安排: e.交通安排 || null,
    陪診人員: e.陪診人員 || null,
    備註: e.備註 || null,
    狀態: deriveStatus(e) as FollowUpAppointment['狀態'],
  } as Omit<FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>);

  const duplicateLabel = (e: FollowUpEntry): string =>
    `${e.覆診日期}${e.覆診時間 ? ` ${e.覆診時間}` : ''} · ${e.覆診地點 || '未填地點'}`;

  const handleSaveEntry = useCallback(async (entry: FollowUpEntry) => {
    const err = validateEntry(entry);
    if (err) {
      setRowErrors(prev => ({ ...prev, [entry.tempId]: err }));
      return;
    }
    if (isExcludedDuplicate(entry.tempId)) {
      if (!window.confirm(`此覆診已存在（${duplicateLabel(entry)}），仍要新增嗎？`)) return;
    }
    setSavingIds(prev => new Set(prev).add(entry.tempId));
    try {
      await addFollowUpAppointment(buildAppointment(entry));
      setEntries(prev => prev.filter(e => e.tempId !== entry.tempId));
      setBatchResult(prev => ({ saved: (prev?.saved ?? 0) + 1, failed: prev?.failed ?? 0 }));
    } catch (e: any) {
      setRowErrors(prev => ({ ...prev, [entry.tempId]: e?.message || '儲存失敗' }));
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(entry.tempId); return n; });
    }
  }, [addFollowUpAppointment, 院友id, duplicateMap, forceAddIds]);

  const handleSaveBatch = useCallback(async () => {
    let saved = 0, failed = 0;
    const toSave = [...entries];
    for (const entry of toSave) {
      if (isExcludedDuplicate(entry.tempId)) continue;
      const err = validateEntry(entry);
      if (err) { failed++; setRowErrors(prev => ({ ...prev, [entry.tempId]: err })); continue; }
      setSavingIds(prev => new Set(prev).add(entry.tempId));
      try {
        await addFollowUpAppointment(buildAppointment(entry));
        saved++;
        setEntries(prev => prev.filter(e => e.tempId !== entry.tempId));
      } catch {
        failed++;
        setRowErrors(prev => ({ ...prev, [entry.tempId]: '儲存失敗' }));
      } finally {
        setSavingIds(prev => { const n = new Set(prev); n.delete(entry.tempId); return n; });
      }
    }
    setBatchResult({ saved, failed });
  }, [entries, addFollowUpAppointment, 院友id, duplicateMap, forceAddIds]);

  const incompleteCount = entries.filter(e => missingRequired(e).length > 0).length;

  const summaryOf = (e: FollowUpEntry): string =>
    [`${e.覆診日期 || '未填日期'}${e.覆診時間 ? ` ${e.覆診時間}` : ''}`, e.覆診地點, e.覆診專科]
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl my-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><CalendarCheck className="h-5 w-5 text-blue-600" /></div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">覆診批量識別核對</h2>
              <p className="text-xs text-gray-500">請逐項核對識別結果，修正後儲存；交通／陪診可在此一併安排</p>
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
          {/* 院友列（全部條目共用） */}
          <div className="flex flex-wrap items-end gap-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex-1 min-w-[260px]">
              <label className="form-label">院友 *（全部條目共用）</label>
              <PatientAutocomplete
                value={院友id ?? ''}
                onChange={id => set院友id(id ? Number(id) : null)}
                placeholder="搜索院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
            </div>
            <div className="text-xs text-blue-700 pb-2">
              {matchedPatientId ? '由 OCR 姓名／身份證自動匹配 · 如識別錯誤請在此更正' : '未能自動匹配院友，請手動選擇'}
            </div>
          </div>

          {/* 總覽列 */}
          {entries.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                識別結果（共 {entries.length} 項覆診，可編輯後儲存）
                {excludedDuplicateCount > 0 && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">· {excludedDuplicateCount} 項重複已剔除</span>
                )}
                {incompleteCount > 0 && (
                  <span className="ml-2 text-xs text-red-600 font-normal">⚠ {incompleteCount} 項缺少必填欄位</span>
                )}
              </span>
              <button onClick={addBlankEntry} className="btn-secondary text-sm flex items-center gap-1">
                <Plus className="h-4 w-4" />新增空白項
              </button>
            </div>
          )}

          {/* 批量結果 */}
          {batchResult && entries.length > 0 && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${batchResult.failed ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span>已儲存 {batchResult.saved} 筆{batchResult.failed > 0 ? `，${batchResult.failed} 筆失敗（請逐項確認錯誤）` : ''}</span>
            </div>
          )}

          {/* 條目卡片列表 */}
          <div className="space-y-3">
            {entries.map((entry, idx) => {
              const missing = missingRequired(entry);
              const hasError = missing.length > 0;
              const rowErr = rowErrors[entry.tempId];
              const isSaving = savingIds.has(entry.tempId);
              const isExpanded = expandedIds.has(entry.tempId);
              const status = deriveStatus(entry);
              const isDupExcluded = isExcludedDuplicate(entry.tempId);
              return (
                <div
                  key={entry.tempId}
                  className={`rounded-lg ${hasError ? 'border-2 border-red-300' : 'border border-gray-200'}`}
                >
                  {/* 卡片頂行 */}
                  <div
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                      isExpanded
                        ? hasError
                          ? 'bg-red-50 border-b border-red-200 rounded-t-lg'
                          : 'bg-gray-50 border-b border-gray-200 rounded-t-lg'
                        : 'rounded-lg hover:bg-gray-50'
                    }`}
                    onClick={() => toggleExpanded(entry.tempId)}
                  >
                    <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{summaryOf(entry)}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadgeClass(status)}`}>{status}</span>
                    {hasError ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">⚠ 缺{missing.join('、')}</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">資料完整</span>
                    )}
                    {isDupExcluded && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 flex-shrink-0">已存在</span>
                    )}
                    {duplicateMap[entry.tempId] && (
                      <label
                        className="flex items-center gap-1 text-xs text-blue-600 flex-shrink-0 cursor-pointer"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={forceAddIds.has(entry.tempId)}
                          onChange={() => toggleForceAdd(entry.tempId)}
                          className="rounded border-gray-300"
                        />
                        仍要新增
                      </label>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* 卡片內容 */}
                  {isExpanded && (
                    <div className={`p-4 grid grid-cols-1 md:grid-cols-4 gap-3 ${isDupExcluded ? 'opacity-60' : ''}`}>
                      <div>
                        <label className={`form-label ${!entry.覆診日期 ? 'text-red-600' : ''}`}>覆診日期 *</label>
                        <DateInput
                          value={entry.覆診日期}
                          onChange={value => updateEntry(entry.tempId, { 覆診日期: value })}
                          className={`form-input ${!entry.覆診日期 ? '!border-red-400' : ''}`}
                        />
                        {!entry.覆診日期 && <p className="text-[11px] text-red-600 mt-0.5">⚠ 未能識別，請手動填寫</p>}
                      </div>
                      <div>
                        <label className={`form-label ${!entry.覆診時間 ? 'text-red-600' : ''}`}>覆診時間 *</label>
                        <input
                          type="time"
                          value={entry.覆診時間}
                          onChange={e => updateEntry(entry.tempId, { 覆診時間: e.target.value })}
                          className={`form-input ${!entry.覆診時間 ? '!border-red-400' : ''}`}
                        />
                        {!entry.覆診時間 && <p className="text-[11px] text-red-600 mt-0.5">⚠ 未能識別，請手動填寫</p>}
                      </div>
                      <div>
                        <label className="form-label">出發時間</label>
                        <input
                          type="time"
                          value={entry.出發時間}
                          onChange={e => updateEntry(entry.tempId, { 出發時間: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">狀態</label>
                        <select
                          value={status}
                          onChange={e => updateEntry(entry.tempId, { 狀態: e.target.value })}
                          className="form-input"
                        >
                          {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="form-label">覆診地點</label>
                        <InstitutionAutocomplete
                          value={entry.覆診地點}
                          onChange={v => updateEntry(entry.tempId, { 覆診地點: v })}
                          medSettings={medSettings}
                          className="form-input"
                          placeholder="輸入中文名或英文簡稱搜索…"
                          emptyHint="清單以外的地點可直接輸入任意名稱"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="form-label">覆診專科</label>
                        <input
                          type="text"
                          value={entry.覆診專科}
                          onChange={e => updateEntry(entry.tempId, { 覆診專科: e.target.value })}
                          className="form-input"
                          placeholder="如：內科、眼科、骨科等"
                        />
                      </div>
                      <div>
                        <label className="form-label">交通安排</label>
                        <select
                          value={entry.交通安排}
                          onChange={e => updateEntry(entry.tempId, { 交通安排: e.target.value })}
                          className="form-input"
                        >
                          <option value="">請選擇</option>
                          {transportOptions.map(o => <option key={o} value={o}>{o}</option>)}
                          {entry.交通安排 && !transportOptions.includes(entry.交通安排) && (
                            <option value={entry.交通安排}>{entry.交通安排}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">陪診人員</label>
                        <select
                          value={entry.陪診人員}
                          onChange={e => updateEntry(entry.tempId, { 陪診人員: e.target.value })}
                          className="form-input"
                        >
                          <option value="">請選擇</option>
                          {companionOptions.map(o => <option key={o} value={o}>{o}</option>)}
                          {entry.陪診人員 && !companionOptions.includes(entry.陪診人員) && (
                            <option value={entry.陪診人員}>{entry.陪診人員}</option>
                          )}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="form-label">備註</label>
                        <input
                          type="text"
                          value={entry.備註}
                          onChange={e => updateEntry(entry.tempId, { 備註: e.target.value })}
                          className="form-input"
                          placeholder="便條上的印刷指示"
                        />
                      </div>
                      <div className="md:col-span-4 flex items-center justify-between gap-2">
                        {rowErr ? (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5" />{rowErr}
                          </span>
                        ) : <span />}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => deleteEntry(entry.tempId)}
                            className="text-sm text-red-600 hover:text-red-700 px-3 py-1.5"
                          >
                            刪除此項
                          </button>
                          <button
                            onClick={() => handleSaveEntry(entry)}
                            disabled={isSaving || hasError}
                            className="btn-primary text-sm !bg-green-600 hover:!bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            儲存此項
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 完成態 */}
          {entries.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-400" />
              <p className="text-sm">所有記錄已儲存完成</p>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        {entries.length > 0 && (
          <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-200 bg-white rounded-b-lg">
            <span className="text-xs text-gray-500">儲存後每項覆診會各自成為一筆覆診記錄（與單份表單寫入同一資料表）</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary text-sm">取消</button>
              <button
                onClick={handleSaveBatch}
                disabled={savableCount === 0 || savingIds.size > 0 || !院友id}
                className="btn-primary text-sm !bg-green-600 hover:!bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {savableCount === 0 ? (
                  '全部已存在'
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    批量儲存全部（{savableCount} 項{excludedDuplicateCount > 0 ? `，已剔除 ${excludedDuplicateCount} 項重複` : ''}）
                  </>
                )}
              </button>
            </div>
          </div>
        )}
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

export default FollowUpMultiModal;
