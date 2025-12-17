/*
  # 藥物工作流程記錄去重與防止重複

  ## 目標
  1. 清理現有重複記錄（保留最後更新的記錄）
  2. 添加唯一約束防止未來重複插入
  3. 優化查詢效能

  ## 變更內容
  
  ### 1. 清理重複記錄
  - 按 (prescription_id, scheduled_date, scheduled_time) 分組
  - 保留每組中 updated_at 最新的記錄
  - 刪除其他重複記錄

  ### 2. 添加唯一約束
  - 複合唯一約束：(prescription_id, scheduled_date, scheduled_time)
  - 確保相同處方在同一時間點只能有一筆記錄

  ### 3. 添加複合索引
  - 優化常用查詢組合

  ## 安全性
  - 使用 CTE 確保原子性操作
  - 保留最後更新的記錄（包含最新狀態）
  - 不影響歷史查詢功能
*/

-- 步驟 1: 清理重複記錄，保留最後更新的記錄
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 使用 CTE 找出所有重複組中需要刪除的記錄
  WITH duplicates AS (
    SELECT 
      id,
      prescription_id,
      scheduled_date,
      scheduled_time,
      updated_at,
      ROW_NUMBER() OVER (
        PARTITION BY prescription_id, scheduled_date, scheduled_time 
        ORDER BY updated_at DESC, created_at DESC
      ) as rn
    FROM medication_workflow_records
  ),
  to_delete AS (
    SELECT id 
    FROM duplicates 
    WHERE rn > 1
  )
  DELETE FROM medication_workflow_records
  WHERE id IN (SELECT id FROM to_delete);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE '已刪除 % 筆重複的藥物工作流程記錄', deleted_count;
END $$;

-- 步驟 2: 添加唯一約束
-- 先檢查約束是否已存在，避免重複創建
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'unique_medication_workflow_record'
  ) THEN
    ALTER TABLE medication_workflow_records
    ADD CONSTRAINT unique_medication_workflow_record 
    UNIQUE (prescription_id, scheduled_date, scheduled_time);
    
    RAISE NOTICE '已添加唯一約束：unique_medication_workflow_record';
  ELSE
    RAISE NOTICE '唯一約束已存在，跳過創建';
  END IF;
END $$;

-- 步驟 3: 添加複合索引以優化查詢效能
-- 常用查詢組合：按院友和日期範圍查詢
CREATE INDEX IF NOT EXISTS idx_workflow_patient_date_time 
ON medication_workflow_records(patient_id, scheduled_date, scheduled_time);

-- 常用查詢組合：按處方和日期查詢
CREATE INDEX IF NOT EXISTS idx_workflow_prescription_date 
ON medication_workflow_records(prescription_id, scheduled_date);

-- 步驟 4: 添加檢查函數以檢測潛在重複
CREATE OR REPLACE FUNCTION check_medication_workflow_duplicates(
  p_prescription_id uuid,
  p_scheduled_date date,
  p_scheduled_time time
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  record_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO record_count
  FROM medication_workflow_records
  WHERE prescription_id = p_prescription_id
    AND scheduled_date = p_scheduled_date
    AND scheduled_time = p_scheduled_time;
  
  RETURN record_count > 0;
END;
$$;

COMMENT ON FUNCTION check_medication_workflow_duplicates IS '檢查指定處方在特定時間是否已有工作流程記錄';

-- 步驟 5: 創建視圖以便查詢重複記錄統計
CREATE OR REPLACE VIEW medication_workflow_duplicate_stats AS
SELECT 
  prescription_id,
  scheduled_date,
  scheduled_time,
  COUNT(*) as record_count,
  MIN(created_at) as first_created,
  MAX(updated_at) as last_updated
FROM medication_workflow_records
GROUP BY prescription_id, scheduled_date, scheduled_time
HAVING COUNT(*) > 1;

COMMENT ON VIEW medication_workflow_duplicate_stats IS '藥物工作流程重複記錄統計視圖（執行遷移後應該為空）';
