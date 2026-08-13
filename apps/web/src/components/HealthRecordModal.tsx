import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Activity, User, Calendar, Clock, AlertTriangle, Camera, Sparkles, ChevronDown, ChevronUp, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';
import { isInHospital } from '../utils/careRecordHelper';
import { getRecentHealthRecordsByPatient } from '../lib/database';
import type { VitalSignType, HealthRecord } from '../lib/database';
import VitalSignScanner from './VitalSignScanner';
import BedNumberImprint from './BedNumberImprint';
import type { VitalSignScanResult } from '../utils/vitalSignOcrParser';
import { generateVitalSuggestion } from '../utils/healthRecordGenerator';
import { isVirtualDataEnabled } from '../utils/toolsSettings';

const ALL_VITAL_TYPES: { type: VitalSignType; label: string; unit: string; color: string }[] = [
  { type: '血壓',   label: '血壓',   unit: 'mmHg',   color: 'bg-red-500' },
  { type: '脈搏',   label: '脈搏',   unit: '/min',   color: 'bg-pink-500' },
  { type: '體溫',   label: '體溫',   unit: '°C',     color: 'bg-orange-500' },
  { type: '血含氧量', label: '血含氧量', unit: '%',  color: 'bg-blue-500' },
  { type: '呼吸', label: '呼吸', unit: '/min', color: 'bg-teal-500' },
  { type: '血糖值', label: '血糖',   unit: 'mmol/L', color: 'bg-purple-500' },
  { type: '體重',   label: '體重',   unit: 'kg',     color: 'bg-green-500' },
];

const VITAL_TYPE_SET = new Set<string>(ALL_VITAL_TYPES.map(v => v.type));
const isVitalSignType = (t: string | null | undefined): t is VitalSignType =>
  !!t && VITAL_TYPE_SET.has(t);

interface VitalEntry { primary: string; secondary: string; }

interface HealthRecordModalProps {
  record?: HealthRecord;
  recordGroup?: HealthRecord[];
  initialData?: {
    patient?: { 院友id: number; 中文姓名?: string; 床號?: string };
    task?: { id: string; health_record_type: string; next_due_at: string; specific_times?: string[]; notes?: string | null };
    任務清單?: { id: string; health_record_type: string; notes?: string | null }[];
    預設監測類型?: VitalSignType;
    預設記錄類型?: string;
    預設日期?: string;
    預設時間?: string;
  };
  onClose: () => void;
  onTaskCompleted?: (taskId: string, recordDateTime: Date) => void;
}

// 將多段備註文字（以「；」分隔）合併並去重
const mergeNoteText = (...parts: (string | null | undefined)[]): string => {
  const seen = new Set<string>();
  parts.forEach(p => (p ?? '').split('；').map(s => s.trim()).filter(Boolean).forEach(s => seen.add(s)));
  return Array.from(seen).join('；');
};

const legacyTypeMap: Record<string, VitalSignType[]> = {
  '生命表徵': ['血壓', '脈搏', '體溫', '血含氧量', '呼吸'],
  '血糖控制': ['血糖值'],
  '體重控制': ['體重'],
};

const getInitialActiveTypes = (
  record?: HealthRecord,
  initialData?: HealthRecordModalProps['initialData'],
  recordGroup?: HealthRecord[],
): VitalSignType[] => {
  // 整列編輯：顯示全部 7 種類型，讓用戶可查閱已有值並補填缺少的種類
  if (recordGroup) return ALL_VITAL_TYPES.map(v => v.type);
  if (record) return [record.監測類型];
  // 多任務整合：同院友同時間點的多種監測類型一起輸入
  if (initialData?.任務清單 && initialData.任務清單.length > 0) {
    const types = initialData.任務清單
      .map(t => t.health_record_type)
      .filter(isVitalSignType);
    if (types.length > 0) {
      const order = ALL_VITAL_TYPES.map(v => v.type);
      return Array.from(new Set(types)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
  }
  const taskType = initialData?.task?.health_record_type;
  if (taskType && isVitalSignType(taskType)) return [taskType];
  if (initialData?.預設監測類型) return [initialData.預設監測類型];
  const old = initialData?.預設記錄類型;
  if (old && legacyTypeMap[old]) return legacyTypeMap[old];
  return [];
};

const HealthRecordModal: React.FC<HealthRecordModalProps> = ({ record, recordGroup, initialData, onClose, onTaskCompleted }) => {
  const { updateHealthRecord, addHealthRecordsForSession, deleteHealthRecord, patients, hospitalEpisodes, admissionRecords } = usePatientData();
  const { displayName } = useAuth();

  const getHKNow = () => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    const p = (n: number) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
  };

  const getDefaultDateTime = () => {
    if (record) return { date: record.記錄日期, time: record.記錄時間 };
    if (recordGroup && recordGroup.length > 0) return { date: recordGroup[0].記錄日期, time: recordGroup[0].記錄時間 };
    const src = initialData?.預設日期 || initialData?.task?.next_due_at;
    if (src) {
      const d = new Date(new Date(src).toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
      const p = (n: number) => String(n).padStart(2, '0');
      return {
        date: `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`,
        time: initialData?.預設時間 || initialData?.task?.specific_times?.[0] || `${p(d.getHours())}:${p(d.getMinutes())}`,
      };
    }
    const now = getHKNow();
    return { date: now.date, time: initialData?.預設時間 || now.time };
  };

  const initialActiveTypes = getInitialActiveTypes(record, initialData, recordGroup);
  const isTypeFixed = !!(record || recordGroup || initialData?.task || initialData?.任務清單 || initialData?.預設監測類型 || initialData?.預設記錄類型);
  const [activeTypes, setActiveTypes] = useState<VitalSignType[]>(initialActiveTypes);

  // 監測項目多選：選取/取消 血壓/脈搏/血含氧量/呼吸 時會同步四項（與任務管理 modal 一致）
  const boundVitalTypes: VitalSignType[] = ['血壓', '脈搏', '血含氧量', '呼吸'];
  const toggleVitalType = (type: VitalSignType) => {
    setActiveTypes(prev => {
      const selected = prev.includes(type);
      let next = selected ? prev.filter(t => t !== type) : [...prev, type];
      if (boundVitalTypes.includes(type)) {
        if (!selected) {
          for (const boundType of boundVitalTypes) {
            if (!next.includes(boundType)) next = [...next, boundType];
          }
        } else {
          next = next.filter(t => !boundVitalTypes.includes(t));
        }
      }
      return next;
    });
  };

  // 每種監測類型對應其 task id（多任務整合時，各筆記錄寫回各自的任務）
  const typeToTaskId = useMemo(() => {
    const m: Partial<Record<VitalSignType, string>> = {};
    initialData?.任務清單?.forEach(t => {
      if (isVitalSignType(t.health_record_type)) m[t.health_record_type] = t.id;
    });
    if (initialData?.task && isVitalSignType(initialData.task.health_record_type) && !m[initialData.task.health_record_type]) {
      m[initialData.task.health_record_type] = initialData.task.id;
    }
    // 整列編輯：從各筆現有記錄取出 任務id
    recordGroup?.forEach(r => {
      if (isVitalSignType(r.監測類型) && r.任務id && !m[r.監測類型]) {
        m[r.監測類型] = r.任務id;
      }
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 各監測類型對應其自身任務的備註（多任務整合時，各類型只繼承自己任務的備註，不會混入其他類型的備註）
  const taskNoteByType = useMemo(() => {
    const m: Partial<Record<VitalSignType, string | null | undefined>> = {};
    initialData?.任務清單?.forEach(t => {
      if (isVitalSignType(t.health_record_type)) m[t.health_record_type] = t.notes;
    });
    if (initialData?.task && isVitalSignType(initialData.task.health_record_type) && m[initialData.task.health_record_type] === undefined) {
      m[initialData.task.health_record_type] = initialData.task.notes;
    }
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultDT = getDefaultDateTime();
  const groupFirst = recordGroup?.[0];
  const [formData, setFormData] = useState({
    院友id: record?.院友id?.toString() || groupFirst?.院友id?.toString() || initialData?.patient?.院友id?.toString() || '',
    記錄日期: defaultDT.date, 記錄時間: defaultDT.time,
    備註: record?.備註 || groupFirst?.備註 || '', 記錄人員: record?.記錄人員 || groupFirst?.記錄人員 || displayName || '',
    isAbsent: !!(record?.備註?.includes('無法量度') || groupFirst?.備註?.includes('無法量度')),
    absenceReason: (record?.備註 || groupFirst?.備註)?.match(/無法量度原因:\s*(.+)/)?.[1]?.trim() || '',
  });

  const [vitalEntries, setVitalEntries] = useState<Record<string, VitalEntry>>(() => {
    const init: Record<string, VitalEntry> = {};
    if (record) {
      init[record.監測類型] = { primary: record.數值?.toString() ?? '', secondary: record.數值_副?.toString() ?? '' };
      return init;
    }
    // 整列編輯：從各筆現有記錄預填數值
    if (recordGroup && recordGroup.length > 0) {
      recordGroup.forEach(r => {
        if (isVitalSignType(r.監測類型)) {
          init[r.監測類型] = {
            primary: r.數值 != null ? r.數值.toString() : '',
            secondary: r.數值_副 != null ? r.數值_副.toString() : '',
          };
        }
      });
      return init;
    }
    // 從任務卡片開啟時，為可隨機預填的監測類型自動填入合理數值（保留原設計）
    if (initialData?.task) {
      const randomDefaults: Partial<Record<VitalSignType, string>> = {
        體溫: (Math.random() * 0.9 + 36.0).toFixed(1),
        血含氧量: Math.floor(Math.random() * 5 + 95).toString(),
        呼吸: Math.floor(Math.random() * 9 + 14).toString(),
      };
      initialActiveTypes.forEach(type => {
        const def = randomDefaults[type];
        if (def !== undefined) init[type] = { primary: def, secondary: '' };
      });
    }
    return init;
  });

  const setEntry = (type: VitalSignType, updates: Partial<VitalEntry>) =>
    setVitalEntries(prev => ({ ...prev, [type]: { ...(prev[type] ?? { primary: '', secondary: '' }), ...updates } }));

  // 智能數據生成器（保留原設計）：依歷史記錄為各監測類型生成建議值
  type GeneratorStatus = 'idle' | 'loading' | 'generated' | 'error' | 'no-data';
  const [generatorStatus, setGeneratorStatus] = useState<GeneratorStatus>('idle');
  const [isGeneratorCollapsed, setIsGeneratorCollapsed] = useState(true);
  const [generatedRecordCount, setGeneratedRecordCount] = useState(0);

  const handleGenerateData = async () => {
    if (!formData.院友id) { alert('請先選擇院友'); return; }
    setGeneratorStatus('loading');
    setIsGeneratorCollapsed(false);
    try {
      const pid = parseInt(formData.院友id);
      const updates: Record<string, VitalEntry> = {};
      let maxCount = 0;
      let filledAny = false;
      for (const type of activeTypes) {
        const recent = await getRecentHealthRecordsByPatient(pid, type, 5);
        maxCount = Math.max(maxCount, recent.length);
        const sug = generateVitalSuggestion(type, recent as any);
        if (sug?.primary) {
          updates[type] = { primary: sug.primary, secondary: sug.secondary ?? '' };
          filledAny = true;
        }
      }
      if (filledAny) {
        setVitalEntries(prev => ({ ...prev, ...updates }));
        setGeneratedRecordCount(maxCount);
        setGeneratorStatus('generated');
      } else {
        setGeneratorStatus('no-data');
      }
    } catch (e) {
      console.error('[生成器] 發生錯誤:', e);
      setGeneratorStatus('error');
    }
  };

  // 院友或監測類型改變時重置生成器
  useEffect(() => {
    setGeneratorStatus('idle');
    setGeneratedRecordCount(0);
  }, [formData.院友id, activeTypes]);

  const currentIsPatientAbsent = useMemo(() => {
    if (!formData.院友id || !formData.記錄日期 || !formData.記錄時間) return false;
    const patient = patients.find(p => p.院友id.toString() === formData.院友id);
    if (!patient) return false;
    return isInHospital(patient, formData.記錄日期, formData.記錄時間, admissionRecords, hospitalEpisodes);
  }, [formData.院友id, formData.記錄日期, formData.記錄時間, admissionRecords, hospitalEpisodes, patients]);

  useEffect(() => {
    if (record) return;
    if (currentIsPatientAbsent && !formData.isAbsent)
      setFormData(prev => ({ ...prev, isAbsent: true, absenceReason: '入院', 備註: '無法量度原因: 入院' }));
    else if (!currentIsPatientAbsent && formData.isAbsent && formData.absenceReason === '入院')
      setFormData(prev => ({ ...prev, isAbsent: false, absenceReason: '', 備註: '' }));
  }, [currentIsPatientAbsent]);

  const [showDateWarning, setShowDateWarning] = useState(false);
  const dwHandlers = useRef({ confirm: async () => {}, cancel: () => {} });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showDateWarning) onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose, showDateWarning]);

  // Enter 鍵快捷儲存（textarea/select/button 除外）
  useEffect(() => {
    if (showDateWarning) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      e.preventDefault();
      formRef.current?.requestSubmit();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showDateWarning]);

  useEffect(() => {
    if (!showDateWarning) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); dwHandlers.current.confirm(); }
      else if (e.key === 'Escape') { e.preventDefault(); dwHandlers.current.cancel(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [showDateWarning]);

  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 1024px)');
    const update = () => setIsPortrait(mq.matches); update();
    mq.addEventListener('change', update); return () => mq.removeEventListener('change', update);
  }, []);

  const [showScanner, setShowScanner] = useState(false);
  const [scanLowConfidence, setScanLowConfidence] = useState(false);
  const hasBP = activeTypes.includes('血壓');
  const hasBG = activeTypes.includes('血糖值');
  const canScan = isPortrait && !formData.isAbsent && (hasBP || hasBG);
  const scanType: '生命表徵' | '血糖控制' = hasBG && !hasBP ? '血糖控制' : '生命表徵';

  const handleScanResult = (result: VitalSignScanResult) => {
    if (result.success) {
      setVitalEntries(prev => {
        const next = { ...prev };
        const bp = next['血壓'] ?? { primary: '', secondary: '' };
        if (result.values.血壓收縮壓) next['血壓'] = { ...bp, primary: result.values.血壓收縮壓 };
        if (result.values.血壓舒張壓) next['血壓'] = { ...(next['血壓'] ?? bp), secondary: result.values.血壓舒張壓 };
        if (result.values.脈搏)   next['脈搏']   = { primary: result.values.脈搏, secondary: '' };
        if (result.values.血含氧量) next['血含氧量'] = { primary: result.values.血含氧量, secondary: '' };
        if (result.values.血糖值)   next['血糖值'] = { primary: result.values.血糖值, secondary: '' };
        return next;
      });
      setScanLowConfidence(result.lowConfidence);
    }
    setShowScanner(false);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const buildRecordForType = (type: VitalSignType): Omit<HealthRecord, '記錄id' | '建立時間'> => {
    const base = {
      院友id: parseInt(formData.院友id),
      記錄日期: formData.記錄日期,
      記錄人員: formData.記錄人員 || undefined,
    };
    return {
      ...base,
      任務id: typeToTaskId[type] ?? initialData?.task?.id ?? record?.任務id ?? undefined,
      記錄時間: type === '體重' ? '00:00' : formData.記錄時間,
      監測類型: type,
      備註: mergeNoteText(taskNoteByType[type], formData.備註) || undefined,
      數值: formData.isAbsent ? 0 : parseFloat(vitalEntries[type]?.primary || '0'),
      數值_副: type === '血壓'
        ? (formData.isAbsent ? 0 : parseFloat(vitalEntries[type]?.secondary || '0'))
        : undefined,
    };
  };

  const buildRecords = () => {
    const typesToProcess = formData.isAbsent ? activeTypes : activeTypes.filter(t => vitalEntries[t]?.primary.trim());
    return typesToProcess.map(buildRecordForType);
  };

  const doSave = async () => {
    setIsSubmitting(true);
    try {
      const records = buildRecords();
      console.log('[HealthRecordModal] built records:', records.map(r => ({ 院友id: r.院友id, 監測類型: r.監測類型, 數值: r.數值, 數值_副: r.數值_副, 記錄日期: r.記錄日期, 記錄時間: r.記錄時間, 備註: r.備註 })));
      if (!record && !recordGroup && !formData.isAbsent && records.length === 0) { alert('請至少填寫一項監測數值'); return; }
      let savedCount = 0;
      if (record) {
        const r = records[0];
        if (r) {
          console.log('[HealthRecordModal] updating single record id:', record.記錄id, 'payload:', r);
          const updated = await updateHealthRecord({ ...record, ...r } as HealthRecord);
          console.log('[HealthRecordModal] updated result:', { 記錄id: updated.記錄id, 監測類型: updated.監測類型, 數值: updated.數值, 數值_副: updated.數值_副 });
          savedCount = 1;
        }
      } else if (recordGroup) {
        // 整列編輯：已有的種類 → 清空則 delete，有值則 update；新種類 → insert
        const existingByType = new Map(recordGroup.map(r => [r.監測類型, r]));
        const toUpdate: HealthRecord[] = [];
        const toInsert: Omit<HealthRecord, '記錄id' | '建立時間'>[] = [];
        const toDelete: HealthRecord[] = [];
        for (const type of activeTypes) {
          const existing = existingByType.get(type);
          const hasValue = !!vitalEntries[type]?.primary.trim();
          if (existing) {
            if (!formData.isAbsent && !hasValue) {
              toDelete.push(existing);
            } else {
              toUpdate.push({ ...existing, ...buildRecordForType(type) } as HealthRecord);
            }
          } else if (formData.isAbsent || hasValue) {
            toInsert.push(buildRecordForType(type));
          }
        }
        console.log('[HealthRecordModal] group updates:', toUpdate.map(r => {
          const original = recordGroup.find(g => g.記錄id === r.記錄id);
          return { 記錄id: r.記錄id, 監測類型: r.監測類型, 原始數值: original?.數值, 原始數值_副: original?.數值_副, 新數值: r.數值, 新數值_副: r.數值_副 };
        }));
        console.log('[HealthRecordModal] group inserts:', toInsert.map(r => ({ 監測類型: r.監測類型, 數值: r.數值, 數值_副: r.數值_副 })));
        console.log('[HealthRecordModal] group deletes:', toDelete.map(r => ({ 記錄id: r.記錄id, 監測類型: r.監測類型, 原始數值: r.數值 })));
        for (const r of toUpdate) {
          const updated = await updateHealthRecord(r);
          console.log('[HealthRecordModal] updated result:', { 記錄id: updated.記錄id, 監測類型: updated.監測類型, 數值: updated.數值, 數值_副: updated.數值_副 });
        }
        if (toInsert.length > 0) {
          const inserted = await addHealthRecordsForSession(toInsert);
          console.log('[HealthRecordModal] inserted result:', inserted.map(r => ({ 記錄id: r.記錄id, 監測類型: r.監測類型, 數值: r.數值 })));
        }
        for (const r of toDelete) {
          await deleteHealthRecord(r.記錄id);
          console.log('[HealthRecordModal] deleted result:', { 記錄id: r.記錄id, 監測類型: r.監測類型 });
        }
        savedCount = toUpdate.length + toInsert.length + toDelete.length;
      } else {
        console.log('[HealthRecordModal] inserting records:', records);
        // 樂觀更新：context 已即時把記錄插入本地 state，不 await 伺服器回應，
        // 讓 modal 立即關閉、列表即時顯示；失敗時 context 會回滾並在此提示
        addHealthRecordsForSession(records as Omit<HealthRecord, '記錄id' | '建立時間'>[]).catch(err => {
          console.error('[HealthRecordModal] 背景儲存失敗:', err);
          alert(`儲存失敗: ${err instanceof Error ? err.message : '未知錯誤'}`);
        });
        savedCount = records.length;
      }
      console.log('[HealthRecordModal] saved count:', savedCount);
      // 完成所有相關任務（多任務整合時逐一更新各任務的下次到期）
      if (onTaskCompleted) {
        const dt = new Date(`${formData.記錄日期}T${formData.記錄時間}`);
        const completedTaskIds = new Set<string>();
        (records as { 任務id?: string }[]).forEach(r => { if (r.任務id) completedTaskIds.add(r.任務id); });
        const fallback = initialData?.task?.id ?? record?.任務id;
        if (completedTaskIds.size === 0 && fallback) completedTaskIds.add(fallback);
        for (const id of completedTaskIds) {
          try {
            await onTaskCompleted(id, dt);
          } catch (tcErr) {
            console.error(`[HealthRecordModal] onTaskCompleted failed for task ${id}:`, tcErr);
          }
        }
      }
      onClose();
    } catch (err) {
      console.error('儲存失敗:', err);
      alert(`儲存失敗: ${err instanceof Error ? err.message : '未知錯誤'}`);
    } finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.院友id) { alert('請選擇院友'); return; }
    if (!formData.記錄日期) { alert('請填寫記錄日期'); return; }
    if (!isTypeFixed && activeTypes.length === 0) { alert('請選擇至少一種監測項目'); return; }
    if (formData.isAbsent && !formData.absenceReason) { alert('請選擇無法量度原因'); return; }
    const today = getHKNow().date;
    if (formData.記錄日期 < today) {
      dwHandlers.current = { confirm: async () => { setShowDateWarning(false); await doSave(); }, cancel: () => setShowDateWarning(false) };
      setShowDateWarning(true); return;
    }
    await doSave();
  };

  const renderInput = (type: VitalSignType) => {
    const entry = vitalEntries[type] ?? { primary: '', secondary: '' };
    const disabled = formData.isAbsent;
    const info = ALL_VITAL_TYPES.find(v => v.type === type)!;
    const isDecimal = ['體溫', '血糖值', '體重'].includes(type);
    const placeholders: Record<string, string> = { '血壓': '120', '脈搏': '72', '體溫': '36.5', '血含氧量': '98', '呼吸': '18', '血糖值': '5.5', '體重': '65.0' };
    if (type === '血壓') {
      return (
        <div key={type}>
          <label className="form-label">血壓 (收縮壓 / 舒張壓) mmHg</label>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" value={entry.primary} onChange={e => setEntry(type, { primary: e.target.value.replace(/[^0-9]/g, '') })} className="form-input" placeholder="120" disabled={disabled} />
            <span className="text-gray-400 flex-shrink-0">/</span>
            <input type="text" inputMode="numeric" value={entry.secondary} onChange={e => setEntry(type, { secondary: e.target.value.replace(/[^0-9]/g, '') })} className="form-input" placeholder="80" disabled={disabled} />
          </div>
        </div>
      );
    }
    return (
      <div key={type}>
        <label className="form-label">{info.label} ({info.unit})</label>
        <input type="text" inputMode={isDecimal ? 'decimal' : 'numeric'} value={entry.primary}
          onChange={e => setEntry(type, { primary: isDecimal ? e.target.value : e.target.value.replace(/[^0-9]/g, '') })}
          className="form-input" placeholder={placeholders[type] || ''} disabled={disabled} />
      </div>
    );
  };

  return (
    <>
      {showScanner && <VitalSignScanner recordType={scanType} onResult={handleScanResult} onCancel={() => setShowScanner(false)} />}
      {showDateWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0" />
              <h3 className="font-semibold text-gray-900">確認補錄</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">記錄日期（{formData.記錄日期}）早於今天，確定要補錄嗎？</p>
            <div className="flex gap-3">
              <button type="button" onClick={dwHandlers.current.cancel} className="btn-secondary flex-1">取消</button>
              <button type="button" onClick={dwHandlers.current.confirm} className="btn-primary flex-1">確認補錄</button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">{record ? '編輯監測記錄' : recordGroup ? '編輯監測記錄（整列）' : '新增監測記錄'}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label"><User className="h-4 w-4 inline mr-1" />院友 *</label>
                <PatientAutocomplete value={formData.院友id} onChange={id => setFormData(prev => ({ ...prev, 院友id: id }))} placeholder="搜索院友..." showResidencyFilter defaultResidencyStatus="在住" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="form-label"><Calendar className="h-4 w-4 inline mr-1" />日期 *</label>
                  <input type="date" value={formData.記錄日期} onChange={e => setFormData(prev => ({ ...prev, 記錄日期: e.target.value }))} className="form-input" required />
                </div>
                <div>
                  <label className="form-label"><Clock className="h-4 w-4 inline mr-1" />時間</label>
                  <input type="time" value={formData.記錄時間} onChange={e => setFormData(prev => ({ ...prev, 記錄時間: e.target.value }))} className="form-input" />
                </div>
              </div>
            </div>

            {!isTypeFixed && (
              <div>
                <p className="text-sm text-gray-500 mb-2">監測項目 *（可多選）</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_VITAL_TYPES.map(({ type, label, color }) => {
                    const selected = activeTypes.includes(type);
                    return (
                      <button key={type} type="button"
                        onClick={() => toggleVitalType(type)}
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                          selected ? `${color} text-white border-transparent` : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className={`p-3 rounded-lg border ${currentIsPatientAbsent ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isAbsent" checked={formData.isAbsent}
                  onChange={e => {
                    const checked = e.target.checked;
                    setFormData(prev => ({ ...prev, isAbsent: checked, absenceReason: checked ? prev.absenceReason : '', 備註: checked ? (prev.absenceReason ? `無法量度原因: ${prev.absenceReason}` : '無法量度') : '' }));
                  }}
                  className="h-4 w-4 rounded border-gray-300" />
                <label htmlFor="isAbsent" className={`text-sm font-medium cursor-pointer ${currentIsPatientAbsent ? 'text-red-800' : 'text-orange-800'}`}>
                  院友未能進行監測{currentIsPatientAbsent && <span className="ml-1 text-red-600 font-bold">(入院中)</span>}
                </label>
              </div>
              {formData.isAbsent && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-sm text-gray-600 flex-shrink-0">原因:</label>
                  <select value={formData.absenceReason}
                    onChange={e => { const r = e.target.value; setFormData(prev => ({ ...prev, absenceReason: r, 備註: r ? `無法量度原因: ${r}` : '無法量度' })); }}
                    className="form-input text-sm flex-1" required={formData.isAbsent} disabled={currentIsPatientAbsent && formData.absenceReason === '入院'}>
                    <option value="">請選擇</option>
                    <option value="入院">入院</option>
                    <option value="回家">回家</option>
                    <option value="拒絕">拒絕</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              )}
            </div>
            {canScan && (
              <button type="button" onClick={() => setShowScanner(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 text-white font-medium active:bg-blue-700">
                <Camera className="h-5 w-5" />揃描{hasBG && !hasBP ? '血糖儀' : '血壓計'}
              </button>
            )}
            {scanLowConfidence && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>已自動填入揃描結果，但辨識信心較低，請核對數值是否正確。</span>
              </div>
            )}
            {!formData.isAbsent && activeTypes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{activeTypes.map(renderInput)}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">備註</label>
                <textarea value={formData.備註} onChange={e => setFormData(prev => ({ ...prev, 備註: e.target.value }))} className="form-input" rows={2} placeholder="其他備註..." disabled={formData.isAbsent && !!formData.absenceReason} />
              </div>
              <div>
                <label className="form-label">記錄人員</label>
                <input type="text" value={formData.記錄人員} onChange={e => setFormData(prev => ({ ...prev, 記錄人員: e.target.value }))} className="form-input" placeholder="記錄人員姓名" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? '儲存中...' : record ? '更新記錄' : '儲存記錄'}</button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1">取消</button>
            </div>
            {/* 智能數據生成器 - 只在新增模式下顯示，且虛擬數據功能啟用時 */}
            {!record && isVirtualDataEnabled() && (
              <div className="mt-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsGeneratorCollapsed(!isGeneratorCollapsed)}
                  className="w-full flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">智能數據生成器</span>
                    {generatorStatus === 'generated' && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">已生成</span>
                    )}
                  </div>
                  {isGeneratorCollapsed ? (
                    <ChevronDown className="h-5 w-5 text-blue-600" />
                  ) : (
                    <ChevronUp className="h-5 w-5 text-blue-600" />
                  )}
                </button>
                {!isGeneratorCollapsed && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="mb-4">
                      {formData.院友id ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                          <User className="h-4 w-4 text-blue-600" />
                          <span>
                            院友：
                            {(() => {
                              const patient = patients.find(p => p.院友id.toString() === formData.院友id);
                              return patient ? (
                                <span className="flex flex-wrap items-center gap-1">
                                  {patient.中文姓名} (<BedNumberImprint patient={patient} size="sm" className="text-xs text-gray-500" />)
                                </span>
                              ) : '未選擇';
                            })()}
                          </span>
                          <span className="text-blue-600">|</span>
                          <span>監測類型：{activeTypes.join('、') || '未選擇'}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-orange-600 flex flex-wrap items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span>請先選擇院友</span>
                        </div>
                      )}
                    </div>
                    {generatorStatus === 'idle' && (
                      <div className="text-center py-4">
                        <button
                          type="button"
                          onClick={handleGenerateData}
                          disabled={!formData.院友id || formData.isAbsent || activeTypes.length === 0}
                          className="btn-primary inline-flex flex-wrap items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>啟動生成器</span>
                        </button>
                        {formData.isAbsent && (
                          <p className="text-xs text-gray-500 mt-2">生成器在「無法量度」模式下不可用</p>
                        )}
                      </div>
                    )}
                    {generatorStatus === 'loading' && (
                      <div className="text-center py-6">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">正在分析歷史記錄...</p>
                      </div>
                    )}
                    {generatorStatus === 'no-data' && (
                      <div className="text-center py-4">
                        <div className="inline-flex flex-wrap items-center gap-2 text-orange-600 mb-3">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="font-medium">該院友暫無歷史記錄</span>
                        </div>
                        <p className="text-sm text-gray-600">無法根據歷史數據生成建議值</p>
                      </div>
                    )}
                    {generatorStatus === 'error' && (
                      <div className="text-center py-4">
                        <div className="inline-flex flex-wrap items-center gap-2 text-red-600 mb-3">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="font-medium">生成失敗</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">請稍後再試</p>
                        <button type="button" onClick={handleGenerateData} className="btn-secondary text-sm">重試</button>
                      </div>
                    )}
                    {generatorStatus === 'generated' && (
                      <div className="text-center py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2 text-green-600 mb-4">
                          <CheckCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">已根據最近 {generatedRecordCount} 次記錄生成並填入表單</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateData}
                          className="btn-secondary inline-flex flex-wrap items-center gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>重新生成</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
};

export default HealthRecordModal;
