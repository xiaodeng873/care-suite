/*
  # 創建範本元數據表格

  1. 新增表格
    - `templates_metadata`
      - `id` (integer, primary key, auto-increment)
      - `name` (text, 範本顯示名稱)
      - `type` (text, 範本類型)
      - `original_name` (text, 原始檔案名稱)
      - `storage_path` (text, Supabase Storage 中的路徑)
      - `upload_date` (timestamptz, 上傳日期，預設為現在)
      - `file_size` (integer, 檔案大小)
      - `description` (text, 範本描述)
      - `extracted_format` (jsonb, 提取的範本格式)

  2. 安全性
    - 啟用 RLS
    - 新增已認證用戶的完整存取權限策略
*/

-- 創建範本類型枚舉
CREATE TYPE template_type AS ENUM ('waiting-list', 'prescription', 'medication-record', 'consent-form');

-- 創建範本元數據表格
CREATE TABLE IF NOT EXISTS templates_metadata (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type template_type NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  file_size INTEGER NOT NULL,
  description TEXT,
  extracted_format JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 啟用 RLS
ALTER TABLE templates_metadata ENABLE ROW LEVEL SECURITY;

-- 新增索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_templates_metadata_type ON templates_metadata(type);
CREATE INDEX IF NOT EXISTS idx_templates_metadata_upload_date ON templates_metadata(upload_date);
CREATE INDEX IF NOT EXISTS idx_templates_metadata_extracted_format ON templates_metadata USING gin(extracted_format);

-- 新增已認證用戶的完整存取權限策略
CREATE POLICY "允許已認證用戶讀取範本元數據"
  ON templates_metadata
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "允許已認證用戶新增範本元數據"
  ON templates_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶更新範本元數據"
  ON templates_metadata
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除範本元數據"
  ON templates_metadata
  FOR DELETE
  TO authenticated
  USING (true);