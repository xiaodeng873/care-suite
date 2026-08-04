import React from 'react';

/** 女性護士圖標 — 用於 AI 助護浮動按鈕及聊天窗頭部 */
export const NurseIcon: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <img
    src="nurse-avatar.png"
    alt="AI 助護"
    width={size}
    height={size}
    className={`rounded-full ${className}`}
    draggable={false}
  />
);
