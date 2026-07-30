-- 修復 bed_transfer_log 的 RLS/權限問題
-- 現況：前端所有 Supabase REST 請求皆以 anon key 發出，實際 role 為 anon；
-- 但新建表 bed_transfer_log 雖然有 TO authenticated 政策，卻缺少對應的 table privileges，
-- 導致 insert 回報 42501 "new row violates row-level security policy"。
-- 解決：授予 public 所有權限，並建立 TO public 的 RLS 政策，與其他表一致讓前端能寫入日誌。

-- 1. 確保表權限足夠（給所有角色，與本院其他業務表保持一致）
GRANT ALL ON public.bed_transfer_log TO public;

-- 2. 增加 public 層級的 RLS 政策（已有 authenticated 政策可保留）
DROP POLICY IF EXISTS "Allow public to view bed transfer log" ON public.bed_transfer_log;
CREATE POLICY "Allow public to view bed transfer log" ON public.bed_transfer_log
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public to insert bed transfer log" ON public.bed_transfer_log;
CREATE POLICY "Allow public to insert bed transfer log" ON public.bed_transfer_log
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public to delete bed transfer log" ON public.bed_transfer_log;
CREATE POLICY "Allow public to delete bed transfer log" ON public.bed_transfer_log
  FOR DELETE TO public USING (true);
