import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { type FrequencyUnit } from './constants';
export { FrequencyUnit, FREQUENCY_UNITS } from './constants';

export type HealthTaskType =
  | '生命表徵' | '血糖控制' | '體重控制' | '約束物品同意書'
  | '年度體檢' | '尿導管更換' | '鼻胃飼管更換' | '傷口換症'
  | '藥物自存同意書' | '晚晴計劃' | '氧氣喉管清洗/更換';

export const TASK_TYPES: HealthTaskType[] = [
  '生命表徵', '血糖控制', '體重控制', '約束物品同意書',
  '年度體檢', '尿導管更換', '鼻胃飼管更換', '傷口換症',
  '藥物自存同意書', '晚晴計劃', '氧氣喉管清洗/更換',
];

export interface PatientTask {
  id: string;
  patient_id: number;
  health_record_type: HealthTaskType;
  frequency_unit: FrequencyUnit;
  frequency_value: number;
  next_due_at: string;
  last_completed_at?: string;
  notes?: string;
  is_recurring?: boolean;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_health_tasks')
        .select('*')
        .order('next_due_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PatientTask[];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Omit<PatientTask, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('patient_health_tasks')
        .insert([task])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: PatientTask) => {
      const { data, error } = await supabase
        .from('patient_health_tasks')
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patient_health_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
