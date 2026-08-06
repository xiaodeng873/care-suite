-- 排班管理與公眾假期
-- 1) public_holidays：香港銀行假期(PH) / 勞工假期(SH) model，供開發者/主管維護
-- 2) user_public_holiday_details：公眾假期用度明細（系統按當月假期日數發放）
-- 3) user_employment_details：調整工時欄位、新增公眾假期設定

-- =====================================================
-- 1) 公眾假期 model
-- =====================================================
CREATE TABLE IF NOT EXISTS public_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('PH', 'SH')),
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_holidays_date_type_unique UNIQUE (holiday_date, type)
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_type ON public_holidays(type);

ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許所有操作_公眾假期" ON public_holidays;
CREATE POLICY "允許所有操作_公眾假期" ON public_holidays
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 2) 員工公眾假期用度明細
-- =====================================================
CREATE TABLE IF NOT EXISTS user_public_holiday_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  record_date date NOT NULL,
  detail_type text NOT NULL CHECK (detail_type IN ('grant', 'usage', 'writeoff')),
  days numeric(5,1) NOT NULL CHECK (days > 0),
  remark text,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_public_holiday_details_user_id ON user_public_holiday_details(user_id);
CREATE INDEX IF NOT EXISTS idx_user_public_holiday_details_record_date ON user_public_holiday_details(record_date);

ALTER TABLE user_public_holiday_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許所有操作_公眾假期明細" ON user_public_holiday_details;
CREATE POLICY "允許所有操作_公眾假期明細" ON user_public_holiday_details
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 3) 調整僱傭詳情欄位
-- =====================================================
ALTER TABLE user_employment_details
  DROP COLUMN IF EXISTS weekly_min_hours,
  DROP COLUMN IF EXISTS weekly_max_hours,
  DROP COLUMN IF EXISTS daily_min_hours,
  DROP COLUMN IF EXISTS daily_max_hours;

ALTER TABLE user_employment_details
  ADD COLUMN IF NOT EXISTS daily_contract_hours numeric(4,1),
  ADD COLUMN IF NOT EXISTS weekly_work_days numeric(3,1),
  ADD COLUMN IF NOT EXISTS public_holiday_type text CHECK (public_holiday_type IN ('PH', 'SH')),
  ADD COLUMN IF NOT EXISTS public_holiday_start_date date,
  ADD COLUMN IF NOT EXISTS public_holiday_description text;
