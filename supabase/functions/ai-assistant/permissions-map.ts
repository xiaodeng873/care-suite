// =====================================================
// AI 助護 — 資料表 → 權限類別映射
// 用於判斷用戶是否有權限操作特定表
// =====================================================
/** 資料表 → 權限類別映射 */ export const TABLE_PERMISSION_MAP = {
  // 院友相關
  '院友主表': 'patients',
  'patient_contacts': 'patients',
  'patient_admission_records': 'patients',
  'patient_care_tabs': 'patients',
  // 健康記錄
  '健康記錄主表': 'records',
  'deleted_health_records': 'records',
  'health_assessments': 'records',
  'patient_health_tasks': 'records',
  'diagnosis_records': 'records',
  'vaccination_records': 'records',
  'patient_logs': 'records',
  'patient_notes': 'records',
  'intake_output_records': 'records',
  'intake_items': 'records',
  'output_items': 'records',
  'wounds': 'records',
  'wound_assessments': 'records',
  'incident_reports': 'records',
  'hygiene_records': 'records',
  // 藥物管理
  'new_medication_prescriptions': 'medication',
  'medication_drug_database': 'medication',
  'medication_workflow_records': 'medication',
  'prescription_time_slot_definitions': 'medication',
  'medication_workflow_settings': 'medication',
  'prescription_inspection_rules': 'medication',
  'medication_risk_rules': 'medication',
  // 治療相關
  'doctor_visit_schedule': 'treatment',
  'hospital_outreach_records': 'treatment',
  'hospital_outreach_record_history': 'treatment',
  'hospital_episodes': 'treatment',
  'episode_events': 'treatment',
  '到診排程主表': 'treatment',
  '看診院友細項': 'treatment',
  '到診院友_看診原因': 'treatment',
  '看診原因選項': 'treatment',
  '覆診安排主表': 'treatment',
  // 定期評估
  'care_plans': 'periodic',
  'care_plan_problems': 'periodic',
  'care_plan_nursing_needs': 'periodic',
  'annual_health_checkups': 'periodic',
  'patient_restraint_assessments': 'periodic',
  'problem_library': 'periodic',
  'nursing_need_items': 'periodic',
  // 日常照護
  'patrol_rounds': 'daily',
  'diaper_change_records': 'daily',
  'restraint_observation_records': 'daily',
  'position_change_records': 'daily',
  'daily_system_tasks': 'daily',
  'meal_guidance': 'daily',
  // 設施管理
  'stations': 'settings',
  'beds': 'settings'
};
/** SQL 操作 → 權限動作映射 */ export const SQL_ACTION_MAP = {
  'SELECT': 'view',
  'INSERT': 'create',
  'UPDATE': 'edit',
  'DELETE': 'delete'
};
/** 禁止操作的系統表 */ export const BLOCKED_TABLES = [
  'user_profiles',
  'user_sessions',
  'user_permissions',
  'permissions',
  'ai_assistant_pending_mutations',
  'ocr_prompt_templates',
  'user_ocr_prompts',
  'ocr_recognition_logs',
  'templates_metadata'
];
/** 禁止的 SQL 關鍵字（DDL + 危險操作） */ export const BLOCKED_SQL_KEYWORDS = [
  'DROP',
  'ALTER',
  'CREATE TABLE',
  'CREATE INDEX',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'VACUUM',
  'REINDEX',
  'CLUSTER',
  'COPY',
  'pg_dump',
  'pg_restore'
];
/**
 * 檢查 SQL 是否包含禁止的關鍵字
 */ export function containsBlockedKeywords(sql) {
  const upperSql = sql.toUpperCase().trim();
  return BLOCKED_SQL_KEYWORDS.some((keyword)=>upperSql.includes(keyword.toUpperCase()));
}
/**
 * 檢查 SQL 是否涉及禁止的系統表
 */ export function involvesBlockedTables(tablesInvolved) {
  return tablesInvolved.some((table)=>BLOCKED_TABLES.includes(table.toLowerCase()) || BLOCKED_TABLES.includes(table));
}
/**
 * 從涉及的表名列表推斷所需的權限類別
 */ export function getRequiredPermissions(tablesInvolved, sqlType) {
  const action = SQL_ACTION_MAP[sqlType.toUpperCase()] || 'view';
  const permissions = [];
  const seen = new Set();
  for (const table of tablesInvolved){
    const category = TABLE_PERMISSION_MAP[table];
    if (category) {
      const key = `${category}:${action}`;
      if (!seen.has(key)) {
        seen.add(key);
        permissions.push({
          category,
          action
        });
      }
    }
  }
  return permissions;
}
