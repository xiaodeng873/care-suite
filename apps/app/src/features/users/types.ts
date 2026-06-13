export type UserRole = 'developer' | 'admin' | 'staff';
export type DepartmentType = '行政' | '社工' | '護理' | '專職' | '膳食' | '衛生';
export type EmploymentType = '正職' | '兼職';

export interface UserProfile {
  id: string;
  username: string;
  name_zh: string;
  name_en?: string;
  department: DepartmentType;
  nursing_position?: string;
  allied_health_position?: string;
  hygiene_position?: string;
  other_position?: string;
  hire_date: string;
  employment_type: EmploymentType;
  monthly_hour_limit?: number;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  developer: '開發者',
  admin: '管理者',
  staff: '員工',
};

export const ROLE_COLOR: Record<UserRole, string> = {
  developer: 'bg-red-100 text-red-700',
  admin: 'bg-purple-100 text-purple-700',
  staff: 'bg-blue-100 text-blue-700',
};

export const DEPT_COLOR: Record<DepartmentType, string> = {
  行政: 'bg-gray-100 text-gray-700',
  社工: 'bg-pink-100 text-pink-700',
  護理: 'bg-blue-100 text-blue-700',
  專職: 'bg-green-100 text-green-700',
  膳食: 'bg-orange-100 text-orange-700',
  衛生: 'bg-teal-100 text-teal-700',
};
