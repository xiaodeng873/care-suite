/**
 * CareRecordsContext - 護理記錄管理 Context
 * 
 * 從 PatientContext 拆分出來，專門處理日常護理記錄：
 * - 院友備忘 (PatientNote)
 * - 巡查記錄 (PatrolRound)
 * - 尿片更換記錄 (DiaperChangeRecord)
 * - 約束觀察記錄 (RestraintObservationRecord)
 * - 體位轉換記錄 (PositionChangeRecord)
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// ========== 類型定義 ==========
interface CareRecordsContextType {
  // 狀態
  patientNotes: db.PatientNote[];
  patrolRounds: db.PatrolRound[];
  diaperChangeRecords: db.DiaperChangeRecord[];
  restraintObservationRecords: db.RestraintObservationRecord[];
  positionChangeRecords: db.PositionChangeRecord[];
  loading: boolean;
  
  // 院友備忘 CRUD
  addPatientNote: (note: Omit<db.PatientNote, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientNote: (note: db.PatientNote) => Promise<void>;
  deletePatientNote: (id: string) => Promise<void>;
  completePatientNote: (id: string) => Promise<void>;
  
  // 巡查記錄 CRUD
  createPatrolRound: (round: Omit<db.PatrolRound, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  deletePatrolRound: (id: string) => Promise<void>;
  
  // 尿片更換記錄 CRUD
  createDiaperChangeRecord: (record: Omit<db.DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDiaperChangeRecord: (record: db.DiaperChangeRecord) => Promise<void>;
  deleteDiaperChangeRecord: (id: string) => Promise<void>;
  
  // 約束觀察記錄 CRUD
  createRestraintObservationRecord: (record: Omit<db.RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateRestraintObservationRecord: (record: db.RestraintObservationRecord) => Promise<void>;
  deleteRestraintObservationRecord: (id: string) => Promise<void>;
  
  // 體位轉換記錄 CRUD
  createPositionChangeRecord: (record: Omit<db.PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  deletePositionChangeRecord: (id: string) => Promise<void>;
  
  // 刷新數據
  refreshCareRecordsData: () => Promise<void>;
}

// 只讀數據 Hook 的類型
interface CareRecordsDataType {
  patientNotes: db.PatientNote[];
  patrolRounds: db.PatrolRound[];
  diaperChangeRecords: db.DiaperChangeRecord[];
  restraintObservationRecords: db.RestraintObservationRecord[];
  positionChangeRecords: db.PositionChangeRecord[];
  loading: boolean;
}

// ========== Context 創建 ==========
const CareRecordsContext = createContext<CareRecordsContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface CareRecordsProviderProps {
  children: ReactNode;
}

export function CareRecordsProvider({ children }: CareRecordsProviderProps) {
  const { user } = useAuth();
  
  // 狀態定義
  const [patientNotes, setPatientNotes] = useState<db.PatientNote[]>([]);
  const [patrolRounds, setPatrolRounds] = useState<db.PatrolRound[]>([]);
  const [diaperChangeRecords, setDiaperChangeRecords] = useState<db.DiaperChangeRecord[]>([]);
  const [restraintObservationRecords, setRestraintObservationRecords] = useState<db.RestraintObservationRecord[]>([]);
  const [positionChangeRecords, setPositionChangeRecords] = useState<db.PositionChangeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ========== 刷新數據 ==========
  const refreshCareRecordsData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [
        notesData,
        patrolRoundsData,
        diaperChangeRecordsData,
        restraintObservationRecordsData,
        positionChangeRecordsData,
      ] = await Promise.all([
        db.getPatientNotes(),
        db.getPatrolRounds(),
        db.getDiaperChangeRecords(),
        db.getRestraintObservationRecords(),
        db.getPositionChangeRecords(),
      ]);
      
      setPatientNotes(notesData || []);
      setPatrolRounds(patrolRoundsData || []);
      setDiaperChangeRecords(diaperChangeRecordsData || []);
      setRestraintObservationRecords(restraintObservationRecordsData || []);
      setPositionChangeRecords(positionChangeRecordsData || []);
    } catch (error) {
      console.error('Error refreshing care records data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // ========== 院友備忘 CRUD ==========
  const addPatientNote = useCallback(async (note: Omit<db.PatientNote, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createPatientNote(note);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error adding patient note:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  const updatePatientNote = useCallback(async (note: db.PatientNote) => {
    try {
      await db.updatePatientNote(note);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error updating patient note:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  const deletePatientNote = useCallback(async (id: string) => {
    try {
      await db.deletePatientNote(id);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error deleting patient note:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  const completePatientNote = useCallback(async (id: string) => {
    try {
      await db.completePatientNote(id);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error completing patient note:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  // ========== 巡查記錄 CRUD ==========
  const createPatrolRound = useCallback(async (round: Omit<db.PatrolRound, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createPatrolRound(round);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error creating patrol round:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  const deletePatrolRound = useCallback(async (id: string) => {
    try {
      await db.deletePatrolRound(id);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error deleting patrol round:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  // ========== 尿片更換記錄 CRUD ==========
  const createDiaperChangeRecord = useCallback(async (record: Omit<db.DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createDiaperChangeRecord(record);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error creating diaper change record:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  const updateDiaperChangeRecord = useCallback(async (record: db.DiaperChangeRecord) => {
    try {
      await db.updateDiaperChangeRecord(record);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error updating diaper change record:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  const deleteDiaperChangeRecord = useCallback(async (id: string) => {
    try {
      await db.deleteDiaperChangeRecord(id);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error deleting diaper change record:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  // ========== 約束觀察記錄 CRUD ==========
  const createRestraintObservationRecord = useCallback(async (record: Omit<db.RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createRestraintObservationRecord(record);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error creating restraint observation record:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  const updateRestraintObservationRecord = useCallback(async (record: db.RestraintObservationRecord) => {
    try {
      await db.updateRestraintObservationRecord(record);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error updating restraint observation record:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  const deleteRestraintObservationRecord = useCallback(async (id: string) => {
    try {
      await db.deleteRestraintObservationRecord(id);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error deleting restraint observation record:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  // ========== 體位轉換記錄 CRUD ==========
  const createPositionChangeRecord = useCallback(async (record: Omit<db.PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createPositionChangeRecord(record);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error creating position change record:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  const deletePositionChangeRecord = useCallback(async (id: string) => {
    try {
      await db.deletePositionChangeRecord(id);
      await refreshCareRecordsData();
    } catch (error) {
      console.error('Error deleting position change record:', error);
      throw error;
    }
  }, [refreshCareRecordsData]);
  
  // Context 值
  const value: CareRecordsContextType = {
    // 狀態
    patientNotes,
    patrolRounds,
    diaperChangeRecords,
    restraintObservationRecords,
    positionChangeRecords,
    loading,
    
    // 院友備忘 CRUD
    addPatientNote,
    updatePatientNote,
    deletePatientNote,
    completePatientNote,
    
    // 巡查記錄 CRUD
    createPatrolRound,
    deletePatrolRound,
    
    // 尿片更換記錄 CRUD
    createDiaperChangeRecord,
    updateDiaperChangeRecord,
    deleteDiaperChangeRecord,
    
    // 約束觀察記錄 CRUD
    createRestraintObservationRecord,
    updateRestraintObservationRecord,
    deleteRestraintObservationRecord,
    
    // 體位轉換記錄 CRUD
    createPositionChangeRecord,
    deletePositionChangeRecord,
    
    // 刷新
    refreshCareRecordsData,
  };
  
  return (
    <CareRecordsContext.Provider value={value}>
      {children}
    </CareRecordsContext.Provider>
  );
}

// ========== Hooks ==========
/**
 * 完整的護理記錄 Context（包含 CRUD 操作）
 */
export function useCareRecords(): CareRecordsContextType {
  const context = useContext(CareRecordsContext);
  if (context === undefined) {
    throw new Error('useCareRecords must be used within a CareRecordsProvider');
  }
  return context;
}

/**
 * 只讀數據 Hook - 用於只需要讀取數據的組件
 */
export function useCareRecordsData(): CareRecordsDataType {
  const { 
    patientNotes, 
    patrolRounds, 
    diaperChangeRecords, 
    restraintObservationRecords, 
    positionChangeRecords, 
    loading 
  } = useCareRecords();
  
  return { 
    patientNotes, 
    patrolRounds, 
    diaperChangeRecords, 
    restraintObservationRecords, 
    positionChangeRecords, 
    loading 
  };
}

export default CareRecordsContext;
