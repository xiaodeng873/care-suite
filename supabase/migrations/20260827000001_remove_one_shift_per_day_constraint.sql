-- 允許同一位員工在同一排班日擁有多個班次，只要時間不重疊。
-- 移除舊的「每天一班」唯一約束，改以 trigger 檢查時段重疊。
ALTER TABLE public.user_shift_assignments
DROP CONSTRAINT IF EXISTS one_shift_per_user_per_day;

-- 重疊判斷：以排班日 07:00 為起點，將時段轉為分鐘數；跨午夜者 end + 1440。
CREATE OR REPLACE FUNCTION public.check_shift_overlap()
RETURNS trigger AS $$
DECLARE
  new_start int;
  new_end int;
  other_start int;
  other_end int;
  rec record;
BEGIN
  new_start := EXTRACT(HOUR FROM NEW.start_time)::int * 60 + EXTRACT(MINUTE FROM NEW.start_time)::int;
  new_end := EXTRACT(HOUR FROM NEW.end_time)::int * 60 + EXTRACT(MINUTE FROM NEW.end_time)::int;
  IF new_end <= new_start THEN
    new_end := new_end + 1440;
  END IF;

  FOR rec IN
    SELECT start_time, end_time
    FROM public.user_shift_assignments
    WHERE user_id = NEW.user_id
      AND work_date = NEW.work_date
      AND id IS DISTINCT FROM NEW.id
  LOOP
    other_start := EXTRACT(HOUR FROM rec.start_time)::int * 60 + EXTRACT(MINUTE FROM rec.start_time)::int;
    other_end := EXTRACT(HOUR FROM rec.end_time)::int * 60 + EXTRACT(MINUTE FROM rec.end_time)::int;
    IF other_end <= other_start THEN
      other_end := other_end + 1440;
    END IF;

    IF new_start < other_end AND new_end > other_start THEN
      RAISE EXCEPTION '員工在同一排班日已有重疊班次';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_shift_overlap ON public.user_shift_assignments;
CREATE TRIGGER trg_check_shift_overlap
BEFORE INSERT OR UPDATE ON public.user_shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.check_shift_overlap();

COMMENT ON TABLE public.user_shift_assignments IS '員工每日班次指派，同一天可排多個不重疊班次';
