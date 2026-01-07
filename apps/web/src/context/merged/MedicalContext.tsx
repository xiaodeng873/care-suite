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
  addHealthRecord: (record: Omit<db.HealthRecord, '記錄id'>) => Promise<db.HealthRecord>;
  updateHealthRecord: (record: db.HealthRecord) => Promise<void>;
  deleteHealthRecord: (id: number) => Promise<void>;
  fetchDeletedHealthRecords: () => Promise<void>;
  restoreHealthRecord: (deletedRecordId: string) => Promise<void>;
  permanentlyDeleteHealthRecord: (deletedRecordId: string) => Promise<void>;
  findDuplicateHealthRecords: () => Promise<db.DuplicateRecordGroup[]>;
  batchDeleteDuplicateRecords: (duplicateRecordIds: number[], deletedBy?: string) => Promise<void>;
  loadFullHealthRecords: () => Promise<void>;
  refreshHealthRecordData: () => Promise<void>;
  
  // ===== 統一加載狀態 =====
  loading: boolean;
  
  // ===== 統一刷新 =====
  refreshAllMedicalData: () => Promise<void>;
}

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
  const refreshWoundData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setWoundLoading(true);
    try {
      const [woundsData, patientsWithWoundsData, woundAssessmentsData] = await Promise.all([
        db.getWounds(),
        db.getPatientsWithWounds(),
        db.getWoundAssessments()
      ]);
      setWounds(woundsData || []);
      setPatientsWithWounds(patientsWithWoundsData || []);
      setWoundAssessments(woundAssessmentsData || []);
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
  const refreshHealthRecordData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setHealthRecordLoading(true);
    try {
      const healthRecordsData = await db.getHealthRecords();
      setHealthRecords(healthRecordsData || []);
    } catch (error) {
      console.error('Error refreshing health record data:', error);
      throw error;
    } finally {
      setHealthRecordLoading(false);
    }
  }, [isAuthenticated]);

  const loadFullHealthRecords = useCallback(async () => {
    if (isAllHealthRecordsLoadedRef.current) return;
    setHealthRecordLoading(true);
    try {
      const allRecords = await db.getHealthRecords();
      setHealthRecords(allRecords);
      setIsAllHealthRecordsLoaded(true);
      isAllHealthRecordsLoadedRef.current = true;
    } catch (error) {
      console.error('載入完整記錄失敗:', error);
      throw error;
    } finally {
      setHealthRecordLoading(false);
    }
  }, []);

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
      await db.batchMoveDuplicatesToRecycleBin(duplicateRecordIds, deletedBy);
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

  // ===== 初始載入 =====
  useEffect(() => {
    if (!isAuthenticated()) return;
    
    // 使用 Promise.all 同時載入所有數據
    refreshAllMedicalData();
  }, [isAuthenticated, refreshAllMedicalData]);

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
    addHealthRecord,
    updateHealthRecord,
    deleteHealthRecord,
    fetchDeletedHealthRecords,
    restoreHealthRecord,
    permanentlyDeleteHealthRecord,
    findDuplicateHealthRecords,
    batchDeleteDuplicateRecords,
    loadFullHealthRecords,
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
    addHealthRecord: ctx.addHealthRecord,
    updateHealthRecord: ctx.updateHealthRecord,
    deleteHealthRecord: ctx.deleteHealthRecord,
    fetchDeletedHealthRecords: ctx.fetchDeletedHealthRecords,
    restoreHealthRecord: ctx.restoreHealthRecord,
    permanentlyDeleteHealthRecord: ctx.permanentlyDeleteHealthRecord,
    findDuplicateHealthRecords: ctx.findDuplicateHealthRecords,
    batchDeleteDuplicateRecords: ctx.batchDeleteDuplicateRecords,
    loadFullHealthRecords: ctx.loadFullHealthRecords,
    refreshHealthRecordData: ctx.refreshHealthRecordData,
  };
}

export function useHealthRecordData() {
  const { healthRecords, deletedHealthRecords, isAllHealthRecordsLoaded, healthRecordLoading } = useMedical();
  return { healthRecords, deletedHealthRecords, isAllHealthRecordsLoaded, loading: healthRecordLoading };
}

export default MedicalContext;
