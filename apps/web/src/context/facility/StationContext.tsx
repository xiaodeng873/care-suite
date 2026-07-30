/**
 * SeniorCareontext - 居住區與床位管理
 * 
 * 此 Context 負責管理居住區（Station）和床位（Bed）相關的狀態和操作。
 * 從 PatientContext 中拆分出來，以提高性能和可維護性。
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as db from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthContext';
import type { BedTransferType } from '../../lib/database';
import { buildActorForLog } from '../../utils/bedTransferUtils';
import { buildBedTransferLogEntry, generateGroupId } from '../../utils/bedTransferLogUtils';

// 為了避免 supabase-js 的 select 字符串類型解析器對新欄位（original_bed_id, bed_transfer_type 等）報錯，
// 在 StationContext 內部查詢時使用鬆散類型。
const rawSupabase = supabase as any;

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
  assignPatientToBed: (patientId: number, bedId: string, transferType?: BedTransferType, opts?: { originalBedId?: string }) => Promise<void>;
  swapPatientBeds: (patientId1: number, patientId2: number, transferType?: BedTransferType) => Promise<void>;
  changeOriginalBed: (patientId: number, newOriginalBedId: string) => Promise<void>;
  endTemporaryTransfer: (patientId: number) => Promise<void>;
  cancelTemporaryTransfer: (patientId: number) => Promise<{ success: boolean; reason?: string }>;
  cancelTemporarySwapPair: (patientId1: number, patientId2: number) => Promise<{ success: boolean; reason?: string }>;
  moveBedToStation: (bedId: string, newStationId: string) => Promise<void>;
  getBedTransferLog: (patientId: number) => Promise<db.BedTransferLogEntry[]>;
  getBedTransferLogByBedId: (bedId: string) => Promise<db.BedTransferLogEntry[]>;
  createBedTransferLogEntry: (entry: Omit<db.BedTransferLogEntry, 'id' | 'created_at'>) => Promise<void>;
  
  // 刷新數據
  refreshStationData: () => Promise<void>;
}

const SeniorCareontext = createContext<SeniorCareontextType | undefined>(undefined);

interface StationProviderProps {
  children: ReactNode;
}

export const StationProvider: React.FC<StationProviderProps> = ({ children }) => {
  const { isAuthenticated, user, userProfile } = useAuth();
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
  const actor = buildActorForLog(user, userProfile);

  const logTransfer = useCallback(async (payload: {
    patientId: number;
    patientName?: string | null;
    actionType: db.BedTransferActionType;
    fromBedId?: string | null;
    toBedId?: string | null;
    fromBedNumber?: string | null;
    toBedNumber?: string | null;
    transferSubtype?: string | null;
    notes?: string | null;
    groupId?: string | null;
  }) => {
    try {
      const entry = buildBedTransferLogEntry({
        patientId: payload.patientId,
        patientName: payload.patientName,
        actionType: payload.actionType,
        fromBedId: payload.fromBedId,
        toBedId: payload.toBedId,
        fromBedNumber: payload.fromBedNumber,
        toBedNumber: payload.toBedNumber,
        transferSubtype: payload.transferSubtype,
        notes: payload.notes,
        groupId: payload.groupId,
        actor,
      });
      await db.createBedTransferLogEntry(entry);
    } catch (err) {
      console.error('寫入床位調動日誌失敗:', err);
    }
  }, [actor]);

  const assignPatientToBed = useCallback(async (
    patientId: number,
    bedId: string,
    transferType: BedTransferType = 'routine',
    opts?: { originalBedId?: string }
  ) => {
    try {
      const { data: patient } = await rawSupabase
        .from('院友主表')
        .select('院友id, 中文姓名, bed_id, 床號, bed_transfer_type')
        .eq('院友id', patientId)
        .single();

      const { data: bed } = await rawSupabase
        .from('beds')
        .select('id, bed_number')
        .eq('id', bedId)
        .single();

      await db.assignPatientToBed(patientId, bedId, transferType, opts);
      await refreshStationData();

      const actionType: db.BedTransferActionType = transferType === 'temporary' ? 'temporary_transfer' : 'routine_transfer';
      await logTransfer({
        patientId,
        patientName: patient?.中文姓名 || null,
        actionType,
        fromBedId: patient?.bed_id || null,
        toBedId: bed?.id || null,
        fromBedNumber: patient?.床號 || null,
        toBedNumber: bed?.bed_number || null,
      });
    } catch (error) {
      console.error('Error assigning patient to bed:', error);
      throw error;
    }
  }, [refreshStationData, logTransfer]);

  const swapPatientBeds = useCallback(async (
    patientId1: number,
    patientId2: number,
    transferType: BedTransferType = 'routine'
  ) => {
    try {
      const { data: patients } = await rawSupabase
        .from('院友主表')
        .select('院友id, 中文姓名, bed_id, 床號, original_bed_id, original_station_id, bed_transfer_type')
        .in('院友id', [patientId1, patientId2]);
      const p1 = patients?.find((p: any) => p.院友id === patientId1);
      const p2 = patients?.find((p: any) => p.院友id === patientId2);

      const { data: beds } = await rawSupabase
        .from('beds')
        .select('id, bed_number')
        .in('id', [p1?.bed_id, p2?.bed_id].filter(Boolean) as string[]);
      const bed1 = beds?.find((b: any) => b.id === p1?.bed_id);
      const bed2 = beds?.find((b: any) => b.id === p2?.bed_id);

      await db.swapPatientBeds(patientId1, patientId2, transferType);
      await refreshStationData();

      const groupId = generateGroupId();
      await logTransfer({
        patientId: patientId1,
        patientName: p1?.中文姓名 || null,
        actionType: 'swap',
        fromBedId: bed1?.id || null,
        toBedId: bed2?.id || null,
        fromBedNumber: bed1?.bed_number || null,
        toBedNumber: bed2?.bed_number || null,
        groupId,
      });
      await logTransfer({
        patientId: patientId2,
        patientName: p2?.中文姓名 || null,
        actionType: 'swap',
        fromBedId: bed2?.id || null,
        toBedId: bed1?.id || null,
        fromBedNumber: bed2?.bed_number || null,
        toBedNumber: bed1?.bed_number || null,
        groupId,
      });
    } catch (error) {
      console.error('Error swapping patient beds:', error);
      throw error;
    }
  }, [refreshStationData, logTransfer]);

  const changeOriginalBed = useCallback(async (patientId: number, newOriginalBedId: string) => {
    try {
      const { data: patient } = await rawSupabase
        .from('院友主表')
        .select('院友id, 中文姓名, original_bed_id, 床號')
        .eq('院友id', patientId)
        .single();
      const { data: oldBed } = await rawSupabase
        .from('beds')
        .select('id, bed_number')
        .eq('id', patient?.original_bed_id || '')
        .maybeSingle();
      const { data: newBed } = await rawSupabase
        .from('beds')
        .select('id, bed_number')
        .eq('id', newOriginalBedId)
        .single();

      await db.changeOriginalBed(patientId, newOriginalBedId);
      await refreshStationData();

      await logTransfer({
        patientId,
        patientName: patient?.中文姓名 || null,
        actionType: 'original_bed_change',
        fromBedId: oldBed?.id || null,
        toBedId: newBed?.id || null,
        fromBedNumber: oldBed?.bed_number || null,
        toBedNumber: newBed?.bed_number || null,
      });
    } catch (error) {
      console.error('Error changing original bed:', error);
      throw error;
    }
  }, [refreshStationData, logTransfer]);

  const endTemporaryTransfer = useCallback(async (patientId: number) => {
    try {
      const { data: patient } = await rawSupabase
        .from('院友主表')
        .select('院友id, 中文姓名, bed_id, 床號, original_bed_id')
        .eq('院友id', patientId)
        .single();
      const { data: oldBed } = await rawSupabase
        .from('beds')
        .select('id, bed_number')
        .eq('id', patient?.bed_id || '')
        .maybeSingle();
      const { data: rootBed } = await rawSupabase
        .from('beds')
        .select('id, bed_number')
        .eq('id', patient?.original_bed_id || '')
        .maybeSingle();

      await db.endTemporaryTransfer(patientId);
      await refreshStationData();

      await logTransfer({
        patientId,
        patientName: patient?.中文姓名 || null,
        actionType: 'return',
        fromBedId: oldBed?.id || null,
        toBedId: rootBed?.id || null,
        fromBedNumber: oldBed?.bed_number || null,
        toBedNumber: rootBed?.bed_number || null,
      });
    } catch (error) {
      console.error('Error ending temporary transfer:', error);
      throw error;
    }
  }, [refreshStationData, logTransfer]);

  const cancelTemporaryTransfer = useCallback(async (patientId: number) => {
    try {
      const result = await db.cancelTemporaryTransfer(patientId, actor);
      await refreshStationData();
      return result;
    } catch (error) {
      console.error('Error cancelling temporary transfer:', error);
      throw error;
    }
  }, [refreshStationData, actor]);

  const cancelTemporarySwapPair = useCallback(async (patientId1: number, patientId2: number) => {
    try {
      const result = await db.cancelTemporarySwapPair(patientId1, patientId2, actor);
      await refreshStationData();
      return result;
    } catch (error) {
      console.error('Error cancelling temporary swap pair:', error);
      throw error;
    }
  }, [refreshStationData, actor]);

  const getBedTransferLog = useCallback(async (patientId: number) => {
    return db.getBedTransferLog(patientId);
  }, []);

  const getBedTransferLogByBedId = useCallback(async (bedId: string) => {
    return db.getBedTransferLogByBedId(bedId);
  }, []);

  const createBedTransferLogEntry = useCallback(async (entry: Omit<db.BedTransferLogEntry, 'id' | 'created_at'>) => {
    await db.createBedTransferLogEntry(entry);
  }, []);

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
    changeOriginalBed,
    endTemporaryTransfer,
    cancelTemporaryTransfer,
    cancelTemporarySwapPair,
    moveBedToStation,
    getBedTransferLog,
    getBedTransferLogByBedId,
    createBedTransferLogEntry,
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
