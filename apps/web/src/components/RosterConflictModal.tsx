import React from 'react';
import { X } from 'lucide-react';
import type { UserProfile, LeaveType } from '@care-suite/shared';
import { LEAVE_TYPE_LABELS } from '@care-suite/shared';
import type { AutoRosterConflict } from '../utils/autoRoster';

interface RosterConflictModalProps {
  isOpen: boolean;
  conflicts: AutoRosterConflict[];
  users: UserProfile[];
  onClose: () => void;
  onOverride?: (conflict: AutoRosterConflict) => void;
}

const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  AL: 'bg-purple-100 text-purple-700 border-purple-200',
  PRD: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  DO: 'bg-blue-100 text-blue-700 border-blue-200',
  SL: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  SLN: 'bg-gray-100 text-gray-700 border-gray-200',
  PH: 'bg-pink-100 text-pink-700 border-pink-200',
  SH: 'bg-orange-100 text-orange-700 border-orange-200',
};

export const RosterConflictModal: React.FC<RosterConflictModalProps> = ({
  isOpen,
  conflicts,
  onClose,
  onOverride,
}) => {
  if (!isOpen || conflicts.length === 0) return null;

  // 按日期分組
  const grouped = conflicts.reduce((acc, c) => {
    if (!acc[c.date]) acc[c.date] = [];
    acc[c.date].push(c);
    return acc;
  }, {} as Record<string, AutoRosterConflict[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-lg font-semibold text-gray-900">自動排班無法滿足以下預排要求</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <p className="text-sm text-gray-600">
            以下日期人手可能不足。可點選「仍要職員上班」取消放假或特定上班時間；有暫存班次者會同時插入，無者僅取消預排；必須放假不可 override。
          </p>
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">{date}</div>
              <div className="divide-y divide-gray-100">
                {items.map((conflict, index) => (
                  <div
                    key={`${conflict.user_id}-${index}`}
                    className="flex items-start justify-between gap-3 p-3"
                  >
                    <div className="text-sm text-gray-800 flex-1">
                      <div className="font-medium">{conflict.name_zh}</div>
                      <div className="text-gray-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                        {conflict.recordType === 'leave' && conflict.leaveType && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${
                              LEAVE_TYPE_COLORS[conflict.leaveType]
                            }`}
                          >
                            {LEAVE_TYPE_LABELS[conflict.leaveType]}
                          </span>
                        )}
                        {conflict.recordType === 'availability' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs border bg-green-50 text-green-700 border-green-200">
                            特定上班 {conflict.availabilityStart ?? ''}-{conflict.availabilityEnd ?? ''}
                          </span>
                        )}
                        {conflict.urgency === 'mandatory' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs border bg-red-50 text-red-700 border-red-200">
                            必須
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{conflict.description}</div>
                      {!conflict.canOverride && (
                        <div className="text-xs text-gray-500 mt-1">
                          必須放假：不可 override
                        </div>
                      )}
                    </div>
                    {conflict.canOverride && onOverride && (
                      <button
                        type="button"
                        onClick={() => onOverride(conflict)}
                        className="shrink-0 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        仍要職員上班
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

export default RosterConflictModal;
