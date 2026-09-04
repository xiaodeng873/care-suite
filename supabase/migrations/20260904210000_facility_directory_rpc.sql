-- 開發者院舍閘門專用：院舍目錄（含顯示名稱）
--
-- 背景：閘門用 developer 未選院舍 token（facility_id claim 為 NULL）join
-- facility_settings 會被 tenant RLS 擋住，顯示名稱缺失時退回 facilities.name
-- （facility 1 的遺留值「安老院舍」），造成院舍名稱錯誤。
-- 此 RPC 以 SECURITY DEFINER 讀取，僅限 developer claim 可執行。

CREATE OR REPLACE FUNCTION public.get_facility_directory()
RETURNS TABLE (id integer, name text, is_active boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.jwt_is_developer() THEN
    RAISE EXCEPTION '僅開發者可查閱院舍目錄';
  END IF;
  RETURN QUERY
  SELECT
    f.id,
    COALESCE(fs.facility_name_zh, f.name) AS name,
    f.is_active
  FROM facilities f
  LEFT JOIN facility_settings fs ON fs.facility_id = f.id
  ORDER BY f.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_facility_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_facility_directory() TO authenticated;
