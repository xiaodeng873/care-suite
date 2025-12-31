/**
 * StationContext - 站點與床位管理
 * 
 * 此 Context 負責管理站點（Station）和床位（Bed）相關的狀態和操作。
 * 從 PatientContext 中拆分出來，以提高性能和可維護性。
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as db from '../../lib/database';

// Re-export types for convenience
export type { Station, Bed } from '../../lib/database';

interface StationContextType {
  // 狀態
  stations: db.Station[];
  beds: db.Bed[];
  loading: boolean;
  
  // 站點操作
  addStation: (station: Omit<db.Station, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateStation: (station: db.Station) => Promise<void>;
  deleteStation: (id: string) => Promise<void>;
  
  // 床位操作
  addBed: (bed: Omit<db.Bed, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateBed: (bed: db.Bed) => Promise<void>;
  deleteBed: (id: string) => Promise<void>;
  
  // 床位分配操作
  assignPatientToBed: (patientId: number, bedId: string) => Promise<void>;
  swapPatientBeds: (patientId1: number, patientId2: number) => Promise<void>;
  moveBedToStation: (bedId: string, newStationId: string) => Promise<void>;
  
  // 刷新數據
  refreshStationData: () => Promise<void>;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

interface StationProviderProps {
  children: ReactNode;
}

export const StationProvider: React.FC<StationProviderProps> = ({ children }) => {
  const [stations, setStations] = useState<db.Station[]>([]);
  const [beds, setBeds] = useState<db.Bed[]>([]);
  const [loading, setLoading] = useState(true);

  // 載入站點和床位數據
  const refreshStationData = useCallback(async () => {
    setLoading(true);
    try {
      const [stationsData, bedsData] = await Promise.all([
        db.getStations(),
        db.getBeds()
      ]);
      setStations(stationsData);
      setBeds(bedsData);
    } catch (error) {
      console.error('Error fetching station data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    refreshStationData();
  }, [refreshStationData]);

  // 站點 CRUD 操作
  const addStation = useCallback(async (station: Omit<db.Station, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const newStation = await db.createStation(station);
      setStations(prev => [...prev, newStation]);
    } catch (error) {
      console.error('Error adding station:', error);
      throw error;
    }
  }, []);

  const updateStation = useCallback(async (station: db.Station) => {
    try {
      const updatedStation = await db.updateStation(station);
      setStations(prev => prev.map(s => s.id === station.id ? updatedStation : s));
    } catch (error) {
      console.error('Error updating station:', error);
      throw error;
    }
  }, []);

  const deleteStation = useCallback(async (id: string) => {
    try {
      await db.deleteStation(id);
      setStations(prev => prev.filter(s => s.id !== id));
      // 同時刪除該站點下的所有床位
      setBeds(prev => prev.filter(b => b.station_id !== id));
    } catch (error) {
      console.error('Error deleting station:', error);
      throw error;
    }
  }, []);

  // 床位 CRUD 操作
  const addBed = useCallback(async (bed: Omit<db.Bed, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const newBed = await db.createBed(bed);
      setBeds(prev => [...prev, newBed]);
    } catch (error) {
      console.error('Error adding bed:', error);
      throw error;
    }
  }, []);

  const updateBed = useCallback(async (bed: db.Bed) => {
    try {
      const updatedBed = await db.updateBed(bed);
      setBeds(prev => prev.map(b => b.id === bed.id ? updatedBed : b));
    } catch (error) {
      console.error('Error updating bed:', error);
      throw error;
    }
  }, []);

  const deleteBed = useCallback(async (id: string) => {
    try {
      await db.deleteBed(id);
      setBeds(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting bed:', error);
      throw error;
    }
  }, []);

  // 床位分配操作
  const assignPatientToBed = useCallback(async (patientId: number, bedId: string) => {
    try {
      await db.assignPatientToBed(patientId, bedId);
      // 更新床位佔用狀態
      setBeds(prev => prev.map(b => 
        b.id === bedId ? { ...b, is_occupied: true } : b
      ));
    } catch (error) {
      console.error('Error assigning patient to bed:', error);
      throw error;
    }
  }, []);

  const swapPatientBeds = useCallback(async (patientId1: number, patientId2: number) => {
    try {
      await db.swapPatientBeds(patientId1, patientId2);
      // 刷新床位數據以獲取最新狀態
      await refreshStationData();
    } catch (error) {
      console.error('Error swapping patient beds:', error);
      throw error;
    }
  }, [refreshStationData]);

  const moveBedToStation = useCallback(async (bedId: string, newStationId: string) => {
    try {
      await db.moveBedToStation(bedId, newStationId);
      setBeds(prev => prev.map(b => 
        b.id === bedId ? { ...b, station_id: newStationId } : b
      ));
    } catch (error) {
      console.error('Error moving bed to station:', error);
      throw error;
    }
  }, []);

  const value: StationContextType = {
    stations,
    beds,
    loading,
    addStation,
    updateStation,
    deleteStation,
    addBed,
    updateBed,
    deleteBed,
    assignPatientToBed,
    swapPatientBeds,
    moveBedToStation,
    refreshStationData,
  };

  return (
    <StationContext.Provider value={value}>
      {children}
    </StationContext.Provider>
  );
};

/**
 * useStation hook - 使用站點和床位管理功能
 * 
 * @example
 * ```tsx
 * const { stations, beds, addStation, addBed } = useStation();
 * ```
 */
export const useStation = (): StationContextType => {
  const context = useContext(StationContext);
  if (!context) {
    throw new Error('useStation must be used within a StationProvider');
  }
  return context;
};

/**
 * useStationData hook - 只獲取站點數據（用於只需要讀取的組件）
 * 
 * @example
 * ```tsx
 * const { stations, beds, loading } = useStationData();
 * ```
 */
export const useStationData = () => {
  const { stations, beds, loading } = useStation();
  return { stations, beds, loading };
};

export default StationContext;
