-- 重建院舍活動資料表（20260912000000_home_activities.sql 已標記套用但表不存在）
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

ALTER TABLE home_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON home_activities;
CREATE POLICY "tenant_isolation" ON home_activities FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_home_activities ON home_activities;
CREATE TRIGGER trg_set_facility_from_claim_home_activities BEFORE INSERT ON home_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
