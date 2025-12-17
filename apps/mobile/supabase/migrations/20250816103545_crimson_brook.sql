/*
  # 添加下次評估日期欄位到健康評估表格

  1. 表格修改
    - 在 `health_assessments` 表格中添加 `next_due_date` 欄位
    - 類型：DATE（可為空）
    - 用於儲存下次健康評估的到期日期

  2. 功能說明
    - 支援健康評估的週期管理
    - 自動計算下次評估日期（評估日期 + 6個月）
    - 用於主面板的到期提醒功能
*/

-- 添加 next_due_date 欄位到 health_assessments 表格
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_assessments' AND column_name = 'next_due_date'
  ) THEN
    ALTER TABLE health_assessments ADD COLUMN next_due_date DATE;
  END IF;
END $$;

-- 為現有記錄計算並設定 next_due_date（評估日期 + 6個月）
UPDATE health_assessments 
SET next_due_date = (assessment_date + INTERVAL '6 months')::DATE
WHERE next_due_date IS NULL AND assessment_date IS NOT NULL;

-- 添加索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_health_assessments_next_due_date 
ON health_assessments(next_due_date);

-- 添加註釋
COMMENT ON COLUMN health_assessments.next_due_date IS '下次健康評估到期日期（評估日期 + 6個月）';