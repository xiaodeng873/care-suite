import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { UserProfile, LeaveType, PublicHoliday } from '@care-suite/shared';
import { LEAVE_TYPE_LABELS } from '@care-suite/shared';
import { validateScheduledLeave } from '../utils/leaveValidation';
import type { RosterLeaveContext } from '../utils/leaveValidation';

interface RosterLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    leaveDate: string;
    leaveType: LeaveType;
    referencePublicHolidayId?: string | null;
  }) => Promise<void>;
  user: UserProfile;
  initialDate?: string;
  context: RosterLeaveContext;
}

const LEAVE_OPTIONS: LeaveType[] = ['PH', 'SH', 'DO', 'PRD', 'AL', 'SL', 'CL', 'NPL'];

export const RosterLeaveModal: React.FC<RosterLeaveModalProps> = ({
  isOpen,
  onClose,
  onSave,
  user,
  initialDate,
  context,
}) => {
  const [leaveType, setLeaveType] = useState<LeaveType>('DO');
  const [leaveDate, setLeaveDate] = useState(initialDate ?? '');
  const [selectedHolidayId, setSelectedHolidayId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLeaveType('DO');
      setLeaveDate(initialDate ?? '');
      setSelectedHolidayId('');
      setError(null);
      setSaving(false);
    }
  }, [isOpen, initialDate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      leaveDate,
      leaveType,
      referencePublicHolidayId:
        leaveType === 'PH' || leaveType === 'SH' ? selectedHolidayId || null : null,
    };

    const validation = validateScheduledLeave(payload, context);
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
            預排假期：{user.name_zh}
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
            <input
              type="date"
              value={leaveDate}
              onChange={(e) => setLeaveDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">假別</label>
            <div className="grid grid-cols-4 gap-2">
              {LEAVE_OPTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLeaveType(type)}
                  className={`px-2 py-2 text-sm rounded-lg border ${
                    leaveType === type
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {LEAVE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
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
