import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useStation } from './facility';

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
  // 用 initializedKey 取代 boolean，確保 userProfile 後加載時能重讀對應 localStorage
  const [initializedKey, setInitializedKey] = useState<string | null>(null);

  // 初始化：從 localStorage 讀取，fallback 全選
  useEffect(() => {
    if (!stations.length) return;
    const currentKey = storageKey ?? '__no_user__';
    if (initializedKey === currentKey) return; // 已用此 key 初始化過，跳過

    const allIds = stations.map(s => s.id);

    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as string[];
          // 過濾掉已不存在的居住區
          const validIds = parsed.filter(id => allIds.includes(id));
          // 若有新增的居住區（不在已儲存清單中），自動納入選擇
          const newStationIds = allIds.filter(id => !parsed.includes(id));
          const mergedIds = [...validIds, ...newStationIds];
          setSelectedStationIdsState(mergedIds.length > 0 ? mergedIds : allIds);
        } catch {
          setSelectedStationIdsState(allIds);
        }
      } else {
        setSelectedStationIdsState(allIds);
      }
    } else {
      setSelectedStationIdsState(allIds);
    }
    setInitializedKey(currentKey);
  }, [stations, storageKey, initializedKey]);

  const setSelectedStationIds = useCallback((ids: string[]) => {
    setSelectedStationIdsState(ids);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    }
  }, [storageKey]);

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
