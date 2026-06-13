import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── 類型定義（完全對應 web database.tsx 的 到診排程主表 結構）─────────────────

export interface Schedule {
  排程id: number;
  到診日期: string;
}

export interface ScheduleDetail {
  細項id: number;
  排程id: number;
  院友id: number;
  症狀說明?: string;
  備註?: string;
  reasons?: ServiceReason[];
}

export interface ServiceReason {
  原因id: number;
  原因名稱: string;
}

export interface ScheduleWithDetails extends Schedule {
  院友列表: ScheduleDetail[];
}

// ─── React Query Hooks ────────────────────────────────────────────────────────

/** 取得看診原因選項（對應 web 的 getReasons） */
export function useReasons() {
  return useQuery<ServiceReason[]>({
    queryKey: ['vmo-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('看診原因選項')
        .select('*')
        .order('原因名稱', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ServiceReason[];
    },
  });
}

async function loadScheduleDetails(schedulesData: any[]): Promise<ScheduleWithDetails[]> {
  if (!schedulesData || schedulesData.length === 0) return [];
  const scheduleIds = schedulesData.map((s: any) => s.排程id);

  const { data: allDetails } = await supabase
    .from('看診院友細項')
    .select('*')
    .in('排程id', scheduleIds);

  const detailIds = (allDetails ?? []).map((d: any) => d.細項id);
  let allReasonRelations: any[] = [];
  if (detailIds.length > 0) {
    const { data: relations } = await supabase
      .from('到診院友_看診原因')
      .select('*, 看診原因選項(*)')
      .in('細項id', detailIds);
    allReasonRelations = relations ?? [];
  }

  return schedulesData.map((schedule: any) => {
    const scheduleDetails = (allDetails ?? []).filter((d: any) => d.排程id === schedule.排程id);
    const detailsWithReasons = scheduleDetails.map((detail: any) => {
      const reasons = allReasonRelations
        .filter((r: any) => r.細項id === detail.細項id)
        .map((r: any) => r.看診原因選項)
        .filter(Boolean);
      return { ...detail, reasons };
    });
    return { ...schedule, 院友列表: detailsWithReasons };
  });
}

/**
 * 無限載入排程（依到診日期降序：未來在上、過去在下）。
 * 滾動到底時自動載入更早的記錄。
 */
export function useVmoSchedulesInfinite(pageSize = 15) {
  return useInfiniteQuery({
    queryKey: ['vmo-schedules-infinite', pageSize],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      const { data: schedulesData, error } = await supabase
        .from('到診排程主表')
        .select('*')
        .order('到診日期', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const items = await loadScheduleDetails(schedulesData ?? []);
      const nextOffset = (schedulesData?.length ?? 0) === pageSize ? offset + pageSize : undefined;
      return { items, nextOffset };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}

/** 新增排程 */
export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Schedule, '排程id'>) => {
      const { data, error } = await supabase
        .from('到診排程主表')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vmo-schedules-infinite'] }),
  });
}

/** 刪除排程 */
export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (排程id: number) => {
      const { error } = await supabase
        .from('到診排程主表')
        .delete()
        .eq('排程id', 排程id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vmo-schedules-infinite'] }),
  });
}

/** 新增院友到排程（含看診原因） */
export function useAddPatientToSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      排程id: number;
      院友id: number;
      症狀說明: string;
      備註: string;
      原因ids?: number[];
    }) => {
      const { 原因ids = [], ...detailPayload } = payload;
      const { data: detail, error } = await supabase
        .from('看診院友細項')
        .insert([detailPayload])
        .select()
        .single();
      if (error) throw error;
      if (原因ids.length > 0) {
        const inserts = 原因ids.map(原因id => ({ 細項id: detail.細項id, 原因id }));
        const { error: reasonError } = await supabase
          .from('到診院友_看診原因')
          .insert(inserts);
        if (reasonError) throw reasonError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vmo-schedules-infinite'] }),
  });
}

/** 從排程移除院友 */
export function useRemovePatientFromSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (細項id: number) => {
      const { error } = await supabase
        .from('看診院友細項')
        .delete()
        .eq('細項id', 細項id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vmo-schedules-infinite'] }),
  });
}
