/*
  # 建立 CGAT 記錄表（社區老人評估小組）

  取代舊「醫院外展」頁面。舊表 hospital_outreach_records 保留但 web 頁面棄用。

  1. 新表 cgat_records（每次到診一筆，一院友對多筆）
    - 個案類型：case_type（新症/舊症，互斥必填）、is_cgas、is_eol
    - 藥物配發：medication_end_date（藥完日期）、pharmacy_arrangement（個別/集體取藥）、is_urgent_medication（急藥）
    - 侯診原因：reason_renew/discharge/sign_letter/view_report + 看報告細項 report_bld/xray/ct/usg/other
    - 覆診安排：followup_date（覆診日期，不可比藥完日期遲）、medication_pickup_arrangement（取藥安排）
    - 費用結算：fee_exempted（一次性豁免）、consultation_fee（診金 d100）、medication_fee_per_item（藥費 d20）、prescription_count、treatment_weeks、total_fee

  2. 說明
    - 合資格轄免收費人士為 runtime 計算（不存 DB）
    - 費用 = 診金 + 處方數量 × 藥費 × ceil(療程周數 / 4)；豁免時為 0
*/

CREATE TABLE IF NOT EXISTS cgat_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,

  -- 個案類型
  case_type text CHECK (case_type IN ('新症', '舊症')),
  is_cgas boolean NOT NULL DEFAULT false,
  is_eol boolean NOT NULL DEFAULT false,

  -- 藥物配發
  medication_end_date date,
  pharmacy_arrangement text CHECK (pharmacy_arrangement IN ('個別取藥', '集體取藥')),
  is_urgent_medication boolean NOT NULL DEFAULT false,

  -- 侯診原因
  reason_renew boolean NOT NULL DEFAULT false,
  reason_discharge boolean NOT NULL DEFAULT false,
  reason_sign_letter boolean NOT NULL DEFAULT false,
  reason_referral_letter boolean NOT NULL DEFAULT false,
  reason_view_report boolean NOT NULL DEFAULT false,
  report_bld boolean NOT NULL DEFAULT false,
  report_xray boolean NOT NULL DEFAULT false,
  report_ct boolean NOT NULL DEFAULT false,
  report_usg boolean NOT NULL DEFAULT false,
  report_other text,

  -- 覆診安排
  followup_date date,
  medication_pickup_arrangement text CHECK (medication_pickup_arrangement IN ('家人前往', '院舍代勞', '每次詢問')),

  -- 費用結算
  fee_exempted boolean NOT NULL DEFAULT false,
  consultation_fee numeric NOT NULL DEFAULT 100,
  medication_fee_per_item numeric NOT NULL DEFAULT 20,
  prescription_count integer,
  treatment_weeks integer,
  total_fee numeric,

  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- 覆診日期不可比藥完日期遲
  CONSTRAINT cgat_followup_before_end_date
    CHECK (followup_date IS NULL OR medication_end_date IS NULL OR followup_date <= medication_end_date)
);

CREATE INDEX IF NOT EXISTS idx_cgat_records_patient_id ON cgat_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_cgat_records_followup_date ON cgat_records(followup_date);
CREATE INDEX IF NOT EXISTS idx_cgat_records_medication_end_date ON cgat_records(medication_end_date);

ALTER TABLE cgat_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允許已認證用戶讀取CGAT記錄"
  ON cgat_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增CGAT記錄"
  ON cgat_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新CGAT記錄"
  ON cgat_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除CGAT記錄"
  ON cgat_records FOR DELETE TO authenticated USING (true);

-- 自訂認證（web 端走 anon role）需要此策略
CREATE POLICY "Allow all access"
  ON cgat_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_cgat_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_cgat_records_updated_at ON cgat_records;
CREATE TRIGGER trg_cgat_records_updated_at
  BEFORE UPDATE ON cgat_records
  FOR EACH ROW EXECUTE FUNCTION update_cgat_records_updated_at();
