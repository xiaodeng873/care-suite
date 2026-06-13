/**
 * Dashboard feature cards configuration.
 *
 * Each card declares the Expo Router href it navigates to, a display label,
 * an icon name (Ionicons), and optionally the permission required to see it.
 *
 * The facilityId parameter is intentionally threaded through here so that
 * when multi-tenancy is added to the DB, only this layer needs updating.
 */

export interface FeatureCard {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  href: string;
  /** Permission key that must be truthy for the card to show. Undefined = always show. */
  permissionKey?: string;
}

export const FEATURE_CARDS: FeatureCard[] = [
  // 院友
  { id: 'residents',       label: '院友管理',   labelEn: 'Residents',          icon: 'people-outline',            href: '/(app)/residents' },
  { id: 'contacts',        label: '院友聯絡人', labelEn: 'Contacts',           icon: 'call-outline',              href: '/(app)/contacts' },
  { id: 'diagnosis',       label: '診斷記錄',   labelEn: 'Diagnosis',          icon: 'medkit-outline',            href: '/(app)/diagnosis' },
  { id: 'vaccinations',    label: '疫苗記錄',   labelEn: 'Vaccinations',       icon: 'fitness-outline',           href: '/(app)/vaccinations' },
  { id: 'admissions',      label: '缺席管理',   labelEn: 'Admissions',         icon: 'enter-outline',             href: '/(app)/admissions' },
  { id: 'beds',            label: '床位管理',   labelEn: 'Bed Management',     icon: 'bed-outline',               href: '/(app)/beds' },
  // 記錄
  { id: 'care-records',    label: '護理記錄',   labelEn: 'Care Records',       icon: 'clipboard-outline',         href: '/(app)/care-records' },
  { id: 'patient-logs',    label: '院友日誌',   labelEn: 'Patient Logs',       icon: 'journal-outline',           href: '/(app)/patient-logs' },
  { id: 'incidents',       label: '事故報告',   labelEn: 'Incidents',          icon: 'warning-outline',           href: '/(app)/incidents' },
  { id: 'follow-ups',      label: '覆診跟進',   labelEn: 'Follow-ups',         icon: 'time-outline',              href: '/(app)/follow-ups' },
  { id: 'annual-checkup',  label: '年度體檢',   labelEn: 'Annual Checkup',     icon: 'checkmark-circle-outline',  href: '/(app)/annual-checkup' },
  { id: 'assessments',     label: '健康評估',   labelEn: 'Assessments',        icon: 'document-text-outline',     href: '/(app)/assessments' },
  // 藥物
  { id: 'medications',     label: '給藥管理',   labelEn: 'Medications',        icon: 'medical-outline',           href: '/(app)/medications' },
  { id: 'prescriptions',   label: '處方管理',   labelEn: 'Prescriptions',      icon: 'receipt-outline',           href: '/(app)/prescriptions' },
  { id: 'drugs',           label: '藥物資料庫', labelEn: 'Drug Database',      icon: 'flask-outline',             href: '/(app)/drugs' },
  // 治療 & 護理
  { id: 'care-plans',      label: '照護計劃',   labelEn: 'Care Plans',         icon: 'calendar-outline',          href: '/(app)/care-plans' },
  { id: 'wounds',          label: '傷口管理',   labelEn: 'Wounds',             icon: 'bandage-outline',           href: '/(app)/wounds' },
  { id: 'restraints',      label: '約束物品',   labelEn: 'Restraints',         icon: 'lock-closed-outline',       href: '/(app)/restraints' },
  { id: 'rehab',           label: '復康服務',   labelEn: 'Rehabilitation',     icon: 'walk-outline',              href: '/(app)/rehab' },
  // 健康監測
  { id: 'health',          label: '健康記錄',   labelEn: 'Health Records',     icon: 'pulse-outline',             href: '/(app)/health' },
  { id: 'intake-output',   label: '出入量',     labelEn: 'Intake & Output',    icon: 'water-outline',             href: '/(app)/intake-output' },
  { id: 'tasks',           label: '任務管理',   labelEn: 'Tasks',              icon: 'checkbox-outline',          href: '/(app)/tasks' },
  // 日常
  { id: 'hygiene',         label: '衛生記錄',   labelEn: 'Hygiene',            icon: 'sparkles-outline',          href: '/(app)/hygiene' },
  { id: 'meals',           label: '餐膳指引',   labelEn: 'Meal Guidance',      icon: 'restaurant-outline',        href: '/(app)/meals' },
  // 外部
  { id: 'vmo-visits',      label: '訪診管理',   labelEn: 'VMO Visits',         icon: 'person-add-outline',        href: '/(app)/vmo-visits' },
  { id: 'outreach',        label: '醫院外展',   labelEn: 'Hospital Outreach',  icon: 'car-outline',               href: '/(app)/outreach' },
  // 系統
  { id: 'reports',         label: '報表查詢',   labelEn: 'Reports',            icon: 'bar-chart-outline',         href: '/(app)/reports' },
  { id: 'users',           label: '用戶管理',   labelEn: 'User Management',    icon: 'settings-outline',          href: '/(app)/users',        permissionKey: 'canManageUsers' },
];
