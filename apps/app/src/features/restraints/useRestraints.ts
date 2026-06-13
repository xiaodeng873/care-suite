import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface RestraintAssessment {
  id: string;
  patient_id: number;
  doctor_signature_date?: string;
  next_due_date?: string;
  risk_factors?: any;
  alternatives?: any;
  suggested_restraints?: any;
  other_restraint_notes?: string;
  created_at: string;
  updated_at: string;
}

export type ObservationStatus = 'N' | 'P' | 'S';
export const OBSERVATION_STATUS_LABELS: Record<ObservationStatus, string> = {
  N: '正常',
  P: '待處理',
  S: '已解除',
};

export interface RestraintObservation {
  id: string;
  patient_id: number;
  observation_date: string;
  observation_time: string;
  scheduled_time: string;
  observation_status: ObservationStatus;
  recorder: string;
  co_signer?: string;
  notes?: string;
  used_restraints?: any;
  created_at: string;
  updated_at: string;
}

export function useRestraintAssessments() {
  return useQuery({
    queryKey: ['restraint-assessments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_restraint_assessments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RestraintAssessment[];
    },
  });
}

export function useCreateRestraintAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assessment: Omit<RestraintAssessment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('patient_restraint_assessments')
        .insert([assessment])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restraint-assessments'] }),
  });
}

export function useUpdateRestraintAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assessment: RestraintAssessment) => {
      const { error } = await supabase
        .from('patient_restraint_assessments')
        .update({ ...assessment, updated_at: new Date().toISOString() })
        .eq('id', assessment.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restraint-assessments'] }),
  });
}

export function useDeleteRestraintAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patient_restraint_assessments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restraint-assessments'] }),
  });
}

export function useRestraintObservations() {
  return useQuery({
    queryKey: ['restraint-observations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restraint_observation_records')
        .select('*')
        .order('observation_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RestraintObservation[];
    },
  });
}

export function useCreateRestraintObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (obs: Omit<RestraintObservation, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('restraint_observation_records')
        .insert([obs])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restraint-observations'] }),
  });
}

export function useDeleteRestraintObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('restraint_observation_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restraint-observations'] }),
  });
}
