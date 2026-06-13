import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { IncidentReport } from './types';

export function useIncidents(days = 90) {
  return useQuery<IncidentReport[]>({
    queryKey: ['incidents', days],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('incident_reports')
        .select('*')
        .gte('incident_date', cutoffStr)
        .order('incident_date', { ascending: false })
        .order('incident_time', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<IncidentReport, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('incident_reports')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result as IncidentReport;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: IncidentReport) => {
      const { id, created_at, updated_at, ...rest } = data;
      const { data: result, error } = await supabase
        .from('incident_reports')
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result as IncidentReport;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

export function useDeleteIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('incident_reports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}
