-- Fix: allow WITH/CTE queries in AI assistant readonly mode
-- Previously exec_sql_readonly rejected any query not starting with 'SELECT',
-- which broke LLM-generated queries using CTEs (e.g. "most recent bp of 202-1, 208-1, 236-4").
CREATE OR REPLACE FUNCTION exec_sql_readonly(
  query_text text,
  query_params text DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  params_array jsonb;
BEGIN
  -- 安全檢查：只允許 SELECT 或以 WITH 開頭的 CTE 查詢
  IF upper(trim(query_text)) !~ '^(SELECT|WITH)\M' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed in readonly mode';
  END IF;

  -- 禁止危險關鍵字（使用詞邊界，避免誤判欄位/表名中的子字串）
  IF upper(query_text) ~ '\m(DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|INSERT|UPDATE|DELETE)\M' THEN
    RAISE EXCEPTION 'Dangerous SQL keywords detected in readonly query';
  END IF;

  -- 執行查詢
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text)
  INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
