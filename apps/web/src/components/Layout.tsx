import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, FileText, BarChart3, Menu, X, Home, LogOut, User, Clock, BicepsFlexed, CalendarCheck, CheckSquare, Utensils, BookOpen, Shield, Printer, Settings, Ambulance, Activity, Hospital, Bed, Stethoscope, Database, Bandage, UserSearch, Pill, AlertTriangle, Syringe, ScanLine, ClipboardCheck } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  user: SupabaseUser;
  onSignOut: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onSignOut }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { displayName } = useAuth();
  const location = useLocation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // 簡單鎖定背景，完全依賴原生滾動
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => { 
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    // 使用 toLocaleString 直接獲取香港時區的時間
    const hongKongTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Hong_Kong"}));
    return hongKongTime;
  };

  const navigation = [
    { name: '主面板', href: '/', icon: Home },
    { name: '院友列表', href: '/patients', icon: Users },
    { name: '床位管理', href: '/station-bed', icon: Bed },
    { name: 'VMO排程', href: '/scheduling', icon: Stethoscope },
    { name: '覆診管理', href: '/follow-up', icon: CalendarCheck },
    { name: '監測記錄', href: '/health', icon: Activity },
    { name: '健康評估', href: '/health-assessments', icon: UserSearch },
    { name: '餐膳指引', href: '/meal-guidance', icon: Utensils },
    { name: '院友日誌', href: '/patient-logs', icon: BookOpen },
    { name: '護理記錄', href: '/care-records', icon: ClipboardCheck },
    { name: '約束物品', href: '/restraint', icon: Shield },
    { name: '意外事件報告', href: '/incident-reports', icon: AlertTriangle },
    { name: '診斷記錄', href: '/diagnosis-records', icon: FileText },
    { name: '疫苗記錄', href: '/vaccination-records', icon: Syringe },
    { name: '年度體檢', href: '/annual-health-checkup', icon: BicepsFlexed },
    { name: '缺席管理', href: '/admission-records', icon: Ambulance },
    { name: '傷口管理', href: '/wound', icon: Bandage },
    { name: 'OCR文件識別', href: '/ocr', icon: ScanLine },
    { name: '處方管理', href: '/prescriptions', icon: Pill },
    { name: '藥物資料庫', href: '/drug-database', icon: Database },
    { name: '藥物工作流程', href: '/medication-workflow', icon: CheckSquare },
    { name: '職員工作面板', href: '/staff-work-panel', icon: Users },
    { name: '醫院外展', href: '/hospital-outreach', icon: Hospital },
    { name: '範本管理', href: '/templates', icon: FileText },
    { name: '列印表格', href: '/print-forms', icon: Printer },
    { name: '任務管理', href: '/tasks', icon: Clock },
    { name: '報表查詢', href: '/reports', icon: BarChart3 },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
      >
        <div
          ref={overlayRef}
          className="absolute inset-0 bg-gray-600 bg-opacity-75"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="relative h-full w-64 bg-white shadow-xl" style={{ zIndex: 51 }}>
          <div className="absolute inset-0 flex flex-col">
            <div className="h-16 px-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2">

                <span className="text-xl font-bold text-gray-900">StationC</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div
              ref={navRef}
              className="flex-1 px-4 overflow-y-auto"
            >
              <div className="py-4 space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-blue-50 text-blue-700'
                         : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
              <div style={{ height: '200px' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
      }`}>
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 flex-shrink-0">
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-2">
              
                <span className="text-xl font-bold text-gray-900">StationC</span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title={sidebarCollapsed ? '展開選單' : '收起選單'}
            >
              {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
            </button>
          </div>
          <div className="px-2 overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
            <nav className="py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-700'
                       : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                  </Link>
                );
              })}
            </nav>
            <div style={{ height: '300px' }}></div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <div className="flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
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
                <span className="text-sm">{displayName || user.email}</span>
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
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;