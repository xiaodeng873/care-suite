import React, { useRef, useState } from 'react';
import type { UserProfile, UserShiftAssignment } from '@care-suite/shared';
import { getEmploymentPosition, POSITION_CARD_CODES } from '@care-suite/shared';

interface RosterShiftCardProps {
  user: UserProfile;
  assignment: UserShiftAssignment;
  endTime: string;
  readOnly?: boolean;
  onUpdateTime?: (id: string, startTime: string, endTime: string) => void;
  onDelete?: (id: string) => void;
  onDragStart?: (assignment: UserShiftAssignment) => void;
  onDragEnd?: () => void;
  onDragOverItem?: (e: React.DragEvent, assignmentId: string, insertBefore: boolean) => void;
  onDropItem?: (e: React.DragEvent, assignmentId: string, insertBefore: boolean) => void;
  onDragLeaveItem?: (assignmentId: string) => void;
  isDragOver?: boolean;
  insertBefore?: boolean;
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
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onDropItem,
  onDragLeaveItem,
  isDragOver,
  insertBefore,
}) => {
  const [editing, setEditing] = useState(false);
  const [tempStart, setTempStart] = useState(assignment.start_time);
  const [tempEnd, setTempEnd] = useState(endTime);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragImageRef = useRef<HTMLElement | null>(null);
  const position = getEmploymentPosition(user);
  const positionCode = position ? POSITION_CARD_CODES[position] : undefined;

  const handleSave = () => {
    const start = tempStart.slice(0, 5);
    const end = tempEnd.slice(0, 5);
    if (start !== assignment.start_time || end !== endTime) {
      onUpdateTime?.(assignment.id, start, end);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setTempStart(assignment.start_time);
    setTempEnd(endTime);
    setEditing(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', assignment.id);
    e.dataTransfer.setData('assignmentId', assignment.id);
    e.dataTransfer.setData('userId', assignment.user_id);
    e.dataTransfer.effectAllowed = 'move';

    const original = cardRef.current;
    if (original) {
      const clone = original.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.top = '-1000px';
      clone.style.left = '-1000px';
      clone.style.width = `${original.offsetWidth}px`;
      clone.style.zIndex = '-1';
      clone.style.pointerEvents = 'none';
      clone.style.margin = '0';
      document.body.appendChild(clone);
      dragImageRef.current = clone;
      try {
        e.dataTransfer.setDragImage(clone, 0, 0);
      } catch {
        // 若瀏覽器不支援 setDragImage，則使用預設影像
      }
    }

    onDragStart?.(assignment);
  };

  const handleDragEnd = () => {
    if (dragImageRef.current && dragImageRef.current.parentNode) {
      dragImageRef.current.parentNode.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
    onDragEnd?.();
  };

  return (
    <div
      ref={cardRef}
      draggable={!readOnly}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        onDragOverItem?.(e, assignment.id, before);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        onDropItem?.(e, assignment.id, before);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        onDragLeaveItem?.(assignment.id);
      }}
      className={`flex items-center gap-1.5 p-1.5 bg-blue-50 border rounded-md text-xs group cursor-move select-none transition-colors ${
        isDragOver
          ? insertBefore
            ? 'border-t-2 border-red-400 border-b border-blue-200'
            : 'border-b-2 border-red-400 border-t border-blue-200'
          : 'border-blue-200'
      }`}
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.name_zh} draggable={false} className="h-5 w-5 rounded-full object-cover select-none" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-semibold text-blue-800 select-none">
          {user.name_zh.slice(0, 1)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate select-none">
          {positionCode && <span className="text-[10px] font-normal text-gray-500 mr-1">{positionCode}</span>}
          {user.name_zh}
        </div>
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
            <span className="text-gray-400">-</span>
            <select
              value={tempEnd}
              onChange={(e) => setTempEnd(e.target.value)}
              className="text-xs border border-gray-300 rounded px-1 py-0.5"
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <button onClick={handleSave} className="text-green-600 hover:text-green-800">✓</button>
            <button onClick={handleCancel} className="text-red-600 hover:text-red-800">✕</button>
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
