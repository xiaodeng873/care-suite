import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = 'care-suite-theme';

const applyThemeClass = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();

  // 初始值：先用 localStorage（即時、無閃爍），登入後再由 DB 校正
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
    } catch {
      return 'light';
    }
  });

  // 記錄已由哪個使用者初始化，避免重複讀 DB / 切換使用者時重讀
  const [initializedUserId, setInitializedUserId] = useState<string | null>(null);

  // 套用 class 到 <html> 並同步 localStorage
  useEffect(() => {
    applyThemeClass(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // 登入後：從 DB 讀取用戶偏好主題（與居住區過濾器同理，跨瀏覽器沿用）
  useEffect(() => {
    const uid = userProfile?.id ?? null;
    if (!uid) {
      setInitializedUserId(null);
      return;
    }
    if (initializedUserId === uid) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('preferred_theme')
          .eq('id', uid)
          .single();

        if (cancelled) return;

        const dbTheme = data?.preferred_theme as Theme | null | undefined;
        if (dbTheme === 'light' || dbTheme === 'dark') {
          // DB 有值：以 DB 為準
          setThemeState(dbTheme);
        } else {
          // DB 無值：把目前（localStorage/預設）值寫回 DB，確保下次其他裝置沿用
          let current: Theme = 'light';
          try {
            current = (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
          } catch {
            current = 'light';
          }
          supabase
            .from('user_profiles')
            .update({ preferred_theme: current })
            .eq('id', uid)
            .then(({ error }) => {
              if (error) console.warn('主題偏好初始化寫入 DB 失敗:', error.message);
            });
        }
      } catch {
        // 讀取失敗：維持 localStorage 值
      } finally {
        if (!cancelled) setInitializedUserId(uid);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userProfile?.id, initializedUserId]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      const uid = userProfile?.id;
      if (uid) {
        supabase
          .from('user_profiles')
          .update({ preferred_theme: newTheme })
          .eq('id', uid)
          .then(({ error }) => {
            if (error) console.warn('無法保存主題偏好:', error.message);
          });
      }
    },
    [userProfile?.id]
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
