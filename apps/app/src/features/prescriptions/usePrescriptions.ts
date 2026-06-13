import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type PrescriptionStatusType = 'active' | 'inactive' | 'pending_change';

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatusType, string> = {
  active: '有效',
  inactive: '停用',
  pending_change: '待更改',
};

export const PRESCRIPTION_STATUS_COLORS: Record<PrescriptionStatusType, string> = {
  active: '#22c55e',
  inactive: '#9ca3af',
  pending_change: '#f59e0b',
};

export interface MedicationPrescription {
  id: string;
  patient_id: number;
  medication_name: string;
  medication_source?: string;
  medication_quantity?: string;
  prescription_date: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  duration_days?: number;
  dosage_form?: string;
  administration_route?: string;
  dosage_amount?: string;
  dosage_unit?: string;
  special_dosage_instruction?: string;
  daily_frequency?: number;
  frequency_type: string;
  frequency_value?: number;
  specific_weekdays?: number[];
  is_odd_even_day?: string;
  medication_time_slots?: string[];
  meal_timing?: string;
  is_prn?: boolean;
  preparation_method?: string;
  prescribing_doctor?: string;
  prescription_source?: string;
  remarks?: string;
  notes?: string;
  status: PrescriptionStatusType;
  created_at: string;
  updated_at: string;
}

// ─── 完全對應 web PrescriptionModal 的選項常數 ────────────────────────────────
export const DOSAGE_FORM_OPTIONS = ['片劑', '膠囊', '藥水', '注射劑', '外用藥膏', '滴劑', '皮膚貼劑'] as const;
export const ADMIN_ROUTE_OPTIONS = ['口服', '注射', '外用', '滴眼', '滴耳', '鼻胃管', '吸入'] as const;
export const DOSAGE_UNIT_OPTIONS = ['粒', '片', '膠囊', '毫升', '滴', '口', '支', '包', '茶匙', '湯匙', 'mg', 'ml', 'g', 'mcg', 'IU'] as const;
export const SPECIAL_DOSAGE_OPTIONS = ['適量', '搽患處', '貼在皮膚上', '薄薄一層', '按需要使用'] as const;
export const MEAL_TIMING_OPTIONS = ['餐前', '進餐時', '餐後', '早餐前', '早餐時', '早餐後', '午餐前', '午餐時', '午餐後', '晚餐前', '晚餐時', '晚餐後', '早上', '中午', '晚上', '睡前'] as const;
export const PREPARATION_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'immediate', label: '即時備藥' },
  { value: 'advanced',  label: '提前備藥' },
  { value: 'custom',    label: '自理' },
];
export const DAILY_FREQUENCY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'QD (每日1次)' },
  { value: 2, label: 'BD (每日2次)' },
  { value: 3, label: 'TDS (每日3次)' },
  { value: 4, label: 'QID (每日4次)' },
  { value: 5, label: '每日5次' },
  { value: 6, label: '每日6次' },
  { value: 8, label: '每日8次' },
];
export const FREQUENCY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'daily',          label: '每日服' },
  { value: 'every_x_days',   label: '隔X日服' },
  { value: 'every_x_months', label: '隔X月服' },
  { value: 'weekly_days',    label: '逢星期X服' },
  { value: 'odd_even_days',  label: '單日/雙日服' },
  { value: 'hourly',         label: '每小時' },
];
export const WEEKDAY_NAMES = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'] as const;

export function usePrescriptions() {
  return useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('new_medication_prescriptions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MedicationPrescription[];
    },
  });
}

export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rx: Omit<MedicationPrescription, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('new_medication_prescriptions')
        .insert([rx])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prescriptions'] }),
  });
}

export function useUpdatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rx: MedicationPrescription) => {
      const { data, error } = await supabase
        .from('new_medication_prescriptions')
        .update({ ...rx, updated_at: new Date().toISOString() })
        .eq('id', rx.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prescriptions'] }),
  });
}

export function useDeletePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('new_medication_prescriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prescriptions'] }),
  });
}
