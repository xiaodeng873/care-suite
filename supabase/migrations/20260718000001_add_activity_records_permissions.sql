-- 補上「定期 > 活動記錄」權限定義
-- 前端導覽與共用 PERMISSION_STRUCTURE 已定義 activity_records，但資料庫 seeding 遺漏，
-- 導致 hasPermission('periodic', 'activity_records', 'view') 永遠為 false，導覽列不顯示。
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  ('periodic', 'activity_records', '活動記錄', 'view', '/activity-records'),
  ('periodic', 'activity_records', '活動記錄', 'create', '/activity-records'),
  ('periodic', 'activity_records', '活動記錄', 'edit', '/activity-records'),
  ('periodic', 'activity_records', '活動記錄', 'delete', '/activity-records')
ON CONFLICT (category, feature, action) DO NOTHING;
