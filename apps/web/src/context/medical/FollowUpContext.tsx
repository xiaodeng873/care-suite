/**
 * FollowUpContext - 覆診追蹤管理
 * 
 * 此 Context 負責管理覆診預約相關的狀態和操作。
 * 從 PatientContext 中拆分出來，以提高性能和可維護性。
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// Re-export types for convenience
export type { FollowUpAppointment } from '../../lib/database';

interface FollowUpContextType {
  // 狀態
  followUpAppointments: db.FollowUpAppointment[];
  loading: boolean;
  
  // CRUD 操作
  addFollowUpAppointment: (appointment: Omit<db.FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>) => Promise<void>;
  updateFollowUpAppointment: (appointment: db.FollowUpAppointment, optimistic?: boolean) => Promise<void>;
  deleteFollowUpAppointment: (id: string) => Promise<void>;
  
  // 批量操作
  batchUpdateFollowUpStatus: (ids: string[], status: string) => Promise<void>;
  
  // 刷新數據
  refreshFollowUpData: () => Promise<void>;
}

const FollowUpContext = createContext<FollowUpContextType | undefined>(undefined);

interface FollowUpProviderProps {
  children: ReactNode;
}

export const FollowUpProvider: React.FC<FollowUpProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [followUpAppointments, setFollowUpAppointments] = useState<db.FollowUpAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  // 載入覆診數據
  const refreshFollowUpData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    try {
      const data = await db.getFollowUps();
      setFollowUpAppointments(data);
    } catch (error) {
      console.error('Error fetching follow-up appointments:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // 初始載入（延遲 300ms，讓關鍵數據優先載入）
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshFollowUpData();
    }, 300);
    return () => clearTimeout(timer);
  }, [refreshFollowUpData]);

  // 新增覆診預約
  const addFollowUpAppointment = useCallback(async (
    appointment: Omit<db.FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>
  ) => {
    try {
      const newAppointment = await db.createFollowUp(appointment);
      setFollowUpAppointments(prev => [...prev, newAppointment]);
    } catch (error) {
      console.error('Error adding follow-up appointment:', error);
      throw error;
    }
  }, []);

  // 更新覆診預約（支持樂觀更新）
  const updateFollowUpAppointment = useCallback(async (
    appointment: db.FollowUpAppointment,
    optimistic: boolean = false
  ) => {
    if (optimistic) {
      // 樂觀更新：立即更新本地狀態
      setFollowUpAppointments(prev =>
        prev.map(a => a.覆診id === appointment.覆診id ? appointment : a)
      );
    }

    try {
      await db.updateFollowUp(appointment);
      if (!optimistic) {
        // 非樂觀更新：從服務器重新獲取
        await refreshFollowUpData();
      }
    } catch (error) {
      console.error('Error updating follow-up appointment:', error);
      // 如果是樂觀更新失敗，需要回滾
      if (optimistic) {
        await refreshFollowUpData();
      }
      throw error;
    }
  }, [refreshFollowUpData]);

  // 刪除覆診預約
  const deleteFollowUpAppointment = useCallback(async (id: string) => {
    try {
      await db.deleteFollowUp(id);
      setFollowUpAppointments(prev => prev.filter(a => a.覆診id !== id));
    } catch (error) {
      console.error('Error deleting follow-up appointment:', error);
      throw error;
    }
  }, []);

  // 批量更新狀態
  const batchUpdateFollowUpStatus = useCallback(async (ids: string[], status: string) => {
    const now = new Date().toISOString();
    
    // 樂觀更新：立即更新本地狀態
    setFollowUpAppointments(prev =>
      prev.map(a =>
        ids.includes(a.覆診id)
          ? { ...a, 狀態: status as any, 更新時間: now }
          : a
      )
    );

    try {
      // 批量更新數據庫
      await Promise.all(
        ids.map(async (id) => {
          const appointment = followUpAppointments.find(a => a.覆診id === id);
          if (appointment) {
            await db.updateFollowUp({ ...appointment, 狀態: status as any, 更新時間: now });
          }
        })
      );
    } catch (error) {
      console.error('Error batch updating follow-up status:', error);
      // 失敗時回滾
      await refreshFollowUpData();
      throw error;
    }
  }, [followUpAppointments, refreshFollowUpData]);

  const value: FollowUpContextType = {
    followUpAppointments,
    loading,
    addFollowUpAppointment,
    updateFollowUpAppointment,
    deleteFollowUpAppointment,
    batchUpdateFollowUpStatus,
    refreshFollowUpData,
  };

  return (
    <FollowUpContext.Provider value={value}>
      {children}
    </FollowUpContext.Provider>
  );
};

/**
 * useFollowUp hook - 使用覆診管理功能
 */
export const useFollowUp = (): FollowUpContextType => {
  const context = useContext(FollowUpContext);
  if (!context) {
    throw new Error('useFollowUp must be used within a FollowUpProvider');
  }
  return context;
};

/**
 * useFollowUpData hook - 只獲取覆診數據（用於只需要讀取的組件）
 */
export const useFollowUpData = () => {
  const { followUpAppointments, loading } = useFollowUp();
  return { followUpAppointments, loading };
};

export default FollowUpContext;
