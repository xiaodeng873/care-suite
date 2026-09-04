-- storage 路徑前綴：templates bucket 依院舍隔離
--
-- 新路徑格式：fac{facility_id}/{type}/{filename}
-- 舊有無前綴檔案（第一層不是 fac_ 開頭）保留全員可讀，避免現有範本失效；
-- 新上傳必須帶上本院舍前綴（developer 不受限）。

DROP POLICY IF EXISTS "templates_all_access" ON storage.objects;

-- 讀取：developer、全院舍（本院舍前綴）、或舊有無前綴檔案
CREATE POLICY "templates_facility_select" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'templates' AND (
  public.jwt_is_developer()
  OR (storage.foldername(name))[1] = 'fac' || public.jwt_facility_id()::text
  OR (storage.foldername(name))[1] NOT LIKE 'fac\_%'
));

-- 上傳：developer 或本院舍前綴（舊路徑不可再寫入）
CREATE POLICY "templates_facility_insert" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'templates' AND (
  public.jwt_is_developer()
  OR (storage.foldername(name))[1] = 'fac' || public.jwt_facility_id()::text
));

-- 更新：developer 或本院舍前綴
CREATE POLICY "templates_facility_update" ON storage.objects
FOR UPDATE TO anon, authenticated
USING (bucket_id = 'templates' AND (
  public.jwt_is_developer()
  OR (storage.foldername(name))[1] = 'fac' || public.jwt_facility_id()::text
  OR (storage.foldername(name))[1] NOT LIKE 'fac\_%'
))
WITH CHECK (bucket_id = 'templates' AND (
  public.jwt_is_developer()
  OR (storage.foldername(name))[1] = 'fac' || public.jwt_facility_id()::text
));

-- 刪除：developer 或本院舍前綴（舊檔只限 developer 刪，避免他院誤刪 facility 1 檔案）
CREATE POLICY "templates_facility_delete" ON storage.objects
FOR DELETE TO anon, authenticated
USING (bucket_id = 'templates' AND (
  public.jwt_is_developer()
  OR (storage.foldername(name))[1] = 'fac' || public.jwt_facility_id()::text
));
