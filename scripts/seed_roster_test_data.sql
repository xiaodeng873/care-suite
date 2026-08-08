-- =====================================================
-- 排班管理測試用假資料
-- 用途：在開發/測試環境插入足夠覆蓋當前院舍合約與特定鐘點要求的員工
-- 計算基礎（以執行時 facility_settings / 院友主表為準）：
--   在住人數 250、甲一買位 153 宿位、安老院 116 宿位
--   護理員特定鐘點：ceil(250/20) = 13 人
--   助理員特定鐘點：ceil(250/40) = 7 人
--   保健員等效人手：ceil(250/30) = 9 等效（已預留 1 名註冊護士貢獻 2 等效）
--   甲一買位每日工時目標：
--     主管 7h、護士（RN+EN）52.5h、保健員 52.5h、護理員 210h、助理員 105h
-- 執行後可到「排班管理」頁測試預排、拖曳、自動排班、人手達標檢查
-- =====================================================

-- 1) 先清除舊的 test-roster-* 測試員工
DELETE FROM user_shift_assignments
WHERE user_id IN (SELECT id FROM user_profiles WHERE username LIKE 'test-roster-%');

DELETE FROM user_employment_details
WHERE user_id IN (SELECT id FROM user_profiles WHERE username LIKE 'test-roster-%');

DELETE FROM user_leave_records
WHERE user_id IN (SELECT id FROM user_profiles WHERE username LIKE 'test-roster-%');

DELETE FROM user_profiles
WHERE username LIKE 'test-roster-%';

-- 2) 插入測試主管 ×2
INSERT INTO user_profiles (
  id, username, password_hash, name_zh, name_en, id_number, date_of_birth,
  department, nursing_position, allied_health_position, hygiene_position, other_position,
  secondary_positions, hire_date, employment_type, monthly_hour_limit, role,
  is_active, auth_user_id, login_qr_code_id, avatar_url, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'test-roster-admin-' || g::text,
  'dummypw',
  '測試主管' || g::text,
  'Test Admin ' || g::text,
  NULL, NULL,
  '行政', NULL, NULL, NULL, '主管',
  ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
  true, NULL, 'test-roster-admin-' || g::text || '-qr', NULL, NULL, now(), now()
FROM generate_series(1, 2) g;

-- 3) 插入測試註冊護士 ×2（甲一買位 52.5h 護士工時可由 RN+EN 合計；只需保證有 RN 覆蓋 8h 註冊護士特定要求）
INSERT INTO user_profiles (
  id, username, password_hash, name_zh, name_en, id_number, date_of_birth,
  department, nursing_position, allied_health_position, hygiene_position, other_position,
  secondary_positions, hire_date, employment_type, monthly_hour_limit, role,
  is_active, auth_user_id, login_qr_code_id, avatar_url, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'test-roster-rn-' || g::text,
  'dummypw',
  '測試註冊護士' || g::text,
  'Test RN ' || g::text,
  NULL, NULL,
  '護理', '註冊護士', NULL, NULL, NULL,
  ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
  true, NULL, 'test-roster-rn-' || g::text || '-qr', NULL, NULL, now(), now()
FROM generate_series(1, 2) g;

-- 4) 插入測試登記護士 ×5（與註冊護士合計 7 人，填滿甲一買位護士每日 52.5h）
INSERT INTO user_profiles (
  id, username, password_hash, name_zh, name_en, id_number, date_of_birth,
  department, nursing_position, allied_health_position, hygiene_position, other_position,
  secondary_positions, hire_date, employment_type, monthly_hour_limit, role,
  is_active, auth_user_id, login_qr_code_id, avatar_url, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'test-roster-en-' || g::text,
  'dummypw',
  '測試登記護士' || g::text,
  'Test EN ' || g::text,
  NULL, NULL,
  '護理', '登記護士', NULL, NULL, NULL,
  ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
  true, NULL, 'test-roster-en-' || g::text || '-qr', NULL, NULL, now(), now()
FROM generate_series(1, 5) g;

-- 5) 插入測試保健員 ×7（每日工時 52.5h：ceil(52.5/8)=7；加上 2 名 RN 貢獻的 4 等效，滿足特定鐘點 9 等效人手）
INSERT INTO user_profiles (
  id, username, password_hash, name_zh, name_en, id_number, date_of_birth,
  department, nursing_position, allied_health_position, hygiene_position, other_position,
  secondary_positions, hire_date, employment_type, monthly_hour_limit, role,
  is_active, auth_user_id, login_qr_code_id, avatar_url, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'test-roster-ha-' || g::text,
  'dummypw',
  '測試保健員' || g::text,
  'Test HA ' || g::text,
  NULL, NULL,
  '護理', '保健員', NULL, NULL, NULL,
  ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
  true, NULL, 'test-roster-ha-' || g::text || '-qr', NULL, NULL, now(), now()
FROM generate_series(1, 7) g;

-- 6) 插入測試護理員 ×27（滿足每日 210h：ceil(210/8)=27；特定鐘點峰值 13 人）
INSERT INTO user_profiles (
  id, username, password_hash, name_zh, name_en, id_number, date_of_birth,
  department, nursing_position, allied_health_position, hygiene_position, other_position,
  secondary_positions, hire_date, employment_type, monthly_hour_limit, role,
  is_active, auth_user_id, login_qr_code_id, avatar_url, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'test-roster-cw-' || g::text,
  'dummypw',
  '測試護理員' || g::text,
  'Test CW ' || g::text,
  NULL, NULL,
  '護理', '護理員', NULL, NULL, NULL,
  ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
  true, NULL, 'test-roster-cw-' || g::text || '-qr', NULL, NULL, now(), now()
FROM generate_series(1, 27) g;

-- 7) 插入測試清潔員 ×14（滿足每日 105h：ceil(105/8)=14；特定鐘點峰值 7 人）
INSERT INTO user_profiles (
  id, username, password_hash, name_zh, name_en, id_number, date_of_birth,
  department, nursing_position, allied_health_position, hygiene_position, other_position,
  secondary_positions, hire_date, employment_type, monthly_hour_limit, role,
  is_active, auth_user_id, login_qr_code_id, avatar_url, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'test-roster-as-' || g::text,
  'dummypw',
  '測試清潔員' || g::text,
  'Test Asst ' || g::text,
  NULL, NULL,
  '庶務', NULL, NULL, NULL, '清潔員',
  ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
  true, NULL, 'test-roster-as-' || g::text || '-qr', NULL, NULL, now(), now()
FROM generate_series(1, 14) g;

-- 8) 插入對應僱傭詳情（每日工時 8h、每周工時 40h、每周工作 5 天、有 PH/SH）
INSERT INTO user_employment_details (
  user_id, work_pattern, weekly_contract_hours, daily_contract_hours,
  default_work_start_time, weekly_work_days, hours_balance, rest_day_fraction,
  accumulated_rest_days, rest_day_start_date, annual_leave_days_per_year,
  annual_leave_start_date, public_holiday_type, public_holiday_start_date,
  public_holiday_description, preferred_station_primary, preferred_station_secondary,
  stations_forbidden, created_at, updated_at
)
SELECT
  id,
  NULL,           -- work_pattern (已廢棄)
  40,             -- weekly_contract_hours
  8,              -- daily_contract_hours
  '07:00',        -- default_work_start_time
  5,              -- weekly_work_days
  0,              -- hours_balance
  0,              -- rest_day_fraction
  0,              -- accumulated_rest_days
  '2024-01-01',   -- rest_day_start_date
  12,             -- annual_leave_days_per_year
  '2024-01-01',   -- annual_leave_start_date
  'PH',           -- public_holiday_type
  '2024-01-01',   -- public_holiday_start_date
  '測試用',       -- public_holiday_description
  NULL,           -- preferred_station_primary
  ARRAY[]::uuid[],-- preferred_station_secondary
  ARRAY[]::uuid[],-- stations_forbidden
  now(),
  now()
FROM user_profiles
WHERE username LIKE 'test-roster-%';
