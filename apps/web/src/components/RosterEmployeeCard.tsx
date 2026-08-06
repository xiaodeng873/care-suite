import React, { useRef, useState } from 'react';
import type { UserProfile, UserEmploymentDetails } from '@care-suite/shared';
import { getEmploymentPosition } from '@care-suite/shared';
import { calculateAge, formatTimeRange, getDailyContractHours, getUserAllPositions } from '../utils/roster';

interface RosterEmployeeCardProps {
  user: UserProfile;
  details: UserEmploymentDetails | null;
  doBalance: number;
  prdBalance: number;
  alBalance: number;
  onDragStart?: (user: UserProfile) => void;
  onDragEnd?: () => void;
}

export const RosterEmployeeCard: React.FC<RosterEmployeeCardProps> = ({
  user,
  details,
  doBalance,
  prdBalance,
  alBalance,
  onDragStart,
  onDragEnd,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragImageRef = useRef<HTMLElement | null>(null);
  const positions = getUserAllPositions(user);
  const primary = getEmploymentPosition(user);
  const displayPosition = primary || positions[0] || '未設定';
  const secondaryText = positions.filter((p) => p !== displayPosition).join('、');
  const dailyHours = getDailyContractHours(details);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', user.id);
    e.dataTransfer.setData('userId', user.id);
    e.dataTransfer.effectAllowed = 'copy';

    // 建立自訂拖曳影像，避免瀏覽器預設 ghost image 把整個側欄/tooltip 一起拖出重影
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
      // 移除 tooltip 等 fixed 子元素，避免它們出現在拖曳影像中
      clone.querySelectorAll('.fixed, [data-drag-remove]').forEach((el) => el.remove());
      document.body.appendChild(clone);
      dragImageRef.current = clone;
      try {
        e.dataTransfer.setDragImage(clone, 0, 0);
      } catch {
        // 若瀏覽器不支援 setDragImage，則使用預設影像
      }
    }

    onDragStart?.(user);
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
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className="relative flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg shadow-sm cursor-move hover:border-blue-400 hover:shadow-md transition-all select-none"
    >
      <div className="flex-shrink-0">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name_zh}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="h-9 w-9 rounded-full object-cover select-none"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 select-none">
            {user.name_zh.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate select-none">{user.name_zh}</div>
        <div className="text-xs text-gray-500 truncate select-none">
          {displayPosition}
          {secondaryText && <span className="text-gray-400 ml-1">, {secondaryText}</span>}
        </div>
        <div className="text-xs text-gray-400 select-none">
          {dailyHours != null ? `${dailyHours}h/日` : '未設工時'}
        </div>
      </div>

      {showTooltip && (
        <div className="fixed z-[70] bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 w-56 pointer-events-none"
          style={{ top: '0.5rem', left: '105%' }}
        >
          <div className="font-semibold mb-1">{user.name_zh}</div>
          <div className="space-y-0.5">
            {user.id_number && <div>身份證：{user.id_number}</div>}
            {user.date_of_birth && (
              <div>
                出生：{user.date_of_birth} ({calculateAge(user.date_of_birth)}歲)
              </div>
            )}
            <div className="pt-1 border-t border-gray-700 mt-1">
              結餘（正=有餘 / 負=透支）
            </div>
            <div>DO：{doBalance >= 0 ? `+${doBalance}` : doBalance}</div>
            <div>PRD：{prdBalance >= 0 ? `+${prdBalance}` : prdBalance}</div>
            <div>AL：{alBalance >= 0 ? `+${alBalance}` : alBalance}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterEmployeeCard;
