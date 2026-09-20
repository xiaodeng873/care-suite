/*
  # 藥物調節監測提醒「不再提醒」壓制紀錄（伺服器端）

  1. 背景
    - 之前壓制紀錄存喺瀏覽器 localStorage，換機/換瀏覽器/清 cache 會失效
    - 搬上伺服器後全院所有工作站共用同一份壓制紀錄

  2. 變更
    - 新增 drug_adjustment_reminder_dismissals 表
    - key = 院友 + 藥物名稱 + 監測類型（血糖值/生命表徵），同前端 drugAdjustItemKey 對應
    - 多用戶多用戶隔離：facility_id + RLS（同 home_activities 模式）
*/

CREATE TABLE IF NOT EXISTS drug_adjustment_reminder_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id integer NOT NULL,
  medication_name text NOT NULL,
  task_type text NOT NULL,              -- 血糖值 / 生命表徵

  dismissed_by uuid,                    -- 操作者 auth user id（可空）
  dismissed_by_name text,               -- 操作者姓名（可空）

  facility_id integer REFERENCES facilities(id),
  created_at timestamptz DEFAULT now()
);

-- 同一院友同一藥同一監測類型只壓制一次（facility_id 用 COALESCE 處理 developer 無院舍嘅情況）
CREATE UNIQUE INDEX IF NOT EXISTS uq_drug_adjust_dismissal
  ON drug_adjustment_reminder_dismissals (patient_id, medication_name, task_type, COALESCE(facility_id, 0));

CREATE INDEX IF NOT EXISTS idx_drug_adjust_dismissal_facility
  ON drug_adjustment_reminder_dismissals(facility_id);

ALTER TABLE drug_adjustment_reminder_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON drug_adjustment_reminder_dismissals;
CREATE POLICY "tenant_isolation" ON drug_adjustment_reminder_dismissals FOR ALL TO authenticated
  USING (public.jwt_is_developer() OR facility_id = public.jwt_facility_id())
  WITH CHECK (public.jwt_is_developer() OR facility_id = public.jwt_facility_id());

DROP TRIGGER IF EXISTS trg_set_facility_from_claim_drug_adjust_dismissal ON drug_adjustment_reminder_dismissals;
CREATE TRIGGER trg_set_facility_from_claim_drug_adjust_dismissal BEFORE INSERT ON drug_adjustment_reminder_dismissals
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_id_from_claim();
