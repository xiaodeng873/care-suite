-- 收緊未使用但具跨院舍風險的 SECURITY DEFINER RPC / view
-- 審計確認：以下函數及視圖在前端代碼（apps/web）零使用，
-- 全部只保留 service_role 權限，需要用時再重新 GRANT。

-- 1. 歸檔函數（SECURITY DEFINER，無院舍檢查，可改動其他院舍紀錄）
REVOKE EXECUTE ON FUNCTION public.archive_patient_health_assessments(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.archive_patient_wound_assessments(integer) FROM PUBLIC, anon, authenticated;

-- 2. 統計函數（SECURITY DEFINER 直讀院友主表，無院舍過濾）
REVOKE EXECUTE ON FUNCTION public.get_monthly_death_count(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_daily_discharge_count(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_24h_death_count_by_gender(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_pressure_ulcer_count() FROM PUBLIC, anon, authenticated;

-- 3. 手動修復床位函數（PUBLIC EXECUTE，跨院舍 recompute）
REVOKE EXECUTE ON FUNCTION public.fix_bed_occupied_status() FROM PUBLIC, anon, authenticated;

-- 4. 藥物工作流查重函數（無參版本，前端未使用）
REVOKE EXECUTE ON FUNCTION public.check_medication_workflow_duplicates() FROM PUBLIC, anon, authenticated;

-- 5. 權限檢查函數（auth-custom 用的是 get_user_permissions，這個前端未用）
REVOKE EXECUTE ON FUNCTION public.check_user_permission(uuid, permission_category_type, text, permission_action_type) FROM PUBLIC, anon, authenticated;

-- 6. AI 統計視圖及 RPC（無 security_invoker / 無院舍過濾；edge function 以 service client 讀取，不受影響）
REVOKE SELECT ON public.ai_assistant_daily_stats FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ai_usage_by_auth_type(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ai_usage_by_role(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ai_usage_by_response_type(timestamptz) FROM PUBLIC, anon, authenticated;
