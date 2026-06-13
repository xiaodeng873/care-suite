import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { MedicationPrescription, MedicationWorkflowRecord, WorkflowStatusType } from './types';

export function usePrescriptions(patientId: number | null | undefined) {
  return useQuery<MedicationPrescription[]>({
    queryKey: ['prescriptions', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('new_medication_prescriptions')
        .select('*')
        .eq('patient_id', patientId!)
        .eq('status', 'active')
        .order('medication_name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWorkflowRecords(patientId: number | null | undefined, date: string) {
  return useQuery<MedicationWorkflowRecord[]>({
    queryKey: ['medication-workflow', patientId, date],
    enabled: !!patientId && !!date,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medication_workflow_records')
        .select('*')
        .eq('patient_id', patientId!)
        .eq('scheduled_date', date)
        .order('scheduled_time', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateWorkflowStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      step,
      status,
    }: {
      id: string;
      step: 'preparation_status' | 'verification_status' | 'dispensing_status';
      status: WorkflowStatusType;
    }) => {
      const { data, error } = await supabase
        .from('medication_workflow_records')
        .update({ [step]: status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as MedicationWorkflowRecord;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['medication-workflow'] });
    },
  });
}
