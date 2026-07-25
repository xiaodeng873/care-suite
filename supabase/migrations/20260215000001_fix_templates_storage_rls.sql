/*
  # 修復範本上傳 Storage RLS 問題（完整版）

  問題：系統使用自訂認證（Edge Function token），不是 Supabase Auth。
  Supabase client 以 anon 角色運作，但 storage policies 只允許 authenticated。
  
  修復：將 storage policies 設為允許 anon 和 authenticated 角色。
*/

-- ===========================================
-- 1. 確保 templates storage bucket 存在
-- ===========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates', 
  'templates', 
  true,
  52428800,  -- 50MB
  NULL       -- 允許所有 MIME types
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- ===========================================
-- 2. Storage RLS policies（完全清除後重建）
-- ===========================================

-- 移除所有可能存在的舊 policies
DROP POLICY IF EXISTS "允許已認證用戶上傳範本檔案" ON storage.objects;
DROP POLICY IF EXISTS "允許已認證用戶讀取範本檔案" ON storage.objects;
DROP POLICY IF EXISTS "允許已認證用戶刪除範本檔案" ON storage.objects;
DROP POLICY IF EXISTS "允許已認證用戶更新範本檔案" ON storage.objects;
DROP POLICY IF EXISTS "templates_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "templates_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "templates_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "templates_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "templates_public_select" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload templates wrvard_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read templates wrvard_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete templates wrvard_0" ON storage.objects;
DROP POLICY IF EXISTS "templates_all_access" ON storage.objects;

-- 建立單一的全存取 policy（因為系統使用自訂認證，安全由 Edge Function 控制）
DROP POLICY IF EXISTS "templates_all_access" ON storage.objects;

CREATE POLICY "templates_all_access" ON storage.objects
FOR ALL
TO anon, authenticated
USING (bucket_id = 'templates')
WITH CHECK (bucket_id = 'templates');

-- ===========================================
-- 3. 確保 templates_metadata 表的 RLS policies 完整
-- ===========================================

ALTER TABLE templates_metadata ENABLE ROW LEVEL SECURITY;

-- 確保 "Allow all access" policy 存在（anon + authenticated）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'templates_metadata' 
    AND policyname = 'Allow all access'
  ) THEN
    DROP POLICY IF EXISTS "Allow all access" ON templates_metadata;

    CREATE POLICY "Allow all access" ON templates_metadata
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
