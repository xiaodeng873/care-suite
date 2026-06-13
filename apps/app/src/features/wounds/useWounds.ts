import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Wound, WoundAssessment } from './types';

export function useWounds(patientId: number) {
  return useQuery<Wound[]>({
    queryKey: ['wounds', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wounds')
        .select('*')
        .eq('patient_id', patientId)
        .order('discovery_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
  });
}

export function useWoundAssessments(woundId: string) {
  return useQuery<WoundAssessment[]>({
    queryKey: ['wound-assessments', woundId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wound_assessments')
        .select('*')
        .eq('wound_id', woundId)
        .order('assessment_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!woundId,
  });
}

export function useCreateWound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Wound, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('wounds').insert(payload).select().single();
      if (error) throw error;
      return data as Wound;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['wounds', vars.patient_id] }); },
  });
}

export function useUpdateWound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Wound) => {
      const { id, created_at, updated_at, ...rest } = payload;
      const { data, error } = await supabase.from('wounds').update(rest).eq('id', id).select().single();
      if (error) throw error;
      return data as Wound;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['wounds', vars.patient_id] }); },
  });
}

export function useDeleteWound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patientId }: { id: string; patientId: number }) => {
      const { error } = await supabase.from('wounds').delete().eq('id', id);
      if (error) throw error;
      return patientId;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['wounds', vars.patientId] }); },
  });
}

export function useCreateWoundAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<WoundAssessment, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('wound_assessments').insert(payload).select().single();
      if (error) throw error;
      return data as WoundAssessment;
    },
    onSuccess: (_d, vars) => {
      if (vars.wound_id) qc.invalidateQueries({ queryKey: ['wound-assessments', vars.wound_id] });
    },
  });
}

export function useDeleteWoundAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, woundId }: { id: string; woundId?: string }) => {
      const { error } = await supabase.from('wound_assessments').delete().eq('id', id);
      if (error) throw error;
      return woundId;
    },
    onSuccess: (_d, vars) => {
      if (vars) qc.invalidateQueries({ queryKey: ['wound-assessments', vars] });
    },
  });
}
