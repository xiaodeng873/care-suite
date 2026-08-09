-- 新增「日班」班次：原「全日班」正名為日班，所有職位/居住區的班次設定均可選早/日/午/晚班

-- 1) 放寬 shift_name 檢查約束，加入日班
ALTER TABLE station_shift_settings
  DROP CONSTRAINT IF EXISTS station_shift_settings_shift_name_check;

ALTER TABLE station_shift_settings
  ADD CONSTRAINT station_shift_settings_shift_name_check
  CHECK (shift_name IN ('早班', '日班', '午班', '晚班'));

COMMENT ON COLUMN station_shift_settings.shift_name IS '早班/日班/午班/晚班';

-- 2) 單班制部門（行政/主管/庶務/專職）原有的「全日班」底層以早班儲存，正名為日班
UPDATE station_shift_settings
SET shift_name = '日班'
WHERE shift_name = '早班'
  AND position IN (
    '行政', '主管', '庶務',
    '物理治療師', '物理治療師助理',
    '職業治療師', '職業治療師助理',
    '言語治療師', '言語治療師助理'
  );
