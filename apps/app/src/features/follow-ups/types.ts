export type FollowUpStatus = '尚未安排' | '已安排' | '已完成' | '改期' | '取消';

export interface FollowUpAppointment {
  覆診id: string;
  院友id: number;
  覆診日期: string;
  出發時間?: string;
  覆診時間?: string;
  覆診地點?: string;
  覆診專科?: string;
  交通安排?: string;
  陪診人員?: string;
  備註?: string;
  狀態: FollowUpStatus;
  創建時間: string;
  更新時間: string;
}

export const STATUS_COLOR: Record<FollowUpStatus, { bg: string; text: string }> = {
  尚未安排: { bg: 'bg-gray-100',   text: 'text-gray-600' },
  已安排:   { bg: 'bg-blue-100',   text: 'text-blue-700' },
  已完成:   { bg: 'bg-green-100',  text: 'text-green-700' },
  改期:     { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  取消:     { bg: 'bg-red-100',    text: 'text-red-600' },
};

export const ALL_STATUSES: FollowUpStatus[] = ['尚未安排', '已安排', '已完成', '改期', '取消'];

// 完全對應 web FollowUpModal 的選項
export const HOSPITAL_OPTIONS = ['廣華醫院', '伊利沙伯醫院', '九龍醫院', '葵涌醫院', '瑪嘉烈醫院', '威爾斯醫院', '聯合醫院', '明愛醫院'] as const;
export const TRANSPORT_OPTIONS = ['輪椅的士', '普通的士', '非緊急車', '無需安排'] as const;
export const COMPANION_OPTIONS = ['家人', '陪診員', '無需陪診'] as const;
