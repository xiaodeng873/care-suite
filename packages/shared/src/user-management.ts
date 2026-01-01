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
export type DepartmentType = '行政' | '社工' | '護理' | '專職' | '膳食' | '衛生';

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
export type HygienePositionType = '助理員';

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
  hire_date: string;
  employment_type: EmploymentType;
  monthly_hour_limit: number | null;
  role: UserRole;
  is_active: boolean;
  auth_user_id: string | null;
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
  '社工',
  '護理',
  '專職',
  '膳食',
  '衛生',
];

/** 護理部門職位列表 */
export const NURSING_POSITIONS: NursingPositionType[] = [
  '註冊護士',
  '登記護士',
  '保健員',
  '護理員',
];

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
export const HYGIENE_POSITIONS: HygienePositionType[] = ['助理員'];

/** 僱傭類型列表 */
export const EMPLOYMENT_TYPES: EmploymentType[] = ['正職', '兼職'];

/** 用戶角色列表 */
export const USER_ROLES: UserRole[] = ['developer', 'admin', 'staff'];

/** 用戶角色中文名稱對照 */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  developer: '開發者',
  admin: '管理者',
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
    { key: 'care_records', name_zh: '護理記錄', route: '/care-records' },
    { key: 'patient_logs', name_zh: '院友日誌', route: '/patient-logs' },
    { key: 'diagnosis_records', name_zh: '診斷記錄', route: '/diagnosis-records' },
    { key: 'vaccination_records', name_zh: '疫苗記錄', route: '/vaccination-records' },
  ],
  medication: [
    { key: 'prescription_management', name_zh: '處方管理', route: '/prescriptions' },
    { key: 'medication_workflow', name_zh: '藥物工作流程', route: '/medication-workflow' },
    { key: 'drug_database', name_zh: '藥物資料庫', route: '/drugs' },
  ],
  treatment: [
    { key: 'vmo_schedule', name_zh: 'VMO排程', route: '/scheduling' },
    { key: 'hospital_outreach', name_zh: '醫院外展', route: '/hospital-outreach' },
    { key: 'rehabilitation', name_zh: '復康服務', route: '/rehabilitation' },
  ],
  periodic: [
    { key: 'annual_checkup', name_zh: '年度體檢', route: '/annual-checkup' },
    { key: 'health_assessment', name_zh: '健康評估', route: '/health-assessments' },
    { key: 'care_plan', name_zh: '個人照顧計劃', route: '/care-plan' },
    { key: 'restraint', name_zh: '約束物品', route: '/restraint' },
    { key: 'wound_management', name_zh: '傷口管理', route: '/wound' },
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
    { key: 'system_settings', name_zh: '系統設定', route: '/settings' },
    { key: 'user_management', name_zh: '用戶管理', route: '/settings' },
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
    default:
      return []; // 行政、社工、膳食使用自由輸入
  }
}

/**
 * 判斷部門是否使用枚舉職位選單
 */
export function departmentHasEnumPositions(department: DepartmentType): boolean {
  return ['護理', '專職', '衛生'].includes(department);
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
