/*
  # 建立 PGT 記錄表

  與 CGAT 同級的治療頁面。結構照 cgat_records 簡化：
  無費用結算、無 CGAS/EOL、侯診原因只有續藥/簽信/轉介信。

  1. 新表 pgt_records（每次到診一筆，一院友對多筆）
    - 個案類型：case_type（新症/舊症）
    - 藥物配發：medication_end_date（藥完日期）、pharmacy_arrangement（個別/集體取藥）、is_urgent_medication（急藥）、treatment_weeks（療程周數）
    - 侯診原因：reason_renew / reason_sign_letter / reason_referral_letter
    - PGT 到診安排：pgt_visit_date / pgt_visit_unknown、medication_pickup_arrangement（取藥安排）

  2. 說明
    - 到診日期清單與 CGAT 共用 doctor_visit_schedule 表（刻意決定，不另建 schedule 表）
    - PGT 記錄冇費用欄位
*/

CREATE TABLE IF NOT EXISTS pgt_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,

  -- 個案類型
  case_type text CHECK (case_type IN ('新症', '舊症')),

  -- 藥物配發
  medication_end_date date,
  pharmacy_arrangement text CHECK (pharmacy_arrangement IN ('個別取藥', '集體取藥')),
  is_urgent_medication boolean NOT NULL DEFAULT false,

  -- 侯診原因
  reason_renew boolean NOT NULL DEFAULT false,
  reason_sign_letter boolean NOT NULL DEFAULT false,
  reason_referral_letter boolean NOT NULL DEFAULT false,

  -- PGT 到診安排
  pgt_visit_date date,
  pgt_visit_unknown boolean,
  medication_pickup_arrangement text CHECK (medication_pickup_arrangement IN ('家人前往', '院舍代勞', '每次詢問')),

  treatment_weeks integer,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pgt_records_patient_id ON pgt_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_pgt_records_pgt_visit_date ON pgt_records(pgt_visit_date);
CREATE INDEX IF NOT EXISTS idx_pgt_records_medication_end_date ON pgt_records(medication_end_date);

ALTER TABLE pgt_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允許已認證用戶讀取PGT記錄" ON pgt_records;
CREATE POLICY "允許已認證用戶讀取PGT記錄" ON pgt_records FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "允許已認證用戶新增PGT記錄" ON pgt_records;
CREATE POLICY "允許已認證用戶新增PGT記錄" ON pgt_records FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "允許已認證用戶更新PGT記錄" ON pgt_records;
CREATE POLICY "允許已認證用戶更新PGT記錄" ON pgt_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "允許已認證用戶刪除PGT記錄" ON pgt_records;
CREATE POLICY "允許已認證用戶刪除PGT記錄" ON pgt_records FOR DELETE TO authenticated USING (true);

-- 自訂認證（web 端走 anon role）需要此策略
DROP POLICY IF EXISTS "Allow all access" ON pgt_records;
CREATE POLICY "Allow all access" ON pgt_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_pgt_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_pgt_records_updated_at ON pgt_records;
CREATE TRIGGER trg_pgt_records_updated_at BEFORE UPDATE ON pgt_records
  FOR EACH ROW EXECUTE FUNCTION update_pgt_records_updated_at();
