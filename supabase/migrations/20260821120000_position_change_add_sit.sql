-- 轉身記錄新增「坐」姿態：position 檢查約束加入 '坐'
-- 注意：自動建議循環仍為 左 → 平 → 右，「坐」僅供手動選擇

ALTER TABLE position_change_records
  DROP CONSTRAINT IF EXISTS position_change_records_position_check;

ALTER TABLE position_change_records
  ADD CONSTRAINT position_change_records_position_check
  CHECK (position IN ('左', '平', '右', '坐'));
