/**
 * RecordsContext - 合併的記錄管理 Context
 * 
 * 將以下 Context 合併為一個，減少 Provider 嵌套層級，提升性能：
 * - CarePlanContext (個人照顧計劃)
 * - CareRecordsContext (護理記錄)
 * - AssessmentContext (評估)
 * - IncidentContext (事故報告)
 * - MealContext (餐飲指導)
 * - PatientLogContext (院友日誌)
 * - HealthTaskContext (健康任務)
 * - AdmissionContext (入院記錄)
 * - ServiceReasonContext (服務原因)
 * - DailySystemTaskContext (每日系統任務)
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// ========== Context 類型定義 ==========
interface RecordsContextType {
  // ===== 個人照顧計劃 =====
  carePlans: db.CarePlan[];
  problemLibrary: db.ProblemLibrary[];
  nursingNeedItems: db.NursingNeedItem[];
  carePlanLoading: boolean;
  addCarePlan: (plan: Omit<db.CarePlan, 'id' | 'created_at' | 'updated_at' | 'review_due_date'>, nursingNeeds?: { nursing_need_item_id: string; has_need: boolean; remarks?: string }[], problems?: Omit<db.CarePlanProblem, 'id' | 'care_plan_id' | 'created_at' | 'updated_at'>[]) => Promise<db.CarePlan>;
  updateCarePlan: (planId: string, plan: Partial<db.CarePlan>, nursingNeeds?: { nursing_need_item_id: string; has_need: boolean; remarks?: string }[], problems?: Omit<db.CarePlanProblem, 'id' | 'care_plan_id' | 'created_at' | 'updated_at'>[]) => Promise<db.CarePlan>;
  deleteCarePlan: (planId: string) => Promise<void>;
  duplicateCarePlan: (sourcePlanId: string, newPlanType: db.PlanType, newPlanDate: string, createdBy: string) => Promise<db.CarePlan>;
  getCarePlanWithDetails: (planId: string) => Promise<db.CarePlanWithDetails | null>;
  getCarePlanHistory: (planId: string) => Promise<db.CarePlan[]>;
  addProblemToLibrary: (problem: Omit<db.ProblemLibrary, 'id' | 'created_at' | 'updated_at'>) => Promise<db.ProblemLibrary>;
  updateProblemLibrary: (problem: Partial<db.ProblemLibrary> & { id: string }) => Promise<db.ProblemLibrary>;
  deleteProblemLibrary: (id: string) => Promise<void>;
  addNursingNeedItem: (item: Omit<db.NursingNeedItem, 'id' | 'created_at' | 'updated_at'>) => Promise<db.NursingNeedItem>;
  refreshCarePlanData: () => Promise<void>;
  
  // ===== 護理記錄 =====
  patientNotes: db.PatientNote[];
  patrolRounds: db.PatrolRound[];
  diaperChangeRecords: db.DiaperChangeRecord[];
  restraintObservationRecords: db.RestraintObservationRecord[];
  positionChangeRecords: db.PositionChangeRecord[];
  careRecordsLoading: boolean;
  addPatientNote: (note: Omit<db.PatientNote, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientNote: (note: db.PatientNote) => Promise<void>;
  deletePatientNote: (id: string) => Promise<void>;
  completePatientNote: (id: string) => Promise<void>;
  createPatrolRound: (round: Omit<db.PatrolRound, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  deletePatrolRound: (id: string) => Promise<void>;
  createDiaperChangeRecord: (record: Omit<db.DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDiaperChangeRecord: (record: db.DiaperChangeRecord) => Promise<void>;
  deleteDiaperChangeRecord: (id: string) => Promise<void>;
  createRestraintObservationRecord: (record: Omit<db.RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateRestraintObservationRecord: (record: db.RestraintObservationRecord) => Promise<void>;
  deleteRestraintObservationRecord: (id: string) => Promise<void>;
  createPositionChangeRecord: (record: Omit<db.PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  deletePositionChangeRecord: (id: string) => Promise<void>;
  refreshCareRecordsData: () => Promise<void>;
  
  // ===== 評估 =====
  healthAssessments: db.HealthAssessment[];
  patientRestraintAssessments: db.PatientRestraintAssessment[];
  annualHealthCheckups: any[];
  assessmentLoading: boolean;
  addHealthAssessment: (assessment: Omit<db.HealthAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => Promise<void>;
  updateHealthAssessment: (assessment: db.HealthAssessment) => Promise<void>;
  deleteHealthAssessment: (id: string) => Promise<void>;
  addPatientRestraintAssessment: (assessment: Omit<db.PatientRestraintAssessment, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientRestraintAssessment: (assessment: db.PatientRestraintAssessment) => Promise<void>;
  deletePatientRestraintAssessment: (id: string) => Promise<void>;
  addAnnualHealthCheckup: (checkup: any) => Promise<void>;
  updateAnnualHealthCheckup: (checkup: any) => Promise<void>;
  deleteAnnualHealthCheckup: (id: string) => Promise<void>;
  refreshAssessmentData: () => Promise<void>;
  
  // ===== 事故報告 =====
  incidentReports: db.IncidentReport[];
  incidentLoading: boolean;
  addIncidentReport: (report: Omit<db.IncidentReport, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateIncidentReport: (report: db.IncidentReport) => Promise<void>;
  deleteIncidentReport: (id: string) => Promise<void>;
  refreshIncidentData: () => Promise<void>;
  
  // ===== 餐飲指導 =====
  mealGuidances: db.MealGuidance[];
  mealLoading: boolean;
  addMealGuidance: (guidance: Omit<db.MealGuidance, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMealGuidance: (guidance: db.MealGuidance) => Promise<void>;
  deleteMealGuidance: (id: string) => Promise<void>;
  refreshMealData: () => Promise<void>;
  
  // ===== 院友日誌 =====
  patientLogs: db.PatientLog[];
  patientLogLoading: boolean;
  addPatientLog: (log: Omit<db.PatientLog, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientLog: (log: db.PatientLog) => Promise<void>;
  deletePatientLog: (id: string) => Promise<void>;
  refreshPatientLogData: () => Promise<void>;
  
  // ===== 健康任務 =====
  patientHealthTasks: db.PatientHealthTask[];
  healthTaskLoading: boolean;
  addPatientHealthTask: (task: Omit<db.PatientHealthTask, 'id' | 'created_at' | 'updated_at'>) => Promise<db.PatientHealthTask>;
  updatePatientHealthTask: (task: db.PatientHealthTask) => Promise<void>;
  deletePatientHealthTask: (id: string) => Promise<void>;
  setPatientHealthTasks: React.Dispatch<React.SetStateAction<db.PatientHealthTask[]>>;
  refreshHealthTaskData: () => Promise<void>;
  
  // ===== 入院記錄 =====
  patientAdmissionRecords: db.PatientAdmissionRecord[];
  hospitalEpisodes: any[];
  admissionLoading: boolean;
  addPatientAdmissionRecord: (record: Omit<db.PatientAdmissionRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientAdmissionRecord: (record: db.PatientAdmissionRecord) => Promise<void>;
  deletePatientAdmissionRecord: (id: string) => Promise<void>;
  addHospitalEpisode: (episodeData: any) => Promise<void>;
  updateHospitalEpisode: (episodeData: any) => Promise<void>;
  deleteHospitalEpisode: (id: string) => Promise<void>;
  recordPatientAdmissionEvent: (eventData: { patient_id: number; event_type: db.AdmissionEventType; event_date: string; hospital_name?: string; hospital_ward?: string; hospital_bed_number?: string; remarks?: string }) => Promise<void>;
  refreshAdmissionData: () => Promise<void>;
  
  // ===== 服務原因 =====
  serviceReasons: db.ServiceReason[];
  refreshServiceReasonData: () => Promise<void>;
  
  // ===== 每日系統任務 =====
  dailySystemTasks: db.DailySystemTask[];
  getOverdueDailySystemTasks: () => Promise<db.DailySystemTask[]>;
  refreshDailySystemTaskData: () => Promise<void>;
  
  // ===== 統一加載狀態 =====
  loading: boolean;
  
  // ===== 統一刷新 =====
  refreshAllRecordsData: () => Promise<void>;
}

// ========== Context 創建 ==========
const RecordsContext = createContext<RecordsContextType | undefined>(undefined);

// ========== Provider 組件 ==========
interface RecordsProviderProps {
  children: ReactNode;
}

export function RecordsProvider({ children }: RecordsProviderProps) {
  const { isAuthenticated } = useAuth();
  
  // ===== 個人照顧計劃狀態 =====
  const [carePlans, setCarePlans] = useState<db.CarePlan[]>([]);
  const [problemLibrary, setProblemLibrary] = useState<db.ProblemLibrary[]>([]);
  const [nursingNeedItems, setNursingNeedItems] = useState<db.NursingNeedItem[]>([]);
  const [carePlanLoading, setCarePlanLoading] = useState(false);
  
  // ===== 護理記錄狀態 =====
  const [patientNotes, setPatientNotes] = useState<db.PatientNote[]>([]);
  const [patrolRounds, setPatrolRounds] = useState<db.PatrolRound[]>([]);
  const [diaperChangeRecords, setDiaperChangeRecords] = useState<db.DiaperChangeRecord[]>([]);
  const [restraintObservationRecords, setRestraintObservationRecords] = useState<db.RestraintObservationRecord[]>([]);
  const [positionChangeRecords, setPositionChangeRecords] = useState<db.PositionChangeRecord[]>([]);
  const [careRecordsLoading, setCareRecordsLoading] = useState(false);
  
  // ===== 評估狀態 =====
  const [healthAssessments, setHealthAssessments] = useState<db.HealthAssessment[]>([]);
  const [patientRestraintAssessments, setPatientRestraintAssessments] = useState<db.PatientRestraintAssessment[]>([]);
  const [annualHealthCheckups, setAnnualHealthCheckups] = useState<any[]>([]);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  
  // ===== 事故報告狀態 =====
  const [incidentReports, setIncidentReports] = useState<db.IncidentReport[]>([]);
  const [incidentLoading, setIncidentLoading] = useState(false);
  
  // ===== 餐飲指導狀態 =====
  const [mealGuidances, setMealGuidances] = useState<db.MealGuidance[]>([]);
  const [mealLoading, setMealLoading] = useState(false);
  
  // ===== 院友日誌狀態 =====
  const [patientLogs, setPatientLogs] = useState<db.PatientLog[]>([]);
  const [patientLogLoading, setPatientLogLoading] = useState(false);
  
  // ===== 健康任務狀態 =====
  const [patientHealthTasks, setPatientHealthTasks] = useState<db.PatientHealthTask[]>([]);
  const [healthTaskLoading, setHealthTaskLoading] = useState(false);
  
  // ===== 入院記錄狀態 =====
  const [patientAdmissionRecords, setPatientAdmissionRecords] = useState<db.PatientAdmissionRecord[]>([]);
  const [hospitalEpisodes, setHospitalEpisodes] = useState<any[]>([]);
  const [admissionLoading, setAdmissionLoading] = useState(false);
  
  // ===== 服務原因狀態 =====
  const [serviceReasons, setServiceReasons] = useState<db.ServiceReason[]>([]);
  
  // ===== 每日系統任務狀態 =====
  const [dailySystemTasks, setDailySystemTasks] = useState<db.DailySystemTask[]>([]);

  // ===== 個人照顧計劃函數 =====
  const refreshCarePlanData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setCarePlanLoading(true);
    try {
      const [plansData, libraryData, needItemsData] = await Promise.all([
        db.getAllCarePlans(), db.getAllProblemLibrary(), db.getAllNursingNeedItems()
      ]);
      setCarePlans(plansData || []);
      setProblemLibrary(libraryData || []);
      setNursingNeedItems(needItemsData || []);
    } catch (error) {
      console.error('刷新個人照顧計劃資料失敗:', error);
    } finally {
      setCarePlanLoading(false);
    }
  }, [isAuthenticated]);

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
    planId: string, plan: Partial<db.CarePlan>,
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

  const duplicateCarePlan = useCallback(async (sourcePlanId: string, newPlanType: db.PlanType, newPlanDate: string, createdBy: string): Promise<db.CarePlan> => {
    const newPlan = await db.duplicateCarePlan(sourcePlanId, newPlanType, newPlanDate, createdBy);
    await refreshCarePlanData();
    return newPlan;
  }, [refreshCarePlanData]);

  const getCarePlanWithDetails = useCallback(async (planId: string): Promise<db.CarePlanWithDetails | null> => db.getCarePlanWithDetails(planId), []);
  const getCarePlanHistory = useCallback(async (planId: string): Promise<db.CarePlan[]> => db.getCarePlanHistory(planId), []);

  const addProblemToLibrary = useCallback(async (problem: Omit<db.ProblemLibrary, 'id' | 'created_at' | 'updated_at'>): Promise<db.ProblemLibrary> => {
    const newProblem = await db.createProblemLibrary(problem);
    await refreshCarePlanData();
    return newProblem;
  }, [refreshCarePlanData]);

  const updateProblemLibrary = useCallback(async (problem: Partial<db.ProblemLibrary> & { id: string }): Promise<db.ProblemLibrary> => {
    const updated = await db.updateProblemLibrary(problem);
    await refreshCarePlanData();
    return updated;
  }, [refreshCarePlanData]);

  const deleteProblemLibrary = useCallback(async (id: string): Promise<void> => {
    await db.deleteProblemLibrary(id);
    await refreshCarePlanData();
  }, [refreshCarePlanData]);

  const addNursingNeedItem = useCallback(async (item: Omit<db.NursingNeedItem, 'id' | 'created_at' | 'updated_at'>): Promise<db.NursingNeedItem> => {
    const newItem = await db.createNursingNeedItem(item);
    await refreshCarePlanData();
    return newItem;
  }, [refreshCarePlanData]);

  // ===== 護理記錄函數 =====
  const refreshCareRecordsData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setCareRecordsLoading(true);
    try {
      const [notesData, patrolRoundsData, diaperChangeRecordsData, restraintObservationRecordsData, positionChangeRecordsData] = await Promise.all([
        db.getPatientNotes(), db.getPatrolRounds(), db.getDiaperChangeRecords(), db.getRestraintObservationRecords(), db.getPositionChangeRecords()
      ]);
      setPatientNotes(notesData || []);
      setPatrolRounds(patrolRoundsData || []);
      setDiaperChangeRecords(diaperChangeRecordsData || []);
      setRestraintObservationRecords(restraintObservationRecordsData || []);
      setPositionChangeRecords(positionChangeRecordsData || []);
    } catch (error) {
      console.error('Error refreshing care records data:', error);
    } finally {
      setCareRecordsLoading(false);
    }
  }, [isAuthenticated]);

  const addPatientNote = useCallback(async (note: Omit<db.PatientNote, 'id' | 'created_at' | 'updated_at'>) => { await db.createPatientNote(note); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const updatePatientNote = useCallback(async (note: db.PatientNote) => { await db.updatePatientNote(note); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const deletePatientNote = useCallback(async (id: string) => { await db.deletePatientNote(id); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const completePatientNote = useCallback(async (id: string) => { await db.completePatientNote(id); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const createPatrolRound = useCallback(async (round: Omit<db.PatrolRound, 'id' | 'created_at' | 'updated_at'>) => { await db.createPatrolRound(round); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const deletePatrolRound = useCallback(async (id: string) => { await db.deletePatrolRound(id); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const createDiaperChangeRecord = useCallback(async (record: Omit<db.DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'>) => { await db.createDiaperChangeRecord(record); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const updateDiaperChangeRecord = useCallback(async (record: db.DiaperChangeRecord) => { await db.updateDiaperChangeRecord(record); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const deleteDiaperChangeRecord = useCallback(async (id: string) => { await db.deleteDiaperChangeRecord(id); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const createRestraintObservationRecord = useCallback(async (record: Omit<db.RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'>) => { await db.createRestraintObservationRecord(record); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const updateRestraintObservationRecord = useCallback(async (record: db.RestraintObservationRecord) => { await db.updateRestraintObservationRecord(record); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const deleteRestraintObservationRecord = useCallback(async (id: string) => { await db.deleteRestraintObservationRecord(id); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const createPositionChangeRecord = useCallback(async (record: Omit<db.PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>) => { await db.createPositionChangeRecord(record); await refreshCareRecordsData(); }, [refreshCareRecordsData]);
  const deletePositionChangeRecord = useCallback(async (id: string) => { await db.deletePositionChangeRecord(id); await refreshCareRecordsData(); }, [refreshCareRecordsData]);

  // ===== 評估函數 =====
  const refreshAssessmentData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setAssessmentLoading(true);
    try {
      const [healthAssessmentsData, patientRestraintAssessmentsData, annualHealthCheckupsData] = await Promise.all([
        db.getHealthAssessments(), db.getRestraintAssessments(), db.getAnnualHealthCheckups()
      ]);
      setHealthAssessments(healthAssessmentsData);
      setPatientRestraintAssessments(patientRestraintAssessmentsData);
      setAnnualHealthCheckups(annualHealthCheckupsData || []);
    } catch (error) {
      console.error('刷新評估數據失敗:', error);
    } finally {
      setAssessmentLoading(false);
    }
  }, [isAuthenticated]);

  const addHealthAssessment = useCallback(async (assessment: Omit<db.HealthAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => { await db.createHealthAssessment(assessment); await refreshAssessmentData(); }, [refreshAssessmentData]);
  const updateHealthAssessment = useCallback(async (assessment: db.HealthAssessment) => { await db.updateHealthAssessment(assessment); await refreshAssessmentData(); }, [refreshAssessmentData]);
  const deleteHealthAssessment = useCallback(async (id: string) => { await db.deleteHealthAssessment(id); await refreshAssessmentData(); }, [refreshAssessmentData]);
  const addPatientRestraintAssessment = useCallback(async (assessment: Omit<db.PatientRestraintAssessment, 'id' | 'created_at' | 'updated_at'>) => { await db.createRestraintAssessment(assessment); await refreshAssessmentData(); }, [refreshAssessmentData]);
  const updatePatientRestraintAssessment = useCallback(async (assessment: db.PatientRestraintAssessment) => { await db.updateRestraintAssessment(assessment); await refreshAssessmentData(); }, [refreshAssessmentData]);
  const deletePatientRestraintAssessment = useCallback(async (id: string) => { await db.deleteRestraintAssessment(id); await refreshAssessmentData(); }, [refreshAssessmentData]);
  const addAnnualHealthCheckup = useCallback(async (checkup: any) => { await db.createAnnualHealthCheckup(checkup); await refreshAssessmentData(); }, [refreshAssessmentData]);
  const updateAnnualHealthCheckup = useCallback(async (checkup: any) => { await db.updateAnnualHealthCheckup(checkup); await refreshAssessmentData(); }, [refreshAssessmentData]);
  const deleteAnnualHealthCheckup = useCallback(async (id: string) => { await db.deleteAnnualHealthCheckup(id); await refreshAssessmentData(); }, [refreshAssessmentData]);

  // ===== 事故報告函數 =====
  const refreshIncidentData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setIncidentLoading(true);
    try { const data = await db.getIncidentReports(); setIncidentReports(data || []); }
    catch (error) { console.error('刷新事故報告數據失敗:', error); }
    finally { setIncidentLoading(false); }
  }, [isAuthenticated]);

  const addIncidentReport = useCallback(async (report: Omit<db.IncidentReport, 'id' | 'created_at' | 'updated_at'>) => { await db.createIncidentReport(report); await refreshIncidentData(); }, [refreshIncidentData]);
  const updateIncidentReport = useCallback(async (report: db.IncidentReport) => { await db.updateIncidentReport(report); await refreshIncidentData(); }, [refreshIncidentData]);
  const deleteIncidentReport = useCallback(async (id: string) => { await db.deleteIncidentReport(id); await refreshIncidentData(); }, [refreshIncidentData]);

  // ===== 餐飲指導函數 =====
  const refreshMealData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setMealLoading(true);
    try { const data = await db.getMealGuidances(); setMealGuidances(data); }
    catch (error) { console.error('刷新餐飲指導數據失敗:', error); }
    finally { setMealLoading(false); }
  }, [isAuthenticated]);

  const addMealGuidance = useCallback(async (guidance: Omit<db.MealGuidance, 'id' | 'created_at' | 'updated_at'>) => { await db.createMealGuidance(guidance); await refreshMealData(); }, [refreshMealData]);
  const updateMealGuidance = useCallback(async (guidance: db.MealGuidance) => { await db.updateMealGuidance(guidance); await refreshMealData(); }, [refreshMealData]);
  const deleteMealGuidance = useCallback(async (id: string) => { await db.deleteMealGuidance(id); await refreshMealData(); }, [refreshMealData]);

  // ===== 院友日誌函數 =====
  const refreshPatientLogData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setPatientLogLoading(true);
    try { const data = await db.getPatientLogs(); setPatientLogs(data); }
    catch (error) { console.error('刷新院友日誌數據失敗:', error); }
    finally { setPatientLogLoading(false); }
  }, [isAuthenticated]);

  const addPatientLog = useCallback(async (log: Omit<db.PatientLog, 'id' | 'created_at' | 'updated_at'>) => { await db.createPatientLog(log); await refreshPatientLogData(); }, [refreshPatientLogData]);
  const updatePatientLog = useCallback(async (log: db.PatientLog) => { await db.updatePatientLog(log); await refreshPatientLogData(); }, [refreshPatientLogData]);
  const deletePatientLog = useCallback(async (id: string) => { await db.deletePatientLog(id); await refreshPatientLogData(); }, [refreshPatientLogData]);

  // ===== 健康任務函數 =====
  const refreshHealthTaskData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setHealthTaskLoading(true);
    try {
      const data = await db.getHealthTasks();
      const uniqueTasksMap = new Map<string, db.PatientHealthTask>();
      data.forEach(task => { if (!uniqueTasksMap.has(task.id)) { uniqueTasksMap.set(task.id, task); } });
      setPatientHealthTasks(Array.from(uniqueTasksMap.values()));
    } catch (error) { console.error('刷新健康任務數據失敗:', error); }
    finally { setHealthTaskLoading(false); }
  }, [isAuthenticated]);

  const addPatientHealthTask = useCallback(async (task: Omit<db.PatientHealthTask, 'id' | 'created_at' | 'updated_at'>) => {
    const newTask = await db.createPatientHealthTask(task);
    setPatientHealthTasks(prev => [newTask, ...prev]);
    return newTask;
  }, []);
  const updatePatientHealthTask = useCallback(async (task: db.PatientHealthTask) => {
    setPatientHealthTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } : t));
    try { await db.updatePatientHealthTask(task); }
    catch (error) { await refreshHealthTaskData(); throw error; }
  }, [refreshHealthTaskData]);
  const deletePatientHealthTask = useCallback(async (id: string) => {
    setPatientHealthTasks(prev => prev.filter(t => t.id !== id));
    try { await db.deletePatientHealthTask(id); }
    catch (error) { await refreshHealthTaskData(); throw error; }
  }, [refreshHealthTaskData]);

  // ===== 入院記錄函數 =====
  const refreshAdmissionData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setAdmissionLoading(true);
    try {
      const [admissionRecordsData, hospitalEpisodesData] = await Promise.all([db.getPatientAdmissionRecords(), db.getHospitalEpisodes()]);
      setPatientAdmissionRecords(admissionRecordsData || []);
      setHospitalEpisodes(hospitalEpisodesData);
    } catch (error) { console.error('刷新入院數據失敗:', error); }
    finally { setAdmissionLoading(false); }
  }, [isAuthenticated]);

  const addPatientAdmissionRecord = useCallback(async (record: Omit<db.PatientAdmissionRecord, 'id' | 'created_at' | 'updated_at'>) => { await db.createPatientAdmissionRecord(record); await refreshAdmissionData(); }, [refreshAdmissionData]);
  const updatePatientAdmissionRecord = useCallback(async (record: db.PatientAdmissionRecord) => { await db.updatePatientAdmissionRecord(record); await refreshAdmissionData(); }, [refreshAdmissionData]);
  const deletePatientAdmissionRecord = useCallback(async (id: string) => { await db.deletePatientAdmissionRecord(id); await refreshAdmissionData(); }, [refreshAdmissionData]);
  const addHospitalEpisode = useCallback(async (episodeData: any) => { await db.createHospitalEpisode(episodeData); await refreshAdmissionData(); }, [refreshAdmissionData]);
  const updateHospitalEpisode = useCallback(async (episodeData: any) => { await db.updateHospitalEpisode(episodeData); await refreshAdmissionData(); }, [refreshAdmissionData]);
  const deleteHospitalEpisode = useCallback(async (id: string) => { await db.deleteHospitalEpisode(id); await refreshAdmissionData(); }, [refreshAdmissionData]);
  const recordPatientAdmissionEvent = useCallback(async (eventData: any) => { await db.recordPatientAdmissionEvent(eventData); await refreshAdmissionData(); }, [refreshAdmissionData]);

  // ===== 服務原因函數 =====
  const refreshServiceReasonData = useCallback(async () => {
    if (!isAuthenticated()) return;
    try { const data = await db.getReasons(); setServiceReasons(data); }
    catch (error) { console.error('Error refreshing service reasons:', error); setServiceReasons([]); }
  }, [isAuthenticated]);

  // ===== 每日系統任務函數 =====
  const refreshDailySystemTaskData = useCallback(async () => {
    if (!isAuthenticated()) return;
    try { const tasks = await db.getOverdueDailySystemTasks(); setDailySystemTasks(tasks); }
    catch (error) { console.error('Error refreshing daily system tasks:', error); setDailySystemTasks([]); }
  }, [isAuthenticated]);

  const getOverdueDailySystemTasks = useCallback(async () => {
    try { const tasks = await db.getOverdueDailySystemTasks(); setDailySystemTasks(tasks); return tasks; }
    catch (error) { console.error('Error getting overdue daily system tasks:', error); return []; }
  }, []);

  // ===== 統一刷新所有記錄數據 =====
  const refreshAllRecordsData = useCallback(async () => {
    if (!isAuthenticated()) return;
    await Promise.all([
      refreshCarePlanData(), refreshCareRecordsData(), refreshAssessmentData(),
      refreshIncidentData(), refreshMealData(), refreshPatientLogData(),
      refreshHealthTaskData(), refreshAdmissionData(), refreshServiceReasonData(), refreshDailySystemTaskData()
    ]);
  }, [isAuthenticated, refreshCarePlanData, refreshCareRecordsData, refreshAssessmentData,
      refreshIncidentData, refreshMealData, refreshPatientLogData, refreshHealthTaskData,
      refreshAdmissionData, refreshServiceReasonData, refreshDailySystemTaskData]);

  // ===== 初始載入 =====
  useEffect(() => {
    if (!isAuthenticated()) return;
    refreshAllRecordsData();
  }, [isAuthenticated, refreshAllRecordsData]);

  // ===== 統一 loading 狀態 =====
  const loading = carePlanLoading || careRecordsLoading || assessmentLoading || incidentLoading || mealLoading || patientLogLoading || healthTaskLoading || admissionLoading;

  // ===== Context 值 =====
  const value: RecordsContextType = {
    // 個人照顧計劃
    carePlans, problemLibrary, nursingNeedItems, carePlanLoading,
    addCarePlan, updateCarePlan, deleteCarePlan, duplicateCarePlan,
    getCarePlanWithDetails, getCarePlanHistory, addProblemToLibrary,
    updateProblemLibrary, deleteProblemLibrary, addNursingNeedItem, refreshCarePlanData,
    
    // 護理記錄
    patientNotes, patrolRounds, diaperChangeRecords, restraintObservationRecords, positionChangeRecords, careRecordsLoading,
    addPatientNote, updatePatientNote, deletePatientNote, completePatientNote,
    createPatrolRound, deletePatrolRound, createDiaperChangeRecord, updateDiaperChangeRecord, deleteDiaperChangeRecord,
    createRestraintObservationRecord, updateRestraintObservationRecord, deleteRestraintObservationRecord,
    createPositionChangeRecord, deletePositionChangeRecord, refreshCareRecordsData,
    
    // 評估
    healthAssessments, patientRestraintAssessments, annualHealthCheckups, assessmentLoading,
    addHealthAssessment, updateHealthAssessment, deleteHealthAssessment,
    addPatientRestraintAssessment, updatePatientRestraintAssessment, deletePatientRestraintAssessment,
    addAnnualHealthCheckup, updateAnnualHealthCheckup, deleteAnnualHealthCheckup, refreshAssessmentData,
    
    // 事故報告
    incidentReports, incidentLoading, addIncidentReport, updateIncidentReport, deleteIncidentReport, refreshIncidentData,
    
    // 餐飲指導
    mealGuidances, mealLoading, addMealGuidance, updateMealGuidance, deleteMealGuidance, refreshMealData,
    
    // 院友日誌
    patientLogs, patientLogLoading, addPatientLog, updatePatientLog, deletePatientLog, refreshPatientLogData,
    
    // 健康任務
    patientHealthTasks, healthTaskLoading, addPatientHealthTask, updatePatientHealthTask, deletePatientHealthTask, setPatientHealthTasks, refreshHealthTaskData,
    
    // 入院記錄
    patientAdmissionRecords, hospitalEpisodes, admissionLoading,
    addPatientAdmissionRecord, updatePatientAdmissionRecord, deletePatientAdmissionRecord,
    addHospitalEpisode, updateHospitalEpisode, deleteHospitalEpisode, recordPatientAdmissionEvent, refreshAdmissionData,
    
    // 服務原因
    serviceReasons, refreshServiceReasonData,
    
    // 每日系統任務
    dailySystemTasks, getOverdueDailySystemTasks, refreshDailySystemTaskData,
    
    // 統一
    loading, refreshAllRecordsData,
  };

  return (
    <RecordsContext.Provider value={value}>
      {children}
    </RecordsContext.Provider>
  );
}

// ========== Hooks ==========
export function useRecords(): RecordsContextType {
  const context = useContext(RecordsContext);
  if (context === undefined) {
    throw new Error('useRecords must be used within a RecordsProvider');
  }
  return context;
}

// ========== 向後兼容的獨立 Hooks ==========
export function useCarePlan() {
  const ctx = useRecords();
  return {
    carePlans: ctx.carePlans, problemLibrary: ctx.problemLibrary, nursingNeedItems: ctx.nursingNeedItems, loading: ctx.carePlanLoading,
    addCarePlan: ctx.addCarePlan, updateCarePlan: ctx.updateCarePlan, deleteCarePlan: ctx.deleteCarePlan, duplicateCarePlan: ctx.duplicateCarePlan,
    getCarePlanWithDetails: ctx.getCarePlanWithDetails, getCarePlanHistory: ctx.getCarePlanHistory, addProblemToLibrary: ctx.addProblemToLibrary,
    updateProblemLibrary: ctx.updateProblemLibrary, deleteProblemLibrary: ctx.deleteProblemLibrary, addNursingNeedItem: ctx.addNursingNeedItem, refreshCarePlanData: ctx.refreshCarePlanData,
  };
}
export function useCarePlanData() { const { carePlans, problemLibrary, nursingNeedItems, carePlanLoading } = useRecords(); return { carePlans, problemLibrary, nursingNeedItems, loading: carePlanLoading }; }

export function useCareRecords() {
  const ctx = useRecords();
  return {
    patientNotes: ctx.patientNotes, patrolRounds: ctx.patrolRounds, diaperChangeRecords: ctx.diaperChangeRecords,
    restraintObservationRecords: ctx.restraintObservationRecords, positionChangeRecords: ctx.positionChangeRecords, loading: ctx.careRecordsLoading,
    addPatientNote: ctx.addPatientNote, updatePatientNote: ctx.updatePatientNote, deletePatientNote: ctx.deletePatientNote, completePatientNote: ctx.completePatientNote,
    createPatrolRound: ctx.createPatrolRound, deletePatrolRound: ctx.deletePatrolRound, createDiaperChangeRecord: ctx.createDiaperChangeRecord,
    updateDiaperChangeRecord: ctx.updateDiaperChangeRecord, deleteDiaperChangeRecord: ctx.deleteDiaperChangeRecord,
    createRestraintObservationRecord: ctx.createRestraintObservationRecord, updateRestraintObservationRecord: ctx.updateRestraintObservationRecord,
    deleteRestraintObservationRecord: ctx.deleteRestraintObservationRecord, createPositionChangeRecord: ctx.createPositionChangeRecord,
    deletePositionChangeRecord: ctx.deletePositionChangeRecord, refreshCareRecordsData: ctx.refreshCareRecordsData,
  };
}

export function useAssessment() {
  const ctx = useRecords();
  return {
    healthAssessments: ctx.healthAssessments, patientRestraintAssessments: ctx.patientRestraintAssessments, annualHealthCheckups: ctx.annualHealthCheckups,
    addHealthAssessment: ctx.addHealthAssessment, updateHealthAssessment: ctx.updateHealthAssessment, deleteHealthAssessment: ctx.deleteHealthAssessment,
    addPatientRestraintAssessment: ctx.addPatientRestraintAssessment, updatePatientRestraintAssessment: ctx.updatePatientRestraintAssessment,
    deletePatientRestraintAssessment: ctx.deletePatientRestraintAssessment, addAnnualHealthCheckup: ctx.addAnnualHealthCheckup,
    updateAnnualHealthCheckup: ctx.updateAnnualHealthCheckup, deleteAnnualHealthCheckup: ctx.deleteAnnualHealthCheckup, refreshAssessmentData: ctx.refreshAssessmentData,
  };
}

export function useIncident() {
  const ctx = useRecords();
  return { incidentReports: ctx.incidentReports, addIncidentReport: ctx.addIncidentReport, updateIncidentReport: ctx.updateIncidentReport, deleteIncidentReport: ctx.deleteIncidentReport, refreshIncidentData: ctx.refreshIncidentData };
}
export function useIncidentData() { const { incidentReports } = useRecords(); return { incidentReports }; }

export function useMeal() {
  const ctx = useRecords();
  return { mealGuidances: ctx.mealGuidances, addMealGuidance: ctx.addMealGuidance, updateMealGuidance: ctx.updateMealGuidance, deleteMealGuidance: ctx.deleteMealGuidance, refreshMealData: ctx.refreshMealData };
}
export function useMealData() { const { mealGuidances } = useRecords(); return { mealGuidances }; }

export function usePatientLog() {
  const ctx = useRecords();
  return { patientLogs: ctx.patientLogs, addPatientLog: ctx.addPatientLog, updatePatientLog: ctx.updatePatientLog, deletePatientLog: ctx.deletePatientLog, refreshPatientLogData: ctx.refreshPatientLogData };
}
export function usePatientLogData() { const { patientLogs } = useRecords(); return { patientLogs }; }

export function useHealthTask() {
  const ctx = useRecords();
  return { patientHealthTasks: ctx.patientHealthTasks, addPatientHealthTask: ctx.addPatientHealthTask, updatePatientHealthTask: ctx.updatePatientHealthTask, deletePatientHealthTask: ctx.deletePatientHealthTask, setPatientHealthTasks: ctx.setPatientHealthTasks, refreshHealthTaskData: ctx.refreshHealthTaskData };
}
export function useHealthTaskData() { const { patientHealthTasks } = useRecords(); return { patientHealthTasks }; }

export function useAdmission() {
  const ctx = useRecords();
  return {
    patientAdmissionRecords: ctx.patientAdmissionRecords, hospitalEpisodes: ctx.hospitalEpisodes,
    addPatientAdmissionRecord: ctx.addPatientAdmissionRecord, updatePatientAdmissionRecord: ctx.updatePatientAdmissionRecord,
    deletePatientAdmissionRecord: ctx.deletePatientAdmissionRecord, addHospitalEpisode: ctx.addHospitalEpisode,
    updateHospitalEpisode: ctx.updateHospitalEpisode, deleteHospitalEpisode: ctx.deleteHospitalEpisode,
    recordPatientAdmissionEvent: ctx.recordPatientAdmissionEvent, refreshAdmissionData: ctx.refreshAdmissionData,
  };
}
export function useAdmissionData() { const { patientAdmissionRecords, hospitalEpisodes } = useRecords(); return { patientAdmissionRecords, hospitalEpisodes }; }

export function useServiceReason() { const ctx = useRecords(); return { serviceReasons: ctx.serviceReasons, refreshServiceReasonData: ctx.refreshServiceReasonData }; }
export function useServiceReasonData() { const { serviceReasons } = useRecords(); return { serviceReasons }; }

export function useDailySystemTask() { const ctx = useRecords(); return { dailySystemTasks: ctx.dailySystemTasks, getOverdueDailySystemTasks: ctx.getOverdueDailySystemTasks, refreshDailySystemTaskData: ctx.refreshDailySystemTaskData }; }
export function useDailySystemTaskData() { const { dailySystemTasks } = useRecords(); return { dailySystemTasks }; }

export default RecordsContext;
