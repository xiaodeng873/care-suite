import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// Types
interface PatientLogContextType {
  // State
  patientLogs: db.PatientLog[];
  
  // CRUD operations
  addPatientLog: (log: Omit<db.PatientLog, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientLog: (log: db.PatientLog) => Promise<void>;
  deletePatientLog: (id: string) => Promise<void>;
  
  // Refresh
  refreshPatientLogData: () => Promise<void>;
}

interface PatientLogProviderProps {
  children: ReactNode;
}

const PatientLogContext = createContext<PatientLogContextType | undefined>(undefined);

export const PatientLogProvider: React.FC<PatientLogProviderProps> = ({ children }) => {
  const { user } = useAuth();
  
  // State
  const [patientLogs, setPatientLogs] = useState<db.PatientLog[]>([]);

  // Refresh patient log data
  const refreshPatientLogData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await db.getPatientLogs();
      setPatientLogs(data);
    } catch (error) {
      console.error('刷新院友日誌數據失敗:', error);
    }
  }, [user]);

  // CRUD operations
  const addPatientLog = async (log: Omit<db.PatientLog, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createPatientLog(log);
      await refreshPatientLogData();
    } catch (error) {
      console.error('Error adding patient log:', error);
      throw error;
    }
  };

  const updatePatientLog = async (log: db.PatientLog) => {
    try {
      await db.updatePatientLog(log);
      await refreshPatientLogData();
    } catch (error) {
      console.error('Error updating patient log:', error);
      throw error;
    }
  };

  const deletePatientLog = async (id: string) => {
    try {
      await db.deletePatientLog(id);
      await refreshPatientLogData();
    } catch (error) {
      console.error('Error deleting patient log:', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshPatientLogData();
  }, [refreshPatientLogData]);

  const value: PatientLogContextType = {
    patientLogs,
    addPatientLog,
    updatePatientLog,
    deletePatientLog,
    refreshPatientLogData,
  };

  return (
    <PatientLogContext.Provider value={value}>
      {children}
    </PatientLogContext.Provider>
  );
};

// Hook to use PatientLog context
export const usePatientLog = (): PatientLogContextType => {
  const context = useContext(PatientLogContext);
  if (context === undefined) {
    throw new Error('usePatientLog must be used within a PatientLogProvider');
  }
  return context;
};

// Data-only hook
export const usePatientLogData = () => {
  const { patientLogs } = usePatientLog();
  return { patientLogs };
};
