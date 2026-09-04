import { supabase } from './supabase';

// 通用回收筒：對應 migration 20260905110000_generic_recycle_bin.sql
// 三個 RPC + deleted_records 表查詢

export interface DeletedRecord {
  id: string;
  original_table: string;
  original_id: string;
  data: Record<string, any>;
  deleted_at: string;
  deleted_by: string | null;
  deletion_reason: string;
  facility_id: number | null;
}

// 軟刪除：搬原始列入回收筒後刪原表列（原有 delete 函數改調用呢個）
export const softDeleteRecord = async (
  table: string,
  id: string | number,
  reason?: string
): Promise<void> => {
  const { error } = await supabase.rpc('recycle_soft_delete', {
    p_table: table,
    p_id: String(id),
    p_reason: reason ?? '',
  });
  if (error) throw error;
};

// 攞一或多張表嘅回收筒記錄（RLS 已按院舍隔離），新至舊排
export const fetchDeletedRecords = async (tables: string[]): Promise<DeletedRecord[]> => {
  const { data, error } = await supabase
    .from('deleted_records')
    .select('*')
    .in('original_table', tables)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data as DeletedRecord[]) || [];
};

// 還原：插返原表，移除回收筒記錄
export const restoreRecord = async (recycleId: string): Promise<void> => {
  const { error } = await supabase.rpc('recycle_restore', { p_recycle_id: recycleId });
  if (error) throw error;
};

// 永久刪除：只刪回收筒記錄（原資料不再保留）
export const permanentDeleteRecord = async (recycleId: string): Promise<void> => {
  const { error } = await supabase.rpc('recycle_permanent_delete', { p_recycle_id: recycleId });
  if (error) throw error;
};
