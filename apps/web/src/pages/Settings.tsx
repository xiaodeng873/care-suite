import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { Settings as SettingsIcon, Users, Plus, Edit2, Trash2, Key, Check, X, Search, ChevronDown, ChevronRight, QrCode, Building2, Pill, SunMedium, Moon, Wrench } from 'lucide-react';
import { LoadingScreen } from '../components/PageLoadingScreen';
import { UserQRCodeModal } from '../components/UserQRCodeModal';
import EmploymentDetailsSection from '../components/EmploymentDetailsSection';
import FacilitySettingsPanel from '../components/FacilitySettingsPanel';
import FacilityNatureSettings from '../components/FacilityNatureSettings';
import MedicationSettingsPanel from '../components/MedicationSettingsPanel';
import { fuzzyMatch } from '../utils/searchUtils';
import { uploadAvatar, getAvatarUrl, validateAvatarFile } from '../utils/avatarUpload';
import { useAuth, supabase } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  getToolsSettings,
  saveToolsSettings,
  DEFAULT_TOOLS_SETTINGS,
  type ToolsSettings,
} from '../utils/toolsSettings';
import { getSupabaseUrl, getSupabaseAnonKey } from '../config/supabase.config';
import DateInput from '../components/DateInput';
import {
  UserProfile,
  UserRole,
  DepartmentType,
  EmploymentType,
  PermissionCategory,
  PermissionAction,
  Permission,
  FeatureDefinition,
  DEPARTMENTS,
  NURSING_POSITIONS,
  ALLIED_HEALTH_POSITIONS,
  HYGIENE_POSITIONS,
  ADMIN_POSITIONS,
  GENERAL_AFFAIRS_POSITIONS,
  ALL_POSITIONS,
  EMPLOYMENT_TYPES,
  USER_ROLE_LABELS,
  PERMISSION_CATEGORY_LABELS,
  PERMISSION_ACTION_LABELS,
  PERMISSION_STRUCTURE,
  getPositionsByDepartment,
  DEFAULT_PART_TIME_HOUR_LIMIT,
  getEmploymentPosition,
} from '@care-suite/shared';

// =====================================================
// 用戶表單介面
// =====================================================

interface UserFormData {
  id?: string;
  username: string;
  password: string;
  name_zh: string;
  name_en: string;
  id_number: string;
  date_of_birth: string;
  department: DepartmentType | '';
  nursing_position: string;
  allied_health_position: string;
  hygiene_position: string;
  other_position: string;
  secondary_positions: string[];
  hire_date: string;
  employment_type: EmploymentType;
  monthly_hour_limit: number;
  role: UserRole;
  is_active: boolean;
  avatar_url: string;
  avatarFile: File | null;
}

const initialFormData: UserFormData = {
  username: '',
  password: '',
  name_zh: '',
  name_en: '',
  id_number: '',
  date_of_birth: '',
  department: '',
  nursing_position: '',
  allied_health_position: '',
  hygiene_position: '',
  other_position: '',
  secondary_positions: [],
  hire_date: '',
  employment_type: '正職',
  monthly_hour_limit: DEFAULT_PART_TIME_HOUR_LIMIT,
  role: 'staff',
  is_active: true,
  avatar_url: '',
  avatarFile: null,
};

// =====================================================
// 用戶管理 Modal 組件
// =====================================================

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UserFormData) => Promise<void>;
  user?: UserProfile | null;
  isAdmin: boolean;
  isDeveloper: boolean;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, user, isAdmin, isDeveloper }) => {
  const { userProfile } = useAuth();
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSecondaryPosition, setNewSecondaryPosition] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        id: user.id,
        username: user.username,
        password: '', // 編輯時不顯示密碼
        name_zh: user.name_zh,
        name_en: user.name_en || '',
        id_number: user.id_number || '',
        date_of_birth: user.date_of_birth || '',
        department: user.department,
        nursing_position: user.nursing_position || '',
        allied_health_position: user.allied_health_position || '',
        hygiene_position: user.hygiene_position || '',
        other_position: user.other_position || '',
        secondary_positions: user.secondary_positions || [],
        hire_date: user.hire_date,
        employment_type: user.employment_type,
        monthly_hour_limit: user.monthly_hour_limit || DEFAULT_PART_TIME_HOUR_LIMIT,
        role: user.role,
        is_active: user.is_active,
        avatar_url: user.avatar_url || '',
        avatarFile: null,
      });
      setAvatarPreview(getAvatarUrl(user.avatar_url));
    } else {
      setFormData(initialFormData);
      setAvatarPreview(null);
    }
    setNewSecondaryPosition('');
    setError(null);
  }, [user, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // 部門變更時清除職位
    if (name === 'department') {
      setFormData(prev => ({
        ...prev,
        department: value as DepartmentType | '',
        nursing_position: '',
        allied_health_position: '',
        hygiene_position: '',
        other_position: '',
      }));
    }

    // 主要職位變更時，從次要職位移除同值項目（主要與次要職位不可同值）
    if (['nursing_position', 'allied_health_position', 'hygiene_position', 'other_position'].includes(name) && value) {
      setFormData(prev => ({
        ...prev,
        secondary_positions: prev.secondary_positions.filter(pos => pos !== value),
      }));
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAvatarFile(file);
    if (validation) {
      setError(validation.message);
      return;
    }
    setError(null);

    setFormData(prev => ({ ...prev, avatarFile: file }));
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearAvatar = () => {
    setFormData(prev => ({ ...prev, avatar_url: '', avatarFile: null }));
    setAvatarPreview(null);
  };

  // 由部門與各職位欄位推算主要職位（自由輸入部門推算不到則回傳空字串）
  const getPrimaryPosition = (): string => {
    const dept = formData.department;
    if (dept === '護理') return formData.nursing_position;
    if (dept === '專職') return formData.allied_health_position;
    if (dept === '衛生') return formData.hygiene_position;
    if (dept === '行政' || dept === '庶務') return formData.other_position;
    return '';
  };

  // 次要職位可選項目：扣除主要職位與已選次要職位
  const primaryPosition = getPrimaryPosition();
  const secondaryPositionOptions = ALL_POSITIONS.filter(
    pos => pos !== primaryPosition && !formData.secondary_positions.includes(pos)
  );

  const handleAddSecondaryPosition = () => {
    if (!newSecondaryPosition) return;
    if (formData.secondary_positions.includes(newSecondaryPosition)) return;
    setFormData(prev => ({
      ...prev,
      secondary_positions: [...prev.secondary_positions, newSecondaryPosition],
    }));
    setNewSecondaryPosition('');
  };

  const handleRemoveSecondaryPosition = (position: string) => {
    setFormData(prev => ({
      ...prev,
      secondary_positions: prev.secondary_positions.filter(pos => pos !== position),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // 驗證必填欄位
      if (!formData.username || !formData.name_zh || !formData.department || !formData.hire_date) {
        throw new Error('請填寫所有必填欄位');
      }
      
      // 新增用戶需要密碼
      if (!user && !formData.password) {
        throw new Error('請設定密碼');
      }
      
      if (formData.password && formData.password.length < 6) {
        throw new Error('密碼長度至少需要 6 個字元');
      }

      // 最終防線：儲存前剔除與主要職位同值或空值的次要職位
      const primary = getPrimaryPosition();
      const sanitizedData = {
        ...formData,
        secondary_positions: formData.secondary_positions.filter(pos => pos && pos !== primary),
      };

      await onSave(sanitizedData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // 根據部門獲取職位選項
  const getPositionField = () => {
    const dept = formData.department;
    if (!dept) return null;

    if (dept === '護理') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">職位 *</label>
          <select
            name="nursing_position"
            value={formData.nursing_position}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">請選擇職位</option>
            {NURSING_POSITIONS.map((pos: string) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
      );
    }

    if (dept === '專職') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">職位 *</label>
          <select
            name="allied_health_position"
            value={formData.allied_health_position}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">請選擇職位</option>
            {ALLIED_HEALTH_POSITIONS.map((pos: string) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
      );
    }

    if (dept === '衛生') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">職位 *</label>
          <select
            name="hygiene_position"
            value={formData.hygiene_position}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">請選擇職位</option>
            {HYGIENE_POSITIONS.map((pos: string) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
      );
    }

    // 行政 - 枚舉職位，存入 other_position
    if (dept === '行政') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">職位 *</label>
          <select
            name="other_position"
            value={formData.other_position}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">請選擇職位</option>
            {ADMIN_POSITIONS.map((pos: string) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
      );
    }

    // 庶務 - 枚舉職位，存入 other_position
    if (dept === '庶務') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">職位 *</label>
          <select
            name="other_position"
            value={formData.other_position}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">請選擇職位</option>
            {GENERAL_AFFAIRS_POSITIONS.map((pos: string) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
      );
    }

    // 其他未預期部門 - 自由輸入
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">職位</label>
        <input
          type="text"
          name="other_position"
          value={formData.other_position}
          onChange={handleChange}
          placeholder="請輸入職位名稱"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  };

  // 可選的角色選項
  const getRoleOptions = () => {
    if (isDeveloper) {
      return [
        { value: 'admin', label: '主管' },
        { value: 'staff', label: '員工' },
      ];
    }
    // 主管只能創建員工
    return [
      { value: 'staff', label: '員工' },
    ];
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900">
            {user ? '編輯用戶' : '新增用戶'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 帳號資訊 */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">帳號資訊</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">登入帳號 *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="請輸入帳號（非 Email）"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!!user}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {user ? '重設密碼' : '密碼 *'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={user ? '留空保持不變' : '請輸入密碼（至少 6 字元）'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  minLength={6}
                  required={!user}
                />
              </div>
            </div>
          </div>

          {/* 個人資料 */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">個人資料</h3>

            {/* 大頭照 */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                {avatarPreview || formData.avatar_url ? (
                  <img
                    src={avatarPreview || formData.avatar_url}
                    alt="大頭照預覽"
                    className="h-20 w-20 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer">
                  <span>上傳相片</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
                {(avatarPreview || formData.avatar_url) && (
                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="inline-flex items-center px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    移除相片
                  </button>
                )}
                <p className="text-xs text-gray-500">PNG / JPEG / WEBP，最大 2MB</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">中文姓名 *</label>
                <input
                  type="text"
                  name="name_zh"
                  value={formData.name_zh}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">英文姓名</label>
                <input
                  type="text"
                  name="name_en"
                  value={formData.name_en}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身份證號碼</label>
                <input
                  type="text"
                  name="id_number"
                  value={formData.id_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">出生日期</label>
                <DateInput
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={(value) => setFormData(prev => ({ ...prev, date_of_birth: value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 部門與職位 */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">部門與職位</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">部門 *</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">請選擇部門</option>
                  {DEPARTMENTS.map((dept: DepartmentType) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              {getPositionField()}
            </div>

            {/* 次要職位（可擔任其他角色） */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">次要職位（可擔任其他角色）</label>
              <div className="flex gap-2">
                <select
                  value={newSecondaryPosition}
                  onChange={(e) => setNewSecondaryPosition(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">請選擇次要職位</option>
                  {secondaryPositionOptions.map((pos: string) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddSecondaryPosition}
                  disabled={!newSecondaryPosition}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  新增
                </button>
              </div>
              {formData.secondary_positions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.secondary_positions.map((pos: string) => (
                    <span
                      key={pos}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-sm text-gray-700 rounded-full"
                    >
                      {pos}
                      <button
                        type="button"
                        onClick={() => handleRemoveSecondaryPosition(pos)}
                        className="text-gray-400 hover:text-red-500"
                        title="移除此次要職位"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 僱傭資訊 */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">僱傭資訊</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">入職日期 *</label>
                <DateInput
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={(value) => setFormData(prev => ({ ...prev, hire_date: value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">僱傭類型 *</label>
                <select
                  name="employment_type"
                  value={formData.employment_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {EMPLOYMENT_TYPES.map((type: EmploymentType) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              {formData.employment_type === '兼職' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">每月工時上限</label>
                  <input
                    type="number"
                    name="monthly_hour_limit"
                    value={formData.monthly_hour_limit}
                    onChange={handleChange}
                    min={1}
                    max={200}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">預設 68 小時</p>
                </div>
              )}
            </div>
          </div>

          {/* 權限設定 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">權限設定</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色 *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {getRoleOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center pt-6">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">帳號啟用</label>
              </div>
            </div>
          </div>

          {/* 僱傭詳情（編輯適用職位用戶時顯示，資料讀寫獨立於用戶表單） */}
          {user && getEmploymentPosition(user) && (
            <EmploymentDetailsSection user={user} currentUserId={userProfile?.id ?? null} />
          )}

          {/* 操作按鈕 */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={saving}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================
// 權限編輯 Modal 組件
// =====================================================

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (permissions: string[]) => Promise<void>;
  user: UserProfile | null;
  currentPermissions: string[];
}

const PermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  user,
  currentPermissions,
}) => {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<PermissionCategory>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSelectedPermissions(new Set(currentPermissions));
    setMessage(null);
    // 預設展開所有類別
    setExpandedCategories(new Set(Object.keys(PERMISSION_STRUCTURE) as PermissionCategory[]));
  }, [currentPermissions, isOpen]);

  const toggleCategory = (category: PermissionCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleCategoryAll = (category: PermissionCategory, checked: boolean) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      const features = PERMISSION_STRUCTURE[category];
      const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete'];
      
      for (const feature of features) {
        for (const action of actions) {
          const key = `${category}:${feature.key}:${action}`;
          if (checked) {
            next.add(key);
          } else {
            next.delete(key);
          }
        }
      }
      return next;
    });
  };

  const togglePermission = (category: PermissionCategory, feature: string, action: PermissionAction) => {
    const key = `${category}:${feature}:${action}`;
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isCategoryFullySelected = (category: PermissionCategory): boolean => {
    const features = PERMISSION_STRUCTURE[category];
    const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete'];
    
    for (const feature of features) {
      for (const action of actions) {
        const key = `${category}:${feature.key}:${action}`;
        if (!selectedPermissions.has(key)) return false;
      }
    }
    return true;
  };

  const isCategoryPartiallySelected = (category: PermissionCategory): boolean => {
    const features = PERMISSION_STRUCTURE[category];
    const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete'];
    let hasSelected = false;
    let hasUnselected = false;
    
    for (const feature of features) {
      for (const action of actions) {
        const key = `${category}:${feature.key}:${action}`;
        if (selectedPermissions.has(key)) {
          hasSelected = true;
        } else {
          hasUnselected = true;
        }
        if (hasSelected && hasUnselected) return true;
      }
    }
    return false;
  };

  const handleSubmit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await onSave(Array.from(selectedPermissions));
      setMessage({ type: 'success', text: `已成功保存 ${user?.name_zh} 的權限` });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知錯誤';
      setMessage({ type: 'error', text: errorMsg });
      console.error('Save permissions error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">權限設定</h2>
            <p className="text-sm text-gray-500">用戶：{user.name_zh}</p>
            {message && (
              <div className={`text-sm mt-2 p-2 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {(Object.keys(PERMISSION_STRUCTURE) as PermissionCategory[]).map(category => {
              const features = PERMISSION_STRUCTURE[category];
              const isExpanded = expandedCategories.has(category);
              const isFullySelected = isCategoryFullySelected(category);
              const isPartiallySelected = isCategoryPartiallySelected(category);

              return (
                <div key={category} className="border rounded-lg overflow-hidden">
                  {/* 類別標題 */}
                  <div 
                    className="bg-gray-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isFullySelected}
                          ref={el => {
                            if (el) {
                              el.indeterminate = isPartiallySelected && !isFullySelected;
                            }
                          }}
                          onChange={(e) => {
                            e.stopPropagation();
                            const categoryFeatures = PERMISSION_STRUCTURE[category];
                            const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete'];
                            
                            setSelectedPermissions(prev => {
                              const next = new Set(prev);
                              
                              // 在這裡重新計算當前是否全選
                              let currentlyFullySelected = true;
                              for (const feature of categoryFeatures) {
                                for (const action of actions) {
                                  const key = `${category}:${feature.key}:${action}`;
                                  if (!prev.has(key)) {
                                    currentlyFullySelected = false;
                                    break;
                                  }
                                }
                                if (!currentlyFullySelected) break;
                              }
                              
                              // 如果已經全選，則取消全部；否則全選
                              const shouldSelect = !currentlyFullySelected;
                              
                              for (const feature of categoryFeatures) {
                                for (const action of actions) {
                                  const key = `${category}:${feature.key}:${action}`;
                                  if (shouldSelect) {
                                    next.add(key);
                                  } else {
                                    next.delete(key);
                                  }
                                }
                              }
                              return next;
                            });
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                      <span className="font-medium text-gray-900">
                        {PERMISSION_CATEGORY_LABELS[category]}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({features.length} 項功能)
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  {/* 功能列表 */}
                  {isExpanded && (
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full min-w-[520px]">
                        <thead>
                          <tr className="text-sm text-gray-500">
                            <th className="text-left py-2 font-medium">功能</th>
                            <th className="text-center py-2 w-20 font-medium">查看</th>
                            <th className="text-center py-2 w-20 font-medium">新增</th>
                            <th className="text-center py-2 w-20 font-medium">編輯</th>
                            <th className="text-center py-2 w-20 font-medium">刪除</th>
                          </tr>
                        </thead>
                        <tbody>
                          {features.map((feature: FeatureDefinition) => (
                            <tr key={feature.key} className="border-t">
                              <td className="py-2 text-gray-700">{feature.name_zh}</td>
                              {(['view', 'create', 'edit', 'delete'] as PermissionAction[]).map(action => {
                                const key = `${category}:${feature.key}:${action}`;
                                const isChecked = selectedPermissions.has(key);
                                return (
                                  <td key={action} className="text-center py-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setSelectedPermissions(prev => {
                                          const next = new Set(prev);
                                          if (next.has(key)) {
                                            next.delete(key);
                                          } else {
                                            next.add(key);
                                          }
                                          return next;
                                        });
                                      }}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="border-t px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            disabled={saving}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? '儲存中...' : '儲存權限'}
          </button>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 主頁面組件
// =====================================================

const Settings: React.FC = () => {
  const { canManageUsers, isDeveloper, isAdmin, customToken, user, session, hasPermission } = useAuth();
  const { theme, setTheme } = useTheme();
  
  // 設定分類
  const [activeCategory, setActiveCategory] = useState<'users' | 'facility' | 'medication' | 'general' | 'tools'>('users');

  // 權限檢查函數
  const canAccessTab = useCallback((tabName: string): boolean => {
    // 開發者與主管可以訪問所有 tab
    if (isAdmin()) return true;
    
    // 根據 tab 名稱檢查權限
    switch (tabName) {
      case 'users':
        return hasPermission('settings', 'user_management', 'view') || canManageUsers();
      case 'facility':
        return hasPermission('settings', 'facility_settings', 'view');
      case 'medication':
        return hasPermission('settings', 'medication_settings', 'view');
      case 'general':
        return hasPermission('settings', 'general_settings', 'view');
      case 'tools':
        return hasPermission('settings', 'tools_settings', 'view');
      default:
        return false;
    }
  }, [isAdmin, hasPermission, canManageUsers]);

  // 用戶列表狀態
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  
  // 輔助工具設定狀態
  const [toolsSettings, setToolsSettings] = useState<ToolsSettings>(DEFAULT_TOOLS_SETTINGS);
  const [toolsSaving, setToolsSaving] = useState(false);
  const [toolsMessage, setToolsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 初始化輔助工具設定
  useEffect(() => {
    setToolsSettings(getToolsSettings());
  }, []);
  
  // 檢查 activeCategory 權限，無權限時改回 users
  useEffect(() => {
    if (!canAccessTab(activeCategory)) {
      setActiveCategory('users');
    }
  }, [activeCategory, canAccessTab]);
  
  // Modal 狀態
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<string[]>([]);

  // 獲取用戶列表
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageUsers()) {
      fetchUsers();
    }
  }, [canManageUsers, fetchUsers]);

  // 獲取用戶權限
  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission_id, permissions(category, feature, action)')
        .eq('user_id', userId);

      if (error) throw error;

      const permissionKeys = (data || []).map((item: any) => {
        const p = item.permissions;
        return `${p.category}:${p.feature}:${p.action}`;
      });

      return permissionKeys;
    } catch (err) {
      console.error('Fetch user permissions error:', err);
      return [];
    }
  };

  // 儲存用戶
  const handleSaveUser = async (formData: UserFormData) => {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();

    const uploadAvatarIfNeeded = async (userId: string): Promise<string | null> => {
      if (!formData.avatarFile) return formData.avatar_url || null;
      const { url } = await uploadAvatar(userId, formData.avatarFile);
      return url;
    };

    if (formData.id) {
      // 編輯用戶
      const avatarUrl = await uploadAvatarIfNeeded(formData.id);

      const updateData: any = {
        name_zh: formData.name_zh,
        name_en: formData.name_en || null,
        id_number: formData.id_number || null,
        date_of_birth: formData.date_of_birth || null,
        department: formData.department,
        nursing_position: formData.department === '護理' ? formData.nursing_position : null,
        allied_health_position: formData.department === '專職' ? formData.allied_health_position : null,
        hygiene_position: formData.department === '衛生' ? formData.hygiene_position : null,
        other_position: ['行政', '庶務'].includes(formData.department) ? formData.other_position : null,
        secondary_positions: formData.secondary_positions,
        hire_date: formData.hire_date,
        employment_type: formData.employment_type,
        monthly_hour_limit: formData.employment_type === '兼職' ? formData.monthly_hour_limit : null,
        role: formData.role,
        is_active: formData.is_active,
        avatar_url: avatarUrl,
      };

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', formData.id);

      if (error) throw error;

      // 如果有新密碼，更新密碼
      if (formData.password) {
        const authToken = customToken || session?.access_token;
        
        if (!authToken) {
          throw new Error('未授權：請重新登入');
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/auth-custom/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            userId: formData.id,
            newPassword: formData.password,
          }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
      }
    } else {
      // 新增用戶 - 透過 Edge Function
      // 獲取適當的 token：開發者用 session token，員工/主管用 custom token
      const authToken = customToken || session?.access_token;
      
      if (!authToken) {
        throw new Error('未授權：請重新登入');
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/auth-custom/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          name_zh: formData.name_zh,
          name_en: formData.name_en || null,
          id_number: formData.id_number || null,
          date_of_birth: formData.date_of_birth || null,
          department: formData.department,
          nursing_position: formData.department === '護理' ? formData.nursing_position : null,
          allied_health_position: formData.department === '專職' ? formData.allied_health_position : null,
          hygiene_position: formData.department === '衛生' ? formData.hygiene_position : null,
          other_position: ['行政', '庶務'].includes(formData.department) ? formData.other_position : null,
          secondary_positions: formData.secondary_positions,
          hire_date: formData.hire_date,
          employment_type: formData.employment_type,
          monthly_hour_limit: formData.employment_type === '兼職' ? formData.monthly_hour_limit : null,
          role: formData.role,
        }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      // 上傳大頭照並更新新用戶的 avatar_url
      const newUserId = result.user?.id as string | undefined;
      if (newUserId && formData.avatarFile) {
        const avatarUrl = await uploadAvatar(newUserId, formData.avatarFile);
        const { error: avatarError } = await supabase
          .from('user_profiles')
          .update({ avatar_url: avatarUrl.url })
          .eq('id', newUserId);
        if (avatarError) {
          console.error('更新新用戶大頭照失敗:', avatarError);
        }
      }
    }

    await fetchUsers();
  };

  // 儲存權限
  const handleSavePermissions = async (permissionKeys: string[]) => {
    if (!selectedUser) {
      throw new Error('未選擇用戶');
    }

    try {
      // 先刪除舊權限
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUser.id);

      if (deleteError) {
        console.error('Delete permissions error:', deleteError);
        throw new Error(`刪除舊權限失敗: ${deleteError.message}`);
      }

      // 獲取權限 ID 對照
      const { data: allPermissions, error: fetchError } = await supabase
        .from('permissions')
        .select('id, category, feature, action');

      if (fetchError) {
        console.error('Fetch permissions error:', fetchError);
        throw new Error(`獲取權限失敗: ${fetchError.message}`);
      }

      if (!allPermissions) {
        throw new Error('無法獲取權限列表');
      }

      // 建立權限對照表
      const permissionMap = new Map<string, string>();
      for (const p of allPermissions) {
        const key = `${p.category}:${p.feature}:${p.action}`;
        permissionMap.set(key, p.id);
      }

      // 插入新權限
      const inserts = permissionKeys
        .map(key => {
          const permissionId = permissionMap.get(key);
          if (!permissionId) {
            console.warn(`找不到權限: ${key}`);
            return null;
          }
          return {
            user_id: selectedUser.id,
            permission_id: permissionId,
          };
        })
        .filter((item): item is { user_id: string; permission_id: string } => !!item);

      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from('user_permissions')
          .insert(inserts);

        if (insertError) {
          console.error('Insert permissions error:', insertError);
          throw new Error(`保存權限失敗: ${insertError.message}`);
        }
      }

      // 重新加載該用戶的權限
      await fetchUsers();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知錯誤';
      throw new Error(errorMsg);
    }
  };

  // 刪除用戶
  const handleDeleteUser = async (user: UserProfile) => {
    if (!confirm(`確定要刪除用戶「${user.name_zh}」嗎？此操作無法還原。`)) return;

    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', user.id);

    if (error) {
      console.error('Delete user error:', error);
      alert('刪除用戶失敗');
      return;
    }

    await fetchUsers();
  };

  // 開啟權限編輯
  const openPermissionModal = async (user: UserProfile) => {
    setSelectedUser(user);
    const permissions = await fetchUserPermissions(user.id);
    setSelectedUserPermissions(permissions);
    setIsPermissionModalOpen(true);
  };

  // 開啟 QR Code Modal
  const openQRCodeModal = (user: UserProfile) => {
    setSelectedUser(user);
    setIsQRCodeModalOpen(true);
  };

  // 重新生成 QR Code
  const handleRegenerateQRCode = async (userId: string) => {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();
    const authToken = customToken || session?.access_token;

    if (!authToken) {
      throw new Error('未授權：請重新登入');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/auth-custom/regenerate-qr-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ userId }),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    // 重新獲取用戶列表以更新 QR Code
    await fetchUsers();
    
    // 如果選中的用戶是更新的用戶，更新選中狀態
    if (selectedUser?.id === userId) {
      setSelectedUser(result.user);
    }
  };

  // 獲取職位顯示文字
  const getPositionDisplay = (user: UserProfile): string => {
    if (user.nursing_position) return user.nursing_position;
    if (user.allied_health_position) return user.allied_health_position;
    if (user.hygiene_position) return user.hygiene_position;
    if (user.other_position) return user.other_position;
    return '-';
  };

  // 過濾用戶
  const filteredUsers = useMemo(() => users.filter(user => {
    const matchSearch = !deferredSearch || 
      fuzzyMatch(user.name_zh, deferredSearch) ||
      fuzzyMatch(user.name_en, deferredSearch) ||
      fuzzyMatch(user.username, deferredSearch);
    
    const matchDepartment = !filterDepartment || user.department === filterDepartment;
    const matchRole = !filterRole || user.role === filterRole;
    
    return matchSearch && matchDepartment && matchRole;
  }), [users, deferredSearch, filterDepartment, filterRole]);

  // 如果沒有管理權限，顯示原始設定頁面
  if (!canManageUsers()) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <SettingsIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">系統設定</h1>
          </div>
          <p className="text-gray-600">管理系統設定和配置</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-12">
            <SettingsIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">無權限</h3>
            <p className="text-gray-500">您沒有權限存取系統設定</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen pageName="系統設定" />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* 頁面標題 */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <SettingsIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">系統設定</h1>
        </div>
        <p className="text-gray-600">管理用戶帳號和院舍設定</p>
      </div>

      {/* 分類導覽 */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-1">
          {canAccessTab('users') && (
          <button
            onClick={() => setActiveCategory('users')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              activeCategory === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4" />
            用戶管理
          </button>
          )}
          {canAccessTab('facility') && (
          <button
            onClick={() => setActiveCategory('facility')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              activeCategory === 'facility'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="h-4 w-4" />
            院舍設定
          </button>
          )}
          {canAccessTab('medication') && (
          <button
            onClick={() => setActiveCategory('medication')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              activeCategory === 'medication'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Pill className="h-4 w-4" />
            藥物設定
          </button>
          )}
          {canAccessTab('general') && (
          <button
            onClick={() => setActiveCategory('general')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              activeCategory === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            基本設定
          </button>
          )}
          {canAccessTab('tools') && (
          <button
            onClick={() => setActiveCategory('tools')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              activeCategory === 'tools'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Wrench className="h-4 w-4" />
            輔助工具
          </button>
          )}
        </nav>
      </div>

      {/* 院舍設定區塊 */}
      {activeCategory === 'facility' && <FacilitySettingsPanel />}
      {activeCategory === 'facility' && <FacilityNatureSettings />}

      {/* 藥物設定區塊 */}
      {activeCategory === 'medication' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <MedicationSettingsPanel />
        </div>
      )}

      {/* 基本設定區塊 */}
      {activeCategory === 'general' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">基本設定</h2>
          {/* 系統主題 */}
          <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-slate-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">系統主題</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">選擇介面顯示模式</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setTheme('light')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  theme === 'light'
                    ? 'bg-white dark:bg-slate-500 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                <SunMedium className="h-4 w-4" />
                Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                <Moon className="h-4 w-4" />
                Dark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 輔助工具區塊 */}
      {activeCategory === 'tools' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">輔助工具</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
            管理系統中的輔助功能開關，如虛擬數據和快速簽署功能
          </p>

          {toolsMessage && (
            <div
              className={`text-sm rounded-lg px-4 py-2 mb-6 ${
                toolsMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}
            >
              {toolsMessage.text}
            </div>
          )}

          <div className="space-y-4">
            {/* 虛擬數據開關 */}
            <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-slate-700">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">虛擬數據</p>
                </div>
              <div className="ml-4">
                <button
                  onClick={() => {
                    const updated = { ...toolsSettings, virtualDataEnabled: !toolsSettings.virtualDataEnabled };
                    setToolsSettings(updated);
                    saveToolsSettings(updated);
                    setToolsMessage({ type: 'success', text: '虛擬數據設定已更新' });
                    setTimeout(() => setToolsMessage(null), 3000);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    toolsSettings.virtualDataEnabled
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      toolsSettings.virtualDataEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 快速簽署開關 */}
            <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-slate-700">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">快速簽署</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  開啟後，系統將啟用一鍵執藥、一鍵核藥、一鍵派藥等快速簽署功能，即時給藥亦會自動帶入當前登入的保健員／護士
                </p>
              </div>
              <div className="ml-4">
                <button
                  onClick={() => {
                    const updated = { ...toolsSettings, quickSignEnabled: !toolsSettings.quickSignEnabled };
                    setToolsSettings(updated);
                    saveToolsSettings(updated);
                    setToolsMessage({ type: 'success', text: '快速簽署設定已更新' });
                    setTimeout(() => setToolsMessage(null), 3000);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    toolsSettings.quickSignEnabled
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      toolsSettings.quickSignEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 用戶管理區塊 */}
      {activeCategory === 'users' && (
      <div className="bg-white rounded-lg shadow-sm">
        {/* 工具列 */}
        <div className="border-b px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">用戶管理</h2>
              <span className="text-sm text-gray-500">({users.length} 位用戶)</span>
            </div>
            <button
              onClick={() => {
                setSelectedUser(null);
                setIsUserModalOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              新增用戶
            </button>
          </div>

          {/* 搜尋和篩選 */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋姓名或帳號..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">所有部門</option>
              {DEPARTMENTS.map((dept: DepartmentType) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">所有角色</option>
              <option value="admin">主管</option>
              <option value="staff">員工</option>
            </select>
          </div>
        </div>

        {/* 用戶列表 */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-500">載入中...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {users.length === 0 ? '尚未建立任何用戶' : '找不到符合條件的用戶'}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[768px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用戶
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    部門 / 職位
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    角色
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    僱傭類型
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    二維碼
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr 
                    key={user.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onDoubleClick={() => {
                      setSelectedUser(user);
                      setIsUserModalOpen(true);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name_zh}</div>
                        <div className="text-sm text-gray-500">@{user.username}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.department}</div>
                      <div className="text-sm text-gray-500">
                        {getPositionDisplay(user)}
                        {user.secondary_positions && user.secondary_positions.length > 0 && (
                          <span className="text-xs text-gray-400 ml-1">
                            兼：{user.secondary_positions.join('、')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'developer' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {USER_ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.employment_type}
                      {user.employment_type === '兼職' && user.monthly_hour_limit && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({user.monthly_hour_limit}h/月)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {user.login_qr_code_id ? (
                        <button
                          onClick={() => openQRCodeModal(user)}
                          className="p-1 hover:bg-blue-50 rounded transition-colors"
                          title="點擊查看/下載二維碼"
                        >
                          <QrCode className="h-6 w-6 text-blue-600" />
                        </button>
                      ) : (
                        <span className="text-gray-300">
                          <QrCode className="h-6 w-6 mx-auto" />
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? '啟用' : '停用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex flex-shrink-0 items-center justify-end gap-2">
                        {user.role !== 'developer' && (
                          <button
                            onClick={() => openPermissionModal(user)}
                            className="text-purple-600 hover:text-purple-900 p-1"
                            title="權限設定"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setIsUserModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="編輯"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {user.role !== 'developer' && (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="刪除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}

      {/* 用戶編輯 Modal */}
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        user={selectedUser}
        isAdmin={isAdmin()}
        isDeveloper={isDeveloper()}
      />

      {/* 權限編輯 Modal */}
      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        onSave={handleSavePermissions}
        user={selectedUser}
        currentPermissions={selectedUserPermissions}
      />

      {/* 二維碼 Modal */}
      <UserQRCodeModal
        isOpen={isQRCodeModalOpen}
        onClose={() => setIsQRCodeModalOpen(false)}
        user={selectedUser}
        canRegenerate={isAdmin() || isDeveloper()}
        onRegenerate={handleRegenerateQRCode}
      />
    </div>
  );
};

export default Settings;
