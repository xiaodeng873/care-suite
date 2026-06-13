import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { HealthRecord, HealthRecordType } from './types';

export function useHealthRecords(
  patientId: number | null | undefined,
  recordType: HealthRecordType,
  days = 14
) {
  return useQuery<HealthRecord[]>({
    queryKey: ['health-records', patientId, recordType, days],
    enabled: !!patientId,
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('健康記錄主表')
        .select('*')
        .eq('院友id', patientId!)
        .eq('記錄類型', recordType)
        .gte('記錄日期', cutoffStr)
        .order('記錄日期', { ascending: false })
        .order('記錄時間', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateHealthRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<HealthRecord, '記錄id' | 'created_at'>) => {
      const { data, error } = await supabase.from('健康記錄主表').insert(payload).select().single();
      if (error) throw error;
      return data as HealthRecord;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['health-records', vars.院友id] });
    },
  });
}

export function useDeleteHealthRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patientId }: { id: number; patientId: number }) => {
      const { error } = await supabase.from('健康記錄主表').delete().eq('記錄id', id);
      if (error) throw error;
      return patientId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['health-records', vars.patientId] });
    },
  });
}
