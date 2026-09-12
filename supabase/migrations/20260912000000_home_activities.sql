-- 院舍活動資料（附件3.2 每月院舍活動資料）
-- 對應 upload/活動記錄.pdf 嘅每月活動表：一場活動一列，記錄日期/時間/主辦機構/活動名稱/地點/義工人數/參加人數。

CREATE TABLE IF NOT EXISTS home_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  activity_date date NOT NULL,
  start_time time,
  end_time time,

  organizer text,          -- 主辦機構/團體
  activity_name text NOT NULL,
  location text,           -- 地點（如外出，請列明）

  volunteer_count integer NOT NULL DEFAULT 0,    -- 義工人數（0 = 冇義工）
  participant_count integer NOT NULL DEFAULT 0,  -- 參加人數

  facility_id integer REFERENCES facilities(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_activities_date ON home_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_home_activities_facility ON home_activities(facility_id);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION set_home_activities_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_home_activities_updated_at ON home_activities;
CREATE TRIGGER trg_home_activities_updated_at BEFORE UPDATE ON home_activities
  FOR EACH ROW EXECUTE FUNCTION set_home_activities_updated_at();

-- RLS：院舍隔離（比照 20260904110000_multi_tenant_rls.sql 嘅 tenant 表）
ALTER TABLE home_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON home_activities;
CREATE POLICY "tenant_isolation" ON home_activities FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

-- INSERT 時由 JWT claim 自動填 facility_id（service role 無 claim 時保持 NULL）
DROP TRIGGER IF EXISTS trg_set_facility_from_claim_home_activities ON home_activities;
CREATE TRIGGER trg_set_facility_from_claim_home_activities BEFORE INSERT ON home_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();

COMMENT ON TABLE home_activities IS '院舍活動資料（附件3.2 每月院舍活動資料）：一場活動一列';
COMMENT ON COLUMN home_activities.volunteer_count IS '義工人數；0 表示冇義工協助（對應原表「有否義工協助」）';
