import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Pill, ChevronDown, ChevronUp, Loader, CheckCircle, AlertTriangle, Save, Plus, Trash2 } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import DrugAutocomplete from './DrugAutocomplete';
import InstitutionAutocomplete from './InstitutionAutocomplete';
import DateInput from './DateInput';
import { mapOCRDataToPrescriptionForm } from '../utils/ocrFieldMapper';
import { getMedicationSettings, getMedicationSettingsFromDB, type MedicationSettingsData } from '../utils/medicationSettings';
import { computeEstimatedEndDate } from '../utils/estimatedEndDate';
import { toMealTimingPayload, type MealTimings } from '../utils/mealTiming';
import { compressToJpegBlob, uploadImage } from '../utils/storageUpload';
import { PRESCRIPTION_IMAGES_BUCKET } from '../utils/patientPhotoUpload';

export interface PrescriptionEntry {
  tempId: string;
  /** 來源圖片 index（records 來自同一圖則共用該圖）；null = 無來源圖 */
  sourceImageIndex: number | null;
  medication_name: string;
  medication_source: string;
  medication_quantity: string;
  prescription_date: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  duration_days: string;
  dosage_form: string;
  administration_route: string;
  dosage_amount: string;
  dosage_unit: string;
  special_dosage_instruction: string;
  daily_frequency: number;
  frequency_type: string;
  frequency_value: number | '';
  specific_weekdays: number[];
  is_odd_even_day: string;
  medication_time_slots: string[];
  meal_timings: MealTimings;
  is_prn: boolean;
  notes: string;
  /** 檢測項（預設 []；出院紙條件式指示會預填） */
  inspection_rules: any[];
}

interface PrescriptionMultiModalProps {
  onClose: () => void;
  initialEntries: Record<string, unknown>[];
  matchedPatientId?: number | null;
  sourceImagePreviews?: string[];
  sourceImageFiles?: File[];
}

const LAST_RX_KEY = (patientId: string | number) => `care_suite_last_rx_${patientId}`;

const getHongKongDate = () => {
  const now = new Date();
  const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return hongKongTime.toISOString().split('T')[0];
};

const getHongKongTime = () => {
  const now = new Date();
  const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return hongKongTime.toISOString().split('T')[1].slice(0, 5);
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));

/** 藥名正規化（大寫、去空白），用於藥物資料庫同名查詢 */
const normalizeDrugName = (s: string): string => s.toUpperCase().replace(/\s+/g, '');

const toEntry = (
  r: Record<string, unknown>,
  mealTimingOptions: string[],
): PrescriptionEntry => {
  // __sourceImageIndex 由 OCRPrescriptionBlock 聚合時標記（records 來自同一圖共用該圖）
  const idxRaw = r.__sourceImageIndex;
  const sourceImageIndex = typeof idxRaw === 'number' ? idxRaw : null;
  const { formData: m } = mapOCRDataToPrescriptionForm(r as any, {}, [], mealTimingOptions);
  const prescriptionDate = m.prescription_date || getHongKongDate();
  return {
    tempId: Math.random().toString(36).slice(2, 10),
    sourceImageIndex,
    medication_name: m.medication_name || '',
    medication_source: m.medication_source || '',
    medication_quantity: str(m.medication_quantity),
    prescription_date: prescriptionDate,
    start_date: m.start_date || prescriptionDate,
    start_time: getHongKongTime(),
    end_date: m.end_date || '',
    end_time: m.end_time || '',
    duration_days: str(m.duration_days),
    dosage_form: m.dosage_form || '',
    administration_route: m.administration_route || '',
    dosage_amount: str(m.dosage_amount),
    dosage_unit: m.dosage_unit || '',
    special_dosage_instruction: m.special_dosage_instruction || '',
    daily_frequency: m.daily_frequency ?? 1,
    frequency_type: m.frequency_type || 'daily',
    frequency_value: m.frequency_value ?? 1,
    specific_weekdays: m.specific_weekdays ?? [],
    is_odd_even_day: m.is_odd_even_day || 'none',
    medication_time_slots: m.medication_time_slots ?? [],
    meal_timings: m.meal_timings ?? { slots: [], connectors: [] },
    is_prn: m.is_prn ?? false,
    notes: m.notes || '',
    inspection_rules: [],
  };
};
export { toEntry as toPrescriptionEntry };

/** 必填：藥物名稱；「服用份量」與「特殊用法」至少要有一項（與單份表單一致） */
const missingRequired = (e: PrescriptionEntry): string[] => {
  const missing: string[] = [];
  if (!e.medication_name.trim()) missing.push('藥物名稱');
  if (!e.dosage_amount.trim() && !e.special_dosage_instruction.trim()) missing.push('服用份量/特殊用法');
  return missing;
};

const summaryOf = (e: PrescriptionEntry): string =>
  [
    e.medication_name || '未填藥物名稱',
    `${e.dosage_amount}${e.dosage_unit}`.trim() || e.special_dosage_instruction,
    e.is_prn ? '需要時' : e.daily_frequency > 0 ? `每日${e.daily_frequency}次` : '',
  ]
    .filter(Boolean)
    .join(' · ');

export { missingRequired as missingPrescriptionRequired, summaryOf as prescriptionEntrySummary };

/** 仿 PrescriptionModal.handleSubmit 的 prescriptionData 組裝（新增處方路徑） */
export const buildPrescriptionEntryData = (e: PrescriptionEntry, patientId: number): any => {
  // 劑型連動備藥方式（同單份表單）
  const immediatePreparationForms = ['藥水', '注射劑', '外用藥膏', '滴劑', '皮膚貼劑'];
  const preparation_method = immediatePreparationForms.includes(e.dosage_form) ? 'immediate' : 'advanced';

  const estimatedEndDate = computeEstimatedEndDate({
    prescription_date: e.prescription_date,
    end_date: e.end_date,
    medication_quantity: e.medication_quantity,
    dosage_amount: e.dosage_amount,
    daily_frequency: e.daily_frequency,
    medication_time_slots: e.medication_time_slots,
    frequency_type: e.frequency_type,
    frequency_value: e.frequency_value === '' ? null : e.frequency_value,
    specific_weekdays: e.specific_weekdays,
    is_odd_even_day: e.is_odd_even_day,
  });

  const data: any = {
    patient_id: patientId,
    medication_name: e.medication_name,
    medication_source: e.medication_source,
    medication_source_specialty: null,
    medication_quantity: e.medication_quantity === '' ? null : String(e.medication_quantity),
    estimated_end_date: estimatedEndDate || null,
    prescription_date: e.prescription_date,
    start_date: e.start_date,
    start_time: e.start_time,
    end_date: e.end_date || null,
    end_time: e.end_time || null,
    last_taken_date: null,
    show_last_taken_in_record: false,
    duration_days: e.duration_days === '' ? null : parseInt(e.duration_days, 10),
    dosage_form: e.dosage_form,
    administration_route: e.administration_route,
    dosage_amount: e.dosage_amount === '' ? null : String(e.dosage_amount),
    dosage_unit: e.dosage_unit,
    special_dosage_instruction: e.special_dosage_instruction,
    daily_frequency: e.frequency_type === 'each_time' ? null : e.daily_frequency,
    frequency_type: e.frequency_type,
    frequency_value: e.frequency_value === '' ? null : parseInt(String(e.frequency_value), 10),
    specific_weekdays: e.specific_weekdays,
    is_odd_even_day: e.is_odd_even_day,
    medication_time_slots: e.frequency_type === 'each_time' ? [] : e.medication_time_slots,
    ...toMealTimingPayload(e.meal_timings),
    is_prn: e.is_prn,
    preparation_method,
    status: 'pending_change',
    notes: e.notes,
    is_long_term: !e.end_date,
    inspection_rules: (e.inspection_rules || [])
      .filter((rule: any) => rule && rule.vital_sign_type && rule.condition_operator && String(rule.condition_value ?? '') !== '')
      .map((rule: any) => ({ ...rule, condition_value: parseFloat(String(rule.condition_value)) })),
  };
  Object.keys(data).forEach(key => {
    if (data[key] === undefined) delete data[key];
  });
  return data;
};

/** 每筆處方各自上傳來源圖（共用一圖時逐筆上傳同一 File，各自 object，語意最簡單）；失敗唔阻儲存 */
export const uploadPrescriptionEntryImage = async (
  e: PrescriptionEntry,
  sourceImageFiles?: File[],
  sourceImagePreviews?: string[],
): Promise<string | null> => {
  // 無標記來源（例如 AI 助護單圖多藥）但只有一張來源圖時，視為全部來自該圖
  const idx = e.sourceImageIndex ?? (sourceImagePreviews?.length === 1 ? 0 : null);
  if (idx == null) return null;
  const source = sourceImageFiles?.[idx] ?? sourceImagePreviews?.[idx];
  if (!source) return null;
  try {
    const blob = await compressToJpegBlob(source, 1536, 0.9);
    return await uploadImage(PRESCRIPTION_IMAGES_BUCKET, blob);
  } catch (err) {
    console.error('處方圖片上傳失敗:', err);
    return null;
  }
};

/** 儲存單筆處方 entry：組裝資料 → 上傳來源圖 → addPrescription → 記低常用欄位（同單份表單） */
export const savePrescriptionEntry = async (
  entry: PrescriptionEntry,
  patientId: number,
  addPrescription: (data: any) => Promise<void>,
  sourceImageFiles?: File[],
  sourceImagePreviews?: string[],
): Promise<void> => {
  const data = buildPrescriptionEntryData(entry, patientId);
  const imageUrl = await uploadPrescriptionEntryImage(entry, sourceImageFiles, sourceImagePreviews);
  if (imageUrl) data.image_path = imageUrl;
  await addPrescription(data);
  // 同單份表單：成功新增後記低門診日期、開始日期、藥物來源
  try {
    localStorage.setItem(LAST_RX_KEY(patientId), JSON.stringify({
      prescription_date: entry.prescription_date,
      start_date: entry.start_date,
      medication_source: entry.medication_source,
    }));
  } catch { /* ignore quota errors */ }
};

/** 服用時間點編輯（chips + time input 新增），每張卡片各自實例 */
const TimeSlotEditor: React.FC<{
  slots: string[];
  onChange: (slots: string[]) => void;
}> = ({ slots, onChange }) => {
  const [newSlot, setNewSlot] = useState('');
  return (
    <div>
      {slots.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-2">
          {slots.map(slot => (
            <span
              key={slot}
              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-yellow-300 rounded-lg text-sm font-medium text-gray-900"
            >
              {slot}
              <button
                type="button"
                onClick={() => onChange(slots.filter(s => s !== slot))}
                className="text-red-600 hover:text-red-800"
                title="移除此時間"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-2">尚未設定服用時間</p>
      )}
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={newSlot}
          onChange={e => setNewSlot(e.target.value)}
          className="form-input h-8 w-36"
        />
        <button
          type="button"
          onClick={() => {
            if (newSlot && !slots.includes(newSlot)) {
              onChange([...slots, newSlot].sort());
              setNewSlot('');
            }
          }}
          disabled={!newSlot || slots.includes(newSlot)}
          className="btn-secondary flex items-center gap-1 h-8 px-3 text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>新增時間</span>
        </button>
      </div>
    </div>
  );
};

const PrescriptionMultiModal: React.FC<PrescriptionMultiModalProps> = ({
  onClose,
  initialEntries,
  matchedPatientId,
  sourceImagePreviews,
  sourceImageFiles,
}) => {
  const { addPrescription, patients, drugDatabase } = usePatientData();

  const [medSettings, setMedSettings] = useState<MedicationSettingsData>(() => getMedicationSettings());
  useEffect(() => { getMedicationSettingsFromDB().then(setMedSettings).catch(() => {}); }, []);

  const initialMappedRef = useRef<PrescriptionEntry[] | null>(null);
  if (!initialMappedRef.current) {
    initialMappedRef.current = initialEntries.map(r => toEntry(r, getMedicationSettings().服用時段));
  }
  const [entries, setEntries] = useState<PrescriptionEntry[]>(initialMappedRef.current);

  // 藥物資料庫載入後（含初始化時已載入）：entry 劑型為空且庫內同名藥有預設劑型 → 預填（可編輯）
  useEffect(() => {
    if (!drugDatabase?.length) return;
    setEntries(prev => {
      let changed = false;
      const next = prev.map(e => {
        if (e.dosage_form.trim() || !e.medication_name.trim()) return e;
        const key = normalizeDrugName(e.medication_name);
        const drug = drugDatabase.find((d: any) => normalizeDrugName(d.drug_name || '') === key);
        if (!drug?.dosage_form) return e;
        changed = true;
        return { ...e, dosage_form: drug.dosage_form };
      });
      return changed ? next : prev;
    });
  }, [drugDatabase]);
  // 未提供 matchedPatientId 時，用第一筆的院友姓名經現行 mapper 匹配邏輯補匹配
  const [院友id, set院友id] = useState<number | null>(() => {
    if (matchedPatientId != null) return matchedPatientId;
    const first = initialEntries[0];
    if (first && patients?.length) {
      const { formData: m } = mapOCRDataToPrescriptionForm(first as any, {}, patients, getMedicationSettings().服用時段);
      const pid = m.patient_id ? Number(m.patient_id) : NaN;
      if (Number.isFinite(pid)) return pid;
    }
    return null;
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    initialMappedRef.current!.forEach((e, i) => {
      if (i === 0 || missingRequired(e).length > 0) ids.add(e.tempId);
    });
    return ids;
  });
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [batchResult, setBatchResult] = useState<{ saved: number; failed: number } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const updateEntry = useCallback((tempId: string, updates: Partial<PrescriptionEntry>) => {
    setEntries(prev => prev.map(e => (e.tempId === tempId ? { ...e, ...updates } : e)));
    setRowErrors(prev => { const n = { ...prev }; delete n[tempId]; return n; });
  }, []);

  const deleteEntry = useCallback((tempId: string) => {
    setEntries(prev => prev.filter(e => e.tempId !== tempId));
    setRowErrors(prev => { const n = { ...prev }; delete n[tempId]; return n; });
  }, []);

  const addBlankEntry = useCallback(() => {
    const entry = toEntry({}, getMedicationSettings().服用時段);
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

  const validateEntry = (e: PrescriptionEntry): string | null => {
    if (!院友id) return '必須選擇院友';
    const missing = missingRequired(e);
    if (missing.length > 0) return `缺少必填欄位：${missing.join('、')}`;
    return null;
  };

  const saveOne = async (entry: PrescriptionEntry) => {
    await savePrescriptionEntry(entry, 院友id!, addPrescription, sourceImageFiles, sourceImagePreviews);
  };

  const handleSaveEntry = useCallback(async (entry: PrescriptionEntry) => {
    const err = validateEntry(entry);
    if (err) {
      setRowErrors(prev => ({ ...prev, [entry.tempId]: err }));
      return;
    }
    setSavingIds(prev => new Set(prev).add(entry.tempId));
    try {
      await saveOne(entry);
      setEntries(prev => prev.filter(e => e.tempId !== entry.tempId));
      setBatchResult(prev => ({ saved: (prev?.saved ?? 0) + 1, failed: prev?.failed ?? 0 }));
    } catch (e: any) {
      setRowErrors(prev => ({ ...prev, [entry.tempId]: e?.message || '儲存失敗' }));
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(entry.tempId); return n; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addPrescription, 院友id, sourceImageFiles, sourceImagePreviews]);

  const handleSaveBatch = useCallback(async () => {
    let saved = 0, failed = 0;
    const toSave = [...entries];
    for (const entry of toSave) {
      const err = validateEntry(entry);
      if (err) { failed++; setRowErrors(prev => ({ ...prev, [entry.tempId]: err })); continue; }
      setSavingIds(prev => new Set(prev).add(entry.tempId));
      try {
        await saveOne(entry);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, addPrescription, 院友id, sourceImageFiles, sourceImagePreviews]);

  const incompleteCount = entries.filter(e => missingRequired(e).length > 0).length;
  const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

  return (
    // 根節點 stopPropagation：此 modal 可能疊加喺 PrescriptionModal 之上，
    // 避免點擊 backdrop 的 onClick 穿透關閉底層表單
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div className="bg-white rounded-lg w-full max-w-6xl my-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><Pill className="h-5 w-5 text-blue-600" /></div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">處方批量識別核對</h2>
              <p className="text-xs text-gray-500">請逐項核對識別結果，修正後儲存；每項藥物會各自成為一筆處方記錄</p>
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
              {院友id ? '由 OCR 姓名自動匹配 · 如識別錯誤請在此更正' : '未能自動匹配院友，請手動選擇'}
            </div>
          </div>

          {/* 總覽列 */}
          {entries.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                識別結果（共 {entries.length} 項藥物，可編輯後儲存）
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
                    {hasError ? (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">⚠ 缺{missing.join('、')}</span>
                    ) : (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">資料完整</span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* 卡片內容 */}
                  {isExpanded && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className={`form-label ${!entry.medication_name.trim() ? 'text-red-600' : ''}`}>藥物名稱 *</label>
                        <DrugAutocomplete
                          value={entry.medication_name}
                          onChange={(drugName, drugData) =>
                            updateEntry(entry.tempId, {
                              medication_name: drugName,
                              dosage_form: drugData?.dosage_form || entry.dosage_form,
                              dosage_unit: drugData?.unit || entry.dosage_unit,
                              administration_route: drugData?.administration_route || entry.administration_route,
                              special_dosage_instruction: drugData?.special_dosage_instruction || entry.special_dosage_instruction,
                            })
                          }
                          placeholder="搜索或輸入藥物名稱..."
                        />
                        {!entry.medication_name.trim() && <p className="text-[11px] text-red-600 mt-0.5">⚠ 未能識別，請手動填寫</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="form-label">藥物來源</label>
                        <InstitutionAutocomplete
                          value={entry.medication_source}
                          onChange={v => updateEntry(entry.tempId, { medication_source: v })}
                          medSettings={medSettings}
                          className="form-input"
                          placeholder="輸入中文名或英文簡稱搜索…"
                          emptyHint="清單以外的來源可直接輸入任意名稱"
                        />
                      </div>
                      <div>
                        <label className="form-label">藥物數量</label>
                        <input
                          type="number"
                          value={entry.medication_quantity}
                          onChange={e => updateEntry(entry.tempId, { medication_quantity: e.target.value })}
                          className="form-input"
                          placeholder="例如：30"
                          min="0"
                          step="0.5"
                        />
                      </div>
                      <div>
                        <label className="form-label">處方日期</label>
                        <DateInput
                          value={entry.prescription_date}
                          onChange={value => updateEntry(entry.tempId, { prescription_date: value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">開始日期</label>
                        <DateInput
                          value={entry.start_date}
                          onChange={value => updateEntry(entry.tempId, { start_date: value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">服用日數</label>
                        <input
                          type="number"
                          value={entry.duration_days}
                          onChange={e => updateEntry(entry.tempId, { duration_days: e.target.value })}
                          className="form-input"
                          placeholder="例如：7"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="form-label">結束日期</label>
                        <DateInput
                          value={entry.end_date}
                          onChange={value => updateEntry(entry.tempId, { end_date: value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">結束時間</label>
                        <input
                          type="time"
                          value={entry.end_time}
                          onChange={e => updateEntry(entry.tempId, { end_time: e.target.value })}
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="form-label">劑型</label>
                        <select
                          value={entry.dosage_form}
                          onChange={e => updateEntry(entry.tempId, { dosage_form: e.target.value })}
                          className="form-input"
                        >
                          <option value="">請選擇劑型</option>
                          {medSettings.劑型.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">服用途徑</label>
                        <select
                          value={entry.administration_route}
                          onChange={e => updateEntry(entry.tempId, { administration_route: e.target.value })}
                          className="form-input"
                        >
                          <option value="">請選擇途徑</option>
                          {medSettings.服用途徑.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={`form-label ${!entry.dosage_amount.trim() && !entry.special_dosage_instruction.trim() ? 'text-red-600' : ''}`}>服用份量</label>
                        <input
                          type="number"
                          value={entry.dosage_amount}
                          onChange={e => updateEntry(entry.tempId, { dosage_amount: e.target.value })}
                          className={`form-input ${!entry.dosage_amount.trim() && !entry.special_dosage_instruction.trim() ? '!border-red-400' : ''}`}
                          placeholder="1"
                          min="0.25"
                          step="0.25"
                        />
                      </div>
                      <div>
                        <label className="form-label">單位</label>
                        <select
                          value={entry.dosage_unit}
                          onChange={e => updateEntry(entry.tempId, { dosage_unit: e.target.value })}
                          className="form-input"
                        >
                          <option value="">請選擇單位</option>
                          {medSettings.服用單位.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">特殊用法</label>
                        <select
                          value={entry.special_dosage_instruction}
                          onChange={e => updateEntry(entry.tempId, { special_dosage_instruction: e.target.value })}
                          className="form-input"
                        >
                          <option value="">無</option>
                          {medSettings.特殊用法.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="form-label">服用時段</label>
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.meal_timings.slots.map((slot, slotIdx) => (
                            <span key={slotIdx} className="inline-flex items-center gap-1">
                              <select
                                value={slot}
                                onChange={e => {
                                  const slots = [...entry.meal_timings.slots];
                                  slots[slotIdx] = e.target.value;
                                  updateEntry(entry.tempId, { meal_timings: { ...entry.meal_timings, slots } });
                                }}
                                className="form-input h-8 w-32"
                              >
                                <option value="">時段{slotIdx + 1}</option>
                                {medSettings.服用時段.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const mt = entry.meal_timings;
                                  const slots = mt.slots.filter((_, i) => i !== slotIdx);
                                  const connectors = mt.connectors.filter((_, i) => i !== slotIdx - 1);
                                  updateEntry(entry.tempId, { meal_timings: { ...mt, slots, connectors } });
                                }}
                                className="text-red-600 hover:text-red-800"
                                title="移除此時段"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const mt = entry.meal_timings;
                              updateEntry(entry.tempId, {
                                meal_timings: {
                                  ...mt,
                                  slots: [...mt.slots, ''],
                                  connectors: mt.slots.length > 0 ? [...mt.connectors, '或'] : mt.connectors,
                                },
                              });
                            }}
                            className="btn-secondary flex items-center gap-1 text-sm h-8"
                          >
                            <Plus className="h-4 w-4" />
                            <span>新增時段</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="form-label">頻率類型</label>
                        <select
                          value={entry.frequency_type}
                          onChange={e => updateEntry(entry.tempId, { frequency_type: e.target.value })}
                          className="form-input"
                        >
                          <option value="daily">每日服</option>
                          <option value="every_x_days">每N日服</option>
                          <option value="odd_even_days">單日/雙日服</option>
                          <option value="every_x_weeks">每N週服</option>
                          <option value="weekly_days">逢週N服</option>
                          <option value="every_x_months">每N月服</option>
                          <option value="hourly">每N小時</option>
                          <option value="each_time">每次</option>
                        </select>
                      </div>
                      {(entry.frequency_type === 'every_x_days' ||
                        entry.frequency_type === 'every_x_weeks' ||
                        entry.frequency_type === 'every_x_months' ||
                        entry.frequency_type === 'hourly') && (
                        <div>
                          <label className="form-label">
                            {entry.frequency_type === 'every_x_days' && '間隔天數'}
                            {entry.frequency_type === 'every_x_weeks' && '間隔週數'}
                            {entry.frequency_type === 'every_x_months' && '間隔月數'}
                            {entry.frequency_type === 'hourly' && '間隔時數'}
                          </label>
                          <input
                            type="number"
                            value={entry.frequency_value}
                            onChange={e => updateEntry(entry.tempId, { frequency_value: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                            className="form-input"
                            min="1"
                          />
                        </div>
                      )}
                      {entry.frequency_type === 'odd_even_days' && (
                        <div>
                          <label className="form-label">單日/雙日</label>
                          <select
                            value={entry.is_odd_even_day}
                            onChange={e => updateEntry(entry.tempId, { is_odd_even_day: e.target.value })}
                            className="form-input"
                          >
                            <option value="odd">單日</option>
                            <option value="even">雙日</option>
                          </select>
                        </div>
                      )}
                      {entry.frequency_type === 'weekly_days' && (
                        <div className="md:col-span-4">
                          <label className="form-label">選擇星期幾 *</label>
                          <div className="grid grid-cols-7 gap-2">
                            {dayNames.map((dayName, index) => (
                              <label key={index} className="flex items-center space-x-1">
                                <input
                                  type="checkbox"
                                  checked={entry.specific_weekdays.includes(index + 1)}
                                  onChange={e => {
                                    const day = index + 1;
                                    updateEntry(entry.tempId, {
                                      specific_weekdays: e.target.checked
                                        ? [...entry.specific_weekdays, day].sort()
                                        : entry.specific_weekdays.filter(d => d !== day),
                                    });
                                  }}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="text-sm">{dayName}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {entry.frequency_type !== 'each_time' && (
                        <div>
                          <label className="form-label">當日服用次數</label>
                          <input
                            type="number"
                            value={entry.daily_frequency}
                            onChange={e => {
                              const n = parseInt(e.target.value, 10);
                              updateEntry(entry.tempId, { daily_frequency: Number.isNaN(n) ? 0 : Math.max(0, Math.round(n)) });
                            }}
                            className="form-input text-center"
                            min="0"
                            step="1"
                          />
                        </div>
                      )}
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.is_prn}
                            onChange={e => updateEntry(entry.tempId, { is_prn: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          需要時 (PRN)
                        </label>
                      </div>
                      {entry.frequency_type !== 'each_time' && (
                        <div className="md:col-span-2">
                          <label className="form-label">服用時間點</label>
                          <TimeSlotEditor
                            slots={entry.medication_time_slots}
                            onChange={slots => updateEntry(entry.tempId, { medication_time_slots: slots })}
                          />
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <label className="form-label">備註</label>
                        <input
                          type="text"
                          value={entry.notes}
                          onChange={e => updateEntry(entry.tempId, { notes: e.target.value })}
                          className="form-input"
                          placeholder="標籤／處方紙上的印刷指示"
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
            <span className="text-xs text-gray-500">儲存後每項藥物會各自成為一筆處方記錄（與單份表單寫入同一資料表）</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary text-sm">取消</button>
              <button
                onClick={handleSaveBatch}
                disabled={entries.length === 0 || savingIds.size > 0 || !院友id}
                className="btn-primary text-sm !bg-green-600 hover:!bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                批量儲存全部（{entries.length} 項）
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

export default PrescriptionMultiModal;
