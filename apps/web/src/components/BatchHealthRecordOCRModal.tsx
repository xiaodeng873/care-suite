import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader, CheckCircle, AlertTriangle, Save, Trash2, Plus, RefreshCw } from 'lucide-react';
import { processImageWithGeminiVision } from '../utils/ocrProcessor';
import { usePatientData } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';
import ImageSourcePicker from './ImageSourcePicker';
import type { HealthRecord } from '../lib/database';

interface ParsedHealthRecord {
  tempId: string;
  院友id: number | null;
  記錄日期: string;
  記錄時間: string;
  血壓收縮壓?: number;
  血壓舒張壓?: number;
  脈搏?: number;
  血糖值?: number;
  備註?: string;
  matchedPatient?: any;
}

interface BatchHealthRecordOCRModalProps {
  onClose: () => void;
  /** AI 助護預填：已從圖片提取的監測記錄（與 WORKSHEET_OCR_PROMPT 輸出同結構的陣列），提供時直接進入核對階段 */
  initialRecords?: Record<string, unknown>[];
}

type Phase = 'idle' | 'processing' | 'review';

const WORKSHEET_OCR_PROMPT = `你是醫療機構的健康記錄識別專家。請從圖片中的「監測工作紙」提取每位院友的健康監測記錄。

工作紙通常是表格形式，每行代表一位院友，包含：床號（如A101）、院友姓名、記錄日期、記錄時間、收縮壓（SBP/上壓）、舒張壓（DBP/下壓）、脈搏（心跳/pulse）、血糖值等欄位。

請返回一個 JSON 陣列，每個元素代表一行記錄：
[
  {
    "床號": "A101",
    "院友姓名": "王大明",
    "記錄日期": "2026-07-01",
    "記錄時間": "08:00",
    "收縮壓": 120,
    "舒張壓": 80,
    "脈搏": 72,
    "血糖值": 6.5,
    "備註": ""
  }
]

提取規則：
1. 如果數值缺失或無法辨識，請直接省略該欄位，不要輸出 null 或空字串
2. 只輸出有值的欄位
3. 所有數值都是數字類型（非字串）
4. 日期格式為 YYYY-MM-DD，時間格式為 HH:MM（24小時制）
5. 血糖值保留一位小數（如 6.5）
6. 若無法辨識日期，請省略日期欄位
7. 直接返回 JSON 陣列，不要有任何說明文字或代碼塊標記`;

const parseNum = (v: string): number | undefined => {
  if (v === '' || v == null) return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
};

const BatchHealthRecordOCRModal: React.FC<BatchHealthRecordOCRModalProps> = ({ onClose, initialRecords }) => {
  const { patients, addHealthRecordsForSession } = usePatientData();
  const { displayName } = useAuth();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [parsedRecords, setParsedRecords] = useState<ParsedHealthRecord[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [batchResult, setBatchResult] = useState<{ saved: number; failed: number } | null>(null);

  const matchPatient = useCallback((bedNo?: string, name?: string): any | null => {
    if (!bedNo && !name) return null;
    const active = patients.filter(p => p.在住狀態 === '在住');
    if (bedNo) {
      const p = active.find(p => p.床號 === bedNo);
      if (p) return p;
    }
    if (name) {
      const p = active.find(p => p.中文姓名 === name || (p.中文姓名 && p.中文姓名.includes(name)));
      if (p) return p;
    }
    return null;
  }, [patients]);

  /** 把 OCR 提取的單行記錄（WORKSHEET_OCR_PROMPT 結構）轉為可核對的 ParsedHealthRecord */
  const toParsedRecord = useCallback((r: Record<string, unknown>): ParsedHealthRecord | null => {
    if (!r || typeof r !== 'object') return null;
    const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const dateStr = str(r['記錄日期']);
    const timeStr = str(r['記錄時間']);
    const matched = matchPatient(str(r['床號']), str(r['院友姓名']));
    const rec: ParsedHealthRecord = {
      tempId: Math.random().toString(36).slice(2, 10),
      院友id: matched ? Number(matched.院友id) : null,
      記錄日期: dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
        ? dateStr : new Date().toISOString().split('T')[0],
      記錄時間: timeStr && /^\d{2}:\d{2}$/.test(timeStr)
        ? timeStr : '08:00',
      matchedPatient: matched || null,
    };
    if (r['收縮壓'] != null) rec.血壓收縮壓 = Number(r['收縮壓']);
    if (r['舒張壓'] != null) rec.血壓舒張壓 = Number(r['舒張壓']);
    if (r['脈搏'] != null) rec.脈搏 = Number(r['脈搏']);
    if (r['血糖值'] != null) rec.血糖值 = parseFloat(String(r['血糖值']));
    if (r['備註']) rec.備註 = String(r['備註']);
    return rec;
  }, [matchPatient]);

  // AI 助護預填：有 initialRecords 時直接進入核對階段（只套用一次）
  const initialRecordsAppliedRef = useRef(false);
  useEffect(() => {
    if (!initialRecords?.length || initialRecordsAppliedRef.current) return;
    initialRecordsAppliedRef.current = true;
    const recs = initialRecords.map(toParsedRecord).filter((r): r is ParsedHealthRecord => r !== null);
    if (recs.length > 0) {
      setParsedRecords(recs);
      setPhase('review');
    }
  }, [initialRecords, toParsedRecord]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    setSelectedFiles(prev => [...prev, ...arr]);
    arr.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleRemoveFile = useCallback((idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleRecognize = useCallback(async () => {
    if (!selectedFiles.length) return;
    setPhase('processing');
    setProcessingError(null);
    setBatchResult(null);

    const allRecords: ParsedHealthRecord[] = [];
    let lastError: string | null = null;

    for (const file of selectedFiles) {
      try {
        const result = await processImageWithGeminiVision(file, WORKSHEET_OCR_PROMPT, true);
        if (!result.success) {
          lastError = result.error || '識別失敗';
          continue;
        }
        const raw = result.extractedData;
        const records: any[] = Array.isArray(raw) ? raw : (raw?.records ?? []);

        records.forEach((r: any) => {
          const rec = toParsedRecord(r);
          if (rec) allRecords.push(rec);
        });
      } catch (err: any) {
        lastError = err?.message || '識別過程出現錯誤';
      }
    }

    if (allRecords.length > 0) {
      setParsedRecords(allRecords);
      setPhase('review');
      if (lastError) setProcessingError(`部分圖片識別失敗：${lastError}`);
    } else {
      setProcessingError(lastError || '未能識別任何記錄，請確認圖片清晰且包含監測數據。');
      setPhase('idle');
    }
  }, [selectedFiles, toParsedRecord]);

  const updateRecord = useCallback((tempId: string, updates: Partial<ParsedHealthRecord>) => {
    setParsedRecords(prev => prev.map(r => r.tempId === tempId ? { ...r, ...updates } : r));
    setRowErrors(prev => { const n = { ...prev }; delete n[tempId]; return n; });
  }, []);

  const deleteRecord = useCallback((tempId: string) => {
    setParsedRecords(prev => prev.filter(r => r.tempId !== tempId));
    setRowErrors(prev => { const n = { ...prev }; delete n[tempId]; return n; });
  }, []);

  const addBlankRecord = useCallback(() => {
    const now = new Date();
    setParsedRecords(prev => [...prev, {
      tempId: Math.random().toString(36).slice(2, 10),
      院友id: null,
      記錄日期: now.toISOString().split('T')[0],
      記錄時間: now.toTimeString().slice(0, 5),
    }]);
  }, []);

  const validateRecord = (r: ParsedHealthRecord): string | null => {
    if (!r.院友id) return '必須選擇院友';
    if (!r.記錄日期) return '必須填寫日期';
    if (!r.記錄時間) return '必須填寫時間';
    const hasBP = r.血壓收縮壓 != null && r.血壓舒張壓 != null;
    const hasPulse = r.脈搏 != null;
    const hasBG = r.血糖值 != null;
    if (!hasBP && !hasPulse && !hasBG) return '至少需要一個監測數值（血壓、脈搏或血糖）';
    return null;
  };

  const expandToHealthRecords = (r: ParsedHealthRecord): Omit<HealthRecord, '記錄id' | '建立時間'>[] => {
    const base = {
      院友id: r.院友id!,
      記錄日期: r.記錄日期,
      記錄時間: r.記錄時間,
      備註: r.備註 || undefined,
      記錄人員: displayName || undefined,
    };
    const rows: Omit<HealthRecord, '記錄id' | '建立時間'>[] = [];
    if (r.血壓收縮壓 != null && r.血壓舒張壓 != null) {
      rows.push({ ...base, 監測類型: '血壓', 數值: r.血壓收縮壓, 數值_副: r.血壓舒張壓 });
    }
    if (r.脈搏 != null) {
      rows.push({ ...base, 監測類型: '脈搏', 數值: r.脈搏 });
    }
    if (r.血糖值 != null) {
      rows.push({ ...base, 監測類型: '血糖值', 數值: r.血糖值 });
    }
    return rows;
  };

  const handleSaveRow = useCallback(async (record: ParsedHealthRecord) => {
    const err = validateRecord(record);
    if (err) {
      setRowErrors(prev => ({ ...prev, [record.tempId]: err }));
      return;
    }
    setSavingRows(prev => new Set(prev).add(record.tempId));
    try {
      await addHealthRecordsForSession(expandToHealthRecords(record));
      setParsedRecords(prev => prev.filter(r => r.tempId !== record.tempId));
      setBatchResult(prev => ({ saved: (prev?.saved ?? 0) + 1, failed: prev?.failed ?? 0 }));
    } catch (e: any) {
      setRowErrors(prev => ({ ...prev, [record.tempId]: e?.message || '儲存失敗' }));
    } finally {
      setSavingRows(prev => { const n = new Set(prev); n.delete(record.tempId); return n; });
    }
  }, [addHealthRecordsForSession, displayName, parsedRecords]);

  const handleSaveBatch = useCallback(async () => {
    let saved = 0, failed = 0;
    const toSave = [...parsedRecords];
    for (const record of toSave) {
      const err = validateRecord(record);
      if (err) { failed++; setRowErrors(prev => ({ ...prev, [record.tempId]: err })); continue; }
      setSavingRows(prev => new Set(prev).add(record.tempId));
      try {
        await addHealthRecordsForSession(expandToHealthRecords(record));
        saved++;
        setParsedRecords(prev => prev.filter(r => r.tempId !== record.tempId));
      } catch {
        failed++;
        setRowErrors(prev => ({ ...prev, [record.tempId]: '儲存失敗' }));
      } finally {
        setSavingRows(prev => { const n = new Set(prev); n.delete(record.tempId); return n; });
      }
    }
    setBatchResult({ saved, failed });
  }, [parsedRecords, addHealthRecordsForSession, displayName]);

  const numInput = (
    value: number | undefined,
    onChange: (v: number | undefined) => void,
    placeholder: string,
    className = '',
  ) => (
    <input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(parseNum(e.target.value))}
      placeholder={placeholder}
      className={`form-input text-sm w-full ${className}`}
      style={{ minWidth: '60px' }}
    />
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl my-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><Camera className="h-5 w-5 text-blue-600" /></div>
            <h2 className="text-xl font-semibold text-gray-900">拍照識別監測工作紙</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Upload area */}
          <div>
            <ImageSourcePicker onSelect={files => handleFiles(files)} albumMultiple>
              {(openPicker) => (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onClick={openPicker}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">點擊拍照或選擇相簿圖片（相簿支援多張），亦可拖放圖片到此</p>
                  <p className="text-xs text-gray-400 mt-1">支援 JPG、PNG</p>
                </div>
              )}
            </ImageSourcePicker>

            {/* Image previews */}
            {imagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img src={src} alt={`圖片${i + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                    <button
                      onClick={() => handleRemoveFile(i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={handleRecognize}
                disabled={!selectedFiles.length || phase === 'processing'}
                className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {phase === 'processing' ? (
                  <><Loader className="h-4 w-4 animate-spin" />識別中…</>
                ) : (
                  <><Camera className="h-4 w-4" />開始識別</>
                )}
              </button>
              {phase === 'review' && (
                <>
                  <button onClick={addBlankRecord} className="btn-secondary flex items-center gap-2 text-sm">
                    <Plus className="h-4 w-4" />新增空白列
                  </button>
                  <button
                    onClick={handleSaveBatch}
                    disabled={!parsedRecords.length || savingRows.size > 0}
                    className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2 text-sm disabled:opacity-50 ml-auto"
                  >
                    <Save className="h-4 w-4" />批量儲存全部
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {processingError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{processingError}</span>
            </div>
          )}

          {/* Batch result */}
          {batchResult && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${batchResult.failed ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span>已儲存 {batchResult.saved} 筆{batchResult.failed > 0 ? `，${batchResult.failed} 筆失敗（請逐行確認錯誤）` : ''}</span>
            </div>
          )}

          {/* Results table */}
          {phase === 'review' && parsedRecords.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">識別結果（共 {parsedRecords.length} 筆，可編輯後儲存）</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium min-w-[180px]">院友</th>
                      <th className="px-2 py-2.5 text-left font-medium min-w-[110px]">日期</th>
                      <th className="px-2 py-2.5 text-left font-medium min-w-[80px]">時間</th>
                      <th className="px-2 py-2.5 text-right font-medium min-w-[65px]">收縮壓</th>
                      <th className="px-2 py-2.5 text-right font-medium min-w-[65px]">舒張壓</th>
                      <th className="px-2 py-2.5 text-right font-medium min-w-[60px]">脈搏</th>
                      <th className="px-2 py-2.5 text-right font-medium min-w-[70px]">血糖</th>
                      <th className="px-2 py-2.5 text-left font-medium min-w-[120px]">備註</th>
                      <th className="px-2 py-2.5 text-center font-medium min-w-[80px]">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRecords.map(rec => {
                      const isSaving = savingRows.has(rec.tempId);
                      const err = rowErrors[rec.tempId];
                      return (
                        <React.Fragment key={rec.tempId}>
                          <tr className={`hover:bg-gray-50 ${err ? 'bg-red-50' : ''}`}>
                            {/* 院友 */}
                            <td className="px-3 py-2">
                              <PatientAutocomplete
                                value={rec.院友id ?? ''}
                                onChange={id => updateRecord(rec.tempId, { 院友id: id ? Number(id) : null })}
                                placeholder="選擇院友…"
                                defaultResidencyStatus="在住"
                              />
                            </td>
                            {/* 日期 */}
                            <td className="px-2 py-2">
                              <input
                                type="date"
                                value={rec.記錄日期}
                                onChange={e => updateRecord(rec.tempId, { 記錄日期: e.target.value })}
                                className="form-input text-sm w-full"
                              />
                            </td>
                            {/* 時間 */}
                            <td className="px-2 py-2">
                              <input
                                type="time"
                                value={rec.記錄時間}
                                onChange={e => updateRecord(rec.tempId, { 記錄時間: e.target.value })}
                                className="form-input text-sm w-full"
                              />
                            </td>
                            {/* 收縮壓 */}
                            <td className="px-2 py-2">
                              {numInput(rec.血壓收縮壓, v => updateRecord(rec.tempId, { 血壓收縮壓: v }), '—', 'text-right')}
                            </td>
                            {/* 舒張壓 */}
                            <td className="px-2 py-2">
                              {numInput(rec.血壓舒張壓, v => updateRecord(rec.tempId, { 血壓舒張壓: v }), '—', 'text-right')}
                            </td>
                            {/* 脈搏 */}
                            <td className="px-2 py-2">
                              {numInput(rec.脈搏, v => updateRecord(rec.tempId, { 脈搏: v }), '—', 'text-right')}
                            </td>
                            {/* 血糖 */}
                            <td className="px-2 py-2">
                              {numInput(rec.血糖值, v => updateRecord(rec.tempId, { 血糖值: v }), '—', 'text-right')}
                            </td>
                            {/* 備註 */}
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={rec.備註 ?? ''}
                                onChange={e => updateRecord(rec.tempId, { 備註: e.target.value || undefined })}
                                placeholder="備註"
                                className="form-input text-sm w-full"
                              />
                            </td>
                            {/* 操作 */}
                            <td className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleSaveRow(rec)}
                                  disabled={isSaving}
                                  title="儲存此列"
                                  className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                                >
                                  {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => deleteRecord(rec.tempId)}
                                  title="刪除此列"
                                  className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {err && (
                            <tr className="bg-red-50">
                              <td colSpan={9} className="px-3 py-1 text-xs text-red-600">
                                ⚠ {err}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {phase === 'review' && parsedRecords.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-400" />
              <p className="text-sm">所有記錄已儲存完成</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchHealthRecordOCRModal;
