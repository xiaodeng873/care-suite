import { supabase } from './supabase';
import { getCurrentFacilityId } from '../utils/facilitySettings';

// 院舍活動資料（附件3.2 每月院舍活動資料）：一場活動一列

export interface HomeActivity {
  id: string;
  activity_date: string;          // YYYY-MM-DD
  start_time: string | null;      // HH:MM:SS
  end_time: string | null;        // HH:MM:SS
  organizer: string | null;       // 主辦機構/團體
  activity_name: string;          // 活動名稱
  location: string | null;        // 地點（如外出，請列明）
  volunteer_count: number;        // 義工人數（0 = 冇義工）
  participant_count: number;      // 參加人數
  facility_id: number | null;
  created_at: string;
  updated_at: string;
}

export type HomeActivityInput = Pick<
  HomeActivity,
  'activity_date' | 'start_time' | 'end_time' | 'organizer' | 'activity_name' | 'location' | 'volunteer_count' | 'participant_count'
>;

const facilityScope = <T,>(query: T): T => {
  const facilityId = getCurrentFacilityId();
  if (facilityId == null) return query;
  return (query as any).eq('facility_id', facilityId);
};

export const getHomeActivities = async (): Promise<HomeActivity[]> => {
  let query = supabase
    .from('home_activities')
    .select('*')
    .order('activity_date', { ascending: false })
    .order('start_time', { ascending: true });
  query = facilityScope(query);
  const { data, error } = await query;
  if (error) throw error;
  return (data as HomeActivity[]) || [];
};

// facility_id 由 DB trigger 用 JWT claim 自動填（見 20260912000000_home_activities.sql）
export const addHomeActivity = async (input: HomeActivityInput): Promise<HomeActivity> => {
  const { data, error } = await supabase
    .from('home_activities')
    .insert({
      activity_date: input.activity_date,
      start_time: input.start_time || null,
      end_time: input.end_time || null,
      organizer: input.organizer?.trim() || null,
      activity_name: input.activity_name.trim(),
      location: input.location?.trim() || null,
      volunteer_count: input.volunteer_count ?? 0,
      participant_count: input.participant_count ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as HomeActivity;
};

export const updateHomeActivity = async (id: string, input: HomeActivityInput): Promise<void> => {
  const { error } = await supabase
    .from('home_activities')
    .update({
      activity_date: input.activity_date,
      start_time: input.start_time || null,
      end_time: input.end_time || null,
      organizer: input.organizer?.trim() || null,
      activity_name: input.activity_name.trim(),
      location: input.location?.trim() || null,
      volunteer_count: input.volunteer_count ?? 0,
      participant_count: input.participant_count ?? 0,
    })
    .eq('id', id);
  if (error) throw error;
};

export const deleteHomeActivity = async (id: string): Promise<void> => {
  const { error } = await supabase.from('home_activities').delete().eq('id', id);
  if (error) throw error;
};
