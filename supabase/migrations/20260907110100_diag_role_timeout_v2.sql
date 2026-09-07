-- [DEBUG-diag] 擴充診斷函數：列出 API 相關角色的 rolconfig
CREATE OR REPLACE FUNCTION public.diag_role_timeout()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'instance_statement_timeout', current_setting('statement_timeout'),
    'roles', (
      SELECT json_agg(json_build_object('role', rolname, 'config', rolconfig))
      FROM pg_roles
      WHERE rolname IN ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.diag_role_timeout() TO anon, authenticated, service_role;
