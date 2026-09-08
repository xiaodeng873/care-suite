/**
 * MedicalContext - 合併的醫療相關 Context
 * 
 * 將以下 Context 合併為一個，減少 Provider 嵌套層級，提升性能：
 * - FollowUpContext (覆診追蹤)
 * - DiagnosisContext (診斷與疫苗)
 * - HospitalOutreachContext (醫院外展)
 * - WoundContext (傷口管理)
 * - HealthRecordContext (健康記錄)
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import * as db from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthContext';

// ========== 類型定義 ==========
// Re-export types for convenience
export type { FollowUpAppointment, DiagnosisRecord, VaccinationRecord } from '../../lib/database';

// 傷口照片介面
export interface WoundPhoto {
  id: string;
  base64: string;
  filename: string;
  uploadDate: string;
  description?: string;
}

// 醫院外展記錄
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

// ========== Context 類型定義 ==========
interface MedicalContextType {
  // ===== 覆診相關 =====
  followUpAppointments: db.FollowUpAppointment[];
  followUpLoading: boolean;
  addFollowUpAppointment: (appointment: Omit<db.FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>) => Promise<void>;
  updateFollowUpAppointment: (appointment: db.FollowUpAppointment, optimistic?: boolean) => Promise<void>;
  deleteFollowUpAppointment: (id: string) => Promise<void>;
  batchUpdateFollowUpStatus: (ids: string[], status: string) => Promise<void>;
  refreshFollowUpData: () => Promise<void>;
  
  // ===== 診斷與疫苗相關 =====
  diagnosisRecords: db.DiagnosisRecord[];
  vaccinationRecords: db.VaccinationRecord[];
  diagnosisLoading: boolean;
  addDiagnosisRecord: (record: Omit<db.DiagnosisRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDiagnosisRecord: (record: db.DiagnosisRecord) => Promise<void>;
  deleteDiagnosisRecord: (id: string) => Promise<void>;
  addVaccinationRecord: (record: Omit<db.VaccinationRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateVaccinationRecord: (record: db.VaccinationRecord) => Promise<void>;
  deleteVaccinationRecord: (id: string) => Promise<void>;
  refreshDiagnosisData: () => Promise<void>;
  
  // ===== 醫院外展相關 =====
  hospitalOutreachRecords: HospitalOutreachRecord[];
  hospitalOutreachRecordHistory: HospitalOutreachRecordHistory[];
  hospitalOutreachLoading: boolean;
  fetchHospitalOutreachRecords: () => Promise<void>;
  fetchHospitalOutreachRecordHistory: (patientId: number) => Promise<HospitalOutreachRecordHistory[]>;
  addHospitalOutreachRecord: (recordData: Omit<HospitalOutreachRecord, 'id' | 'created_at' | 'updated_at'>, patientName?: string) => Promise<HospitalOutreachRecord | null>;
  updateHospitalOutreachRecord: (recordData: HospitalOutreachRecord) => Promise<HospitalOutreachRecord | null>;
  deleteHospitalOutreachRecord: (recordId: string) => Promise<void>;
  refreshHospitalOutreachData: () => Promise<void>;
  
  // ===== 傷口相關 =====
  wounds: db.Wound[];
  woundAssessments: db.WoundAssessment[];
  patientsWithWounds: db.PatientWithWounds[];
  woundLoading: boolean;
  addWound: (wound: Omit<db.Wound, 'id' | 'created_at' | 'updated_at'>) => Promise<db.Wound | null>;
  updateWound: (wound: Partial<db.Wound> & { id: string }) => Promise<db.Wound | null>;
  deleteWound: (id: string) => Promise<void>;
  healWound: (woundId: string, healedDate?: string) => Promise<db.Wound | null>;
  getWoundWithAssessments: (woundId: string) => Promise<db.WoundWithAssessments | null>;
  getWoundsNeedingAssessment: () => Promise<db.Wound[]>;
  generateWoundCode: (patientId: number) => Promise<string>;
  addWoundAssessmentForWound: (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => Promise<void>;
  addWoundAssessment: (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => Promise<void>;
  updateWoundAssessment: (assessment: db.WoundAssessment) => Promise<void>;
  deleteWoundAssessment: (id: string) => Promise<void>;
  refreshWoundData: () => Promise<void>;
  
  // ===== 健康記錄相關 =====
  healthRecords: db.HealthRecord[];
  deletedHealthRecords: db.DeletedHealthRecord[];
  isAllHealthRecordsLoaded: boolean;
  healthRecordLoading: boolean;
  /** 最近一次的監測記錄載入失敗（與資料庫暫時斷線），UI 應提示重試而非當作無記錄 */
  healthRecordLoadFailed: boolean;
  /** 背景補全完整歷史記錄進行中（唔计入統一 loading，唔阻塞登入閘門） */
  fullHealthRecordsLoading?: boolean;
  addHealthRecord: (record: Omit<db.HealthRecord, '記錄id'>) => Promise<db.HealthRecord>;
  addHealthRecordsForSession: (records: Omit<db.HealthRecord, '記錄id' | '建立時間'>[]) => Promise<db.HealthRecord[]>;
  updateHealthRecord: (record: db.HealthRecord) => Promise<db.HealthRecord>;
  deleteHealthRecord: (id: string) => Promise<void>;
  fetchDeletedHealthRecords: () => Promise<void>;
  restoreHealthRecord: (deletedRecordId: string) => Promise<void>;
  permanentlyDeleteHealthRecord: (deletedRecordId: string) => Promise<void>;
  findDuplicateHealthRecords: () => Promise<db.DuplicateRecordGroup[]>;
  batchDeleteDuplicateRecords: (duplicateRecordIds: number[], deletedBy?: string) => Promise<void>;
  loadFullHealthRecords: () => Promise<void>;
  /** [第二階] 已載記錄嘅最早日期（YYYY-MM-DD，null = 近一年窗口未載完）；更舊嘅用 ensureHealthRecordsFloor 按需拉 */
  healthRecordsFloorDate: string | null;
  /** [第二階] 按需向舊推窗口：確保 state 有早過 targetDate 嘅記錄（冪等，可並發安全調用） */
  ensureHealthRecordsFloor: (targetDate: string) => Promise<void>;
  refreshHealthRecordData: () => Promise<void>;
  
  // ===== 統一加載狀態 =====
  loading: boolean;
  
  // ===== 統一刷新 =====
  refreshAllMedicalData: () => Promise<void>;

  // [DEBUG-db9a] 診斷用：本 Provider 實例編號（追蹤孤兒 setState）
  __debugInstanceId?: number;
}

// [DEBUG-db9a] 全域實例計數器
let medicalCtxSeq = 0;

// ========== Context 創建 ==========
const MedicalContext = createContext<MedicalContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface MedicalProviderProps {
  children: ReactNode;
}

export function MedicalProvider({ children }: MedicalProviderProps) {
  const { isAuthenticated } = useAuth();
  
  // ===== 覆診狀態 =====
  const [followUpAppointments, setFollowUpAppointments] = useState<db.FollowUpAppointment[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(true);
  
  // ===== 診斷與疫苗狀態 =====
  const [diagnosisRecords, setDiagnosisRecords] = useState<db.DiagnosisRecord[]>([]);
  const [vaccinationRecords, setVaccinationRecords] = useState<db.VaccinationRecord[]>([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(true);
  
  // ===== 醫院外展狀態 =====
  const [hospitalOutreachRecords, setHospitalOutreachRecords] = useState<HospitalOutreachRecord[]>([]);
  const [hospitalOutreachRecordHistory, setHospitalOutreachRecordHistory] = useState<HospitalOutreachRecordHistory[]>([]);
  const [hospitalOutreachLoading, setHospitalOutreachLoading] = useState(false);
  
  // ===== 傷口狀態 =====
  const [wounds, setWounds] = useState<db.Wound[]>([]);
  const [woundAssessments, setWoundAssessments] = useState<db.WoundAssessment[]>([]);
  const [patientsWithWounds, setPatientsWithWounds] = useState<db.PatientWithWounds[]>([]);
  const [woundLoading, setWoundLoading] = useState(false);
  
  // ===== 健康記錄狀態 =====
  const [healthRecords, setHealthRecords] = useState<db.HealthRecord[]>([]);
  const [deletedHealthRecords, setDeletedHealthRecords] = useState<db.DeletedHealthRecord[]>([]);
  const [isAllHealthRecordsLoaded, setIsAllHealthRecordsLoaded] = useState(false);
  const isAllHealthRecordsLoadedRef = useRef(false);
  const [healthRecordLoading, setHealthRecordLoading] = useState(false);
  // 監測記錄載入失敗標記：失敗時 UI 顯示提示，避免把「載入失敗」誤當「無記錄」（小日曆全紅）
  const [healthRecordLoadFailed, setHealthRecordLoadFailed] = useState(false);
  // 背景補全完整歷史記錄嘅獨立 flag：唔计入統一 loading，
  // 否則登入閘門會被 49k+ 行嘅背景載入再度阻塞
  const [fullHealthRecordsLoading, setFullHealthRecordsLoading] = useState(false);
  // 防 StrictMode 雙重 effect / 重複觸發：全量載入進行中唔再開第二個（49k+ 行）
  const fullHealthRecordsInFlightRef = useRef(false);
  // [第二階] 已載記錄嘅最早日期（YYYY-MM-DD，null = 未開始/未知）：
  // 背景全量淨載近 1 年，floor = 今日-365；ensureHealthRecordsFloor 按需向舊推
  const [healthRecordsFloorDate, setHealthRecordsFloorDate] = useState<string | null>(null);
  const healthRecordsFloorDateRef = useRef<string | null>(null);
  const floorExtendInFlightRef = useRef(false);
  // [DEBUG-db9a] 實例標記：追蹤「setState 落到邊個實例」vs「畫面讀緊邊個實例」，
  // 診斷 FacilityScoped 重掛後舊實例 setState 被丟棄嘅孤兒問題
  const instanceIdRef = useRef(++medicalCtxSeq);
  const markSet = (rows: number, where: string) => {
    (window as any).__dbgMedSetId = instanceIdRef.current;
    (window as any).__dbgMedSetRows = rows;
    console.warn(`[DEBUG-db9a] [實例${instanceIdRef.current}] ${where} setHealthRecords rows=${rows}`);
  };

  // ===== 覆診函數 =====
  const refreshFollowUpData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setFollowUpLoading(true);
    try {
      const data = await db.getFollowUps();
      setFollowUpAppointments(data);
    } catch (error) {
      console.error('Error fetching follow-up appointments:', error);
    } finally {
      setFollowUpLoading(false);
    }
  }, [isAuthenticated]);

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

  const updateFollowUpAppointment = useCallback(async (
    appointment: db.FollowUpAppointment,
    optimistic: boolean = false
  ) => {
    if (optimistic) {
      setFollowUpAppointments(prev =>
        prev.map(a => a.覆診id === appointment.覆診id ? appointment : a)
      );
    }
    try {
      await db.updateFollowUp(appointment);
      if (!optimistic) {
        await refreshFollowUpData();
      }
    } catch (error) {
      console.error('Error updating follow-up appointment:', error);
      if (optimistic) {
        await refreshFollowUpData();
      }
      throw error;
    }
  }, [refreshFollowUpData]);

  const deleteFollowUpAppointment = useCallback(async (id: string) => {
    try {
      await db.deleteFollowUp(id);
      setFollowUpAppointments(prev => prev.filter(a => a.覆診id !== id));
    } catch (error) {
      console.error('Error deleting follow-up appointment:', error);
      throw error;
    }
  }, []);

  const batchUpdateFollowUpStatus = useCallback(async (ids: string[], status: string) => {
    const now = new Date().toISOString();
    setFollowUpAppointments(prev =>
      prev.map(a =>
        ids.includes(a.覆診id)
          ? { ...a, 狀態: status as any, 更新時間: now }
          : a
      )
    );
    try {
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
      await refreshFollowUpData();
      throw error;
    }
  }, [followUpAppointments, refreshFollowUpData]);

  // ===== 診斷與疫苗函數 =====
  const refreshDiagnosisData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setDiagnosisLoading(true);
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
      setDiagnosisLoading(false);
    }
  }, [isAuthenticated]);

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

  // ===== 醫院外展函數 =====
  const fetchHospitalOutreachRecords = useCallback(async () => {
    if (!isAuthenticated()) return;
    setHospitalOutreachLoading(true);
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
      setHospitalOutreachLoading(false);
    }
  }, [isAuthenticated]);

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

  const refreshHospitalOutreachData = useCallback(async () => {
    await fetchHospitalOutreachRecords();
  }, [fetchHospitalOutreachRecords]);

  const addHospitalOutreachRecord = useCallback(async (
    recordData: Omit<HospitalOutreachRecord, 'id' | 'created_at' | 'updated_at'>,
    patientName?: string
  ): Promise<HospitalOutreachRecord | null> => {
    try {
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

  // ===== 傷口函數 =====
  // 優化：getPatientsWithWounds 內部已經獲取 wounds 和 assessments，不需要重複獲取
  const refreshWoundData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setWoundLoading(true);
    try {
      // 只獲取 patientsWithWounds，它內部已經包含了 wounds 和 assessments
      const patientsWithWoundsData = await db.getPatientsWithWounds();
      setPatientsWithWounds(patientsWithWoundsData || []);
      
      // 從 patientsWithWounds 提取 wounds 和 assessments，避免重複查詢
      const allWounds: db.Wound[] = [];
      const allAssessments: db.WoundAssessment[] = [];
      (patientsWithWoundsData || []).forEach(patient => {
        patient.wounds.forEach(wound => {
          allWounds.push(wound as any);
          if (wound.assessments) {
            allAssessments.push(...wound.assessments);
          }
        });
      });
      setWounds(allWounds);
      setWoundAssessments(allAssessments);
    } catch (error) {
      console.error('Error refreshing wound data:', error);
      throw error;
    } finally {
      setWoundLoading(false);
    }
  }, [isAuthenticated]);

  const addWound = useCallback(async (wound: Omit<db.Wound, 'id' | 'created_at' | 'updated_at'>): Promise<db.Wound | null> => {
    try {
      const newWound = await db.createWound(wound);
      if (newWound) {
        await refreshWoundData();
      }
      return newWound;
    } catch (error) {
      console.error('Error adding wound:', error);
      throw error;
    }
  }, [refreshWoundData]);

  const updateWound = useCallback(async (wound: Partial<db.Wound> & { id: string }): Promise<db.Wound | null> => {
    try {
      const updatedWound = await db.updateWound(wound);
      if (updatedWound) {
        await refreshWoundData();
      }
      return updatedWound;
    } catch (error) {
      console.error('Error updating wound:', error);
      throw error;
    }
  }, [refreshWoundData]);

  const deleteWound = useCallback(async (id: string) => {
    try {
      const success = await db.deleteWound(id);
      if (success) {
        await refreshWoundData();
      }
    } catch (error) {
      console.error('Error deleting wound:', error);
      throw error;
    }
  }, [refreshWoundData]);

  const healWound = useCallback(async (woundId: string, healedDate?: string): Promise<db.Wound | null> => {
    try {
      const healedWound = await db.healWound(woundId, healedDate);
      if (healedWound) {
        await refreshWoundData();
      }
      return healedWound;
    } catch (error) {
      console.error('Error healing wound:', error);
      throw error;
    }
  }, [refreshWoundData]);

  const getWoundWithAssessments = useCallback(async (woundId: string): Promise<db.WoundWithAssessments | null> => {
    try {
      return await db.getWoundWithAssessments(woundId);
    } catch (error) {
      console.error('Error getting wound with assessments:', error);
      throw error;
    }
  }, []);

  const getWoundsNeedingAssessment = useCallback(async (): Promise<db.Wound[]> => {
    try {
      return await db.getWoundsNeedingAssessment();
    } catch (error) {
      console.error('Error getting wounds needing assessment:', error);
      throw error;
    }
  }, []);

  const generateWoundCode = useCallback(async (patientId: number): Promise<string> => {
    try {
      return await db.generateWoundCode(patientId);
    } catch (error) {
      console.error('Error generating wound code:', error);
      throw error;
    }
  }, []);

  const addWoundAssessmentForWound = useCallback(async (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => {
    try {
      await db.createWoundAssessmentForWound(assessment);
      await refreshWoundData();
    } catch (error) {
      console.error('Error adding wound assessment for wound:', error);
      throw error;
    }
  }, [refreshWoundData]);

  const addWoundAssessment = useCallback(async (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => {
    try {
      await db.createWoundAssessment(assessment);
      await refreshWoundData();
    } catch (error) {
      console.error('Error adding wound assessment:', error);
      throw error;
    }
  }, [refreshWoundData]);

  const updateWoundAssessment = useCallback(async (assessment: db.WoundAssessment) => {
    try {
      await db.updateWoundAssessment(assessment);
      await refreshWoundData();
    } catch (error) {
      console.error('Error updating wound assessment:', error);
      throw error;
    }
  }, [refreshWoundData]);

  const deleteWoundAssessment = useCallback(async (id: string) => {
    try {
      await db.deleteWoundAssessment(id);
      await refreshWoundData();
    } catch (error) {
      console.error('Error deleting wound assessment:', error);
      throw error;
    }
  }, [refreshWoundData]);

  // ===== 健康記錄函數 =====
  // dbToken 指紋：fetch 派發前捕獲，await 回來後比對「院舍｜epoch」。
  // 令牌中途會被更換（登入簽發多次、切院舍重發）；同院舍同 epoch 嘅新 JWT（
  // 定時刷新重簽）RLS 視野完全一致，結果照用；院舍/epoch 變咗先算過期。
  const currentTokenContext = (): string => {
    try {
      const t = localStorage.getItem('care_suite_db_token');
      if (!t) return 'none';
      const p = JSON.parse(atob(t.split('.')[1] || ''));
      return `${p.facility_id ?? '?'}|${p.epoch ?? '?'}`;
    } catch {
      return 'unknown';
    }
  };
  // 登入期間令牌會連環簽發（db-token → selectFacility），風暴可能持續幾秒：
  // 每次過期都稍等再用當前令牌重試，直到有一次用「落定後嘅令牌」完成
  const TOKEN_SETTLE_DELAY_MS = 1200;
  const TOKEN_SETTLE_MAX_ATTEMPTS = 6;
  // [第二階] 背景全量窗口：淨載近 1 年；更舊嘅記錄由 ensureHealthRecordsFloor 按需拉
  const FULL_LOAD_WINDOW_DAYS = 365;
  // 以 記錄id 去重合併（漸進全量 / refresh merge / floor 擴展共用）
  const mergeRecordsById = (prev: db.HealthRecord[], rows: db.HealthRecord[]): db.HealthRecord[] => {
    if (rows.length === 0) return prev;
    const ids = new Set(prev.map(r => r.記錄id));
    const fresh = rows.filter(r => !ids.has(r.記錄id));
    return fresh.length ? [...prev, ...fresh] : prev;
  };
  const formatLocalDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 初始載入近 28 天記錄（快速），HealthAssessment 頁面按需補全所有記錄
  const refreshHealthRecordData = useCallback(async () => {
    if (!isAuthenticated()) return;
    for (let attempt = 0; attempt < TOKEN_SETTLE_MAX_ATTEMPTS; attempt++) {
      const tokenCtx = currentTokenContext();
      if (tokenCtx === 'none') {
        // 無令牌不查：anon 身份會被 RLS 靜默過濾成 0 行，setState 後等同「假裝載入完成」
        console.warn('[DEBUG-db9a] 跳過監測記錄載入：無 dbToken，等待令牌簽發後補載');
        return;
      }
      setHealthRecordLoading(true);
      try {
        // 先載入近 28 天記錄讓 Dashboard 快速顯示（statement timeout 等暫時性錯誤自動退避重試）；
        // 28 天以外嘅歷史由背景全量載入補齊（小日曆舊月份補錄會喺全量完成後可用）
        const recentData = await db.withRetry(() => db.getHealthRecords({ daysBack: 28 }), 3);
        // [DEBUG-db9a] 區分「載入失敗」vs「靜默回空」（RLS/院舍不符會 0 行無錯誤）
        try {
          const t = localStorage.getItem('care_suite_db_token');
          const facilityId = t ? JSON.parse(atob(t.split('.')[1] || ''))?.facility_id : null;
          console.warn(`[DEBUG-db9a] [實例${instanceIdRef.current}] 監測記錄載入完成 rows=${recentData?.length ?? 'null'} facility=${facilityId} epoch=${t ? JSON.parse(atob(t.split('.')[1] || ''))?.epoch : null} 嘗試${attempt + 1}/${TOKEN_SETTLE_MAX_ATTEMPTS}`);
        } catch { /* 診斷日誌失敗不影響功能 */ }
        // 令牌已被更換（登入連環簽發/切院舍）：結果屬於舊上下文，稍候用新令牌重試
        if (currentTokenContext() !== tokenCtx) {
          console.warn(`[DEBUG-db9a] [實例${instanceIdRef.current}] 監測記錄結果已過期（${tokenCtx} → ${currentTokenContext()}），稍候重試`);
          await new Promise((r) => setTimeout(r, TOKEN_SETTLE_DELAY_MS));
          continue;
        }
        // 完整記錄「已載入」先好跳過：flag 同 setHealthRecords(all) 係同一個微任務原子寫入，
        // refresh 喺任何一刻檢查 flag 都唔會出現「flag 話全、state 係子集」。
        // 全量「載入緊」時改為 merge（唔係覆寫）：state 已有 28 天 + 漸進合併緊嘅歷史頁，
        // 覆寫會冇咗已 merge 嘅舊頁（cursor 已行過，唔會重拉）。refresh 失敗/靜默回空
        // 都保留 prev，唔會「由有變無」。
        if (fullHealthRecordsInFlightRef.current) {
          setHealthRecords(prev => {
            const recentIds = new Set((recentData || []).map(r => r.記錄id));
            const keep = prev.filter(r => !recentIds.has(r.記錄id));
            markSet((recentData?.length ?? 0) + keep.length, 'refresh(全量merge)');
            return [...(recentData || []), ...keep];
          });
        } else if (!isAllHealthRecordsLoadedRef.current) {
          if ((recentData?.length ?? 0) === 0) {
            setHealthRecords(prev => {
              if (prev.length > 0) {
                console.warn(`[DEBUG-db9a] [實例${instanceIdRef.current}] 監測記錄靜默回空（0 行），保留舊資料 ${prev.length} 行`);
                return prev;
              }
              markSet(0, 'refresh(空)');
              return recentData || [];
            });
          } else {
            markSet(recentData?.length ?? 0, 'refresh');
            setHealthRecords(recentData || []);
          }
        } else {
          console.warn(`[DEBUG-db9a] [實例${instanceIdRef.current}] refresh 結果被 guard 跳過（完整記錄已載入）rows=${recentData?.length ?? 0}`);
        }
        setHealthRecordLoadFailed(false);
        return;
      } catch (error) {
        console.error(`[DEBUG-db9a] 監測記錄載入失敗: code=${(error as any)?.code ?? 'none'} message=${String((error as any)?.message ?? '').slice(0, 120)}`);
        setHealthRecordLoadFailed(true);
        throw error;
      } finally {
        setHealthRecordLoading(false);
      }
    }
  }, [isAuthenticated]);

  const loadFullHealthRecords = useCallback(async () => {
    if (isAllHealthRecordsLoadedRef.current || fullHealthRecordsInFlightRef.current) return;
    for (let attempt = 0; attempt < TOKEN_SETTLE_MAX_ATTEMPTS; attempt++) {
      const tokenCtx = currentTokenContext();
      if (tokenCtx === 'none') {
        console.warn('[DEBUG-db9a] 跳過完整監測記錄載入：無 dbToken');
        return;
      }
      fullHealthRecordsInFlightRef.current = true;
      try {
        setFullHealthRecordsLoading(true);
        // [第二階] 背景全量淨載近 1 年（FULL_LOAD_WINDOW_DAYS），更舊由 ensureHealthRecordsFloor 按需拉。
        // keyset 分頁逐頁漸進 merge：歷史畫面唔使等成個窗口載完先用到；
        // 以 記錄id 去重（withRetry 重試由頭拉都冇所謂，merge 係冪等）
        const allRecords = await db.withRetry(() => db.getHealthRecords({
          sequential: true,
          daysBack: FULL_LOAD_WINDOW_DAYS,
          onPage: (rows) => {
            if (rows.length === 0) return;
            setHealthRecords(prev => {
              const merged = mergeRecordsById(prev, rows);
              if (merged !== prev) markSet(merged.length, 'full(漸進)');
              return merged;
            });
          },
        }), 2);
        // 令牌已被更換（登入連環簽發/切院舍）：結果屬於舊上下文，稍候用新令牌重試
        if (currentTokenContext() !== tokenCtx) {
          console.warn(`[DEBUG-db9a] [實例${instanceIdRef.current}] 完整監測記錄結果已過期（${tokenCtx} → ${currentTokenContext()}），稍候重試`);
          await new Promise((r) => setTimeout(r, TOKEN_SETTLE_DELAY_MS));
          continue;
        }
        markSet(allRecords?.length ?? 0, 'full(近一年)');
        setHealthRecords(allRecords);
        // 窗口下緣 = 今日 - 365 日；之後 ensureHealthRecordsFloor 可以由呢度向舊推
        const floor = new Date();
        floor.setHours(0, 0, 0, 0);
        floor.setDate(floor.getDate() - FULL_LOAD_WINDOW_DAYS);
        healthRecordsFloorDateRef.current = formatLocalDateStr(floor);
        setHealthRecordsFloorDate(healthRecordsFloorDateRef.current);
        setIsAllHealthRecordsLoaded(true);
        isAllHealthRecordsLoadedRef.current = true;
        setHealthRecordLoadFailed(false);
        return;
      } catch (error) {
        console.error('載入完整記錄失敗:', error);
        setHealthRecordLoadFailed(true);
        throw error;
      } finally {
        setFullHealthRecordsLoading(false);
        fullHealthRecordsInFlightRef.current = false;
      }
    }
  }, []);

  // [第二階] 按需向舊推窗口：篩選/畫面需要早過 floor 嘅記錄時先拉 [targetDate, floor) 併入 state。
  // 冚唥呼叫方共用同一個 state，拉一次所有畫面都用到。合併冪等，重複/並發都安全。
  const ensureHealthRecordsFloor = useCallback(async (targetDate: string) => {
    if (!isAuthenticated()) return;
    const floor = healthRecordsFloorDateRef.current;
    if (floor === null || targetDate >= floor) return;
    if (floorExtendInFlightRef.current) return;
    // 已載窗口係 [floor, 今日]，舊段係 [targetDate, floor-1]（避免重複）
    const dayBefore = new Date(floor + 'T00:00:00');
    dayBefore.setDate(dayBefore.getDate() - 1);
    const endStr = formatLocalDateStr(dayBefore);
    const tokenCtx = currentTokenContext();
    if (tokenCtx === 'none') return;
    floorExtendInFlightRef.current = true;
    try {
      await db.withRetry(() => db.getHealthRecords({
        sequential: true,
        startDate: targetDate,
        endDate: endStr,
        onPage: (rows) => {
          if (rows.length === 0) return;
          setHealthRecords(prev => {
            const merged = mergeRecordsById(prev, rows);
            if (merged !== prev) markSet(merged.length, 'floor擴展');
            return merged;
          });
        },
      }), 2);
      // 令牌已換（切院舍/重登）：唔 commit floor（合併嘅舊院資料會隨重掛丟棄，無害）
      if (currentTokenContext() !== tokenCtx) {
        console.warn(`[DEBUG-db9a] [實例${instanceIdRef.current}] floor 擴展結果已過期（${tokenCtx} → ${currentTokenContext()}），唔 commit floor`);
        return;
      }
      healthRecordsFloorDateRef.current = targetDate;
      setHealthRecordsFloorDate(targetDate);
    } catch (error) {
      console.warn('擴展監測記錄歷史窗口失敗:', error);
    } finally {
      floorExtendInFlightRef.current = false;
    }
  }, [isAuthenticated]);

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

  const addHealthRecordsForSession = useCallback(async (records: Omit<db.HealthRecord, '記錄id' | '建立時間'>[]): Promise<db.HealthRecord[]> => {
    // 樂觀更新：先以暫時 id 插入本地 state，伺服器回應後替換；失敗則移除暫時記錄
    const tempRecords = records.map(r => ({
      ...r,
      記錄id: `temp-${crypto.randomUUID()}`,
      建立時間: new Date().toISOString(),
    })) as db.HealthRecord[];
    const tempIds = new Set(tempRecords.map(t => t.記錄id));
    if (tempRecords.length > 0) {
      setHealthRecords(prev => [...tempRecords, ...prev]);
    }
    try {
      const newRecords = await db.createHealthRecordsForSession(records);
      if (newRecords.length > 0) {
        setHealthRecords(prev => [...newRecords, ...prev.filter(r => !tempIds.has(r.記錄id))]);
      } else {
        setHealthRecords(prev => prev.filter(r => !tempIds.has(r.記錄id)));
      }
      return newRecords;
    } catch (error) {
      setHealthRecords(prev => prev.filter(r => !tempIds.has(r.記錄id)));
      console.error('Error adding session health records:', error);
      throw error;
    }
  }, []);

  const updateHealthRecord = useCallback(async (record: db.HealthRecord): Promise<db.HealthRecord> => {
    try {
      const updated = await db.updateHealthRecord(record);
      setHealthRecords(prev => prev.map(r => r.記錄id === updated.記錄id ? updated : r));
      return updated;
    } catch (error) {
      console.error('Error updating health record:', error);
      throw error;
    }
  }, []);

  const deleteHealthRecord = useCallback(async (id: string): Promise<void> => {
    try {
      await db.deleteHealthRecord(id);
      setHealthRecords(prev => prev.filter(r => r.記錄id !== id));
    } catch (error) {
      console.error('Error deleting health record:', error);
      throw error;
    }
  }, []);

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
      await db.batchMoveDuplicatesToRecycleBin(duplicateRecordIds.map(String), deletedBy);
      await refreshHealthRecordData();
    } catch (error) {
      console.error('Error batch deleting duplicate records:', error);
      throw error;
    }
  }, [refreshHealthRecordData]);

  // ===== 統一刷新所有醫療數據 =====
  const refreshAllMedicalData = useCallback(async () => {
    if (!isAuthenticated()) return;
    
    // 使用 Promise.all 同時載入所有數據，減少總載入時間
    await Promise.all([
      refreshFollowUpData(),
      refreshDiagnosisData(),
      fetchHospitalOutreachRecords(),
      refreshWoundData(),
      refreshHealthRecordData(),
    ]);
  }, [isAuthenticated, refreshFollowUpData, refreshDiagnosisData, fetchHospitalOutreachRecords, refreshWoundData, refreshHealthRecordData]);

  // ===== 必要數據（Dashboard 需要）=====
  const refreshEssentialMedicalData = useCallback(async () => {
    if (!isAuthenticated()) return;
    // Dashboard 主要需要：覆診（待處理）、傷口（需處理）、健康記錄
    await Promise.all([
      refreshFollowUpData(),      // 覆診排程（Dashboard 顯示）
      refreshWoundData(),         // 傷口管理（Dashboard 顯示）
      refreshHealthRecordData(),  // 健康記錄（Dashboard 顯示）
    ]);
  }, [isAuthenticated, refreshFollowUpData, refreshWoundData, refreshHealthRecordData]);

  // ===== 非必要數據（背景載入）=====
  const refreshNonEssentialMedicalData = useCallback(async () => {
    if (!isAuthenticated()) return;
    // 這些不在 Dashboard 顯示，可以延後載入
    await Promise.all([
      refreshDiagnosisData(),         // 診斷記錄（獨立頁面使用）
      fetchHospitalOutreachRecords(), // 醫院外展（獨立頁面使用）
    ]);
  }, [isAuthenticated, refreshDiagnosisData, fetchHospitalOutreachRecords]);

  // ===== 初始載入 =====
  useEffect(() => {
    if (!isAuthenticated()) return;
    
    // 各項目獨立載入，互不阻塞（避免一個失敗導致全部失敗）
    refreshFollowUpData().catch(err => console.warn('覆診資料載入失敗:', err));
    refreshWoundData().catch(err => console.warn('傷口資料載入失敗:', err));
    refreshHealthRecordData().catch(err => console.warn('健康記錄載入失敗:', err));

    // 延遲載入非必要數據
    setTimeout(() => {
      refreshDiagnosisData().catch(err => console.warn('診斷資料載入失敗:', err));
      fetchHospitalOutreachRecords().catch(err => console.warn('外展記錄載入失敗:', err));
    }, 500);

    // 背景補全全部健康記錄（延後到啟動風暴過後，並用順序分頁溫和載入；加隨機抖動避免集中）
    setTimeout(() => {
      loadFullHealthRecords().catch(err => console.warn('背景加載完整健康記錄失敗:', err));
    }, 15000 + Math.random() * 10000);
  }, [isAuthenticated, refreshFollowUpData, refreshWoundData, refreshHealthRecordData, refreshDiagnosisData, fetchHospitalOutreachRecords, loadFullHealthRecords]);

  // ===== 統一 loading 狀態 =====
  const loading = followUpLoading || diagnosisLoading || hospitalOutreachLoading || woundLoading || healthRecordLoading;

  // ===== Context 值 =====
  const value: MedicalContextType = {
    // 覆診
    followUpAppointments,
    followUpLoading,
    addFollowUpAppointment,
    updateFollowUpAppointment,
    deleteFollowUpAppointment,
    batchUpdateFollowUpStatus,
    refreshFollowUpData,
    
    // 診斷與疫苗
    diagnosisRecords,
    vaccinationRecords,
    diagnosisLoading,
    addDiagnosisRecord,
    updateDiagnosisRecord,
    deleteDiagnosisRecord,
    addVaccinationRecord,
    updateVaccinationRecord,
    deleteVaccinationRecord,
    refreshDiagnosisData,
    
    // 醫院外展
    hospitalOutreachRecords,
    hospitalOutreachRecordHistory,
    hospitalOutreachLoading,
    fetchHospitalOutreachRecords,
    fetchHospitalOutreachRecordHistory,
    addHospitalOutreachRecord,
    updateHospitalOutreachRecord,
    deleteHospitalOutreachRecord,
    refreshHospitalOutreachData,
    
    // 傷口
    wounds,
    woundAssessments,
    patientsWithWounds,
    woundLoading,
    addWound,
    updateWound,
    deleteWound,
    healWound,
    getWoundWithAssessments,
    getWoundsNeedingAssessment,
    generateWoundCode,
    addWoundAssessmentForWound,
    addWoundAssessment,
    updateWoundAssessment,
    deleteWoundAssessment,
    refreshWoundData,
    
    // 健康記錄
    healthRecords,
    deletedHealthRecords,
    isAllHealthRecordsLoaded,
    healthRecordLoading,
    healthRecordLoadFailed,
    fullHealthRecordsLoading,
    __debugInstanceId: instanceIdRef.current,
    addHealthRecord,
    addHealthRecordsForSession,
    updateHealthRecord,
    deleteHealthRecord,
    fetchDeletedHealthRecords,
    restoreHealthRecord,
    permanentlyDeleteHealthRecord,
    findDuplicateHealthRecords,
    batchDeleteDuplicateRecords,
    loadFullHealthRecords,
    healthRecordsFloorDate,
    ensureHealthRecordsFloor,
    refreshHealthRecordData,
    
    // 統一
    loading,
    refreshAllMedicalData,
  };

  return (
    <MedicalContext.Provider value={value}>
      {children}
    </MedicalContext.Provider>
  );
}

// ========== Hooks ==========
/**
 * useMedical - 完整醫療 Context hook
 */
export function useMedical(): MedicalContextType {
  const context = useContext(MedicalContext);
  if (context === undefined) {
    throw new Error('useMedical must be used within a MedicalProvider');
  }
  return context;
}

// ========== 向後兼容的獨立 Hooks ==========
/**
 * useFollowUp - 覆診相關 (向後兼容)
 */
export function useFollowUp() {
  const ctx = useMedical();
  return {
    followUpAppointments: ctx.followUpAppointments,
    loading: ctx.followUpLoading,
    addFollowUpAppointment: ctx.addFollowUpAppointment,
    updateFollowUpAppointment: ctx.updateFollowUpAppointment,
    deleteFollowUpAppointment: ctx.deleteFollowUpAppointment,
    batchUpdateFollowUpStatus: ctx.batchUpdateFollowUpStatus,
    refreshFollowUpData: ctx.refreshFollowUpData,
  };
}

export function useFollowUpData() {
  const { followUpAppointments, followUpLoading } = useMedical();
  return { followUpAppointments, loading: followUpLoading };
}

/**
 * useDiagnosis - 診斷與疫苗相關 (向後兼容)
 */
export function useDiagnosis() {
  const ctx = useMedical();
  return {
    diagnosisRecords: ctx.diagnosisRecords,
    vaccinationRecords: ctx.vaccinationRecords,
    loading: ctx.diagnosisLoading,
    addDiagnosisRecord: ctx.addDiagnosisRecord,
    updateDiagnosisRecord: ctx.updateDiagnosisRecord,
    deleteDiagnosisRecord: ctx.deleteDiagnosisRecord,
    addVaccinationRecord: ctx.addVaccinationRecord,
    updateVaccinationRecord: ctx.updateVaccinationRecord,
    deleteVaccinationRecord: ctx.deleteVaccinationRecord,
    refreshDiagnosisData: ctx.refreshDiagnosisData,
  };
}

export function useDiagnosisData() {
  const { diagnosisRecords, vaccinationRecords, diagnosisLoading } = useMedical();
  return { diagnosisRecords, vaccinationRecords, loading: diagnosisLoading };
}

/**
 * useHospitalOutreach - 醫院外展相關 (向後兼容)
 */
export function useHospitalOutreach() {
  const ctx = useMedical();
  return {
    hospitalOutreachRecords: ctx.hospitalOutreachRecords,
    hospitalOutreachRecordHistory: ctx.hospitalOutreachRecordHistory,
    loading: ctx.hospitalOutreachLoading,
    fetchHospitalOutreachRecords: ctx.fetchHospitalOutreachRecords,
    fetchHospitalOutreachRecordHistory: ctx.fetchHospitalOutreachRecordHistory,
    addHospitalOutreachRecord: ctx.addHospitalOutreachRecord,
    updateHospitalOutreachRecord: ctx.updateHospitalOutreachRecord,
    deleteHospitalOutreachRecord: ctx.deleteHospitalOutreachRecord,
    refreshHospitalOutreachData: ctx.refreshHospitalOutreachData,
  };
}

/**
 * useWound - 傷口相關 (向後兼容)
 */
export function useWound() {
  const ctx = useMedical();
  return {
    wounds: ctx.wounds,
    woundAssessments: ctx.woundAssessments,
    patientsWithWounds: ctx.patientsWithWounds,
    loading: ctx.woundLoading,
    addWound: ctx.addWound,
    updateWound: ctx.updateWound,
    deleteWound: ctx.deleteWound,
    healWound: ctx.healWound,
    getWoundWithAssessments: ctx.getWoundWithAssessments,
    getWoundsNeedingAssessment: ctx.getWoundsNeedingAssessment,
    generateWoundCode: ctx.generateWoundCode,
    addWoundAssessmentForWound: ctx.addWoundAssessmentForWound,
    addWoundAssessment: ctx.addWoundAssessment,
    updateWoundAssessment: ctx.updateWoundAssessment,
    deleteWoundAssessment: ctx.deleteWoundAssessment,
    refreshWoundData: ctx.refreshWoundData,
  };
}

export function useWoundData() {
  const { wounds, woundAssessments, patientsWithWounds, woundLoading } = useMedical();
  return { wounds, woundAssessments, patientsWithWounds, loading: woundLoading };
}

/**
 * useHealthRecord - 健康記錄相關 (向後兼容)
 */
export function useHealthRecord() {
  const ctx = useMedical();
  return {
    healthRecords: ctx.healthRecords,
    deletedHealthRecords: ctx.deletedHealthRecords,
    isAllHealthRecordsLoaded: ctx.isAllHealthRecordsLoaded,
    loading: ctx.healthRecordLoading,
    healthRecordLoadFailed: ctx.healthRecordLoadFailed,
    addHealthRecord: ctx.addHealthRecord,
    addHealthRecordsForSession: ctx.addHealthRecordsForSession,
    updateHealthRecord: ctx.updateHealthRecord,
    deleteHealthRecord: ctx.deleteHealthRecord,
    fetchDeletedHealthRecords: ctx.fetchDeletedHealthRecords,
    restoreHealthRecord: ctx.restoreHealthRecord,
    permanentlyDeleteHealthRecord: ctx.permanentlyDeleteHealthRecord,
    findDuplicateHealthRecords: ctx.findDuplicateHealthRecords,
    batchDeleteDuplicateRecords: ctx.batchDeleteDuplicateRecords,
    loadFullHealthRecords: ctx.loadFullHealthRecords,
    healthRecordsFloorDate: ctx.healthRecordsFloorDate,
    ensureHealthRecordsFloor: ctx.ensureHealthRecordsFloor,
    refreshHealthRecordData: ctx.refreshHealthRecordData,
    __debugInstanceId: ctx.__debugInstanceId,
  };
}

export function useHealthRecordData() {
  const { healthRecords, deletedHealthRecords, isAllHealthRecordsLoaded, healthRecordLoading } = useMedical();
  return { healthRecords, deletedHealthRecords, isAllHealthRecordsLoaded, loading: healthRecordLoading };
}

export default MedicalContext;
