import React, { useState, useEffect, useCallback } from 'react';
import { X, Trash2, RotateCcw, Search, Calendar, User, AlertTriangle } from 'lucide-react';
import { useFilteredPatients } from '../context/PatientContext';
import BedNumberImprint from './BedNumberImprint';
import { fuzzyMatch, matchChineseName, matchEnglishName } from '../utils/searchUtils';
import { formatDisplayDate, formatDisplayDateTime } from '../utils/dateFormat';
import {
  DeletedRecord,
  fetchDeletedRecords,
  restoreRecord,
  permanentDeleteRecord,
} from '../lib/recycleBin';

export interface SummaryField {
  key: string;
  label: string;
}

interface RecordRecycleBinModalProps {
  // 一或多張原表（多表時每筆記錄會顯示來源表 badge）
  tables: string[];
  title: string;
  // 各原表嘅顯示名稱（可選，多表時建議提供）
  tableLabels?: Record<string, string>;
  // jsonb data 入面攞院友 id 嘅欄名（按先後順序嘗試）
  patientIdFields?: string[];
  // 每筆記錄要顯示嘅欄位
  summaryFields?: SummaryField[];
  // 記錄日期欄位（顯示用，可選）
  dateField?: string;
  // 還原／永久刪除後通知上層重新載入列表
  onRestored?: () => void;
  onClose: () => void;
}

const RecordRecycleBinModal: React.FC<RecordRecycleBinModalProps> = ({
  tables,
  title,
  tableLabels,
  patientIdFields = ['patient_id', '院友id'],
  summaryFields = [],
  dateField,
  onRestored,
  onClose,
}) => {
  const patients = useFilteredPatients();
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchDeletedRecords(tables);
      setRecords(data);
    } catch (error) {
      console.error('載入回收筒記錄失敗:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tables]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const getPatientId = (record: DeletedRecord): number | null => {
    for (const key of patientIdFields) {
      const value = record.data?.[key];
      if (value !== undefined && value !== null && value !== '') {
        const num = Number(value);
        if (!Number.isNaN(num)) return num;
      }
    }
    return null;
  };

  const getPatientInfo = (record: DeletedRecord) => {
    const pid = getPatientId(record);
    const patient = pid !== null ? patients.find(p => p.院友id === pid) : undefined;
    return patient
      ? { patient, name: `${patient.中文姓氏}${patient.中文名字}`, bed: patient.床號 }
      : { patient: undefined, name: '未知院友', bed: '-' };
  };

  const formatSummaryValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (Array.isArray(value)) return value.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join('、');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true;
    const info = getPatientInfo(record);
    const haystacks = [
      info.name,
      info.bed,
      record.deletion_reason,
      ...summaryFields.map(f => formatSummaryValue(record.data?.[f.key])),
    ];
    if (info.patient) {
      haystacks.push(
        matchChineseName(info.patient.中文姓氏, info.patient.中文名字, info.patient.中文姓名, searchTerm) ? searchTerm : '',
        matchEnglishName(info.patient.英文姓氏, info.patient.英文名字, info.patient.英文姓名, searchTerm) ? searchTerm : '',
        info.patient.身份證號碼 ?? '',
      );
    }
    return haystacks.some(h => h && fuzzyMatch(h, searchTerm));
  });

  const handleSelectRecord = (id: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRecords(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRecords.size === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const handleRestore = async (recycleId: string) => {
    setIsRestoring(true);
    try {
      await restoreRecord(recycleId);
      setSelectedRecords(new Set());
      await loadRecords();
      onRestored?.();
      alert('恢復成功！');
    } catch (error) {
      console.error('恢復記錄失敗:', error);
      alert('恢復失敗，請重試');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBatchRestore = async () => {
    if (selectedRecords.size === 0) return;
    const count = selectedRecords.size;
    if (!confirm(`確定要恢復選中的 ${count} 筆記錄嗎？`)) return;

    setIsRestoring(true);
    try {
      for (const recycleId of Array.from(selectedRecords)) {
        await restoreRecord(recycleId);
      }
      setSelectedRecords(new Set());
      await loadRecords();
      onRestored?.();
      alert(`成功恢復 ${count} 筆記錄！`);
    } catch (error) {
      console.error('批量恢復失敗:', error);
      alert('批量恢復失敗，請重試');
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async (recycleId: string) => {
    if (!confirm('確定要永久刪除這筆記錄嗎？此操作無法撤銷！')) return;

    setIsDeleting(true);
    try {
      await permanentDeleteRecord(recycleId);
      setSelectedRecords(new Set());
      await loadRecords();
      alert('永久刪除成功！');
    } catch (error) {
      console.error('永久刪除失敗:', error);
      alert('永久刪除失敗，請重試');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBatchPermanentDelete = async () => {
    if (selectedRecords.size === 0) return;
    const count = selectedRecords.size;
    if (!confirm(`確定要永久刪除選中的 ${count} 筆記錄嗎？\n\n此操作無法撤銷！`)) return;

    setIsDeleting(true);
    try {
      for (const recycleId of Array.from(selectedRecords)) {
        await permanentDeleteRecord(recycleId);
      }
      setSelectedRecords(new Set());
      await loadRecords();
      alert(`成功永久刪除 ${count} 筆記錄！`);
    } catch (error) {
      console.error('批量永久刪除失敗:', error);
      alert('批量永久刪除失敗，請重試');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Trash2 className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  共 {records.length} 筆已刪除記錄
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋院友姓名、床號或刪除原因..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 w-full"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
              >
                {selectedRecords.size === filteredRecords.length && filteredRecords.length > 0 ? '取消全選' : '全選'}
              </button>
              {selectedRecords.size > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleBatchRestore}
                    disabled={isRestoring}
                    className="text-sm text-green-600 hover:text-green-700 font-medium whitespace-nowrap flex items-center space-x-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>批量恢復 ({selectedRecords.size})</span>
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleBatchPermanentDelete}
                    disabled={isDeleting}
                    className="text-sm text-red-600 hover:text-red-700 font-medium whitespace-nowrap flex items-center space-x-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>批量永久刪除 ({selectedRecords.size})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">載入中...</p>
              </div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Trash2 className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-gray-600 text-lg">
                {searchTerm ? '沒有找到匹配的記錄' : '回收筒為空'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
                >
                  清除搜尋
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((record) => {
                const info = getPatientInfo(record);
                const isSelected = selectedRecords.has(record.id);
                const rawDate = dateField ? record.data?.[dateField] : null;

                return (
                  <div
                    key={record.id}
                    className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRecord(record.id)}
                        className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{info.name}</span>
                              {tables.length > 1 && (
                                <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">
                                  {tableLabels?.[record.original_table] ?? record.original_table}
                                </span>
                              )}
                              {info.patient && (
                                <BedNumberImprint patient={info.patient as any} size="sm" />
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleRestore(record.id)}
                              disabled={isRestoring}
                              className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50"
                              title="恢復"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(record.id)}
                              disabled={isDeleting}
                              className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50"
                              title="永久刪除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {summaryFields.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                            {summaryFields.map((field) => (
                              <div key={field.key} className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-700">{field.label}:</span>
                                <span>{formatSummaryValue(record.data?.[field.key])}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {rawDate && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span>記錄日期: {formatDisplayDate(rawDate)}</span>
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-gray-500 space-y-1">
                          <div>刪除原因: {record.deletion_reason}</div>
                          <div>
                            刪除時間: {formatDisplayDateTime(record.deleted_at)}
                          </div>
                          {record.deleted_by && <div>刪除人: {record.deleted_by}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded">
              <AlertTriangle className="h-4 w-4" />
              <span>永久刪除的記錄無法恢復，請謹慎操作</span>
            </div>
            <button onClick={onClose} className="btn-secondary">
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordRecycleBinModal;
