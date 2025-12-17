/*
  # 添加到診排程主表的 INSERT/UPDATE/DELETE RLS 策略

  ## 問題
  - 到診排程主表只有 SELECT 策略
  - 用戶無法新增、修改或刪除排程資料

  ## 解決方案
  為已認證用戶添加完整的 CRUD 策略：
  - INSERT: 允許已認證用戶新增排程
  - UPDATE: 允許已認證用戶修改排程
  - DELETE: 允許已認證用戶刪除排程

  ## 安全考量
  - 只允許已認證用戶（authenticated）操作
  - 所有已認證用戶可以操作所有排程資料
  - 這符合應用程式的使用情境（醫護人員管理排程）
*/

-- 刪除舊策略（如果存在）
DROP POLICY IF EXISTS "允許已認證用戶新增排程資料" ON "到診排程主表";
DROP POLICY IF EXISTS "允許已認證用戶修改排程資料" ON "到診排程主表";
DROP POLICY IF EXISTS "允許已認證用戶刪除排程資料" ON "到診排程主表";

-- 允許已認證用戶新增排程
CREATE POLICY "允許已認證用戶新增排程資料"
  ON "到診排程主表"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 允許已認證用戶修改排程
CREATE POLICY "允許已認證用戶修改排程資料"
  ON "到診排程主表"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 允許已認證用戶刪除排程
CREATE POLICY "允許已認證用戶刪除排程資料"
  ON "到診排程主表"
  FOR DELETE
  TO authenticated
  USING (true);
