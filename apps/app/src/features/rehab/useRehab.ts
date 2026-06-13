import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const REHAB_SERVICE_TYPES = [
  '物理治療',
  '職業治療',
  '言語治療',
  '日常活動訓練',
  '平衡與步行訓練',
  '其他',
] as const;

export type RehabServiceType = (typeof REHAB_SERVICE_TYPES)[number];

export interface RehabRecord {
  id: string;
  patient_id: number;
  service_date: string;
  service_type: RehabServiceType;
  therapist_name?: string;
  session_duration?: number;
  goals?: string;
  progress_notes?: string;
  next_session_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export function useRehabRecords() {
  return useQuery({
    queryKey: ['rehab-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rehab_records')
        .select('*')
        .order('service_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RehabRecord[];
    },
  });
}

export function useCreateRehabRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: Omit<RehabRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('rehab_records')
        .insert([record])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rehab-records'] }),
  });
}

export function useUpdateRehabRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: RehabRecord) => {
      const { data, error } = await supabase
        .from('rehab_records')
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq('id', record.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rehab-records'] }),
  });
}

export function useDeleteRehabRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rehab_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rehab-records'] }),
  });
}
