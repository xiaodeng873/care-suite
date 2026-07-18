-- 補回「喉管護理」權限列，讓系統設定 > 用戶管理可以勾選
INSERT INTO permissions (category, feature, feature_name_zh, action, route, description)
VALUES
  ('periodic', 'tube_care', '喉管護理', 'view', '/tube-care', '查看喉管護理'),
  ('periodic', 'tube_care', '喉管護理', 'create', '/tube-care', '新增喉管護理記錄'),
  ('periodic', 'tube_care', '喉管護理', 'edit', '/tube-care', '編輯喉管護理記錄'),
  ('periodic', 'tube_care', '喉管護理', 'delete', '/tube-care', '刪除喉管護理記錄')
ON CONFLICT (category, feature, action) DO UPDATE
SET feature_name_zh = EXCLUDED.feature_name_zh,
    route = EXCLUDED.route,
    description = EXCLUDED.description;
