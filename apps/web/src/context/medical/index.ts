/**
 * Medical Context Exports
 * 
 * 導出醫療相關的 Context：
 * - FollowUpContext: 覆診追蹤管理
 * - DiagnosisContext: 診斷與疫苗記錄
 * - HospitalOutreachContext: 醫院外展記錄
 */

export { 
  FollowUpProvider, 
  useFollowUp, 
  useFollowUpData,
  default as FollowUpContext 
} from './FollowUpContext';

export { 
  DiagnosisProvider, 
  useDiagnosis, 
  useDiagnosisData,
  default as DiagnosisContext 
} from './DiagnosisContext';

export {
  HospitalOutreachProvider,
  useHospitalOutreach,
  useHospitalOutreachData,
  default as HospitalOutreachContext
} from './HospitalOutreachContext';

export type { FollowUpAppointment } from './FollowUpContext';
export type { DiagnosisRecord, VaccinationRecord } from './DiagnosisContext';
export type { HospitalOutreachRecord, HospitalOutreachRecordHistory } from './HospitalOutreachContext';
