import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useStation } from './facility';
import { supabase } from '../lib/supabase';

interface StationFilterContextType {
  selectedStationIds: string[];
  setSelectedStationIds: (ids: string[]) => void;
  isFiltered: boolean;
}

const StationFilterContext = createContext<StationFilterContextType | undefined>(undefined);

export const StationFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const { stations } = useStation();

  const storageKey = userProfile?.id ? `stationFilter_${userProfile.id}` : null;

  const [selectedStationIds, setSelectedStationIdsState] = useState<string[]>([]);
  const [initializedKey, setInitializedKey] = useState<string | null>(null);

  // 初始化：從資料庫或 localStorage 讀取
  useEffect(() => {
    if (!stations.length) return;
    const currentKey = storageKey ?? '__no_user__';
    if (initializedKey === currentKey) return;

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
          // 資料庫有資料：用資料庫值，新增的居住區自動納入
          const validIds = dbIds.filter(id => allIds.includes(id));
          const newStationIds = allIds.filter(id => !dbIds!.includes(id));
          selectedIds = validIds.length > 0 ? [...validIds, ...newStationIds] : allIds;
        } else {
          // 資料庫無資料（null）：嘗試從 localStorage 遷移
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as string[];
              const validIds = parsed.filter(id => allIds.includes(id));
              const newStationIds = allIds.filter(id => !parsed.includes(id));
              selectedIds = validIds.length > 0 ? [...validIds, ...newStationIds] : allIds;
              // 遷移：將 localStorage 資料寫入資料庫，下次登入直接用資料庫
              supabase
                .from('user_profiles')
                .update({ preferred_station_ids: selectedIds })
                .eq('id', userProfile.id)
                .then(() => {});
            } catch {
              selectedIds = allIds;
            }
          }
        }
      }

      setSelectedStationIdsState(selectedIds);
      setInitializedKey(currentKey);
    };

    loadPreferences();
  }, [stations, storageKey, userProfile?.id, initializedKey]);

  const setSelectedStationIds = useCallback(async (ids: string[]) => {
    setSelectedStationIdsState(ids);
    
    // 同時保存到 localStorage 和資料庫
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    }

    if (userProfile?.id) {
      try {
        await supabase
          .from('user_profiles')
          .update({ preferred_station_ids: ids })
          .eq('id', userProfile.id);
      } catch (error) {
        console.warn('無法保存居住區偏好設定:', error);
      }
    }
  }, [storageKey, userProfile?.id]);

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
