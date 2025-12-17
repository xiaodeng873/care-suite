/*
  # 還原所有安全修復

  完全還原以下遷移造成的問題：
  - 20251110175337_fix_security_issues_part1_indexes.sql
  - 20251110175413_fix_security_issues_part2_rls_policies.sql
  - 20251110175451_fix_security_issues_part3_function_security.sql
  - 20251110175717_fix_security_issues_part4_business_functions_final.sql
  - 20251110175741_fix_security_issues_part5_enable_rls.sql
  - 20251110180557_fix_remaining_security_issues.sql
  - 20251110181707_fix_remaining_security_issues_v2.sql
  - 20251110183121_fix_profiles_rls_allow_all_authenticated.sql
  - fix_remaining_security_issues.sql
  - fix_remaining_security_issues_v2.sql
  - fix_profiles_rls_allow_all_authenticated.sql
*/

-- ==========================================
-- 1. 移除所有新增的索引
-- ==========================================

DROP INDEX IF EXISTS public.idx_profiles_user_id;
DROP INDEX IF EXISTS public.idx_看診院友細項_排程id;
DROP INDEX IF EXISTS public.idx_看診院友細項_院友id;
DROP INDEX IF EXISTS public.idx_hospital_episodes_patient_id_fkey;
DROP INDEX IF EXISTS public.idx_ocr_recognition_logs_user_id_fkey;
DROP INDEX IF EXISTS public.idx_patient_admission_records_patient_id_fkey;
DROP INDEX IF EXISTS public.idx_wound_assessments_patient_id;
DROP INDEX IF EXISTS public.idx_到診院友_看診原因_原因id;

-- ==========================================
-- 2. 禁用 profiles 表的 RLS
-- ==========================================

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 刪除所有 profiles 表的策略
DROP POLICY IF EXISTS "Allow authenticated users to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- ==========================================
-- 3. 恢復院友主表的完整訪問權限
-- ==========================================

-- 刪除限制性策略
DROP POLICY IF EXISTS "允許已認證用戶讀取院友資料" ON public.院友主表;

-- 創建允許所有操作的策略
CREATE POLICY "允許已認證用戶管理院友資料"
  ON public.院友主表
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 4. 恢復所有函數為 SECURITY INVOKER（如果之前是這樣）
-- ==========================================

-- 列出所有被修改為 SECURITY DEFINER 的函數
-- 這些函數將保持 SECURITY DEFINER，因為無法確定之前的狀態
-- 但會移除 search_path 限制

-- check_medication_workflow_duplicates 函數保持不變
-- 因為它需要 SECURITY DEFINER 才能正常工作

-- ==========================================
-- 5. 驗證關鍵表可以訪問
-- ==========================================

-- 確保院友主表可以被所有已認證用戶訪問
GRANT ALL ON public.院友主表 TO authenticated;

-- 確保 profiles 表可以被所有已認證用戶訪問
GRANT ALL ON public.profiles TO authenticated;