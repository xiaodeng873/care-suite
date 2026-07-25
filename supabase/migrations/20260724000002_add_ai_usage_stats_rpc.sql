-- Migration: AI 助護使用統計輔助函數
-- 日期: 2026-07-24
-- 用途: 為 ai_assistant_usage_logs 提供常用的聚合統計 RPC

-- =====================================================
-- 1. 按 auth_type 統計
-- =====================================================
CREATE OR REPLACE FUNCTION get_ai_usage_by_auth_type(p_start_date timestamptz)
RETURNS TABLE(auth_type text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth_type, COUNT(*)::bigint AS count
  FROM ai_assistant_usage_logs
  WHERE created_at >= p_start_date
  GROUP BY auth_type
  ORDER BY count DESC;
$$;

-- =====================================================
-- 2. 按 user_role 統計
-- =====================================================
CREATE OR REPLACE FUNCTION get_ai_usage_by_role(p_start_date timestamptz)
RETURNS TABLE(user_role text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_role, COUNT(*)::bigint AS count
  FROM ai_assistant_usage_logs
  WHERE created_at >= p_start_date
  GROUP BY user_role
  ORDER BY count DESC;
$$;

-- =====================================================
-- 3. 按 response_type 統計
-- =====================================================
CREATE OR REPLACE FUNCTION get_ai_usage_by_response_type(p_start_date timestamptz)
RETURNS TABLE(response_type text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT response_type, COUNT(*)::bigint AS count
  FROM ai_assistant_usage_logs
  WHERE created_at >= p_start_date
  GROUP BY response_type
  ORDER BY count DESC;
$$;
