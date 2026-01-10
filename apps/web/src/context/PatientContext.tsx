import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ReactNode } from 'react';
import * as db from '../lib/database';
import { supabase } from '../lib/supabase';
import { generateDailyWorkflowRecords } from '../utils/workflowGenerator';
import { useAuth } from './AuthContext';
import { useStation } from './facility';
// 使用合併的 Context（減少 Provider 嵌套層級，提升性能）
import { 
  useMedical, useFollowUp, useDiagnosis, useHospitalOutreach, useWound, useHealthRecord,
  type WoundPhoto, type HospitalOutreachRecord
} from './merged/MedicalContext';
import { 
  useWorkflow, useSchedule, usePrescription,
  type ScheduleWithDetails, type PrescriptionWorkflowRecord, type InspectionCheckResult, type PrescriptionTimeSlotDefinition
} from './merged/WorkflowContext';
import {
  useRecords, useCarePlan, useCareRecords, useAssessment, useIncident, useMeal, usePatientLog,
  useHealthTask, useAdmission, useServiceReason, useDailySystemTask
} from './merged/RecordsContext';
// Re-export types from database module
export type { Patient, HealthRecord, PatientHealthTask, HealthTaskType, FrequencyUnit, MonitoringTaskNotes, FollowUpAppointment, MealGuidance, MealCombinationType, SpecialDietType, PatientLog, PatientRestraintAssessment, WoundAssessment, Wound, WoundWithAssessments, PatientWithWounds, WoundType, WoundOrigin, WoundStatus, WoundAssessmentStatus, ResponsibleUnit, PatientAdmissionRecord, AdmissionEventType, DailySystemTask, DeletedHealthRecord, DuplicateRecordGroup, IncidentReport, DiagnosisRecord, VaccinationRecord, PatientNote, CarePlan, CarePlanProblem, CarePlanNursingNeed, CarePlanWithDetails, ProblemLibrary, NursingNeedItem, PlanType, ProblemCategory, OutcomeReview, CaseConferenceProfessional, MedicationPrescription } from '../lib/database';
// Re-export Station types for backward compatibility
export type { Station, Bed } from './facility';
// Re-export Schedule types for backward compatibility (from merged context)
export type { ScheduleWithDetails } from './merged/WorkflowContext';
// Re-export Prescription types for backward compatibility (from merged context)
export type { PrescriptionWorkflowRecord, InspectionCheckResult, PrescriptionTimeSlotDefinition } from './merged/WorkflowContext';
// Re-export Wound types for backward compatibility (from merged context)
export type { WoundPhoto, HospitalOutreachRecord } from './merged/MedicalContext';

interface PatientContextType {
  patients: db.Patient[];
  stations: db.Station[];
  beds: db.Bed[];
  schedules: ScheduleWithDetails[];
  prescriptions: db.MedicationPrescription[];
  drugDatabase: any[];
  serviceReasons: db.ServiceReason[];
  healthRecords: db.HealthRecord[];
  followUpAppointments: db.FollowUpAppointment[];
  mealGuidances: db.MealGuidance[];
  patientLogs: db.PatientLog[];
  patientHealthTasks: db.PatientHealthTask[];
  patientRestraintAssessments: db.PatientRestraintAssessment[];
  healthAssessments: db.HealthAssessment[];
  woundAssessments: db.WoundAssessment[];
  wounds: db.Wound[];
  patientsWithWounds: db.PatientWithWounds[];
  patientAdmissionRecords: db.PatientAdmissionRecord[];
  hospitalEpisodes: any[];
  annualHealthCheckups: any[];
  incidentReports: db.IncidentReport[];
  diagnosisRecords: db.DiagnosisRecord[];
  vaccinationRecords: db.VaccinationRecord[];
  patientNotes: db.PatientNote[];
  patrolRounds: db.PatrolRound[];
  diaperChangeRecords: db.DiaperChangeRecord[];
  restraintObservationRecords: db.RestraintObservationRecord[];
  positionChangeRecords: db.PositionChangeRecord[];
  admissionRecords: db.PatientAdmissionRecord[];
  loading: boolean;
  // 個人照顧計劃 (ICP) 相關屬性
  carePlans: db.CarePlan[];
  problemLibrary: db.ProblemLibrary[];
  nursingNeedItems: db.NursingNeedItem[];
  // 新增的處方工作流程相關屬性
  prescriptionWorkflowRecords: PrescriptionWorkflowRecord[];
  prescriptionTimeSlotDefinitions: PrescriptionTimeSlotDefinition[];
  checkEligiblePatientsForTemperature: (targetDate?: string) => {
    eligiblePatients: db.Patient[];
    excludedPatients: { patient: db.Patient; reason: string }[];
    targetDate: string;
  };
  // Hospital Outreach Records
  hospitalOutreachRecords: any[];
  hospitalOutreachRecordHistory: any[];
  doctorVisitSchedule: any[];
  fetchHospitalOutreachRecords: () => Promise<void>;
  fetchHospitalOutreachRecordHistory: (patientId: number) => Promise<any[]>;
  addHospitalOutreachRecord: (recordData: any) => Promise<void>;
  updateHospitalOutreachRecord: (recordData: any) => Promise<void>;
  deleteHospitalOutreachRecord: (recordId: string) => Promise<void>;
  addDoctorVisitSchedule: (scheduleData: any) => Promise<void>;
  updateDoctorVisitSchedule: (scheduleData: any) => Promise<void>;
  deleteDoctorVisitSchedule: (scheduleId: string) => Promise<void>;
  fetchDoctorVisitSchedule: () => Promise<void>;
  dailySystemTasks: db.DailySystemTask[];
  addDrug: (drug: Omit<any, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDrug: (drug: any) => Promise<void>;
  deleteDrug: (id: string) => Promise<void>;
  addPatient: (patient: Omit<db.Patient, '院友id'>) => Promise<void>;
  updatePatient: (patient: db.Patient) => Promise<void>;
  deletePatient: (id: number) => Promise<void>;
  addStation: (station: Omit<db.Station, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateStation: (station: db.Station) => Promise<void>;
  deleteStation: (id: string) => Promise<void>;
  addBed: (bed: Omit<db.Bed, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateBed: (bed: db.Bed) => Promise<void>;
  deleteBed: (id: string) => Promise<void>;
  assignPatientToBed: (patientId: number, bedId: string) => Promise<void>;
  swapPatientBeds: (patientId1: number, patientId2: number) => Promise<void>;
  moveBedToStation: (bedId: string, newStationId: string) => Promise<void>;
  addSchedule: (schedule: Omit<db.Schedule, '排程id'>) => Promise<void>;
  updateSchedule: (schedule: ScheduleWithDetails) => Promise<void>;
  deleteSchedule: (id: number) => Promise<void>;
  addPatientToSchedule: (scheduleId: number, patientId: number, symptoms: string, notes: string, reasons: string[]) => Promise<void>;
  updateScheduleDetail: (detail: any) => Promise<void>;
  deleteScheduleDetail: (detailId: number) => Promise<void>;
  addPrescription: (prescription: any) => Promise<void>;
  updatePrescription: (prescription: db.Prescription) => Promise<void>;
  deletePrescription: (id: number) => Promise<void>;
  addHealthRecord: (record: Omit<db.HealthRecord, '記錄id'>) => Promise<db.HealthRecord>;
  updateHealthRecord: (record: db.HealthRecord) => Promise<void>;
  deleteHealthRecord: (id: number) => Promise<void>;
  addFollowUpAppointment: (appointment: Omit<db.FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>) => Promise<void>;
  updateFollowUpAppointment: (appointment: db.FollowUpAppointment, optimistic?: boolean) => Promise<void>;
  batchUpdateFollowUpStatus: (ids: string[], status: string) => Promise<void>;
  deleteFollowUpAppointment: (id: string) => Promise<void>;
  addMealGuidance: (guidance: Omit<db.MealGuidance, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMealGuidance: (guidance: db.MealGuidance) => Promise<void>;
  deleteMealGuidance: (id: string) => Promise<void>;
  addPatientLog: (log: Omit<db.PatientLog, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientLog: (log: db.PatientLog) => Promise<void>;
  deletePatientLog: (id: string) => Promise<void>;
  addPatientHealthTask: (task: Omit<db.PatientHealthTask, 'id' | 'created_at' | 'updated_at'>) => Promise<db.PatientHealthTask>;
  updatePatientHealthTask: (task: db.PatientHealthTask) => Promise<void>;
  deletePatientHealthTask: (id: string) => Promise<void>;
  setPatientHealthTasks: React.Dispatch<React.SetStateAction<db.PatientHealthTask[]>>;
  addPatientRestraintAssessment: (assessment: Omit<db.PatientRestraintAssessment, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientRestraintAssessment: (assessment: db.PatientRestraintAssessment) => Promise<void>;
  deletePatientRestraintAssessment: (id: string) => Promise<void>;
  addHealthAssessment: (assessment: Omit<db.HealthAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => Promise<void>;
  updateHealthAssessment: (assessment: db.HealthAssessment) => Promise<void>;
  deleteHealthAssessment: (id: string) => Promise<void>;
  // 傷口管理函數（新結構）
  addWound: (wound: Omit<db.Wound, 'id' | 'created_at' | 'updated_at'>) => Promise<db.Wound | null>;
  updateWound: (wound: Partial<db.Wound> & { id: string }) => Promise<db.Wound | null>;
  deleteWound: (id: string) => Promise<void>;
  healWound: (woundId: string, healedDate?: string) => Promise<db.Wound | null>;
  getWoundWithAssessments: (woundId: string) => Promise<db.WoundWithAssessments | null>;
  getWoundsNeedingAssessment: () => Promise<db.Wound[]>;
  generateWoundCode: (patientId: number) => Promise<string>;
  addWoundAssessmentForWound: (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => Promise<void>;
  // 傷口評估函數（兼容舊結構）
  addWoundAssessment: (assessment: Omit<db.WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => Promise<void>;
  updateWoundAssessment: (assessment: db.WoundAssessment) => Promise<void>;
  deleteWoundAssessment: (id: string) => Promise<void>;
  refreshWoundData: () => Promise<void>;
  addAnnualHealthCheckup: (checkup: any) => Promise<void>;
  updateAnnualHealthCheckup: (checkup: any) => Promise<void>;
  deleteAnnualHealthCheckup: (id: string) => Promise<void>;
  addIncidentReport: (report: Omit<db.IncidentReport, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateIncidentReport: (report: db.IncidentReport) => Promise<void>;
  deleteIncidentReport: (id: string) => Promise<void>;
  addDiagnosisRecord: (record: Omit<db.DiagnosisRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDiagnosisRecord: (record: db.DiagnosisRecord) => Promise<void>;
  deleteDiagnosisRecord: (id: string) => Promise<void>;
  addVaccinationRecord: (record: Omit<db.VaccinationRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateVaccinationRecord: (record: db.VaccinationRecord) => Promise<void>;
  deleteVaccinationRecord: (id: string) => Promise<void>;
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
  addPatientAdmissionRecord: (record: Omit<db.PatientAdmissionRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientAdmissionRecord: (record: db.PatientAdmissionRecord) => Promise<void>;
  deletePatientAdmissionRecord: (id: string) => Promise<void>;
  addHospitalEpisode: (episodeData: any) => Promise<void>;
  updateHospitalEpisode: (episodeData: any) => Promise<void>;
  deleteHospitalEpisode: (id: string) => Promise<void>;
  getOverdueDailySystemTasks: () => Promise<db.DailySystemTask[]>;
  recordPatientAdmissionEvent: (eventData: {
    patient_id: number;
    event_type: db.AdmissionEventType;
    event_date: string;
    hospital_name?: string;
    hospital_ward?: string;
    hospital_bed_number?: string;
    remarks?: string;
  }) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshHealthData: () => Promise<void>;
  // 新增的處方工作流程相關函數
  fetchPrescriptionWorkflowRecords: (patientId?: number, date?: string) => Promise<PrescriptionWorkflowRecord[]>;
  createPrescriptionWorkflowRecord: (recordData: Omit<PrescriptionWorkflowRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePrescriptionWorkflowRecord: (recordId: string, updateData: Partial<PrescriptionWorkflowRecord>) => Promise<void>;
  prepareMedication: (recordId: string, staffId: string) => Promise<void>;
  verifyMedication: (recordId: string, staffId: string) => Promise<void>;
  dispenseMedication: (recordId: string, staffId: string, failureReason?: string, customReason?: string, patientId?: number, scheduledDate?: string, notes?: string, inspectionCheckResult?: any) => Promise<void>;
  checkPrescriptionInspectionRules: (prescriptionId: string, patientId: number, scheduledDate?: string, scheduledTime?: string) => Promise<InspectionCheckResult>;
  fetchLatestVitalSigns: (patientId: number, vitalSignType: string, targetDate?: string, targetTime?: string) => Promise<{ record: db.HealthRecord | null; isExactMatch: boolean }>;
  batchSetDispenseFailure: (patientId: number, scheduledDate: string, scheduledTime: string, reason: string) => Promise<void>;
  // 撤銷工作流程步驟
  revertPrescriptionWorkflowStep: (recordId: string, step: 'preparation' | 'verification' | 'dispensing', patientId?: number, scheduledDate?: string) => Promise<void>;
  // 處方時段定義相關函數
  fetchPrescriptionTimeSlotDefinitions: () => Promise<PrescriptionTimeSlotDefinition[]>;
  addPrescriptionTimeSlotDefinition: (definition: Omit<PrescriptionTimeSlotDefinition, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePrescriptionTimeSlotDefinition: (definition: PrescriptionTimeSlotDefinition) => Promise<void>;
  deletePrescriptionTimeSlotDefinition: (id: string) => Promise<void>;
  // 健康记录回收筒相关函数
  deletedHealthRecords: db.DeletedHealthRecord[];
  fetchDeletedHealthRecords: () => Promise<void>;
  restoreHealthRecord: (deletedRecordId: string) => Promise<void>;
  permanentlyDeleteHealthRecord: (deletedRecordId: string) => Promise<void>;
  // 健康记录去重相关函数
  findDuplicateHealthRecords: () => Promise<db.DuplicateRecordGroup[]>;
  batchDeleteDuplicateRecords: (duplicateRecordIds: number[], deletedBy?: string) => Promise<void>;
  // [新增] 載入所有歷史記錄
  loadFullHealthRecords: () => Promise<void>;
  // 個人照顧計劃 (ICP) 相關函數
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
  duplicateCarePlan: (sourcePlanId: string, newPlanType: db.PlanType, newPlanDate: string, createdBy: string) => Promise<db.CarePlan>;
  getCarePlanWithDetails: (planId: string) => Promise<db.CarePlanWithDetails | null>;
  getCarePlanHistory: (planId: string) => Promise<db.CarePlan[]>;
  addProblemToLibrary: (problem: Omit<db.ProblemLibrary, 'id' | 'created_at' | 'updated_at'>) => Promise<db.ProblemLibrary>;
  updateProblemLibrary: (problem: Partial<db.ProblemLibrary> & { id: string }) => Promise<db.ProblemLibrary>;
  deleteProblemLibrary: (id: string) => Promise<void>;
  addNursingNeedItem: (item: Omit<db.NursingNeedItem, 'id' | 'created_at' | 'updated_at'>) => Promise<db.NursingNeedItem>;
  refreshCarePlanData: () => Promise<void>;
}
interface PatientProviderProps {
  children: ReactNode;
}
const PatientContext = createContext<PatientContextType | undefined>(undefined);
export const PatientProvider: React.FC<PatientProviderProps> = ({ children }) => {
  const { user, userProfile, authReady, displayName, isAuthenticated } = useAuth();
  
  // 從 StationContext 獲取站點和床位數據（委託模式，向後兼容）
  const {
    stations,
    beds,
    addStation,
    updateStation,
    deleteStation,
    addBed,
    updateBed,
    deleteBed,
    assignPatientToBed,
    swapPatientBeds,
    moveBedToStation,
    refreshStationData,
  } = useStation();
  
  // 從 FollowUpContext 獲取覆診數據（委託模式，向後兼容）
  const {
    followUpAppointments,
    addFollowUpAppointment,
    updateFollowUpAppointment,
    deleteFollowUpAppointment,
    batchUpdateFollowUpStatus,
    refreshFollowUpData,
  } = useFollowUp();
  
  // 從 DiagnosisContext 獲取診斷和疫苗數據（委託模式，向後兼容）
  const {
    diagnosisRecords,
    vaccinationRecords,
    addDiagnosisRecord,
    updateDiagnosisRecord,
    deleteDiagnosisRecord,
    addVaccinationRecord,
    updateVaccinationRecord,
    deleteVaccinationRecord,
    refreshDiagnosisData,
  } = useDiagnosis();
  
  // 從 CareRecordsContext 獲取護理記錄數據（委託模式，向後兼容）
  const {
    patientNotes,
    patrolRounds,
    diaperChangeRecords,
    restraintObservationRecords,
    positionChangeRecords,
    addPatientNote,
    updatePatientNote,
    deletePatientNote,
    completePatientNote,
    createPatrolRound,
    deletePatrolRound,
    createDiaperChangeRecord,
    updateDiaperChangeRecord,
    deleteDiaperChangeRecord,
    createRestraintObservationRecord,
    updateRestraintObservationRecord,
    deleteRestraintObservationRecord,
    createPositionChangeRecord,
    deletePositionChangeRecord,
    refreshCareRecordsData,
  } = useCareRecords();
  
  // 從 ScheduleContext 獲取排程數據（委託模式，向後兼容）
  const {
    schedules,
    doctorVisitSchedule,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addPatientToSchedule,
    updateScheduleDetail,
    deleteScheduleDetail,
    fetchDoctorVisitSchedule,
    addDoctorVisitSchedule,
    updateDoctorVisitSchedule,
    deleteDoctorVisitSchedule,
    refreshScheduleData,
  } = useSchedule();
  
  // 從 CarePlanContext 獲取個人照顧計劃數據（委託模式，向後兼容）
  const {
    carePlans,
    problemLibrary,
    nursingNeedItems,
    addCarePlan,
    updateCarePlan: updateCarePlanFn,
    deleteCarePlan: deleteCarePlanFn,
    duplicateCarePlan: duplicateCarePlanFn,
    getCarePlanWithDetails,
    getCarePlanHistory,
    addProblemToLibrary,
    updateProblemLibrary: updateProblemLibraryFn,
    deleteProblemLibrary: deleteProblemLibraryFn,
    addNursingNeedItem,
    refreshCarePlanData,
  } = useCarePlan();
  
  // 從 PrescriptionContext 獲取處方數據（委託模式，向後兼容）
  const {
    prescriptions,
    drugDatabase,
    prescriptionWorkflowRecords,
    prescriptionTimeSlotDefinitions,
    addPrescription,
    updatePrescription,
    deletePrescription,
    addDrug,
    updateDrug,
    deleteDrug,
    fetchPrescriptionWorkflowRecords,
    createPrescriptionWorkflowRecord,
    updatePrescriptionWorkflowRecord,
    prepareMedication,
    verifyMedication,
    dispenseMedication,
    revertPrescriptionWorkflowStep,
    checkPrescriptionInspectionRules,
    fetchLatestVitalSigns,
    batchSetDispenseFailure,
    fetchPrescriptionTimeSlotDefinitions,
    addPrescriptionTimeSlotDefinition,
    updatePrescriptionTimeSlotDefinition,
    deletePrescriptionTimeSlotDefinition,
    refreshPrescriptionData,
  } = usePrescription();
  
  // 從 WoundContext 獲取傷口數據（委託模式，向後兼容）
  const {
    wounds,
    woundAssessments,
    patientsWithWounds,
    addWound,
    updateWound,
    deleteWound,
    healWound,
    getWoundWithAssessments,
    getWoundsNeedingAssessment,
    generateWoundCode,
    addWoundAssessmentForWound,
    addWoundAssessment,
    updateWoundAssessment,
    deleteWoundAssessment,
    refreshWoundData,
  } = useWound();
  
  // 從 HealthRecordContext 獲取健康記錄數據（委託模式，向後兼容）
  const {
    healthRecords,
    deletedHealthRecords,
    isAllHealthRecordsLoaded,
    addHealthRecord,
    updateHealthRecord,
    deleteHealthRecord,
    fetchDeletedHealthRecords,
    restoreHealthRecord,
    permanentlyDeleteHealthRecord,
    findDuplicateHealthRecords,
    batchDeleteDuplicateRecords,
    loadFullHealthRecords,
    refreshHealthRecordData,
  } = useHealthRecord();
  
  // 向後兼容：別名 refreshHealthData 到 refreshHealthRecordData
  const refreshHealthData = refreshHealthRecordData;
  
  // 從 AssessmentContext 獲取評估數據（委託模式，向後兼容）
  const {
    healthAssessments,
    patientRestraintAssessments,
    annualHealthCheckups,
    addHealthAssessment,
    updateHealthAssessment,
    deleteHealthAssessment,
    addPatientRestraintAssessment,
    updatePatientRestraintAssessment,
    deletePatientRestraintAssessment,
    addAnnualHealthCheckup,
    updateAnnualHealthCheckup,
    deleteAnnualHealthCheckup,
    refreshAssessmentData,
  } = useAssessment();
  
  // 從 IncidentContext 獲取事故報告數據（委託模式，向後兼容）
  const {
    incidentReports,
    addIncidentReport,
    updateIncidentReport,
    deleteIncidentReport,
    refreshIncidentData,
  } = useIncident();
  
  // 從 MealContext 獲取餐飲指導數據（委託模式，向後兼容）
  const {
    mealGuidances,
    addMealGuidance,
    updateMealGuidance,
    deleteMealGuidance,
    refreshMealData,
  } = useMeal();
  
  // 從 PatientLogContext 獲取院友日誌數據（委託模式，向後兼容）
  const {
    patientLogs,
    addPatientLog,
    updatePatientLog,
    deletePatientLog,
    refreshPatientLogData,
  } = usePatientLog();
  
  // 從 HealthTaskContext 獲取健康任務數據（委託模式，向後兼容）
  const {
    patientHealthTasks,
    addPatientHealthTask,
    updatePatientHealthTask,
    deletePatientHealthTask,
    setPatientHealthTasks,
    refreshHealthTaskData,
  } = useHealthTask();
  
  // 從 AdmissionContext 獲取入院記錄數據（委託模式，向後兼容）
  const {
    patientAdmissionRecords,
    hospitalEpisodes,
    addPatientAdmissionRecord,
    updatePatientAdmissionRecord,
    deletePatientAdmissionRecord,
    addHospitalEpisode,
    updateHospitalEpisode,
    deleteHospitalEpisode,
    recordPatientAdmissionEvent,
    refreshAdmissionData,
  } = useAdmission();
  
  // 從 ServiceReasonContext 獲取服務原因數據（委託模式，向後兼容）
  const {
    serviceReasons,
    refreshServiceReasonData,
  } = useServiceReason();
  
  // drugDatabase, addDrug, updateDrug, deleteDrug 現在從 PrescriptionContext 獲取（見上面的 usePrescription）
  
  // 從 DailySystemTaskContext 獲取每日系統任務（委託模式，向後兼容）
  const {
    dailySystemTasks,
    getOverdueDailySystemTasks,
    refreshDailySystemTaskData,
  } = useDailySystemTask();
  
  // 從 HospitalOutreachContext 獲取醫院外展數據（委託模式，向後兼容）
  const {
    hospitalOutreachRecords,
    hospitalOutreachRecordHistory,
    fetchHospitalOutreachRecords,
    fetchHospitalOutreachRecordHistory,
    addHospitalOutreachRecord: addHospitalOutreachRecordFn,
    updateHospitalOutreachRecord: updateHospitalOutreachRecordFn,
    deleteHospitalOutreachRecord,
    refreshHospitalOutreachData,
  } = useHospitalOutreach();
  
  // 1. 狀態 State 定義 (Loading 放在這裡)
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  // 防抖計時器
  const refreshDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const DEBOUNCE_DELAY = 500; // 500ms 防抖延遲
  // 資料狀態
  const [patients, setPatients] = useState<db.Patient[]>([]);
  // stations 和 beds 現在從 StationContext 獲取
  // schedules 和 doctorVisitSchedule 現在從 ScheduleContext 獲取
  // carePlans, problemLibrary, nursingNeedItems 現在從 CarePlanContext 獲取
  // serviceReasons 已遷移至 ServiceReasonContext
  // healthRecords, deletedHealthRecords, isAllHealthRecordsLoaded 已遷移至 HealthRecordContext
  // followUpAppointments 現在從 FollowUpContext 獲取
  // mealGuidances 已遷移至 MealContext
  // patientHealthTasks 已遷移至 HealthTaskContext
  // patientLogs 已遷移至 PatientLogContext
  // healthAssessments, patientRestraintAssessments, annualHealthCheckups 已遷移至 AssessmentContext
  // wounds, woundAssessments, patientsWithWounds 已遷移至 WoundContext
  // incidentReports 已遷移至 IncidentContext
  // diagnosisRecords 已遷移至 DiagnosisContext
  // vaccinationRecords 已遷移至 DiagnosisContext
  // patientNotes, patrolRounds, diaperChangeRecords, restraintObservationRecords, positionChangeRecords 已遷移至 CareRecordsContext
  // patientAdmissionRecords, hospitalEpisodes 已遷移至 AdmissionContext
  // prescriptions, drugDatabase, prescriptionWorkflowRecords, prescriptionTimeSlotDefinitions 已遷移至 PrescriptionContext
  // hospitalOutreachRecords, hospitalOutreachRecordHistory 已遷移至 HospitalOutreachContext
  // doctorVisitSchedule 已遷移至 ScheduleContext
  // dailySystemTasks 已遷移至 DailySystemTaskContext
  // carePlans, problemLibrary, nursingNeedItems 已遷移至 CarePlanContext
  // 2. 輔助函式定義
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };
  const getFixedMorningTime = () => {
    return '08:00';
  };
  const generateRandomTemperature = () => {
    return (Math.random() * 0.9 + 36.0).toFixed(1);
  };
  const checkEligiblePatientsForTemperature = (targetDate?: string) => {
    const today = targetDate || getHongKongDate();
    const eligiblePatients: db.Patient[] = [];
    const excludedPatients: { patient: db.Patient; reason: string }[] = [];
    patients.forEach(patient => {
      if (patient.在住狀態 !== '在住') {
        excludedPatients.push({ patient, reason: '不在住狀態' });
        return;
      }
      if (patient.is_hospitalized) {
        excludedPatients.push({ patient, reason: '住院中' });
        return;
      }
      const hasTemperatureRecord = healthRecords.some(record => 
        record.院友id === patient.院友id && 
        record.記錄日期 === today && 
        record.記錄類型 === '生命表徵' && 
        record.體溫 !== null
      );
      if (hasTemperatureRecord) {
        excludedPatients.push({ patient, reason: '已量度體溫' });
        return;
      }
      eligiblePatients.push(patient);
    });
    return {
      eligiblePatients,
      excludedPatients,
      targetDate: today
    };
  };
  // 醫院外展記錄函數 (fetchHospitalOutreachRecords, fetchHospitalOutreachRecordHistory, addHospitalOutreachRecord, updateHospitalOutreachRecord, deleteHospitalOutreachRecord) 已遷移至 HospitalOutreachContext
  // fetchDoctorVisitSchedule, addDoctorVisitSchedule, updateDoctorVisitSchedule, deleteDoctorVisitSchedule 已遷移至 ScheduleContext
  // 處方工作流程相關函數已遷移至 PrescriptionContext（見 PatientProvider 頂部的 usePrescription()）
  
  // 包裝器函數，用於保持向後兼容的 API
  const addHospitalOutreachRecord = async (recordData: any): Promise<void> => {
    const patient = patients.find(p => p.院友id === recordData.patient_id);
    const patientName = patient ? `${patient.中文姓氏}${patient.中文名字}` : undefined;
    await addHospitalOutreachRecordFn(recordData, patientName);
  };
  
  const updateHospitalOutreachRecord = async (recordData: any): Promise<void> => {
    await updateHospitalOutreachRecordFn(recordData);
  };
  
  // 3. 數據刷新邏輯
  const refreshData = useCallback(async () => {
    try {
      // PatientContext 現在只負責獲取 patients 數據
      // 其他數據由各自的子 Context 管理，避免重複獲取
      const patientsData = await db.getPatients();
      setPatients(patientsData);
      setLoading(false);
    } catch (error) {
      console.error('刷新數據失敗:', error);
      setLoading(false);
    }
  }, []);
  // loadFullHealthRecords 已遷移至 HealthRecordContext
  // 個人照顧計劃 (ICP) CRUD 函數已遷移至 CarePlanContext
  // 創建防抖版本的 refreshData
  const debouncedRefreshData = useCallback(() => {
    // 清除之前的計時器
    if (refreshDebounceTimerRef.current) {
      clearTimeout(refreshDebounceTimerRef.current);
    }
    // 檢查是否可以立即執行（距離上次執行超過防抖延遲）
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    if (timeSinceLastRefresh >= DEBOUNCE_DELAY) {
      // 立即執行
      lastRefreshTimeRef.current = now;
      return refreshData();
    } else {
      // 設置新的計時器
      return new Promise<void>((resolve) => {
        refreshDebounceTimerRef.current = setTimeout(() => {
          lastRefreshTimeRef.current = Date.now();
          refreshData().then(resolve);
        }, DEBOUNCE_DELAY - timeSinceLastRefresh);
      });
    }
  }, [refreshData, DEBOUNCE_DELAY]);
  useEffect(() => {
    if (!authReady) return;
    
    // 檢查是否已認證（支持 Supabase Auth 和自訂認證）
    const authenticated = isAuthenticated();
    
    if (!authenticated) {
      setPatients([]);
      // stations 和 beds 現在由 StationContext 管理，無需在此清空
      // schedules 現在由 ScheduleContext 管理，無需在此清空
      // serviceReasons 現在由 ServiceReasonContext 管理，無需在此清空
      // healthRecords 現在由 HealthRecordContext 管理，無需在此清空
      // followUpAppointments 現在由 FollowUpContext 管理，無需在此清空
      // mealGuidances 現在由 MealContext 管理，無需在此清空
      // patientHealthTasks 現在由 HealthTaskContext 管理，無需在此清空
      // patientLogs 現在由 PatientLogContext 管理，無需在此清空
      // healthAssessments, patientRestraintAssessments, annualHealthCheckups 現在由 AssessmentContext 管理，無需在此清空
      // woundAssessments 現在由 WoundContext 管理，無需在此清空
      // incidentReports 現在由 IncidentContext 管理，無需在此清空
      // patientAdmissionRecords, hospitalEpisodes 現在由 AdmissionContext 管理，無需在此清空
      // prescriptions, drugDatabase 現在由 PrescriptionContext 管理，無需在此清空
      // dailySystemTasks 現在由 DailySystemTaskContext 管理，無需在此清空
      // carePlans, problemLibrary, nursingNeedItems 由 CarePlanContext 管理
      setLoading(false);
      setDataLoaded(false);
      return;
    }
    if (dataLoaded) return;
    const initializeAndLoadData = async () => {
      try {
        // 先加載數據，不等待 generateDailyWorkflowRecords
        await refreshDataRef.current();
        setDataLoaded(true);
        
        // 在背景執行工作流程生成（不阻塞 UI）
        generateDailyWorkflowRecords(new Date().toISOString().split('T')[0])
          .catch(err => console.warn('Background workflow generation failed:', err));
      } catch (error) {
        console.error('Error initializing data:', error);
        try {
          await refreshDataRef.current();
          setDataLoaded(true);
        } catch (refreshError) {
          console.error('Refresh data also failed:', refreshError);
        }
      } finally {
        setLoading(false);
      }
    };
    initializeAndLoadData();
  }, [authReady, user, userProfile, dataLoaded, isAuthenticated]);
  // 使用 useRef 來保存 refreshData 的最新版本，避免循環依賴
  const refreshDataRef = useRef(refreshData);
  refreshDataRef.current = refreshData;
  // refreshHealthData 已遷移至 HealthRecordContext
  // CRUD Functions defined here
  const addPatient = async (patient: Omit<db.Patient, '院友id'>) => {
    try {
      await db.createPatient(patient);
      await refreshData();
    } catch (error) {
      console.error('Error adding patient:', error);
      throw error;
    }
  };
  const updatePatient = async (patient: db.Patient) => {
    try {
      await db.updatePatient(patient);
      await refreshData();
    } catch (error) {
      console.error('Error updating patient:', error);
      throw error;
    }
  };
  const deletePatient = async (id: number) => {
    try {
      await db.deletePatient(id);
      await refreshData();
    } catch (error) {
      console.error('Error deleting patient:', error);
    }
  };
  // addPatientHealthTask, updatePatientHealthTask, deletePatientHealthTask 已遷移至 HealthTaskContext
  // addHealthRecord, updateHealthRecord, deleteHealthRecord 已遷移至 HealthRecordContext
  // VMO 排程相關函數 (addSchedule, updateSchedule, deleteSchedule, addPatientToSchedule, updateScheduleDetail, deleteScheduleDetail) 已遷移至 ScheduleContext
  // 處方 CRUD 函數 (addPrescription, updatePrescription, deletePrescription) 已遷移至 PrescriptionContext
  // FollowUp 相關函數現在從 FollowUpContext 獲取（見 PatientProvider 頂部的 useFollowUp()）
  // addMealGuidance, updateMealGuidance, deleteMealGuidance 已遷移至 MealContext
  // addPatientLog, updatePatientLog, deletePatientLog 已遷移至 PatientLogContext
  // addPatientRestraintAssessment, updatePatientRestraintAssessment, deletePatientRestraintAssessment, addHealthAssessment, updateHealthAssessment, deleteHealthAssessment, addAnnualHealthCheckup, updateAnnualHealthCheckup, deleteAnnualHealthCheckup 已遷移至 AssessmentContext
  // 傷口管理函數 (addWound, updateWound, deleteWound, healWound, getWoundWithAssessments, getWoundsNeedingAssessment, generateWoundCode, addWoundAssessmentForWound, addWoundAssessment, updateWoundAssessment, deleteWoundAssessment, refreshWoundData) 已遷移至 WoundContext
  
  // 診斷記錄和疫苗記錄 CRUD 函數已遷移至 DiagnosisContext
  // 護理記錄 CRUD 函數 (patientNotes, patrolRounds, diaperChangeRecords, 
  // restraintObservationRecords, positionChangeRecords) 已遷移至 CareRecordsContext
  // addPatientAdmissionRecord, updatePatientAdmissionRecord, deletePatientAdmissionRecord, 
  // addHospitalEpisode, updateHospitalEpisode, deleteHospitalEpisode, 
  // recordPatientAdmissionEvent 已遷移至 AdmissionContext
  // getOverdueDailySystemTasks 已遷移至 DailySystemTaskContext
  // recordPatientAdmissionEvent 已遷移至 AdmissionContext
  // 處方工作流程函數 (createPrescriptionWorkflowRecord, updatePrescriptionWorkflowRecord, prepareMedication, verifyMedication, dispenseMedication, checkPrescriptionInspectionRules, fetchLatestVitalSigns, batchSetDispenseFailure, revertPrescriptionWorkflowStep, loadPrescriptionTimeSlotDefinitions, fetchPrescriptionTimeSlotDefinitions, addPrescriptionTimeSlotDefinition, updatePrescriptionTimeSlotDefinition, deletePrescriptionTimeSlotDefinition) 已遷移至 PrescriptionContext
  
  // 健康記錄回收筒和去重函數 (findDuplicateHealthRecords, batchDeleteDuplicateRecords, fetchDeletedHealthRecords, restoreHealthRecord, permanentlyDeleteHealthRecord) 已遷移至 HealthRecordContext
  // addDrug, updateDrug, deleteDrug 已遷移至 DrugContext
  // Station 和 Bed 相關函數現在從 StationContext 獲取（見 PatientProvider 頂部的 useStation()）
  
  return (
    <PatientContext.Provider value={{
      patients,
      stations,
      beds,
      schedules,
      prescriptions,
      drugDatabase,
      serviceReasons,
      healthRecords,
      followUpAppointments,
      mealGuidances,
      patientLogs,
      patientHealthTasks,
      patientRestraintAssessments,
      healthAssessments,
      woundAssessments,
      patientAdmissionRecords,
      hospitalEpisodes,
      annualHealthCheckups,
      dailySystemTasks,
      loading,
      prescriptionWorkflowRecords,
      prescriptionTimeSlotDefinitions,
      checkEligiblePatientsForTemperature,
      addPatient,
      updatePatient,
      deletePatient,
      addStation,
      updateStation,
      deleteStation,
      addBed,
      updateBed,
      deleteBed,
      assignPatientToBed,
      swapPatientBeds,
      moveBedToStation,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      addPatientToSchedule,
      updateScheduleDetail,
      deleteScheduleDetail,
      addHealthRecord,
      updateHealthRecord,
      deleteHealthRecord,
      addFollowUpAppointment,
      updateFollowUpAppointment,
      batchUpdateFollowUpStatus,
      deleteFollowUpAppointment,
      addMealGuidance,
      updateMealGuidance,
      deleteMealGuidance,
      addPatientLog,
      updatePatientLog,
      deletePatientLog,
      addPatientHealthTask,
      updatePatientHealthTask,
      deletePatientHealthTask,
      setPatientHealthTasks,
      addPatientRestraintAssessment,
      updatePatientRestraintAssessment,
      deletePatientRestraintAssessment,
      addHealthAssessment,
      updateHealthAssessment,
      deleteHealthAssessment,
      // 傷口管理（新結構）
      wounds,
      patientsWithWounds,
      addWound,
      updateWound,
      deleteWound,
      healWound,
      getWoundWithAssessments,
      getWoundsNeedingAssessment,
      generateWoundCode,
      addWoundAssessmentForWound,
      refreshWoundData,
      // 傷口評估（兼容舊結構）
      addWoundAssessment,
      updateWoundAssessment,
      deleteWoundAssessment,
      addAnnualHealthCheckup,
      updateAnnualHealthCheckup,
      deleteAnnualHealthCheckup,
      incidentReports,
      addIncidentReport,
      updateIncidentReport,
      deleteIncidentReport,
      diagnosisRecords,
      addDiagnosisRecord,
      updateDiagnosisRecord,
      deleteDiagnosisRecord,
      vaccinationRecords,
      addVaccinationRecord,
      updateVaccinationRecord,
      deleteVaccinationRecord,
      patientNotes,
      addPatientNote,
      updatePatientNote,
      deletePatientNote,
      completePatientNote,
      patrolRounds,
      diaperChangeRecords,
      restraintObservationRecords,
      positionChangeRecords,
      admissionRecords: patientAdmissionRecords,
      createPatrolRound,
      deletePatrolRound,
      createDiaperChangeRecord,
      updateDiaperChangeRecord,
      deleteDiaperChangeRecord,
      createRestraintObservationRecord,
      updateRestraintObservationRecord,
      deleteRestraintObservationRecord,
      createPositionChangeRecord,
      deletePositionChangeRecord,
      addPatientAdmissionRecord,
      updatePatientAdmissionRecord,
      deletePatientAdmissionRecord,
      recordPatientAdmissionEvent,
      addHospitalEpisode,
      updateHospitalEpisode,
      deleteHospitalEpisode,
      addPrescription,
      updatePrescription,
      deletePrescription,
      addDrug,
      updateDrug,
      deleteDrug,
      getOverdueDailySystemTasks,
      refreshData,
      refreshHealthData,
      fetchPrescriptionWorkflowRecords,
      createPrescriptionWorkflowRecord,
      updatePrescriptionWorkflowRecord,
      prepareMedication,
      verifyMedication,
      dispenseMedication,
      checkPrescriptionInspectionRules,
      fetchLatestVitalSigns,
      batchSetDispenseFailure,
      revertPrescriptionWorkflowStep,
      // Hospital Outreach Records
      hospitalOutreachRecords,
      hospitalOutreachRecordHistory,
      doctorVisitSchedule,
      fetchHospitalOutreachRecords,
      fetchHospitalOutreachRecordHistory,
      addHospitalOutreachRecord,
      updateHospitalOutreachRecord,
      deleteHospitalOutreachRecord,
      addDoctorVisitSchedule,
      updateDoctorVisitSchedule,
      deleteDoctorVisitSchedule,
      fetchPrescriptionTimeSlotDefinitions,
      addPrescriptionTimeSlotDefinition,
      updatePrescriptionTimeSlotDefinition,
      deletePrescriptionTimeSlotDefinition,
      fetchDoctorVisitSchedule,
      // 健康记录回收筒相关
      deletedHealthRecords,
      fetchDeletedHealthRecords,
      restoreHealthRecord,
      permanentlyDeleteHealthRecord,
      // 健康记录去重相关
      findDuplicateHealthRecords,
      batchDeleteDuplicateRecords,
      // [新增] 載入完整記錄
      loadFullHealthRecords,
      // 個人照顧計劃 (ICP) 相關
      carePlans,
      problemLibrary,
      nursingNeedItems,
      addCarePlan,
      updateCarePlan: updateCarePlanFn,
      deleteCarePlan: deleteCarePlanFn,
      duplicateCarePlan: duplicateCarePlanFn,
      getCarePlanWithDetails,
      getCarePlanHistory,
      addProblemToLibrary,
      updateProblemLibrary: updateProblemLibraryFn,
      deleteProblemLibrary: deleteProblemLibraryFn,
      addNursingNeedItem,
      refreshCarePlanData
    }}>
      {children}
    </PatientContext.Provider>
  );
};
export const usePatients = () => {
  const context = useContext(PatientContext);
  if (context === undefined) {
    throw new Error('usePatients must be used within a PatientProvider');
  }
  return context;
};