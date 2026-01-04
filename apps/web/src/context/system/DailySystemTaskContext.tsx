import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

interface DailySystemTaskContextType {
  dailySystemTasks: db.DailySystemTask[];
  getOverdueDailySystemTasks: () => Promise<db.DailySystemTask[]>;
  refreshDailySystemTaskData: () => Promise<void>;
}

const DailySystemTaskContext = createContext<DailySystemTaskContextType | undefined>(undefined);

export const useDailySystemTask = () => {
  const context = useContext(DailySystemTaskContext);
  if (!context) {
    throw new Error('useDailySystemTask must be used within a DailySystemTaskProvider');
  }
  return context;
};

export const useDailySystemTaskData = () => {
  const { dailySystemTasks } = useDailySystemTask();
  return { dailySystemTasks };
};

interface DailySystemTaskProviderProps {
  children: ReactNode;
}

export const DailySystemTaskProvider = ({ children }: DailySystemTaskProviderProps) => {
  const { isAuthenticated } = useAuth();
  const [dailySystemTasks, setDailySystemTasks] = useState<db.DailySystemTask[]>([]);

  const refreshDailySystemTaskData = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const tasks = await db.getOverdueDailySystemTasks();
      setDailySystemTasks(tasks);
    } catch (error) {
      console.error('Error refreshing daily system tasks:', error);
      setDailySystemTasks([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshDailySystemTaskData();
  }, [refreshDailySystemTaskData]);

  const getOverdueDailySystemTasks = async () => {
    try {
      const tasks = await db.getOverdueDailySystemTasks();
      setDailySystemTasks(tasks);
      return tasks;
    } catch (error) {
      console.error('Error getting overdue daily system tasks:', error);
      return [];
    }
  };

  const value: DailySystemTaskContextType = {
    dailySystemTasks,
    getOverdueDailySystemTasks,
    refreshDailySystemTaskData,
  };

  return (
    <DailySystemTaskContext.Provider value={value}>
      {children}
    </DailySystemTaskContext.Provider>
  );
};
