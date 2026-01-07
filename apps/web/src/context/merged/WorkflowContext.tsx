/**
 * WorkflowContext - 合併的工作流程 Context
 * 
 * 將以下 Context 合併為一個，減少 Provider 嵌套層級，提升性能：
 * - ScheduleContext (VMO排程、醫生就診排程)
 * - PrescriptionContext (處方、藥物、工作流程記錄)
 * 
 * 內部使用 React Query 實現：
 * - 自動緩存和去重
 * - 背景更新
 * - 樂觀更新
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as db from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthContext';
import { queryKeys } from '../../lib/queryClient';
import {
  useSchedules,
  useDoctorVisitSchedule,
  usePrescriptions,
  useDrugDatabase,
  usePrescriptionTimeSlotDefinitions,
  useAddSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useAddDoctorVisitSchedule,
  useUpdateDoctorVisitSchedule,
  useDeleteDoctorVisitSchedule,
  usePrepareMedication,
  useVerifyMedication,
  useDispenseMedication,
  useRevertPrescriptionWorkflowStep,
  useBatchSetDispenseFailure,
  useAddDrug,
  useUpdateDrug,
  useDeleteDrug,
  useAddPrescriptionTimeSlotDefinition,
  useUpdatePrescriptionTimeSlotDefinition,
  useDeletePrescriptionTimeSlotDefinition,
} from '../../hooks/queries/useWorkflowQueries';

// ========== 類型定義 ==========
// Extended schedule interface for UI
export interface ScheduleWithDetails extends db.Schedule {
  院友列表: db.ScheduleDetail[];
}

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

// ========== Context 類型定義 ==========
interface WorkflowContextType {
  // ===== 排程相關 =====
  schedules: ScheduleWithDetails[];
  doctorVisitSchedule: any[];
  scheduleLoading: boolean;
  addSchedule: (schedule: Omit<db.Schedule, '排程id'>) => Promise<void>;
  updateSchedule: (schedule: ScheduleWithDetails) => Promise<void>;
  deleteSchedule: (id: number) => Promise<void>;
  addPatientToSchedule: (scheduleId: number, patientId: number, symptoms: string, notes: string, reasons: string[]) => Promise<void>;
  updateScheduleDetail: (detailData: { 細項id: number; 症狀說明: string; 備註: string; reasonIds: number[] }) => Promise<any>;
  deleteScheduleDetail: (detailId: number) => Promise<void>;
  fetchDoctorVisitSchedule: () => Promise<void>;
  addDoctorVisitSchedule: (scheduleData: any) => Promise<any>;
  updateDoctorVisitSchedule: (scheduleData: any) => Promise<any>;
  deleteDoctorVisitSchedule: (scheduleId: string) => Promise<void>;
  refreshScheduleData: () => Promise<void>;
  
  // ===== 處方相關 =====
  prescriptions: db.MedicationPrescription[];
  drugDatabase: any[];
  prescriptionWorkflowRecords: PrescriptionWorkflowRecord[];
  prescriptionTimeSlotDefinitions: PrescriptionTimeSlotDefinition[];
  prescriptionLoading: boolean;
  addPrescription: (prescription: any) => Promise<void>;
  updatePrescription: (prescription: any) => Promise<void>;
  deletePrescription: (id: number) => Promise<void>;
  addDrug: (drug: Omit<any, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDrug: (drug: any) => Promise<void>;
  deleteDrug: (id: string) => Promise<void>;
  fetchPrescriptionWorkflowRecords: (patientId?: number, date?: string) => Promise<PrescriptionWorkflowRecord[]>;
  createPrescriptionWorkflowRecord: (recordData: Omit<PrescriptionWorkflowRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePrescriptionWorkflowRecord: (recordId: string, updateData: Partial<PrescriptionWorkflowRecord>) => Promise<void>;
  prepareMedication: (recordId: string, staffId: string, unused1?: any, unused2?: any, patientId?: number, scheduledDate?: string) => Promise<void>;
  verifyMedication: (recordId: string, staffId: string, unused1?: any, unused2?: any, patientId?: number, scheduledDate?: string) => Promise<void>;
  dispenseMedication: (recordId: string, staffId: string, failureReason?: string, customReason?: string, patientId?: number, scheduledDate?: string, notes?: string, inspectionCheckResult?: any) => Promise<void>;
  revertPrescriptionWorkflowStep: (recordId: string, step: 'preparation' | 'verification' | 'dispensing', patientId?: number, scheduledDate?: string) => Promise<void>;
  checkPrescriptionInspectionRules: (prescriptionId: string, patientId: number, scheduledDate?: string, scheduledTime?: string) => Promise<InspectionCheckResult>;
  fetchLatestVitalSigns: (patientId: number, vitalSignType: string, targetDate?: string, targetTime?: string) => Promise<{ record: db.HealthRecord | null; isExactMatch: boolean }>;
  batchSetDispenseFailure: (patientId: number, date: string, time: string, reason: string, customReason?: string) => Promise<void>;
  fetchPrescriptionTimeSlotDefinitions: () => Promise<PrescriptionTimeSlotDefinition[]>;
  addPrescriptionTimeSlotDefinition: (definition: Omit<PrescriptionTimeSlotDefinition, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePrescriptionTimeSlotDefinition: (definition: PrescriptionTimeSlotDefinition) => Promise<void>;
  deletePrescriptionTimeSlotDefinition: (id: string) => Promise<void>;
  refreshPrescriptionData: () => Promise<void>;
  
  // ===== 統一加載狀態 =====
  loading: boolean;
  
  // ===== 統一刷新 =====
  refreshAllWorkflowData: () => Promise<void>;
}

// ========== Context 創建 ==========
const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface WorkflowProviderProps {
  children: ReactNode;
}

export function WorkflowProvider({ children }: WorkflowProviderProps) {
  const { displayName, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  // ===== React Query Hooks =====
  const schedulesQuery = useSchedules();
  const doctorVisitQuery = useDoctorVisitSchedule();
  const prescriptionsQuery = usePrescriptions();
  const drugDatabaseQuery = useDrugDatabase();
  const timeSlotsQuery = usePrescriptionTimeSlotDefinitions();
  
  // ===== Mutations =====
  const addScheduleMutation = useAddSchedule();
  const updateScheduleMutation = useUpdateSchedule();
  const deleteScheduleMutation = useDeleteSchedule();
  const addDoctorVisitMutation = useAddDoctorVisitSchedule();
  const updateDoctorVisitMutation = useUpdateDoctorVisitSchedule();
  const deleteDoctorVisitMutation = useDeleteDoctorVisitSchedule();
  const prepareMedicationMutation = usePrepareMedication();
  const verifyMedicationMutation = useVerifyMedication();
  const dispenseMedicationMutation = useDispenseMedication();
  const revertStepMutation = useRevertPrescriptionWorkflowStep();
  const batchFailureMutation = useBatchSetDispenseFailure();
  const addDrugMutation = useAddDrug();
  const updateDrugMutation = useUpdateDrug();
  const deleteDrugMutation = useDeleteDrug();
  const addTimeSlotMutation = useAddPrescriptionTimeSlotDefinition();
  const updateTimeSlotMutation = useUpdatePrescriptionTimeSlotDefinition();
  const deleteTimeSlotMutation = useDeletePrescriptionTimeSlotDefinition();
  
  // ===== 處方工作流程記錄狀態（需要動態查詢）=====
  const [prescriptionWorkflowRecords, setPrescriptionWorkflowRecords] = useState<PrescriptionWorkflowRecord[]>([]);

  // ===== 從 Query 獲取數據 =====
  const schedules = schedulesQuery.data ?? [];
  const doctorVisitSchedule = doctorVisitQuery.data ?? [];
  const prescriptions = prescriptionsQuery.data ?? [];
  const drugDatabase = drugDatabaseQuery.data ?? [];
  const prescriptionTimeSlotDefinitions = timeSlotsQuery.data ?? [];
  
  // ===== Loading 狀態 =====
  const scheduleLoading = schedulesQuery.isLoading || doctorVisitQuery.isLoading;
  const prescriptionLoading = prescriptionsQuery.isLoading || drugDatabaseQuery.isLoading || timeSlotsQuery.isLoading;

  // ===== 排程函數（使用 React Query Mutations）=====
  const refreshScheduleData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.schedules.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.doctorVisits.all }),
    ]);
  }, [queryClient]);

  const fetchDoctorVisitSchedule = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.doctorVisits.all });
  }, [queryClient]);

  const addDoctorVisitSchedule = useCallback(async (scheduleData: any) => {
    return await addDoctorVisitMutation.mutateAsync(scheduleData);
  }, [addDoctorVisitMutation]);

  const updateDoctorVisitSchedule = useCallback(async (scheduleData: any) => {
    return await updateDoctorVisitMutation.mutateAsync(scheduleData);
  }, [updateDoctorVisitMutation]);

  const deleteDoctorVisitSchedule = useCallback(async (scheduleId: string) => {
    await deleteDoctorVisitMutation.mutateAsync(scheduleId);
  }, [deleteDoctorVisitMutation]);

  const addSchedule = useCallback(async (schedule: Omit<db.Schedule, '排程id'>) => {
    await addScheduleMutation.mutateAsync(schedule);
  }, [addScheduleMutation]);

  const updateSchedule = useCallback(async (schedule: ScheduleWithDetails) => {
    await updateScheduleMutation.mutateAsync(schedule);
  }, [updateScheduleMutation]);

  const deleteSchedule = useCallback(async (id: number) => {
    await deleteScheduleMutation.mutateAsync(id);
  }, [deleteScheduleMutation]);

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

  // ===== 處方函數 =====
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

  const refreshPrescriptionData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.prescriptions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.drugDatabase.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.timeSlots.all }),
      fetchPrescriptionWorkflowRecordsInternal(undefined, undefined, false),
    ]);
  }, [queryClient]);

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

  const addDrug = useCallback(async (drug: Omit<any, 'id' | 'created_at' | 'updated_at'>) => {
    await addDrugMutation.mutateAsync(drug);
  }, [addDrugMutation]);

  const updateDrug = useCallback(async (drug: any) => {
    await updateDrugMutation.mutateAsync(drug);
  }, [updateDrugMutation]);

  const deleteDrug = useCallback(async (id: string) => {
    await deleteDrugMutation.mutateAsync(id);
  }, [deleteDrugMutation]);

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
          healthRecord = await db.getHealthRecordByDateTime(patientId, scheduledDate, scheduledTime, rule.vital_sign_type);
        }
        if (!healthRecord) {
          missingVitalSigns.push(rule.vital_sign_type);
          continue;
        }
        const vitalSignFieldMap: Record<string, keyof db.HealthRecord> = {
          '上壓': '血壓收縮壓', '下壓': '血壓舒張壓', '脈搏': '脈搏',
          '血糖值': '血糖值', '呼吸': '呼吸頻率', '血含氧量': '血含氧量', '體溫': '體溫'
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
          case 'gt': isBlocked = value <= conditionValue; break;
          case 'lt': isBlocked = value >= conditionValue; break;
          case 'gte': isBlocked = value < conditionValue; break;
          case 'lte': isBlocked = value > conditionValue; break;
        }
        if (isBlocked) {
          blockedRules.push({ vital_sign_type: rule.vital_sign_type, actual_value: value, condition_operator: rule.condition_operator, condition_value: conditionValue });
        }
      }
      return { canDispense: blockedRules.length === 0 && missingVitalSigns.length === 0, blockedRules, usedVitalSignData, missingVitalSigns };
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
        const record = await db.getHealthRecordByDateTime(patientId, targetDate, targetTime, vitalSignType);
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
        '上壓': '血壓收縮壓', '下壓': '血壓舒張壓', '脈搏': '脈搏',
        '血糖值': '血糖值', '呼吸': '呼吸頻率', '血含氧量': '血含氧量', '體溫': '體溫'
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
        r => r.patient_id === patientId && r.scheduled_date === date && r.scheduled_time === time && r.dispensing_status === 'pending'
      );
      await Promise.all(
        records.map(record => dispenseMedication(record.id, displayName || '未知', reason, customReason, patientId, date))
      );
    } catch (error) {
      console.error('批量設定派藥失敗:', error);
      throw error;
    }
  }, [prescriptionWorkflowRecords, displayName, dispenseMedication]);

  const loadPrescriptionTimeSlotDefinitions = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.timeSlots.all });
  };

  const fetchPrescriptionTimeSlotDefinitions = useCallback(async (): Promise<PrescriptionTimeSlotDefinition[]> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.timeSlots.all });
    return prescriptionTimeSlotDefinitions;
  }, [queryClient, prescriptionTimeSlotDefinitions]);

  const addPrescriptionTimeSlotDefinition = useCallback(async (definition: Omit<PrescriptionTimeSlotDefinition, 'id' | 'created_at' | 'updated_at'>) => {
    await addTimeSlotMutation.mutateAsync(definition);
  }, [addTimeSlotMutation]);

  const updatePrescriptionTimeSlotDefinition = useCallback(async (definition: PrescriptionTimeSlotDefinition) => {
    await updateTimeSlotMutation.mutateAsync(definition);
  }, [updateTimeSlotMutation]);

  const deletePrescriptionTimeSlotDefinition = useCallback(async (id: string) => {
    await deleteTimeSlotMutation.mutateAsync(id);
  }, [deleteTimeSlotMutation]);

  // ===== 統一刷新所有工作流程數據 =====
  const refreshAllWorkflowData = useCallback(async () => {
    if (!isAuthenticated()) return;
    await Promise.all([
      refreshScheduleData(),
      refreshPrescriptionData(),
    ]);
  }, [isAuthenticated, refreshScheduleData, refreshPrescriptionData]);

  // ===== 初始載入工作流程記錄（React Query 自動處理其他數據）=====
  useEffect(() => {
    if (!isAuthenticated()) return;
    // 只需載入工作流程記錄，其他數據由 React Query 自動管理
    fetchPrescriptionWorkflowRecordsInternal(undefined, undefined, false);
  }, [isAuthenticated]);

  // ===== 統一 loading 狀態 =====
  const loading = scheduleLoading || prescriptionLoading;

  // ===== Context 值 =====
  const value: WorkflowContextType = {
    // 排程
    schedules,
    doctorVisitSchedule,
    scheduleLoading,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addPatientToSchedule,
    updateScheduleDetail,
    deleteScheduleDetail,
    fetchDoctorVisitSchedule,
    addDoctorVisitSchedule,
    updateDoctorVisitSchedule,
    deleteDoctorVisitSchedule,
    refreshScheduleData,
    
    // 處方
    prescriptions,
    drugDatabase,
    prescriptionWorkflowRecords,
    prescriptionTimeSlotDefinitions,
    prescriptionLoading,
    addPrescription,
    updatePrescription,
    deletePrescription,
    addDrug,
    updateDrug,
    deleteDrug,
    fetchPrescriptionWorkflowRecords,
    createPrescriptionWorkflowRecord,
    updatePrescriptionWorkflowRecord,
    prepareMedication,
    verifyMedication,
    dispenseMedication,
    revertPrescriptionWorkflowStep,
    checkPrescriptionInspectionRules,
    fetchLatestVitalSigns,
    batchSetDispenseFailure,
    fetchPrescriptionTimeSlotDefinitions,
    addPrescriptionTimeSlotDefinition,
    updatePrescriptionTimeSlotDefinition,
    deletePrescriptionTimeSlotDefinition,
    refreshPrescriptionData,
    
    // 統一
    loading,
    refreshAllWorkflowData,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

// ========== Hooks ==========
export function useWorkflow(): WorkflowContextType {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}

// ========== 向後兼容的獨立 Hooks ==========
export function useSchedule() {
  const ctx = useWorkflow();
  return {
    schedules: ctx.schedules,
    doctorVisitSchedule: ctx.doctorVisitSchedule,
    loading: ctx.scheduleLoading,
    addSchedule: ctx.addSchedule,
    updateSchedule: ctx.updateSchedule,
    deleteSchedule: ctx.deleteSchedule,
    addPatientToSchedule: ctx.addPatientToSchedule,
    updateScheduleDetail: ctx.updateScheduleDetail,
    deleteScheduleDetail: ctx.deleteScheduleDetail,
    fetchDoctorVisitSchedule: ctx.fetchDoctorVisitSchedule,
    addDoctorVisitSchedule: ctx.addDoctorVisitSchedule,
    updateDoctorVisitSchedule: ctx.updateDoctorVisitSchedule,
    deleteDoctorVisitSchedule: ctx.deleteDoctorVisitSchedule,
    refreshScheduleData: ctx.refreshScheduleData,
  };
}

export function useScheduleData() {
  const { schedules, doctorVisitSchedule, scheduleLoading } = useWorkflow();
  return { schedules, doctorVisitSchedule, loading: scheduleLoading };
}

export function usePrescription() {
  const ctx = useWorkflow();
  return {
    prescriptions: ctx.prescriptions,
    drugDatabase: ctx.drugDatabase,
    prescriptionWorkflowRecords: ctx.prescriptionWorkflowRecords,
    prescriptionTimeSlotDefinitions: ctx.prescriptionTimeSlotDefinitions,
    loading: ctx.prescriptionLoading,
    addPrescription: ctx.addPrescription,
    updatePrescription: ctx.updatePrescription,
    deletePrescription: ctx.deletePrescription,
    addDrug: ctx.addDrug,
    updateDrug: ctx.updateDrug,
    deleteDrug: ctx.deleteDrug,
    fetchPrescriptionWorkflowRecords: ctx.fetchPrescriptionWorkflowRecords,
    createPrescriptionWorkflowRecord: ctx.createPrescriptionWorkflowRecord,
    updatePrescriptionWorkflowRecord: ctx.updatePrescriptionWorkflowRecord,
    prepareMedication: ctx.prepareMedication,
    verifyMedication: ctx.verifyMedication,
    dispenseMedication: ctx.dispenseMedication,
    revertPrescriptionWorkflowStep: ctx.revertPrescriptionWorkflowStep,
    checkPrescriptionInspectionRules: ctx.checkPrescriptionInspectionRules,
    fetchLatestVitalSigns: ctx.fetchLatestVitalSigns,
    batchSetDispenseFailure: ctx.batchSetDispenseFailure,
    fetchPrescriptionTimeSlotDefinitions: ctx.fetchPrescriptionTimeSlotDefinitions,
    addPrescriptionTimeSlotDefinition: ctx.addPrescriptionTimeSlotDefinition,
    updatePrescriptionTimeSlotDefinition: ctx.updatePrescriptionTimeSlotDefinition,
    deletePrescriptionTimeSlotDefinition: ctx.deletePrescriptionTimeSlotDefinition,
    refreshPrescriptionData: ctx.refreshPrescriptionData,
  };
}

export function usePrescriptionData() {
  const { prescriptions, drugDatabase, prescriptionWorkflowRecords, prescriptionTimeSlotDefinitions, prescriptionLoading } = useWorkflow();
  return { prescriptions, drugDatabase, prescriptionWorkflowRecords, prescriptionTimeSlotDefinitions, loading: prescriptionLoading };
}

export default WorkflowContext;
