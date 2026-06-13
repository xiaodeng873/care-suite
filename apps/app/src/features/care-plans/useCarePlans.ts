import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CarePlan, CarePlanProblem } from './types';

export function useCarePlans(patientId: number) {
  return useQuery<CarePlan[]>({
    queryKey: ['care-plans', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('care_plans')
        .select('*')
        .eq('patient_id', patientId)
        .order('plan_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
  });
}

export function useCarePlanProblems(carePlanId: string) {
  return useQuery<CarePlanProblem[]>({
    queryKey: ['care-plan-problems', carePlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('care_plan_problems')
        .select('*')
        .eq('care_plan_id', carePlanId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!carePlanId,
  });
}

export function useCreateCarePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<CarePlan, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('care_plans').insert(payload).select().single();
      if (error) throw error;
      return data as CarePlan;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['care-plans', vars.patient_id] }); },
  });
}

export function useDeleteCarePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patientId }: { id: string; patientId: number }) => {
      const { error } = await supabase.from('care_plans').delete().eq('id', id);
      if (error) throw error;
      return patientId;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['care-plans', vars.patientId] }); },
  });
}
