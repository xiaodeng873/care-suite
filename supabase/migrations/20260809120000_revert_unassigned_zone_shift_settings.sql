-- 還原 20260809110000_unassigned_zone_shift_settings.sql：刪除未分區（station_id = NULL）的所有班次設定
-- 讓無偏好員工因未分區無班次而自然被推到其他有班次的居住區

DELETE FROM station_shift_settings
WHERE station_id IS NULL;
