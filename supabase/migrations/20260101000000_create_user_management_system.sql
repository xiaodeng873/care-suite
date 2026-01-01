-- =====================================================
-- 用戶管理系統 User Management System
-- 建立層級權限架構：開發者 > 管理者 > 員工
-- =====================================================

-- 1. 建立 ENUM 類型
-- =====================================================

-- 用戶角色
CREATE TYPE user_role AS ENUM (
  'developer',  -- 開發者（最高權限，透過 Supabase Auth 登入）
  'admin',      -- 管理者（由開發者任命，可管理員工）
  'staff'       -- 員工（一般用戶）
);

-- 部門類型
CREATE TYPE department_type AS ENUM (
  '行政',
  '社工',
  '護理',
  '專職',
  '膳食',
  '衛生'
);

-- 護理部門職位
CREATE TYPE nursing_position_type AS ENUM (
  '註冊護士',
  '登記護士',
  '保健員',
  '護理員'
);

-- 專職部門職位（物理治療、職業治療、言語治療）
CREATE TYPE allied_health_position_type AS ENUM (
  '物理治療師',
  '物理治療師助理',
  '職業治療師',
  '職業治療師助理',
  '言語治療師',
  '言語治療師助理'
);

-- 衛生部門職位
CREATE TYPE hygiene_position_type AS ENUM (
  '助理員'
);

-- 僱傭類型
CREATE TYPE employment_type AS ENUM (
  '正職',
  '兼職'
);

-- 權限操作類型
CREATE TYPE permission_action_type AS ENUM (
  'view',    -- 查看
  'create',  -- 新增
  'edit',    -- 編輯
  'delete'   -- 刪除
);

-- 權限類別（對應導覽分類）
CREATE TYPE permission_category_type AS ENUM (
  'patients',    -- 院友
  'records',     -- 記錄
  'medication',  -- 藥物
  'treatment',   -- 治療
  'periodic',    -- 定期
  'daily',       -- 日常
  'print',       -- 列印
  'settings'     -- 設定
);

-- 2. 建立用戶資料表
-- =====================================================

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 登入資訊
  username text UNIQUE NOT NULL,          -- 登入帳號（非 Email）
  password_hash text NOT NULL,            -- bcrypt 加密密碼
  
  -- 基本資料
  name_zh text NOT NULL,                  -- 中文姓名
  name_en text,                           -- 英文姓名
  id_number text,                         -- 身份證號碼
  date_of_birth date,                     -- 出生日期
  
  -- 部門與職位
  department department_type NOT NULL,
  nursing_position nursing_position_type,           -- 護理部門專用
  allied_health_position allied_health_position_type, -- 專職部門專用
  hygiene_position hygiene_position_type,           -- 衛生部門專用
  other_position text,                              -- 行政/社工/膳食部門自由輸入
  
  -- 僱傭資訊
  hire_date date NOT NULL,                -- 入職日期
  employment_type employment_type NOT NULL DEFAULT '正職',
  monthly_hour_limit integer DEFAULT 68,  -- 兼職每月工時上限（預設 68 小時）
  
  -- 權限與狀態
  role user_role NOT NULL DEFAULT 'staff',
  is_active boolean NOT NULL DEFAULT true,
  
  -- 關聯 Supabase Auth（僅開發者使用）
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- 追蹤欄位
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- 約束：確保職位與部門對應正確
  CONSTRAINT valid_nursing_position CHECK (
    (department = '護理' AND nursing_position IS NOT NULL) OR
    (department != '護理' AND nursing_position IS NULL)
  ),
  CONSTRAINT valid_allied_health_position CHECK (
    (department = '專職' AND allied_health_position IS NOT NULL) OR
    (department != '專職' AND allied_health_position IS NULL)
  ),
  CONSTRAINT valid_hygiene_position CHECK (
    (department = '衛生' AND hygiene_position IS NOT NULL) OR
    (department != '衛生' AND hygiene_position IS NULL)
  ),
  -- 兼職才有工時限制
  CONSTRAINT valid_hour_limit CHECK (
    (employment_type = '兼職' AND monthly_hour_limit IS NOT NULL AND monthly_hour_limit > 0) OR
    (employment_type = '正職')
  )
);

-- 建立索引
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_department ON user_profiles(department);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);

-- 3. 建立權限定義表
-- =====================================================

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category permission_category_type NOT NULL,  -- 權限類別
  feature text NOT NULL,                        -- 功能模組（如 patient_list, care_records）
  feature_name_zh text NOT NULL,                -- 功能中文名稱
  action permission_action_type NOT NULL,       -- 操作類型
  description text,                             -- 權限描述
  route text,                                   -- 對應路由
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(category, feature, action)
);

CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_permissions_feature ON permissions(feature);

-- 4. 建立用戶權限關聯表
-- =====================================================

CREATE TABLE user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, permission_id)
);

CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id);

-- 5. 建立自訂登入會話表（用於非 Supabase Auth 用戶）
-- =====================================================

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- 6. 啟用 RLS
-- =====================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 7. 建立 RLS 政策
-- =====================================================

-- user_profiles: 已認證用戶可讀取，管理者可管理
CREATE POLICY "允許已認證用戶讀取用戶資料" ON user_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增用戶" ON user_profiles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新用戶" ON user_profiles
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "允許已認證用戶刪除用戶" ON user_profiles
  FOR DELETE TO authenticated USING (true);

-- permissions: 所有已認證用戶可讀取
CREATE POLICY "允許已認證用戶讀取權限" ON permissions
  FOR SELECT TO authenticated USING (true);

-- user_permissions: 已認證用戶可讀取和管理
CREATE POLICY "允許已認證用戶讀取用戶權限" ON user_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增用戶權限" ON user_permissions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除用戶權限" ON user_permissions
  FOR DELETE TO authenticated USING (true);

-- user_sessions: 允許服務角色管理
CREATE POLICY "允許服務角色管理會話" ON user_sessions
  FOR ALL TO service_role USING (true);

CREATE POLICY "允許已認證用戶讀取會話" ON user_sessions
  FOR SELECT TO authenticated USING (true);

-- 8. 建立觸發器：自動更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- 9. 插入權限種子資料
-- =====================================================

-- 院友類別
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  -- 院友列表
  ('patients', 'patient_list', '院友列表', 'view', '/patients'),
  ('patients', 'patient_list', '院友列表', 'create', '/patients'),
  ('patients', 'patient_list', '院友列表', 'edit', '/patients'),
  ('patients', 'patient_list', '院友列表', 'delete', '/patients'),
  -- 院友聯絡人
  ('patients', 'patient_contacts', '院友聯絡人', 'view', '/patient-contacts'),
  ('patients', 'patient_contacts', '院友聯絡人', 'create', '/patient-contacts'),
  ('patients', 'patient_contacts', '院友聯絡人', 'edit', '/patient-contacts'),
  ('patients', 'patient_contacts', '院友聯絡人', 'delete', '/patient-contacts'),
  -- 床位管理
  ('patients', 'bed_management', '床位管理', 'view', '/station-bed'),
  ('patients', 'bed_management', '床位管理', 'create', '/station-bed'),
  ('patients', 'bed_management', '床位管理', 'edit', '/station-bed'),
  ('patients', 'bed_management', '床位管理', 'delete', '/station-bed'),
  -- 報表查詢
  ('patients', 'reports', '報表查詢', 'view', '/reports'),
  ('patients', 'reports', '報表查詢', 'create', '/reports'),
  ('patients', 'reports', '報表查詢', 'edit', '/reports'),
  ('patients', 'reports', '報表查詢', 'delete', '/reports');

-- 記錄類別
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  -- 監測記錄
  ('records', 'health_monitoring', '監測記錄', 'view', '/health'),
  ('records', 'health_monitoring', '監測記錄', 'create', '/health'),
  ('records', 'health_monitoring', '監測記錄', 'edit', '/health'),
  ('records', 'health_monitoring', '監測記錄', 'delete', '/health'),
  -- 護理記錄
  ('records', 'care_records', '護理記錄', 'view', '/care-records'),
  ('records', 'care_records', '護理記錄', 'create', '/care-records'),
  ('records', 'care_records', '護理記錄', 'edit', '/care-records'),
  ('records', 'care_records', '護理記錄', 'delete', '/care-records'),
  -- 院友日誌
  ('records', 'patient_logs', '院友日誌', 'view', '/patient-logs'),
  ('records', 'patient_logs', '院友日誌', 'create', '/patient-logs'),
  ('records', 'patient_logs', '院友日誌', 'edit', '/patient-logs'),
  ('records', 'patient_logs', '院友日誌', 'delete', '/patient-logs'),
  -- 診斷記錄
  ('records', 'diagnosis_records', '診斷記錄', 'view', '/diagnosis-records'),
  ('records', 'diagnosis_records', '診斷記錄', 'create', '/diagnosis-records'),
  ('records', 'diagnosis_records', '診斷記錄', 'edit', '/diagnosis-records'),
  ('records', 'diagnosis_records', '診斷記錄', 'delete', '/diagnosis-records'),
  -- 疫苗記錄
  ('records', 'vaccination_records', '疫苗記錄', 'view', '/vaccination-records'),
  ('records', 'vaccination_records', '疫苗記錄', 'create', '/vaccination-records'),
  ('records', 'vaccination_records', '疫苗記錄', 'edit', '/vaccination-records'),
  ('records', 'vaccination_records', '疫苗記錄', 'delete', '/vaccination-records');

-- 藥物類別
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  -- 處方管理
  ('medication', 'prescription_management', '處方管理', 'view', '/prescriptions'),
  ('medication', 'prescription_management', '處方管理', 'create', '/prescriptions'),
  ('medication', 'prescription_management', '處方管理', 'edit', '/prescriptions'),
  ('medication', 'prescription_management', '處方管理', 'delete', '/prescriptions'),
  -- 藥物工作流程
  ('medication', 'medication_workflow', '藥物工作流程', 'view', '/medication-workflow'),
  ('medication', 'medication_workflow', '藥物工作流程', 'create', '/medication-workflow'),
  ('medication', 'medication_workflow', '藥物工作流程', 'edit', '/medication-workflow'),
  ('medication', 'medication_workflow', '藥物工作流程', 'delete', '/medication-workflow'),
  -- 藥物資料庫
  ('medication', 'drug_database', '藥物資料庫', 'view', '/drugs'),
  ('medication', 'drug_database', '藥物資料庫', 'create', '/drugs'),
  ('medication', 'drug_database', '藥物資料庫', 'edit', '/drugs'),
  ('medication', 'drug_database', '藥物資料庫', 'delete', '/drugs');

-- 治療類別
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  -- VMO排程
  ('treatment', 'vmo_schedule', 'VMO排程', 'view', '/scheduling'),
  ('treatment', 'vmo_schedule', 'VMO排程', 'create', '/scheduling'),
  ('treatment', 'vmo_schedule', 'VMO排程', 'edit', '/scheduling'),
  ('treatment', 'vmo_schedule', 'VMO排程', 'delete', '/scheduling'),
  -- 醫院外展
  ('treatment', 'hospital_outreach', '醫院外展', 'view', '/hospital-outreach'),
  ('treatment', 'hospital_outreach', '醫院外展', 'create', '/hospital-outreach'),
  ('treatment', 'hospital_outreach', '醫院外展', 'edit', '/hospital-outreach'),
  ('treatment', 'hospital_outreach', '醫院外展', 'delete', '/hospital-outreach'),
  -- 復康服務
  ('treatment', 'rehabilitation', '復康服務', 'view', '/rehabilitation'),
  ('treatment', 'rehabilitation', '復康服務', 'create', '/rehabilitation'),
  ('treatment', 'rehabilitation', '復康服務', 'edit', '/rehabilitation'),
  ('treatment', 'rehabilitation', '復康服務', 'delete', '/rehabilitation');

-- 定期類別
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  -- 年度體檢
  ('periodic', 'annual_checkup', '年度體檢', 'view', '/annual-checkup'),
  ('periodic', 'annual_checkup', '年度體檢', 'create', '/annual-checkup'),
  ('periodic', 'annual_checkup', '年度體檢', 'edit', '/annual-checkup'),
  ('periodic', 'annual_checkup', '年度體檢', 'delete', '/annual-checkup'),
  -- 健康評估
  ('periodic', 'health_assessment', '健康評估', 'view', '/health-assessments'),
  ('periodic', 'health_assessment', '健康評估', 'create', '/health-assessments'),
  ('periodic', 'health_assessment', '健康評估', 'edit', '/health-assessments'),
  ('periodic', 'health_assessment', '健康評估', 'delete', '/health-assessments'),
  -- 個人照顧計劃
  ('periodic', 'care_plan', '個人照顧計劃', 'view', '/care-plan'),
  ('periodic', 'care_plan', '個人照顧計劃', 'create', '/care-plan'),
  ('periodic', 'care_plan', '個人照顧計劃', 'edit', '/care-plan'),
  ('periodic', 'care_plan', '個人照顧計劃', 'delete', '/care-plan'),
  -- 約束物品
  ('periodic', 'restraint', '約束物品', 'view', '/restraint'),
  ('periodic', 'restraint', '約束物品', 'create', '/restraint'),
  ('periodic', 'restraint', '約束物品', 'edit', '/restraint'),
  ('periodic', 'restraint', '約束物品', 'delete', '/restraint'),
  -- 傷口管理
  ('periodic', 'wound_management', '傷口管理', 'view', '/wound'),
  ('periodic', 'wound_management', '傷口管理', 'create', '/wound'),
  ('periodic', 'wound_management', '傷口管理', 'edit', '/wound'),
  ('periodic', 'wound_management', '傷口管理', 'delete', '/wound');

-- 日常類別
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  -- 覆診管理
  ('daily', 'follow_up', '覆診管理', 'view', '/follow-up'),
  ('daily', 'follow_up', '覆診管理', 'create', '/follow-up'),
  ('daily', 'follow_up', '覆診管理', 'edit', '/follow-up'),
  ('daily', 'follow_up', '覆診管理', 'delete', '/follow-up'),
  -- 缺席管理
  ('daily', 'admission_records', '缺席管理', 'view', '/admission-records'),
  ('daily', 'admission_records', '缺席管理', 'create', '/admission-records'),
  ('daily', 'admission_records', '缺席管理', 'edit', '/admission-records'),
  ('daily', 'admission_records', '缺席管理', 'delete', '/admission-records'),
  -- 任務管理
  ('daily', 'task_management', '任務管理', 'view', '/tasks'),
  ('daily', 'task_management', '任務管理', 'create', '/tasks'),
  ('daily', 'task_management', '任務管理', 'edit', '/tasks'),
  ('daily', 'task_management', '任務管理', 'delete', '/tasks'),
  -- 餐膳指引
  ('daily', 'meal_guidance', '餐膳指引', 'view', '/meal-guidance'),
  ('daily', 'meal_guidance', '餐膳指引', 'create', '/meal-guidance'),
  ('daily', 'meal_guidance', '餐膳指引', 'edit', '/meal-guidance'),
  ('daily', 'meal_guidance', '餐膳指引', 'delete', '/meal-guidance'),
  -- 意外事件報告
  ('daily', 'incident_reports', '意外事件報告', 'view', '/incident-reports'),
  ('daily', 'incident_reports', '意外事件報告', 'create', '/incident-reports'),
  ('daily', 'incident_reports', '意外事件報告', 'edit', '/incident-reports'),
  ('daily', 'incident_reports', '意外事件報告', 'delete', '/incident-reports');

-- 列印類別
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  -- 列印表格
  ('print', 'print_forms', '列印表格', 'view', '/print-forms'),
  ('print', 'print_forms', '列印表格', 'create', '/print-forms'),
  ('print', 'print_forms', '列印表格', 'edit', '/print-forms'),
  ('print', 'print_forms', '列印表格', 'delete', '/print-forms'),
  -- 範本管理
  ('print', 'template_management', '範本管理', 'view', '/templates'),
  ('print', 'template_management', '範本管理', 'create', '/templates'),
  ('print', 'template_management', '範本管理', 'edit', '/templates'),
  ('print', 'template_management', '範本管理', 'delete', '/templates');

-- 設定類別
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  -- 系統設定
  ('settings', 'system_settings', '系統設定', 'view', '/settings'),
  ('settings', 'system_settings', '系統設定', 'create', '/settings'),
  ('settings', 'system_settings', '系統設定', 'edit', '/settings'),
  ('settings', 'system_settings', '系統設定', 'delete', '/settings'),
  -- 用戶管理
  ('settings', 'user_management', '用戶管理', 'view', '/settings'),
  ('settings', 'user_management', '用戶管理', 'create', '/settings'),
  ('settings', 'user_management', '用戶管理', 'edit', '/settings'),
  ('settings', 'user_management', '用戶管理', 'delete', '/settings');

-- 10. 建立輔助函數
-- =====================================================

-- 檢查用戶是否有特定權限
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id uuid,
  p_category permission_category_type,
  p_feature text,
  p_action permission_action_type
) RETURNS boolean AS $$
DECLARE
  v_role user_role;
  v_has_permission boolean;
BEGIN
  -- 獲取用戶角色
  SELECT role INTO v_role FROM user_profiles WHERE id = p_user_id AND is_active = true;
  
  -- 開發者擁有所有權限
  IF v_role = 'developer' THEN
    RETURN true;
  END IF;
  
  -- 檢查用戶是否有該權限
  SELECT EXISTS(
    SELECT 1 FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = p_user_id
    AND p.category = p_category
    AND p.feature = p_feature
    AND p.action = p_action
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 獲取用戶所有權限
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id uuid)
RETURNS TABLE (
  category permission_category_type,
  feature text,
  feature_name_zh text,
  action permission_action_type
) AS $$
DECLARE
  v_role user_role;
BEGIN
  -- 獲取用戶角色
  SELECT up.role INTO v_role FROM user_profiles up WHERE up.id = p_user_id AND up.is_active = true;
  
  -- 開發者返回所有權限
  IF v_role = 'developer' THEN
    RETURN QUERY SELECT p.category, p.feature, p.feature_name_zh, p.action FROM permissions p;
  ELSE
    -- 其他用戶返回已分配權限
    RETURN QUERY
    SELECT p.category, p.feature, p.feature_name_zh, p.action
    FROM user_permissions uper
    JOIN permissions p ON uper.permission_id = p.id
    WHERE uper.user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
