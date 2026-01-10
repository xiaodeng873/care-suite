/**
 * Workflow Query Hooks
 * 
 * 使用 React Query 封裝工作流程相關的數據查詢
 * 提供自動緩存、去重、背景更新功能
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import * as db from '../../lib/database';
import { queryKeys } from '../../lib/queryClient';
import { useAuth } from '../../context/AuthContext';

// ========== 類型定義 ==========
export interface ScheduleWithDetails extends db.Schedule {
  院友列表: db.ScheduleDetail[];
}

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

// ========== Schedule Queries ==========

/**
 * 獲取所有排程（含詳細資料）
 * 優化版：使用批量查詢避免 N+1 問題，只加載最近 60 天
 */
export function useSchedules() {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.workflow.schedules.all,
    queryFn: async (): Promise<ScheduleWithDetails[]> => {
      // 使用優化後的批量查詢函數，只加載最近 60 天
      const schedulesWithDetails = await db.getSchedulesWithDetails({ daysBack: 60 });
      return schedulesWithDetails;
    },
    enabled: isAuthenticated(),
    staleTime: 5 * 60 * 1000, // 5 分鐘緩存
  });
}

/**
 * 獲取醫生到診排程
 */
export function useDoctorVisitSchedule() {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.workflow.doctorVisits.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_visit_schedule')
        .select('*')
        .order('visit_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated(),
    staleTime: 30 * 60 * 1000, // 30分鐘 - 排程變化不頻繁
  });
}

// ========== Prescription Queries ==========

/**
 * 獲取所有處方
 */
export function usePrescriptions() {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.workflow.prescriptions.all,
    queryFn: async () => {
      const data = await db.getPrescriptions();
      return data;
    },
    enabled: isAuthenticated(),
    staleTime: 10 * 60 * 1000, // 10分鐘緩存
  });
}

/**
 * 獲取藥物資料庫
 */
export function useDrugDatabase() {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.workflow.drugDatabase.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medication_drug_database')
        .select('*')
        .order('drug_name');
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated(),
    // 藥物資料庫變化較少，可以更長的 staleTime
    staleTime: 30 * 60 * 1000, // 30 分鐘
  });
}

/**
 * 獲取處方工作流程記錄
 */
export function usePrescriptionWorkflowRecords(patientId?: number, date?: string) {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.workflow.prescriptions.workflow(patientId, date),
    queryFn: async (): Promise<PrescriptionWorkflowRecord[]> => {
      let query = supabase
        .from('prescription_workflow_records')
        .select('*');
      
      if (patientId) {
        query = query.eq('patient_id', patientId);
      }
      if (date) {
        query = query.eq('scheduled_date', date);
      }
      
      const { data, error } = await query.order('scheduled_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated() && (!!patientId || !!date),
    // 工作流程記錄更新較頻繁，較短的 staleTime
    staleTime: 1 * 60 * 1000, // 1 分鐘
  });
}

/**
 * 獲取處方時段定義
 */
export function usePrescriptionTimeSlotDefinitions() {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.workflow.timeSlots.list(),
    queryFn: async (): Promise<PrescriptionTimeSlotDefinition[]> => {
      const { data, error } = await supabase
        .from('prescription_time_slot_definitions')
        .select('*')
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated(),
    // 時段定義變化很少
    staleTime: 60 * 60 * 1000, // 1 小時
  });
}

// ========== Schedule Mutations ==========

/**
 * 新增排程
 */
export function useAddSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (schedule: Omit<db.Schedule, '排程id'>) => {
      await db.createSchedule(schedule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.schedules.all });
    },
  });
}

/**
 * 更新排程
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (schedule: ScheduleWithDetails) => {
      await db.updateSchedule({
        排程id: schedule.排程id,
        到診日期: schedule.到診日期,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.schedules.all });
    },
  });
}

/**
 * 刪除排程
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await db.deleteSchedule(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.schedules.all });
    },
  });
}

/**
 * 新增醫生到診排程
 */
export function useAddDoctorVisitSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (scheduleData: any) => {
      const { data, error } = await supabase
        .from('doctor_visit_schedule')
        .insert(scheduleData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.doctorVisits.all });
    },
  });
}

/**
 * 更新醫生到診排程
 */
export function useUpdateDoctorVisitSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (scheduleData: any) => {
      const { id, ...updateData } = scheduleData;
      const { data, error } = await supabase
        .from('doctor_visit_schedule')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.doctorVisits.all });
    },
  });
}

/**
 * 刪除醫生到診排程
 */
export function useDeleteDoctorVisitSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('doctor_visit_schedule')
        .delete()
        .eq('id', scheduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.doctorVisits.all });
    },
  });
}

// ========== Prescription Mutations ==========

/**
 * 更新處方工作流程記錄
 */
export function useUpdatePrescriptionWorkflowRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      recordId, 
      updateData 
    }: { 
      recordId: string; 
      updateData: Partial<PrescriptionWorkflowRecord>;
    }) => {
      const { error } = await supabase
        .from('prescription_workflow_records')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.prescriptions.all });
    },
  });
}

/**
 * 準備藥物（樂觀更新）
 */
export function usePrepareMedication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      recordId, 
      staffId,
      patientId,
      scheduledDate,
    }: { 
      recordId: string; 
      staffId: string;
      patientId?: number;
      scheduledDate?: string;
    }) => {
      const { error } = await supabase
        .from('prescription_workflow_records')
        .update({
          preparation_status: 'completed',
          preparation_staff: staffId,
          preparation_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId);
      if (error) throw error;
    },
    // 樂觀更新
    onMutate: async ({ recordId, staffId, patientId, scheduledDate }) => {
      // 取消進行中的查詢
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate) 
      });
      
      // 獲取之前的數據
      const previousRecords = queryClient.getQueryData<PrescriptionWorkflowRecord[]>(
        queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate)
      );
      
      // 樂觀更新
      if (previousRecords) {
        queryClient.setQueryData(
          queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate),
          previousRecords.map(record => 
            record.id === recordId 
              ? { 
                  ...record, 
                  preparation_status: 'completed' as const,
                  preparation_staff: staffId,
                  preparation_time: new Date().toISOString(),
                }
              : record
          )
        );
      }
      
      return { previousRecords };
    },
    // 錯誤時回滾
    onError: (err, { patientId, scheduledDate }, context) => {
      if (context?.previousRecords) {
        queryClient.setQueryData(
          queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate),
          context.previousRecords
        );
      }
    },
    onSettled: (_, __, { patientId, scheduledDate }) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate) 
      });
    },
  });
}

/**
 * 核對藥物（樂觀更新）
 */
export function useVerifyMedication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      recordId, 
      staffId,
      patientId,
      scheduledDate,
    }: { 
      recordId: string; 
      staffId: string;
      patientId?: number;
      scheduledDate?: string;
    }) => {
      const { error } = await supabase
        .from('prescription_workflow_records')
        .update({
          verification_status: 'completed',
          verification_staff: staffId,
          verification_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId);
      if (error) throw error;
    },
    onMutate: async ({ recordId, staffId, patientId, scheduledDate }) => {
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate) 
      });
      
      const previousRecords = queryClient.getQueryData<PrescriptionWorkflowRecord[]>(
        queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate)
      );
      
      if (previousRecords) {
        queryClient.setQueryData(
          queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate),
          previousRecords.map(record => 
            record.id === recordId 
              ? { 
                  ...record, 
                  verification_status: 'completed' as const,
                  verification_staff: staffId,
                  verification_time: new Date().toISOString(),
                }
              : record
          )
        );
      }
      
      return { previousRecords };
    },
    onError: (err, { patientId, scheduledDate }, context) => {
      if (context?.previousRecords) {
        queryClient.setQueryData(
          queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate),
          context.previousRecords
        );
      }
    },
    onSettled: (_, __, { patientId, scheduledDate }) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate) 
      });
    },
  });
}

/**
 * 派發藥物（樂觀更新）
 */
export function useDispenseMedication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      recordId, 
      staffId,
      failureReason,
      customReason,
      notes,
      inspectionCheckResult,
      patientId,
      scheduledDate,
    }: { 
      recordId: string; 
      staffId: string;
      failureReason?: string;
      customReason?: string;
      notes?: string;
      inspectionCheckResult?: any;
      patientId?: number;
      scheduledDate?: string;
    }) => {
      const isFailure = !!failureReason;
      const updateData: any = {
        dispensing_status: isFailure ? 'failed' : 'completed',
        dispensing_staff: staffId,
        dispensing_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      if (failureReason) {
        updateData.dispensing_failure_reason = failureReason;
      }
      if (customReason) {
        updateData.custom_failure_reason = customReason;
      }
      if (notes) {
        updateData.notes = notes;
      }
      if (inspectionCheckResult) {
        updateData.inspection_check_result = inspectionCheckResult;
      }
      
      const { error } = await supabase
        .from('prescription_workflow_records')
        .update(updateData)
        .eq('id', recordId);
      if (error) throw error;
    },
    onMutate: async ({ recordId, staffId, failureReason, patientId, scheduledDate }) => {
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate) 
      });
      
      const previousRecords = queryClient.getQueryData<PrescriptionWorkflowRecord[]>(
        queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate)
      );
      
      if (previousRecords) {
        const newStatus: 'failed' | 'completed' = failureReason ? 'failed' : 'completed';
        queryClient.setQueryData(
          queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate),
          previousRecords.map(record => 
            record.id === recordId 
              ? { 
                  ...record, 
                  dispensing_status: newStatus,
                  dispensing_staff: staffId,
                  dispensing_time: new Date().toISOString(),
                }
              : record
          )
        );
      }
      
      return { previousRecords };
    },
    onError: (err, { patientId, scheduledDate }, context) => {
      if (context?.previousRecords) {
        queryClient.setQueryData(
          queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate),
          context.previousRecords
        );
      }
    },
    onSettled: (_, __, { patientId, scheduledDate }) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate) 
      });
    },
  });
}

/**
 * 批量設置派發失敗
 */
export function useBatchSetDispenseFailure() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      patientId, 
      date, 
      time, 
      reason,
      customReason,
    }: { 
      patientId: number; 
      date: string;
      time: string;
      reason: string;
      customReason?: string;
    }) => {
      const updateData: any = {
        dispensing_status: 'failed',
        dispensing_failure_reason: reason,
        dispensing_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      if (customReason) {
        updateData.custom_failure_reason = customReason;
      }
      
      const { error } = await supabase
        .from('prescription_workflow_records')
        .update(updateData)
        .eq('patient_id', patientId)
        .eq('scheduled_date', date)
        .eq('scheduled_time', time)
        .eq('dispensing_status', 'pending');
      
      if (error) throw error;
    },
    onSuccess: (_, { patientId, date }) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.workflow.prescriptions.workflow(patientId, date) 
      });
    },
  });
}

/**
 * 還原處方工作流程步驟
 */
export function useRevertPrescriptionWorkflowStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      recordId, 
      step,
      patientId,
      scheduledDate,
    }: { 
      recordId: string; 
      step: 'preparation' | 'verification' | 'dispensing';
      patientId?: number;
      scheduledDate?: string;
    }) => {
      const updateData: any = { updated_at: new Date().toISOString() };
      
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
      }
      
      const { error } = await supabase
        .from('prescription_workflow_records')
        .update(updateData)
        .eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: (_, { patientId, scheduledDate }) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.workflow.prescriptions.workflow(patientId, scheduledDate) 
      });
    },
  });
}

// ========== Drug Database Mutations ==========

/**
 * 新增藥物
 */
export function useAddDrug() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (drug: Omit<any, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('medication_drug_database').insert(drug);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.drugDatabase.all });
    },
  });
}

/**
 * 更新藥物
 */
export function useUpdateDrug() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (drug: any) => {
      const { id, ...updateData } = drug;
      const { error } = await supabase
        .from('medication_drug_database')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.drugDatabase.all });
    },
  });
}

/**
 * 刪除藥物
 */
export function useDeleteDrug() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('medication_drug_database').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.drugDatabase.all });
    },
  });
}

// ========== Time Slot Definition Mutations ==========

/**
 * 新增時段定義
 */
export function useAddPrescriptionTimeSlotDefinition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (definition: Omit<PrescriptionTimeSlotDefinition, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('prescription_time_slot_definitions')
        .insert(definition);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.timeSlots.all });
    },
  });
}

/**
 * 更新時段定義
 */
export function useUpdatePrescriptionTimeSlotDefinition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (definition: PrescriptionTimeSlotDefinition) => {
      const { id, created_at, ...updateData } = definition;
      const { error } = await supabase
        .from('prescription_time_slot_definitions')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.timeSlots.all });
    },
  });
}

/**
 * 刪除時段定義
 */
export function useDeletePrescriptionTimeSlotDefinition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('prescription_time_slot_definitions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflow.timeSlots.all });
    },
  });
}
