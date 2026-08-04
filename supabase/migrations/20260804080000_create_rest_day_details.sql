-- 休息日改為用度明細制（與有薪年假一致）
-- 1) user_employment_details 增加 rest_day_start_date（休息日計算起始日）
-- 2) user_rest_day_details：休息日用度明細（系統發放/使用/抹平）
--    發放規則：起始日發放一次「每周休息日」天數，之後逢周日發放
--    累積 = Σgrant − Σusage − Σwriteoff（可透支無上限、可累積無上限，UI 層不設下限）
-- 舊欄位 accumulated_rest_days 保留於表內但不再使用（結餘改由明細表計算）

ALTER TABLE user_employment_details
  ADD COLUMN IF NOT EXISTS rest_day_start_date date;

CREATE TABLE IF NOT EXISTS user_rest_day_details (
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

CREATE INDEX IF NOT EXISTS idx_user_rest_day_details_user_id ON user_rest_day_details(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rest_day_details_record_date ON user_rest_day_details(record_date);

ALTER TABLE user_rest_day_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許所有操作_休息日明細" ON user_rest_day_details;
CREATE POLICY "允許所有操作_休息日明細" ON user_rest_day_details
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
