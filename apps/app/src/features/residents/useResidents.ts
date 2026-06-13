import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Resident } from './types';

export function useResidents() {
  return useQuery<Resident[]>({
    queryKey: ['residents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('院友主表')
        .select('*')
        .eq('在住狀態', '在住')
        .order('床號', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useResident(id: number | undefined) {
  return useQuery<Resident>({
    queryKey: ['residents', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('院友主表')
        .select('*')
        .eq('院友id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: id != null,
  });
}

export function useCreateResident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Resident, '院友id'>) => {
      const { error } = await supabase.from('院友主表').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['residents'] }),
  });
}

export function useUpdateResident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ 院友id, ...updates }: Partial<Resident> & { 院友id: number }) => {
      const { error } = await supabase.from('院友主表').update(updates).eq('院友id', 院友id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['residents'] });
      qc.invalidateQueries({ queryKey: ['residents', vars.院友id] });
    },
  });
}
