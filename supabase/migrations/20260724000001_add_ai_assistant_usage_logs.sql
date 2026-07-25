-- Migration: AI 助護使用記錄與身分追蹤
-- 日期: 2026-07-24
-- 用途: 記錄 AI 助護每次使用情況，區分開發者與專案用戶，並支援使用度統計

-- =====================================================
-- 1. 使用記錄表
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_assistant_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  auth_type text NOT NULL CHECK (auth_type IN ('developer', 'project_user')),
  user_role text NOT NULL,
  user_name text,
  request_type text NOT NULL CHECK (request_type IN ('chat', 'image', 'confirm-mutation')),
  message_text text,
  response_type text CHECK (response_type IN ('query', 'mutation', 'answer', 'error', 'refused', 'image_analysis')),
  model text,
  tokens_used integer,
  duration_ms integer,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 索引加速統計查詢
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created
  ON ai_assistant_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created
  ON ai_assistant_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_auth_type
  ON ai_assistant_usage_logs (auth_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_role
  ON ai_assistant_usage_logs (user_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_response_type
  ON ai_assistant_usage_logs (response_type, created_at DESC);

-- =====================================================
-- 2. RLS 政策
-- =====================================================
ALTER TABLE ai_assistant_usage_logs ENABLE ROW LEVEL SECURITY;

-- 只允許 service_role 或 admin 用戶查看全部記錄
-- 一般職員不應該看到其他人的使用記錄
CREATE POLICY "service_role_full_access_ai_usage_logs"
  ON ai_assistant_usage_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 暫時不開放一般用戶查詢，日後可視需求讓用戶查看自己的記錄
-- CREATE POLICY "users_view_own_ai_usage_logs"
--   ON ai_assistant_usage_logs
--   FOR SELECT
--   TO authenticated
--   USING (user_id = auth.uid()::text);

-- =====================================================
-- 3. 清理過期記錄函數（可選，保留 90 天）
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_ai_usage_logs()
RETURNS trigger AS $$
BEGIN
  DELETE FROM ai_assistant_usage_logs
  WHERE created_at < now() - interval '90 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_old_ai_usage_logs ON ai_assistant_usage_logs;
CREATE TRIGGER trg_cleanup_old_ai_usage_logs
  AFTER INSERT ON ai_assistant_usage_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_ai_usage_logs();

-- =====================================================
-- 4. 常用統計視圖（可選）
-- =====================================================
CREATE OR REPLACE VIEW ai_assistant_daily_stats AS
SELECT
  date_trunc('day', created_at) AS day,
  auth_type,
  user_role,
  response_type,
  COUNT(*) AS count,
  COALESCE(SUM(duration_ms), 0) AS total_duration_ms
FROM ai_assistant_usage_logs
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 2, 3, 4;
