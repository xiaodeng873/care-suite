import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── 類型定義（完全對應 web database.tsx 的 hospital_episodes 結構）─────────────

export type EpisodeStatus = 'active' | 'completed' | 'transferred';
export type EpisodeEventType = 'admission' | 'transfer' | 'discharge' | 'vacation_start' | 'vacation_end';
export type DischargeType = 'return_to_facility' | 'home' | 'transfer_out' | 'deceased';
export type VacationEndType = 'return_to_facility' | 'home' | 'transfer_out' | 'deceased';

export const EVENT_TYPE_LABELS: Record<EpisodeEventType, string> = {
  admission:       '入院',
  transfer:        '轉院',
  discharge:       '出院',
  vacation_start:  '渡假開始',
  vacation_end:    '渡假結束',
};

export const EVENT_TYPE_COLORS: Record<EpisodeEventType, string> = {
  admission:       '#ef4444',
  transfer:        '#f59e0b',
  discharge:       '#22c55e',
  vacation_start:  '#8b5cf6',
  vacation_end:    '#06b6d4',
};

export const DISCHARGE_TYPE_LABELS: Record<DischargeType, string> = {
  return_to_facility: '返回院舍',
  home:               '回到原居住地',
  transfer_out:       '轉至其他機構',
  deceased:           '院內離世',
};

export const VACATION_END_TYPE_LABELS: Record<VacationEndType, string> = {
  return_to_facility: '渡假後返回護老院',
  home:               '渡假後回到原居住地',
  transfer_out:       '轉至其他機構',
  deceased:           '院友渡假期間離世',
};

export interface EpisodeEvent {
  id: string;
  episode_id: string;
  event_type: EpisodeEventType;
  event_date: string;
  event_time?: string;
  hospital_name?: string;
  hospital_ward?: string;
  hospital_bed_number?: string;
  event_order?: number;
  remarks?: string;
  vacation_end_type?: VacationEndType;
  created_at: string;
}

export interface HospitalEpisode {
  id: string;
  patient_id: number;
  episode_start_date: string;
  episode_end_date?: string;
  status: EpisodeStatus;
  primary_hospital?: string;
  primary_ward?: string;
  primary_bed_number?: string;
  discharge_type?: DischargeType;
  discharge_destination?: string;
  date_of_death?: string;
  time_of_death?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  episode_events: EpisodeEvent[];
}

/** 根據事件計算目前顯示狀態，與 web AdmissionRecords.tsx 邏輯一致 */
export function getEpisodeStatusLabel(episode: HospitalEpisode): string {
  const events = episode.episode_events ?? [];
  const hasVacationStart = events.some(e => e.event_type === 'vacation_start');
  const vacationEnd = events.find(e => e.event_type === 'vacation_end');
  const hasDischarge = events.some(e => e.event_type === 'discharge');

  if (hasVacationStart && !vacationEnd) return '渡假中';
  if (vacationEnd) {
    const endType = vacationEnd.vacation_end_type ?? episode.discharge_type;
    if (endType === 'deceased') return '渡假期間離世';
    if (endType === 'return_to_facility') return '渡假結束';
    return '渡假結束';
  }
  if (hasDischarge) return '已出院';
  return '住院中';
}

export function getEpisodeStatusColor(label: string): string {
  switch (label) {
    case '住院中':        return '#ef4444';
    case '渡假中':        return '#8b5cf6';
    case '渡假結束':      return '#06b6d4';
    case '已出院':        return '#22c55e';
    case '渡假期間離世':  return '#6b7280';
    default:              return '#9ca3af';
  }
}

// ─── React Query Hooks ────────────────────────────────────────────────────────

export function useAdmissionRecords() {
  return useQuery<HospitalEpisode[]>({
    queryKey: ['hospital-episodes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hospital_episodes')
        .select('*, episode_events(*)')
        .order('episode_start_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HospitalEpisode[];
    },
  });
}

export function useCreateAdmissionRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      patient_id: number;
      episode_start_date: string;
      primary_hospital?: string;
      primary_ward?: string;
      primary_bed_number?: string;
      remarks?: string;
      event_type: EpisodeEventType;
      event_date: string;
      event_time?: string;
    }) => {
      const { event_type, event_date, event_time, ...episodeData } = payload;
      // 1. 建立 episode
      const { data: episode, error } = await supabase
        .from('hospital_episodes')
        .insert([{ ...episodeData, status: 'active' }])
        .select()
        .single();
      if (error) throw error;
      // 2. 建立首個事件
      const { error: evErr } = await supabase
        .from('episode_events')
        .insert([{ episode_id: episode.id, event_type, event_date, event_time: event_time || null, hospital_name: episodeData.primary_hospital, hospital_ward: episodeData.primary_ward, hospital_bed_number: episodeData.primary_bed_number, event_order: 1 }]);
      if (evErr) throw evErr;
      return episode;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-episodes'] }),
  });
}

export function useAddEpisodeEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: Omit<EpisodeEvent, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('episode_events')
        .insert([event])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-episodes'] }),
  });
}

export function useDeleteAdmissionRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hospital_episodes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-episodes'] }),
  });
}
