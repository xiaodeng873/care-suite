-- 修復回收筒 RLS 權限
-- 應用使用自訂認證，客戶端以 anon 角色運作，必須允許 anon 操作此表

-- 1. 清除所有舊策略
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'deleted_health_records'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON deleted_health_records', pol.policyname);
  END LOOP;
END $$;

-- 2. 建立新策略
CREATE POLICY "allow_all_select" ON deleted_health_records
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "allow_all_insert" ON deleted_health_records
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "allow_all_delete" ON deleted_health_records
  FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "allow_all_update" ON deleted_health_records
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. 驗證：插入一筆測試記錄然後刪除
INSERT INTO deleted_health_records (original_record_id, 院友id, 記錄日期, 記錄時間, 記錄類型, deletion_reason)
VALUES (0, 0, '2026-01-01', '00:00', '生命表徵', '測試記錄');

SELECT COUNT(*) as 回收筒記錄數量 FROM deleted_health_records;

-- 確認插入成功後刪除測試記錄
DELETE FROM deleted_health_records WHERE original_record_id = 0 AND deletion_reason = '測試記錄';