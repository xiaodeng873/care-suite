import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface DrugData {
  id: string;
  drug_name: string;
  drug_code?: string;
  drug_type?: string;
  administration_route?: string;
  unit?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export function useDrugs() {
  return useQuery({
    queryKey: ['drugs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medication_drug_database')
        .select('*')
        .order('drug_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DrugData[];
    },
  });
}

export function useCreateDrug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (drug: Omit<DrugData, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('medication_drug_database')
        .insert([drug])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drugs'] }),
  });
}

export function useUpdateDrug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (drug: DrugData) => {
      const { data, error } = await supabase
        .from('medication_drug_database')
        .update({ ...drug, updated_at: new Date().toISOString() })
        .eq('id', drug.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drugs'] }),
  });
}

export function useDeleteDrug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('medication_drug_database').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drugs'] }),
  });
}
