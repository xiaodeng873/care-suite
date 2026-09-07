-- [DEBUG-diag] 暫時診斷函數：查各角色的 statement_timeout（診斷完會移除）
CREATE OR REPLACE FUNCTION public.diag_role_timeout()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'current_user', current_user,
    'session_user', session_user,
    'statement_timeout', current_setting('statement_timeout'),
    'role_config', (SELECT rolconfig FROM pg_roles WHERE rolname = current_user)
  );
$$;

GRANT EXECUTE ON FUNCTION public.diag_role_timeout() TO anon, authenticated, service_role;
