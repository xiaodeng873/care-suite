// 藥物設定：管理處方 modal 中各下拉選單的可設定清單
// 儲存於 localStorage；鍵名固定，方便未來遷移至 Supabase。

export interface MedicationSettingsData {
  劑型: string[];
  服用途徑: string[];
  服用單位: string[];
  特殊用法: string[];
  服用時段: string[];
  每日次數: number[];       // 對應 daily_frequency 的可選值
  藥物來源: string[];       // 舊版平面來源清單（保留向後相容，新版改用機構分組）
  機構_醫管局醫院: string[]; // 藥物來源機構：醫管局醫院
  機構_醫管局門診: string[]; // 藥物來源機構：醫管局普通科門診
  機構_醫管局精神科: string[]; // 藥物來源機構：醫管局精神科門診
  機構_衛生署: string[];     // 藥物來源機構：衛生署診所
  機構_其他: string[];       // 藥物來源機構：其他
  專科: string[];            // 醫管局專科下拉
}

// 機構下拉分組設定：label 為 optgroup 標題，key 為設定欄位，category 用於 HA/DH 判定
export const INSTITUTION_GROUPS: { label: string; key: keyof MedicationSettingsData; category: 'ha' | 'dh' | 'other' }[] = [
  { label: '醫管局 — 醫院', key: '機構_醫管局醫院', category: 'ha' },
  { label: '醫管局 — 普通科門診', key: '機構_醫管局門診', category: 'ha' },
  { label: '醫管局 — 精神科門診', key: '機構_醫管局精神科', category: 'ha' },
  { label: '衛生署診所', key: '機構_衛生署', category: 'dh' },
  { label: '其他', key: '機構_其他', category: 'other' },
];

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
  // 舊版平面清單保留（不再於 modal 使用）
  藥物來源: [],
  機構_醫管局醫院: [
    '瑪麗醫院', '東區尤德夫人那打素醫院', '律敦治醫院', '鄧肇堅醫院', '東華醫院', '東華東院',
    '葛量洪醫院', '黃竹坑醫院', '贊育醫院', '大口環根德公爵夫人兒童醫院', '舂坎角慈氏護養院',
    '伊利沙伯醫院', '廣華醫院', '聖母醫院', '九龍醫院', '香港眼科醫院', '香港佛教醫院', '播道醫院',
    '基督教聯合醫院', '將軍澳醫院', '靈實醫院', '瑪嘉烈醫院', '葵涌醫院', '明愛醫院', '北大嶼山醫院',
    '香港兒童醫院', '威爾斯親王醫院', '沙田醫院', '白普理寧養中心', '大埔醫院',
    '雅麗氏何妙齡那打素醫院', '北區醫院', '沙田慈氏護養院', '屯門醫院', '博愛醫院', '仁濟醫院',
    '青山醫院', '天水圍醫院', '小欖醫院',
  ],
  機構_醫管局門診: [
    '柏立基夫人普通科門診診所', '柴灣普通科門診診所', '北南丫普通科門診診所', '坪洲普通科門診診所',
    '西灣河普通科門診診所', '筲箕灣賽馬會普通科門診診所', '索罟灣普通科門診診所', '長洲醫院普通科門診部',
    '赤柱普通科門診診所', '東華東院普通科門診部', '貝夫人普通科門診診所', '環翠普通科門診診所',
    '香港仔賽馬會普通科門診診所', '鴨脷洲普通科門診診所', '中區健康院普通科門診診所',
    '堅尼地城賽馬會普通科門診診所', '西營盤賽馬會普通科門診診所', '東華醫院普通科門診診所',
    '中九龍診所', '東九龍普通科門診診所',
  ],
  機構_醫管局精神科: [
    '東區尤德夫人那打素醫院精神科門診', '瑪麗醫院精神科門診', '戴麟趾康復中心（精神科門診）',
    '九龍醫院精神科門診', '明愛醫院精神科門診', '東九龍精神科中心', '容鳳書紀念中心（精神科門診）',
    '油麻地兒童及青少年精神健康服務', '威爾斯親王醫院精神科門診', '雅麗氏何妙齡那打素醫院精神科門診',
    '沙田醫院精神科門診', '大埔醫院精神科門診', '將軍澳醫院精神科門診', '屯門醫院精神科門診',
    '青山醫院精神科門診', '葵涌醫院精神科門診', '葵涌老齡精神科門診部暨照顧者支援中心',
    '葵涌兒童及青少年精神科中心', '西九龍精神科中心', '北區醫院精神科門診',
  ],
  機構_衛生署: [
    '柴灣社會衞生科診所', '長沙灣皮膚科診所', '粉嶺綜合治療中心(社會衞生科)', '容鳳書皮膚科診所',
    '油麻地皮膚科診所', '西營盤皮膚科診所', '屯門社會衞生科診所', '油麻地女性社會衞生科診所',
    '油麻地男性社會衞生科診所', '容鳳書社會衞生科診所', '灣仔男性社會衞生科診所', '灣仔女性社會衞生科診所',
    '長沙灣政府合署牙科診所', '將軍澳牙科診所', '李寶椿牙科診所', '觀塘牙科診所', '下葵涌政府牙科診所',
    '荃灣政府合署牙科診所', '容鳳書牙科診所', '仁愛牙科診所', '青山醫院牙科診所', '元朗賽馬會牙科診所',
    '荃灣牙科診所', '西營盤牙科診所八樓', '海港政府大樓牙齒矯正科診所', '海港政府大樓牙科診所',
    '香港仔賽馬會牙科診所', '柴灣政府牙科診所', '鄧肇堅牙科診所', '灣仔牙科診所', '馬鞍山牙科診所',
    '尤德夫人政府牙科診所',
  ],
  機構_其他: ['私家診所', '私家藥房', '出院病房配發', '其他'],
  專科: [
    '內科', '外科', '骨科', '婦產科', '兒科', '眼科', '耳鼻喉科', '精神科', '皮膚科', '心臟科',
    '臨床腫瘤科', '神經外科', '神經科', '腎科', '內分泌及糖尿科', '老人科', '復康科', '泌尿外科',
    '風濕科', '呼吸系統科', '腸胃肝臟科', '血液科', '感染及傳染病科', '疼痛科', '紓緩科',
    '家庭醫學科', '急症科', '牙科',
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

// 依所選機構判定所屬類別（HA=醫管局 / DH=衛生署 / other=其他）。未知來源視為 other。
export function getInstitutionCategory(
  source: string | undefined | null,
  settings: MedicationSettingsData
): 'ha' | 'dh' | 'other' | '' {
  if (!source) return '';
  for (const g of INSTITUTION_GROUPS) {
    const list = settings[g.key] as string[];
    if (Array.isArray(list) && list.includes(source)) return g.category;
  }
  return 'other';
}
