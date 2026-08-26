import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { UserProfile, LeaveType, UserLeaveRecord } from '@care-suite/shared';
import { LEAVE_TYPE_LABELS } from '@care-suite/shared';
import { validateScheduledLeave } from '../utils/leaveValidation';
import type { RosterLeaveContext } from '../utils/leaveValidation';
import DateInput from './DateInput';

export interface RosterLeaveModalPayload {
  id?: string;
  leaveDate: string;
  recordType: 'leave' | 'availability';
  leaveType: LeaveType | null;
  urgency: 'mandatory' | 'preferred';
  referencePublicHolidayId?: string | null;
  availabilityStartTime?: string | null;
  availabilityEndTime?: string | null;
}

interface RosterLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: RosterLeaveModalPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  user: UserProfile;
  initialDate?: string;
  editingRecord?: UserLeaveRecord | null;
  context: RosterLeaveContext;
}

const BASE_LEAVE_OPTIONS: LeaveType[] = ['AL', 'DO', 'PRD', 'SL', 'SLN'];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const RosterLeaveModal: React.FC<RosterLeaveModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  user,
  initialDate,
  editingRecord,
  context,
}) => {
  const [recordType, setRecordType] = useState<'leave' | 'availability'>('leave');
  const [leaveType, setLeaveType] = useState<LeaveType>('DO');
  const [leaveDate, setLeaveDate] = useState(initialDate ?? '');
  const [isMandatory, setIsMandatory] = useState(false);
  const [availabilityStart, setAvailabilityStart] = useState('09:00');
  const [availabilityEnd, setAvailabilityEnd] = useState('18:00');
  const [selectedHolidayId, setSelectedHolidayId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPartTime = user.employment_type === '兼職';

  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        setRecordType(editingRecord.record_type);
        setLeaveType(editingRecord.leave_type ?? 'DO');
        setLeaveDate(editingRecord.leave_date);
        setIsMandatory(editingRecord.urgency === 'mandatory');
        setAvailabilityStart(editingRecord.availability_start_time ?? '09:00');
        setAvailabilityEnd(editingRecord.availability_end_time ?? '18:00');
        setSelectedHolidayId(editingRecord.reference_public_holiday_id ?? '');
      } else {
        setRecordType(isPartTime ? 'availability' : 'leave');
        setLeaveType('DO');
        setLeaveDate(initialDate ?? '');
        setIsMandatory(false);
        setAvailabilityStart('09:00');
        setAvailabilityEnd('18:00');
        setSelectedHolidayId('');
      }
      setError(null);
      setSaving(false);
      setDeleting(false);
    }
  }, [isOpen, initialDate, editingRecord, isPartTime]);

  const dateLabel = useMemo(() => {
    if (!leaveDate) return '';
    const d = new Date(leaveDate);
    if (isNaN(d.getTime())) return '';
    return `${leaveDate}（星期${WEEKDAYS[d.getDay()]}）`;
  }, [leaveDate]);

  const leaveOptions = useMemo(() => {
    if (isPartTime) return [] as LeaveType[];
    const opts = [...BASE_LEAVE_OPTIONS];
    if (context.publicHolidayType === 'PH') opts.push('PH');
    if (context.publicHolidayType === 'SH') opts.push('SH');
    return opts;
  }, [context.publicHolidayType, isPartTime]);

  useEffect(() => {
    if (!leaveOptions.includes(leaveType)) {
      setLeaveType(leaveOptions[0] ?? 'DO');
    }
  }, [leaveOptions, leaveType]);

  const availableHolidays = useMemo(() => {
    if (leaveType !== 'PH' && leaveType !== 'SH') return [];
    return context.publicHolidays.filter(
      (h) => h.type === leaveType && !context.usedHolidayIds.has(h.id),
    );
  }, [leaveType, context.publicHolidays, context.usedHolidayIds]);

  useEffect(() => {
    if (leaveType === 'PH' || leaveType === 'SH') {
      const first = availableHolidays[0];
      setSelectedHolidayId(first?.id ?? '');
    } else {
      setSelectedHolidayId('');
    }
  }, [leaveType, availableHolidays]);

  const balanceText = useMemo(() => {
    if (leaveType === 'DO') return `DO 尚可排 ${context.doBalance} 天`;
    if (leaveType === 'PRD') {
      const available = Math.floor(context.restDayFraction + context.prdExpected);
      return `PRD 尚可排 ${available} 天`;
    }
    if (leaveType === 'AL') return `AL 尚可請 ${context.alBalance} 天`;
    if (leaveType === 'PH' || leaveType === 'SH') {
      return `${LEAVE_TYPE_LABELS[leaveType]} 尚有 ${availableHolidays.length} 個未預排`;
    }
    return null;
  }, [leaveType, context, availableHolidays.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: RosterLeaveModalPayload = {
      id: editingRecord?.id,
      leaveDate,
      recordType,
      leaveType: recordType === 'leave' ? leaveType : null,
      urgency: isMandatory ? 'mandatory' : 'preferred',
      referencePublicHolidayId:
        recordType === 'leave' && (leaveType === 'PH' || leaveType === 'SH')
          ? selectedHolidayId || null
          : null,
      availabilityStartTime: recordType === 'availability' ? availabilityStart.slice(0, 5) : null,
      availabilityEndTime: recordType === 'availability' ? availabilityEnd.slice(0, 5) : null,
    };

    const validation = validateScheduledLeave(payload, context, editingRecord?.id);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            預排：{user.name_zh}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <DateInput
              value={leaveDate}
              onChange={(v) => setLeaveDate(v)}
              required
            />
            {dateLabel && <p className="text-xs text-gray-500 mt-1">{dateLabel}</p>}
          </div>

          {!isPartTime && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">預排類型</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRecordType('leave')}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    recordType === 'leave'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  放假
                </button>
                <button
                  type="button"
                  onClick={() => setRecordType('availability')}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    recordType === 'availability'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  特定上班時間
                </button>
              </div>
            </div>
          )}
          {isPartTime && (
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
              兼職員工不設假期額度，只可設定特定上班時間。
            </p>
          )}

          <div className="flex items-start gap-3">
            <input
              id="mandatory"
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="mt-0.5 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <div>
              <label htmlFor="mandatory" className="text-sm font-medium text-gray-700">
                必須
              </label>
               </div>
          </div>

          {recordType === 'leave' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">假別</label>
                <div className="grid grid-cols-4 gap-2">
                  {leaveOptions.map((type) => (
                    <button
                      key={type}
                      type="button"
                      title={LEAVE_TYPE_LABELS[type]}
                      onClick={() => setLeaveType(type)}
                      className={`px-2 py-2 text-sm font-semibold rounded-lg border ${
                        leaveType === type
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {balanceText && (
                <p className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  餘額：{balanceText}
                </p>
              )}

              {(leaveType === 'PH' || leaveType === 'SH') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {leaveType === 'PH' ? '銀行假期' : '勞工假期'}
                  </label>
                  <select
                    value={selectedHolidayId}
                    onChange={(e) => setSelectedHolidayId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {availableHolidays.length === 0 && (
                      <option value="">暫無可用假期</option>
                    )}
                    {availableHolidays.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.holiday_date} {h.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    預排日只需與實際假期同月即可。
                  </p>
                </div>
              )}
            </div>
          )}

          {recordType === 'availability' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                  <input
                    type="time"
                    value={availabilityStart}
                    onChange={(e) => setAvailabilityStart(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">結束時間</label>
                  <input
                    type="time"
                    value={availabilityEnd}
                    onChange={(e) => setAvailabilityEnd(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                自動排班只會在這個時段內為該員工安排班次。
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {editingRecord && onDelete && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('確定刪除此預排？')) return;
                  setDeleting(true);
                  try {
                    await onDelete();
                    onClose();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : '刪除失敗');
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting || saving}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 mr-auto"
              >
                {deleting ? '刪除中...' : '刪除'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RosterLeaveModal;
