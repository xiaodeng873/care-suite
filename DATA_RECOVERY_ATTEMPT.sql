-- 數據恢復嘗試腳本
-- 嘗試從各種可能的來源恢復丟失的健康記錄

-- 1. 檢查是否有任何系統審計日誌（如果啟用了的話）
-- 注意：這取決於 Supabase 項目是否啟用了審計日誌

-- 2. 檢查最近的數據庫活動日誌
-- 這可能需要管理員權限

-- 3. 如果有備份，可以嘗試從備份中恢復
-- SELECT * FROM 健康記錄主表_backup WHERE created_at > '2026-02-12'::date - interval '1 day';

-- 4. 檢查當前健康記錄表中是否有最近創建但可能被錯誤刪除的記錄
-- 顯示今天的所有活動
SELECT 
  '當前健康記錄表狀態' as 檢查項目,
  COUNT(*) as 記錄數量,
  MAX(created_at) as 最新記錄時間,
  MIN(記錄日期) as 最早記錄日期,
  MAX(記錄日期) as 最新記錄日期
FROM 健康記錄主表;

-- 5. 顯示今天所有的記錄 ID 範圍（幫助識別可能的缺失）
SELECT 
  MIN(記錄id) as 最小ID,
  MAX(記錄id) as 最大ID,
  COUNT(*) as 記錄數量,
  (MAX(記錄id) - MIN(記錄id) + 1) as 預期數量,
  (MAX(記錄id) - MIN(記錄id) + 1) - COUNT(*) as 可能缺失數量
FROM 健康記錄主表 
WHERE 記錄日期 >= '2026-02-12'::date;

-- 6. 列出今天所有記錄 ID（檢查是否有跳號）
SELECT 記錄id, 院友id, 記錄日期, 記錄時間, 記錄類型, created_at
FROM 健康記錄主表 
WHERE 記錄日期 >= '2026-02-12'::date 
ORDER BY 記錄id;

-- 7. 檢查回收筒當前狀態
SELECT 
  '回收筒狀態' as 檢查項目,
  COUNT(*) as 記錄數量,
  MIN(deleted_at) as 最早刪除時間,
  MAX(deleted_at) as 最新刪除時間
FROM deleted_health_records;

-- 8. 顯示所有回收筒記錄
SELECT * FROM deleted_health_records ORDER BY deleted_at DESC;

-- 重要提醒用戶的步驟：
/*
緊急數據恢復步驟：

1. 立即在 Supabase Dashboard 中運行上述查詢
2. 運行 EMERGENCY_FIX_RECYCLE_BIN.sql 修復權限問題  
3. 檢查輸出結果，尋找缺失的記錄 ID 範圍
4. 如果有數據庫備份，從備份中恢復缺失記錄
5. 聯繫 Supabase 支持查看是否有系統日誌可以幫助恢復

數據恢復完成後：
- 恢復正確的 RLS 策略
- 實施更嚴格的删除確認機制
- 添加審計日誌記錄所有删除操作
*/