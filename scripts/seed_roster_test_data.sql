-- =====================================================
-- 排班管理測試用假資料
-- 用途：在開發/測試環境插入四名不同職位的員工及其僱傭詳情
-- 執行後可到「排班管理」頁測試預排、拖曳、自動排班
-- =====================================================

-- 1) 先清除同名的測試員工（避免重複執行時衝突）
DELETE FROM user_employment_details
WHERE user_id IN (SELECT id FROM user_profiles WHERE username LIKE 'test-roster-%');

DELETE FROM user_profiles
WHERE username LIKE 'test-roster-%';

-- 2) 插入四名測試員工
INSERT INTO user_profiles (
  id, username, password_hash, name_zh, name_en, id_number, date_of_birth,
  department, nursing_position, allied_health_position, hygiene_position, other_position,
  secondary_positions, hire_date, employment_type, monthly_hour_limit, role,
  is_active, auth_user_id, login_qr_code_id, avatar_url, created_by, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'test-roster-rn', 'dummypw', '測試註冊護士', 'Test RN', NULL, NULL,
   '護理', '註冊護士', NULL, NULL, NULL,
   ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
   true, NULL, 'test-roster-rn-qr', NULL, NULL, now(), now()),

  (gen_random_uuid(), 'test-roster-ha', 'dummypw', '測試保健員', 'Test HA', NULL, NULL,
   '護理', '保健員', NULL, NULL, NULL,
   ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
   true, NULL, 'test-roster-ha-qr', NULL, NULL, now(), now()),

  (gen_random_uuid(), 'test-roster-cw', 'dummypw', '測試護理員', 'Test CW', NULL, NULL,
   '護理', '護理員', NULL, NULL, NULL,
   ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
   true, NULL, 'test-roster-cw-qr', NULL, NULL, now(), now()),

  (gen_random_uuid(), 'test-roster-as', 'dummypw', '測試助理員', 'Test Asst', NULL, NULL,
   '衛生', NULL, NULL, '助理員', NULL,
   ARRAY[]::text[], '2024-01-01', '正職', NULL, 'staff',
   true, NULL, 'test-roster-as-qr', NULL, NULL, now(), now());

-- 3) 插入對應僱傭詳情（每日工時 8h、每周工時 40h、每周工作 5 天、有 PH/SH）
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

-- 4) （可選）插入一筆助理員預排 AL，方便立即測試預排表顯示
INSERT INTO user_leave_records (
  user_id, leave_date, record_type, leave_type, urgency,
  reference_public_holiday_id, availability_start_time, availability_end_time,
  is_overridden, remark, created_at, updated_at
)
SELECT id, '2026-09-10', 'leave', 'AL', 'preferred', NULL, NULL, NULL, false, '測試 AL', now(), now()
FROM user_profiles
WHERE username = 'test-roster-as';
