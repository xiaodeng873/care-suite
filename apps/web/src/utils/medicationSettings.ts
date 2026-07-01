// 藥物設定：管理處方 modal 中各下拉選單的可設定清單
// 儲存於 localStorage；鍵名固定，方便未來遷移至 Supabase。

export interface MedicationSettingsData {
  劑型: string[];
  服用途徑: string[];
  服用單位: string[];
  特殊用法: string[];
  服用時段: string[];
  每日次數: number[];       // 對應 daily_frequency 的可選值
}

export const DEFAULT_MEDICATION_SETTINGS: MedicationSettingsData = {
  劑型: ['片劑', '膠囊', '藥水', '注射劑', '外用藥膏', '滴劑', '皮膚貼劑'],
  服用途徑: ['口服', '肌肉注射', '皮下注射', '外用', '滴眼', '滴耳', '鼻胃管', '吸入'],
  服用單位: ['粒', '片', '膠囊', '毫升', '滴', '口', '支', '包', '茶匙', '湯匙', 'mg', 'ml', 'g', 'mcg', 'IU'],
  特殊用法: ['適量', '搽患處', '貼在皮膚上', '薄薄一層', '按需要使用'],
  服用時段: [
    '餐前', '進餐時', '餐後',
    '早餐前', '早餐時', '早餐後',
    '午餐前', '午餐時', '午餐後',
    '晚餐前', '晚餐時', '晚餐後',
    '早上', '中午', '晚上', '睡前',
  ],
  每日次數: [1, 2, 3, 4, 5, 6, 8],
};

const STORAGE_KEY = 'care_suite_medication_settings';

export function getMedicationSettings(): MedicationSettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MEDICATION_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<MedicationSettingsData>;
    // Merge with defaults to handle schema additions gracefully
    return {
      ...DEFAULT_MEDICATION_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_MEDICATION_SETTINGS };
  }
}

export function saveMedicationSettings(settings: MedicationSettingsData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetMedicationSettings(): MedicationSettingsData {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_MEDICATION_SETTINGS };
}
