import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface DiagnosisRecord {
  id: string;
  patient_id: number;
  diagnosis_date: string;
  diagnosis_item: string;
  diagnosis_unit: string;
  remarks?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export function useDiagnosisRecords() {
  return useQuery({
    queryKey: ['diagnosis-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diagnosis_records')
        .select('*')
        .order('diagnosis_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DiagnosisRecord[];
    },
  });
}

export function useCreateDiagnosisRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: Omit<DiagnosisRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('diagnosis_records')
        .insert([record])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diagnosis-records'] }),
  });
}

export function useUpdateDiagnosisRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: DiagnosisRecord) => {
      const { data, error } = await supabase
        .from('diagnosis_records')
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq('id', record.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diagnosis-records'] }),
  });
}

export function useDeleteDiagnosisRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('diagnosis_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diagnosis-records'] }),
  });
}
