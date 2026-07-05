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
  const [initialized, setInitialized] = useState(false);

  // 初始化：從 localStorage 讀取，fallback 全選
  useEffect(() => {
    if (!stations.length) return;
    if (initialized) return;

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
    setInitialized(true);
  }, [stations, storageKey, initialized]);

  const setSelectedStationIds = useCallback((ids: string[]) => {
    setSelectedStationIdsState(ids);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    }
  }, [storageKey]);

  const isFiltered = useMemo(() => {
    if (!initialized || !stations.length) return false;
    return selectedStationIds.length !== stations.length;
  }, [selectedStationIds, stations, initialized]);

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
