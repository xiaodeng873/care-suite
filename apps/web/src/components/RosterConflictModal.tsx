import React from 'react';
import { X } from 'lucide-react';
import type { UserProfile } from '@care-suite/shared';
import type { AutoRosterConflict } from '../utils/autoRoster';

interface RosterConflictModalProps {
  isOpen: boolean;
  conflicts: AutoRosterConflict[];
  users: UserProfile[];
  onClose: () => void;
  onOverride?: (userId: string, date: string) => void;
}

export const RosterConflictModal: React.FC<RosterConflictModalProps> = ({
  isOpen,
  conflicts,
  users,
  onClose,
  onOverride,
}) => {
  if (!isOpen || conflicts.length === 0) return null;

  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-lg font-semibold text-gray-900">自動排班無法滿足以下預排要求</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          <p className="text-sm text-gray-600">以下日期人手可能不足，建議與員工協商：</p>
          {conflicts.map((conflict, index) => {
            const user = userMap.get(conflict.user_id);
            return (
              <div
                key={`${conflict.user_id}-${conflict.date}-${index}`}
                className="flex items-start justify-between gap-3 bg-gray-50 rounded-lg p-3"
              >
                <div className="text-sm text-gray-800">
                  <div className="font-medium">
                    {conflict.date}：{user?.name_zh ?? conflict.user_id}
                  </div>
                  <div className="text-gray-600 mt-0.5">{conflict.description}</div>
                  {conflict.urgency === 'mandatory' && (
                    <div className="text-xs text-red-600 mt-1">必須：無法 override</div>
                  )}
                </div>
                {conflict.urgency === 'preferred' && onOverride && (
                  <button
                    type="button"
                    onClick={() => onOverride(conflict.user_id, conflict.date)}
                    className="shrink-0 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    要求職員上班
                  </button>
                )}
              </div>
            );
          })}
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
