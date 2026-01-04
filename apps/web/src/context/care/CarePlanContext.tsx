/**
 * CarePlanContext - 個人照顧計劃 (ICP) 管理 Context
 * 
 * 從 PatientContext 拆分出來，專門處理個人照顧計劃相關功能：
 * - 照顧計劃 (CarePlan)
 * - 問題庫 (ProblemLibrary)
 * - 護理需求項目 (NursingNeedItem)
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// ========== 類型定義 ==========
interface CarePlanContextType {
  // 狀態
  carePlans: db.CarePlan[];
  problemLibrary: db.ProblemLibrary[];
  nursingNeedItems: db.NursingNeedItem[];
  loading: boolean;
  
  // 照顧計劃 CRUD
  addCarePlan: (
    plan: Omit<db.CarePlan, 'id' | 'created_at' | 'updated_at' | 'review_due_date'>,
    nursingNeeds?: { nursing_need_item_id: string; has_need: boolean; remarks?: string }[],
    problems?: Omit<db.CarePlanProblem, 'id' | 'care_plan_id' | 'created_at' | 'updated_at'>[]
  ) => Promise<db.CarePlan>;
  updateCarePlan: (
    planId: string,
    plan: Partial<db.CarePlan>,
    nursingNeeds?: { nursing_need_item_id: string; has_need: boolean; remarks?: string }[],
    problems?: Omit<db.CarePlanProblem, 'id' | 'care_plan_id' | 'created_at' | 'updated_at'>[]
  ) => Promise<db.CarePlan>;
  deleteCarePlan: (planId: string) => Promise<void>;
  duplicateCarePlan: (
    sourcePlanId: string,
    newPlanType: db.PlanType,
    newPlanDate: string,
    createdBy: string
  ) => Promise<db.CarePlan>;
  getCarePlanWithDetails: (planId: string) => Promise<db.CarePlanWithDetails | null>;
  getCarePlanHistory: (planId: string) => Promise<db.CarePlan[]>;
  
  // 問題庫 CRUD
  addProblemToLibrary: (
    problem: Omit<db.ProblemLibrary, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<db.ProblemLibrary>;
  updateProblemLibrary: (
    problem: Partial<db.ProblemLibrary> & { id: string }
  ) => Promise<db.ProblemLibrary>;
  deleteProblemLibrary: (id: string) => Promise<void>;
  
  // 護理需求項目 CRUD
  addNursingNeedItem: (
    item: Omit<db.NursingNeedItem, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<db.NursingNeedItem>;
  
  // 刷新數據
  refreshCarePlanData: () => Promise<void>;
}

// 只讀數據 Hook 的類型
interface CarePlanDataType {
  carePlans: db.CarePlan[];
  problemLibrary: db.ProblemLibrary[];
  nursingNeedItems: db.NursingNeedItem[];
  loading: boolean;
}

// ========== Context 創建 ==========
const CarePlanContext = createContext<CarePlanContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface CarePlanProviderProps {
  children: ReactNode;
}

export function CarePlanProvider({ children }: CarePlanProviderProps) {
  const { isAuthenticated } = useAuth();
  
  // 狀態定義
  const [carePlans, setCarePlans] = useState<db.CarePlan[]>([]);
  const [problemLibrary, setProblemLibrary] = useState<db.ProblemLibrary[]>([]);
  const [nursingNeedItems, setNursingNeedItems] = useState<db.NursingNeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ========== 刷新數據 ==========
  const refreshCarePlanData = useCallback(async () => {
    if (!isAuthenticated()) return;
    
    setLoading(true);
    try {
      const [plansData, libraryData, needItemsData] = await Promise.all([
        db.getAllCarePlans(),
        db.getAllProblemLibrary(),
        db.getAllNursingNeedItems()
      ]);
      setCarePlans(plansData || []);
      setProblemLibrary(libraryData || []);
      setNursingNeedItems(needItemsData || []);
    } catch (error) {
      console.error('刷新個人照顧計劃資料失敗:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);
  
  // ========== 照顧計劃 CRUD ==========
  const addCarePlan = useCallback(async (
    plan: Omit<db.CarePlan, 'id' | 'created_at' | 'updated_at' | 'review_due_date'>,
    nursingNeeds?: { nursing_need_item_id: string; has_need: boolean; remarks?: string }[],
    problems?: Omit<db.CarePlanProblem, 'id' | 'care_plan_id' | 'created_at' | 'updated_at'>[]
  ): Promise<db.CarePlan> => {
    const newPlan = await db.createCarePlan(plan, nursingNeeds, problems);
    await refreshCarePlanData();
    return newPlan;
  }, [refreshCarePlanData]);
  
  const updateCarePlan = useCallback(async (
    planId: string,
    plan: Partial<db.CarePlan>,
    nursingNeeds?: { nursing_need_item_id: string; has_need: boolean; remarks?: string }[],
    problems?: Omit<db.CarePlanProblem, 'id' | 'care_plan_id' | 'created_at' | 'updated_at'>[]
  ): Promise<db.CarePlan> => {
    const updatedPlan = await db.updateCarePlan(planId, plan, nursingNeeds, problems);
    await refreshCarePlanData();
    return updatedPlan;
  }, [refreshCarePlanData]);
  
  const deleteCarePlan = useCallback(async (planId: string): Promise<void> => {
    await db.deleteCarePlan(planId);
    await refreshCarePlanData();
  }, [refreshCarePlanData]);
  
  const duplicateCarePlan = useCallback(async (
    sourcePlanId: string,
    newPlanType: db.PlanType,
    newPlanDate: string,
    createdBy: string
  ): Promise<db.CarePlan> => {
    const newPlan = await db.duplicateCarePlan(sourcePlanId, newPlanType, newPlanDate, createdBy);
    await refreshCarePlanData();
    return newPlan;
  }, [refreshCarePlanData]);
  
  const getCarePlanWithDetails = useCallback(async (planId: string): Promise<db.CarePlanWithDetails | null> => {
    return db.getCarePlanWithDetails(planId);
  }, []);
  
  const getCarePlanHistory = useCallback(async (planId: string): Promise<db.CarePlan[]> => {
    return db.getCarePlanHistory(planId);
  }, []);
  
  // ========== 問題庫 CRUD ==========
  const addProblemToLibrary = useCallback(async (
    problem: Omit<db.ProblemLibrary, 'id' | 'created_at' | 'updated_at'>
  ): Promise<db.ProblemLibrary> => {
    const newProblem = await db.createProblemLibrary(problem);
    await refreshCarePlanData();
    return newProblem;
  }, [refreshCarePlanData]);
  
  const updateProblemLibrary = useCallback(async (
    problem: Partial<db.ProblemLibrary> & { id: string }
  ): Promise<db.ProblemLibrary> => {
    const updated = await db.updateProblemLibrary(problem);
    await refreshCarePlanData();
    return updated;
  }, [refreshCarePlanData]);
  
  const deleteProblemLibrary = useCallback(async (id: string): Promise<void> => {
    await db.deleteProblemLibrary(id);
    await refreshCarePlanData();
  }, [refreshCarePlanData]);
  
  // ========== 護理需求項目 CRUD ==========
  const addNursingNeedItem = useCallback(async (
    item: Omit<db.NursingNeedItem, 'id' | 'created_at' | 'updated_at'>
  ): Promise<db.NursingNeedItem> => {
    const newItem = await db.createNursingNeedItem(item);
    await refreshCarePlanData();
    return newItem;
  }, [refreshCarePlanData]);
  
  // 自動刷新資料
  useEffect(() => {
    refreshCarePlanData();
  }, [refreshCarePlanData]);
  
  // Context 值
  const value: CarePlanContextType = {
    // 狀態
    carePlans,
    problemLibrary,
    nursingNeedItems,
    loading,
    
    // 照顧計劃 CRUD
    addCarePlan,
    updateCarePlan,
    deleteCarePlan,
    duplicateCarePlan,
    getCarePlanWithDetails,
    getCarePlanHistory,
    
    // 問題庫 CRUD
    addProblemToLibrary,
    updateProblemLibrary,
    deleteProblemLibrary,
    
    // 護理需求項目 CRUD
    addNursingNeedItem,
    
    // 刷新
    refreshCarePlanData,
  };
  
  return (
    <CarePlanContext.Provider value={value}>
      {children}
    </CarePlanContext.Provider>
  );
}

// ========== Hooks ==========
/**
 * 完整的個人照顧計劃 Context（包含 CRUD 操作）
 */
export function useCarePlan(): CarePlanContextType {
  const context = useContext(CarePlanContext);
  if (context === undefined) {
    throw new Error('useCarePlan must be used within a CarePlanProvider');
  }
  return context;
}

/**
 * 只讀數據 Hook - 用於只需要讀取數據的組件
 */
export function useCarePlanData(): CarePlanDataType {
  const { carePlans, problemLibrary, nursingNeedItems, loading } = useCarePlan();
  return { carePlans, problemLibrary, nursingNeedItems, loading };
}

export default CarePlanContext;
