-- 相片全面轉 Supabase Storage：院友相 + 處方圖
-- 院友相三欄（院友相片 / 院友相片高清 / 身份證相片）由 base64 data URL 改存 Storage public URL
-- 處方新增 image_path 欄存放處方圖 URL

-- =====================================================
-- 1) Storage bucket：院友相片
-- =====================================================
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types, created_at)
VALUES ('patient-photos', 'patient-photos', true, false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'], now())
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "允許認證用戶讀取 patient-photos" ON storage.objects;
CREATE POLICY "允許認證用戶讀取 patient-photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'patient-photos');

DROP POLICY IF EXISTS "允許認證用戶上傳 patient-photos" ON storage.objects;
CREATE POLICY "允許認證用戶上傳 patient-photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'patient-photos');

DROP POLICY IF EXISTS "允許認證用戶更新 patient-photos" ON storage.objects;
CREATE POLICY "允許認證用戶更新 patient-photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'patient-photos') WITH CHECK (bucket_id = 'patient-photos');

DROP POLICY IF EXISTS "允許認證用戶刪除 patient-photos" ON storage.objects;
CREATE POLICY "允許認證用戶刪除 patient-photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'patient-photos');

-- =====================================================
-- 2) Storage bucket：處方圖片
-- =====================================================
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types, created_at)
VALUES ('prescription-images', 'prescription-images', true, false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'], now())
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "允許認證用戶讀取 prescription-images" ON storage.objects;
CREATE POLICY "允許認證用戶讀取 prescription-images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'prescription-images');

DROP POLICY IF EXISTS "允許認證用戶上傳 prescription-images" ON storage.objects;
CREATE POLICY "允許認證用戶上傳 prescription-images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'prescription-images');

DROP POLICY IF EXISTS "允許認證用戶更新 prescription-images" ON storage.objects;
CREATE POLICY "允許認證用戶更新 prescription-images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'prescription-images') WITH CHECK (bucket_id = 'prescription-images');

DROP POLICY IF EXISTS "允許認證用戶刪除 prescription-images" ON storage.objects;
CREATE POLICY "允許認證用戶刪除 prescription-images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'prescription-images');

-- =====================================================
-- 3) new_medication_prescriptions：新增處方圖片欄
-- =====================================================
ALTER TABLE new_medication_prescriptions
  ADD COLUMN IF NOT EXISTS image_path text;

COMMENT ON COLUMN new_medication_prescriptions.image_path IS '處方圖片 Storage public URL（prescription-images bucket），停服或刪除處方時一併清除';
