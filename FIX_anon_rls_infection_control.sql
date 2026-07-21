-- 修復：感染控制記錄表 front-end 讀不到（因前端以 anon role 連線）
-- 用途：為 infection_control_records 新增 anon role 的 RLS 權限
-- 執行方式：在 Supabase SQL Editor 貼上並執行

-- 選擇權限
DROP POLICY IF EXISTS "Allow anon users to view infection control records" ON infection_control_records;
CREATE POLICY "Allow anon users to view infection control records"
  ON infection_control_records
  FOR SELECT
  TO anon
  USING (true);

-- 新增權限
DROP POLICY IF EXISTS "Allow anon users to insert infection control records" ON infection_control_records;
CREATE POLICY "Allow anon users to insert infection control records"
  ON infection_control_records
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 更新權限
DROP POLICY IF EXISTS "Allow anon users to update infection control records" ON infection_control_records;
CREATE POLICY "Allow anon users to update infection control records"
  ON infection_control_records
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- 刪除權限
DROP POLICY IF EXISTS "Allow anon users to delete infection control records" ON infection_control_records;
CREATE POLICY "Allow anon users to delete infection control records"
  ON infection_control_records
  FOR DELETE
  TO anon
  USING (true);
