/*
  # 簡化還原 - 修復應用載入問題
  
  只處理導致應用無法載入的關鍵問題：
  1. 禁用 profiles 表的 RLS
  2. 確保院友主表可以完全訪問
  3. 不處理索引問題（索引不會導致應用無法載入）
*/

-- ==========================================
-- 1. 完全禁用 profiles 表的 RLS
-- ==========================================

ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;

-- 刪除所有 profiles 策略
DROP POLICY IF EXISTS "Allow authenticated users to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- ==========================================
-- 2. 確保院友主表可以完全訪問
-- ==========================================

-- 刪除所有現有策略
DROP POLICY IF EXISTS "允許已認證用戶管理院友資料" ON public.院友主表;
DROP POLICY IF EXISTS "允許已認證用戶讀取院友資料" ON public.院友主表;

-- 重新創建完整訪問策略
CREATE POLICY "允許已認證用戶管理院友資料"
  ON public.院友主表
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 3. 確保其他關鍵表可以訪問
-- ==========================================

-- 檢查並修復 new_medication_prescriptions
DROP POLICY IF EXISTS "允許已認證用戶管理處方" ON public.new_medication_prescriptions;

CREATE POLICY "允許已認證用戶管理處方"
  ON public.new_medication_prescriptions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 檢查並修復 medication_workflow_records
DROP POLICY IF EXISTS "允許已認證用戶管理藥物工作流程記錄" ON public.medication_workflow_records;

CREATE POLICY "允許已認證用戶管理藥物工作流程記錄"
  ON public.medication_workflow_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 4. 確保 GRANT 權限正確
-- ==========================================

GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.院友主表 TO authenticated;
GRANT ALL ON public.new_medication_prescriptions TO authenticated;
GRANT ALL ON public.medication_workflow_records TO authenticated;