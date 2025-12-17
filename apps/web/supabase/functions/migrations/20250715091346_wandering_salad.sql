/*
  # 設定範本相關的 RLS 策略

  1. Storage 策略
    - 允許已認證用戶上傳範本檔案到 templates bucket
    - 允許已認證用戶讀取範本檔案
    - 允許已認證用戶刪除範本檔案

  2. templates_metadata 表格策略
    - 允許已認證用戶新增範本元數據
    - 允許已認證用戶讀取範本元數據
    - 允許已認證用戶更新範本元數據
    - 允許已認證用戶刪除範本元數據
*/

-- Storage policies for templates bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('templates', 'templates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to templates bucket
CREATE POLICY "允許已認證用戶上傳範本檔案"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'templates');

-- Allow authenticated users to read files from templates bucket
CREATE POLICY "允許已認證用戶讀取範本檔案"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'templates');

-- Allow authenticated users to delete files from templates bucket
CREATE POLICY "允許已認證用戶刪除範本檔案"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'templates');

-- Allow authenticated users to update files in templates bucket
CREATE POLICY "允許已認證用戶更新範本檔案"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'templates')
WITH CHECK (bucket_id = 'templates');

-- Database policies for templates_metadata table
CREATE POLICY "允許已認證用戶新增範本元數據"
ON templates_metadata FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "允許已認證用戶讀取範本元數據"
ON templates_metadata FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "允許已認證用戶更新範本元數據"
ON templates_metadata FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除範本元數據"
ON templates_metadata FOR DELETE
TO authenticated
USING (true);