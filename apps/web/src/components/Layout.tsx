import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, FileText, BarChart3, Home, LogOut, User, Clock, BicepsFlexed, CalendarCheck, CalendarDays, CheckSquare, Utensils, BookOpen, Shield, Printer, Settings, Ambulance, Activity, Hospital, Bed, Stethoscope, Database, Scissors, UserSearch, Pill, AlertTriangle, Syringe, ScanLine, ClipboardCheck, ClipboardList, ChevronDown, Menu, X, Building2, PartyPopper, Key, Search, Receipt } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { usePatientData } from '../context/PatientContext';
import { useStationFilter } from '../context/StationFilterContext';
import type { Station } from '../context/facility';
import {
  getFacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
  type FacilitySettings,
} from '../utils/facilitySettings';
import { LoadingScreen } from './PageLoadingScreen';
import { ChangePasswordModal } from './ChangePasswordModal';
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
  '/tube-care': '喉管護理',
  '/admission-records': '入院記錄',
  '/print-forms': '列印表格',
  '/wound': '傷口管理',
  '/wound-old': '傷口評估',
  '/prescriptions': '處方管理',
  '/prescription-search': '處方搜尋',
  '/drug-database': '藥物資料庫',
  '/medication-workflow': 'eMAR',
  '/hospital-outreach': 'CGAT',
  '/annual-health-checkup': '年度體檢',
  '/incident-reports': '意外事故報告',
  '/diagnosis-records': '診斷記錄',
  '/vaccination-records': '疫苗記錄',
  '/care-records': '床頭記錄',
  '/patients': '院友列表',
  '/patient-contacts': '院友聯絡人',
  '/templates': '範本管理',
  '/health': '監測記錄',
  '/health-assessments': '健康評估',
  '/individual-care-plan': '個人照顧計劃',
  '/activity-records': '活動記錄',
  '/reports': '報表查詢',
  '/fee-records': '費用記錄',
  '/settings': '系統設定',
  '/rehabilitation': '復康服務',
  '/infection-control': '感染控制'
};

interface LayoutProps {
  children: React.ReactNode;
  user: SupabaseUser;
  onSignOut: () => void;
}

interface StationFilterItemProps {
  station: Station;
  checked: boolean;
  onChange: (stationId: string, checked: boolean) => void;
}

const StationFilterItem = memo(function StationFilterItem({
  station,
  checked,
  onChange,
}: StationFilterItemProps) {
  return (
    <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(station.id, e.target.checked)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{station.name}</span>
    </label>
  );
});

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
  const [showStationFilter, setShowStationFilter] = useState(false);
  const [draftStationIds, setDraftStationIds] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings>(DEFAULT_FACILITY_SETTINGS);
  const { displayName, hasPermission, hasCategoryViewPermission, isDeveloper, userProfile, customLogout } = useAuth();
  const { isNavigating, navigatingTo, isInitialLoad, startNavigation, finishNavigation } = useNavigation();
  const { loading: patientLoading, stations } = usePatientData();
  const { selectedStationIds, setSelectedStationIds, isFiltered } = useStationFilter();
  const location = useLocation();
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stationFilterRef = useRef<HTMLDivElement | null>(null);

  // 用 refs 保存最新值，避免 dropdown flush 時出現 stale closure
  const draftStationIdsRef = useRef(draftStationIds);
  useEffect(() => { draftStationIdsRef.current = draftStationIds; }, [draftStationIds]);
  const selectedStationIdsRef = useRef(selectedStationIds);
  useEffect(() => { selectedStationIdsRef.current = selectedStationIds; }, [selectedStationIds]);
  const setSelectedStationIdsRef = useRef(setSelectedStationIds);
  useEffect(() => { setSelectedStationIdsRef.current = setSelectedStationIds; }, [setSelectedStationIds]);

  // 載入院舍名稱
  useEffect(() => {
    let cancelled = false;
    getFacilitySettings()
      .then(s => { if (!cancelled) setFacilitySettings(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // 當 PatientContext 載入完成時，結束初始導航狀態
  useEffect(() => {
    if (isInitialLoad && !patientLoading) {
      finishNavigation();
    }
  }, [isInitialLoad, patientLoading, finishNavigation]);

  // 居住區過濾器 dropdown：開啟時用 draft 複製目前選擇，關閉時才 flush 回 context
  // 這樣快速勾選多個居住區時不會每一下都觸發全局重新渲染
  useEffect(() => {
    if (showStationFilter) {
      setDraftStationIds(selectedStationIdsRef.current);
      return;
    }

    // dropdown 關閉時：如果 draft 有變化，一次性寫回 context
    const draft = draftStationIdsRef.current;
    const selected = selectedStationIdsRef.current;
    const changed =
      draft.length !== selected.length ||
      draft.some(id => !selected.includes(id)) ||
      selected.some(id => !draft.includes(id));
    if (changed) {
      setSelectedStationIdsRef.current(draft);
    }
  }, [showStationFilter]);

  useEffect(() => {
    if (!showStationFilter) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (stationFilterRef.current && !stationFilterRef.current.contains(e.target as Node)) {
        setShowStationFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStationFilter]);

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
        { name: '床頭記錄', href: '/care-records', icon: ClipboardCheck, feature: 'care_records' },
        { name: '院友日誌', href: '/patient-logs', icon: BookOpen, feature: 'patient_logs' },
        { name: '診斷記錄', href: '/diagnosis-records', icon: FileText, feature: 'diagnosis_records' },
        { name: '疫苗記錄', href: '/vaccination-records', icon: Syringe, feature: 'vaccination_records' },
        { name: '費用記錄', href: '/fee-records', icon: Receipt, feature: 'fee_records' },
      ]
    },
    {
      name: '藥物',
      category: 'medication',
      items: [
        { name: '處方管理', href: '/prescriptions', icon: Pill, feature: 'prescription_management' },
        { name: '處方搜尋', href: '/prescription-search', icon: Search, feature: 'prescription_management' },
        { name: 'eMAR', href: '/medication-workflow', icon: CheckSquare, feature: 'medication_workflow' },
        { name: '藥物資料庫', href: '/drug-database', icon: Database, feature: 'drug_database' },
      ]
    },
    {
      name: '治療',
      category: 'treatment',
      items: [
        { name: 'VMO排程', href: '/scheduling', icon: Stethoscope, feature: 'vmo_schedule' },
        { name: 'CGAT', href: '/hospital-outreach', icon: Hospital, feature: 'hospital_outreach' },
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
        { name: '喉管護理', href: '/tube-care', icon: Stethoscope, feature: 'tube_care' },
        { name: '傷口管理', href: '/wound', icon: Scissors, feature: 'wound_management' },
        { name: '活動記錄', href: '/activity-records', icon: PartyPopper, feature: 'activity_records' },
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
        { name: '感染控制', href: '/infection-control', icon: Shield, feature: 'infection_control' },
        { name: '排班管理', href: '/roster-management', icon: CalendarDays, feature: 'roster_management' },
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

  const handleStationChange = useCallback((stationId: string, checked: boolean) => {
    setDraftStationIds(prev =>
      checked ? [...prev, stationId] : prev.filter(id => id !== stationId)
    );
  }, []);

  const isActive = (path: string) => location.pathname === path;

  // 如果正在導航或初始加載，直接顯示全屏加載頁
  if (isNavigating && navigatingTo) {
    const targetPageName = routeNames[navigatingTo] || '頁面';
    return <LoadingScreen pageName={targetPageName} />;
  }
  
  // 初始加載時也顯示加載頁
  if (isInitialLoad) {
    const currentPageName = routeNames[location.pathname] || '頁面';
    return <LoadingScreen pageName={currentPageName} />;
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
                className="flex items-center gap-2 mr-8 flex-shrink-0"
                onClick={(e) => {
                  if (isActive('/')) {
                    e.preventDefault();
                    return;
                  }
                  startNavigation('/');
                }}
              >
                <Home className="h-6 w-6 text-blue-600" />
                <span className="text-base font-bold text-gray-900 hidden sm:inline">
                  {facilitySettings.facilityNameZh || facilitySettings.facilityNameEn || 'SeniorCare'}
                </span>
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
                              className={`flex flex-wrap items-center gap-2 px-4 py-2 text-sm transition-colors ${
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

            {/* 右側：居住區過濾器 + 日期和用戶 */}
            <div className="flex items-center gap-4 flex-shrink-0 ml-auto">

              {/* 居住區過濾器 */}
              {stations.length > 0 && (
                <div className="relative" ref={stationFilterRef}>
                  <button
                    onClick={() => setShowStationFilter(v => !v)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                      isFiltered
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                    title="居住區過濾器"
                  >
                    <Building2 className="w-4 h-4" />
                    {isFiltered && (
                      <span className="font-semibold tabular-nums">{selectedStationIds.length}</span>
                    )}
                  </button>

                  {showStationFilter && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2">
                      <div className="flex items-center justify-between px-3 pb-2 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">居住區</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDraftStationIds(stations.map(s => s.id))}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >全選</button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => setDraftStationIds([])}
                            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                          >清除</button>
                        </div>
                      </div>
                      <div className="py-1 max-h-64 overflow-y-auto">
                        {stations.map(station => (
                          <StationFilterItem
                            key={station.id}
                            station={station}
                            checked={draftStationIds.includes(station.id)}
                            onChange={handleStationChange}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors whitespace-nowrap"
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
                      onClick={() => {
                        setIsChangePasswordOpen(true);
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
                    >
                      <Key className="w-4 h-4" />
                      <span>重設密碼</span>
                    </button>
                    <button
                      onClick={async () => {
                        // 同時處理兩種登出
                        if (userProfile) {
                          await customLogout();
                        }
                        onSignOut();
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
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

      {/* 重設密碼 Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* 移動版側邊選單 */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative h-full w-64 bg-white shadow-xl overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 h-16 px-4 border-b border-gray-200">
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
                          className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
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