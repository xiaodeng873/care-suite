/**
 * PgtContext - PGT 記錄 Context
 *
 * 與 CGAT 同級的治療頁面。獨立 Provider，直接對 pgt_records 表做 CRUD。
 * 到診日期清單與 CGAT 共用 doctor_visit_schedule（刻意決定，兩頁共享同一份清單）。
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface PgtContextType {
  pgtRecords: db.PgtRecord[];
  loading: boolean;
  /** 最新 PGT 到診日期清單（doctor_visit_schedule.visit_date，與 CGAT 共用） */
  visitDates: string[];
  /** 到診日期清單已完成首次載入（未載入前唔好做日期不符判斷，避免誤報） */
  visitDatesLoaded: boolean;
  refreshVisitDates: () => Promise<void>;
  fetchPgtRecords: () => Promise<void>;
  addPgtRecord: (record: Omit<db.PgtRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<db.PgtRecord | null>;
  updatePgtRecord: (record: Partial<db.PgtRecord> & { id: string }) => Promise<db.PgtRecord | null>;
  deletePgtRecord: (id: string) => Promise<void>;
  refreshPgtData: () => Promise<void>;
}

const PgtContext = createContext<PgtContextType | undefined>(undefined);

export function PgtProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [pgtRecords, setPgtRecords] = useState<db.PgtRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [visitDates, setVisitDates] = useState<string[]>([]);
  const [visitDatesLoaded, setVisitDatesLoaded] = useState(false);

  const fetchVisitDates = useCallback(async () => {
    if (!isAuthenticated()) return;
    const { data, error } = await supabase
      .from('doctor_visit_schedule')
      .select('visit_date')
      .order('visit_date', { ascending: true });
    if (error) {
      console.error('載入 PGT 到診日期清單失敗:', error);
      return;
    }
    setVisitDates((data || []).map(v => v.visit_date));
    setVisitDatesLoaded(true);
  }, [isAuthenticated]);

  const fetchPgtRecords = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    try {
      const [data] = await Promise.all([db.getPgtRecords(), fetchVisitDates()]);
      setPgtRecords(data);
    } catch (error) {
      console.error('載入 PGT 記錄失敗:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchVisitDates]);

  const refreshPgtData = useCallback(async () => {
    await fetchPgtRecords();
  }, [fetchPgtRecords]);

  const addPgtRecord = useCallback(async (
    record: Omit<db.PgtRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<db.PgtRecord | null> => {
    try {
      const created = await db.createPgtRecord(record);
      await fetchPgtRecords();
      return created;
    } catch (error) {
      console.error('新增 PGT 記錄失敗:', error);
      throw error;
    }
  }, [fetchPgtRecords]);

  const updatePgtRecord = useCallback(async (
    record: Partial<db.PgtRecord> & { id: string }
  ): Promise<db.PgtRecord | null> => {
    try {
      const updated = await db.updatePgtRecord(record);
      await fetchPgtRecords();
      return updated;
    } catch (error) {
      console.error('更新 PGT 記錄失敗:', error);
      throw error;
    }
  }, [fetchPgtRecords]);

  const deletePgtRecord = useCallback(async (id: string): Promise<void> => {
    try {
      await db.deletePgtRecord(id);
      await fetchPgtRecords();
    } catch (error) {
      console.error('刪除 PGT 記錄失敗:', error);
      throw error;
    }
  }, [fetchPgtRecords]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchPgtRecords(); }, 300);
    return () => clearTimeout(timer);
  }, [fetchPgtRecords]);

  const value: PgtContextType = {
    pgtRecords,
    loading,
    visitDates,
    visitDatesLoaded,
    refreshVisitDates: fetchVisitDates,
    fetchPgtRecords,
    addPgtRecord,
    updatePgtRecord,
    deletePgtRecord,
    refreshPgtData,
  };

  return <PgtContext.Provider value={value}>{children}</PgtContext.Provider>;
}

export function usePgt(): PgtContextType {
  const context = useContext(PgtContext);
  if (context === undefined) {
    throw new Error('usePgt must be used within a PgtProvider');
  }
  return context;
}
