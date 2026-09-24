import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  getPatientStayLog,
  createPatientStayLog,
  deletePatientStayLog,
  type PatientStayLog,
} from '../lib/database';
import { useAuth } from '../context/AuthContext';
import DateInput from './DateInput';
import { formatDisplayDate } from '../utils/dateFormat';
import { ACTION_TYPE_LABELS } from '../utils/bedTransferLogUtils';
import type { BedTransferActionType } from '../lib/database';

interface PatientStayLogTabProps {
  patientId: number | null;
  currentAdmissionType: string;
}

const ADMISSION_TYPE_OPTIONS = ['私位', '買位', '院舍券級別0', '院舍券級別1-7', '暫住'];

// 床位調動 action 值同 bed_transfer_log 一致，用同一套中文標籤顯示
const BED_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'routine_transfer', label: '常規調動' },
  { value: 'temporary_transfer', label: '暫時調動' },
  { value: 'swap', label: '互換' },
  { value: 'return', label: '返回原床' },
];

const EVENT_TYPE_STYLES: Record<PatientStayLog['event_type'], string> = {
  入住: 'bg-green-100 text-green-700',
  類型變更: 'bg-blue-100 text-blue-700',
  退住: 'bg-gray-100 text-gray-700',
  床位調動: 'bg-purple-100 text-purple-700',
};

const getToday = () => new Date().toISOString().split('T')[0];

const bedActionLabel = (action?: string | null) =>
  action ? ACTION_TYPE_LABELS[action as BedTransferActionType] || action : '';

// 每行「詳情」欄文字
const formatDetail = (log: PatientStayLog): string => {
  switch (log.event_type) {
    case '類型變更':
      return `${log.from_type || '—'} → ${log.to_type || '—'}`;
    case '入住':
      return log.to_type || '—';
    case '退住':
      return log.from_type || '—';
    case '床位調動':
      return `${bedActionLabel(log.bed_action)} ${log.from_bed_number || '—'} → ${log.to_bed_number || '—'}`.trim();
    default:
      return '';
  }
};

const PatientStayLogTab: React.FC<PatientStayLogTabProps> = ({ patientId, currentAdmissionType }) => {
  const { user, userProfile, displayName } = useAuth();
  const [logs, setLogs] = useState<PatientStayLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // 新增記錄表單（日期必填、無預設值）
  const [newEventType, setNewEventType] = useState<PatientStayLog['event_type']>('入住');
  const [newEventDate, setNewEventDate] = useState('');
  const [newFromType, setNewFromType] = useState('');
  const [newToType, setNewToType] = useState('');
  const [newBedAction, setNewBedAction] = useState('routine_transfer');
  const [newFromBed, setNewFromBed] = useState('');
  const [newToBed, setNewToBed] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const reload = useCallback(async () => {
    if (patientId == null) return;
    setLoading(true);
    try {
      const rows = await getPatientStayLog(patientId);
      // 新到舊：event_date 降序，同日以 created_at 降序
      rows.sort((a, b) =>
        b.event_date.localeCompare(a.event_date) ||
        (b.created_at || '').localeCompare(a.created_at || '')
      );
      setLogs(rows);
    } catch (error) {
      console.error('載入入住記錄失敗:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (patientId == null) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-500">新增院友儲存後可先至記錄入住資料。</p>
      </div>
    );
  }

  const handleEventTypeChange = (value: PatientStayLog['event_type']) => {
    setNewEventType(value);
    // 類型變更/退住預填現時類型做「由」，入住預填做「至」，方便補錄
    if (value === '類型變更' || value === '退住') setNewFromType(currentAdmissionType || '');
    if (value === '入住') setNewToType(currentAdmissionType || '');
  };

  const handleAdd = async () => {
    if (!newEventDate) {
      alert('請選擇日期');
      return;
    }
    if ((newEventType === '入住' || newEventType === '類型變更') && !newToType) {
      alert('請選擇入住類型');
      return;
    }

    setSaving(true);
    try {
      const isTypeChange = newEventType === '類型變更';
      await createPatientStayLog({
        patient_id: patientId,
        event_type: newEventType,
        event_date: newEventDate,
        from_type: isTypeChange || newEventType === '退住' ? newFromType || null : null,
        to_type: isTypeChange || newEventType === '入住' ? newToType || null : null,
        bed_action: newEventType === '床位調動' ? newBedAction : null,
        from_bed_number: newEventType === '床位調動' ? newFromBed.trim() || null : null,
        to_bed_number: newEventType === '床位調動' ? newToBed.trim() || null : null,
        // 未來日期嘅類型變更標記待生效，到期由系統套用
        applied: !(isTypeChange && newEventDate > getToday()),
        actor_user_id: user?.id || null,
        actor_username: userProfile?.username || user?.email || null,
        actor_name: displayName || user?.email || null,
        notes: newNotes.trim() || null,
      });
      setShowAddForm(false);
      setNewEventType('入住');
      setNewEventDate('');
      setNewFromType('');
      setNewToType('');
      setNewBedAction('routine_transfer');
      setNewFromBed('');
      setNewToBed('');
      setNewNotes('');
      await reload();
    } catch (error: any) {
      console.error('新增入住記錄失敗:', error);
      alert(error?.message || '新增記錄失敗，請重試');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除呢筆記錄嗎？')) return;
    try {
      await deletePatientStayLog(id);
      await reload();
    } catch (error) {
      console.error('刪除入住記錄失敗:', error);
      alert('刪除記錄失敗，請重試');
    }
  };

  const today = getToday();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">入住記錄</h3>
        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="btn-primary text-sm flex items-center gap-1">
          <Plus className="h-4 w-4" />
          <span>新增記錄</span>
        </button>
      </div>

      {showAddForm &&
      <div
        className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3"
        // 呢塊表單嵌喺院友表單入面，擋走 Enter 觸發外層 submit（textarea 除外，保留換行）
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault();
        }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="form-label">事件類型 *</label>
              <select
                value={newEventType}
                onChange={(e) => handleEventTypeChange(e.target.value as PatientStayLog['event_type'])}
                className="form-input">
                <option value="入住">入住</option>
                <option value="類型變更">類型變更</option>
                <option value="退住">退住</option>
                <option value="床位調動">床位調動</option>
              </select>
            </div>
            <div>
              <label className="form-label">日期 *</label>
              <DateInput value={newEventDate} className="form-input" required onChange={(value) => setNewEventDate(value)} />
            </div>
          </div>

          {(newEventType === '類型變更' || newEventType === '退住') &&
          <div>
            <label className="form-label">{newEventType === '類型變更' ? '由類型' : '入住類型'}</label>
            <select value={newFromType} onChange={(e) => setNewFromType(e.target.value)} className="form-input">
              <option value="">請選擇</option>
              {ADMISSION_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          }

          {(newEventType === '類型變更' || newEventType === '入住') &&
          <div>
            <label className="form-label">{newEventType === '類型變更' ? '至類型 *' : '入住類型 *'}</label>
            <select value={newToType} onChange={(e) => setNewToType(e.target.value)} className="form-input">
              <option value="">請選擇</option>
              {ADMISSION_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          }

          {newEventType === '床位調動' &&
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="form-label">調動類型</label>
              <select value={newBedAction} onChange={(e) => setNewBedAction(e.target.value)} className="form-input">
                {BED_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">由床位</label>
              <input
                type="text"
                value={newFromBed}
                onChange={(e) => setNewFromBed(e.target.value)}
                className="form-input"
                placeholder="例如：A101-1" />
            </div>
            <div>
              <label className="form-label">至床位</label>
              <input
                type="text"
                value={newToBed}
                onChange={(e) => setNewToBed(e.target.value)}
                className="form-input"
                placeholder="例如：A102-2" />
            </div>
          </div>
          }

          <div>
            <label className="form-label">備註</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="form-input"
              rows={2}
              placeholder="可選" />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={handleAdd} disabled={saving} className="btn-primary flex-1">
              {saving ? '儲存中...' : '儲存記錄'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary flex-1">
              取消
            </button>
          </div>
        </div>
      }

      {loading ?
      <p className="text-sm text-gray-500">載入中...</p> :
      logs.length === 0 ?
      <p className="text-sm text-gray-500">暫無記錄</p> :

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">日期</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">事件</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">詳情</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">記錄人</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => {
              const pending = log.event_type === '類型變更' && !log.applied && log.event_date > today;
              return (
                <tr key={log.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDisplayDate(log.event_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_STYLES[log.event_type]}`}>
                      {log.event_type}
                    </span>
                    {pending &&
                    <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                        待生效
                      </span>
                    }
                  </td>
                  <td className="px-3 py-2">
                    {formatDetail(log)}
                    {log.notes && <span className="block text-xs text-gray-500 mt-0.5">{log.notes}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{log.actor_name || log.actor_username || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleDelete(log.id)}
                      className="text-red-500 hover:text-red-700"
                      title="刪除記錄">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      }
    </div>
  );
};

export default PatientStayLogTab;
