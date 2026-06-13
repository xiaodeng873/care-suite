import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── 完全對應 web 的 hospital_outreach_records 表結構 ─────────────────────────

export type MedicationPickupArrangement = '家人前往' | '院舍代勞' | '每次詢問';
export type OutreachMedicationSource = 'KWH/CGAS' | 'KCH/PGT' | '出院病房配發';

export const PICKUP_ARRANGEMENT_OPTIONS: MedicationPickupArrangement[] = ['家人前往', '院舍代勞', '每次詢問'];
export const MEDICATION_SOURCE_OPTIONS: OutreachMedicationSource[] = ['KWH/CGAS', 'KCH/PGT', '出院病房配發'];

export interface HospitalOutreachRecord {
  id: string;
  patient_id: number;
  medication_bag_date: string;
  prescription_weeks: number;
  medication_end_date: string;
  outreach_appointment_date?: string;
  medication_pickup_arrangement: MedicationPickupArrangement;
  outreach_medication_source?: OutreachMedicationSource;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export function useOutreach() {
  return useQuery<HospitalOutreachRecord[]>({
    queryKey: ['outreach'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hospital_outreach_records')
        .select('*')
        .order('medication_bag_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HospitalOutreachRecord[];
    },
  });
}

export function useCreateOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: Omit<HospitalOutreachRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('hospital_outreach_records')
        .upsert([record], { onConflict: 'patient_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  });
}

export function useUpdateOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: HospitalOutreachRecord) => {
      const { data, error } = await supabase
        .from('hospital_outreach_records')
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq('id', record.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  });
}

export function useDeleteOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hospital_outreach_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  });
}
