-- 補上「定期 > 晚晴計劃」權限定義
-- 前端導覽（Layout.tsx evening_care_plan）與共用 PERMISSION_STRUCTURE 已定義，
-- 但資料庫 permissions 表遺漏，導致 hasPermission('periodic', 'evening_care_plan', 'view')
-- 永遠為 false，非開發者導覽列不顯示晚晴計劃。
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  ('periodic', 'evening_care_plan', '晚晴計劃', 'view', '/evening-care-plan'),
  ('periodic', 'evening_care_plan', '晚晴計劃', 'create', '/evening-care-plan'),
  ('periodic', 'evening_care_plan', '晚晴計劃', 'edit', '/evening-care-plan'),
  ('periodic', 'evening_care_plan', '晚晴計劃', 'delete', '/evening-care-plan')
ON CONFLICT (category, feature, action) DO NOTHING;
