import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface HealthAssessment {
  id: string;
  patient_id: number;
  assessment_date: string;
  assessor?: string;
  next_due_date?: string;
  smoking_habit?: string;
  drinking_habit?: string;
  communication_ability?: string;
  consciousness_cognition?: string;
  emotional_expression?: string;
  remarks?: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export function useHealthAssessments() {
  return useQuery({
    queryKey: ['health-assessments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_assessments')
        .select('*')
        .eq('status', 'active')
        .order('assessment_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HealthAssessment[];
    },
  });
}

export function useCreateHealthAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assessment: Omit<HealthAssessment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('health_assessments')
        .insert([{ ...assessment, status: 'active' }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-assessments'] }),
  });
}

export function useUpdateHealthAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assessment: HealthAssessment) => {
      const { data, error } = await supabase
        .from('health_assessments')
        .update({ ...assessment, updated_at: new Date().toISOString() })
        .eq('id', assessment.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-assessments'] }),
  });
}

export function useDeleteHealthAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('health_assessments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-assessments'] }),
  });
}
