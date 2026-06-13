import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FollowUpAppointment } from './types';

/** Upcoming follow-ups from today, up to `days` ahead. */
export function useFollowUps(days = 30) {
  return useQuery<FollowUpAppointment[]>({
    queryKey: ['follow-ups', days],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date();
      future.setDate(future.getDate() + days);
      const futureStr = future.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('覆診安排主表')
        .select('*')
        .gte('覆診日期', today)
        .lte('覆診日期', futureStr)
        .order('覆診日期', { ascending: true })
        .order('覆診時間', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Follow-ups for a specific resident (all time, descending). */
export function useResidentFollowUps(patientId: number | null) {
  return useQuery<FollowUpAppointment[]>({
    queryKey: ['follow-ups-resident', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('覆診安排主表')
        .select('*')
        .eq('院友id', patientId!)
        .order('覆診日期', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>) => {
      const { data: result, error } = await supabase
        .from('覆診安排主表')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result as FollowUpAppointment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-ups'] }),
  });
}

export function useUpdateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: FollowUpAppointment) => {
      const { 覆診id, 創建時間, 更新時間, ...rest } = data;
      // Convert empty strings to null
      const cleaned: any = {};
      for (const [k, v] of Object.entries(rest)) {
        cleaned[k] = v === '' ? null : v;
      }
      const { data: result, error } = await supabase
        .from('覆診安排主表')
        .update(cleaned)
        .eq('覆診id', 覆診id)
        .select()
        .single();
      if (error) throw error;
      return result as FollowUpAppointment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-ups'] }),
  });
}

export function useDeleteFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('覆診安排主表').delete().eq('覆診id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-ups'] }),
  });
}
