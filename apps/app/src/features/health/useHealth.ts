import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { HealthRecord, VitalSignType } from './types';

export function useHealthRecords(
  patientId: number | null | undefined,
  monitoringType: VitalSignType,
  days = 14
) {
  return useQuery<HealthRecord[]>({
    queryKey: ['health-records', patientId, monitoringType, days],
    enabled: !!patientId,
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('健康監測記錄')
        .select('*')
        .eq('院友id', patientId!)
        .eq('監測類型', monitoringType)
        .gte('記錄日期', cutoffStr)
        .order('記錄日期', { ascending: false })
        .order('記錄時間', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HealthRecord[];
    },
  });
}

export function useCreateHealthRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<HealthRecord, '記錄id' | '建立時間'>) => {
      if (payload.監測類型 === '血壓' && payload.數值_副 == null) {
        throw new Error('血壓記錄必須同時提供收縮壓和舒張壓');
      }
      const { data, error } = await supabase.from('健康監測記錄').insert(payload).select().single();
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
    mutationFn: async ({ id, patientId }: { id: string; patientId: number }) => {
      const { error } = await supabase.from('健康監測記錄').delete().eq('記錄id', id);
      if (error) throw error;
      return patientId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['health-records', vars.patientId] });
    },
  });
}
