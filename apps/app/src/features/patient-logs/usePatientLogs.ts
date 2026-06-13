import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type LogType = '日常護理' | '文件簽署' | '入院/出院' | '入住/退住' | '醫生到診' | '意外事故' | '覆診返藥' | '其他';

export const LOG_TYPES: LogType[] = [
  '日常護理', '文件簽署', '入院/出院', '入住/退住', '醫生到診', '意外事故', '覆診返藥', '其他',
];

export interface PatientLog {
  id: string;
  patient_id: number;
  log_date: string;
  log_type: LogType;
  content: string;
  recorder: string;
  created_at: string;
  updated_at: string;
}

export function usePatientLogs() {
  return useQuery({
    queryKey: ['patient-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_logs')
        .select('*')
        .order('log_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PatientLog[];
    },
  });
}

export function useCreatePatientLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: Omit<PatientLog, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('patient_logs')
        .insert([log])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-logs'] }),
  });
}

export function useUpdatePatientLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: PatientLog) => {
      const { data, error } = await supabase
        .from('patient_logs')
        .update({ ...log, updated_at: new Date().toISOString() })
        .eq('id', log.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-logs'] }),
  });
}

export function useDeletePatientLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patient_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-logs'] }),
  });
}
