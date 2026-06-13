import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { IntakeOutputRecord, IntakeItem, OutputItem } from './types';

export function useIntakeOutputRecords(patientId: number | null | undefined, date: string) {
  return useQuery<IntakeOutputRecord[]>({
    queryKey: ['intake-output', patientId, date],
    enabled: !!patientId && !!date,
    queryFn: async () => {
      const { data: records, error } = await supabase
        .from('intake_output_records')
        .select('*')
        .eq('patient_id', patientId!)
        .eq('record_date', date)
        .order('hour_slot', { ascending: true });
      if (error) throw error;
      if (!records || records.length === 0) return [];

      const ids = records.map((r) => r.id);

      const [{ data: intakeItems }, { data: outputItems }] = await Promise.all([
        supabase
          .from('intake_items')
          .select('*')
          .in('record_id', ids)
          .order('created_at', { ascending: true }),
        supabase
          .from('output_items')
          .select('*')
          .in('record_id', ids)
          .order('created_at', { ascending: true }),
      ]);

      const intakeMap: Record<string, IntakeItem[]> = {};
      const outputMap: Record<string, OutputItem[]> = {};

      for (const item of intakeItems ?? []) {
        if (!intakeMap[item.record_id]) intakeMap[item.record_id] = [];
        intakeMap[item.record_id].push(item);
      }
      for (const item of outputItems ?? []) {
        if (!outputMap[item.record_id]) outputMap[item.record_id] = [];
        outputMap[item.record_id].push(item);
      }

      return records.map((r) => ({
        ...r,
        intake_items: intakeMap[r.id] ?? [],
        output_items: outputMap[r.id] ?? [],
      }));
    },
  });
}

export function useCreateIntakeOutputRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId, date, hourSlot, recorder,
      intakeItems, outputItems,
    }: {
      patientId: number;
      date: string;
      hourSlot: number;
      recorder?: string;
      intakeItems: Array<{ category: string; item_type: string; amount: string; amount_numeric: number; unit: string }>;
      outputItems: Array<{ category: string; amount_ml: number; color?: string }>;
    }) => {
      // Create or find record for this hour_slot
      let recordId: string;
      const { data: existing } = await supabase
        .from('intake_output_records')
        .select('id')
        .eq('patient_id', patientId)
        .eq('record_date', date)
        .eq('hour_slot', hourSlot)
        .maybeSingle();

      if (existing) {
        recordId = existing.id;
      } else {
        const { data: newRecord, error } = await supabase
          .from('intake_output_records')
          .insert({ patient_id: patientId, record_date: date, hour_slot: hourSlot, recorder })
          .select('id')
          .single();
        if (error) throw error;
        recordId = newRecord.id;
      }

      if (intakeItems.length > 0) {
        const { error } = await supabase.from('intake_items').insert(
          intakeItems.map(i => ({ ...i, record_id: recordId }))
        );
        if (error) throw error;
      }

      if (outputItems.length > 0) {
        const { error } = await supabase.from('output_items').insert(
          outputItems.map(o => ({ ...o, record_id: recordId }))
        );
        if (error) throw error;
      }

      return recordId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['intake-output', vars.patientId, vars.date] });
    },
  });
}

export function useDeleteIntakeOutputRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patientId, date }: { id: string; patientId: number; date: string }) => {
      const { error } = await supabase.from('intake_output_records').delete().eq('id', id);
      if (error) throw error;
      return { patientId, date };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['intake-output', vars.patientId, vars.date] });
    },
  });
}
