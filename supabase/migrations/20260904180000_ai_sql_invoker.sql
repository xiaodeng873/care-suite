-- P3: exec_sql_readonly / exec_sql_mutation 改為 SECURITY INVOKER
--
-- 背景：兩函數原本是 SECURITY DEFINER（service role 權限執行），AI 助護以 service client 呼叫時
-- 完全繞過 RLS tenant 隔離——任何院舍的用戶都能查到/改到其他院舍的資料。
--
-- 修正：改為 SECURITY INVOKER，動態 SQL 以「呼叫者本人」的身份執行，RLS 對 AI 產生的 SQL 同樣生效。
-- ai-assistant edge function 已改為帶用戶本人的 dbToken 呼叫（PostgREST 會驗證 JWT 簽名）。

-- 唯讀查詢（含 CTE）
CREATE OR REPLACE FUNCTION exec_sql_readonly(
  query_text text,
  query_params text DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- 安全檢查：只允許 SELECT 或以 WITH 開頭的 CTE 查詢
  IF upper(trim(query_text)) !~ '^(SELECT|WITH)\M' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed in readonly mode';
  END IF;

  -- 禁止危險關鍵字（使用詞邊界，避免誤判欄位/表名中的子字串）
  IF upper(query_text) ~ '\m(DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|INSERT|UPDATE|DELETE)\M' THEN
    RAISE EXCEPTION 'Dangerous SQL keywords detected in readonly query';
  END IF;

  -- 執行查詢（以呼叫者身份，RLS tenant 隔離生效）
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text)
  INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- 資料異動
CREATE OR REPLACE FUNCTION exec_sql_mutation(
  query_text text,
  query_params text DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  -- 安全檢查：只允許 INSERT/UPDATE/DELETE
  IF upper(trim(query_text)) NOT LIKE 'INSERT%'
     AND upper(trim(query_text)) NOT LIKE 'UPDATE%'
     AND upper(trim(query_text)) NOT LIKE 'DELETE%' THEN
    RAISE EXCEPTION 'Only INSERT/UPDATE/DELETE queries are allowed in mutation mode';
  END IF;

  -- 禁止 DDL 關鍵字
  IF upper(query_text) ~ '(DROP|ALTER|CREATE TABLE|TRUNCATE|GRANT|REVOKE)' THEN
    RAISE EXCEPTION 'Dangerous DDL keywords detected in mutation query';
  END IF;

  -- 禁止操作系統表
  IF query_text ~* '(user_profiles|user_sessions|user_permissions|permissions)' THEN
    RAISE EXCEPTION 'Operations on system tables are not allowed';
  END IF;

  -- 執行操作（以呼叫者身份，RLS tenant 隔離生效；tenant 表 INSERT trigger 自動填 facility_id）
  EXECUTE query_text;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  RETURN jsonb_build_object('affected_rows', affected_rows);
END;
$$;

COMMENT ON FUNCTION exec_sql_readonly(text, text) IS 'AI 助護唯讀查詢；SECURITY INVOKER 以呼叫者身份執行，RLS tenant 隔離生效';
COMMENT ON FUNCTION exec_sql_mutation(text, text) IS 'AI 助護資料異動；SECURITY INVOKER 以呼叫者身份執行，RLS tenant 隔離生效';
