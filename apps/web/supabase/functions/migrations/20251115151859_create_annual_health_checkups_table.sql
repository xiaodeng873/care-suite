/*
  # 建立年度體檢表格

  1. 新增表格
    - `annual_health_checkups`
      - `id` (uuid, primary key)
      - `patient_id` (integer) - 院友 ID
      - `last_doctor_signature_date` (date) - 上次醫生簽署日期
      - `next_due_date` (date) - 下次到期日（自動計算 +1 年）
      
      病歷資訊 (Part I):
      - `has_serious_illness` (boolean) - 曾否患嚴重疾病/接受大型手術
      - `serious_illness_details` (text) - 疾病詳情
      - `has_allergy` (boolean) - 有否食物或藥物過敏
      - `allergy_details` (text) - 過敏詳情
      - `has_infectious_disease` (boolean) - 有否傳染病徵狀
      - `infectious_disease_details` (text) - 傳染病詳情
      - `needs_followup_treatment` (boolean) - 是否需要接受跟進檢查或治療
      - `followup_treatment_details` (text) - 跟進治療詳情
      - `has_swallowing_difficulty` (boolean) - 有否吞嚥困難/容易哽塞
      - `swallowing_difficulty_details` (text) - 吞嚥困難詳情
      - `has_special_diet` (boolean) - 有否特別膳食需要
      - `special_diet_details` (text) - 膳食需要詳情
      - `mental_illness_record` (text) - 精神病紀錄詳述
      
      身體檢查 (Part II):
      - `blood_pressure_systolic` (integer) - 收縮壓
      - `blood_pressure_diastolic` (integer) - 舒張壓
      - `pulse` (integer) - 脈搏
      - `body_weight` (numeric) - 體重
      
      身體機能評估 (Part IV):
      - `vision_assessment` (text) - 視力評估
      - `hearing_assessment` (text) - 聽力評估
      - `speech_assessment` (text) - 語言能力評估
      - `mental_state_assessment` (text) - 精神狀況評估
      - `mobility_assessment` (text) - 活動能力評估
      - `continence_assessment` (text) - 禁制能力評估
      - `adl_assessment` (text) - 自我照顧能力評估
      
      建議 (Part V):
      - `recommendation` (text) - 建議的安老院類型
      
      - `created_at` (timestamptz) - 建立時間
      - `updated_at` (timestamptz) - 更新時間
      
  2. 資料遷移
    - 從 patient_health_tasks 複製「年度體檢」記錄到新表格
    
  3. 安全性
    - 啟用 RLS
    - 新增政策讓已驗證用戶可以讀取、新增、更新、刪除記錄
    
  4. 索引
    - patient_id 上建立索引以加速查詢
    - 建立唯一性約束確保每位院友只能有一筆記錄
*/

-- 建立年度體檢表格
CREATE TABLE IF NOT EXISTS annual_health_checkups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL,
  last_doctor_signature_date date,
  next_due_date date,
  
  -- Part I: 病歷資訊
  has_serious_illness boolean DEFAULT false,
  serious_illness_details text,
  has_allergy boolean DEFAULT false,
  allergy_details text,
  has_infectious_disease boolean DEFAULT false,
  infectious_disease_details text,
  needs_followup_treatment boolean DEFAULT false,
  followup_treatment_details text,
  has_swallowing_difficulty boolean DEFAULT false,
  swallowing_difficulty_details text,
  has_special_diet boolean DEFAULT false,
  special_diet_details text,
  mental_illness_record text,
  
  -- Part II: 身體檢查
  blood_pressure_systolic integer,
  blood_pressure_diastolic integer,
  pulse integer,
  body_weight numeric(5,1),
  
  -- Part IV: 身體機能評估
  vision_assessment text,
  hearing_assessment text,
  speech_assessment text,
  mental_state_assessment text,
  mobility_assessment text,
  continence_assessment text,
  adl_assessment text,
  
  -- Part V: 建議
  recommendation text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- 唯一性約束：每位院友只能有一筆記錄
  CONSTRAINT unique_patient_annual_checkup UNIQUE (patient_id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_annual_health_checkups_patient_id ON annual_health_checkups(patient_id);
CREATE INDEX IF NOT EXISTS idx_annual_health_checkups_next_due_date ON annual_health_checkups(next_due_date);

-- 資料遷移：從 patient_health_tasks 複製年度體檢記錄
INSERT INTO annual_health_checkups (patient_id, last_doctor_signature_date, next_due_date)
SELECT DISTINCT ON (patient_id)
  patient_id,
  last_completed_at,
  next_due_at
FROM patient_health_tasks
WHERE health_record_type = '年度體檢'
  AND patient_id IS NOT NULL
ORDER BY patient_id, created_at DESC
ON CONFLICT (patient_id) DO NOTHING;

-- 啟用 RLS
ALTER TABLE annual_health_checkups ENABLE ROW LEVEL SECURITY;

-- RLS 政策：已驗證用戶可以讀取所有記錄
CREATE POLICY "Authenticated users can view all annual health checkups"
  ON annual_health_checkups
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS 政策：已驗證用戶可以新增記錄
CREATE POLICY "Authenticated users can insert annual health checkups"
  ON annual_health_checkups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS 政策：已驗證用戶可以更新記錄
CREATE POLICY "Authenticated users can update annual health checkups"
  ON annual_health_checkups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS 政策：已驗證用戶可以刪除記錄
CREATE POLICY "Authenticated users can delete annual health checkups"
  ON annual_health_checkups
  FOR DELETE
  TO authenticated
  USING (true);
