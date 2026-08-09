// =====================================================
// 用戶管理系統類型與權限常數定義
// User Management System Types and Permission Constants
// =====================================================

// =====================================================
// ENUM 類型對應資料庫
// =====================================================

/** 用戶角色 */
export type UserRole = 'developer' | 'admin' | 'staff';

/** 部門類型 */
export type DepartmentType = '行政' | '庶務' | '護理' | '專職' | '衛生';

/** 護理部門職位 */
export type NursingPositionType = '註冊護士' | '登記護士' | '保健員' | '護理員';

/** 專職部門職位 */
export type AlliedHealthPositionType = 
  | '物理治療師'
  | '物理治療師助理'
  | '職業治療師'
  | '職業治療師助理'
  | '言語治療師'
  | '言語治療師助理';

/** 衛生部門職位 */
export type HygienePositionType = '清潔員';

/** 行政部門職位 */
export type AdminPositionType = '主管' | '文員' | '會計' | '社工' | '社工助理';

/** 庶務部門職位 */
export type GeneralAffairsPositionType = '廚師' | '清潔員';

/** 僱傭類型 */
export type EmploymentType = '正職' | '兼職';

/** 權限操作類型 */
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

/** 權限類別（對應導覽分類） */
export type PermissionCategory = 
  | 'patients'    // 院友
  | 'records'     // 記錄
  | 'medication'  // 藥物
  | 'treatment'   // 治療
  | 'periodic'    // 定期
  | 'daily'       // 日常
  | 'print'       // 列印
  | 'settings';   // 設定

// =====================================================
// 資料表介面
// =====================================================

/** 用戶資料介面 */
export interface UserProfile {
  id: string;
  username: string;
  password_hash?: string; // 前端不會返回
  name_zh: string;
  name_en: string | null;
  id_number: string | null;
  date_of_birth: string | null;
  department: DepartmentType;
  nursing_position: NursingPositionType | null;
  allied_health_position: AlliedHealthPositionType | null;
  hygiene_position: HygienePositionType | null;
  other_position: string | null;
  /** 次要職位列表（可擔任其他角色） */
  secondary_positions: string[];
  hire_date: string;
  employment_type: EmploymentType;
  monthly_hour_limit: number | null;
  role: UserRole;
  is_active: boolean;
  auth_user_id: string | null;
  login_qr_code_id: string; // 用戶登入二維碼識別碼
  /** 大頭照 URL（Supabase Storage avatars bucket） */
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 權限定義介面 */
export interface Permission {
  id: string;
  category: PermissionCategory;
  feature: string;
  feature_name_zh: string;
  action: PermissionAction;
  description: string | null;
  route: string | null;
  created_at: string;
}

/** 用戶權限關聯介面 */
export interface UserPermission {
  id: string;
  user_id: string;
  permission_id: string;
  granted_by: string | null;
  granted_at: string;
}

/** 用戶會話介面 */
export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  last_accessed_at: string;
}

// =====================================================
// 常數定義
// =====================================================

/** 部門列表 */
export const DEPARTMENTS: DepartmentType[] = [
  '行政',
  '庶務',
  '護理',
  '專職',
  '衛生',
];

/** 護理部門職位列表 */
export const NURSING_POSITIONS: NursingPositionType[] = [
  '註冊護士',
  '登記護士',
  '保健員',
  '護理員',
];

/**
 * 有資格簽署注射藥物（執/核/派）的護理職位。
 * 護理員不可簽署注射藥物。
 */
export const INJECTION_QUALIFIED_POSITIONS: NursingPositionType[] = [
  '註冊護士',
  '登記護士',
  '保健員',
];

/** 判斷用戶是否具備簽署注射藥物的資格（護理職位須為註冊/登記護士或保健員）。 */
export const isInjectionQualified = (
  profile: Pick<UserProfile, 'nursing_position'> | null | undefined
): boolean => {
  if (!profile || !profile.nursing_position) return false;
  return (INJECTION_QUALIFIED_POSITIONS as string[]).includes(profile.nursing_position);
};

/** 專職部門職位列表 */
export const ALLIED_HEALTH_POSITIONS: AlliedHealthPositionType[] = [
  '物理治療師',
  '物理治療師助理',
  '職業治療師',
  '職業治療師助理',
  '言語治療師',
  '言語治療師助理',
];

/** 衛生部門職位列表 */
export const HYGIENE_POSITIONS: HygienePositionType[] = ['清潔員'];

/** 行政部門職位列表 */
export const ADMIN_POSITIONS: AdminPositionType[] = ['主管', '文員', '會計', '社工', '社工助理'];

/** 庶務部門職位列表 */
export const GENERAL_AFFAIRS_POSITIONS: GeneralAffairsPositionType[] = ['廚師', '清潔員'];

/** 全部枚舉職位列表（次要職位選項等用途） */
export const ALL_POSITIONS: string[] = [
  ...ADMIN_POSITIONS,
  ...NURSING_POSITIONS,
  ...ALLIED_HEALTH_POSITIONS,
  ...GENERAL_AFFAIRS_POSITIONS,
  ...HYGIENE_POSITIONS,
];

// =====================================================
// 僱傭詳情（排班管理底層）
// =====================================================

/** 工作日安排 */
export type WorkPattern = '輪班' | '一至五';

/** 僱傭詳情適用職位判斷結果 */
export type EmploymentPosition =
  | '主管'
  | '文員'
  | '會計'
  | '註冊護士'
  | '登記護士'
  | '保健員'
  | '護理員'
  | '物理治療師'
  | '物理治療師助理'
  | '職業治療師'
  | '職業治療師助理'
  | '言語治療師'
  | '言語治療師助理'
  | '社工助理'
  | '社工'
  | '廚師'
  | '清潔員';

/** 排班表卡片預設顯示優先級：職位越高越靠前，同職位按入職日期 */
export const POSITION_DISPLAY_PRIORITY: Record<EmploymentPosition, number> = {
  註冊護士: 1,
  登記護士: 2,
  保健員: 3,
  護理員: 4,
  主管: 5,
  會計: 6,
  社工: 7,
  社工助理: 8,
  文員: 9,
  廚師: 10,
  清潔員: 10,
  物理治療師: 12,
  物理治療師助理: 13,
  職業治療師: 14,
  職業治療師助理: 15,
  言語治療師: 16,
  言語治療師助理: 17,
};

/** 排班卡片的職位英文代號（顯示於姓名前）；特定鐘點中算作助理員的職位一律 AW；主管無代號 */
export const POSITION_CARD_CODES: Partial<Record<EmploymentPosition, string>> = {
  註冊護士: 'RN',
  登記護士: 'EN',
  保健員: 'HW',
  護理員: 'PCW',
  文員: 'AW',
  會計: 'AW',
  社工: 'AW',
  社工助理: 'AW',
  廚師: 'AW',
  清潔員: 'AW',
  物理治療師: 'PT',
  物理治療師助理: 'PTA',
  職業治療師: 'OT',
  職業治療師助理: 'OTA',
  言語治療師: 'ST',
  言語治療師助理: 'STA',
};

/** 公眾假期類型：銀行假期(PH) / 勞工假期(SH) */
export type PublicHolidayType = 'PH' | 'SH';

/** 公眾假期 model（對應 public_holidays 表） */
export interface PublicHoliday {
  id: string;
  holiday_date: string;
  name: string;
  type: PublicHolidayType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 僱傭詳情資料介面（對應 user_employment_details 表） */
export interface UserEmploymentDetails {
  id: string;
  user_id: string;
  work_pattern: WorkPattern | null;
  /** 每周合約工時（NULL = 未設定） */
  weekly_contract_hours: number | null;
  /** 每天合約工時（NULL = 未設定） */
  daily_contract_hours: number | null;
  /** 預設上班時間（HH:MM），拖入排班表時優先使用；NULL 則跟從班次開始時間 */
  default_work_start_time: string | null;
  /** 每周工作天數（最大 6，0.5 為單位） */
  weekly_work_days: number | null;
  /** 工時結餘：正數 = 院舍現欠職員；負數 = 職員現欠院舍 */
  hours_balance: number;
  /** PRD 小數累積（0.0–0.9，滿 1.0 可預排 1 天 PRD） */
  rest_day_fraction: number;
  accumulated_rest_days: number;
  /** 休息日計算起始日（起始日發放一次每周休息日天數，之後逢周日發放） */
  rest_day_start_date: string | null;
  annual_leave_days_per_year: number | null;
  annual_leave_start_date: string | null;
  /** 公眾假期類型（PH/SH），NULL = 不適用 */
  public_holiday_type: PublicHolidayType | null;
  /** 公眾假期計算起始日 */
  public_holiday_start_date: string | null;
  /** 公眾假期備註/描述 */
  public_holiday_description: string | null;
  preferred_station_primary: string | null;
  preferred_station_secondary: string[];
  stations_forbidden: string[];
  created_at: string;
  updated_at: string;
}

/** 年假明細類型 */
export type AnnualLeaveDetailType = 'grant' | 'usage' | 'writeoff';

/** 年假用度明細（對應 user_annual_leave_details 表） */
export interface UserAnnualLeaveDetail {
  id: string;
  user_id: string;
  record_date: string;
  detail_type: AnnualLeaveDetailType;
  days: number;
  remark: string | null;
  /** 系統自動發放的獲得行，唯讀 */
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 結餘抹平類型 */
export type BalanceType = 'hours' | 'rest_days';

/** 休息日用度明細（對應 user_rest_day_details 表，結構與年假明細相同） */
export type UserRestDayDetail = UserAnnualLeaveDetail;

/** 公眾假期用度明細（對應 user_public_holiday_details 表）
 *  在年假明細基礎上加入關聯假期與 30 天有效期 */
export interface UserPublicHolidayDetail extends UserAnnualLeaveDetail {
  /** 關聯的 public_holidays 記錄；grant 必須填寫，usage/writeoff 可為 null */
  reference_public_holiday_id: string | null;
  /** 有效期至（grant 必填，為 holiday_date + 30 天） */
  expiry_date: string | null;
}

/** 結餘抹平記錄（對應 user_balance_adjustments 表） */
export interface UserBalanceAdjustment {
  id: string;
  user_id: string;
  balance_type: BalanceType;
  previous_value: number;
  new_value: number;
  remark: string;
  created_by: string | null;
  created_at: string;
}

/** 請假類型 */
export type LeaveType = 'AL' | 'PRD' | 'DO' | 'SL' | 'NPL' | 'PH' | 'SH';

/** 請假類型列表 */
export const LEAVE_TYPES: LeaveType[] = ['AL', 'PRD', 'DO', 'SL', 'NPL', 'PH', 'SH'];

/** 請假類型中文名稱對照 */
export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  AL: '年假',
  PRD: '補休/PRD',
  DO: '休息日',
  SL: '病假',
  NPL: '無薪假',
  PH: '銀行假期',
  SH: '勞工假期',
};

/** 預排記錄類型 */
export type LeaveRecordType = 'leave' | 'availability';

/** 預排必要程度 */
export type LeaveUrgency = 'mandatory' | 'preferred';

/** 請假／可上班時間預排記錄（對應 user_leave_records 表） */
export interface UserLeaveRecord {
  id: string;
  user_id: string;
  leave_date: string;
  /** 記錄類型：leave = 放假；availability = 能夠上班時間 */
  record_type: LeaveRecordType;
  /** 放假時必填；availability 時為 null */
  leave_type: LeaveType | null;
  /** PH/SH 預排時指向實際假期（可 null） */
  reference_public_holiday_id: string | null;
  /** 必要程度：mandatory = 必須；preferred = 希望 */
  urgency: LeaveUrgency;
  /** 能夠上班時間起點（HH:MM），僅 availability 使用 */
  availability_start_time: string | null;
  /** 能夠上班時間終點（HH:MM），僅 availability 使用 */
  availability_end_time: string | null;
  /** 主管是否已 override 希望類申請 */
  is_overridden: boolean;
  /** override 操作者（可 null） */
  overridden_by: string | null;
  /** override 時間（可 null） */
  overridden_at: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

/** 班次名稱 */
export type ShiftName = '早班' | '日班' | '午班' | '晚班';

/** 班次名稱列表 */
export const SHIFT_NAMES: ShiftName[] = ['早班', '日班', '午班', '晚班'];

/** 班次名稱顯示對照 */
export const SHIFT_NAME_LABELS: Record<ShiftName, string> = {
  早班: '早',
  日班: '日',
  午班: '午',
  晚班: '晚',
};

/** 居住區班次設定（對應 station_shift_settings 表） */
export interface StationShiftSetting {
  id: string;
  station_id: string | null;
  position: string | null;
  shift_name: ShiftName;
  start_time: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 班次指派（對應 user_shift_assignments 表） */
export interface UserShiftAssignment {
  id: string;
  user_id: string;
  work_date: string;
  station_id: string | null;
  /** 該班次所屬的統計職位（如 註冊/登記護士、保健員），NULL 時以員工自身職位回退 */
  position?: string | null;
  shift_name: ShiftName;
  start_time: string;
  end_time: string | null;
  created_by: string | null;
  /** 因與預排衝突而被 override，是否需重新調整 */
  is_overridden?: boolean;
  overridden_by?: string | null;
  overridden_at?: string | null;
  /** 同班次內多張卡片的顯示排序，數字越小越靠前 */
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

/** 未上班原因（對應 user_absence_records 表） */
export interface UserAbsenceRecord {
  id: string;
  user_id: string;
  absence_date: string;
  reason: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 判斷用戶職位是否適用僱傭詳情；回傳對應職位，不適用回傳 null。
 *  主要職位不適用時，會繼續檢查次要職位（secondary_positions）。 */
export function getEmploymentPosition(
  profile: Pick<UserProfile, 'nursing_position' | 'hygiene_position' | 'allied_health_position' | 'other_position'> & { secondary_positions?: string[] | null } | null | undefined
): EmploymentPosition | null {
  if (!profile) return null;
  if (profile.other_position === '主管') return '主管';
  if (profile.other_position === '文員') return '文員';
  if (profile.other_position === '會計') return '會計';
  if (profile.other_position === '社工助理') return '社工助理';
  if (profile.other_position === '社工') return '社工';
  if (profile.other_position === '廚師') return '廚師';
  if (profile.other_position === '清潔員') return '清潔員';
  if (profile.nursing_position === '註冊護士') return '註冊護士';
  if (profile.nursing_position === '登記護士') return '登記護士';
  if (profile.nursing_position === '保健員') return '保健員';
  if (profile.nursing_position === '護理員') return '護理員';
  if (profile.hygiene_position === '清潔員') return '清潔員';
  if (profile.allied_health_position === '物理治療師') return '物理治療師';
  if (profile.allied_health_position === '物理治療師助理') return '物理治療師助理';
  if (profile.allied_health_position === '職業治療師') return '職業治療師';
  if (profile.allied_health_position === '職業治療師助理') return '職業治療師助理';
  if (profile.allied_health_position === '言語治療師') return '言語治療師';
  if (profile.allied_health_position === '言語治療師助理') return '言語治療師助理';

  // 主要職位不適用時，檢查次要職位（按僱傭詳情適用職位順序取第一個）
  const secondaryPositions = profile.secondary_positions || [];
  const applicablePositions: EmploymentPosition[] = [
    '主管',
    '文員',
    '會計',
    '註冊護士',
    '登記護士',
    '保健員',
    '護理員',
    '物理治療師',
    '物理治療師助理',
    '職業治療師',
    '職業治療師助理',
    '言語治療師',
    '言語治療師助理',
    '社工助理',
    '社工',
    '廚師',
    '清潔員',
  ];
  for (const position of applicablePositions) {
    if (secondaryPositions.includes(position)) return position;
  }

  return null;
}

/** 僱傭類型列表 */
export const EMPLOYMENT_TYPES: EmploymentType[] = ['正職', '兼職'];

/** 用戶角色列表 */
export const USER_ROLES: UserRole[] = ['developer', 'admin', 'staff'];

/** 用戶角色中文名稱對照 */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  developer: '開發者',
  admin: '主管',
  staff: '員工',
};

/** 權限操作中文名稱對照 */
export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: '查看',
  create: '新增',
  edit: '編輯',
  delete: '刪除',
};

/** 權限類別中文名稱對照 */
export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategory, string> = {
  patients: '院友',
  records: '記錄',
  medication: '藥物',
  treatment: '治療',
  periodic: '定期',
  daily: '日常',
  print: '列印',
  settings: '設定',
};

// =====================================================
// 權限結構定義（對應導覽結構）
// =====================================================

/** 功能定義介面 */
export interface FeatureDefinition {
  key: string;
  name_zh: string;
  route: string;
}

/** 權限結構：類別 -> 功能列表 */
export const PERMISSION_STRUCTURE: Record<PermissionCategory, FeatureDefinition[]> = {
  patients: [
    { key: 'patient_list', name_zh: '院友列表', route: '/patients' },
    { key: 'patient_contacts', name_zh: '院友聯絡人', route: '/patient-contacts' },
    { key: 'bed_management', name_zh: '床位管理', route: '/station-bed' },
    { key: 'reports', name_zh: '報表查詢', route: '/reports' },
  ],
  records: [
    { key: 'health_monitoring', name_zh: '監測記錄', route: '/health' },
    { key: 'care_records', name_zh: '床頭記錄', route: '/care-records' },
    { key: 'patient_logs', name_zh: '院友日誌', route: '/patient-logs' },
    { key: 'diagnosis_records', name_zh: '診斷記錄', route: '/diagnosis-records' },
    { key: 'vaccination_records', name_zh: '疫苗記錄', route: '/vaccination-records' },
    { key: 'fee_records', name_zh: '費用記錄', route: '/fee-records' },
  ],
  medication: [
    { key: 'prescription_management', name_zh: '處方管理', route: '/prescriptions' },
    { key: 'medication_workflow', name_zh: '藥物工作流程', route: '/medication-workflow' },
    { key: 'drug_database', name_zh: '藥物資料庫', route: '/drugs' },
  ],
  treatment: [
    { key: 'vmo_schedule', name_zh: 'VMO排程', route: '/scheduling' },
    { key: 'hospital_outreach', name_zh: 'CGAT', route: '/hospital-outreach' },
    { key: 'rehabilitation', name_zh: '復康服務', route: '/rehabilitation' },
  ],
  periodic: [
    { key: 'annual_checkup', name_zh: '年度體檢', route: '/annual-health-checkup' },
    { key: 'health_assessment', name_zh: '健康評估', route: '/health-assessments' },
    { key: 'care_plan', name_zh: '個人照顧計劃', route: '/care-plan' },
    { key: 'restraint', name_zh: '約束物品', route: '/restraint' },
    { key: 'wound_management', name_zh: '傷口管理', route: '/wound' },
    { key: 'tube_care', name_zh: '喉管護理', route: '/tube-care' },
    { key: 'activity_records', name_zh: '活動記錄', route: '/activity-records' },
  ],
  daily: [
    { key: 'follow_up', name_zh: '覆診管理', route: '/follow-up' },
    { key: 'admission_records', name_zh: '缺席管理', route: '/admission-records' },
    { key: 'task_management', name_zh: '任務管理', route: '/tasks' },
    { key: 'meal_guidance', name_zh: '餐膳指引', route: '/meal-guidance' },
    { key: 'incident_reports', name_zh: '意外事件報告', route: '/incident-reports' },
  ],
  print: [
    { key: 'print_forms', name_zh: '列印表格', route: '/print-forms' },
    { key: 'template_management', name_zh: '範本管理', route: '/templates' },
  ],
  settings: [
    { key: 'user_management', name_zh: '用戶管理', route: '/settings' },
    { key: 'facility_settings', name_zh: '院舍設定', route: '/settings' },
    { key: 'medication_settings', name_zh: '藥物設定', route: '/settings' },
    { key: 'general_settings', name_zh: '基本設定', route: '/settings' },
    { key: 'tools_settings', name_zh: '輔助工具', route: '/settings' },
  ],
};

/** 權限操作列表 */
export const PERMISSION_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete'];

// =====================================================
// 工具函數
// =====================================================

/**
 * 根據部門獲取對應的職位列表
 */
export function getPositionsByDepartment(department: DepartmentType): string[] {
  switch (department) {
    case '護理':
      return NURSING_POSITIONS;
    case '專職':
      return ALLIED_HEALTH_POSITIONS;
    case '衛生':
      return HYGIENE_POSITIONS;
    case '行政':
      return ADMIN_POSITIONS;
    case '庶務':
      return GENERAL_AFFAIRS_POSITIONS;
    default:
      return [];
  }
}

/**
 * 判斷部門是否使用枚舉職位選單
 */
export function departmentHasEnumPositions(department: DepartmentType): boolean {
  return ['護理', '專職', '衛生', '行政', '庶務'].includes(department);
}

/**
 * 生成權限鍵值（用於權限檢查）
 * 格式: category:feature:action
 */
export function generatePermissionKey(
  category: PermissionCategory,
  feature: string,
  action: PermissionAction
): string {
  return `${category}:${feature}:${action}`;
}

/**
 * 解析權限鍵值
 */
export function parsePermissionKey(key: string): {
  category: PermissionCategory;
  feature: string;
  action: PermissionAction;
} | null {
  const parts = key.split(':');
  if (parts.length !== 3) return null;
  
  return {
    category: parts[0] as PermissionCategory,
    feature: parts[1],
    action: parts[2] as PermissionAction,
  };
}

/**
 * 獲取類別下所有功能的所有權限鍵值
 */
export function getCategoryPermissionKeys(category: PermissionCategory): string[] {
  const features = PERMISSION_STRUCTURE[category];
  const keys: string[] = [];
  
  for (const feature of features) {
    for (const action of PERMISSION_ACTIONS) {
      keys.push(generatePermissionKey(category, feature.key, action));
    }
  }
  
  return keys;
}

/**
 * 獲取所有權限鍵值
 */
export function getAllPermissionKeys(): string[] {
  const keys: string[] = [];
  
  for (const category of Object.keys(PERMISSION_STRUCTURE) as PermissionCategory[]) {
    keys.push(...getCategoryPermissionKeys(category));
  }
  
  return keys;
}

/**
 * 根據路由獲取對應的權限資訊
 */
export function getPermissionByRoute(route: string): {
  category: PermissionCategory;
  feature: string;
} | null {
  for (const [category, features] of Object.entries(PERMISSION_STRUCTURE)) {
    for (const feature of features) {
      if (feature.route === route) {
        return {
          category: category as PermissionCategory,
          feature: feature.key,
        };
      }
    }
  }
  return null;
}

/** 預設兼職每月工時上限 */
export const DEFAULT_PART_TIME_HOUR_LIMIT = 68;

/** 用戶資料表單預設值 */
export const DEFAULT_USER_FORM_VALUES: Partial<UserProfile> = {
  employment_type: '正職',
  role: 'staff',
  is_active: true,
  monthly_hour_limit: DEFAULT_PART_TIME_HOUR_LIMIT,
};
