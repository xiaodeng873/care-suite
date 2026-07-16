/*
  # 意外事件報告表：新增目擊者、受傷部位、最後巡房時間欄位

  ## 新增欄位
  1. witness_found_by (jsonb) - 目擊者/發現者信息（互斥選擇：'witness' 或 'found_by'，詳細描述）
  2. injury_location (text) - 受傷部位詳細描述
  3. last_patrol_time (time) - 意外發生前最後的實際巡房時間
*/

-- 新增欄位
ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS witness_found_by jsonb DEFAULT '{"type": "", "details": ""}',
  ADD COLUMN IF NOT EXISTS injury_location text,
  ADD COLUMN IF NOT EXISTS last_patrol_time time;

-- 更新時間戳
UPDATE incident_reports
  SET updated_at = now()
  WHERE witness_found_by IS NULL
    OR injury_location IS NULL
    OR last_patrol_time IS NULL;
