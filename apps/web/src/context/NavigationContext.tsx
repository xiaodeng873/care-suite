import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavigationContextType {
  isNavigating: boolean;
  navigatingTo: string | null;
  isInitialLoad: boolean;
  startNavigation: (path: string) => void;
  navigateWithLoading: (path: string) => void;
  finishNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 初始加載時顯示 loading（直接訪問 URL 時）
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 當路由變化時，重置導航狀態
  useEffect(() => {
    // 如果正在導航到某個路徑，且當前路徑已經是目標路徑，則結束導航
    if (navigatingTo && location.pathname === navigatingTo) {
      // 給一點延遲確保頁面開始渲染
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setNavigatingTo(null);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, navigatingTo]);

  // 開始導航（只設置狀態，不實際導航 - 用於 Link 組件）
  const startNavigation = useCallback((path: string) => {
    if (path === location.pathname) return; // 已在目標頁面
    setIsInitialLoad(false); // 不再是初始加載
    setIsNavigating(true);
    setNavigatingTo(path);
  }, [location.pathname]);

  // 帶有 loading 狀態的導航（用於程式化導航）
  const navigateWithLoading = useCallback((path: string) => {
    if (path === location.pathname) return; // 已在目標頁面
    setIsInitialLoad(false); // 不再是初始加載
    setIsNavigating(true);
    setNavigatingTo(path);
    navigate(path);
  }, [location.pathname, navigate]);

  // 結束導航狀態（供頁面調用，或初始加載完成時調用）
  const finishNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavigatingTo(null);
    setIsInitialLoad(false);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        isNavigating,
        navigatingTo,
        isInitialLoad,
        startNavigation,
        navigateWithLoading,
        finishNavigation,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
