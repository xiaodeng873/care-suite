/*
  # 建立院友活動記錄表 patient_activity_records

  對應「院友健康教育 / 活動記錄表」(doc_html)：每位院友、每個日期一列，
  記錄當天參與的活動類別（16 個 checkbox，分屬 6 大類）、其他活動、備註，
  以及當天是否缺席（純記錄用途，不影響逾期計算）。

  1. 新增表格 patient_activity_records
     - id (uuid, PK)
     - patient_id (integer) 對應 院友主表.院友id
     - record_date (date) 記錄日期

     -- 16 個活動類別 checkbox（依 doc_html 6 大類分組）
     - has_birthday_party / has_festival_celebration / has_performance         (集體活動)
     - has_outing / has_visit / has_shopping_dimsum / has_games                (戶外集體活動)
     - has_interest_group / has_learning_group                                (小組活動 A/B)
     - has_self_care_training / has_individual_interest / has_individual_counseling
       / has_individual_therapy / has_group_visit                             (個人活動 C/D/E/F/G)
     - has_exercise                                                          (運動)
     - has_health_talk                                                       (健康教育講座)

     - other_activity (text) 對應「其他」欄
     - notes (text) 備註
     - is_absent (boolean) 當天是否缺席（缺席時 16 個 checkbox 應皆為 false）
     - absence_reason (text) 缺席原因
     - recorder (text) 記錄人員
     - created_at / updated_at (timestamptz)

  2. 安全性
     - 啟用 RLS，比照其他表新增 {anon, authenticated} 全權限政策（App 採自訂登入，以 anon 角色查詢）

  3. 索引 / 唯一鍵
     - UNIQUE(patient_id, record_date)：每位院友每天只有一筆活動記錄
     - patient_id、record_date 索引
*/

CREATE TABLE IF NOT EXISTS patient_activity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  record_date date NOT NULL,

  has_birthday_party boolean DEFAULT false,
  has_festival_celebration boolean DEFAULT false,
  has_performance boolean DEFAULT false,

  has_outing boolean DEFAULT false,
  has_visit boolean DEFAULT false,
  has_shopping_dimsum boolean DEFAULT false,
  has_games boolean DEFAULT false,

  has_interest_group boolean DEFAULT false,
  has_learning_group boolean DEFAULT false,

  has_self_care_training boolean DEFAULT false,
  has_individual_interest boolean DEFAULT false,
  has_individual_counseling boolean DEFAULT false,
  has_individual_therapy boolean DEFAULT false,
  has_group_visit boolean DEFAULT false,

  has_exercise boolean DEFAULT false,
  has_health_talk boolean DEFAULT false,

  other_activity text,
  notes text,
  is_absent boolean DEFAULT false,
  absence_reason text,
  recorder text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(patient_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_activity_records_patient_id ON patient_activity_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_activity_records_record_date ON patient_activity_records(record_date);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION set_activity_records_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_records_updated_at ON patient_activity_records;
DROP TRIGGER IF EXISTS trg_activity_records_updated_at ON patient_activity_records;

CREATE TRIGGER trg_activity_records_updated_at BEFORE UPDATE ON patient_activity_records
  FOR EACH ROW EXECUTE FUNCTION set_activity_records_updated_at();

-- 啟用 RLS
ALTER TABLE patient_activity_records ENABLE ROW LEVEL SECURITY;

-- RLS 政策：anon 與 authenticated 全權限（比照院友主表 / 喉管護理記錄）
DROP POLICY IF EXISTS "Allow all access patient_activity_records" ON patient_activity_records;
DROP POLICY IF EXISTS "Allow all access patient_activity_records" ON patient_activity_records;

CREATE POLICY "Allow all access patient_activity_records" ON patient_activity_records FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE patient_activity_records IS '院友活動記錄表：對應院友健康教育/活動記錄表，每位院友每天一列，記錄當天參與的活動類別';
COMMENT ON COLUMN patient_activity_records.is_absent IS '當天是否缺席（純記錄用途，不影響每月最少2次的逾期計算）';
