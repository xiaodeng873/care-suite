import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, FileText, BarChart3, Home, LogOut, User, Clock, BicepsFlexed, CalendarCheck, CheckSquare, Utensils, BookOpen, Shield, Printer, Settings, Ambulance, Activity, Hospital, Bed, Stethoscope, Database, Bandage, UserSearch, Pill, AlertTriangle, Syringe, ScanLine, ClipboardCheck, ChevronDown, Menu, X } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  user: SupabaseUser;
  onSignOut: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavCategory {
  name: string;
  items: NavItem[];
}

const Layout: React.FC<LayoutProps> = ({ children, user, onSignOut }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { displayName } = useAuth();
  const location = useLocation();
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Hong_Kong"}));
    return hongKongTime;
  };

  // 導覽分類
  const navCategories: NavCategory[] = [
    {
      name: '院友',
      items: [
        { name: '院友列表', href: '/patients', icon: Users },
        { name: '床位管理', href: '/station-bed', icon: Bed },
        { name: '報表查詢', href: '/reports', icon: BarChart3 },
      ]
    },
    {
      name: '記錄',
      items: [
        { name: '監測記錄', href: '/health', icon: Activity },
        { name: '護理記錄', href: '/care-records', icon: ClipboardCheck },
        { name: '院友日誌', href: '/patient-logs', icon: BookOpen },
        { name: '診斷記錄', href: '/diagnosis-records', icon: FileText },
        { name: '疫苗記錄', href: '/vaccination-records', icon: Syringe },
      ]
    },
    {
      name: '藥物',
      items: [
        { name: '處方管理', href: '/prescriptions', icon: Pill },
        { name: '藥物工作流程', href: '/medication-workflow', icon: CheckSquare },
        { name: '藥物資料庫', href: '/drug-database', icon: Database },
      ]
    },
    {
      name: '治療',
      items: [
        { name: 'VMO排程', href: '/scheduling', icon: Stethoscope },
        { name: '醫院外展', href: '/hospital-outreach', icon: Hospital },
        { name: '復康服務', href: '/rehabilitation', icon: BicepsFlexed },
      ]
    },
    {
      name: '定期',
      items: [
        { name: '年度體檢', href: '/annual-health-checkup', icon: BicepsFlexed },
        { name: '健康評估', href: '/health-assessments', icon: UserSearch },
        { name: '約束物品', href: '/restraint', icon: Shield },
        { name: '傷口管理', href: '/wound', icon: Bandage },
      ]
    },
    {
      name: '日常',
      items: [
        { name: '覆診管理', href: '/follow-up', icon: CalendarCheck },
        { name: '缺席管理', href: '/admission-records', icon: Ambulance },
        { name: '任務管理', href: '/tasks', icon: Clock },
        { name: '餐膳指引', href: '/meal-guidance', icon: Utensils },
        { name: '意外事件報告', href: '/incident-reports', icon: AlertTriangle },
      ]
    },
    {
      name: '列印',
      items: [
        { name: '列印表格', href: '/print-forms', icon: Printer },
        { name: '範本管理', href: '/templates', icon: FileText },
        { name: 'OCR文件識別', href: '/ocr', icon: ScanLine },
      ]
    },
    {
      name: '設定',
      items: [
        { name: '系統設定', href: '/settings', icon: Settings },
      ]
    },
  ];

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

  const handleDropdownToggle = (categoryName: string) => {
    setOpenDropdown(openDropdown === categoryName ? null : categoryName);
  };

  const handleDropdownHover = (categoryName: string) => {
    setOpenDropdown(categoryName);
  };

  const handleDropdownLeave = () => {
    // 延遲關閉，讓用戶有時間移動到下拉選單
    setTimeout(() => {
      setOpenDropdown(null);
    }, 200);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導覽欄 */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo 和導覽 */}
            <div className="flex items-center flex-1">
              {/* Logo */}
              <Link to="/" className="flex items-center space-x-2 mr-8">
                <Home className="h-6 w-6 text-blue-600" />
                <span className="text-xl font-bold text-gray-900 hidden sm:inline">StationC</span>
              </Link>

              {/* 桌面版導覽 */}
              <nav className="hidden lg:flex items-center space-x-1">
                {navCategories.map((category) => (
                  <div
                    key={category.name}
                    ref={(el) => (dropdownRefs.current[category.name] = el)}
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
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              className={`flex items-center space-x-2 px-4 py-2 text-sm transition-colors ${
                                isActive(item.href)
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                              onClick={() => setOpenDropdown(null)}
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
                    <button
                      onClick={() => {
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
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive(item.href)
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
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