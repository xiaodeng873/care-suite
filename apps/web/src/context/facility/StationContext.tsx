/**
 * SeniorCareontext - 居住區與床位管理
 * 
 * 此 Context 負責管理居住區（Station）和床位（Bed）相關的狀態和操作。
 * 從 PatientContext 中拆分出來，以提高性能和可維護性。
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// Re-export types for convenience
export type { Station, Room, Bed } from '../../lib/database';

interface SeniorCareontextType {
  // 狀態
  stations: db.Station[];
  rooms: db.Room[];
  beds: db.Bed[];
  loading: boolean;
  
  // 居住區操作
  addStation: (station: Omit<db.Station, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateStation: (station: db.Station) => Promise<void>;
  deleteStation: (id: string) => Promise<void>;
  
  // 房間操作
  addRoom: (room: Omit<db.Room, 'id' | 'created_at' | 'updated_at'>) => Promise<db.Room>;
  updateRoom: (room: Pick<db.Room, 'id'> & Partial<db.Room>) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  
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

const SeniorCareontext = createContext<SeniorCareontextType | undefined>(undefined);

interface StationProviderProps {
  children: ReactNode;
}

export const StationProvider: React.FC<StationProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [stations, setStations] = useState<db.Station[]>([]);
  const [rooms, setRooms] = useState<db.Room[]>([]);
  const [beds, setBeds] = useState<db.Bed[]>([]);
  const [loading, setLoading] = useState(true);

  // 載入居住區和床位數據
  const refreshStationData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    try {
      const [stationsData, roomsData, bedsData] = await Promise.all([
        db.getStations(),
        db.getRooms(),
        db.getBeds()
      ]);
      setStations(stationsData);
      setRooms(roomsData);
      setBeds(bedsData);
    } catch (error) {
      console.error('Error fetching station data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // 初始載入
  useEffect(() => {
    refreshStationData();
  }, [refreshStationData]);

  // 居住區 CRUD 操作
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
      // 代號變更會經由觸發器級聯更新該站床位的合成 bed_number，刷新床位以取得最新值
      if (station.code !== undefined) {
        const bedsData = await db.getBeds();
        setBeds(bedsData);
      }
    } catch (error) {
      console.error('Error updating station:', error);
      throw error;
    }
  }, []);

  const deleteStation = useCallback(async (id: string) => {
    try {
      await db.deleteStation(id);
      setStations(prev => prev.filter(s => s.id !== id));
      // 同時刪除該居住區下的所有房間與床位
      setRooms(prev => prev.filter(r => r.station_id !== id));
      setBeds(prev => prev.filter(b => b.station_id !== id));
    } catch (error) {
      console.error('Error deleting station:', error);
      throw error;
    }
  }, []);

  // 房間 CRUD 操作
  const addRoom = useCallback(async (room: Omit<db.Room, 'id' | 'created_at' | 'updated_at'>) => {
    const newRoom = await db.createRoom(room);
    setRooms(prev => [...prev, newRoom]);
    return newRoom;
  }, []);

  const updateRoom = useCallback(async (room: Pick<db.Room, 'id'> & Partial<db.Room>) => {
    const updatedRoom = await db.updateRoom(room);
    setRooms(prev => prev.map(r => r.id === room.id ? updatedRoom : r));
    // 房號變更會經由觸發器級聯更新床位合成 bed_number，刷新床位以取得最新值
    if (room.room_number !== undefined) {
      const bedsData = await db.getBeds();
      setBeds(bedsData);
    }
  }, []);

  const deleteRoom = useCallback(async (id: string) => {
    await db.deleteRoom(id);
    setRooms(prev => prev.filter(r => r.id !== id));
    setBeds(prev => prev.filter(b => b.room_id !== id));
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
      await refreshStationData();
    } catch (error) {
      console.error('Error assigning patient to bed:', error);
      throw error;
    }
  }, [refreshStationData]);

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
      await refreshStationData();
    } catch (error) {
      console.error('Error moving bed to station:', error);
      throw error;
    }
  }, [refreshStationData]);

  const value: SeniorCareontextType = {
    stations,
    rooms,
    beds,
    loading,
    addStation,
    updateStation,
    deleteStation,
    addRoom,
    updateRoom,
    deleteRoom,
    addBed,
    updateBed,
    deleteBed,
    assignPatientToBed,
    swapPatientBeds,
    moveBedToStation,
    refreshStationData,
  };

  return (
    <SeniorCareontext.Provider value={value}>
      {children}
    </SeniorCareontext.Provider>
  );
};

/**
 * useStation hook - 使用居住區和床位管理功能
 * 
 * @example
 * ```tsx
 * const { stations, beds, addStation, addBed } = useStation();
 * ```
 */
export const useStation = (): SeniorCareontextType => {
  const context = useContext(SeniorCareontext);
  if (!context) {
    throw new Error('useStation must be used within a StationProvider');
  }
  return context;
};

/**
 * useStationData hook - 只獲取居住區數據（用於只需要讀取的組件）
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

export default SeniorCareontext;
