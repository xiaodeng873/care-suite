/**
 * CgatContext - CGAT（社區老人評估小組）記錄 Context
 *
 * 取代舊「醫院外展」。獨立 Provider，直接對 cgat_records 表做 CRUD。
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface CgatContextType {
  cgatRecords: db.CgatRecord[];
  loading: boolean;
  /** 最新 CGAT 到診日期清單（doctor_visit_schedule.visit_date） */
  visitDates: string[];
  /** 到診日期清單已完成首次載入（未載入前唔好做日期不符判斷，避免誤報） */
  visitDatesLoaded: boolean;
  refreshVisitDates: () => Promise<void>;
  fetchCgatRecords: () => Promise<void>;
  addCgatRecord: (record: Omit<db.CgatRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<db.CgatRecord | null>;
  updateCgatRecord: (record: Partial<db.CgatRecord> & { id: string }) => Promise<db.CgatRecord | null>;
  deleteCgatRecord: (id: string) => Promise<void>;
  refreshCgatData: () => Promise<void>;
}

const CgatContext = createContext<CgatContextType | undefined>(undefined);

export function CgatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [cgatRecords, setCgatRecords] = useState<db.CgatRecord[]>([]);
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
      console.error('載入 CGAT 到診日期清單失敗:', error);
      return;
    }
    setVisitDates((data || []).map(v => v.visit_date));
    setVisitDatesLoaded(true);
  }, [isAuthenticated]);

  const fetchCgatRecords = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    try {
      const [data] = await Promise.all([db.getCgatRecords(), fetchVisitDates()]);
      setCgatRecords(data);
    } catch (error) {
      console.error('載入 CGAT 記錄失敗:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchVisitDates]);

  const refreshCgatData = useCallback(async () => {
    await fetchCgatRecords();
  }, [fetchCgatRecords]);

  const addCgatRecord = useCallback(async (
    record: Omit<db.CgatRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<db.CgatRecord | null> => {
    try {
      const created = await db.createCgatRecord(record);
      await fetchCgatRecords();
      return created;
    } catch (error) {
      console.error('新增 CGAT 記錄失敗:', error);
      throw error;
    }
  }, [fetchCgatRecords]);

  const updateCgatRecord = useCallback(async (
    record: Partial<db.CgatRecord> & { id: string }
  ): Promise<db.CgatRecord | null> => {
    try {
      const updated = await db.updateCgatRecord(record);
      await fetchCgatRecords();
      return updated;
    } catch (error) {
      console.error('更新 CGAT 記錄失敗:', error);
      throw error;
    }
  }, [fetchCgatRecords]);

  const deleteCgatRecord = useCallback(async (id: string): Promise<void> => {
    try {
      await db.deleteCgatRecord(id);
      await fetchCgatRecords();
    } catch (error) {
      console.error('刪除 CGAT 記錄失敗:', error);
      throw error;
    }
  }, [fetchCgatRecords]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchCgatRecords(); }, 300);
    return () => clearTimeout(timer);
  }, [fetchCgatRecords]);

  const value: CgatContextType = {
    cgatRecords,
    loading,
    visitDates,
    visitDatesLoaded,
    refreshVisitDates: fetchVisitDates,
    fetchCgatRecords,
    addCgatRecord,
    updateCgatRecord,
    deleteCgatRecord,
    refreshCgatData,
  };

  return <CgatContext.Provider value={value}>{children}</CgatContext.Provider>;
}

export function useCgat(): CgatContextType {
  const context = useContext(CgatContext);
  if (context === undefined) {
    throw new Error('useCgat must be used within a CgatProvider');
  }
  return context;
}
