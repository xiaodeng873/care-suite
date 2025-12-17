/*
  # 創建便條表

  1. 新表
    - `patient_notes`
      - `id` (uuid, primary key)
      - `patient_id` (integer, nullable, 外鍵關聯 院友主表)
      - `note_date` (date, 必填) - 指定日期
      - `content` (text, 必填) - 便條內容，最多 500 字
      - `is_completed` (boolean, 預設 false) - 是否完成
      - `completed_at` (timestamp, 可選) - 完成時間
      - `created_at` (timestamp, 預設 now())
      - `updated_at` (timestamp, 預設 now())
      - `created_by` (text, 可選) - 創建者

  2. 安全性
    - 啟用 RLS
    - 添加策略允許已認證用戶完整存取（查詢、新增、更新、刪除）

  3. 索引
    - patient_id 索引（支援按院友查詢）
    - is_completed 索引（支援按完成狀態過濾）
    - note_date 索引（支援按日期排序）
    - created_at 索引（支援按創建時間排序）

  4. 約束
    - content 長度限制為 500 字
*/

-- 創建 patient_notes 表
CREATE TABLE IF NOT EXISTS patient_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id INTEGER REFERENCES 院友主表(院友id) ON DELETE SET NULL,
  note_date DATE NOT NULL,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  
  CONSTRAINT content_length_check CHECK (char_length(content) <= 500)
);

-- 創建索引以提升查詢性能
CREATE INDEX IF NOT EXISTS idx_patient_notes_patient_id ON patient_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_notes_is_completed ON patient_notes(is_completed);
CREATE INDEX IF NOT EXISTS idx_patient_notes_note_date ON patient_notes(note_date DESC);
CREATE INDEX IF NOT EXISTS idx_patient_notes_created_at ON patient_notes(created_at DESC);

-- 啟用 RLS
ALTER TABLE patient_notes ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略：已認證用戶可以查看所有便條
CREATE POLICY "Authenticated users can view all notes"
  ON patient_notes
  FOR SELECT
  TO authenticated
  USING (true);

-- 創建 RLS 策略：已認證用戶可以新增便條
CREATE POLICY "Authenticated users can insert notes"
  ON patient_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 創建 RLS 策略：已認證用戶可以更新便條
CREATE POLICY "Authenticated users can update notes"
  ON patient_notes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 創建 RLS 策略：已認證用戶可以刪除便條
CREATE POLICY "Authenticated users can delete notes"
  ON patient_notes
  FOR DELETE
  TO authenticated
  USING (true);