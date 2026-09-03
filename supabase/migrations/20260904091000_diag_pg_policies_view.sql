-- 臨時診斷：暴露 pg_policies 以供查閱（查完即删，勿長留）
CREATE OR REPLACE VIEW _diag_pg_policies WITH (security_invoker = false) AS
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies;

ALTER VIEW _diag_pg_policies OWNER TO postgres;
