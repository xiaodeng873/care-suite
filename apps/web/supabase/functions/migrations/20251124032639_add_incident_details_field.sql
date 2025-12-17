/*
  # 添加意外發生經過詳情欄位

  1. 新增欄位
    - `incident_reports` 表
      - `incident_details` (text) - 意外發生經過詳情（長文字）

  2. 說明
    - incident_details 欄位用於記錄意外發生的詳細經過
    - 此欄位放在意外發生原因和處理情況之間
*/

-- 添加意外發生經過詳情欄位到 incident_reports 表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incident_reports' AND column_name = 'incident_details'
  ) THEN
    ALTER TABLE incident_reports ADD COLUMN incident_details TEXT;
    COMMENT ON COLUMN incident_reports.incident_details IS '意外發生經過詳情 - 詳細描述意外發生的過程';
  END IF;
END $$;
