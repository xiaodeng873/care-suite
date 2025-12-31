/**
 * HospitalOutreachContext - 醫院外展記錄 Context
 * 
 * 從 PatientContext 拆分出來，專門處理醫院外展服務相關功能：
 * - 外展記錄 CRUD (hospitalOutreachRecords)
 * - 外展記錄歷史 (hospitalOutreachRecordHistory)
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

// ========== 類型定義 ==========
export interface HospitalOutreachRecord {
  id: string;
  patient_id: number;
  medication_bag_date?: string;
  medication_bag_quantity?: number;
  doctor_visit_date?: string;
  next_doctor_visit_date?: string;
  hospital_name?: string;
  department?: string;
  doctor_name?: string;
  diagnosis?: string;
  medication_notes?: string;
  general_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HospitalOutreachRecordHistory {
  id: string;
  original_record_id: string;
  patient_id: number;
  archived_at: string;
  [key: string]: any;
}

interface HospitalOutreachContextType {
  // 狀態
  hospitalOutreachRecords: HospitalOutreachRecord[];
  hospitalOutreachRecordHistory: HospitalOutreachRecordHistory[];
  loading: boolean;
  
  // CRUD 操作
  fetchHospitalOutreachRecords: () => Promise<void>;
  fetchHospitalOutreachRecordHistory: (patientId: number) => Promise<HospitalOutreachRecordHistory[]>;
  addHospitalOutreachRecord: (recordData: Omit<HospitalOutreachRecord, 'id' | 'created_at' | 'updated_at'>, patientName?: string) => Promise<HospitalOutreachRecord | null>;
  updateHospitalOutreachRecord: (recordData: HospitalOutreachRecord) => Promise<HospitalOutreachRecord | null>;
  deleteHospitalOutreachRecord: (recordId: string) => Promise<void>;
  
  // 刷新數據
  refreshHospitalOutreachData: () => Promise<void>;
}

// 只讀數據 Hook 的類型
interface HospitalOutreachDataType {
  hospitalOutreachRecords: HospitalOutreachRecord[];
  hospitalOutreachRecordHistory: HospitalOutreachRecordHistory[];
  loading: boolean;
}

// ========== Context 創建 ==========
const HospitalOutreachContext = createContext<HospitalOutreachContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface HospitalOutreachProviderProps {
  children: ReactNode;
}

export function HospitalOutreachProvider({ children }: HospitalOutreachProviderProps) {
  // 狀態定義
  const [hospitalOutreachRecords, setHospitalOutreachRecords] = useState<HospitalOutreachRecord[]>([]);
  const [hospitalOutreachRecordHistory, setHospitalOutreachRecordHistory] = useState<HospitalOutreachRecordHistory[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ========== 獲取數據 ==========
  const fetchHospitalOutreachRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hospital_outreach_records')
        .select('*')
        .order('medication_bag_date', { ascending: false });
      if (error) throw error;
      setHospitalOutreachRecords(data || []);
    } catch (error) {
      console.error('載入醫院外展記錄失敗:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const fetchHospitalOutreachRecordHistory = useCallback(async (patientId: number): Promise<HospitalOutreachRecordHistory[]> => {
    try {
      const { data, error } = await supabase
        .from('hospital_outreach_record_history')
        .select('*')
        .eq('patient_id', patientId)
        .order('archived_at', { ascending: false });
      if (error) throw error;
      setHospitalOutreachRecordHistory(data || []);
      return data || [];
    } catch (error) {
      console.error('載入醫院外展記錄歷史失敗:', error);
      setHospitalOutreachRecordHistory([]);
      return [];
    }
  }, []);
  
  // ========== 刷新數據 ==========
  const refreshHospitalOutreachData = useCallback(async () => {
    await fetchHospitalOutreachRecords();
  }, [fetchHospitalOutreachRecords]);
  
  // ========== CRUD 操作 ==========
  const addHospitalOutreachRecord = useCallback(async (
    recordData: Omit<HospitalOutreachRecord, 'id' | 'created_at' | 'updated_at'>,
    patientName?: string
  ): Promise<HospitalOutreachRecord | null> => {
    try {
      // 檢查是否已有記錄
      const { data: existingRecord, error: checkError } = await supabase
        .from('hospital_outreach_records')
        .select('id')
        .eq('patient_id', recordData.patient_id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      
      if (existingRecord) {
        const name = patientName || '該院友';
        alert(`${name} 已有醫院外展記錄，每位院友只能有一筆記錄。\n\n如需更新記錄，請使用編輯功能。`);
        return null;
      }
      
      const { data, error } = await supabase
        .from('hospital_outreach_records')
        .insert([recordData])
        .select()
        .single();
      if (error) throw error;
      await fetchHospitalOutreachRecords();
      return data;
    } catch (error) {
      console.error('新增醫院外展記錄失敗:', error);
      throw error;
    }
  }, [fetchHospitalOutreachRecords]);
  
  const updateHospitalOutreachRecord = useCallback(async (recordData: HospitalOutreachRecord): Promise<HospitalOutreachRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('hospital_outreach_records')
        .update(recordData)
        .eq('id', recordData.id)
        .select()
        .single();
      if (error) throw error;
      await fetchHospitalOutreachRecords();
      return data;
    } catch (error) {
      console.error('更新醫院外展記錄失敗:', error);
      throw error;
    }
  }, [fetchHospitalOutreachRecords]);
  
  const deleteHospitalOutreachRecord = useCallback(async (recordId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('hospital_outreach_records')
        .delete()
        .eq('id', recordId);
      if (error) throw error;
      await fetchHospitalOutreachRecords();
    } catch (error) {
      console.error('刪除醫院外展記錄失敗:', error);
      throw error;
    }
  }, [fetchHospitalOutreachRecords]);
  
  // 自動刷新資料
  useEffect(() => {
    fetchHospitalOutreachRecords();
  }, [fetchHospitalOutreachRecords]);
  
  // Context 值
  const value: HospitalOutreachContextType = {
    // 狀態
    hospitalOutreachRecords,
    hospitalOutreachRecordHistory,
    loading,
    
    // CRUD 操作
    fetchHospitalOutreachRecords,
    fetchHospitalOutreachRecordHistory,
    addHospitalOutreachRecord,
    updateHospitalOutreachRecord,
    deleteHospitalOutreachRecord,
    
    // 刷新
    refreshHospitalOutreachData,
  };
  
  return (
    <HospitalOutreachContext.Provider value={value}>
      {children}
    </HospitalOutreachContext.Provider>
  );
}

// ========== Hooks ==========
/**
 * 完整的醫院外展記錄 Context（包含 CRUD 操作）
 */
export function useHospitalOutreach(): HospitalOutreachContextType {
  const context = useContext(HospitalOutreachContext);
  if (context === undefined) {
    throw new Error('useHospitalOutreach must be used within a HospitalOutreachProvider');
  }
  return context;
}

/**
 * 只讀數據 Hook - 用於只需要讀取數據的組件
 */
export function useHospitalOutreachData(): HospitalOutreachDataType {
  const { hospitalOutreachRecords, hospitalOutreachRecordHistory, loading } = useHospitalOutreach();
  return { hospitalOutreachRecords, hospitalOutreachRecordHistory, loading };
}

export default HospitalOutreachContext;
