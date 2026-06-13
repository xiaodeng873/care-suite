/** 工作頻率單位常數（純資料，無 side-effect 依賴） */
export type FrequencyUnit = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export const FREQUENCY_UNITS: { key: FrequencyUnit; label: string }[] = [
  { key: 'hourly',  label: '每小時' },
  { key: 'daily',   label: '每日'   },
  { key: 'weekly',  label: '每週'   },
  { key: 'monthly', label: '每月'   },
  { key: 'yearly',  label: '每年'   },
];
