/*
  # 創建意外事件報告資料表

  1. 新增資料表
    - `incident_reports`
      - `id` (uuid, 主鍵)
      - `patient_id` (整數, 外鍵連結院友主表)
      - `incident_date` (日期)
      - `incident_time` (時間)
      - `incident_type` (文字: "跌倒" 或其他)
      - `other_incident_type` (文字, 可選)
      - `location` (文字, 單選地點)
      - `other_location` (文字, 可選)
      - `patient_activity` (文字, 單選活動)
      - `other_patient_activity` (文字, 可選)
      - `physical_discomfort` (JSONB, 複選身體不適)
      - `unsafe_behavior` (JSONB, 複選不安全行為)
      - `environmental_factors` (JSONB, 複選環境因素)
      - `treatment_date` (日期)
      - `treatment_time` (時間)
      - `vital_signs` (JSONB, 生命表徵檢查)
      - `consciousness_level` (文字, 單選清醒程度)
      - `limb_movement` (JSONB, 四肢活動情況)
      - `injury_situation` (JSONB, 複選受傷情況)
      - `patient_complaint` (文字)
      - `immediate_treatment` (JSONB, 複選即時處理)
      - `medical_arrangement` (文字, 單選就診安排)
      - `ambulance_call_time` (時間)
      - `ambulance_arrival_time` (時間)
      - `ambulance_departure_time` (時間)
      - `hospital_destination` (文字)
      - `family_notification_date` (日期)
      - `family_notification_time` (時間)
      - `family_name` (文字)
      - `family_relationship` (文字, 單選關係)
      - `other_family_relationship` (文字, 可選)
      - `contact_phone` (文字)
      - `notifying_staff_name` (文字)
      - `notifying_staff_position` (文字)
      - `hospital_treatment` (JSONB, 複選醫院診治情況)
      - `hospital_admission` (JSONB, 醫院留醫資訊)
      - `return_time` (時間)
      - `submit_to_social_welfare` (布林值)
      - `submit_to_headquarters` (布林值)
      - `immediate_improvement_actions` (文字)
      - `prevention_methods` (文字)
      - `reporter_signature` (文字)
      - `reporter_position` (文字)
      - `report_date` (日期)
      - `director_review_date` (日期)
      - `submit_to_headquarters_flag` (布林值)
      - `submit_to_social_welfare_flag` (布林值)
      - `created_at` (時間戳)
      - `updated_at` (時間戳)

  2. 安全性
    - 啟用 RLS
    - 添加政策允許已驗證用戶進行所有操作
*/

CREATE TABLE IF NOT EXISTS incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer NOT NULL REFERENCES 院友主表(院友id) ON DELETE CASCADE,
  incident_date date NOT NULL,
  incident_time time,
  incident_type text NOT NULL DEFAULT '跌倒',
  other_incident_type text,
  location text,
  other_location text,
  patient_activity text,
  other_patient_activity text,
  physical_discomfort jsonb DEFAULT '{}',
  unsafe_behavior jsonb DEFAULT '{}',
  environmental_factors jsonb DEFAULT '{}',
  treatment_date date,
  treatment_time time,
  vital_signs jsonb DEFAULT '{}',
  consciousness_level text,
  limb_movement jsonb DEFAULT '{}',
  injury_situation jsonb DEFAULT '{}',
  patient_complaint text,
  immediate_treatment jsonb DEFAULT '{}',
  medical_arrangement text,
  ambulance_call_time time,
  ambulance_arrival_time time,
  ambulance_departure_time time,
  hospital_destination text,
  family_notification_date date,
  family_notification_time time,
  family_name text,
  family_relationship text,
  other_family_relationship text,
  contact_phone text,
  notifying_staff_name text,
  notifying_staff_position text,
  hospital_treatment jsonb DEFAULT '{}',
  hospital_admission jsonb DEFAULT '{}',
  return_time time,
  submit_to_social_welfare boolean,
  submit_to_headquarters boolean,
  immediate_improvement_actions text,
  prevention_methods text,
  reporter_signature text,
  reporter_position text,
  report_date date,
  director_review_date date,
  submit_to_headquarters_flag boolean DEFAULT false,
  submit_to_social_welfare_flag boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

-- 添加政策允許已驗證用戶進行所有操作
CREATE POLICY "允許已驗證用戶查看意外報告"
  ON incident_reports
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已驗證用戶新增意外報告"
  ON incident_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已驗證用戶更新意外報告"
  ON incident_reports
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已驗證用戶刪除意外報告"
  ON incident_reports
  FOR DELETE
  TO authenticated
  USING (true);

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_incident_reports_patient_id ON incident_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_incident_date ON incident_reports(incident_date);
CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at ON incident_reports(created_at);

-- 創建更新時間戳觸發器
CREATE OR REPLACE FUNCTION update_incident_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_incident_reports_timestamp
  BEFORE UPDATE ON incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_incident_reports_updated_at();