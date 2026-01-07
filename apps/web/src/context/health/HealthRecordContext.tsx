/**
 * HealthRecordContext - 健康記錄管理 Context
 * 
 * 從 PatientContext 拆分出來，專門處理健康記錄相關功能：
 * - 健康記錄 CRUD (healthRecords)
 * - 回收筒管理 (deletedHealthRecords)
 * - 重複記錄處理
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

interface HealthRecordContextType {
  // 狀態
  healthRecords: db.HealthRecord[];
  deletedHealthRecords: db.DeletedHealthRecord[];
  isAllHealthRecordsLoaded: boolean;
  loading: boolean;
  
  // 健康記錄 CRUD
  addHealthRecord: (record: Omit<db.HealthRecord, '記錄id'>) => Promise<db.HealthRecord>;
  updateHealthRecord: (record: db.HealthRecord) => Promise<void>;
  deleteHealthRecord: (id: number) => Promise<void>;
  
  // 回收筒管理
  fetchDeletedHealthRecords: () => Promise<void>;
  restoreHealthRecord: (deletedRecordId: string) => Promise<void>;
  permanentlyDeleteHealthRecord: (deletedRecordId: string) => Promise<void>;
  
  // 重複記錄處理
  findDuplicateHealthRecords: () => Promise<db.DuplicateRecordGroup[]>;
  batchDeleteDuplicateRecords: (duplicateRecordIds: number[], deletedBy?: string) => Promise<void>;
  
  // 載入完整記錄
  loadFullHealthRecords: () => Promise<void>;
  
  // 刷新數據
  refreshHealthRecordData: () => Promise<void>;
}

// 只讀數據 Hook 的類型
interface HealthRecordDataType {
  healthRecords: db.HealthRecord[];
  deletedHealthRecords: db.DeletedHealthRecord[];
  isAllHealthRecordsLoaded: boolean;
  loading: boolean;
}

// ========== Context 創建 ==========
const HealthRecordContext = createContext<HealthRecordContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface HealthRecordProviderProps {
  children: ReactNode;
}

export function HealthRecordProvider({ children }: HealthRecordProviderProps) {
  const { isAuthenticated } = useAuth();
  // 狀態定義
  const [healthRecords, setHealthRecords] = useState<db.HealthRecord[]>([]);
  const [deletedHealthRecords, setDeletedHealthRecords] = useState<db.DeletedHealthRecord[]>([]);
  const [isAllHealthRecordsLoaded, setIsAllHealthRecordsLoaded] = useState(false);
  const isAllHealthRecordsLoadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  
  // ========== 刷新數據 ==========
  const refreshHealthRecordData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    try {
      const healthRecordsData = await db.getHealthRecords();
      setHealthRecords(healthRecordsData || []);
    } catch (error) {
      console.error('Error refreshing health record data:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);
  
  // ========== 載入完整記錄 ==========
  const loadFullHealthRecords = useCallback(async () => {
    if (isAllHealthRecordsLoadedRef.current) return;
    setLoading(true);
    try {
      const allRecords = await db.getHealthRecords();
      setHealthRecords(allRecords);
      setIsAllHealthRecordsLoaded(true);
      isAllHealthRecordsLoadedRef.current = true;
    } catch (error) {
      console.error('載入完整記錄失敗:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // ========== 健康記錄 CRUD ==========
  const addHealthRecord = useCallback(async (record: Omit<db.HealthRecord, '記錄id'>): Promise<db.HealthRecord> => {
    try {
      const newRecord = await db.createHealthRecord(record);
      setHealthRecords(prev => [newRecord, ...prev]);
      return newRecord;
    } catch (error) {
      console.error('Error adding health record:', error);
      throw error;
    }
  }, []);
  
  const updateHealthRecord = useCallback(async (record: db.HealthRecord): Promise<void> => {
    try {
      await db.updateHealthRecord(record);
      setHealthRecords(prev => prev.map(r => r.記錄id === record.記錄id ? record : r));
    } catch (error) {
      console.error('Error updating health record:', error);
      throw error;
    }
  }, []);
  
  const deleteHealthRecord = useCallback(async (id: number): Promise<void> => {
    try {
      await db.deleteHealthRecord(id);
      setHealthRecords(prev => prev.filter(r => r.記錄id !== id));
    } catch (error) {
      console.error('Error deleting health record:', error);
      throw error;
    }
  }, []);
  
  // ========== 回收筒管理 ==========
  const fetchDeletedHealthRecords = useCallback(async (): Promise<void> => {
    try {
      const records = await db.getDeletedHealthRecords();
      setDeletedHealthRecords(records);
    } catch (error) {
      console.warn('回收筒暫時不可用:', error);
      setDeletedHealthRecords([]);
    }
  }, []);
  
  const restoreHealthRecord = useCallback(async (deletedRecordId: string): Promise<void> => {
    try {
      await db.restoreHealthRecordFromRecycleBin(deletedRecordId);
      await fetchDeletedHealthRecords();
      await refreshHealthRecordData();
    } catch (error) {
      console.error('Error restoring health record:', error);
      throw error;
    }
  }, [fetchDeletedHealthRecords, refreshHealthRecordData]);
  
  const permanentlyDeleteHealthRecord = useCallback(async (deletedRecordId: string): Promise<void> => {
    try {
      await db.permanentlyDeleteHealthRecord(deletedRecordId);
      await fetchDeletedHealthRecords();
    } catch (error) {
      console.error('Error permanently deleting health record:', error);
      throw error;
    }
  }, [fetchDeletedHealthRecords]);
  
  // ========== 重複記錄處理 ==========
  const findDuplicateHealthRecords = useCallback(async (): Promise<db.DuplicateRecordGroup[]> => {
    try {
      return await db.findDuplicateHealthRecords();
    } catch (error) {
      console.error('Error finding duplicate health records:', error);
      throw error;
    }
  }, []);
  
  const batchDeleteDuplicateRecords = useCallback(async (duplicateRecordIds: number[], deletedBy?: string): Promise<void> => {
    try {
      await db.batchMoveDuplicatesToRecycleBin(duplicateRecordIds, deletedBy);
      await refreshHealthRecordData();
    } catch (error) {
      console.error('Error batch deleting duplicate records:', error);
      throw error;
    }
  }, [refreshHealthRecordData]);
  
  // 自動刷新資料（延遲 300ms，讓關鍵數據優先載入）
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshHealthRecordData();
    }, 300);
    return () => clearTimeout(timer);
  }, [refreshHealthRecordData]);
  
  // Context 值
  const value: HealthRecordContextType = {
    // 狀態
    healthRecords,
    deletedHealthRecords,
    isAllHealthRecordsLoaded,
    loading,
    
    // 健康記錄 CRUD
    addHealthRecord,
    updateHealthRecord,
    deleteHealthRecord,
    
    // 回收筒管理
    fetchDeletedHealthRecords,
    restoreHealthRecord,
    permanentlyDeleteHealthRecord,
    
    // 重複記錄處理
    findDuplicateHealthRecords,
    batchDeleteDuplicateRecords,
    
    // 載入完整記錄
    loadFullHealthRecords,
    
    // 刷新
    refreshHealthRecordData,
  };
  
  return (
    <HealthRecordContext.Provider value={value}>
      {children}
    </HealthRecordContext.Provider>
  );
}

// ========== Hooks ==========
/**
 * 完整的健康記錄 Context（包含 CRUD 操作）
 */
export function useHealthRecord(): HealthRecordContextType {
  const context = useContext(HealthRecordContext);
  if (context === undefined) {
    throw new Error('useHealthRecord must be used within a HealthRecordProvider');
  }
  return context;
}

/**
 * 只讀數據 Hook - 用於只需要讀取數據的組件
 */
export function useHealthRecordData(): HealthRecordDataType {
  const { healthRecords, deletedHealthRecords, isAllHealthRecordsLoaded, loading } = useHealthRecord();
  return { healthRecords, deletedHealthRecords, isAllHealthRecordsLoaded, loading };
}

export default HealthRecordContext;
