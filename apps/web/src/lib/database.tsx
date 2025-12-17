import { supabase } from './supabase';
import { calculateNextDueDate } from '../utils/taskScheduler';

// [新增] 全域導出 CUTOFF 日期字串
export const SYNC_CUTOFF_DATE_STR = '2025-12-01';

// --- 介面定義 (Interfaces) ---

export interface Patient {
  院友id: number;
  床號: string;
  中文姓名: string;
  中文姓氏: string;
  中文名字: string;
  英文姓名?: string;
  英文姓氏?: string;
  英文名字?: string;
  性別: '男' | '女';
  身份證號碼: string;
  出生日期?: string;
  院友相片?: string;
  藥物敏感?: string[];
  不良藥物反應?: string[];
  感染控制?: string[];
  入住日期?: string;
  退住日期?: string;
  護理等級?: '全護理' | '半護理' | '自理';
  入住類型?: '私位' | '買位' | '院舍卷' | '暫住';
  社會福利?: { type: string; subtype?: string };
  在住狀態?: '在住' | '待入住' | '已退住';
  station_id?: string;
  bed_id?: string;
  is_hospitalized?: boolean;
  discharge_reason?: '死亡' | '回家' | '留醫' | '轉往其他機構';
  death_date?: string;
  transfer_facility_name?: string;
  needs_medication_crushing?: boolean;
}

export interface Station {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Bed {
  id: string;
  station_id: string;
  bed_number: string;
  bed_name?: string;
  is_occupied: boolean;
  qr_code_id: string;
  qr_code_generated_at?: string;
  created_at: string;
  updated_at: string;
}

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

export interface Prescription {
  處方id: number;
  院友id: number;
  藥物來源: string;
  處方日期: string;
  藥物名稱: string;
  劑型?: string;
  服用途徑?: string;
  服用份量?: string;
  服用次數?: string;
  服用日數?: string;
  需要時: boolean;
  服用時間: string[];
}

export interface HealthRecord {
  記錄id: number;
  院友id: number;
  task_id?: string;
  記錄日期: string;
  記錄時間: string;
  記錄類型: '生命表徵' | '血糖控制' | '體重控制';
  血壓收縮壓?: number;
  血壓舒張壓?: number;
  脈搏?: number;
  體溫?: number;
  血含氧量?: number;
  呼吸頻率?: number;
  血糖值?: number;
  體重?: number;
  備註?: string;
  記錄人員?: string;
  created_at?: string;
}

export interface DeletedHealthRecord {
  id: string;
  original_record_id: number;
  院友id: number;
  記錄日期: string;
  記錄時間: string;
  記錄類型: '生命表徵' | '血糖控制' | '體重控制';
  血壓收縮壓?: number;
  血壓舒張壓?: number;
  脈搏?: number;
  體溫?: number;
  血含氧量?: number;
  呼吸頻率?: number;
  血糖值?: number;
  體重?: number;
  備註?: string;
  記錄人員?: string;
  created_at?: string;
  deleted_at: string;
  deleted_by?: string;
  deletion_reason: string;
}

export interface DuplicateRecordGroup {
  key: string;
  records: HealthRecord[];
  keepRecord: HealthRecord;
  duplicateRecords: HealthRecord[];
}

export interface FollowUpAppointment {
  覆診id: string;
  院友id: number;
  覆診日期: string;
  出發時間?: string;
  覆診時間?: string;
  覆診地點?: string;
  覆診專科?: string;
  交通安排?: string;
  陪診人員?: string;
  備註?: string;
  狀態: '尚未安排' | '已安排' | '已完成' | '改期' | '取消';
  創建時間: string;
  更新時間: string;
}

export type MealCombinationType = '正飯+正餸' | '正飯+碎餸' | '正飯+糊餸' | '軟飯+正餸' | '軟飯+碎餸' | '軟飯+糊餸' | '糊飯+糊餸';
export type SpecialDietType = '糖尿餐' | '痛風餐' | '低鹽餐' | '鼻胃飼' | '雞蛋';

export interface MealGuidance {
  id: string;
  patient_id: number;
  meal_combination: MealCombinationType;
  special_diets: SpecialDietType[];
  needs_thickener: boolean;
  thickener_amount?: string;
  egg_quantity?: number;
  remarks?: string;
  guidance_date?: string;
  guidance_source?: string;
  created_at: string;
  updated_at: string;
}

export type HealthTaskType = '生命表徵' | '血糖控制' | '體重控制' | '約束物品同意書' | '年度體檢' | '尿導管更換' | '鼻胃飼管更換' | '傷口換症' | '藥物自存同意書' | '晚晴計劃' | '氧氣喉管清洗/更換';
export type FrequencyUnit = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type MonitoringTaskNotes = '注射前' | '服藥前' | '定期' | '特別關顧' | '社康';

export interface PatientHealthTask {
  id: string;
  patient_id: number;
  health_record_type: HealthTaskType;
  frequency_unit: FrequencyUnit;
  frequency_value: number;
  specific_times?: string[];
  specific_days_of_week?: number[];
  specific_days_of_month?: number[];
  last_completed_at?: string;
  next_due_at: string;
  notes?: MonitoringTaskNotes | null;
  is_recurring?: boolean;
  end_date?: string;
  end_time?: string;
  tube_type?: string;
  tube_size?: string;
  created_at: string;
  updated_at: string;
}

export interface PatientLog {
  id: string;
  patient_id: number;
  log_date: string;
  log_type: '日常護理' | '文件簽署' | '入院/出院' | '入住/退住' | '醫生到診' | '意外事故' | '覆診返藥' | '其他';
  content: string;
  recorder: string;
  created_at: string;
  updated_at: string;
}

export interface PatientRestraintAssessment {
  id: string;
  patient_id: number;
  doctor_signature_date?: string;
  next_due_date?: string;
  risk_factors: any;
  alternatives: any;
  suggested_restraints: any;
  other_restraint_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface HealthAssessment {
  id: string;
  patient_id: number;
  smoking_habit?: string;
  drinking_habit?: string;
  daily_activities?: any;
  nutrition_diet?: any;
  vision_hearing?: any;
  communication_ability?: string;
  consciousness_cognition?: string;
  bowel_bladder_control?: any;
  emotional_expression?: string;
  remarks?: string;
  assessment_date: string;
  assessor?: string;
  next_due_date?: string;
  smoking_years_quit?: string;
  smoking_quantity?: string;
  drinking_years_quit?: string;
  drinking_quantity?: string;
  communication_other?: string;
  consciousness_other?: string;
  emotional_other?: string;
  treatment_items?: string[];
  toilet_training?: boolean;
  behavior_expression?: string;
  status: 'active' | 'archived';
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WoundAssessment {
  id: string;
  patient_id: number;
  assessment_date: string;
  next_assessment_date?: string;
  assessor?: string;
  wound_details?: any[];
  status: 'active' | 'archived';
  assessment_status: 'active' | 'improved' | 'healed';
  is_archived: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export type AdmissionEventType = 'hospital_admission' | 'hospital_discharge' | 'transfer_out';

export interface PatientAdmissionRecord {
  id: string;
  patient_id: number;
  event_type: AdmissionEventType;
  event_date: string;
  event_time?: string;
  hospital_name?: string;
  hospital_ward?: string;
  hospital_bed_number?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface DailySystemTask {
  id: string;
  task_name: string;
  task_date: string;
  completed_at?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentReport {
  id: string;
  patient_id: number;
  incident_date: string;
  incident_time?: string;
  incident_type: string;
  other_incident_type?: string;
  location?: string;
  other_location?: string;
  patient_activity?: string;
  other_patient_activity?: string;
  physical_discomfort?: any;
  unsafe_behavior?: any;
  environmental_factors?: any;
  incident_details?: string;
  treatment_date?: string;
  treatment_time?: string;
  vital_signs?: any;
  consciousness_level?: string;
  limb_movement?: any;
  injury_situation?: any;
  patient_complaint?: string;
  immediate_treatment?: any;
  medical_arrangement?: string;
  ambulance_call_time?: string;
  ambulance_arrival_time?: string;
  ambulance_departure_time?: string;
  hospital_destination?: string;
  family_notification_date?: string;
  family_notification_time?: string;
  family_name?: string;
  family_relationship?: string;
  other_family_relationship?: string;
  contact_phone?: string;
  notifying_staff_name?: string;
  notifying_staff_position?: string;
  hospital_treatment?: any;
  hospital_admission?: any;
  return_time?: string;
  submit_to_social_welfare?: boolean;
  submit_to_headquarters?: boolean;
  immediate_improvement_actions?: string;
  prevention_methods?: string;
  reporter_signature?: string;
  reporter_position?: string;
  report_date?: string;
  director_review_date?: string;
  submit_to_headquarters_flag?: boolean;
  submit_to_social_welfare_flag?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiagnosisRecord {
  id: string;
  patient_id: number;
  diagnosis_date: string;
  diagnosis_item: string;
  diagnosis_unit: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface VaccinationRecord {
  id: string;
  patient_id: number;
  vaccination_date: string;
  vaccine_item: string;
  vaccination_unit: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface PatrolRound {
  id: string;
  patient_id: number;
  patrol_date: string;
  patrol_time: string;
  scheduled_time: string;
  recorder: string;
  created_at: string;
  updated_at: string;
}

export interface DiaperChangeRecord {
  id: string;
  patient_id: number;
  change_date: string;
  time_slot: string;
  has_urine: boolean;
  has_stool: boolean;
  has_none: boolean;
  urine_amount?: string;
  stool_color?: string;
  stool_texture?: string;
  stool_amount?: string;
  recorder: string;
  created_at: string;
  updated_at: string;
}

export interface RestraintObservationRecord {
  id: string;
  patient_id: number;
  observation_date: string;
  observation_time: string;
  scheduled_time: string;
  observation_status: 'N' | 'P' | 'S';
  recorder: string;
  notes?: string;
  used_restraints?: any;
  created_at: string;
  updated_at: string;
}

export interface PositionChangeRecord {
  id: string;
  patient_id: number;
  change_date: string;
  scheduled_time: string;
  position: '左' | '平' | '右';
  recorder: string;
  created_at: string;
  updated_at: string;
}

export interface PatientCareTab {
  id: string;
  patient_id: number;
  tab_type: 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training';
  is_manually_added: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface DrugData {
  id: string;
  drug_name: string;
  drug_code?: string;
  drug_type?: string;
  administration_route?: string;
  unit?: string;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type VitalSignType = '上壓' | '下壓' | '脈搏' | '血糖值' | '呼吸' | '血含氧量' | '體溫';
export type ConditionOperatorType = 'gt' | 'lt' | 'gte' | 'lte';

export interface MedicationInspectionRule {
  id: string;
  prescription_id: string;
  vital_sign_type: VitalSignType;
  condition_operator: ConditionOperatorType;
  condition_value: number;
  action_if_met?: string;
  created_at: string;
  updated_at: string;
}

export type MedicationFrequencyType = 'daily' | 'every_x_days' | 'every_x_months' | 'weekly_days' | 'odd_even_days';
export type OddEvenDayType = 'odd' | 'even' | 'none';
export type PreparationMethodType = 'immediate' | 'advanced' | 'custom';
export type PrescriptionStatusType = 'active' | 'inactive' | 'pending_change';

export interface MedicationPrescription {
  id: string;
  patient_id: number;
  medication_name: string;
  prescription_date: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  dosage_form?: string;
  administration_route?: string;
  dosage_amount?: string;
  frequency_type: MedicationFrequencyType;
  frequency_value?: number;
  specific_weekdays?: number[];
  is_odd_even_day: OddEvenDayType;
  is_prn: boolean;
  medication_time_slots?: string[];
  notes?: string;
  preparation_method: PreparationMethodType;
  status: PrescriptionStatusType;
  medication_source: string;
  created_at: string;
  updated_at: string;
}

export type WorkflowStatusEnum = 'pending' | 'completed' | 'failed';
export type DispensingFailureReasonEnum = '回家' | '入院' | '拒服' | '略去' | '藥物不足' | '其他';

export interface MedicationWorkflowRecord {
  id: string;
  prescription_id: string;
  patient_id: number;
  scheduled_date: string;
  scheduled_time: string;
  preparation_status: WorkflowStatusEnum;
  verification_status: WorkflowStatusEnum;
  dispensing_status: WorkflowStatusEnum;
  preparation_staff?: string;
  verification_staff?: string;
  dispensing_staff?: string;
  preparation_time?: string;
  verification_time?: string;
  dispensing_time?: string;
  dispensing_failure_reason?: DispensingFailureReasonEnum;
  custom_failure_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PatientNote {
  id: string;
  patient_id?: number;
  note_date: string;
  content: string;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface MedicationWorkflowSettings {
  id: string;
  user_id: string;
  enable_one_click_functions: boolean;
  enable_immediate_preparation_alerts: boolean;
  auto_jump_to_next_patient: boolean;
  default_preparation_lead_time: number;
}

// --- 核心函式庫 (Functions) ---

// [重要] 優先放置您之前報錯的函式
export const getDrugDatabase = async (): Promise<DrugData[]> => {
  const { data, error } = await supabase.from('medication_drug_database').select('*').order('drug_name', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createDrug = async (drug: any): Promise<DrugData> => {
  const { data, error } = await supabase.from('medication_drug_database').insert([drug]).select().single();
  if (error) throw error;
  return data;
};

export const updateDrug = async (drug: any): Promise<DrugData> => {
  const { data, error } = await supabase.from('medication_drug_database').update(drug).eq('id', drug.id).select().single();
  if (error) throw error;
  return data;
};

export const deleteDrug = async (id: string): Promise<void> => {
  const { error } = await supabase.from('medication_drug_database').delete().eq('id', id);
  if (error) throw error;
};

export const getFollowUps = async (): Promise<FollowUpAppointment[]> => {
  const { data, error } = await supabase.from('覆診安排主表').select('*').order('覆診日期', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createFollowUp = async (appointment: Omit<FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>): Promise<FollowUpAppointment> => {
  const { data, error } = await supabase.from('覆診安排主表').insert([appointment]).select().single();
  if (error) throw error;
  return data;
};

export const updateFollowUp = async (appointment: FollowUpAppointment): Promise<FollowUpAppointment> => {
  const { 覆診id, ...updateData } = appointment;

  // Clean up empty string values by converting them to null
  const cleanedData = { ...updateData };
  Object.keys(cleanedData).forEach(key => {
    if (cleanedData[key] === '') {
      cleanedData[key] = null;
    }
  });

  const { data, error } = await supabase.from('覆診安排主表').update(cleanedData).eq('覆診id', 覆診id).select().single();
  if (error) throw error;
  return data;
};

export const deleteFollowUp = async (id: string): Promise<void> => {
  const { error } = await supabase.from('覆診安排主表').delete().eq('覆診id', id);
  if (error) throw error;
};

export const getPrescriptions = async (patientId?: number): Promise<MedicationPrescription[]> => {
  let query = supabase.from('new_medication_prescriptions').select('*').order('created_at', { ascending: false });
  if (patientId) query = query.eq('patient_id', patientId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getMedicationPrescriptions = getPrescriptions; // Alias

export const createPrescription = async (prescription: Omit<MedicationPrescription, 'id' | 'created_at' | 'updated_at'>): Promise<MedicationPrescription> => {
  const { data, error } = await supabase.from('new_medication_prescriptions').insert([prescription]).select().single();
  if (error) throw error;
  return data;
};

export const updatePrescription = async (prescription: Partial<MedicationPrescription> & { id: string }): Promise<MedicationPrescription> => {
  const { id, ...updateData } = prescription;

  // Clean up empty string values by converting them to null
  const cleanedData = { ...updateData };
  Object.keys(cleanedData).forEach(key => {
    if (cleanedData[key] === '') {
      cleanedData[key] = null;
    }
  });

  const { data, error } = await supabase.from('new_medication_prescriptions').update(cleanedData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deletePrescription = async (id: string | number): Promise<void> => {
  const { error } = await supabase.from('new_medication_prescriptions').delete().eq('id', id);
  if (error) throw error;
};

// 其他基礎函式
export const getPatients = async (): Promise<Patient[]> => {
  const { data, error } = await supabase.from('院友主表').select('*').order('床號', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createPatient = async (patient: Omit<Patient, '院友id'>): Promise<Patient> => {
  // 清理空字符串，將其轉換為 null
  const cleanedPatient = { ...patient };
  Object.keys(cleanedPatient).forEach(key => {
    if (cleanedPatient[key] === '') cleanedPatient[key] = null;
  });

  const { data, error } = await supabase.from('院友主表').insert(cleanedPatient).select('*').single();
  if (error) throw error;
  return data;
};

export const updatePatient = async (patient: Patient): Promise<Patient> => {
  const cleanedPatient = { ...patient };
  Object.keys(cleanedPatient).forEach(key => {
    if (cleanedPatient[key] === '') cleanedPatient[key] = null;
  });
  const { data, error } = await supabase.from('院友主表').update(cleanedPatient).eq('院友id', patient.院友id).select().single();
  if (error) throw error;
  return data;
};

export const deletePatient = async (patientId: number): Promise<void> => {
  const { error } = await supabase.from('院友主表').delete().eq('院友id', patientId);
  if (error) throw error;
};

export const getStations = async (): Promise<Station[]> => {
  const { data, error } = await supabase.from('stations').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createStation = async (station: Omit<Station, 'id' | 'created_at' | 'updated_at'>): Promise<Station> => {
  const { data, error } = await supabase.from('stations').insert([station]).select().single();
  if (error) throw error;
  return data;
};

export const updateStation = async (station: Station): Promise<Station> => {
  const { data, error } = await supabase.from('stations').update(station).eq('id', station.id).select().single();
  if (error) throw error;
  return data;
};

export const deleteStation = async (stationId: string): Promise<void> => {
  const { error } = await supabase.from('stations').delete().eq('id', stationId);
  if (error) throw error;
};

export const getBeds = async (): Promise<Bed[]> => {
  const { data, error } = await supabase.from('beds').select('*').order('bed_number', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createBed = async (bed: Omit<Bed, 'id' | 'created_at' | 'updated_at'>): Promise<Bed> => {
  const { data, error } = await supabase.from('beds').insert([bed]).select().single();
  if (error) throw error;
  return data;
};

export const updateBed = async (bed: Bed): Promise<Bed> => {
  const { data, error } = await supabase.from('beds').update(bed).eq('id', bed.id).select().single();
  if (error) throw error;
  return data;
};

export const deleteBed = async (bedId: string): Promise<void> => {
  const { error } = await supabase.from('beds').delete().eq('id', bedId);
  if (error) throw error;
};

export const getBedByQrCodeId = async (qrCodeId: string): Promise<Bed | null> => {
  const { data, error } = await supabase
    .from('beds')
    .select('*')
    .eq('qr_code_id', qrCodeId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const assignPatientToBed = async (patientId: number, bedId: string): Promise<void> => {
  const { error } = await supabase.from('院友主表').update({ bed_id: bedId }).eq('院友id', patientId);
  if (error) throw error;
};

export const swapPatientBeds = async (patientId1: number, patientId2: number): Promise<void> => {
  const { data: patients, error: fetchError } = await supabase.from('院友主表').select('院友id, bed_id').in('院友id', [patientId1, patientId2]);
  if (fetchError) throw fetchError;
  const patient1 = patients?.find(p => p.院友id === patientId1);
  const patient2 = patients?.find(p => p.院友id === patientId2);
  if (!patient1 || !patient2) throw new Error('找不到院友資料');
  const { error: updateError1 } = await supabase.from('院友主表').update({ bed_id: patient2.bed_id }).eq('院友id', patientId1);
  if (updateError1) throw updateError1;
  const { error: updateError2 } = await supabase.from('院友主表').update({ bed_id: patient1.bed_id }).eq('院友id', patientId2);
  if (updateError2) throw updateError2;
};

export const moveBedToStation = async (bedId: string, newStationId: string): Promise<void> => {
  const { error } = await supabase.from('beds').update({ station_id: newStationId }).eq('id', bedId);
  if (error) throw error;
};

export const getSchedules = async (): Promise<Schedule[]> => {
  const { data, error } = await supabase.from('到診排程主表').select('*').order('到診日期', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createSchedule = async (schedule: Omit<Schedule, '排程id'>): Promise<Schedule> => {
  const { data, error } = await supabase.from('到診排程主表').insert([schedule]).select().single();
  if (error) throw error;
  return data;
};

export const updateSchedule = async (schedule: Schedule): Promise<Schedule> => {
  const { data, error } = await supabase.from('到診排程主表').update(schedule).eq('排程id', schedule.排程id).select().single();
  if (error) throw error;
  return data;
};

export const deleteSchedule = async (scheduleId: number): Promise<void> => {
  const { error } = await supabase.from('到診排程主表').delete().eq('排程id', scheduleId);
  if (error) throw error;
};

export const getScheduleDetails = async (scheduleId: number): Promise<ScheduleDetail[]> => {
  const { data, error } = await supabase.from('看診院友細項').select(`*, 到診院友_看診原因(看診原因選項(原因id, 原因名稱))`).eq('排程id', scheduleId);
  if (error) throw error;
  return (data || []).map(item => ({ ...item, reasons: item.到診院友_看診原因?.map((r: any) => r.看診原因選項) || [] }));
};

export const addPatientToSchedule = async (scheduleId: number, patientId: number, symptoms: string, notes: string, reasons: string[]): Promise<void> => {
  const { data: detail, error: detailError } = await supabase.from('看診院友細項').insert([{ 排程id: scheduleId, 院友id: patientId, 症狀說明: symptoms, 備註: notes }]).select().single();
  if (detailError) throw detailError;
  if (reasons.length > 0) {
    const reasonInserts = reasons.map(reason => ({ 細項id: detail.細項id, 原因id: parseInt(reason) }));
    const { error: reasonError } = await supabase.from('到診院友_看診原因').insert(reasonInserts);
    if (reasonError) throw reasonError;
  }
};

export const updateScheduleDetail = async (detailData: { 細項id: number; 症狀說明: string; 備註: string; reasonIds: number[]; }): Promise<any> => {
  try {
    const { error: updateError } = await supabase.from('看診院友細項').update({ 症狀說明: detailData.症狀說明, 備註: detailData.備註 }).eq('細項id', detailData.細項id);
    if (updateError) throw updateError;
    const { error: deleteError } = await supabase.from('到診院友_看診原因').delete().eq('細項id', detailData.細項id);
    if (deleteError) throw deleteError;
    if (detailData.reasonIds.length > 0) {
      const reasonInserts = detailData.reasonIds.map(reasonId => ({ 細項id: detailData.細項id, 原因id: reasonId }));
      const { error: insertError } = await supabase.from('到診院友_看診原因').insert(reasonInserts);
      if (insertError) throw insertError;
    }
    return { success: true };
  } catch (error) { return { error }; }
};

export const deleteScheduleDetail = async (detailId: number): Promise<void> => {
  const { error } = await supabase.from('看診院友細項').delete().eq('細項id', detailId);
  if (error) throw error;
};

export const getReasons = async (): Promise<ServiceReason[]> => {
  const { data, error } = await supabase.from('看診原因選項').select('*').order('原因名稱', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getHealthRecords = async (limit?: number): Promise<HealthRecord[]> => {
  const pageSize = 1000;
  let allRecords: HealthRecord[] = [];
  let page = 0;
  let hasMore = true;

  if (limit !== undefined) {
    const { data, error } = await supabase.from('健康記錄主表').select('*').order('記錄日期', { ascending: false }).order('記錄時間', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }

  while (hasMore) {
    const { data, error } = await supabase.from('健康記錄主表').select('*').order('記錄日期', { ascending: false }).order('記錄時間', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allRecords = [...allRecords, ...data];
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  return allRecords;
};

export const createHealthRecord = async (record: Omit<HealthRecord, '記錄id'>): Promise<HealthRecord> => {
  const { data, error } = await supabase.from('健康記錄主表').insert([record]).select('記錄id').single();
  if (error) { console.error('Error creating health record:', error); throw error; }
  return { ...record, ...data } as HealthRecord;
};

export const updateHealthRecord = async (record: HealthRecord): Promise<HealthRecord> => {
  const { error } = await supabase.from('健康記錄主表').update(record).eq('記錄id', record.記錄id);
  if (error) { console.error('Error updating health record:', error); throw error; }
  return record;
};

export const deleteHealthRecord = async (recordId: number): Promise<void> => {
  const { error } = await supabase.from('健康記錄主表').delete().eq('記錄id', recordId);
  if (error) { console.error('Error deleting health record:', error); throw error; }
};

export const getHealthRecordByDateTime = async (
  patientId: number,
  recordDate: string,
  recordTime: string,
  vitalSignType: string
): Promise<HealthRecord | null> => {
  const vitalSignTypeMap: Record<string, { recordType: '生命表徵' | '血糖控制' | '體重控制', field: keyof HealthRecord }> = {
    '上壓': { recordType: '生命表徵', field: '血壓收縮壓' },
    '下壓': { recordType: '生命表徵', field: '血壓舒張壓' },
    '脈搏': { recordType: '生命表徵', field: '脈搏' },
    '血糖值': { recordType: '血糖控制', field: '血糖值' },
    '呼吸': { recordType: '生命表徵', field: '呼吸頻率' },
    '血含氧量': { recordType: '生命表徵', field: '血含氧量' },
    '體溫': { recordType: '生命表徵', field: '體溫' }
  };

  const mapping = vitalSignTypeMap[vitalSignType];
  if (!mapping) {
    console.warn(`Unknown vital sign type: ${vitalSignType}`);
    return null;
  }

  const { data, error } = await supabase
    .from('健康記錄主表')
    .select('*')
    .eq('院友id', patientId)
    .eq('記錄日期', recordDate)
    .eq('記錄時間', recordTime)
    .eq('記錄類型', mapping.recordType)
    .not(mapping.field as string, 'is', null)
    .order('記錄id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching health record by date time:', error);
    throw error;
  }

  return data as HealthRecord | null;
};

export const getRecentHealthRecordsByPatient = async (
  patientId: number,
  recordType: '生命表徵' | '血糖控制' | '體重控制',
  limit: number = 5
): Promise<HealthRecord[]> => {
  console.log('[getRecentHealthRecordsByPatient] 查詢參數:', { patientId, recordType, limit });

  const { data, error } = await supabase
    .from('健康記錄主表')
    .select('*')
    .eq('院友id', patientId)
    .eq('記錄類型', recordType)
    .order('記錄日期', { ascending: false })
    .order('記錄時間', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getRecentHealthRecordsByPatient] 查詢錯誤:', error);
    throw error;
  }

  console.log('[getRecentHealthRecordsByPatient] 查詢結果 (未過濾):', data?.length, '筆');

  // 在客戶端過濾掉「無法量度」的記錄
  const filtered = (data as HealthRecord[])?.filter(record => {
    const hasUnmeasurable = record.備註?.includes('無法量度');
    return !hasUnmeasurable;
  }) || [];

  console.log('[getRecentHealthRecordsByPatient] 過濾後結果:', filtered.length, '筆');

  return filtered;
};

export const getHealthTasks = async (): Promise<PatientHealthTask[]> => {
  const { data, error } = await supabase.from('patient_health_tasks').select('*').order('next_due_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createPatientHealthTask = async (task: Omit<PatientHealthTask, 'id' | 'created_at' | 'updated_at'>): Promise<PatientHealthTask> => {
  const { data, error } = await supabase.from('patient_health_tasks').insert([task]).select().single();
  if (error) throw error;
  return data;
};

export const updatePatientHealthTask = async (task: PatientHealthTask): Promise<PatientHealthTask> => {
  const { error } = await supabase.from('patient_health_tasks').update(task).eq('id', task.id);
  if (error) throw error;
  return task;
};

export const deletePatientHealthTask = async (taskId: string): Promise<void> => {
  const { error } = await supabase.from('patient_health_tasks').delete().eq('id', taskId);
  if (error) throw error;
};

export const getMealGuidances = async (): Promise<MealGuidance[]> => {
  const { data, error } = await supabase.from('meal_guidance').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createMealGuidance = async (guidance: Omit<MealGuidance, 'id' | 'created_at' | 'updated_at'>): Promise<MealGuidance> => {
  // 使用 upsert 避免唯一性約束衝突（每個院友只能有一筆記錄）
  const { data, error } = await supabase
    .from('meal_guidance')
    .upsert([guidance], {
      onConflict: 'patient_id',
      ignoreDuplicates: false
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateMealGuidance = async (guidance: MealGuidance): Promise<MealGuidance> => {
  const { data, error } = await supabase.from('meal_guidance').update(guidance).eq('id', guidance.id).select().single();
  if (error) throw error;
  return data;
};

export const deleteMealGuidance = async (guidanceId: string): Promise<void> => {
  const { error } = await supabase.from('meal_guidance').delete().eq('id', guidanceId);
  if (error) throw error;
};

export const getPatientLogs = async (): Promise<PatientLog[]> => {
  const { data, error } = await supabase.from('patient_logs').select('*').order('log_date', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPatientLog = async (log: Omit<PatientLog, 'id' | 'created_at' | 'updated_at'>): Promise<PatientLog> => {
  const { data, error } = await supabase.from('patient_logs').insert([log]).select().single();
  if (error) throw error;
  return data;
};

export const updatePatientLog = async (log: PatientLog): Promise<PatientLog> => {
  const { data, error } = await supabase.from('patient_logs').update(log).eq('id', log.id).select().single();
  if (error) throw error;
  return data;
};

export const deletePatientLog = async (logId: string): Promise<void> => {
  const { error } = await supabase.from('patient_logs').delete().eq('id', logId);
  if (error) throw error;
};

export const getRestraintAssessments = async (): Promise<PatientRestraintAssessment[]> => {
  const { data, error } = await supabase.from('patient_restraint_assessments').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createRestraintAssessment = async (assessment: Omit<PatientRestraintAssessment, 'id' | 'created_at' | 'updated_at'>): Promise<PatientRestraintAssessment> => {
  const { data, error } = await supabase.from('patient_restraint_assessments').insert([assessment]).select().single();
  if (error) throw error;
  return data;
};

export const updateRestraintAssessment = async (assessment: PatientRestraintAssessment): Promise<PatientRestraintAssessment> => {
  // Clean up empty string values by converting them to null
  const cleanedAssessment = { ...assessment };
  Object.keys(cleanedAssessment).forEach(key => {
    if (cleanedAssessment[key] === '') {
      cleanedAssessment[key] = null;
    }
  });

  const { error } = await supabase.from('patient_restraint_assessments').update(cleanedAssessment).eq('id', cleanedAssessment.id);
  if (error) throw error;
  return cleanedAssessment;
};

export const deleteRestraintAssessment = async (assessmentId: string): Promise<void> => {
  const { error } = await supabase.from('patient_restraint_assessments').delete().eq('id', assessmentId);
  if (error) throw error;
};

export const getHealthAssessments = async (statusFilter?: 'active' | 'archived' | 'all'): Promise<HealthAssessment[]> => {
  let query = supabase.from('health_assessments').select('*');

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query.order('assessment_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createHealthAssessment = async (assessment: Omit<HealthAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>): Promise<HealthAssessment> => {
  // 先歸檔該院友的所有 active 記錄，避免唯一性約束衝突
  const { error: archiveError } = await supabase
    .from('health_assessments')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString()
    })
    .eq('patient_id', assessment.patient_id)
    .eq('status', 'active');

  if (archiveError) throw archiveError;

  // 插入新記錄
  const { data, error } = await supabase.from('health_assessments').insert([{
    ...assessment,
    status: 'active'
  }]).select().single();
  if (error) throw error;
  return data;
};

export const updateHealthAssessment = async (assessment: HealthAssessment): Promise<HealthAssessment> => {
  const { id, created_at, updated_at, ...updateData } = assessment;
  const { error } = await supabase.from('health_assessments').update(updateData).eq('id', id);
  if (error) throw error;
  return assessment;
};

export const deleteHealthAssessment = async (assessmentId: string): Promise<void> => {
  const { error } = await supabase.from('health_assessments').delete().eq('id', assessmentId);
  if (error) throw error;
};

export const getWoundAssessments = async (statusFilter?: 'active' | 'archived' | 'all'): Promise<WoundAssessment[]> => {
  let query = supabase.from('wound_assessments').select('*');

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query.order('assessment_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createWoundAssessment = async (assessment: Omit<WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>): Promise<WoundAssessment> => {
  const { wound_details, ...assessmentData } = assessment as any;

  // 先歸檔該院友的所有 active 記錄，避免唯一性約束衝突
  const { error: archiveError } = await supabase
    .from('wound_assessments')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString()
    })
    .eq('patient_id', assessmentData.patient_id)
    .eq('status', 'active');

  if (archiveError) throw archiveError;

  // 插入新記錄
  const { data: assessmentRecord, error: assessmentError } = await supabase.from('wound_assessments').insert([{
    patient_id: assessmentData.patient_id,
    assessment_date: assessmentData.assessment_date,
    next_assessment_date: assessmentData.next_assessment_date,
    assessor: assessmentData.assessor,
    wound_details: wound_details || [],
    status: 'active'
  }]).select().single();
  if (assessmentError) throw assessmentError;
  return assessmentRecord;
};

export const updateWoundAssessment = async (assessment: WoundAssessment): Promise<WoundAssessment> => {
  const { id, created_at, updated_at, wound_details, ...assessmentData } = assessment as any;
  const { data, error } = await supabase.from('wound_assessments').update({
    patient_id: assessmentData.patient_id,
    assessment_date: assessmentData.assessment_date,
    next_assessment_date: assessmentData.next_assessment_date,
    assessor: assessmentData.assessor,
    wound_details: wound_details || [],
    status: assessmentData.status,
    archived_at: assessmentData.archived_at
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteWoundAssessment = async (assessmentId: string): Promise<void> => {
  const { error } = await supabase.from('wound_assessments').delete().eq('id', assessmentId);
  if (error) throw error;
};

export const getPatientAdmissionRecords = async (): Promise<PatientAdmissionRecord[]> => {
  const { data, error } = await supabase.from('patient_admission_records').select('*').order('event_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPatientAdmissionRecord = async (record: Omit<PatientAdmissionRecord, 'id' | 'created_at' | 'updated_at'>): Promise<PatientAdmissionRecord> => {
  const { data, error } = await supabase.from('patient_admission_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updatePatientAdmissionRecord = async (record: PatientAdmissionRecord): Promise<PatientAdmissionRecord> => {
  const { data, error } = await supabase.from('patient_admission_records').update(record).eq('id', record.id).select().single();
  if (error) throw error;
  return data;
};

export const deletePatientAdmissionRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('patient_admission_records').delete().eq('id', recordId);
  if (error) throw error;
};

export const recordPatientAdmissionEvent = async (eventData: {
  patient_id: number;
  event_type: AdmissionEventType;
  event_date: string;
  hospital_name?: string;
  hospital_ward?: string;
  hospital_bed_number?: string;
  remarks?: string;
}): Promise<void> => {
  const { error } = await supabase.from('patient_admission_records').insert([eventData]);
  if (error) throw error;
};

export const getHospitalEpisodes = async (): Promise<any[]> => {
  const { data, error } = await supabase.from('hospital_episodes').select(`*, episode_events(*)`).order('episode_start_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createHospitalEpisode = async (episode: any): Promise<any> => {
  const { data, error } = await supabase.from('hospital_episodes').insert([episode]).select().single();
  if (error) throw error;
  return data;
};

export const updateHospitalEpisode = async (episode: any): Promise<any> => {
  const { data, error } = await supabase.from('hospital_episodes').update(episode).eq('id', episode.id).select().single();
  if (error) throw error;
  return data;
};

export const deleteHospitalEpisode = async (episodeId: string): Promise<void> => {
  const { error } = await supabase.from('hospital_episodes').delete().eq('id', episodeId);
  if (error) throw error;
};

export const createEpisodeEvent = async (event: any): Promise<any> => {
  const { data, error } = await supabase.from('episode_events').insert([event]).select().single();
  if (error) throw error;
  return data;
};

export const deleteEpisodeEventsByEpisodeId = async (episodeId: string): Promise<void> => {
  const { error } = await supabase.from('episode_events').delete().eq('episode_id', episodeId);
  if (error) throw error;
};

export const getOverdueDailySystemTasks = async (): Promise<DailySystemTask[]> => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('daily_system_tasks').select('*').lt('task_date', today).eq('status', 'pending').order('task_date', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const recordDailySystemTaskCompletion = async (taskName: string, taskDate: string): Promise<void> => {
  const { error } = await supabase.from('daily_system_tasks').upsert([{
    task_name: taskName,
    task_date: taskDate,
    status: 'completed',
    completed_at: new Date().toISOString()
  }]);
  if (error) throw error;
};

export const searchDrugs = async (searchTerm: string): Promise<DrugData[]> => {
  let query = supabase.from('medication_drug_database').select('*').order('drug_name', { ascending: true });
  if (searchTerm.trim()) {
    query = query.or(`drug_name.ilike.%${searchTerm}%,drug_code.ilike.%${searchTerm}%,drug_type.ilike.%${searchTerm}%,administration_route.ilike.%${searchTerm}%,unit.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getMedicationInspectionRules = async (prescriptionId?: string): Promise<MedicationInspectionRule[]> => {
  let query = supabase.from('medication_inspection_rules').select('*').order('created_at', { ascending: false });
  if (prescriptionId) query = query.eq('prescription_id', prescriptionId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createMedicationInspectionRule = async (ruleData: {
  prescription_id: string;
  vital_sign_type: VitalSignType;
  condition_operator: ConditionOperatorType;
  condition_value: number;
  action_if_met?: string;
}): Promise<MedicationInspectionRule> => {
  const { data, error } = await supabase.from('medication_inspection_rules').insert([ruleData]).select().single();
  if (error) throw error;
  return data;
};

export const updateMedicationInspectionRule = async (ruleData: {
  id: string;
  prescription_id: string;
  vital_sign_type: VitalSignType;
  condition_operator: ConditionOperatorType;
  condition_value: number;
  action_if_met?: string;
}): Promise<MedicationInspectionRule> => {
  const { data, error } = await supabase.from('medication_inspection_rules').update(ruleData).eq('id', ruleData.id).select().single();
  if (error) throw error;
  return data;
};

export const deleteMedicationInspectionRule = async (ruleId: string): Promise<void> => {
  const { error } = await supabase.from('medication_inspection_rules').delete().eq('id', ruleId);
  if (error) throw error;
};

export const createMedicationPrescription = async (prescriptionData: any): Promise<MedicationPrescription> => {
  const { data, error } = await supabase.from('new_medication_prescriptions').insert([prescriptionData]).select().single();
  if (error) throw error;
  return data;
};

export const updateMedicationPrescription = async (prescriptionData: any): Promise<MedicationPrescription> => {
  const { data, error } = await supabase.from('new_medication_prescriptions').update(prescriptionData).eq('id', prescriptionData.id).select().single();
  if (error) throw error;
  return data;
};

export const deleteMedicationPrescription = async (prescriptionId: string): Promise<void> => {
  const { error } = await supabase.from('new_medication_prescriptions').delete().eq('id', prescriptionId);
  if (error) throw error;
};

export interface PrescriptionTimeSlotDefinition {
  id: string;
  slot_name: string;
  start_time?: string;
  end_time?: string;
  is_meal_related: boolean;
  meal_type?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const getPrescriptionTimeSlotDefinitions = async (): Promise<PrescriptionTimeSlotDefinition[]> => {
  const { data, error } = await supabase
    .from('prescription_time_slot_definitions')
    .select('*')
    .order('slot_name', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const addPrescriptionTimeSlotDefinition = async (definition: Omit<PrescriptionTimeSlotDefinition, 'id' | 'created_at' | 'updated_at'>): Promise<PrescriptionTimeSlotDefinition> => {
  const { data, error } = await supabase
    .from('prescription_time_slot_definitions')
    .insert([definition])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updatePrescriptionTimeSlotDefinition = async (definition: PrescriptionTimeSlotDefinition): Promise<PrescriptionTimeSlotDefinition> => {
  const { data, error } = await supabase
    .from('prescription_time_slot_definitions')
    .update(definition)
    .eq('id', definition.id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deletePrescriptionTimeSlotDefinition = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('prescription_time_slot_definitions')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const getMedicationWorkflowSettings = async (userId: string): Promise<MedicationWorkflowSettings | null> => {
  const { data, error } = await supabase.from('medication_workflow_settings').select('*').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

export const updateMedicationWorkflowSettings = async (userId: string, settings: Partial<MedicationWorkflowSettings>): Promise<MedicationWorkflowSettings> => {
  const { data: existing } = await supabase.from('medication_workflow_settings').select('*').eq('user_id', userId).single();
  if (existing) {
    const { data, error } = await supabase.from('medication_workflow_settings').update(settings).eq('user_id', userId).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('medication_workflow_settings').insert([{ user_id: userId, ...settings }]).select().single();
    if (error) throw error;
    return data;
  }
};

export const getMedicationWorkflowRecords = async (filters?: any): Promise<MedicationWorkflowRecord[]> => {
  let query = supabase.from('medication_workflow_records').select('*');
  if (filters) {
    if (filters.patient_id) query = query.eq('patient_id', filters.patient_id);
    if (filters.scheduled_date) query = query.eq('scheduled_date', filters.scheduled_date);
  }
  query = query.order('scheduled_date', { ascending: true }).order('scheduled_time', { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createMedicationWorkflowRecord = async (record: any): Promise<MedicationWorkflowRecord> => {
  const { data, error } = await supabase.from('medication_workflow_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updateMedicationWorkflowRecord = async (record: MedicationWorkflowRecord): Promise<MedicationWorkflowRecord> => {
  const { data, error } = await supabase.from('medication_workflow_records').update(record).eq('id', record.id).select().single();
  if (error) throw error;
  return data;
};

export const deleteMedicationWorkflowRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('medication_workflow_records').delete().eq('id', recordId);
  if (error) throw error;
  return;
};

export const getAnnualHealthCheckups = async (): Promise<any[]> => {
  const { data, error } = await supabase.from('annual_health_checkups').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getAnnualHealthCheckupByPatientId = async (patientId: number): Promise<any | null> => {
  const { data, error } = await supabase
    .from('annual_health_checkups')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createAnnualHealthCheckup = async (checkup: any): Promise<any> => {
  // 使用 upsert 避免唯一性約束衝突（每個院友只能有一筆記錄）
  const { data, error } = await supabase
    .from('annual_health_checkups')
    .upsert([checkup], {
      onConflict: 'patient_id',
      ignoreDuplicates: false
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateAnnualHealthCheckup = async (checkup: any): Promise<any> => {
  const { id, ...updateData } = checkup;

  // Clean up empty string values by converting them to null
  const cleanedData = { ...updateData };
  Object.keys(cleanedData).forEach(key => {
    if (cleanedData[key] === '') {
      cleanedData[key] = null;
    }
  });

  const { data, error } = await supabase.from('annual_health_checkups').update({ ...cleanedData, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteAnnualHealthCheckup = async (checkupId: string): Promise<void> => {
  const { error } = await supabase.from('annual_health_checkups').delete().eq('id', checkupId);
  if (error) throw error;
};

export const getIncidentReports = async (): Promise<IncidentReport[]> => {
  const { data, error } = await supabase.from('incident_reports').select('*').order('incident_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createIncidentReport = async (report: Omit<IncidentReport, 'id' | 'created_at' | 'updated_at'>): Promise<IncidentReport> => {
  const { data, error } = await supabase.from('incident_reports').insert([report]).select().single();
  if (error) throw error;
  return data;
};

export const updateIncidentReport = async (report: IncidentReport): Promise<IncidentReport> => {
  const { id, created_at, updated_at, ...updateData } = report;
  const { data, error } = await supabase.from('incident_reports').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteIncidentReport = async (reportId: string): Promise<void> => {
  const { error } = await supabase.from('incident_reports').delete().eq('id', reportId);
  if (error) throw error;
};

export const getDiagnosisRecords = async (): Promise<DiagnosisRecord[]> => {
  const { data, error } = await supabase.from('diagnosis_records').select('*').order('diagnosis_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createDiagnosisRecord = async (record: Omit<DiagnosisRecord, 'id' | 'created_at' | 'updated_at'>): Promise<DiagnosisRecord> => {
  const { data, error } = await supabase.from('diagnosis_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updateDiagnosisRecord = async (record: DiagnosisRecord): Promise<DiagnosisRecord> => {
  const { id, created_at, updated_at, ...updateData } = record;
  const { data, error } = await supabase.from('diagnosis_records').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteDiagnosisRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('diagnosis_records').delete().eq('id', recordId);
  if (error) throw error;
};

export const getVaccinationRecords = async (): Promise<VaccinationRecord[]> => {
  const { data, error } = await supabase.from('vaccination_records').select('*').order('vaccination_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createVaccinationRecord = async (record: Omit<VaccinationRecord, 'id' | 'created_at' | 'updated_at'>): Promise<VaccinationRecord> => {
  const { data, error } = await supabase.from('vaccination_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updateVaccinationRecord = async (record: VaccinationRecord): Promise<VaccinationRecord> => {
  const { id, created_at, updated_at, ...updateData } = record;
  const { data, error } = await supabase.from('vaccination_records').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteVaccinationRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('vaccination_records').delete().eq('id', recordId);
  if (error) throw error;
};

export const getPatientNotes = async (): Promise<PatientNote[]> => {
  const { data, error } = await supabase.from('patient_notes').select('*').order('is_completed', { ascending: true }).order('note_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPatientNote = async (note: Omit<PatientNote, 'id' | 'created_at' | 'updated_at'>): Promise<PatientNote> => {
  const { data, error } = await supabase.from('patient_notes').insert([note]).select().single();
  if (error) throw error;
  return data;
};

export const updatePatientNote = async (note: PatientNote): Promise<PatientNote> => {
  const { id, created_at, updated_at, ...updateData } = note;
  const { data, error } = await supabase.from('patient_notes').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deletePatientNote = async (noteId: string): Promise<void> => {
  const { error } = await supabase.from('patient_notes').delete().eq('id', noteId);
  if (error) throw error;
};

export const completePatientNote = async (noteId: string): Promise<PatientNote> => {
  const { data, error } = await supabase.from('patient_notes').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', noteId).select().single();
  if (error) throw error;
  return data;
};

// Care Records
export const getPatrolRounds = async (): Promise<PatrolRound[]> => {
  const { data, error } = await supabase.from('patrol_rounds').select('*').order('patrol_date', { ascending: false }).order('scheduled_time', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPatrolRound = async (round: Omit<PatrolRound, 'id' | 'created_at' | 'updated_at'>): Promise<PatrolRound> => {
  const { data, error } = await supabase.from('patrol_rounds').insert([round]).select().single();
  if (error) throw error;
  return data;
};

export const updatePatrolRound = async (round: PatrolRound): Promise<PatrolRound> => {
  const { id, created_at, updated_at, ...updateData } = round;
  const { data, error } = await supabase.from('patrol_rounds').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deletePatrolRound = async (roundId: string): Promise<void> => {
  const { error } = await supabase.from('patrol_rounds').delete().eq('id', roundId);
  if (error) throw error;
};

export const getDiaperChangeRecords = async (): Promise<DiaperChangeRecord[]> => {
  const { data, error } = await supabase.from('diaper_change_records').select('*').order('change_date', { ascending: false }).order('time_slot', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createDiaperChangeRecord = async (record: Omit<DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'>): Promise<DiaperChangeRecord> => {
  const { data, error } = await supabase.from('diaper_change_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updateDiaperChangeRecord = async (record: DiaperChangeRecord): Promise<DiaperChangeRecord> => {
  const { id, created_at, updated_at, ...updateData } = record;
  const { data, error } = await supabase.from('diaper_change_records').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteDiaperChangeRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('diaper_change_records').delete().eq('id', recordId);
  if (error) throw error;
};

export const getRestraintObservationRecords = async (): Promise<RestraintObservationRecord[]> => {
  const { data, error } = await supabase.from('restraint_observation_records').select('*').order('observation_date', { ascending: false }).order('scheduled_time', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createRestraintObservationRecord = async (record: Omit<RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'>): Promise<RestraintObservationRecord> => {
  const { data, error } = await supabase.from('restraint_observation_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updateRestraintObservationRecord = async (record: RestraintObservationRecord): Promise<RestraintObservationRecord> => {
  const { id, created_at, updated_at, ...updateData } = record;
  const { data, error } = await supabase.from('restraint_observation_records').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteRestraintObservationRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('restraint_observation_records').delete().eq('id', recordId);
  if (error) throw error;
};

export const getPositionChangeRecords = async (): Promise<PositionChangeRecord[]> => {
  const { data, error } = await supabase.from('position_change_records').select('*').order('change_date', { ascending: false }).order('scheduled_time', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPositionChangeRecord = async (record: Omit<PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>): Promise<PositionChangeRecord> => {
  const { data, error } = await supabase.from('position_change_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const deletePositionChangeRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('position_change_records').delete().eq('id', recordId);
  if (error) throw error;
};

// Date range filters for Care Records
export const getPatrolRoundsInDateRange = async (startDate: string, endDate: string): Promise<PatrolRound[]> => {
  const { data, error } = await supabase.from('patrol_rounds').select('*').gte('patrol_date', startDate).lte('patrol_date', endDate).order('patrol_date', { ascending: false }).order('scheduled_time', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getDiaperChangeRecordsInDateRange = async (startDate: string, endDate: string): Promise<DiaperChangeRecord[]> => {
  const { data, error } = await supabase.from('diaper_change_records').select('*').gte('change_date', startDate).lte('change_date', endDate).order('change_date', { ascending: false }).order('time_slot', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getRestraintObservationRecordsInDateRange = async (startDate: string, endDate: string): Promise<RestraintObservationRecord[]> => {
  const { data, error } = await supabase.from('restraint_observation_records').select('*').gte('observation_date', startDate).lte('observation_date', endDate).order('observation_date', { ascending: false }).order('scheduled_time', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getPositionChangeRecordsInDateRange = async (startDate: string, endDate: string): Promise<PositionChangeRecord[]> => {
  const { data, error } = await supabase.from('position_change_records').select('*').gte('change_date', startDate).lte('change_date', endDate).order('change_date', { ascending: false }).order('scheduled_time', { ascending: false });
  if (error) throw error;
  return data || [];
};

// Template management
export const getTemplatesMetadata = async () => {
  const { data, error } = await supabase.from('templates_metadata').select('*').order('upload_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const uploadTemplateFile = async (file: File, storagePath: string): Promise<string> => {
  const { data, error } = await supabase.storage.from('templates').upload(storagePath, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return data.path;
};

export const createTemplateMetadata = async (metadata: any) => {
  const { data, error } = await supabase.from('templates_metadata').insert([metadata]).select().single();
  if (error) throw error;
  return data;
};

export const deleteTemplateMetadata = async (templateId: number): Promise<void> => {
  const { error } = await supabase.from('templates_metadata').delete().eq('id', templateId);
  if (error) throw error;
};

export const deleteFileFromStorage = async (storagePath: string): Promise<void> => {
  const { error } = await supabase.storage.from('templates').remove([storagePath]);
  if (error) throw error;
};

export const downloadTemplateFile = async (storagePath: string, originalName: string): Promise<void> => {
  const { data, error } = await supabase.storage.from('templates').download(storagePath);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = originalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Recycle bin functions
export const moveHealthRecordToRecycleBin = async (record: HealthRecord, deletedBy?: string, deletionReason: string = '记录去重'): Promise<void> => {
  const { error: insertError } = await supabase.from('deleted_health_records').insert({
    original_record_id: record.記錄id,
    院友id: record.院友id,
    記錄日期: record.記錄日期,
    記錄時間: record.記錄時間,
    記錄類型: record.記錄類型,
    血壓收縮壓: record.血壓收縮壓,
    血壓舒張壓: record.血壓舒張壓,
    脈搏: record.脈搏,
    體溫: record.體溫,
    血含氧量: record.血含氧量,
    呼吸頻率: record.呼吸頻率,
    血糖值: record.血糖值,
    體重: record.體重,
    備註: record.備註,
    記錄人員: record.記錄人員,
    created_at: record.created_at,
    deleted_by: deletedBy,
    deletion_reason: deletionReason
  });
  if (insertError) console.warn('Recycle bin error:', insertError);
  const { error: deleteError } = await supabase.from('健康記錄主表').delete().eq('記錄id', record.記錄id);
  if (deleteError) throw deleteError;
};

export const getDeletedHealthRecords = async (): Promise<DeletedHealthRecord[]> => {
  const { data, error } = await supabase.from('deleted_health_records').select('*').order('deleted_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const restoreHealthRecordFromRecycleBin = async (deletedRecordId: string): Promise<void> => {
  const { data: deletedRecord, error: fetchError } = await supabase.from('deleted_health_records').select('*').eq('id', deletedRecordId).single();
  if (fetchError || !deletedRecord) throw fetchError || new Error('Record not found');
  const { error: insertError } = await supabase.from('健康記錄主表').insert({
    院友id: deletedRecord.院友id,
    記錄日期: deletedRecord.記錄日期,
    記錄時間: deletedRecord.記錄時間,
    記錄類型: deletedRecord.記錄類型,
    血壓收縮壓: deletedRecord.血壓收縮壓,
    血壓舒張壓: deletedRecord.血壓舒張壓,
    脈搏: deletedRecord.脈搏,
    體溫: deletedRecord.體溫,
    血含氧量: deletedRecord.血含氧量,
    呼吸頻率: deletedRecord.呼吸頻率,
    血糖值: deletedRecord.血糖值,
    體重: deletedRecord.體重,
    備註: deletedRecord.備註,
    記錄人員: deletedRecord.記錄人員
  });
  if (insertError) throw insertError;
  const { error: deleteError } = await supabase.from('deleted_health_records').delete().eq('id', deletedRecordId);
  if (deleteError) throw deleteError;
};

export const permanentlyDeleteHealthRecord = async (deletedRecordId: string): Promise<void> => {
  const { error } = await supabase.from('deleted_health_records').delete().eq('id', deletedRecordId);
  if (error) throw error;
};

export const findDuplicateHealthRecords = async (): Promise<DuplicateRecordGroup[]> => {
  let records: any[] = [];
  const { data, error } = await supabase.from('健康記錄主表').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) {
    if (error.code === '42703') {
      const result2 = await supabase.from('健康記錄主表').select('*').order('記錄id', { ascending: false }).limit(1000);
      records = result2.data || [];
    } else throw error;
  } else records = data || [];

  const recordGroups = new Map<string, HealthRecord[]>();
  records.forEach((record) => {
    const key = `${record.院友id}_${record.記錄日期}_${record.記錄時間}`;
    if (!recordGroups.has(key)) recordGroups.set(key, []);
    recordGroups.get(key)!.push(record);
  });

  const duplicateGroups: DuplicateRecordGroup[] = [];
  recordGroups.forEach((groupRecords, key) => {
    if (groupRecords.length < 2) return;
    const valueGroups = new Map<string, HealthRecord[]>();
    groupRecords.forEach((record) => {
      const values = [];
      if (record.血壓收縮壓 != null) values.push(`bp_sys:${record.血壓收縮壓}`);
      if (record.血壓舒張壓 != null) values.push(`bp_dia:${record.血壓舒張壓}`);
      if (record.脈搏 != null) values.push(`pulse:${record.脈搏}`);
      if (record.體溫 != null) values.push(`temp:${record.體溫}`);
      if (record.呼吸頻率 != null) values.push(`resp:${record.呼吸頻率}`);
      if (record.血含氧量 != null) values.push(`spo2:${record.血含氧量}`);
      if (record.血糖值 != null) values.push(`glucose:${record.血糖值}`);
      if (record.體重 != null) values.push(`weight:${record.體重}`);
      const valueKey = values.sort().join('|') || 'no_values';
      if (!valueGroups.has(valueKey)) valueGroups.set(valueKey, []);
      valueGroups.get(valueKey)!.push(record);
    });
    valueGroups.forEach((valueGroupRecords, valueKey) => {
      if (valueGroupRecords.length >= 2) {
        const sortedRecords = valueGroupRecords.sort((a, b) => (a.created_at && b.created_at) ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : a.記錄id - b.記錄id);
        duplicateGroups.push({ key: `${key}_${valueKey}`, records: sortedRecords, keepRecord: sortedRecords[0], duplicateRecords: sortedRecords.slice(1) });
      }
    });
  });
  return duplicateGroups;
};

export const batchMoveDuplicatesToRecycleBin = async (duplicateRecordIds: number[], deletedBy?: string): Promise<void> => {
  for (const recordId of duplicateRecordIds) {
    const { data: record, error } = await supabase.from('健康記錄主表').select('*').eq('記錄id', recordId).maybeSingle();
    if (record) await moveHealthRecordToRecycleBin(record, deletedBy, '記錄去重');
  }
};

export const createBatchHealthRecords = async (records: Omit<HealthRecord, '記錄id'>[]): Promise<HealthRecord[]> => {
  const { data, error } = await supabase.from('健康記錄主表').insert(records).select();
  if (error) { console.error('Error creating batch health records:', error); throw error; }
  return data || [];
};

// [修復可能性2] 核心同步功能 - 使用智能推進策略並添加詳細日誌
export const syncTaskStatus = async (taskId: string) => {
  console.log('\n🔄 [syncTaskStatus] 開始同步任務狀態（智能推進）:', taskId);

  // 使用全域定義的 CUTOFF
  const SYNC_CUTOFF_DATE = new Date(SYNC_CUTOFF_DATE_STR);

  const { data: task, error: taskError } = await supabase.from('patient_health_tasks').select('*').eq('id', taskId).single();
  if (taskError || !task) {
    console.error('❌ [syncTaskStatus] 無法找到任務:', taskId);
    return;
  }

  console.log(`  任務類型: ${task.health_record_type}`);
  console.log(`  當前 next_due_at: ${task.next_due_at}`);
  console.log(`  當前 last_completed_at: ${task.last_completed_at}`);

  const { data: latestRecord } = await supabase.from('健康記錄主表').select('記錄日期, 記錄時間, task_id').eq('task_id', taskId).order('記錄日期', { ascending: false }).order('記錄時間', { ascending: false }).limit(1).maybeSingle();

  console.log(`  查詢最新記錄: ${latestRecord ? `${latestRecord.記錄日期} ${latestRecord.記錄時間}` : '無記錄'}`);

  let updates = {};

  if (latestRecord) {
    const recordDate = new Date(latestRecord.記錄日期);
    // [修復可能性2] 如果最新記錄早於或等於分界線，則不進行同步
    if (recordDate <= SYNC_CUTOFF_DATE) {
      console.log('  ⚠️ 最新記錄早於分界線，跳過同步:', latestRecord.記錄日期);
      return;
    }
    const lastCompletedAt = new Date(`${latestRecord.記錄日期}T${latestRecord.記錄時間}`);

    // [修復可能性2] 策略2：智能推進 - 從 next_due_at 開始找第一個未完成的日期
    const { findFirstMissingDate } = await import('../utils/taskScheduler');
    const startDate = task.next_due_at ? new Date(task.next_due_at) : new Date();
    console.log(`  從 ${startDate.toISOString().split('T')[0]} 開始查找第一個未完成日期...`);

    const nextDueAt = await findFirstMissingDate(task, startDate, supabase);

    console.log(`  ✅ 找到最新記錄 (${latestRecord.記錄日期})，智能推進到: ${nextDueAt.toISOString()}`);
    updates = {
      last_completed_at: lastCompletedAt.toISOString(),
      next_due_at: nextDueAt.toISOString()
    };
    console.log('  更新內容:', updates);
  } else {
    console.log('  ⚠️ 該任務已無任何記錄，重置為初始狀態');
    const resetDate = new Date();
    resetDate.setHours(8, 0, 0, 0);
    updates = { last_completed_at: null, next_due_at: resetDate.toISOString() };
  }

  const { error: updateError } = await supabase.from('patient_health_tasks').update(updates).eq('id', taskId);
  if (updateError) {
    console.error('❌ [syncTaskStatus] 更新任務狀態失敗:', updateError);
  } else {
    console.log('✅ [syncTaskStatus] 任務狀態更新成功');
  }
};

export default null;