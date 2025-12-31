/**
 * ScheduleContext - 排程管理 Context
 * 
 * 從 PatientContext 拆分出來，專門處理排程相關功能：
 * - VMO 排程 (schedules)
 * - 醫生就診排程 (doctorVisitSchedule)
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthContext';

// ========== 類型定義 ==========
// Extended schedule interface for UI
export interface ScheduleWithDetails extends db.Schedule {
  院友列表: db.ScheduleDetail[];
}

interface ScheduleContextType {
  // 狀態
  schedules: ScheduleWithDetails[];
  doctorVisitSchedule: any[];
  loading: boolean;
  
  // VMO 排程 CRUD
  addSchedule: (schedule: Omit<db.Schedule, '排程id'>) => Promise<void>;
  updateSchedule: (schedule: ScheduleWithDetails) => Promise<void>;
  deleteSchedule: (id: number) => Promise<void>;
  addPatientToSchedule: (scheduleId: number, patientId: number, symptoms: string, notes: string, reasons: string[]) => Promise<void>;
  updateScheduleDetail: (detailData: { 細項id: number; 症狀說明: string; 備註: string; reasonIds: number[] }) => Promise<any>;
  deleteScheduleDetail: (detailId: number) => Promise<void>;
  
  // 醫生就診排程 CRUD
  fetchDoctorVisitSchedule: () => Promise<void>;
  addDoctorVisitSchedule: (scheduleData: any) => Promise<any>;
  updateDoctorVisitSchedule: (scheduleData: any) => Promise<any>;
  deleteDoctorVisitSchedule: (scheduleId: string) => Promise<void>;
  
  // 刷新數據
  refreshScheduleData: () => Promise<void>;
}

// 只讀數據 Hook 的類型
interface ScheduleDataType {
  schedules: ScheduleWithDetails[];
  doctorVisitSchedule: any[];
  loading: boolean;
}

// ========== Context 創建 ==========
const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface ScheduleProviderProps {
  children: ReactNode;
}

export function ScheduleProvider({ children }: ScheduleProviderProps) {
  const { user } = useAuth();
  
  // 狀態定義
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [doctorVisitSchedule, setDoctorVisitSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ========== 刷新數據 ==========
  const refreshScheduleData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 獲取 VMO 排程
      const schedulesData = await db.getSchedules();
      
      // 獲取每個排程的詳細資料（添加錯誤處理）
      const schedulesWithDetails: ScheduleWithDetails[] = await Promise.all(
        schedulesData.map(async (schedule) => {
          try {
            const details = await db.getScheduleDetails(schedule.排程id);
            return {
              ...schedule,
              院友列表: details
            };
          } catch (error) {
            console.error(`Error loading details for schedule ${schedule.排程id}:`, error);
            // 如果獲取詳情失敗，返回空列表
            return {
              ...schedule,
              院友列表: []
            };
          }
        })
      );
      setSchedules(schedulesWithDetails);
      
      // 獲取醫生就診排程
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctor_visit_schedule')
        .select('*')
        .order('visit_date', { ascending: true });
      if (!doctorError) {
        setDoctorVisitSchedule(doctorData || []);
      }
    } catch (error) {
      console.error('Error refreshing schedule data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // ========== 醫生就診排程 ==========
  const fetchDoctorVisitSchedule = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('doctor_visit_schedule')
        .select('*')
        .order('visit_date', { ascending: true });
      if (error) throw error;
      setDoctorVisitSchedule(data || []);
    } catch (error) {
      console.error('載入醫生到診排程失敗:', error);
      throw error;
    }
  }, []);
  
  const addDoctorVisitSchedule = useCallback(async (scheduleData: any) => {
    try {
      const { data, error } = await supabase
        .from('doctor_visit_schedule')
        .insert([scheduleData])
        .select()
        .single();
      if (error) throw error;
      await fetchDoctorVisitSchedule();
      return data;
    } catch (error) {
      console.error('新增醫生到診排程失敗:', error);
      throw error;
    }
  }, [fetchDoctorVisitSchedule]);
  
  const updateDoctorVisitSchedule = useCallback(async (scheduleData: any) => {
    try {
      const { data, error } = await supabase
        .from('doctor_visit_schedule')
        .update(scheduleData)
        .eq('id', scheduleData.id)
        .select()
        .single();
      if (error) throw error;
      await fetchDoctorVisitSchedule();
      return data;
    } catch (error) {
      console.error('更新醫生到診排程失敗:', error);
      throw error;
    }
  }, [fetchDoctorVisitSchedule]);
  
  const deleteDoctorVisitSchedule = useCallback(async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('doctor_visit_schedule')
        .delete()
        .eq('id', scheduleId);
      if (error) throw error;
      await fetchDoctorVisitSchedule();
    } catch (error) {
      console.error('刪除醫生到診排程失敗:', error);
      throw error;
    }
  }, [fetchDoctorVisitSchedule]);
  
  // ========== VMO 排程 CRUD ==========
  const addSchedule = useCallback(async (schedule: Omit<db.Schedule, '排程id'>) => {
    try {
      await db.createSchedule(schedule);
      await refreshScheduleData();
    } catch (error) {
      console.error('Error adding schedule:', error);
    }
  }, [refreshScheduleData]);
  
  const updateSchedule = useCallback(async (schedule: ScheduleWithDetails) => {
    try {
      await db.updateSchedule(schedule);
      await refreshScheduleData();
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  }, [refreshScheduleData]);
  
  const deleteSchedule = useCallback(async (id: number) => {
    try {
      await db.deleteSchedule(id);
      await refreshScheduleData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  }, [refreshScheduleData]);
  
  const addPatientToSchedule = useCallback(async (
    scheduleId: number, 
    patientId: number, 
    symptoms: string, 
    notes: string, 
    reasons: string[]
  ) => {
    try {
      await db.addPatientToSchedule(scheduleId, patientId, symptoms, notes, reasons);
      await refreshScheduleData();
    } catch (error) {
      console.error('Error adding patient to schedule:', error);
    }
  }, [refreshScheduleData]);
  
  const updateScheduleDetail = useCallback(async (detailData: { 細項id: number; 症狀說明: string; 備註: string; reasonIds: number[] }) => {
    try {
      const result = await db.updateScheduleDetail(detailData);
      if (result?.error) throw new Error(result.error.message);
      await refreshScheduleData();
      return result;
    } catch (error) {
      console.error('Error updating schedule detail:', error);
      throw error;
    }
  }, [refreshScheduleData]);
  
  const deleteScheduleDetail = useCallback(async (detailId: number) => {
    try {
      await db.deleteScheduleDetail(detailId);
      await refreshScheduleData();
    } catch (error) {
      console.error('Error deleting schedule detail:', error);
    }
  }, [refreshScheduleData]);
  
  // 自動刷新資料
  useEffect(() => {
    refreshScheduleData();
  }, [refreshScheduleData]);
  
  // Context 值
  const value: ScheduleContextType = {
    // 狀態
    schedules,
    doctorVisitSchedule,
    loading,
    
    // VMO 排程 CRUD
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addPatientToSchedule,
    updateScheduleDetail,
    deleteScheduleDetail,
    
    // 醫生就診排程 CRUD
    fetchDoctorVisitSchedule,
    addDoctorVisitSchedule,
    updateDoctorVisitSchedule,
    deleteDoctorVisitSchedule,
    
    // 刷新
    refreshScheduleData,
  };
  
  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}

// ========== Hooks ==========
/**
 * 完整的排程 Context（包含 CRUD 操作）
 */
export function useSchedule(): ScheduleContextType {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}

/**
 * 只讀數據 Hook - 用於只需要讀取數據的組件
 */
export function useScheduleData(): ScheduleDataType {
  const { schedules, doctorVisitSchedule, loading } = useSchedule();
  return { schedules, doctorVisitSchedule, loading };
}

export default ScheduleContext;
