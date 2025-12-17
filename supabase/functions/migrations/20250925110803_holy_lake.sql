/*
  # 新增醫生到診排程管理

  1. 新增表格
    - `doctor_visit_schedule` - 醫生到診排程表
      - `id` (uuid, 主鍵)
      - `visit_date` (date, 到診日期)
      - `doctor_name` (text, 醫生姓名)
      - `specialty` (text, 專科)
      - `available_slots` (integer, 可預約名額)
      - `booked_slots` (integer, 已預約名額)
      - `notes` (text, 備註)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. 安全設定
    - 啟用 RLS
    - 允許已認證用戶完整存取

  3. 索引
    - 到診日期索引
    - 醫生姓名索引
    - 專科索引
*/

-- 創建醫生到診排程表
CREATE TABLE IF NOT EXISTS doctor_visit_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_date date NOT NULL,
  doctor_name text,
  specialty text,
  available_slots integer DEFAULT 10,
  booked_slots integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE doctor_visit_schedule ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 政策
CREATE POLICY "允許已認證用戶讀取醫生到診排程"
  ON doctor_visit_schedule
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增醫生到診排程"
  ON doctor_visit_schedule
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新醫生到診排程"
  ON doctor_visit_schedule
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除醫生到診排程"
  ON doctor_visit_schedule
  FOR DELETE
  TO authenticated
  USING (true);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_visit_date 
  ON doctor_visit_schedule USING btree (visit_date);

CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_doctor_name 
  ON doctor_visit_schedule USING btree (doctor_name);

CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_specialty 
  ON doctor_visit_schedule USING btree (specialty);

CREATE INDEX IF NOT EXISTS idx_doctor_visit_schedule_created_at 
  ON doctor_visit_schedule USING btree (created_at);

-- 創建更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_doctor_visit_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
CREATE TRIGGER update_doctor_visit_schedule_updated_at
  BEFORE UPDATE ON doctor_visit_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_doctor_visit_schedule_updated_at();

-- 插入一些示例數據（未來6個月的到診日期）
INSERT INTO doctor_visit_schedule (visit_date, doctor_name, specialty, available_slots, notes) VALUES
  (CURRENT_DATE + INTERVAL '7 days', '陳醫生', '內科', 12, '每週二到診'),
  (CURRENT_DATE + INTERVAL '14 days', '陳醫生', '內科', 12, '每週二到診'),
  (CURRENT_DATE + INTERVAL '21 days', '陳醫生', '內科', 12, '每週二到診'),
  (CURRENT_DATE + INTERVAL '28 days', '陳醫生', '內科', 12, '每週二到診'),
  (CURRENT_DATE + INTERVAL '10 days', '李醫生', '精神科', 8, '每兩週五到診'),
  (CURRENT_DATE + INTERVAL '24 days', '李醫生', '精神科', 8, '每兩週五到診'),
  (CURRENT_DATE + INTERVAL '15 days', '王醫生', '外科', 6, '每月第三週到診'),
  (CURRENT_DATE + INTERVAL '45 days', '王醫生', '外科', 6, '每月第三週到診')
ON CONFLICT DO NOTHING;