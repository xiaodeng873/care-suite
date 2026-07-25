-- Migration: 修正 健康監測記錄 RLS — 允許 anon 角色存取
--
-- 問題：App 使用自訂登入（非 Supabase Auth），所有 PostgREST 查詢以 anon 角色執行。
-- 原 migration 僅建立 {authenticated} 政策，導致 anon 查詢被 RLS 全部擋掉（回傳 0 筆且無錯誤），
-- 前端監測記錄頁面完全空白。
--
-- 解法：比照「院友主表」的「Allow all access」政策，新增 {anon, authenticated} 全權限政策。

DROP POLICY IF EXISTS "允許已認證用戶管理健康監測記錄" ON 健康監測記錄;

DROP POLICY IF EXISTS "Allow all access 健康監測記錄" ON 健康監測記錄;


CREATE POLICY "Allow all access 健康監測記錄" ON 健康監測記錄 FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
