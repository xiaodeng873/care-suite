-- 移除臨時診斷 view（20260904091000_diag_pg_policies_view.sql 建立，僅供排查 RLS 用）
DROP VIEW IF EXISTS _diag_pg_policies;
