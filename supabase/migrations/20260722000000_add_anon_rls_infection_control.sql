-- Migration: 為 infection_control_records 新增 anon role 的 RLS 權限
-- 日期: 2026-07-22
-- 用途：前端使用 anon key 連線，必須有 anon role 的 RLS 政策才能讀取/寫入 infection_control_records

-- 選擇權限
DROP POLICY IF EXISTS "Allow anon users to view infection control records" ON infection_control_records;
DROP POLICY IF EXISTS "Allow anon users to view infection control records" ON infection_control_records;
CREATE POLICY "Allow anon users to view infection control records" ON infection_control_records
  FOR SELECT
  TO anon
  USING (true);

-- 新增權限
DROP POLICY IF EXISTS "Allow anon users to insert infection control records" ON infection_control_records;
DROP POLICY IF EXISTS "Allow anon users to insert infection control records" ON infection_control_records;
CREATE POLICY "Allow anon users to insert infection control records" ON infection_control_records
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 更新權限
DROP POLICY IF EXISTS "Allow anon users to update infection control records" ON infection_control_records;
DROP POLICY IF EXISTS "Allow anon users to update infection control records" ON infection_control_records;
CREATE POLICY "Allow anon users to update infection control records" ON infection_control_records
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- 刪除權限
DROP POLICY IF EXISTS "Allow anon users to delete infection control records" ON infection_control_records;
DROP POLICY IF EXISTS "Allow anon users to delete infection control records" ON infection_control_records;
CREATE POLICY "Allow anon users to delete infection control records" ON infection_control_records
  FOR DELETE
  TO anon
  USING (true);
