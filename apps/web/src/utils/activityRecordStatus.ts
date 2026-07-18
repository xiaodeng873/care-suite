import type { PatientActivityRecord } from '../lib/database';

/**
 * 活動記錄 - 16 個活動類別 checkbox 欄位名稱
 * 對應 doc_html/院友健康教育 活動記錄表.html 的 6 大分類
 */
export const ACTIVITY_BOOLEAN_FIELDS = [
  // 集體活動
  'has_birthday_party',
  'has_festival_celebration',
  'has_performance',
  // 戶外集體活動
  'has_outing',
  'has_visit',
  'has_shopping_dimsum',
  'has_games',
  // 小組活動
  'has_interest_group',
  'has_learning_group',
  // 個人活動
  'has_self_care_training',
  'has_individual_interest',
  'has_individual_counseling',
  'has_individual_therapy',
  'has_group_visit',
  // 運動 / 健康教育講座
  'has_exercise',
  'has_health_talk',
] as const;

export type ActivityBooleanField = typeof ACTIVITY_BOOLEAN_FIELDS[number];

/** 分類分組（比照 doc_html 6 大類），供輸入表單與列印表共用 */
export const ACTIVITY_CATEGORY_GROUPS: { title: string; items: { field: ActivityBooleanField; label: string }[] }[] = [
  {
    title: '集體活動',
    items: [
      { field: 'has_birthday_party', label: '生日會' },
      { field: 'has_festival_celebration', label: '節日慶祝' },
      { field: 'has_performance', label: '表演節目' },
    ],
  },
  {
    title: '戶外集體活動',
    items: [
      { field: 'has_outing', label: '旅行' },
      { field: 'has_visit', label: '參觀' },
      { field: 'has_shopping_dimsum', label: '購物/飲茶' },
      { field: 'has_games', label: '遊戲' },
    ],
  },
  {
    title: '小組活動',
    items: [
      { field: 'has_interest_group', label: 'A 興趣小組' },
      { field: 'has_learning_group', label: 'B 學習小組' },
    ],
  },
  {
    title: '個人活動',
    items: [
      { field: 'has_self_care_training', label: 'C 自理活動訓練' },
      { field: 'has_individual_interest', label: 'D 個別興趣' },
      { field: 'has_individual_counseling', label: 'E 個別輔導' },
      { field: 'has_individual_therapy', label: 'F 個人治療訓練' },
      { field: 'has_group_visit', label: 'G 團體探訪' },
    ],
  },
  {
    title: '運動 / 健康教育',
    items: [
      { field: 'has_exercise', label: '運動' },
      { field: 'has_health_talk', label: '健康教育講座' },
    ],
  },
];

/** 個人活動類別（用於臥床/鼻胃飼院友的確認提示規則） */
export const INDIVIDUAL_ACTIVITY_FIELDS: ActivityBooleanField[] = [
  'has_self_care_training',
  'has_individual_interest',
  'has_individual_counseling',
  'has_individual_therapy',
  'has_group_visit',
];

/** 判斷單筆記錄是否有實質參與（缺席記錄一律不計入，且至少一個 checkbox 為 true） */
export function isParticipationRecord(record: PatientActivityRecord): boolean {
  if (record.is_absent) return false;
  return ACTIVITY_BOOLEAN_FIELDS.some(field => record[field]);
}

/** 判斷記錄是否勾選了「個人活動」以外的其他類別 */
export function hasNonIndividualActivity(record: PatientActivityRecord): boolean {
  return ACTIVITY_BOOLEAN_FIELDS.some(field => !INDIVIDUAL_ACTIVITY_FIELDS.includes(field) && record[field]);
}

/** 計算指定院友在指定年月的參與次數（缺席記錄不計入） */
export function countMonthlyParticipation(
  patientId: number,
  year: number,
  month: number, // 1-12
  records: PatientActivityRecord[]
): number {
  return records.filter(r => {
    if (r.patient_id !== patientId) return false;
    const d = new Date(r.record_date);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return false;
    return isParticipationRecord(r);
  }).length;
}

/** 取得「上一個完整月」的年月（相對於 referenceDate） */
export function getPreviousMonth(referenceDate: Date = new Date()): { year: number; month: number } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1; // 當前月 1-12
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

export interface ActivityRecordOverdueInfo {
  isOverdue: boolean;
  previousMonthYear: number;
  previousMonthMonth: number;
  previousMonthCount: number;
}

/**
 * 判斷院友是否逾期：只在「上一個完整月」參與次數 < 2 時才算逾期。
 * 進行中的當月一律不判定逾期。
 */
export function getActivityRecordOverdueInfo(
  patientId: number,
  records: PatientActivityRecord[],
  referenceDate: Date = new Date()
): ActivityRecordOverdueInfo {
  const { year, month } = getPreviousMonth(referenceDate);
  const previousMonthCount = countMonthlyParticipation(patientId, year, month, records);
  return {
    isOverdue: previousMonthCount < 2,
    previousMonthYear: year,
    previousMonthMonth: month,
    previousMonthCount,
  };
}

export function isActivityRecordOverdue(
  patientId: number,
  records: PatientActivityRecord[],
  referenceDate: Date = new Date()
): boolean {
  return getActivityRecordOverdueInfo(patientId, records, referenceDate).isOverdue;
}

/** 主表格顯示用：本月（進行中）已記錄次數 */
export function getCurrentMonthCount(
  patientId: number,
  records: PatientActivityRecord[],
  referenceDate: Date = new Date()
): number {
  return countMonthlyParticipation(patientId, referenceDate.getFullYear(), referenceDate.getMonth() + 1, records);
}

/** 取得院友目前生效中的健康評估中「長期臥床」與「鼻胃管」旗標 */
export function getPatientCareFlags(patientId: number, healthAssessments: any[]): { isBedridden: boolean; isNasogastric: boolean } {
  const active = healthAssessments.find(a => a.patient_id === patientId && a.status === 'active');
  if (!active) return { isBedridden: false, isNasogastric: false };
  return {
    isBedridden: !!active.daily_activities?.is_bedridden,
    isNasogastric: active.nutrition_diet?.condition === '鼻胃管',
  };
}

/**
 * 依 hospital_episodes 自動偵測院友於指定日期是否缺席（住院/外出放假），
 * 回傳建議的缺席原因文字。找不到對應事件時回傳 null（不自動勾選缺席）。
 * 僅供輸入表單自動預帶，使用者可手動覆蓋/取消。
 */
export function detectAbsenceForDate(
  patientId: number,
  date: string,
  hospitalEpisodes: any[]
): { isAbsent: boolean; reason: string } | null {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00`);
  const episode = hospitalEpisodes.find(ep => {
    if (ep.patient_id !== patientId) return false;
    if (!ep.episode_start_date) return false;
    const start = new Date(`${ep.episode_start_date}T00:00:00`);
    if (target < start) return false;
    if (ep.episode_end_date) {
      const end = new Date(`${ep.episode_end_date}T23:59:59`);
      return target <= end;
    }
    return true; // 尚未結束（仍在住院/外出中）
  });
  if (!episode) return null;
  if (episode.primary_hospital) {
    return { isAbsent: true, reason: `住院 - ${episode.primary_hospital}` };
  }
  if (episode.vacation_destination) {
    return { isAbsent: true, reason: `外出/放假 - ${episode.vacation_destination}` };
  }
  return { isAbsent: true, reason: '住院/外出' };
}
