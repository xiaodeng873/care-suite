-- 開放已認證用戶刪除 bed_transfer_log 的單筆記錄，
-- 讓床位管理頁的「床位調動日誌」可以刪除個別記錄。

ALTER TABLE bed_transfer_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can delete bed transfer log" ON bed_transfer_log;
CREATE POLICY "Authenticated users can delete bed transfer log" ON bed_transfer_log
  FOR DELETE TO authenticated USING (true);

COMMENT ON TABLE bed_transfer_log IS '床位調動日誌：記錄每位院友及每張床位的所有床位變動足跡（可刪除個別記錄）';
