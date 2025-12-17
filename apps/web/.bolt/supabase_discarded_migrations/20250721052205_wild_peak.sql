/*
  # 新增健康任務備註欄位

  1. 資料表更新
    - 在 `patient_health_tasks` 新增 `notes` 欄位 (text)
    - 用於儲存任務的備註說明
  
  2. 說明
    - 備註欄位用於記錄任務的特殊說明或注意事項
    - 備註內容會在 Dashboard 緊急任務中顯示
*/

-- 新增備註欄位到健康任務表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_health_tasks' AND column_name = 'notes'
  ) THEN
    ALTER TABLE patient_health_tasks ADD COLUMN notes text;
  END IF;
END $$;