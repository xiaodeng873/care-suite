import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { HygieneRecord } from './types';

export function useHygieneRecords(patientId: number, date: string) {
  return useQuery<HygieneRecord[]>({
    queryKey: ['hygiene-records', patientId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hygiene_records')
        .select('*')
        .eq('patient_id', patientId)
        .eq('record_date', date)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
  });
}

export function useCreateHygieneRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<HygieneRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('hygiene_records').insert(payload);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['hygiene-records', vars.patient_id, vars.record_date] });
    },
  });
}

export function useDeleteHygieneRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; patientId: number; date: string }) => {
      const { error } = await supabase.from('hygiene_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['hygiene-records', vars.patientId, vars.date] });
    },
  });
}
