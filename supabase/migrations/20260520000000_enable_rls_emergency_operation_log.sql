-- =====================================================
-- 修復安全問題：為 emergency_operation_log 啟用 RLS
-- Fix: public.emergency_operation_log had RLS disabled
-- =====================================================

-- 啟用 RLS
ALTER TABLE public.emergency_operation_log ENABLE ROW LEVEL SECURITY;

-- 服務角色擁有完整存取權限（後端系統操作）
DROP POLICY IF EXISTS "service_role_full_access_emergency_log" ON public.emergency_operation_log;

CREATE POLICY "service_role_full_access_emergency_log" ON public.emergency_operation_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 已認證用戶可寫入緊急操作記錄（應用程式使用 anon 角色）
DROP POLICY IF EXISTS "anon_insert_emergency_log" ON public.emergency_operation_log;

CREATE POLICY "anon_insert_emergency_log" ON public.emergency_operation_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 已認證用戶可讀取緊急操作記錄（供管理者稽核）
DROP POLICY IF EXISTS "authenticated_select_emergency_log" ON public.emergency_operation_log;

CREATE POLICY "authenticated_select_emergency_log" ON public.emergency_operation_log
  FOR SELECT
  TO anon, authenticated
  USING (true);
