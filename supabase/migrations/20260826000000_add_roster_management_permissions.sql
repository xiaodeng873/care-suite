-- 補回「排班管理」權限列，讓系統設定 > 用戶管理可以勾選
INSERT INTO permissions (category, feature, feature_name_zh, action, route, description)
VALUES
  ('daily', 'roster_management', '排班管理', 'view', '/roster-management', '查看排班管理'),
  ('daily', 'roster_management', '排班管理', 'create', '/roster-management', '新增排班'),
  ('daily', 'roster_management', '排班管理', 'edit', '/roster-management', '編輯排班'),
  ('daily', 'roster_management', '排班管理', 'delete', '/roster-management', '刪除排班')
ON CONFLICT (category, feature, action) DO UPDATE
SET feature_name_zh = EXCLUDED.feature_name_zh,
    route = EXCLUDED.route,
    description = EXCLUDED.description;
