import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getPermissionByRoute, PermissionCategory } from '@care-suite/shared';

/**
 * 路由守衛：按 PERMISSION_STRUCTURE 的 route → category:feature 對應，
 * 攔截無「查看」權限的直接 URL 存取（導覽列以外的第二道防線）。
 * 無對應定義的路由（如主頁）一律放行；實際資料存取仍由 RLS 把關。
 */

// 共用功能底下的別名/舊版路徑：歸併到同一功能權限
const ROUTE_PERMISSION_ALIASES: Record<string, { category: PermissionCategory; feature: string }> = {
  '/wound-old': { category: 'periodic', feature: 'wound_management' },
  '/prescription-search': { category: 'medication', feature: 'prescription_management' },
};

// 頁內再自行把關（Settings 各分頁用 canAccessTab）的路由：
// 路由層只要求該類別有任一權限即可進入
const CATEGORY_ONLY_ROUTES: Record<string, PermissionCategory> = {
  '/settings': 'settings',
};

export const PermissionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const { hasPermission, hasAnyPermission, canManageUsers } = useAuth();

  let allowed = true;

  const alias = ROUTE_PERMISSION_ALIASES[pathname];
  const categoryOnly = CATEGORY_ONLY_ROUTES[pathname];
  const mapped = getPermissionByRoute(pathname);

  if (alias) {
    allowed = hasPermission(alias.category, alias.feature, 'view');
  } else if (categoryOnly) {
    allowed = hasAnyPermission(categoryOnly) || canManageUsers();
  } else if (mapped) {
    allowed = hasPermission(mapped.category, mapped.feature, 'view');
  }

  if (allowed) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ShieldX className="h-12 w-12 text-gray-300 mb-4" />
      <h2 className="text-lg font-medium text-gray-900 mb-2">無權限存取此頁面</h2>
      <p className="text-sm text-gray-500 mb-6">如需要存取權限，請聯絡系統管理員。</p>
      <Link
        to="/"
        className="inline-flex items-center px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        返回主頁
      </Link>
    </div>
  );
};
