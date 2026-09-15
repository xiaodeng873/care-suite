-- 新增「記錄 > 理遺記錄」權限定義
-- 導覽列原以 adminOnly 隱藏，改為正式權限功能項（records:diaper_usage_records），
-- 路由守衛與導覽列統一以 hasPermission 判定。
INSERT INTO permissions (category, feature, feature_name_zh, action, route) VALUES
  ('records', 'diaper_usage_records', '理遺記錄', 'view', '/diaper-usage-records'),
  ('records', 'diaper_usage_records', '理遺記錄', 'create', '/diaper-usage-records'),
  ('records', 'diaper_usage_records', '理遺記錄', 'edit', '/diaper-usage-records'),
  ('records', 'diaper_usage_records', '理遺記錄', 'delete', '/diaper-usage-records')
ON CONFLICT (category, feature, action) DO NOTHING;

-- 現有主管自動補授，避免改為權限制後失去理遺記錄可見性（與舊 adminOnly 行為看齊）
INSERT INTO user_permissions (user_id, permission_id)
SELECT up.id, p.id
FROM user_profiles up
CROSS JOIN permissions p
WHERE up.role = 'admin'
  AND up.is_active = true
  AND p.category = 'records'
  AND p.feature = 'diaper_usage_records'
ON CONFLICT (user_id, permission_id) DO NOTHING;
