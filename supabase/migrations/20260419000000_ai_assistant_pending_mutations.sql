-- =====================================================
-- AI 助護 — 暫存待確認操作表 + SQL 執行函數
-- =====================================================

-- 1. 暫存表：存放用戶待確認的 mutation 操作
CREATE TABLE IF NOT EXISTS ai_assistant_pending_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  sql_statement text NOT NULL,
  sql_params jsonb DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  tables_involved text[] DEFAULT '{}',
  mutation_type text NOT NULL DEFAULT 'insert',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  executed boolean NOT NULL DEFAULT false
);

-- 索引：按 user_id + executed 查詢加速
CREATE INDEX IF NOT EXISTS idx_ai_pending_user_executed
  ON ai_assistant_pending_mutations (user_id, executed)
  WHERE executed = false;

-- 自動清理過期記錄（每次插入時清理 > 1 小時前的記錄）
CREATE OR REPLACE FUNCTION cleanup_expired_ai_mutations()
RETURNS trigger AS $$
BEGIN
  DELETE FROM ai_assistant_pending_mutations
  WHERE expires_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_ai_mutations ON ai_assistant_pending_mutations;
DROP TRIGGER IF EXISTS trg_cleanup_ai_mutations ON ai_assistant_pending_mutations;

CREATE TRIGGER trg_cleanup_ai_mutations AFTER INSERT ON ai_assistant_pending_mutations
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_ai_mutations();

-- 2. 唯讀查詢函數（供 AI 助護 SELECT 使用）
-- 使用 SECURITY DEFINER 以 service role 執行
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

-- 3. 寫入操作函數（供 AI 助護 INSERT/UPDATE/DELETE 使用）
CREATE OR REPLACE FUNCTION exec_sql_mutation(
  query_text text,
  query_params text DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- 執行操作
  EXECUTE query_text;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  RETURN jsonb_build_object('affected_rows', affected_rows);
END;
$$;

-- RLS: 只允許 service role 訪問暫存表
ALTER TABLE ai_assistant_pending_mutations ENABLE ROW LEVEL SECURITY;

-- Service role 完全訪問
DROP POLICY IF EXISTS "Service role full access on ai_mutations" ON ai_assistant_pending_mutations;

CREATE POLICY "Service role full access on ai_mutations" ON ai_assistant_pending_mutations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
