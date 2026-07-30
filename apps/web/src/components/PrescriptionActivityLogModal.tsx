import React, { useEffect, useMemo, useState } from 'react';
import { X, Clock, User, RotateCcw, Plus, Pencil, Trash2, ArrowLeftRight, Repeat, CalendarClock, History } from 'lucide-react';
import * as db from '../lib/database';
import BedNumberImprint from './BedNumberImprint';
import { usePatients } from '../context/PatientContext';
import { ACTION_TYPE_LABELS, PRESCRIPTION_STATUS_LABELS } from '../utils/prescriptionActivityLog';

interface PrescriptionActivityLogModalProps {
  patient: any; // 院友主表 record（含 院友id, 中文姓名, 床號, 性別, 院友相片）
  onClose: () => void;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  status_change: ArrowLeftRight,
  replace: Repeat,
  batch_date_update: CalendarClock,
  restore: RotateCcw,
};

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-green-100 text-green-700 border-green-200',
  update: 'bg-blue-100 text-blue-700 border-blue-200',
  delete: 'bg-red-100 text-red-700 border-red-200',
  status_change: 'bg-amber-100 text-amber-700 border-amber-200',
  replace: 'bg-purple-100 text-purple-700 border-purple-200',
  batch_date_update: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  restore: 'bg-gray-100 text-gray-700 border-gray-200',
};

const formatTimestamp = (iso: string): string => {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
};

const PrescriptionActivityLogModal: React.FC<PrescriptionActivityLogModalProps> = ({ patient, onClose }) => {
  const { addPrescription, updatePrescription, deletePrescription } = usePatients();
  const [entries, setEntries] = useState<db.PrescriptionActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('全部');
  const [actorFilter, setActorFilter] = useState<string>('全部');
  const [restoringGroup, setRestoringGroup] = useState<string | null>(null);

  const patientId = patient?.院友id;

  const loadLog = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await db.getPrescriptionActivityLog(Number(patientId));
      setEntries(data);
    } catch (err) {
      console.error('載入處方日誌失敗:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const actorOptions = useMemo(() => {
    const names = new Set<string>();
    entries.forEach(e => { if (e.actor_name) names.add(e.actor_name); });
    return Array.from(names);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e =>
      (actionFilter === '全部' || e.action_type === actionFilter) &&
      (actorFilter === '全部' || e.actor_name === actorFilter)
    );
  }, [entries, actionFilter, actorFilter]);

  // 依快照統一 undo 單筆：建立→刪除、刪除→重建、修改→回復
  const undoSingle = async (entry: db.PrescriptionActivityLogEntry, groupId: string | null) => {
    const logMeta = { actionType: 'restore' as const, restoredFromLogId: entry.id, groupId: groupId || undefined };
    const before = entry.snapshot_before;
    const after = entry.snapshot_after;

    if (!before && after) {
      // 曾經是「新增」→ 還原＝刪除
      await deletePrescription(after.id as any, logMeta);
    } else if (before && !after) {
      // 曾經是「刪除」→ 還原＝以原 id 重建
      const { updated_at, ...payload } = before;
      await addPrescription(payload, logMeta);
    } else if (before && after) {
      // 曾經是「修改／狀態遷移」→ 還原＝回復到修改前
      const { created_at, updated_at, ...payload } = before;
      await updatePrescription(payload, logMeta);
    }
  };

  const handleRestore = async (entry: db.PrescriptionActivityLogEntry) => {
    const label = ACTION_TYPE_LABELS[entry.action_type] || entry.action_type;
    const groupId = entry.group_id;
    const targets = groupId ? entries.filter(e => e.group_id === groupId) : [entry];

    const confirmMsg = groupId && targets.length > 1
      ? `確定要還原這組「${label}」操作嗎？將一併還原 ${targets.length} 筆變更。`
      : `確定要還原此「${label}」操作嗎？處方將回復到此操作之前的狀態。`;
    if (!window.confirm(confirmMsg)) return;

    setRestoringGroup(groupId || entry.id);
    try {
      // 逆序還原（先還原較晚發生的變更）
      const ordered = [...targets].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      for (const t of ordered) {
        await undoSingle(t, groupId);
      }
      await loadLog();
    } catch (err) {
      console.error('還原操作失敗:', err);
      alert('還原操作失敗，請重試');
    } finally {
      setRestoringGroup(null);
    }
  };

  const patientName = patient?.中文姓名 || '院友';
  const patientBed = patient?.original_bed_number ? `床號 ${patient.床號}（原${patient.original_bed_number}）` : (patient?.床號 ? `床號 ${patient.床號}` : '');
  const patientGender = patient?.性別 || '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題列 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <History className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">處方日誌</h2>
                <p className="text-sm text-gray-600">
                  {patientName}
                  {patientGender ? ` (${patientGender}` : ''}
                  {patientBed ? `${patientGender ? '·' : ' ('}${patientBed}` : ''}
                  {(patientGender || patientBed) ? ')' : ''}
                  
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* 篩選列 */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="form-input py-1.5 text-sm w-auto"
            >
              <option value="全部">全部動作</option>
              {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="form-input py-1.5 text-sm w-auto"
            >
              <option value="全部">全部用戶</option>
              {actorOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 時間線 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500">載入中…</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-16 w-16 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">尚無處方變動記錄</p>
            </div>
          ) : (
            <ol className="relative border-l border-gray-200 ml-3 space-y-6">
              {filteredEntries.map((entry) => {
                const Icon = ACTION_ICONS[entry.action_type] || Pencil;
                const badgeStyle = ACTION_STYLES[entry.action_type] || 'bg-gray-100 text-gray-700 border-gray-200';
                const actionLabel = ACTION_TYPE_LABELS[entry.action_type] || entry.action_type;
                const isRestoring = restoringGroup === (entry.group_id || entry.id);
                return (
                  <li key={entry.id} className="ml-6">
                    <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full border ${badgeStyle}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${badgeStyle}`}>
                              {actionLabel}
                            </span>
                            {entry.medication_name && (
                              <span className="font-medium text-gray-900">「{entry.medication_name}」</span>
                            )}
                            {(entry.from_status || entry.to_status) && (
                              <span className="text-sm text-gray-600">
                                {entry.from_status ? PRESCRIPTION_STATUS_LABELS[entry.from_status] || entry.from_status : '—'}
                                {' → '}
                                {entry.to_status ? PRESCRIPTION_STATUS_LABELS[entry.to_status] || entry.to_status : '—'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatTimestamp(entry.created_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {entry.actor_name || '未知用戶'}
                              {entry.actor_department ? `（${entry.actor_department}）` : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestore(entry)}
                          disabled={isRestoring}
                          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {isRestoring ? '還原中…' : '還原此操作'}
                        </button>
                      </div>

                      {/* 逐欄差異 */}
                      {entry.field_changes && entry.field_changes.length > 0 && (
                        <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
                          {entry.field_changes.map((c, i) => (
                            <div key={i} className="text-sm flex flex-wrap items-center gap-1">
                              <span className="text-gray-500 min-w-[6rem]">{c.label}:</span>
                              <span className="text-gray-400 line-through">{c.old}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-gray-900 font-medium">{c.new}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrescriptionActivityLogModal;
