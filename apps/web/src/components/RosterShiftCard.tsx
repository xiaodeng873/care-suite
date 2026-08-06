import React, { useState } from 'react';
import type { UserProfile, UserShiftAssignment } from '@care-suite/shared';

interface RosterShiftCardProps {
  user: UserProfile;
  assignment: UserShiftAssignment;
  endTime: string;
  readOnly?: boolean;
  onUpdateTime?: (id: string, startTime: string) => void;
  onDelete?: (id: string) => void;
}

const HOUR_OPTIONS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00',
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00', '23:00',
];

export const RosterShiftCard: React.FC<RosterShiftCardProps> = ({
  user,
  assignment,
  endTime,
  readOnly,
  onUpdateTime,
  onDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [tempStart, setTempStart] = useState(assignment.start_time);

  const handleSave = () => {
    if (tempStart !== assignment.start_time) {
      onUpdateTime?.(assignment.id, tempStart);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-blue-50 border border-blue-200 rounded-md text-xs group">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.name_zh} className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-semibold text-blue-800">
          {user.name_zh.slice(0, 1)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{user.name_zh}</div>
        {editing && !readOnly ? (
          <div className="flex items-center gap-1">
            <select
              value={tempStart}
              onChange={(e) => setTempStart(e.target.value)}
              className="text-xs border border-gray-300 rounded px-1 py-0.5"
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <button onClick={handleSave} className="text-green-600 hover:text-green-800">✓</button>
            <button onClick={() => { setTempStart(assignment.start_time); setEditing(false); }} className="text-red-600 hover:text-red-800">✕</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !readOnly && setEditing(true)}
            disabled={readOnly}
            className="text-blue-700 hover:underline disabled:no-underline disabled:text-gray-500 text-[10px]"
          >
            {assignment.start_time}-{endTime}
          </button>
        )}
      </div>
      {!readOnly && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(assignment.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 px-1 leading-none"
          title="移除班次"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default RosterShiftCard;
