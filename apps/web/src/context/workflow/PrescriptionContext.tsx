/**
 * PrescriptionContext - 處方管理 Context
 * 
 * 從 PatientContext 拆分出來，專門處理處方相關功能：
 * - 處方 CRUD (prescriptions)
 * - 藥物資料庫 (drugDatabase)
 * - 處方工作流程記錄 (prescriptionWorkflowRecords)
 * - 處方時段定義 (prescriptionTimeSlotDefinitions)
 * - 執藥、核藥、派藥操作
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthContext';

// ========== 類型定義 ==========
// 處方工作流程記錄類型
export interface PrescriptionWorkflowRecord {
  id: string;
  prescription_id: string;
  patient_id: number;
  scheduled_date: string;
  scheduled_time: string;
  meal_timing?: string;
  preparation_status: 'pending' | 'completed' | 'failed';
  verification_status: 'pending' | 'completed' | 'failed';
  dispensing_status: 'pending' | 'completed' | 'failed';
  preparation_staff?: string;
  verification_staff?: string;
  dispensing_staff?: string;
  preparation_time?: string;
  verification_time?: string;
  dispensing_time?: string;
  dispensing_failure_reason?: string;
  custom_failure_reason?: string;
  inspection_check_result?: any;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 檢測項檢查結果類型
export interface InspectionCheckResult {
  canDispense: boolean;
  blockedRules: Array<{
    vital_sign_type: string;
    condition_operator: string;
    condition_value: number;
    actual_value: number;
    action_if_met: string;
  }>;
  usedVitalSignData: {
    [key: string]: number;
  };
  missingVitalSigns?: string[];
  message?: string;
}

// 處方時段定義類型
export interface PrescriptionTimeSlotDefinition {
  id: string;
  slot_name: string;
  start_time?: string;
  end_time?: string;
  is_meal_related: boolean;
  meal_type?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface PrescriptionContextType {
  // 狀態
  prescriptions: db.MedicationPrescription[];
  drugDatabase: any[];
  prescriptionWorkflowRecords: PrescriptionWorkflowRecord[];
  prescriptionTimeSlotDefinitions: PrescriptionTimeSlotDefinition[];
  loading: boolean;
  
  // 處方 CRUD
  addPrescription: (prescription: any) => Promise<void>;
  updatePrescription: (prescription: any) => Promise<void>;
  deletePrescription: (id: number) => Promise<void>;
  
  // 藥品資料庫 CRUD
  addDrug: (drug: Omit<any, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDrug: (drug: any) => Promise<void>;
  deleteDrug: (id: string) => Promise<void>;
  
  // 工作流程記錄
  fetchPrescriptionWorkflowRecords: (patientId?: number, date?: string) => Promise<PrescriptionWorkflowRecord[]>;
  createPrescriptionWorkflowRecord: (recordData: Omit<PrescriptionWorkflowRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePrescriptionWorkflowRecord: (recordId: string, updateData: Partial<PrescriptionWorkflowRecord>) => Promise<void>;
  
  // 藥物操作
  prepareMedication: (recordId: string, staffId: string, unused1?: any, unused2?: any, patientId?: number, scheduledDate?: string) => Promise<void>;
  verifyMedication: (recordId: string, staffId: string, unused1?: any, unused2?: any, patientId?: number, scheduledDate?: string) => Promise<void>;
  dispenseMedication: (recordId: string, staffId: string, failureReason?: string, customReason?: string, patientId?: number, scheduledDate?: string, notes?: string, inspectionCheckResult?: any) => Promise<void>;
  revertPrescriptionWorkflowStep: (recordId: string, step: 'preparation' | 'verification' | 'dispensing', patientId?: number, scheduledDate?: string) => Promise<void>;
  
  // 檢測規則
  checkPrescriptionInspectionRules: (prescriptionId: string, patientId: number, scheduledDate?: string, scheduledTime?: string) => Promise<InspectionCheckResult>;
  fetchLatestVitalSigns: (patientId: number, vitalSignType: string, targetDate?: string, targetTime?: string) => Promise<{ record: db.HealthRecord | null; isExactMatch: boolean }>;
  batchSetDispenseFailure: (patientId: number, date: string, time: string, reason: string, customReason?: string) => Promise<void>;
  
  // 時段定義
  fetchPrescriptionTimeSlotDefinitions: () => Promise<PrescriptionTimeSlotDefinition[]>;
  addPrescriptionTimeSlotDefinition: (definition: Omit<PrescriptionTimeSlotDefinition, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePrescriptionTimeSlotDefinition: (definition: PrescriptionTimeSlotDefinition) => Promise<void>;
  deletePrescriptionTimeSlotDefinition: (id: string) => Promise<void>;
  
  // 刷新數據
  refreshPrescriptionData: () => Promise<void>;
}

// 只讀數據 Hook 的類型
interface PrescriptionDataType {
  prescriptions: db.MedicationPrescription[];
  drugDatabase: any[];
  prescriptionWorkflowRecords: PrescriptionWorkflowRecord[];
  prescriptionTimeSlotDefinitions: PrescriptionTimeSlotDefinition[];
  loading: boolean;
}

// ========== Context 創建 ==========
const PrescriptionContext = createContext<PrescriptionContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface PrescriptionProviderProps {
  children: ReactNode;
}

export function PrescriptionProvider({ children }: PrescriptionProviderProps) {
  const { user, displayName } = useAuth();
  
  // 狀態定義
  const [prescriptions, setPrescriptions] = useState<db.MedicationPrescription[]>([]);
  const [drugDatabase, setDrugDatabase] = useState<any[]>([]);
  const [prescriptionWorkflowRecords, setPrescriptionWorkflowRecords] = useState<PrescriptionWorkflowRecord[]>([]);
  const [prescriptionTimeSlotDefinitions, setPrescriptionTimeSlotDefinitions] = useState<PrescriptionTimeSlotDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ========== 刷新數據 ==========
  const refreshPrescriptionData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [prescriptionsData, drugDatabaseData, workflowRecordsData, timeSlotDefinitionsData] = await Promise.all([
        db.getPrescriptions(),
        db.getDrugDatabase(),
        fetchPrescriptionWorkflowRecordsInternal(undefined, undefined, true),
        db.getPrescriptionTimeSlotDefinitions()
      ]);
      
      setPrescriptions(prescriptionsData || []);
      setDrugDatabase(drugDatabaseData || []);
      setPrescriptionWorkflowRecords(workflowRecordsData || []);
      setPrescriptionTimeSlotDefinitions(timeSlotDefinitionsData || []);
    } catch (error) {
      console.error('Error refreshing prescription data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // ========== 內部工作流程記錄獲取函數 ==========
  const fetchPrescriptionWorkflowRecordsInternal = async (patientId?: number, scheduledDate?: string, skipStateUpdate = false): Promise<PrescriptionWorkflowRecord[]> => {
    try {
      const validPatientId = (patientId !== undefined && patientId !== null && !isNaN(patientId) && patientId > 0) ? patientId : null;
      const validScheduledDate = (scheduledDate && typeof scheduledDate === 'string' && scheduledDate.trim() !== '' && scheduledDate !== 'undefined') ? scheduledDate.trim() : null;
      let query = supabase.from('medication_workflow_records').select('*');
      if (validPatientId !== null) {
        query = query.eq('patient_id', validPatientId);
      }
      if (validScheduledDate !== null) {
        query = query.eq('scheduled_date', validScheduledDate);
      }
      const { data: queryData, error: queryError } = await query.order('scheduled_time');
      if (queryError) {
        throw new Error(`查詢工作流程記錄失敗: ${queryError.message}`);
      }
      if (!skipStateUpdate) {
        setPrescriptionWorkflowRecords(queryData || []);
      }
      return queryData || [];
    } catch (error) {
      console.error('獲取處方工作流程記錄失敗:', error);
      if (!skipStateUpdate) {
        setPrescriptionWorkflowRecords([]);
      }
      return [];
    }
  };
  
  // ========== 處方 CRUD ==========
  const addPrescription = useCallback(async (prescription: any) => {
    try {
      await db.createPrescription(prescription);
      await refreshPrescriptionData();
    } catch (error) {
      console.error('Error adding prescription:', error);
      throw error;
    }
  }, [refreshPrescriptionData]);
  
  const updatePrescription = useCallback(async (prescription: any) => {
    try {
      if (prescription.status === 'inactive' && !prescription.end_date) {
        throw new Error('停用處方必須設定結束日期');
      }
      await db.updatePrescription(prescription);
      await refreshPrescriptionData();
    } catch (error) {
      console.error('Error updating prescription:', error);
      throw error;
    }
  }, [refreshPrescriptionData]);
  
  const deletePrescription = useCallback(async (id: number) => {
    try {
      await db.deletePrescription(id);
      await refreshPrescriptionData();
    } catch (error) {
      console.error('Error deleting prescription:', error);
      throw error;
    }
  }, [refreshPrescriptionData]);
  
  // ========== 藥品資料庫 CRUD ==========
  const addDrug = useCallback(async (drug: Omit<any, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createDrug(drug);
      await refreshPrescriptionData();
    } catch (error) {
      console.error('Error adding drug:', error);
      throw error;
    }
  }, [refreshPrescriptionData]);
  
  const updateDrug = useCallback(async (drug: any) => {
    try {
      await db.updateDrug(drug);
      await refreshPrescriptionData();
    } catch (error) {
      console.error('Error updating drug:', error);
      throw error;
    }
  }, [refreshPrescriptionData]);
  
  const deleteDrug = useCallback(async (id: string) => {
    try {
      await db.deleteDrug(id);
      await refreshPrescriptionData();
    } catch (error) {
      console.error('Error deleting drug:', error);
      throw error;
    }
  }, [refreshPrescriptionData]);
  
  // ========== 工作流程記錄 ==========
  const fetchPrescriptionWorkflowRecords = useCallback(async (patientId?: number, scheduledDate?: string): Promise<PrescriptionWorkflowRecord[]> => {
    return fetchPrescriptionWorkflowRecordsInternal(patientId, scheduledDate, false);
  }, []);
  
  const createPrescriptionWorkflowRecord = useCallback(async (recordData: Omit<PrescriptionWorkflowRecord, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createMedicationWorkflowRecord(recordData);
    } catch (error) {
      console.error('Error creating prescription workflow record:', error);
      throw error;
    }
  }, []);
  
  const updatePrescriptionWorkflowRecord = useCallback(async (recordId: string, updateData: Partial<PrescriptionWorkflowRecord>) => {
    try {
      await db.updateMedicationWorkflowRecord({ id: recordId, ...updateData } as any);
      await fetchPrescriptionWorkflowRecordsInternal();
    } catch (error) {
      console.error('Error updating prescription workflow record:', error);
      throw error;
    }
  }, []);
  
  // ========== 藥物操作 ==========
  const prepareMedication = useCallback(async (
    recordId: string,
    staffId: string,
    _unused1?: any,
    _unused2?: any,
    patientId?: number,
    scheduledDate?: string
  ) => {
    try {
      const updateData = {
        preparation_status: 'completed' as const,
        preparation_staff: staffId,
        preparation_time: new Date().toISOString()
      };
      await db.updateMedicationWorkflowRecord({ id: recordId, ...updateData } as any);
      setPrescriptionWorkflowRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, ...updateData } : r)
      );
    } catch (error) {
      console.error('執藥操作失敗:', error);
      throw error;
    }
  }, []);
  
  const verifyMedication = useCallback(async (
    recordId: string,
    staffId: string,
    _unused1?: any,
    _unused2?: any,
    patientId?: number,
    scheduledDate?: string
  ) => {
    try {
      const updateData = {
        verification_status: 'completed' as const,
        verification_staff: staffId,
        verification_time: new Date().toISOString()
      };
      await db.updateMedicationWorkflowRecord({ id: recordId, ...updateData } as any);
      setPrescriptionWorkflowRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, ...updateData } : r)
      );
    } catch (error) {
      console.error('核藥操作失敗:', error);
      throw error;
    }
  }, []);
  
  const dispenseMedication = useCallback(async (
    recordId: string,
    staffId: string,
    failureReason?: string,
    customReason?: string,
    patientId?: number,
    scheduledDate?: string,
    notes?: string,
    inspectionCheckResult?: any
  ) => {
    try {
      const updateData: any = {
        dispensing_staff: staffId,
        dispensing_time: new Date().toISOString()
      };
      if (failureReason) {
        updateData.dispensing_status = 'failed';
        updateData.dispensing_failure_reason = failureReason;
        if (customReason) {
          updateData.custom_failure_reason = customReason;
        }
      } else {
        updateData.dispensing_status = 'completed';
        updateData.dispensing_failure_reason = null;
        updateData.custom_failure_reason = null;
      }
      if (notes) {
        updateData.notes = notes;
      }
      if (inspectionCheckResult) {
        updateData.inspection_check_result = inspectionCheckResult;
      }
      await db.updateMedicationWorkflowRecord({ id: recordId, ...updateData } as any);
      setPrescriptionWorkflowRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, ...updateData } : r)
      );
    } catch (error) {
      console.error('派藥操作失敗:', error);
      throw error;
    }
  }, []);
  
  const revertPrescriptionWorkflowStep = useCallback(async (
    recordId: string,
    step: 'preparation' | 'verification' | 'dispensing',
    patientId?: number,
    scheduledDate?: string
  ) => {
    try {
      const updateData: any = {};
      if (step === 'preparation') {
        updateData.preparation_status = 'pending';
        updateData.preparation_staff = null;
        updateData.preparation_time = null;
      } else if (step === 'verification') {
        updateData.verification_status = 'pending';
        updateData.verification_staff = null;
        updateData.verification_time = null;
      } else if (step === 'dispensing') {
        updateData.dispensing_status = 'pending';
        updateData.dispensing_staff = null;
        updateData.dispensing_time = null;
        updateData.dispensing_failure_reason = null;
        updateData.custom_failure_reason = null;
        updateData.notes = null;
        updateData.inspection_check_result = null;
      }
      await db.updateMedicationWorkflowRecord({ id: recordId, ...updateData } as any);
      setPrescriptionWorkflowRecords(prev =>
        prev.map(r => r.id === recordId ? { ...r, ...updateData } : r)
      );
    } catch (error) {
      console.error('撤銷步驟失敗:', error);
      throw error;
    }
  }, []);
  
  // ========== 檢測規則 ==========
  const checkPrescriptionInspectionRules = useCallback(async (
    prescriptionId: string,
    patientId: number,
    scheduledDate?: string,
    scheduledTime?: string
  ): Promise<InspectionCheckResult> => {
    try {
      const prescription = prescriptions.find(p => p.id === prescriptionId) as any;
      if (!prescription || !prescription.inspection_rules || prescription.inspection_rules.length === 0) {
        return { canDispense: true, blockedRules: [], usedVitalSignData: {}, missingVitalSigns: [] };
      }
      const blockedRules: any[] = [];
      const usedVitalSignData: any = {};
      const missingVitalSigns: string[] = [];
      for (const rule of prescription.inspection_rules) {
        let healthRecord: db.HealthRecord | null = null;
        if (scheduledDate && scheduledTime) {
          healthRecord = await db.getHealthRecordByDateTime(
            patientId,
            scheduledDate,
            scheduledTime,
            rule.vital_sign_type
          );
        }
        if (!healthRecord) {
          missingVitalSigns.push(rule.vital_sign_type);
          continue;
        }
        const vitalSignFieldMap: Record<string, keyof db.HealthRecord> = {
          '上壓': '血壓收縮壓',
          '下壓': '血壓舒張壓',
          '脈搏': '脈搏',
          '血糖值': '血糖值',
          '呼吸': '呼吸頻率',
          '血含氧量': '血含氧量',
          '體溫': '體溫'
        };
        const fieldName = vitalSignFieldMap[rule.vital_sign_type];
        const fieldValue = healthRecord[fieldName];
        if (fieldValue === null || fieldValue === undefined) {
          missingVitalSigns.push(rule.vital_sign_type);
          continue;
        }
        const value = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue));
        usedVitalSignData[rule.vital_sign_type] = value;
        const conditionValue = parseFloat(String(rule.condition_value));
        let isBlocked = false;
        switch (rule.condition_operator) {
          case 'gt':
            isBlocked = value <= conditionValue;
            break;
          case 'lt':
            isBlocked = value >= conditionValue;
            break;
          case 'gte':
            isBlocked = value < conditionValue;
            break;
          case 'lte':
            isBlocked = value > conditionValue;
            break;
        }
        if (isBlocked) {
          blockedRules.push({
            vital_sign_type: rule.vital_sign_type,
            actual_value: value,
            condition_operator: rule.condition_operator,
            condition_value: conditionValue
          });
        }
      }
      return {
        canDispense: blockedRules.length === 0 && missingVitalSigns.length === 0,
        blockedRules,
        usedVitalSignData,
        missingVitalSigns
      };
    } catch (error) {
      console.error('檢查檢測規則失敗:', error);
      return { canDispense: false, blockedRules: [], usedVitalSignData: {}, missingVitalSigns: [] };
    }
  }, [prescriptions]);
  
  const fetchLatestVitalSigns = useCallback(async (
    patientId: number,
    vitalSignType: string,
    targetDate?: string,
    targetTime?: string
  ): Promise<{ record: db.HealthRecord | null; isExactMatch: boolean }> => {
    try {
      if (targetDate && targetTime) {
        const record = await db.getHealthRecordByDateTime(
          patientId,
          targetDate,
          targetTime,
          vitalSignType
        );
        return record ? { record, isExactMatch: true } : { record: null, isExactMatch: false };
      }
      const records = await db.getHealthRecords();
      const filtered = records.filter(r => r.院友id === patientId);
      if (filtered.length === 0) return { record: null, isExactMatch: false };
      filtered.sort((a, b) => {
        const dateA = new Date(`${a.記錄日期}T${a.記錄時間 || '00:00:00'}`);
        const dateB = new Date(`${b.記錄日期}T${b.記錄時間 || '00:00:00'}`);
        return dateB.getTime() - dateA.getTime();
      });
      const vitalSignFieldMap: Record<string, keyof db.HealthRecord> = {
        '上壓': '血壓收縮壓',
        '下壓': '血壓舒張壓',
        '脈搏': '脈搏',
        '血糖值': '血糖值',
        '呼吸': '呼吸頻率',
        '血含氧量': '血含氧量',
        '體溫': '體溫'
      };
      const fieldName = vitalSignFieldMap[vitalSignType];
      const recordWithValue = filtered.find(r => r[fieldName] !== null && r[fieldName] !== undefined);
      return { record: recordWithValue || null, isExactMatch: false };
    } catch (error) {
      console.error('獲取生命表徵失敗:', error);
      return { record: null, isExactMatch: false };
    }
  }, []);
  
  const batchSetDispenseFailure = useCallback(async (
    patientId: number,
    date: string,
    time: string,
    reason: string,
    customReason?: string
  ) => {
    try {
      const records = prescriptionWorkflowRecords.filter(
        r => r.patient_id === patientId &&
        r.scheduled_date === date &&
        r.scheduled_time === time &&
        r.dispensing_status === 'pending'
      );
      await Promise.all(
        records.map(record =>
          dispenseMedication(
            record.id,
            displayName || '未知',
            reason,
            customReason,
            patientId,
            date
          )
        )
      );
    } catch (error) {
      console.error('批量設定派藥失敗:', error);
      throw error;
    }
  }, [prescriptionWorkflowRecords, displayName, dispenseMedication]);
  
  // ========== 時段定義 ==========
  const loadPrescriptionTimeSlotDefinitions = async () => {
    try {
      const definitions = await db.getPrescriptionTimeSlotDefinitions();
      setPrescriptionTimeSlotDefinitions(definitions);
    } catch (error) {
      console.error('Error loading prescription time slot definitions:', error);
      throw error;
    }
  };
  
  const fetchPrescriptionTimeSlotDefinitions = useCallback(async (): Promise<PrescriptionTimeSlotDefinition[]> => {
    try {
      return await db.getPrescriptionTimeSlotDefinitions();
    } catch (error) {
      console.error('Error fetching prescription time slot definitions:', error);
      throw error;
    }
  }, []);
  
  const addPrescriptionTimeSlotDefinition = useCallback(async (definition: Omit<PrescriptionTimeSlotDefinition, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.addPrescriptionTimeSlotDefinition(definition);
      await loadPrescriptionTimeSlotDefinitions();
    } catch (error) {
      console.error('Error adding prescription time slot definition:', error);
      throw error;
    }
  }, []);
  
  const updatePrescriptionTimeSlotDefinition = useCallback(async (definition: PrescriptionTimeSlotDefinition) => {
    try {
      await db.updatePrescriptionTimeSlotDefinition(definition);
      await loadPrescriptionTimeSlotDefinitions();
    } catch (error) {
      console.error('Error updating prescription time slot definition:', error);
      throw error;
    }
  }, []);
  
  const deletePrescriptionTimeSlotDefinition = useCallback(async (id: string) => {
    try {
      await db.deletePrescriptionTimeSlotDefinition(id);
      await loadPrescriptionTimeSlotDefinitions();
    } catch (error) {
      console.error('Error deleting prescription time slot definition:', error);
      throw error;
    }
  }, []);
  
  // 自動刷新資料
  useEffect(() => {
    refreshPrescriptionData();
  }, [refreshPrescriptionData]);
  
  // Context 值
  const value: PrescriptionContextType = {
    // 狀態
    prescriptions,
    drugDatabase,
    prescriptionWorkflowRecords,
    prescriptionTimeSlotDefinitions,
    loading,
    
    // 處方 CRUD
    addPrescription,
    updatePrescription,
    deletePrescription,
    
    // 藥品資料庫 CRUD
    addDrug,
    updateDrug,
    deleteDrug,
    
    // 工作流程記錄
    fetchPrescriptionWorkflowRecords,
    createPrescriptionWorkflowRecord,
    updatePrescriptionWorkflowRecord,
    
    // 藥物操作
    prepareMedication,
    verifyMedication,
    dispenseMedication,
    revertPrescriptionWorkflowStep,
    
    // 檢測規則
    checkPrescriptionInspectionRules,
    fetchLatestVitalSigns,
    batchSetDispenseFailure,
    
    // 時段定義
    fetchPrescriptionTimeSlotDefinitions,
    addPrescriptionTimeSlotDefinition,
    updatePrescriptionTimeSlotDefinition,
    deletePrescriptionTimeSlotDefinition,
    
    // 刷新
    refreshPrescriptionData,
  };
  
  return (
    <PrescriptionContext.Provider value={value}>
      {children}
    </PrescriptionContext.Provider>
  );
}

// ========== Hooks ==========
/**
 * 完整的處方 Context（包含 CRUD 操作）
 */
export function usePrescription(): PrescriptionContextType {
  const context = useContext(PrescriptionContext);
  if (context === undefined) {
    throw new Error('usePrescription must be used within a PrescriptionProvider');
  }
  return context;
}

/**
 * 只讀數據 Hook - 用於只需要讀取數據的組件
 */
export function usePrescriptionData(): PrescriptionDataType {
  const { prescriptions, drugDatabase, prescriptionWorkflowRecords, prescriptionTimeSlotDefinitions, loading } = usePrescription();
  return { prescriptions, drugDatabase, prescriptionWorkflowRecords, prescriptionTimeSlotDefinitions, loading };
}

export default PrescriptionContext;
