-- 僱傭詳情與院舍性質（排班管理底層邏輯）
-- 1) user_employment_details：每個適用職位用戶一筆僱傭詳情
-- 2) user_annual_leave_details：年假用度明細（系統發放/使用/抹平）
-- 3) user_balance_adjustments：工時結餘、累積休息日的抹平記錄
-- 4) user_leave_records：請假記錄（請假概況月矩陣資料來源，輸入由日後排班功能提供）
-- 5) facility_settings 增加院舍性質欄位（床位數、最低要求、特定鐘點）

-- =====================================================
-- 1) 僱傭詳情
-- =====================================================
CREATE TABLE IF NOT EXISTS user_employment_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  -- 工作日安排：輪班 / 一至五（互斥，可不選）
  work_pattern text CHECK (work_pattern IN ('輪班', '一至五')),
  -- 工作時間（0.5 小時為最小單位，NULL = 無限制）
  weekly_contract_hours numeric(5,1),
  weekly_min_hours numeric(5,1),
  weekly_max_hours numeric(5,1),
  daily_min_hours numeric(4,1),
  daily_max_hours numeric(4,1),
  -- 工時結餘：正數 = 院舍現欠職員小時；負數 = 職員現欠院舍小時
  hours_balance numeric(6,1) NOT NULL DEFAULT 0,
  -- 休息日
  weekly_rest_days numeric(3,1),
  accumulated_rest_days numeric(6,1) NOT NULL DEFAULT 0,
  -- 有薪年假
  annual_leave_days_per_year numeric(4,1),
  annual_leave_start_date date,
  -- 優先指派居住區
  preferred_station_primary uuid REFERENCES stations(id) ON DELETE SET NULL,
  preferred_station_secondary uuid[] NOT NULL DEFAULT '{}',
  stations_forbidden uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_employment_details_user_id ON user_employment_details(user_id);

-- =====================================================
-- 2) 年假用度明細
-- detail_type: grant=獲得（is_system=true 為系統自動發放，唯讀）/ usage=使用 / writeoff=抹平
-- days 一律存正數，方向由 detail_type 決定
-- 累積 = Σgrant − Σusage − Σwriteoff（可負，下限為 −每年N天，由 UI 層硬阻止）
-- =====================================================
CREATE TABLE IF NOT EXISTS user_annual_leave_details (
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

CREATE INDEX IF NOT EXISTS idx_user_annual_leave_details_user_id ON user_annual_leave_details(user_id);
CREATE INDEX IF NOT EXISTS idx_user_annual_leave_details_record_date ON user_annual_leave_details(record_date);

-- =====================================================
-- 3) 結餘抹平記錄（工時結餘 / 累積休息日）
-- =====================================================
CREATE TABLE IF NOT EXISTS user_balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  balance_type text NOT NULL CHECK (balance_type IN ('hours', 'rest_days')),
  previous_value numeric(6,1) NOT NULL,
  new_value numeric(6,1) NOT NULL,
  remark text NOT NULL,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_balance_adjustments_user_id ON user_balance_adjustments(user_id);

-- =====================================================
-- 4) 請假記錄（AL 年假 / PRD 補假 / DO 休息日 / SL 病假 / CL 事假 / NPL 無薪假）
-- 同一用戶同一天只可一種假
-- =====================================================
CREATE TABLE IF NOT EXISTS user_leave_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  leave_date date NOT NULL,
  leave_type text NOT NULL CHECK (leave_type IN ('AL', 'PRD', 'DO', 'SL', 'CL', 'NPL')),
  remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_leave_records_user_date_unique UNIQUE (user_id, leave_date)
);

CREATE INDEX IF NOT EXISTS idx_user_leave_records_user_id ON user_leave_records(user_id);
CREATE INDEX IF NOT EXISTS idx_user_leave_records_leave_date ON user_leave_records(leave_date);

-- =====================================================
-- 5) facility_settings：院舍性質
-- nature_bed_counts: { "安老院": n, "甲二買位": n, "甲一買位": n, "院舍卷計劃": n }
-- nature_requirements: 每性質 { ratios: { 職位: 1:N 的 N }, hours: { 職位: { baseBeds:N, headcount:M, hoursPerDay:H } } }
--   物理治療師的 hoursPerDay 為每周小時
-- specific_hours_config: 全院共用特定鐘點
--   { requirement1: { segments: [{start:"07:00",end:"17:00"}], ratio: 20 },
--     requirement2: { ratio: 40 },
--     requirement3: { start:"07:00", end:"18:00" } }
-- =====================================================
ALTER TABLE public.facility_settings
  ADD COLUMN IF NOT EXISTS nature_bed_counts jsonb,
  ADD COLUMN IF NOT EXISTS nature_requirements jsonb,
  ADD COLUMN IF NOT EXISTS specific_hours_config jsonb;

-- =====================================================
-- RLS：與專案其他資料表一致，anon/authenticated 全開放，權限於 UI 層控管
-- =====================================================
ALTER TABLE user_employment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_annual_leave_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balance_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_leave_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許所有操作_僱傭詳情" ON user_employment_details;
CREATE POLICY "允許所有操作_僱傭詳情" ON user_employment_details
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "允許所有操作_年假明細" ON user_annual_leave_details;
CREATE POLICY "允許所有操作_年假明細" ON user_annual_leave_details
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "允許所有操作_結餘調整" ON user_balance_adjustments;
CREATE POLICY "允許所有操作_結餘調整" ON user_balance_adjustments
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "允許所有操作_請假記錄" ON user_leave_records;
CREATE POLICY "允許所有操作_請假記錄" ON user_leave_records
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
