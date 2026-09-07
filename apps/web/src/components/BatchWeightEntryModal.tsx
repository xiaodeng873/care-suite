import React, { useState, useCallback } from 'react';
import { X, Save, Plus, Trash2, Loader, Scale, CheckCircle } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { useStation } from '../context/facility';
import PatientAutocomplete from './PatientAutocomplete';
import DateInput from './DateInput';
import type { HealthRecord } from '../lib/database';

interface Column {
  tempId: string;
  date: string;
  time: string;
}

interface WeightRow {
  tempId: string;
  院友id: number | null;
  weights: Record<string, string>; // columnTempId -> 體重字串
}

interface BatchWeightEntryModalProps {
  onClose: () => void;
}

const genId = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().split('T')[0];

const BatchWeightEntryModal: React.FC<BatchWeightEntryModalProps> = ({ onClose }) => {
  const { patients, addHealthRecordsForSession } = usePatientData();
  const { displayName } = useAuth();
  const { stations } = useStation();

  const [columns, setColumns] = useState<Column[]>([{ tempId: genId(), date: todayStr(), time: '08:00' }]);
  const [rows, setRows] = useState<WeightRow[]>([]);
  const [stationFilter, setStationFilter] = useState<string>('');
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [batchResult, setBatchResult] = useState<{ saved: number; failed: number } | null>(null);

  // 某居住區的在住院友；居住區以床號首碼對應 station.code（與全局過濾器同邏輯）
  const residentsOfStation = useCallback((stationId: string) => {
    const residents = patients.filter(p => p.在住狀態 === '在住');
    if (!stationId) return residents;
    const st = stations.find(s => s.id === stationId);
    if (!st) return residents;
    const code = (st.code || '').toUpperCase();
    return residents.filter(p => {
      if (p.station_id) return p.station_id === stationId;
      return (p.床號 || '').trim().charAt(0).toUpperCase() === code;
    });
  }, [patients, stations]);

  // 首次進入：預填全部在住院友
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setRows(residentsOfStation('').map(p => ({ tempId: genId(), 院友id: Number(p.院友id), weights: {} })));
  }, [residentsOfStation]);

  const updateColumn = useCallback((tempId: string, updates: Partial<Column>) => {
    setColumns(prev => prev.map(c => c.tempId === tempId ? { ...c, ...updates } : c));
  }, []);

  const addColumn = useCallback(() => {
    setColumns(prev => [...prev, { tempId: genId(), date: todayStr(), time: '08:00' }]);
  }, []);

  const removeColumn = useCallback((tempId: string) => {
    setColumns(prev => prev.filter(c => c.tempId !== tempId));
    setRows(prev => prev.map(r => {
      const weights = { ...r.weights };
      delete weights[tempId];
      return { ...r, weights };
    }));
  }, []);

  const updateRow = useCallback((tempId: string, updates: Partial<WeightRow>) => {
    setRows(prev => prev.map(r => r.tempId === tempId ? { ...r, ...updates } : r));
    setRowErrors(prev => { const n = { ...prev }; delete n[tempId]; return n; });
  }, []);

  const setWeight = useCallback((rowTempId: string, colTempId: string, value: string) => {
    setRows(prev => prev.map(r => r.tempId === rowTempId
      ? { ...r, weights: { ...r.weights, [colTempId]: value } }
      : r));
    setRowErrors(prev => { const n = { ...prev }; delete n[rowTempId]; return n; });
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, { tempId: genId(), 院友id: null, weights: {} }]);
  }, []);

  const removeRow = useCallback((tempId: string) => {
    setRows(prev => prev.filter(r => r.tempId !== tempId));
    setRowErrors(prev => { const n = { ...prev }; delete n[tempId]; return n; });
  }, []);

  const changeStationFilter = useCallback((stationId: string) => {
    setStationFilter(stationId);
    // 切換居住區時重設列為該區全部在住院友
    setRows(residentsOfStation(stationId).map(p => ({ tempId: genId(), 院友id: Number(p.院友id), weights: {} })));
    setRowErrors({});
    setBatchResult(null);
  }, [residentsOfStation]);

  // 校驗一列；回傳錯誤訊息或 null
  const validateRow = useCallback((row: WeightRow): string | null => {
    if (!row.院友id) return '必須選擇院友';
    const filled = columns.filter(c => (row.weights[c.tempId] ?? '') !== '');
    if (filled.length === 0) return '至少需要輸入一個體重數值';
    const missing = filled.find(c => !c.date || !c.time);
    if (missing) return '已填寫數值的欄必須設定日期及時間';
    return null;
  }, [columns]);

  // 把一列展開為健康監測記錄（每個已填欄位一筆體重記錄）
  const expandToHealthRecords = useCallback((row: WeightRow): Omit<HealthRecord, '記錄id' | '建立時間'>[] => {
    const records: Omit<HealthRecord, '記錄id' | '建立時間'>[] = [];
    for (const col of columns) {
      const raw = (row.weights[col.tempId] ?? '').trim();
      if (raw === '') continue;
      const value = parseFloat(raw);
      if (isNaN(value)) continue;
      records.push({
        院友id: row.院友id!,
        記錄日期: col.date,
        記錄時間: col.time,
        監測類型: '體重',
        數值: value,
        記錄人員: displayName || undefined,
      });
    }
    return records;
  }, [columns, displayName]);

  const handleSaveRow = useCallback(async (row: WeightRow) => {
    const err = validateRow(row);
    if (err) {
      setRowErrors(prev => ({ ...prev, [row.tempId]: err }));
      return;
    }
    setSavingRows(prev => new Set(prev).add(row.tempId));
    try {
      await addHealthRecordsForSession(expandToHealthRecords(row));
      setRows(prev => prev.filter(r => r.tempId !== row.tempId));
      setBatchResult(prev => ({ saved: (prev?.saved ?? 0) + 1, failed: prev?.failed ?? 0 }));
    } catch (e: any) {
      setRowErrors(prev => ({ ...prev, [row.tempId]: e?.message || '儲存失敗' }));
    } finally {
      setSavingRows(prev => { const n = new Set(prev); n.delete(row.tempId); return n; });
    }
  }, [validateRow, addHealthRecordsForSession, expandToHealthRecords]);

  const handleSaveBatch = useCallback(async () => {
    let saved = 0, failed = 0;
    for (const row of [...rows]) {
      const err = validateRow(row);
      if (err) { failed++; setRowErrors(prev => ({ ...prev, [row.tempId]: err })); continue; }
      setSavingRows(prev => new Set(prev).add(row.tempId));
      try {
        await addHealthRecordsForSession(expandToHealthRecords(row));
        saved++;
        setRows(prev => prev.filter(r => r.tempId !== row.tempId));
      } catch {
        failed++;
        setRowErrors(prev => ({ ...prev, [row.tempId]: '儲存失敗' }));
      } finally {
        setSavingRows(prev => { const n = new Set(prev); n.delete(row.tempId); return n; });
      }
    }
    setBatchResult({ saved, failed });
  }, [rows, validateRow, addHealthRecordsForSession, expandToHealthRecords]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl my-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><Scale className="h-5 w-5 text-blue-600" /></div>
            <h2 className="text-xl font-semibold text-gray-900">批量輸入體重</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* 工具列：居住區過濾器 + 新增欄 + 批量上傳 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">居住區</label>
              <select
                value={stationFilter}
                onChange={e => changeStationFilter(e.target.value)}
                className="form-input text-sm"
              >
                <option value="">全部</option>
                {stations.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <button onClick={addColumn} className="btn-secondary flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" />新增欄（日期+時間）
            </button>
            <button
              onClick={handleSaveBatch}
              disabled={!rows.length || savingRows.size > 0}
              className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2 text-sm disabled:opacity-50 ml-auto"
            >
              <Save className="h-4 w-4" />一鍵上傳全部
            </button>
          </div>

          {/* Batch result */}
          {batchResult && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${batchResult.failed ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span>已儲存 {batchResult.saved} 列{batchResult.failed > 0 ? `，${batchResult.failed} 列失敗（請逐行確認錯誤）` : ''}</span>
            </div>
          )}

          {/* 輸入表格：欄為日期+時間，列為院友 */}
          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium min-w-[180px]">院友</th>
                    {columns.map(col => (
                      <th key={col.tempId} className="px-2 py-2.5 text-left font-medium min-w-[150px]">
                        <div className="space-y-1 normal-case">
                          <DateInput
                            value={col.date}
                            onChange={value => updateColumn(col.tempId, { date: value })}
                            className="form-input text-xs w-full"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={col.time}
                              onChange={e => updateColumn(col.tempId, { time: e.target.value })}
                              className="form-input text-xs w-full"
                            />
                            <button
                              onClick={() => removeColumn(col.tempId)}
                              disabled={columns.length <= 1}
                              title="移除此欄"
                              className="p-1 rounded text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-center font-medium min-w-[90px]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(row => {
                    const isSaving = savingRows.has(row.tempId);
                    const err = rowErrors[row.tempId];
                    return (
                      <React.Fragment key={row.tempId}>
                        <tr className={`hover:bg-gray-50 ${err ? 'bg-red-50' : ''}`}>
                          {/* 院友 */}
                          <td className="px-3 py-2">
                            <PatientAutocomplete
                              value={row.院友id ?? ''}
                              onChange={id => updateRow(row.tempId, { 院友id: id ? Number(id) : null })}
                              placeholder="選擇院友…"
                              defaultResidencyStatus="在住"
                            />
                          </td>
                          {/* 各欄體重輸入 */}
                          {columns.map(col => (
                            <td key={col.tempId} className="px-2 py-2">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={row.weights[col.tempId] ?? ''}
                                onChange={e => setWeight(row.tempId, col.tempId, e.target.value)}
                                placeholder="kg"
                                className="form-input text-sm w-full text-right"
                              />
                            </td>
                          ))}
                          {/* 操作 */}
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleSaveRow(row)}
                                disabled={isSaving}
                                title="上傳此列"
                                className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                              >
                                {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => removeRow(row.tempId)}
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
                            <td colSpan={columns.length + 2} className="px-3 py-1 text-xs text-red-600">
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
          ) : (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-400" />
              <p className="text-sm">所有列已上傳完成</p>
            </div>
          )}

          {/* 新增列 */}
          <button onClick={addRow} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" />新增列
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchWeightEntryModal;
