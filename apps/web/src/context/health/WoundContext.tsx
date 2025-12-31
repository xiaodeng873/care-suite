/**
 * WoundContext - 傷口管理 Context
 * 
 * 從 PatientContext 拆分出來，專門處理傷口相關功能：
 * - 傷口 CRUD (wounds)
 * - 傷口評估記錄 (woundAssessments)
 * - 患者傷口列表 (patientsWithWounds)
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';

// ========== 類型定義 ==========
// 傷口照片介面
export interface WoundPhoto {
  id: string;
  base64: string;
  filename: string;
  uploadDate: string;
  description?: string;
}

interface WoundContextType {
  // 狀態
  wounds: db.Wound[];
  woundAssessments: db.WoundAssessment[];
  patientsWithWounds: db.PatientWithWounds[];
  loading: boolean;
  
  // 傷口 CRUD
  addWound: (wound: Omit<db.Wound, 'id' | 'created_at' | 'updated_at'>) => Promise<db.Wound | null>;
  updateWound: (wound: Partial<db.Wound> & { id: string }) => Promise<db.Wound | null>;
  deleteWound: (id: string) => Promise<void>;
  healWound: (woundId: string, healedDate?: string) => Promise<db.Wound | null>;
  
  // 傷口查詢
  getWoundWithAssessments: (woundId: string) => Promise<db.WoundWithAssessments | null>;
  getWoundsNeedingAssessment: () => Promise<db.Wound[]>;
  generateWoundCode: (patientId: number) => Promise<string>;
  
  // 傷口評估
  addWoundAssessmentForWound: (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => Promise<void>;
  addWoundAssessment: (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => Promise<void>;
  updateWoundAssessment: (assessment: db.WoundAssessment) => Promise<void>;
  deleteWoundAssessment: (id: string) => Promise<void>;
  
  // 刷新數據
  refreshWoundData: () => Promise<void>;
}

// 只讀數據 Hook 的類型
interface WoundDataType {
  wounds: db.Wound[];
  woundAssessments: db.WoundAssessment[];
  patientsWithWounds: db.PatientWithWounds[];
  loading: boolean;
}

// ========== Context 創建 ==========
const WoundContext = createContext<WoundContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface WoundProviderProps {
  children: ReactNode;
}

export function WoundProvider({ children }: WoundProviderProps) {
  // 狀態定義
  const [wounds, setWounds] = useState<db.Wound[]>([]);
  const [woundAssessments, setWoundAssessments] = useState<db.WoundAssessment[]>([]);
  const [patientsWithWounds, setPatientsWithWounds] = useState<db.PatientWithWounds[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ========== 刷新數據 ==========
  const refreshWoundData = useCallback(async () => {
    setLoading(true);
    try {
      const [woundsData, patientsWithWoundsData, woundAssessmentsData] = await Promise.all([
        db.getWounds(),
        db.getPatientsWithWounds(),
        db.getWoundAssessments()
      ]);
      setWounds(woundsData || []);
      setPatientsWithWounds(patientsWithWoundsData || []);
      setWoundAssessments(woundAssessmentsData || []);
    } catch (error) {
      console.error('Error refreshing wound data:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // ========== 傷口 CRUD ==========
  const addWound = useCallback(async (wound: Omit<db.Wound, 'id' | 'created_at' | 'updated_at'>): Promise<db.Wound | null> => {
    try {
      const newWound = await db.createWound(wound);
      if (newWound) {
        await refreshWoundData();
      }
      return newWound;
    } catch (error) {
      console.error('Error adding wound:', error);
      throw error;
    }
  }, [refreshWoundData]);
  
  const updateWound = useCallback(async (wound: Partial<db.Wound> & { id: string }): Promise<db.Wound | null> => {
    try {
      const updatedWound = await db.updateWound(wound);
      if (updatedWound) {
        await refreshWoundData();
      }
      return updatedWound;
    } catch (error) {
      console.error('Error updating wound:', error);
      throw error;
    }
  }, [refreshWoundData]);
  
  const deleteWound = useCallback(async (id: string) => {
    try {
      const success = await db.deleteWound(id);
      if (success) {
        await refreshWoundData();
      }
    } catch (error) {
      console.error('Error deleting wound:', error);
      throw error;
    }
  }, [refreshWoundData]);
  
  const healWound = useCallback(async (woundId: string, healedDate?: string): Promise<db.Wound | null> => {
    try {
      const healedWound = await db.healWound(woundId, healedDate);
      if (healedWound) {
        await refreshWoundData();
      }
      return healedWound;
    } catch (error) {
      console.error('Error healing wound:', error);
      throw error;
    }
  }, [refreshWoundData]);
  
  // ========== 傷口查詢 ==========
  const getWoundWithAssessments = useCallback(async (woundId: string): Promise<db.WoundWithAssessments | null> => {
    try {
      return await db.getWoundWithAssessments(woundId);
    } catch (error) {
      console.error('Error getting wound with assessments:', error);
      throw error;
    }
  }, []);
  
  const getWoundsNeedingAssessment = useCallback(async (): Promise<db.Wound[]> => {
    try {
      return await db.getWoundsNeedingAssessment();
    } catch (error) {
      console.error('Error getting wounds needing assessment:', error);
      throw error;
    }
  }, []);
  
  const generateWoundCode = useCallback(async (patientId: number): Promise<string> => {
    try {
      return await db.generateWoundCode(patientId);
    } catch (error) {
      console.error('Error generating wound code:', error);
      throw error;
    }
  }, []);
  
  // ========== 傷口評估 ==========
  const addWoundAssessmentForWound = useCallback(async (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => {
    try {
      await db.createWoundAssessmentForWound(assessment);
      await refreshWoundData();
    } catch (error) {
      console.error('Error adding wound assessment for wound:', error);
      throw error;
    }
  }, [refreshWoundData]);
  
  const addWoundAssessment = useCallback(async (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => {
    try {
      await db.createWoundAssessment(assessment);
      await refreshWoundData();
    } catch (error) {
      console.error('Error adding wound assessment:', error);
      throw error;
    }
  }, [refreshWoundData]);
  
  const updateWoundAssessment = useCallback(async (assessment: db.WoundAssessment) => {
    try {
      await db.updateWoundAssessment(assessment);
      await refreshWoundData();
    } catch (error) {
      console.error('Error updating wound assessment:', error);
      throw error;
    }
  }, [refreshWoundData]);
  
  const deleteWoundAssessment = useCallback(async (id: string) => {
    try {
      await db.deleteWoundAssessment(id);
      await refreshWoundData();
    } catch (error) {
      console.error('Error deleting wound assessment:', error);
      throw error;
    }
  }, [refreshWoundData]);
  
  // 自動刷新資料
  useEffect(() => {
    refreshWoundData();
  }, [refreshWoundData]);
  
  // Context 值
  const value: WoundContextType = {
    // 狀態
    wounds,
    woundAssessments,
    patientsWithWounds,
    loading,
    
    // 傷口 CRUD
    addWound,
    updateWound,
    deleteWound,
    healWound,
    
    // 傷口查詢
    getWoundWithAssessments,
    getWoundsNeedingAssessment,
    generateWoundCode,
    
    // 傷口評估
    addWoundAssessmentForWound,
    addWoundAssessment,
    updateWoundAssessment,
    deleteWoundAssessment,
    
    // 刷新
    refreshWoundData,
  };
  
  return (
    <WoundContext.Provider value={value}>
      {children}
    </WoundContext.Provider>
  );
}

// ========== Hooks ==========
/**
 * 完整的傷口 Context（包含 CRUD 操作）
 */
export function useWound(): WoundContextType {
  const context = useContext(WoundContext);
  if (context === undefined) {
    throw new Error('useWound must be used within a WoundProvider');
  }
  return context;
}

/**
 * 只讀數據 Hook - 用於只需要讀取數據的組件
 */
export function useWoundData(): WoundDataType {
  const { wounds, woundAssessments, patientsWithWounds, loading } = useWound();
  return { wounds, woundAssessments, patientsWithWounds, loading };
}

export default WoundContext;
