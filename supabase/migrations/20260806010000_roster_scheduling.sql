-- 排班預排：PH/SH/DO/PRD 資料模型調整
-- 1) user_leave_records 增加 reference_public_holiday_id，leave_type 加入 PH/SH
-- 2) user_employment_details 增加 rest_day_fraction、移除 weekly_rest_days
-- 3) 舊 weekly_rest_days 換算為 weekly_work_days（若後者為 null）

-- =====================================================
-- 1) user_leave_records：PH/SH 預排
-- =====================================================
ALTER TABLE user_leave_records
  ADD COLUMN IF NOT EXISTS reference_public_holiday_id uuid REFERENCES public_holidays(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_leave_records_reference_holiday_id
  ON user_leave_records(reference_public_holiday_id);

ALTER TABLE user_leave_records
  DROP CONSTRAINT IF EXISTS user_leave_records_leave_type_check;

ALTER TABLE user_leave_records
  ADD CONSTRAINT user_leave_records_leave_type_check
    CHECK (leave_type IN ('AL', 'PRD', 'DO', 'SL', 'CL', 'NPL', 'PH', 'SH'));

-- =====================================================
-- 2) user_employment_details：PRD 小數累積、移除 weekly_rest_days
-- =====================================================
ALTER TABLE user_employment_details
  ADD COLUMN IF NOT EXISTS rest_day_fraction numeric(3,1) NOT NULL DEFAULT 0;

-- 舊資料遷移：weekly_work_days 為 null 而 weekly_rest_days 有值時，回填 weekly_work_days
UPDATE user_employment_details
SET weekly_work_days = 7 - COALESCE(weekly_rest_days, 0)
WHERE weekly_work_days IS NULL AND weekly_rest_days IS NOT NULL;

ALTER TABLE user_employment_details
  DROP COLUMN IF EXISTS weekly_rest_days;

-- 確保 weekly_work_days 在合理範圍（0.5–6.0，0.5 為單位）
ALTER TABLE user_employment_details
  DROP CONSTRAINT IF EXISTS user_employment_details_weekly_work_days_check;

ALTER TABLE user_employment_details
  ADD CONSTRAINT user_employment_details_weekly_work_days_check
    CHECK (weekly_work_days IS NULL OR (weekly_work_days >= 0.5 AND weekly_work_days <= 6.0 AND (weekly_work_days * 2) = ROUND(weekly_work_days * 2)));
