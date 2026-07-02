// 藥物設定：管理處方 modal 中各下拉選單的可設定清單
// 儲存於 localStorage；鍵名固定，方便未來遷移至 Supabase。

export interface MedicationSettingsData {
  劑型: string[];
  服用途徑: string[];
  服用單位: string[];
  特殊用法: string[];
  服用時段: string[];
  每日次數: number[];       // 對應 daily_frequency 的可選值
  藥物來源: string[];       // 處方藥物來源下拉清單
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
  藥物來源: [
    'KWH 廣華醫院',
    'QEH 伊利沙伯醫院',
    'QMH 瑪麗醫院',
    'PWH 威爾斯親王醫院',
    'PMH 瑪嘉烈醫院',
    'TMH 屯門醫院',
    'POH 博愛醫院',
    'UCH 基督教聯合醫院',
    'PYNEH 東區尤德夫人那打素醫院',
    'NDH 北區醫院',
    'AH 雅麗氏何妙齡那打素醫院',
    'CMC 明愛醫院',
    'YCH 仁濟醫院',
    'RH 律敦治醫院',
    'GTH 葛量洪醫院',
    'CPH 青山醫院',
    'TKOH 將軍澳醫院',
    'NLH 北大嶼山醫院',
    'WCH 黃竹坑醫院',
    'HTH 靈實醫院',
    'TSH 贊育醫院',
    'SH 沙田醫院',
    'SKH 石硤尾醫院',
    'KH 九龍醫院',
    'TWH 大埔醫院',
    'BCH 白普理寧養中心',
    '私家診所',
    '私家藥房',
    '出院病房配發',
    '其他',
  ],
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
