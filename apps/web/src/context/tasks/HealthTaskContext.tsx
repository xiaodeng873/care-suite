import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// Types
interface HealthTaskContextType {
  // State
  patientHealthTasks: db.PatientHealthTask[];
  
  // CRUD operations
  addPatientHealthTask: (task: Omit<db.PatientHealthTask, 'id' | 'created_at' | 'updated_at'>) => Promise<db.PatientHealthTask>;
  updatePatientHealthTask: (task: db.PatientHealthTask) => Promise<void>;
  deletePatientHealthTask: (id: string) => Promise<void>;
  setPatientHealthTasks: React.Dispatch<React.SetStateAction<db.PatientHealthTask[]>>;
  
  // Refresh
  refreshHealthTaskData: () => Promise<void>;
}

interface HealthTaskProviderProps {
  children: ReactNode;
}

const HealthTaskContext = createContext<HealthTaskContextType | undefined>(undefined);

export const HealthTaskProvider: React.FC<HealthTaskProviderProps> = ({ children }) => {
  const { user } = useAuth();
  
  // State
  const [patientHealthTasks, setPatientHealthTasks] = useState<db.PatientHealthTask[]>([]);

  // Refresh health task data
  const refreshHealthTaskData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await db.getHealthTasks();
      // Deduplicate tasks
      const uniqueTasksMap = new Map<string, db.PatientHealthTask>();
      data.forEach(task => {
        if (!uniqueTasksMap.has(task.id)) {
          uniqueTasksMap.set(task.id, task);
        }
      });
      setPatientHealthTasks(Array.from(uniqueTasksMap.values()));
    } catch (error) {
      console.error('刷新健康任務數據失敗:', error);
    }
  }, [user]);

  // CRUD operations with optimistic updates
  const addPatientHealthTask = async (task: Omit<db.PatientHealthTask, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const newTask = await db.createPatientHealthTask(task);
      setPatientHealthTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (error) {
      console.error('Error adding patient health task:', error);
      throw error;
    }
  };

  const updatePatientHealthTask = async (task: db.PatientHealthTask) => {
    try {
      // Optimistic update
      setPatientHealthTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } : t));
      await db.updatePatientHealthTask(task);
    } catch (error) {
      console.error('Error updating patient health task:', error);
      await refreshHealthTaskData(); // Revert on error
      throw error;
    }
  };

  const deletePatientHealthTask = async (id: string) => {
    try {
      // Optimistic delete
      setPatientHealthTasks(prev => prev.filter(t => t.id !== id));
      await db.deletePatientHealthTask(id);
    } catch (error) {
      console.error('Error deleting patient health task:', error);
      await refreshHealthTaskData(); // Revert on error
      throw error;
    }
  };

  useEffect(() => {
    refreshHealthTaskData();
  }, [refreshHealthTaskData]);

  const value: HealthTaskContextType = {
    patientHealthTasks,
    addPatientHealthTask,
    updatePatientHealthTask,
    deletePatientHealthTask,
    setPatientHealthTasks,
    refreshHealthTaskData,
  };

  return (
    <HealthTaskContext.Provider value={value}>
      {children}
    </HealthTaskContext.Provider>
  );
};

// Hook to use HealthTask context
export const useHealthTask = (): HealthTaskContextType => {
  const context = useContext(HealthTaskContext);
  if (context === undefined) {
    throw new Error('useHealthTask must be used within a HealthTaskProvider');
  }
  return context;
};

// Data-only hook
export const useHealthTaskData = () => {
  const { patientHealthTasks } = useHealthTask();
  return { patientHealthTasks };
};
