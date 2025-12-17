/*
  # 醫院外展服務管理系統

  1. 新增枚舉類型
    - `medication_pickup_arrangement_type` - 取藥安排類型
    - `outreach_medication_source_type` - 外展藥物來源類型

  2. 新增表格
    - `hospital_outreach_records` - 醫院外展記錄主表
      - 每位院友只有一筆當前記錄
      - 儲存當前的藥袋週期資訊
    - `hospital_outreach_record_history` - 外展記錄歷史表
      - 儲存過往的藥袋週期記錄
      - 用於追蹤歷史變更

  3. 安全設定
    - 啟用 RLS
    - 設定已認證用戶的完整存取權限

  4. 索引
    - 為常用查詢欄位建立索引以提升效能
*/

-- 建立取藥安排類型枚舉
CREATE TYPE medication_pickup_arrangement_type AS ENUM (
  '家人前往',
  '院舍代勞', 
  '每次詢問'
);

-- 建立外展藥物來源類型枚舉
CREATE TYPE outreach_medication_source_type AS ENUM (
  'KWH/CGAS',
  'KCH/PGT',
  '出院病房配發'
);

-- 建立醫院外展記錄主表（當前記錄）
CREATE TABLE IF NOT EXISTS hospital_outreach_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL UNIQUE REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  medication_bag_date date NOT NULL,
  prescription_weeks integer NOT NULL CHECK (prescription_weeks > 0),
  medication_end_date date NOT NULL,
  outreach_appointment_date date,
  medication_pickup_arrangement medication_pickup_arrangement_type NOT NULL,
  outreach_medication_source outreach_medication_source_type,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- 確保覆診日期不晚於藥完日期
  CONSTRAINT check_appointment_before_end_date 
    CHECK (outreach_appointment_date IS NULL OR outreach_appointment_date <= medication_end_date)
);

-- 建立外展記錄歷史表
CREATE TABLE IF NOT EXISTS hospital_outreach_record_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  original_record_id uuid,
  medication_bag_date date NOT NULL,
  prescription_weeks integer NOT NULL,
  medication_end_date date NOT NULL,
  outreach_appointment_date date,
  medication_pickup_arrangement medication_pickup_arrangement_type NOT NULL,
  outreach_medication_source outreach_medication_source_type,
  remarks text,
  archived_at timestamptz DEFAULT now(),
  archived_by text
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_patient_id 
  ON hospital_outreach_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_medication_bag_date 
  ON hospital_outreach_records(medication_bag_date);
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_medication_end_date 
  ON hospital_outreach_records(medication_end_date);
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_outreach_appointment_date 
  ON hospital_outreach_records(outreach_appointment_date);
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_pickup_arrangement 
  ON hospital_outreach_records(medication_pickup_arrangement);
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_records_medication_source 
  ON hospital_outreach_records(outreach_medication_source);

CREATE INDEX IF NOT EXISTS idx_hospital_outreach_record_history_patient_id 
  ON hospital_outreach_record_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_record_history_archived_at 
  ON hospital_outreach_record_history(archived_at);
CREATE INDEX IF NOT EXISTS idx_hospital_outreach_record_history_medication_bag_date 
  ON hospital_outreach_record_history(medication_bag_date);

-- 啟用 RLS
ALTER TABLE hospital_outreach_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_outreach_record_history ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 策略 - 醫院外展記錄主表
CREATE POLICY "允許已認證用戶讀取醫院外展記錄"
  ON hospital_outreach_records
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增醫院外展記錄"
  ON hospital_outreach_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新醫院外展記錄"
  ON hospital_outreach_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除醫院外展記錄"
  ON hospital_outreach_records
  FOR DELETE
  TO authenticated
  USING (true);

-- 建立 RLS 策略 - 外展記錄歷史表
CREATE POLICY "允許已認證用戶讀取外展記錄歷史"
  ON hospital_outreach_record_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增外展記錄歷史"
  ON hospital_outreach_record_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新外展記錄歷史"
  ON hospital_outreach_record_history
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除外展記錄歷史"
  ON hospital_outreach_record_history
  FOR DELETE
  TO authenticated
  USING (true);

-- 建立更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_hospital_outreach_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器
CREATE TRIGGER update_hospital_outreach_records_updated_at
  BEFORE UPDATE ON hospital_outreach_records
  FOR EACH ROW
  EXECUTE FUNCTION update_hospital_outreach_records_updated_at();

-- 建立自動歸檔觸發器函數
-- 當更新現有記錄時，自動將舊記錄歸檔到歷史表
CREATE OR REPLACE FUNCTION archive_old_outreach_record()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果是更新操作且藥袋日期有變更，將舊記錄歸檔
  IF TG_OP = 'UPDATE' AND OLD.medication_bag_date != NEW.medication_bag_date THEN
    INSERT INTO hospital_outreach_record_history (
      patient_id,
      original_record_id,
      medication_bag_date,
      prescription_weeks,
      medication_end_date,
      outreach_appointment_date,
      medication_pickup_arrangement,
      outreach_medication_source,
      remarks,
      archived_at,
      archived_by
    ) VALUES (
      OLD.patient_id,
      OLD.id,
      OLD.medication_bag_date,
      OLD.prescription_weeks,
      OLD.medication_end_date,
      OLD.outreach_appointment_date,
      OLD.medication_pickup_arrangement,
      OLD.outreach_medication_source,
      OLD.remarks,
      now(),
      '系統自動歸檔'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立自動歸檔觸發器
CREATE TRIGGER archive_old_outreach_record_trigger
  BEFORE UPDATE ON hospital_outreach_records
  FOR EACH ROW
  EXECUTE FUNCTION archive_old_outreach_record();

-- 插入範例資料（可選）
-- 這些範例資料可以幫助測試功能
INSERT INTO hospital_outreach_records (
  patient_id,
  medication_bag_date,
  prescription_weeks,
  medication_end_date,
  outreach_appointment_date,
  medication_pickup_arrangement,
  outreach_medication_source,
  remarks
) 
SELECT 
  院友id,
  CURRENT_DATE - INTERVAL '2 weeks' AS medication_bag_date,
  4 AS prescription_weeks,
  CURRENT_DATE + INTERVAL '2 weeks' AS medication_end_date,
  CURRENT_DATE + INTERVAL '10 days' AS outreach_appointment_date,
  '院舍代勞' AS medication_pickup_arrangement,
  'KWH/CGAS' AS outreach_medication_source,
  '範例外展記錄' AS remarks
FROM "院友主表" 
WHERE 在住狀態 = '在住' 
LIMIT 3
ON CONFLICT (patient_id) DO NOTHING;

-- 新增註釋說明
COMMENT ON TABLE hospital_outreach_records IS '醫院外展記錄主表 - 儲存每位院友當前的外展藥物週期';
COMMENT ON TABLE hospital_outreach_record_history IS '外展記錄歷史表 - 儲存過往的藥物週期記錄';
COMMENT ON COLUMN hospital_outreach_records.medication_bag_date IS '藥袋日期 - 以藥袋上的日期為開始計算日';
COMMENT ON COLUMN hospital_outreach_records.prescription_weeks IS '處方週數 - 醫生處方藥物的週數';
COMMENT ON COLUMN hospital_outreach_records.medication_end_date IS '藥完日期 - 藥袋日期加上處方週數';
COMMENT ON COLUMN hospital_outreach_records.outreach_appointment_date IS '覆診日期 - 安排院友覆診的日期，不得晚於藥完日期';
COMMENT ON COLUMN hospital_outreach_records.medication_pickup_arrangement IS '取藥安排 - 指定由誰負責到醫院取藥';
COMMENT ON COLUMN hospital_outreach_records.outreach_medication_source IS '外展藥物來源 - 藥物來源的醫院部門';