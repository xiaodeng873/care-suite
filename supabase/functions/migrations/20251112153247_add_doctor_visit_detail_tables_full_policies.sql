/*
  # 添加醫生到診相關表的完整 RLS 策略

  ## 問題
  - `到診院友_看診原因` 表只有 SELECT 策略
  - `看診院友細項` 表只有 SELECT 策略
  - 用戶無法新增、修改或刪除看診院友資料

  ## 解決方案
  為已認證用戶添加完整的 CRUD 策略：
  - INSERT: 允許已認證用戶新增資料
  - UPDATE: 允許已認證用戶修改資料
  - DELETE: 允許已認證用戶刪除資料

  ## 安全考量
  - 只允許已認證用戶（authenticated）操作
  - 所有已認證用戶可以操作所有資料
  - 這符合應用程式的使用情境（醫護人員管理到診排程）
*/

-- ============================================
-- 到診院友_看診原因 表的策略
-- ============================================

DROP POLICY IF EXISTS "允許已認證用戶新增看診原因關聯" ON "到診院友_看診原因";
DROP POLICY IF EXISTS "允許已認證用戶修改看診原因關聯" ON "到診院友_看診原因";
DROP POLICY IF EXISTS "允許已認證用戶刪除看診原因關聯" ON "到診院友_看診原因";

CREATE POLICY "允許已認證用戶新增看診原因關聯"
  ON "到診院友_看診原因"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改看診原因關聯"
  ON "到診院友_看診原因"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除看診原因關聯"
  ON "到診院友_看診原因"
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- 看診院友細項 表的策略
-- ============================================

DROP POLICY IF EXISTS "允許已認證用戶新增看診院友細項" ON "看診院友細項";
DROP POLICY IF EXISTS "允許已認證用戶修改看診院友細項" ON "看診院友細項";
DROP POLICY IF EXISTS "允許已認證用戶刪除看診院友細項" ON "看診院友細項";

CREATE POLICY "允許已認證用戶新增看診院友細項"
  ON "看診院友細項"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改看診院友細項"
  ON "看診院友細項"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除看診院友細項"
  ON "看診院友細項"
  FOR DELETE
  TO authenticated
  USING (true);
