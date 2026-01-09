import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, FileText, BarChart3, Home, LogOut, User, Clock, BicepsFlexed, CalendarCheck, CheckSquare, Utensils, BookOpen, Shield, Printer, Settings, Ambulance, Activity, Hospital, Bed, Stethoscope, Database, Scissors, UserSearch, Pill, AlertTriangle, Syringe, ScanLine, ClipboardCheck, ClipboardList, ChevronDown, Menu, X } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { LoadingScreen } from './PageLoadingScreen';
import type { PermissionCategory } from '@care-suite/shared';

// 路由名稱對照表
const routeNames: Record<string, string> = {
  '/': '主頁',
  '/scheduling': 'VMO排程',
  '/station-bed': '床位管理',
  '/follow-up': '覆診管理',
  '/tasks': '任務管理',
  '/meal-guidance': '飲食指導',
  '/patient-logs': '院友日誌',
  '/restraint': '約束物品',
  '/admission-records': '入院記錄',
  '/print-forms': '列印表格',
  '/wound': '傷口管理',
  '/wound-old': '傷口評估',
  '/prescriptions': '處方管理',
  '/drug-database': '藥物資料庫',
  '/medication-workflow': '藥物工作流程',
  '/hospital-outreach': '醫院外展',
  '/annual-health-checkup': '年度體檢',
  '/incident-reports': '意外事故報告',
  '/diagnosis-records': '診斷記錄',
  '/vaccination-records': '疫苗記錄',
  '/care-records': '護理記錄',
  '/patients': '院友列表',
  '/patient-contacts': '院友聯絡人',
  '/templates': '範本管理',
  '/health': '監測記錄',
  '/health-assessments': '健康評估',
  '/individual-care-plan': '個人照顧計劃',
  '/reports': '報表查詢',
  '/settings': '系統設定',
  '/rehabilitation': '復康服務'
};

interface LayoutProps {
  children: React.ReactNode;
  user: SupabaseUser;
  onSignOut: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string; // 對應權限的 feature key
}

interface NavCategory {
  name: string;
  category?: PermissionCategory; // 對應權限類別
  items: NavItem[];
}

// 獲取職位顯示文字
const getPositionLabel = (userProfile: any): string => {
  if (userProfile.nursing_position) return userProfile.nursing_position;
  if (userProfile.allied_health_position) return userProfile.allied_health_position;
  if (userProfile.hygiene_position) return userProfile.hygiene_position;
  if (userProfile.other_position) return userProfile.other_position;
  return userProfile.department || '';
};

const Layout: React.FC<LayoutProps> = ({ children, user, onSignOut }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { displayName, hasPermission, hasCategoryViewPermission, isDeveloper, userProfile, customLogout } = useAuth();
  const { isNavigating, navigatingTo, startNavigation } = useNavigation();
  const location = useLocation();
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Hong_Kong"}));
    return hongKongTime;
  };

  // 導覽分類（帶權限標記）
  const allNavCategories: NavCategory[] = [
    {
      name: '院友',
      category: 'patients',
      items: [
        { name: '院友列表', href: '/patients', icon: Users, feature: 'patient_list' },
        { name: '院友聯絡人', href: '/patient-contacts', icon: UserSearch, feature: 'patient_contacts' },
        { name: '床位管理', href: '/station-bed', icon: Bed, feature: 'bed_management' },
        { name: '報表查詢', href: '/reports', icon: BarChart3, feature: 'reports' },
      ]
    },
    {
      name: '記錄',
      category: 'records',
      items: [
        { name: '監測記錄', href: '/health', icon: Activity, feature: 'health_monitoring' },
        { name: '護理記錄', href: '/care-records', icon: ClipboardCheck, feature: 'care_records' },
        { name: '院友日誌', href: '/patient-logs', icon: BookOpen, feature: 'patient_logs' },
        { name: '診斷記錄', href: '/diagnosis-records', icon: FileText, feature: 'diagnosis_records' },
        { name: '疫苗記錄', href: '/vaccination-records', icon: Syringe, feature: 'vaccination_records' },
      ]
    },
    {
      name: '藥物',
      category: 'medication',
      items: [
        { name: '處方管理', href: '/prescriptions', icon: Pill, feature: 'prescription_management' },
        { name: '藥物工作流程', href: '/medication-workflow', icon: CheckSquare, feature: 'medication_workflow' },
        { name: '藥物資料庫', href: '/drug-database', icon: Database, feature: 'drug_database' },
      ]
    },
    {
      name: '治療',
      category: 'treatment',
      items: [
        { name: 'VMO排程', href: '/scheduling', icon: Stethoscope, feature: 'vmo_schedule' },
        { name: '醫院外展', href: '/hospital-outreach', icon: Hospital, feature: 'hospital_outreach' },
        { name: '復康服務', href: '/rehabilitation', icon: BicepsFlexed, feature: 'rehabilitation' },
      ]
    },
    {
      name: '定期',
      category: 'periodic',
      items: [
        { name: '年度體檢', href: '/annual-health-checkup', icon: BicepsFlexed, feature: 'annual_checkup' },
        { name: '健康評估', href: '/health-assessments', icon: UserSearch, feature: 'health_assessment' },
        { name: '個人照顧計劃', href: '/individual-care-plan', icon: ClipboardList, feature: 'care_plan' },
        { name: '約束物品', href: '/restraint', icon: Shield, feature: 'restraint' },
        { name: '傷口管理', href: '/wound', icon: Scissors, feature: 'wound_management' },
      ]
    },
    {
      name: '日常',
      category: 'daily',
      items: [
        { name: '覆診管理', href: '/follow-up', icon: CalendarCheck, feature: 'follow_up' },
        { name: '缺席管理', href: '/admission-records', icon: Ambulance, feature: 'admission_records' },
        { name: '任務管理', href: '/tasks', icon: Clock, feature: 'task_management' },
        { name: '餐膳指引', href: '/meal-guidance', icon: Utensils, feature: 'meal_guidance' },
        { name: '意外事件報告', href: '/incident-reports', icon: AlertTriangle, feature: 'incident_reports' },
      ]
    },
    {
      name: '列印',
      category: 'print',
      items: [
        { name: '列印表格', href: '/print-forms', icon: Printer, feature: 'print_forms' },
        { name: '範本管理', href: '/templates', icon: FileText, feature: 'template_management' },
      ]
    },
    {
      name: '設定',
      category: 'settings',
      items: [
        { name: '系統設定', href: '/settings', icon: Settings, feature: 'system_settings' },
      ]
    },
  ];

  // 根據權限過濾導覽項目
  const navCategories = useMemo(() => {
    // 開發者看到所有項目
    if (isDeveloper()) {
      return allNavCategories;
    }

    return allNavCategories
      .map(category => {
        // 如果沒有設定權限類別，顯示所有項目
        if (!category.category) return category;

        // 過濾有查看權限的項目
        const filteredItems = category.items.filter(item => {
          if (!item.feature) return true;
          return hasPermission(category.category!, item.feature, 'view');
        });

        return {
          ...category,
          items: filteredItems,
        };
      })
      .filter(category => category.items.length > 0); // 移除沒有項目的類別
  }, [isDeveloper, hasPermission]);

  // 關閉所有下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      let clickedInside = false;
      
      Object.values(dropdownRefs.current).forEach((ref) => {
        if (ref && ref.contains(target)) {
          clickedInside = true;
        }
      });
      
      if (!clickedInside) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 鎖定背景
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => { 
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleDropdownToggle = (categoryName: string) => {
    setOpenDropdown(openDropdown === categoryName ? null : categoryName);
  };

  const handleDropdownHover = (categoryName: string) => {
    // 清除任何待處理的關閉timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setOpenDropdown(categoryName);
  };

  const handleDropdownLeave = () => {
    // 清除舊的timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // 設置新的延遲關閉
    hoverTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
      hoverTimeoutRef.current = null;
    }, 150);
  };

  const isActive = (path: string) => location.pathname === path;

  // 如果正在導航，直接顯示全屏加載頁
  if (isNavigating && navigatingTo) {
    const targetPageName = routeNames[navigatingTo] || '頁面';
    return <LoadingScreen pageName={targetPageName} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導覽欄 */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo 和導覽 */}
            <div className="flex items-center flex-1">
              {/* Logo */}
              <Link 
                to="/" 
                className="flex items-center space-x-2 mr-8"
                onClick={(e) => {
                  if (isActive('/')) {
                    e.preventDefault();
                    return;
                  }
                  startNavigation('/');
                }}
              >
                <Home className="h-6 w-6 text-blue-600" />
                <span className="text-xl font-bold text-gray-900 hidden sm:inline">StationC</span>
              </Link>

              {/* 桌面版導覽 */}
              <nav className="hidden lg:flex items-center space-x-1">
                {navCategories.map((category) => (
                  <div
                    key={category.name}
                    ref={(el) => { dropdownRefs.current[category.name] = el; }}
                    className="relative"
                    onMouseEnter={() => handleDropdownHover(category.name)}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <button
                      onClick={() => handleDropdownToggle(category.name)}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        openDropdown === category.name
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{category.name}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                        openDropdown === category.name ? 'rotate-180' : ''
                      }`} />
                    </button>

                    {/* 下拉選單 */}
                    {openDropdown === category.name && (
                      <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        {category.items.map((item) => {
                          const Icon = item.icon;
                          const isCurrentPage = isActive(item.href);
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              className={`flex items-center space-x-2 px-4 py-2 text-sm transition-colors ${
                                isCurrentPage
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                              onClick={(e) => {
                                if (isCurrentPage) {
                                  e.preventDefault();
                                  return;
                                }
                                startNavigation(item.href);
                                setOpenDropdown(null);
                              }}
                            >
                              <Icon className="h-4 w-4" />
                              <span>{item.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </nav>

              {/* 移動版選單按鈕 */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>

            {/* 右側：日期和用戶 */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500 hidden md:inline">
                {getHongKongDate().toLocaleDateString('zh-TW', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  weekday: 'long'
                })}
              </span>
              
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span className="text-sm hidden sm:inline">{displayName || user.email}</span>
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {userProfile && (
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">
                          {userProfile.name_zh}
                          {getPositionLabel(userProfile) && ` (${getPositionLabel(userProfile)})`}
                        </p>
                        <p className="text-xs text-gray-500">@{userProfile.username}</p>
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        // 同時處理兩種登出
                        if (userProfile) {
                          await customLogout();
                        }
                        onSignOut();
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>登出</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 移動版側邊選單 */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative h-full w-64 bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
              <span className="text-xl font-bold text-gray-900">選單</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="px-4 py-4">
              {navCategories.map((category) => (
                <div key={category.name} className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {category.name}
                  </h3>
                  <div className="space-y-1">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isCurrentPage = isActive(item.href);
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isCurrentPage
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={(e) => {
                            if (isCurrentPage) {
                              e.preventDefault();
                              return;
                            }
                            startNavigation(item.href);
                            setMobileMenuOpen(false);
                          }}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 主內容區 */}
      <main className="pt-16">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;