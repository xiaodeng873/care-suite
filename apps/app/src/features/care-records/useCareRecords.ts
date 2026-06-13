import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PatrolRound, DiaperChangeRecord, PositionChangeRecord, HygieneRecord } from './types';

function dateRange(date: string) {
  return { gte: date, lte: date };
}

export function usePatrolRounds(patientId: number, date: string) {
  return useQuery<PatrolRound[]>({
    queryKey: ['patrol-rounds', patientId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patrol_rounds')
        .select('*')
        .eq('patient_id', patientId)
        .eq('patrol_date', date)
        .order('scheduled_time', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId && !!date,
  });
}

export function useDiaperRecords(patientId: number, date: string) {
  return useQuery<DiaperChangeRecord[]>({
    queryKey: ['diaper-records', patientId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diaper_change_records')
        .select('*')
        .eq('patient_id', patientId)
        .eq('change_date', date)
        .order('time_slot', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId && !!date,
  });
}

export function usePositionRecords(patientId: number, date: string) {
  return useQuery<PositionChangeRecord[]>({
    queryKey: ['position-records', patientId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('position_change_records')
        .select('*')
        .eq('patient_id', patientId)
        .eq('change_date', date)
        .order('scheduled_time', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId && !!date,
  });
}

export function useHygieneRecords(patientId: number, date: string) {
  return useQuery<HygieneRecord[]>({
    queryKey: ['hygiene-records', patientId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hygiene_records')
        .select('*')
        .eq('patient_id', patientId)
        .eq('record_date', date)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId && !!date,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreatePatrolRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<PatrolRound, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('patrol_rounds').insert(payload).select().single();
      if (error) throw error;
      return data as PatrolRound;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['patrol-rounds', vars.patient_id, vars.patrol_date] }); },
  });
}

export function useDeletePatrolRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patientId, date }: { id: string; patientId: number; date: string }) => {
      const { error } = await supabase.from('patrol_rounds').delete().eq('id', id);
      if (error) throw error;
      return { patientId, date };
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['patrol-rounds', vars.patientId, vars.date] }); },
  });
}

export function useCreateDiaperRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<DiaperChangeRecord, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('diaper_change_records').insert(payload).select().single();
      if (error) throw error;
      return data as DiaperChangeRecord;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['diaper-records', vars.patient_id, vars.change_date] }); },
  });
}

export function useDeleteDiaperRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patientId, date }: { id: string; patientId: number; date: string }) => {
      const { error } = await supabase.from('diaper_change_records').delete().eq('id', id);
      if (error) throw error;
      return { patientId, date };
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['diaper-records', vars.patientId, vars.date] }); },
  });
}

export function useCreatePositionRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<PositionChangeRecord, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('position_change_records').insert(payload).select().single();
      if (error) throw error;
      return data as PositionChangeRecord;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['position-records', vars.patient_id, vars.change_date] }); },
  });
}

export function useDeletePositionRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patientId, date }: { id: string; patientId: number; date: string }) => {
      const { error } = await supabase.from('position_change_records').delete().eq('id', id);
      if (error) throw error;
      return { patientId, date };
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['position-records', vars.patientId, vars.date] }); },
  });
}

export function useCreateHygieneRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<HygieneRecord, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('hygiene_records').insert(payload).select().single();
      if (error) throw error;
      return data as HygieneRecord;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['hygiene-records', vars.patient_id, vars.record_date] }); },
  });
}

export function useDeleteHygieneRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patientId, date }: { id: string; patientId: number; date: string }) => {
      const { error } = await supabase.from('hygiene_records').delete().eq('id', id);
      if (error) throw error;
      return { patientId, date };
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['hygiene-records', vars.patientId, vars.date] }); },
  });
}
