import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface VaccinationRecord {
  id: string;
  patient_id: number;
  vaccination_date: string;
  vaccine_item: string;
  vaccination_unit: string;
  remarks?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export function useVaccinationRecords() {
  return useQuery({
    queryKey: ['vaccination-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vaccination_records')
        .select('*')
        .order('vaccination_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VaccinationRecord[];
    },
  });
}

export function useCreateVaccinationRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: Omit<VaccinationRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('vaccination_records')
        .insert([record])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaccination-records'] }),
  });
}

export function useUpdateVaccinationRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: VaccinationRecord) => {
      const { data, error } = await supabase
        .from('vaccination_records')
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq('id', record.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaccination-records'] }),
  });
}

export function useDeleteVaccinationRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vaccination_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaccination-records'] }),
  });
}
