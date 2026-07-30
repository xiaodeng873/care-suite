import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Clock,
  User,
  Plus,
  LogOut,
  ArrowRight,
  ArrowRightLeft,
  RotateCcw,
  Ban,
  MapPin,
  History,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import * as db from '../lib/database';
import BedNumberImprint from './BedNumberImprint';
import {
  ACTION_TYPE_LABELS,
  ACTION_TYPE_STYLES,
  formatBedTransferDescription,
  formatTimestamp,
} from '../utils/bedTransferLogUtils';

interface BedTransferLogModalProps {
  patient?: any; // 院友主表 record（含 院友id, 中文姓名, 性別, 床號）
  bedId?: string;
  bedNumber?: string;
  title?: string;
  onClose: () => void;
}

const ACTION_ICONS: Record<db.BedTransferActionType, React.ComponentType<{ className?: string }>> = {
  admission: Plus,
  discharge: LogOut,
  routine_transfer: ArrowRight,
  temporary_transfer: ArrowRight,
  swap: ArrowRightLeft,
  return: RotateCcw,
  cancel_temporary: Ban,
  original_bed_change: MapPin,
};

const BedTransferLogModal: React.FC<BedTransferLogModalProps> = ({
  patient,
  bedId,
  bedNumber,
  title,
  onClose,
}) => {
  const [entries, setEntries] = useState<db.BedTransferLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<db.BedTransferActionType | '全部'>('全部');
  const [actorFilter, setActorFilter] = useState<string>('全部');

  const isPatientMode = !!patient?.院友id;
  const isAllBedsMode = !isPatientMode && !bedId;
  const patientId = patient?.院友id;

  const loadLog = async () => {
    setLoading(true);
    try {
      let data: db.BedTransferLogEntry[] = [];
      if (isPatientMode && patientId) {
        data = await db.getBedTransferLog(Number(patientId));
      } else if (bedId) {
        data = await db.getBedTransferLogByBedId(bedId);
      } else {
        data = await db.getAllBedTransferLog();
      }
      setEntries(data);
    } catch (err) {
      console.error('載入床位調動日誌失敗:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, bedId]);

  const actorOptions = useMemo(() => {
    const names = new Set<string>();
    entries.forEach(e => { if (e.actor_name) names.add(e.actor_name); });
    return Array.from(names);
  }, [entries]);

  const actionOptions = useMemo(() => {
    const types = new Set<db.BedTransferActionType>();
    entries.forEach(e => { if (e.action_type) types.add(e.action_type); });
    return Array.from(types);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e =>
      (actionFilter === '全部' || e.action_type === actionFilter) &&
      (actorFilter === '全部' || e.actor_name === actorFilter)
    );
  }, [entries, actionFilter, actorFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這條調動日誌嗎？此操作無法復原。')) return;
    try {
      await db.deleteBedTransferLogEntry(id);
      await loadLog();
    } catch (err) {
      console.error('刪除床位調動日誌失敗:', err);
      alert('刪除失敗，請重試');
    }
  };

  const headerTitle = title || (isPatientMode ? '院友床位調動日誌' : '床位調動日誌');
  const patientName = patient?.中文姓名 || '院友';
  const patientBed = patient?.original_bed_number ? `床號 ${patient.床號}（原${patient.original_bed_number}）` : (patient?.床號 ? `床號 ${patient.床號}` : '');
  const patientGender = patient?.性別 || '';
  const subtitle = isPatientMode
    ? `${patientName}${patientGender ? ` (${patientGender}` : ''}${patientBed ? `${patientGender ? ' · ' : ' ('}${patientBed}` : ''}${(patientGender || patientBed) ? ')' : ''}`
    : (bedNumber ? `床位 ${bedNumber}` : '全部床位');

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
                <h2 className="text-xl font-semibold text-gray-900">{headerTitle}</h2>
                {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
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
              onChange={(e) => setActionFilter(e.target.value as any)}
              className="form-input py-1.5 text-sm w-auto"
            >
              <option value="全部">全部動作</option>
              {actionOptions.map(k => (
                <option key={k} value={k}>{ACTION_TYPE_LABELS[k] || k}</option>
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
              <p className="text-gray-500">尚無床位調動記錄</p>
            </div>
          ) : (
            <ol className="relative border-l border-gray-200 ml-3 space-y-6">
              {filteredEntries.map((entry) => {
                const Icon = ACTION_ICONS[entry.action_type] || ArrowRight;
                const badgeStyle = ACTION_TYPE_STYLES[entry.action_type] || 'bg-gray-100 text-gray-700 border-gray-200';
                const actionLabel = ACTION_TYPE_LABELS[entry.action_type] || entry.action_type;
                const description = formatBedTransferDescription(entry);
                const failed = entry.transfer_subtype === 'failed_root_occupied';
                return (
                  <li key={entry.id} className="ml-6">
                    <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full border ${badgeStyle}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className={`bg-white border rounded-lg p-4 shadow-sm ${failed ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${badgeStyle}`}>
                              {actionLabel}
                            </span>
                            {failed && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded border bg-red-100 text-red-700 border-red-200 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                失敗
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 mt-1">{description}</p>
                          <p className="text-sm text-gray-700 mt-1">
                            院友：{entry.patient_name || '未知院友'}
                          </p>
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
                          onClick={() => handleDelete(entry.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="刪除記錄"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {entry.notes && (
                        <div className="mt-3 border-t border-gray-100 pt-2 text-sm text-gray-600">
                          {entry.notes}
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

export default BedTransferLogModal;
