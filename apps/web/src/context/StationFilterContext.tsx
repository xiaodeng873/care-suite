import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useStation } from './facility';
import { supabase } from '../lib/supabase';

interface StationFilterContextType {
  selectedStationIds: string[];
  setSelectedStationIds: (ids: string[]) => void;
  isFiltered: boolean;
}

const SAVE_DEBOUNCE_MS = 500;

const StationFilterContext = createContext<StationFilterContextType | undefined>(undefined);

export const StationFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const { stations } = useStation();

  const storageKey = userProfile?.id ? `stationFilter_${userProfile.id}` : null;

  const [selectedStationIds, setSelectedStationIdsState] = useState<string[]>([]);
  const [initializedKey, setInitializedKey] = useState<string | null>(null);
  const pendingIdsRef = useRef<string[] | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDbUpdate = useCallback((ids: string[]) => {
    if (!userProfile?.id) return;
    supabase
      .from('user_profiles')
      .update({ preferred_station_ids: ids })
      .eq('id', userProfile.id)
      .then(({ error }) => {
        if (error) console.warn('無法保存居住區偏好設定:', error.message);
      });
  }, [userProfile?.id]);

  // 初始化：從資料庫或 localStorage 讀取
  useEffect(() => {
    if (!stations.length) return;
    const currentKey = storageKey ?? '__no_user__';
    if (initializedKey === currentKey) return;

    // 初始化時先清空待寫入，避免舊的 debounce 覆蓋新讀取的值
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingIdsRef.current = null;

    const allIds = stations.map(s => s.id);

    const loadPreferences = async () => {
      let selectedIds = allIds;

      if (storageKey && userProfile?.id) {
        // 1. 先嘗試從資料庫讀取
        let dbIds: string[] | null = null;
        try {
          const { data } = await supabase
            .from('user_profiles')
            .select('preferred_station_ids')
            .eq('id', userProfile.id)
            .single();

          if (data?.preferred_station_ids && Array.isArray(data.preferred_station_ids)) {
            dbIds = data.preferred_station_ids as string[];
          }
        } catch {
          // 資料庫讀取失敗，繼續嘗試 localStorage
        }

        if (dbIds !== null) {
          // 資料庫有資料：完全沿用上次選擇，只過濾掉已被刪除的居住區。
          // 不可自動合併「新」居住區，否則被用戶取消勾選的居住區會被誤判為新居住區而重新加回 → 記憶失效。
          const validIds = dbIds.filter(id => allIds.includes(id));
          // dbIds 為空陣列代表用戶主動清除全部，須尊重；只有過濾後變空（原本有值但都失效）才 fallback 全選
          selectedIds = dbIds.length === 0 ? [] : (validIds.length > 0 ? validIds : allIds);
        } else {
          // 資料庫無資料（null）：先嘗試從 localStorage 讀取，然後無論如何都寫入 DB
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as string[];
              const validIds = parsed.filter(id => allIds.includes(id));
              selectedIds = parsed.length === 0 ? [] : (validIds.length > 0 ? validIds : allIds);
            } catch {
              selectedIds = allIds;
            }
          }
          // 無論來源是 localStorage 還是預設值，都寫入 DB
          // 確保下次在其他裝置/瀏覽器登入時能從 DB 讀取
          flushDbUpdate(selectedIds);
        }
      }

      setSelectedStationIdsState(selectedIds);
      setInitializedKey(currentKey);
    };

    loadPreferences();
  }, [stations, storageKey, userProfile?.id, initializedKey, flushDbUpdate]);

  const setSelectedStationIds = useCallback((ids: string[]) => {
    setSelectedStationIdsState(ids);

    // 即時保存到 localStorage
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    }

    // DB 寫入延遲：快速勾選多個居住區時只發一次請求
    if (!userProfile?.id) return;

    pendingIdsRef.current = ids;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const pending = pendingIdsRef.current;
      pendingIdsRef.current = null;
      if (pending !== null) {
        flushDbUpdate(pending);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [storageKey, userProfile?.id, flushDbUpdate]);

  // 登出或切換用戶前，把尚未寫入 DB 的偏好 flush
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const pending = pendingIdsRef.current;
      pendingIdsRef.current = null;
      if (pending !== null) {
        flushDbUpdate(pending);
      }
    };
  }, [flushDbUpdate]);

  const isFiltered = useMemo(() => {
    if (!initializedKey || !stations.length) return false;
    return selectedStationIds.length !== stations.length;
  }, [selectedStationIds, stations, initializedKey]);

  return (
    <StationFilterContext.Provider value={{ selectedStationIds, setSelectedStationIds, isFiltered }}>
      {children}
    </StationFilterContext.Provider>
  );
};

export const useStationFilter = () => {
  const context = useContext(StationFilterContext);
  if (!context) throw new Error('useStationFilter must be used within StationFilterProvider');
  return context;
};
