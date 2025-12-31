/**
 * DiagnosisContext - 診斷與疫苗記錄管理
 * 
 * 此 Context 負責管理診斷記錄和疫苗記錄相關的狀態和操作。
 * 從 PatientContext 中拆分出來，以提高性能和可維護性。
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as db from '../../lib/database';

// Re-export types for convenience
export type { DiagnosisRecord, VaccinationRecord } from '../../lib/database';

interface DiagnosisContextType {
  // 狀態
  diagnosisRecords: db.DiagnosisRecord[];
  vaccinationRecords: db.VaccinationRecord[];
  loading: boolean;
  
  // 診斷記錄 CRUD
  addDiagnosisRecord: (record: Omit<db.DiagnosisRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDiagnosisRecord: (record: db.DiagnosisRecord) => Promise<void>;
  deleteDiagnosisRecord: (id: string) => Promise<void>;
  
  // 疫苗記錄 CRUD
  addVaccinationRecord: (record: Omit<db.VaccinationRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateVaccinationRecord: (record: db.VaccinationRecord) => Promise<void>;
  deleteVaccinationRecord: (id: string) => Promise<void>;
  
  // 刷新數據
  refreshDiagnosisData: () => Promise<void>;
}

const DiagnosisContext = createContext<DiagnosisContextType | undefined>(undefined);

interface DiagnosisProviderProps {
  children: ReactNode;
}

export const DiagnosisProvider: React.FC<DiagnosisProviderProps> = ({ children }) => {
  const [diagnosisRecords, setDiagnosisRecords] = useState<db.DiagnosisRecord[]>([]);
  const [vaccinationRecords, setVaccinationRecords] = useState<db.VaccinationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 載入數據
  const refreshDiagnosisData = useCallback(async () => {
    setLoading(true);
    try {
      const [diagnosisData, vaccinationData] = await Promise.all([
        db.getDiagnosisRecords(),
        db.getVaccinationRecords()
      ]);
      setDiagnosisRecords(diagnosisData);
      setVaccinationRecords(vaccinationData);
    } catch (error) {
      console.error('Error fetching diagnosis/vaccination data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    refreshDiagnosisData();
  }, [refreshDiagnosisData]);

  // 診斷記錄 CRUD
  const addDiagnosisRecord = useCallback(async (
    record: Omit<db.DiagnosisRecord, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const newRecord = await db.createDiagnosisRecord(record);
      setDiagnosisRecords(prev => [...prev, newRecord]);
    } catch (error) {
      console.error('Error adding diagnosis record:', error);
      throw error;
    }
  }, []);

  const updateDiagnosisRecord = useCallback(async (record: db.DiagnosisRecord) => {
    try {
      await db.updateDiagnosisRecord(record);
      setDiagnosisRecords(prev =>
        prev.map(r => r.id === record.id ? record : r)
      );
    } catch (error) {
      console.error('Error updating diagnosis record:', error);
      throw error;
    }
  }, []);

  const deleteDiagnosisRecord = useCallback(async (id: string) => {
    try {
      await db.deleteDiagnosisRecord(id);
      setDiagnosisRecords(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting diagnosis record:', error);
      throw error;
    }
  }, []);

  // 疫苗記錄 CRUD
  const addVaccinationRecord = useCallback(async (
    record: Omit<db.VaccinationRecord, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const newRecord = await db.createVaccinationRecord(record);
      setVaccinationRecords(prev => [...prev, newRecord]);
    } catch (error) {
      console.error('Error adding vaccination record:', error);
      throw error;
    }
  }, []);

  const updateVaccinationRecord = useCallback(async (record: db.VaccinationRecord) => {
    try {
      await db.updateVaccinationRecord(record);
      setVaccinationRecords(prev =>
        prev.map(r => r.id === record.id ? record : r)
      );
    } catch (error) {
      console.error('Error updating vaccination record:', error);
      throw error;
    }
  }, []);

  const deleteVaccinationRecord = useCallback(async (id: string) => {
    try {
      await db.deleteVaccinationRecord(id);
      setVaccinationRecords(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting vaccination record:', error);
      throw error;
    }
  }, []);

  const value: DiagnosisContextType = {
    diagnosisRecords,
    vaccinationRecords,
    loading,
    addDiagnosisRecord,
    updateDiagnosisRecord,
    deleteDiagnosisRecord,
    addVaccinationRecord,
    updateVaccinationRecord,
    deleteVaccinationRecord,
    refreshDiagnosisData,
  };

  return (
    <DiagnosisContext.Provider value={value}>
      {children}
    </DiagnosisContext.Provider>
  );
};

/**
 * useDiagnosis hook - 使用診斷和疫苗記錄管理功能
 */
export const useDiagnosis = (): DiagnosisContextType => {
  const context = useContext(DiagnosisContext);
  if (!context) {
    throw new Error('useDiagnosis must be used within a DiagnosisProvider');
  }
  return context;
};

/**
 * useDiagnosisData hook - 只獲取診斷數據（用於只需要讀取的組件）
 */
export const useDiagnosisData = () => {
  const { diagnosisRecords, vaccinationRecords, loading } = useDiagnosis();
  return { diagnosisRecords, vaccinationRecords, loading };
};

export default DiagnosisContext;
