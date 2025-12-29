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
  start_date?: string;  // 任務開始執行日期
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

// ============================================
// 個人照顧計劃 (ICP) 類型定義
// ============================================

export type PlanType = '首月計劃' | '半年計劃' | '年度計劃';
export type ProblemCategory = '護理' | '物理治療' | '職業治療' | '言語治療' | '營養師' | '醫生' | '社工';
export type OutcomeReview = '保持現狀' | '滿意' | '部分滿意' | '需要持續改善';

export interface ProblemLibrary {
  id: string;
  code: string;
  name: string;
  category: ProblemCategory;
  description?: string;
  expected_goals: string[];
  interventions: string[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface NursingNeedItem {
  id: string;
  name: string;
  is_default: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 個案會議專業評估記錄
export interface CaseConferenceProfessional {
  category: ProblemCategory;
  assessor: string;
  assessment_date: string;
}

export interface CarePlan {
  id: string;
  patient_id: number;
  parent_plan_id?: string;
  version_number: number;
  plan_type: PlanType;
  plan_date: string;
  review_due_date?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_by?: string;
  status: 'active' | 'archived';
  archived_at?: string;
  remarks?: string;
  // 個案會議欄位
  case_conference_date?: string;
  case_conference_professionals?: CaseConferenceProfessional[];
  family_contact_date?: string;
  family_member_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CarePlanNursingNeed {
  id: string;
  care_plan_id: string;
  nursing_need_item_id: string;
  has_need: boolean;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface CarePlanProblem {
  id: string;
  care_plan_id: string;
  problem_library_id?: string;
  problem_category: ProblemCategory;
  problem_description: string;
  expected_goals: string[];
  interventions: string[];
  outcome_review?: OutcomeReview;
  problem_assessor?: string;
  outcome_assessor?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CarePlanWithDetails extends CarePlan {
  nursing_needs: (CarePlanNursingNeed & { item_name?: string })[];
  problems: CarePlanProblem[];
  problem_count: number;
}

// ============================================
// 傷口管理類型定義
// ============================================

export type WoundType = 'pressure_ulcer' | 'trauma' | 'surgical' | 'diabetic' | 'venous' | 'arterial' | 'other';
export type WoundOrigin = 'facility' | 'admission' | 'hospital_referral';
export type WoundStatus = 'active' | 'healed' | 'transferred';
export type WoundAssessmentStatus = 'untreated' | 'treating' | 'improving' | 'healed';
export type ResponsibleUnit = 'community_health' | 'cgat' | 'facility_staff' | 'other';

// 傷口主表 - 記錄每個傷口的基本資料和生命週期
export interface Wound {
  id: string;
  patient_id: number;
  wound_code: string;
  wound_name?: string;
  discovery_date: string;
  wound_location: {
    x: number;
    y: number;
    side: 'front' | 'back';
    description?: string;
  };
  wound_type: WoundType;
  wound_type_other?: string;
  wound_origin: WoundOrigin;
  responsible_unit: ResponsibleUnit;
  responsible_unit_other?: string;
  status: WoundStatus;
  healed_date?: string;
  next_assessment_due?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

// 傷口評估記錄表 - 記錄每次傷口評估的詳細資料
export interface WoundAssessment {
  id: string;
  wound_id?: string;           // 關聯到傷口主表
  patient_id: number;
  assessment_date: string;
  next_assessment_date?: string;  // 保留舊欄位以兼容
  assessor?: string;
  // 舊結構兼容
  wound_details?: any[];
  // 新結構：單傷口評估欄位
  area_length?: number;
  area_width?: number;
  area_depth?: number;
  stage?: string;
  wound_status?: WoundAssessmentStatus;
  exudate_present?: boolean;
  exudate_amount?: string;
  exudate_color?: string;
  exudate_type?: string;
  odor?: string;
  granulation?: string;
  necrosis?: string;
  infection?: string;
  temperature?: string;
  surrounding_skin_condition?: string;
  surrounding_skin_color?: string;
  cleanser?: string;
  cleanser_other?: string;
  dressings?: string[];
  dressing_other?: string;
  wound_photos?: string[];
  remarks?: string;
  status: 'active' | 'archived';
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

// 傷口及其評估記錄的組合視圖
export interface WoundWithAssessments extends Wound {
  assessments: WoundAssessment[];
  latest_assessment?: WoundAssessment;
  assessment_count: number;
  is_overdue: boolean;
  days_until_due?: number;
}

// 病人及其傷口的組合視圖
export interface PatientWithWounds {
  patient_id: number;
  bed_number: string;
  patient_name: string;
  wounds: WoundWithAssessments[];
  active_wound_count: number;
  healed_wound_count: number;
  overdue_assessment_count: number;
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
  notes?: string;
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
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface HygieneRecord {
  id: string;
  patient_id: number;
  record_date: string;
  time_slot: string; // 固定為 'daily'
  // 護理項目
  has_bath: boolean;
  has_face_wash: boolean;
  has_shave: boolean;
  has_oral_care: boolean;
  has_denture_care: boolean;
  has_nail_trim: boolean;
  has_bedding_change: boolean;
  has_sheet_pillow_change: boolean;
  has_cup_wash: boolean;
  has_bedside_cabinet: boolean;
  has_wardrobe: boolean;
  // 大便相關
  bowel_count: number | null;
  bowel_amount: string | null;
  bowel_consistency: string | null;
  bowel_medication: string | null;
  // 標準欄位
  status_notes?: string;
  notes?: string;
  recorder: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// 攝入項目類型定義
// ============================================
export type IntakeCategory = 'meal' | 'beverage' | 'other' | 'tube_feeding';
export type IntakeUnit = 'portion' | 'ml' | 'piece';

export interface IntakeItem {
  id: string;
  record_id: string;
  category: IntakeCategory;
  item_type: string; // 早餐/午餐/水/湯/餅乾/Isocal 等
  amount: string; // 顯示用: '1/2', '200ml', '3塊'
  amount_numeric?: number; // 計算用數值
  volume?: number; // 飲品容量(ml)
  unit: IntakeUnit;
  created_at: string;
}

// ============================================
// 排出項目類型定義
// ============================================
export type OutputCategory = 'urine' | 'gastric';

export interface OutputItem {
  id: string;
  record_id: string;
  category: OutputCategory;
  color?: string; // 透明/白/黃/啡/紅/綠/紫/無
  ph_value?: number; // pH值 (僅胃液)
  amount_ml: number; // 容量(ml)
  created_at: string;
}

// ============================================
// 出入量主記錄 (新設計 - 與 mobile 端同步)
// ============================================
export interface IntakeOutputRecord {
  id: string;
  patient_id: number;
  record_date: string;
  hour_slot: number; // 0-23
  time_slot: string; // '08:00', '12:00' 等
  recorder: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // 關聯數據 (可選，用於聯表查詢)
  intake_items?: IntakeItem[];
  output_items?: OutputItem[];
}

export interface PatientCareTab {
  id: string;
  patient_id: number;
  tab_type: 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training' | 'hygiene';
  is_manually_added: boolean;
  is_hidden: boolean;
  last_activated_at?: string;
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

export interface PatientContact {
  id: string;
  院友id: number;
  聯絡人姓名: string;
  關係?: string;
  聯絡電話?: string;
  電郵?: string;
  地址?: string;
  備註?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
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

// ============================================
// 傷口主表 CRUD 操作
// ============================================

// 取得所有傷口
export const getWounds = async (statusFilter?: WoundStatus | 'all'): Promise<Wound[]> => {
  try {
    let query = supabase.from('wounds').select('*');

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order('discovery_date', { ascending: false });
    if (error) {
      // 表不存在時返回空陣列
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('wounds 表尚未創建，請執行數據庫遷移');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err: any) {
    console.warn('獲取傷口數據失敗:', err?.message);
    return [];
  }
};

// 取得特定病人的所有傷口
export const getPatientWounds = async (patientId: number, statusFilter?: WoundStatus | 'all'): Promise<Wound[]> => {
  try {
    let query = supabase.from('wounds').select('*').eq('patient_id', patientId);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order('discovery_date', { ascending: false });
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    return [];
  }
};

// 取得傷口及其評估記錄
export const getWoundWithAssessments = async (woundId: string): Promise<WoundWithAssessments | null> => {
  const { data: wound, error: woundError } = await supabase
    .from('wounds')
    .select('*')
    .eq('id', woundId)
    .single();
    
  if (woundError) throw woundError;
  if (!wound) return null;
  
  const { data: assessments, error: assessmentsError } = await supabase
    .from('wound_assessments')
    .select('*')
    .eq('wound_id', woundId)
    .order('assessment_date', { ascending: false });
    
  if (assessmentsError) throw assessmentsError;
  
  const today = new Date();
  const dueDate = wound.next_assessment_due ? new Date(wound.next_assessment_due) : null;
  
  return {
    ...wound,
    assessments: assessments || [],
    latest_assessment: assessments?.[0],
    assessment_count: assessments?.length || 0,
    is_overdue: wound.status === 'active' && dueDate ? dueDate < today : false,
    days_until_due: dueDate && wound.status === 'active' 
      ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : undefined
  };
};

// 取得所有病人及其傷口的組合視圖
export const getPatientsWithWounds = async (): Promise<PatientWithWounds[]> => {
  try {
    // 取得所有傷口
    const { data: wounds, error: woundsError } = await supabase
      .from('wounds')
      .select('*')
      .order('discovery_date', { ascending: false });
      
    if (woundsError) {
      // 表不存在時返回空陣列
      if (woundsError.code === '42P01' || woundsError.message?.includes('does not exist')) {
        console.warn('wounds 表尚未創建，請執行數據庫遷移');
        return [];
      }
      throw woundsError;
    }
    
    // 如果沒有傷口數據，直接返回空陣列
    if (!wounds || wounds.length === 0) {
      return [];
    }
    
    // 取得所有評估記錄
    const { data: assessments, error: assessmentsError } = await supabase
      .from('wound_assessments')
      .select('*')
      .not('wound_id', 'is', null)
      .order('assessment_date', { ascending: false });
      
    if (assessmentsError && assessmentsError.code !== '42P01') {
      throw assessmentsError;
    }
    
    // 取得所有在住病人
    const { data: patients, error: patientsError } = await supabase
      .from('院友主表')
      .select('院友id, 床號, 中文姓氏, 中文名字')
      .eq('在住狀態', '在住');
      
    if (patientsError) throw patientsError;
    
    const today = new Date();
    
    // 組合數據
    const result: PatientWithWounds[] = (patients || []).map(patient => {
      const patientWounds = (wounds || []).filter(w => w.patient_id === patient.院友id);
      const woundsWithAssessments: WoundWithAssessments[] = patientWounds.map(wound => {
        const woundAssessments = (assessments || []).filter(a => a.wound_id === wound.id);
        const dueDate = wound.next_assessment_due ? new Date(wound.next_assessment_due) : null;
        
        return {
          ...wound,
          assessments: woundAssessments,
          latest_assessment: woundAssessments[0],
          assessment_count: woundAssessments.length,
          is_overdue: wound.status === 'active' && dueDate ? dueDate < today : false,
          days_until_due: dueDate && wound.status === 'active'
            ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : undefined
        };
      });
      
      return {
        patient_id: patient.院友id,
        bed_number: patient.床號,
        patient_name: `${patient.中文姓氏}${patient.中文名字}`,
        wounds: woundsWithAssessments,
        active_wound_count: woundsWithAssessments.filter(w => w.status === 'active').length,
        healed_wound_count: woundsWithAssessments.filter(w => w.status === 'healed').length,
        overdue_assessment_count: woundsWithAssessments.filter(w => w.is_overdue).length
      };
    });
    
    return result.filter(p => p.wounds.length > 0);
  } catch (err: any) {
    console.warn('獲取病人傷口數據失敗:', err?.message);
    return [];
  }
};

// 生成傷口編號
export const generateWoundCode = async (patientId: number): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('wounds')
      .select('wound_code')
      .eq('patient_id', patientId)
      .order('wound_code', { ascending: false })
      .limit(1);
      
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('wounds 表尚未創建');
        return 'W001';
      }
      throw error;
    }
    
    let nextNum = 1;
    if (data && data.length > 0) {
      const lastCode = data[0].wound_code;
      const match = lastCode.match(/W(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    
    return `W${nextNum.toString().padStart(3, '0')}`;
  } catch (err: any) {
    console.warn('生成傷口編號失敗:', err?.message);
    return 'W001';
  }
};

// 創建傷口
export const createWound = async (wound: Omit<Wound, 'id' | 'created_at' | 'updated_at'>): Promise<Wound | null> => {
  try {
    const { data, error } = await supabase
      .from('wounds')
      .insert([wound])
      .select()
      .single();
      
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('wounds 表尚未創建，請執行數據庫遷移');
        return null;
      }
      throw error;
    }
    return data;
  } catch (err: any) {
    console.error('創建傷口失敗:', err?.message);
    throw err;
  }
};

// 更新傷口
export const updateWound = async (wound: Partial<Wound> & { id: string }): Promise<Wound | null> => {
  try {
    const { id, created_at, updated_at, ...updateData } = wound as any;
    const { data, error } = await supabase
      .from('wounds')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('wounds 表尚未創建，請執行數據庫遷移');
        return null;
      }
      throw error;
    }
    return data;
  } catch (err: any) {
    console.error('更新傷口失敗:', err?.message);
    throw err;
  }
};

// 刪除傷口（同時刪除相關評估記錄）
export const deleteWound = async (woundId: string): Promise<boolean> => {
  try {
    // 先刪除相關評估記錄
    const { error: assessmentError } = await supabase
      .from('wound_assessments')
      .delete()
      .eq('wound_id', woundId);
      
    if (assessmentError && assessmentError.code !== '42P01') {
      throw assessmentError;
    }
    
    // 再刪除傷口
    const { error } = await supabase
      .from('wounds')
      .delete()
      .eq('id', woundId);
      
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('wounds 表尚未創建，請執行數據庫遷移');
        return false;
      }
      throw error;
    }
    return true;
  } catch (err: any) {
    console.error('刪除傷口失敗:', err?.message);
    throw err;
  }
};

// 標記傷口為痊癒
export const healWound = async (woundId: string, healedDate?: string): Promise<Wound | null> => {
  try {
    const { data, error } = await supabase
      .from('wounds')
      .update({
        status: 'healed',
        healed_date: healedDate || new Date().toISOString().split('T')[0],
        next_assessment_due: null
      })
      .eq('id', woundId)
      .select()
      .single();
      
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('wounds 表尚未創建，請執行數據庫遷移');
        return null;
      }
      throw error;
    }
    return data;
  } catch (err: any) {
    console.error('標記傷口痊癒失敗:', err?.message);
    throw err;
  }
};

// 取得需要評估的傷口（逾期或即將到期）
export const getWoundsNeedingAssessment = async (): Promise<Wound[]> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('wounds')
      .select('*')
      .eq('status', 'active')
      .not('next_assessment_due', 'is', null)
      .lte('next_assessment_due', threeDaysLaterStr)
      .order('next_assessment_due', { ascending: true });
      
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('wounds 表尚未創建');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err: any) {
    console.warn('獲取需要評估的傷口失敗:', err?.message);
    return [];
  }
};

// ============================================
// 傷口評估記錄 CRUD 操作（更新版）
// ============================================

export const getWoundAssessments = async (statusFilter?: 'active' | 'archived' | 'all'): Promise<WoundAssessment[]> => {
  let query = supabase.from('wound_assessments').select('*');

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query.order('assessment_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

// 取得特定傷口的所有評估記錄
export const getWoundAssessmentsByWound = async (woundId: string): Promise<WoundAssessment[]> => {
  const { data, error } = await supabase
    .from('wound_assessments')
    .select('*')
    .eq('wound_id', woundId)
    .order('assessment_date', { ascending: false });
    
  if (error) throw error;
  return data || [];
};

// 創建傷口評估記錄（新版：關聯到特定傷口）
export const createWoundAssessmentForWound = async (
  assessment: Omit<WoundAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>
): Promise<WoundAssessment> => {
  const {
    wound_id,
    patient_id,
    assessment_date,
    assessor,
    area_length,
    area_width,
    area_depth,
    stage,
    wound_status,
    exudate_present,
    exudate_amount,
    exudate_color,
    exudate_type,
    odor,
    granulation,
    necrosis,
    infection,
    temperature,
    surrounding_skin_condition,
    surrounding_skin_color,
    cleanser,
    cleanser_other,
    dressings,
    dressing_other,
    wound_photos,
    remarks
  } = assessment;

  // 插入評估記錄
  const { data: assessmentRecord, error: assessmentError } = await supabase
    .from('wound_assessments')
    .insert([{
      wound_id,
      patient_id,
      assessment_date,
      assessor,
      area_length,
      area_width,
      area_depth,
      stage,
      wound_status,
      exudate_present,
      exudate_amount,
      exudate_color,
      exudate_type,
      odor,
      granulation,
      necrosis,
      infection,
      temperature,
      surrounding_skin_condition,
      surrounding_skin_color,
      cleanser,
      cleanser_other,
      dressings: dressings || [],
      dressing_other,
      wound_photos: wound_photos || [],
      remarks,
      status: 'active'
    }])
    .select()
    .single();
    
  if (assessmentError) throw assessmentError;
  
  // 更新傷口的下次評估日期
  if (wound_id) {
    const nextDueDate = new Date(assessment_date);
    nextDueDate.setDate(nextDueDate.getDate() + 7);
    
    const woundUpdate: any = {
      next_assessment_due: nextDueDate.toISOString().split('T')[0]
    };
    
    // 如果評估狀態為痊癒，更新傷口狀態
    if (wound_status === 'healed') {
      woundUpdate.status = 'healed';
      woundUpdate.healed_date = assessment_date;
      woundUpdate.next_assessment_due = null;
    }
    
    await supabase
      .from('wounds')
      .update(woundUpdate)
      .eq('id', wound_id);
  }
  
  return assessmentRecord;
};

// 舊版創建傷口評估（保持向後兼容）
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
  // 將 events 從 episode 物件中分離出來
  const { events, ...episodeData } = episode;
  
  // 先創建住院事件記錄
  const { data, error } = await supabase.from('hospital_episodes').insert([episodeData]).select().single();
  if (error) throw error;
  
  // 如果有事件資料，則創建事件記錄
  if (events && events.length > 0) {
    const eventsToInsert = events.map((event: any) => ({
      ...event,
      episode_id: data.id
    }));
    
    const { error: eventsError } = await supabase.from('episode_events').insert(eventsToInsert);
    if (eventsError) throw eventsError;
  }
  
  return data;
};

export const updateHospitalEpisode = async (episode: any): Promise<any> => {
  // 將 events 從 episode 物件中分離出來
  const { events, ...episodeData } = episode;
  
  // 更新住院事件記錄
  const { data, error } = await supabase.from('hospital_episodes').update(episodeData).eq('id', episode.id).select().single();
  if (error) throw error;
  
  // 處理事件更新：先刪除舊事件，再插入新事件
  if (events !== undefined) {
    // 刪除現有事件
    await deleteEpisodeEventsByEpisodeId(episode.id);
    
    // 如果有新事件資料，則創建事件記錄
    if (events.length > 0) {
      const eventsToInsert = events.map((event: any) => {
        const { id, ...eventData } = event;
        return {
          ...eventData,
          episode_id: episode.id
        };
      });
      
      const { error: eventsError } = await supabase.from('episode_events').insert(eventsToInsert);
      if (eventsError) throw eventsError;
    }
  }
  
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

// Hygiene Records
export const getHygieneRecordsInDateRange = async (startDate: string, endDate: string): Promise<HygieneRecord[]> => {
  const { data, error } = await supabase.from('hygiene_records').select('*').gte('record_date', startDate).lte('record_date', endDate).order('record_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createHygieneRecord = async (record: Omit<HygieneRecord, 'id' | 'created_at' | 'updated_at'>): Promise<HygieneRecord> => {
  const { data, error } = await supabase.from('hygiene_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updateHygieneRecord = async (id: string, updates: Partial<Omit<HygieneRecord, 'id' | 'created_at' | 'updated_at'>>): Promise<HygieneRecord | null> => {
  const { data, error } = await supabase.from('hygiene_records').update(updates).eq('id', id).select();
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
};

export const deleteHygieneRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('hygiene_records').delete().eq('id', recordId);
  if (error) throw error;
};

// Intake/Output Records (新設計 - 與 mobile 端同步)
export const getIntakeOutputRecords = async (): Promise<IntakeOutputRecord[]> => {
  const { data, error } = await supabase
    .from('intake_output_records')
    .select('*')
    .order('record_date', { ascending: false })
    .order('hour_slot', { ascending: true });
  if (error) throw error;
  
  // 為每個記錄加載 intake_items 和 output_items
  const records = data || [];
  for (const record of records) {
    const { data: intakeItems, error: intakeError } = await supabase
      .from('intake_items')
      .select('*')
      .eq('record_id', record.id)
      .order('created_at', { ascending: true });
    
    const { data: outputItems, error: outputError } = await supabase
      .from('output_items')
      .select('*')
      .eq('record_id', record.id)
      .order('created_at', { ascending: true });
    
    record.intake_items = intakeItems || [];
    record.output_items = outputItems || [];
  }
  
  return records;
};

export const createIntakeOutputRecord = async (
  record: Omit<IntakeOutputRecord, 'id' | 'created_at' | 'updated_at' | 'intake_items' | 'output_items'>
): Promise<IntakeOutputRecord> => {
  const { data, error } = await supabase.from('intake_output_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updateIntakeOutputRecord = async (
  id: string, 
  updates: Partial<Omit<IntakeOutputRecord, 'id' | 'created_at' | 'updated_at' | 'intake_items' | 'output_items'>>
): Promise<IntakeOutputRecord | null> => {
  const { data, error } = await supabase.from('intake_output_records').update(updates).eq('id', id).select();
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
};

export const deleteIntakeOutputRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('intake_output_records').delete().eq('id', recordId);
  if (error) throw error;
};

// ============================================
// 攝入項目 CRUD 操作
// ============================================
export const createIntakeItem = async (
  item: Omit<IntakeItem, 'id' | 'created_at'>
): Promise<IntakeItem> => {
  const { data, error } = await supabase
    .from('intake_items')
    .insert([item])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const createIntakeItems = async (
  items: Omit<IntakeItem, 'id' | 'created_at'>[]
): Promise<IntakeItem[]> => {
  if (items.length === 0) return [];
  const { data, error } = await supabase
    .from('intake_items')
    .insert(items)
    .select();
  if (error) throw error;
  return data || [];
};

export const getIntakeItems = async (recordId: string): Promise<IntakeItem[]> => {
  const { data, error } = await supabase
    .from('intake_items')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const deleteIntakeItem = async (itemId: string): Promise<void> => {
  const { error } = await supabase
    .from('intake_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
};

// ============================================
// 排出項目 CRUD 操作
// ============================================
export const createOutputItem = async (
  item: Omit<OutputItem, 'id' | 'created_at'>
): Promise<OutputItem> => {
  const { data, error } = await supabase
    .from('output_items')
    .insert([item])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const createOutputItems = async (
  items: Omit<OutputItem, 'id' | 'created_at'>[]
): Promise<OutputItem[]> => {
  if (items.length === 0) return [];
  const { data, error } = await supabase
    .from('output_items')
    .insert(items)
    .select();
  if (error) throw error;
  return data || [];
};

export const getOutputItems = async (recordId: string): Promise<OutputItem[]> => {
  const { data, error } = await supabase
    .from('output_items')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const deleteOutputItem = async (itemId: string): Promise<void> => {
  const { error } = await supabase
    .from('output_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
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
  const SYNC_CUTOFF_DATE = new Date(SYNC_CUTOFF_DATE_STR);

  const { data: task, error: taskError } = await supabase.from('patient_health_tasks').select('*').eq('id', taskId).single();
  if (taskError || !task) {
    return;
  }

  const { data: latestRecord } = await supabase.from('健康記錄主表').select('記錄日期, 記錄時間, task_id').eq('task_id', taskId).order('記錄日期', { ascending: false }).order('記錄時間', { ascending: false }).limit(1).maybeSingle();

  let updates = {};

  if (latestRecord) {
    const recordDate = new Date(latestRecord.記錄日期);
    if (recordDate <= SYNC_CUTOFF_DATE) {
      return;
    }
    const lastCompletedAt = new Date(`${latestRecord.記錄日期}T${latestRecord.記錄時間}`);

    const { findFirstMissingDate } = await import('../utils/taskScheduler');
    const startDate = new Date(latestRecord.記錄日期);
    startDate.setDate(startDate.getDate() - 14);
    startDate.setHours(0, 0, 0, 0);
    
    if (startDate < SYNC_CUTOFF_DATE) {
      startDate.setTime(SYNC_CUTOFF_DATE.getTime());
    }

    const nextDueAt = await findFirstMissingDate(task, startDate, supabase);

    updates = {
      last_completed_at: lastCompletedAt.toISOString(),
      next_due_at: nextDueAt.toISOString(),
      status: (nextDueAt <= new Date()) ? 'overdue' : 'pending'
    };
  } else {
    updates = {
      last_completed_at: null,
      next_due_at: task.next_due_at,
      status: (new Date(task.next_due_at) <= new Date()) ? 'overdue' : 'pending'
    };
  }

  const { error: updateError } = await supabase.from('patient_health_tasks').update(updates).eq('id', taskId);
  if (updateError) {
    console.error('[syncTaskStatus] Error updating task:', updateError);
  }
};

// ==================== Patient Contacts ====================

export const getPatientContacts = async (patientId: number): Promise<PatientContact[]> => {
  const { data, error } = await supabase
    .from('patient_contacts')
    .select('*')
    .eq('院友id', patientId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createPatientContact = async (
  contact: Omit<PatientContact, 'id' | 'created_at' | 'updated_at'>
): Promise<PatientContact> => {
  const { data, error } = await supabase
    .from('patient_contacts')
    .insert([contact])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updatePatientContact = async (
  contact: PatientContact
): Promise<PatientContact> => {
  const { data, error } = await supabase
    .from('patient_contacts')
    .update(contact)
    .eq('id', contact.id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deletePatientContact = async (contactId: string): Promise<void> => {
  const { error } = await supabase
    .from('patient_contacts')
    .delete()
    .eq('id', contactId);
  if (error) throw error;
};

export const setPrimaryContact = async (
  patientId: number,
  contactId: string
): Promise<void> => {
  // 先將該院友的所有聯絡人設為非主要
  await supabase
    .from('patient_contacts')
    .update({ is_primary: false })
    .eq('院友id', patientId);

  // 再將指定聯絡人設為主要
  const { error } = await supabase
    .from('patient_contacts')
    .update({ is_primary: true })
    .eq('id', contactId);
  
  if (error) throw error;
};

// ==================== 個人照顧計劃 (ICP) ====================

// 獲取所有問題庫項目
export const getAllProblemLibrary = async (): Promise<ProblemLibrary[]> => {
  const { data, error } = await supabase
    .from('problem_library')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('code');
  if (error) throw error;
  return data || [];
};

// 按專業獲取問題庫
export const getProblemLibraryByCategory = async (category: ProblemCategory): Promise<ProblemLibrary[]> => {
  const { data, error } = await supabase
    .from('problem_library')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('code');
  if (error) throw error;
  return data || [];
};

// 新增問題到問題庫
export const createProblemLibrary = async (
  problem: Omit<ProblemLibrary, 'id' | 'created_at' | 'updated_at'>
): Promise<ProblemLibrary> => {
  const { data, error } = await supabase
    .from('problem_library')
    .insert([problem])
    .select()
    .single();
  if (error) throw error;
  return data;
};

// 更新問題庫項目
export const updateProblemLibrary = async (
  problem: Partial<ProblemLibrary> & { id: string }
): Promise<ProblemLibrary> => {
  const { data, error } = await supabase
    .from('problem_library')
    .update(problem)
    .eq('id', problem.id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// 刪除問題庫項目（軟刪除）
export const deleteProblemLibrary = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('problem_library')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
};

// 獲取所有護理需要項目
export const getAllNursingNeedItems = async (): Promise<NursingNeedItem[]> => {
  const { data, error } = await supabase
    .from('nursing_need_items')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  if (error) throw error;
  return data || [];
};

// 新增自訂護理需要項目
export const createNursingNeedItem = async (
  item: Omit<NursingNeedItem, 'id' | 'created_at' | 'updated_at'>
): Promise<NursingNeedItem> => {
  const { data, error } = await supabase
    .from('nursing_need_items')
    .insert([{ ...item, is_default: false }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

// 獲取所有個人照顧計劃
export const getAllCarePlans = async (): Promise<CarePlan[]> => {
  const { data, error } = await supabase
    .from('care_plans')
    .select('*')
    .order('plan_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

// 獲取院友的所有個人照顧計劃
export const getPatientCarePlans = async (patientId: number): Promise<CarePlan[]> => {
  const { data, error } = await supabase
    .from('care_plans')
    .select('*')
    .eq('patient_id', patientId)
    .order('plan_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

// 獲取計劃的歷史版本鏈
export const getCarePlanHistory = async (planId: string): Promise<CarePlan[]> => {
  // 先取得當前計劃
  const { data: currentPlan, error: currentError } = await supabase
    .from('care_plans')
    .select('*')
    .eq('id', planId)
    .single();
  if (currentError) throw currentError;
  
  // 找出同一院友的所有計劃，按版本號排序
  const { data, error } = await supabase
    .from('care_plans')
    .select('*')
    .eq('patient_id', currentPlan.patient_id)
    .order('version_number', { ascending: true });
  if (error) throw error;
  return data || [];
};

// 獲取單一計劃及其明細
export const getCarePlanWithDetails = async (planId: string): Promise<CarePlanWithDetails | null> => {
  // 獲取計劃主表
  const { data: plan, error: planError } = await supabase
    .from('care_plans')
    .select('*')
    .eq('id', planId)
    .single();
  if (planError) throw planError;
  if (!plan) return null;

  // 獲取護理需要
  const { data: nursingNeeds, error: nnError } = await supabase
    .from('care_plan_nursing_needs')
    .select(`
      *,
      nursing_need_items (name)
    `)
    .eq('care_plan_id', planId);
  if (nnError) throw nnError;

  // 獲取問題明細
  const { data: problems, error: probError } = await supabase
    .from('care_plan_problems')
    .select('*')
    .eq('care_plan_id', planId)
    .order('display_order');
  if (probError) throw probError;

  return {
    ...plan,
    nursing_needs: (nursingNeeds || []).map((nn: any) => ({
      ...nn,
      item_name: nn.nursing_need_items?.name
    })),
    problems: problems || [],
    problem_count: problems?.length || 0
  };
};

// 創建新的個人照顧計劃
export const createCarePlan = async (
  plan: Omit<CarePlan, 'id' | 'created_at' | 'updated_at' | 'review_due_date'>,
  nursingNeeds?: { nursing_need_item_id: string; has_need: boolean; remarks?: string }[],
  problems?: Omit<CarePlanProblem, 'id' | 'care_plan_id' | 'created_at' | 'updated_at'>[]
): Promise<CarePlan> => {
  // 創建計劃主表
  const { data: newPlan, error: planError } = await supabase
    .from('care_plans')
    .insert([plan])
    .select()
    .single();
  if (planError) throw planError;

  // 創建護理需要記錄
  if (nursingNeeds && nursingNeeds.length > 0) {
    const nursingNeedRecords = nursingNeeds.map(nn => ({
      care_plan_id: newPlan.id,
      ...nn
    }));
    const { error: nnError } = await supabase
      .from('care_plan_nursing_needs')
      .insert(nursingNeedRecords);
    if (nnError) throw nnError;
  }

  // 創建問題記錄
  if (problems && problems.length > 0) {
    const problemRecords = problems.map((p, index) => ({
      care_plan_id: newPlan.id,
      ...p,
      display_order: index
    }));
    const { error: probError } = await supabase
      .from('care_plan_problems')
      .insert(problemRecords);
    if (probError) throw probError;
  }

  return newPlan;
};

// 更新個人照顧計劃
export const updateCarePlan = async (
  planId: string,
  plan: Partial<CarePlan>,
  nursingNeeds?: { nursing_need_item_id: string; has_need: boolean; remarks?: string }[],
  problems?: Omit<CarePlanProblem, 'id' | 'care_plan_id' | 'created_at' | 'updated_at'>[]
): Promise<CarePlan> => {
  // 更新計劃主表
  const { data: updatedPlan, error: planError } = await supabase
    .from('care_plans')
    .update(plan)
    .eq('id', planId)
    .select()
    .single();
  if (planError) throw planError;

  // 更新護理需要（先刪後插）
  if (nursingNeeds !== undefined) {
    await supabase.from('care_plan_nursing_needs').delete().eq('care_plan_id', planId);
    if (nursingNeeds.length > 0) {
      const nursingNeedRecords = nursingNeeds.map(nn => ({
        care_plan_id: planId,
        ...nn
      }));
      const { error: nnError } = await supabase
        .from('care_plan_nursing_needs')
        .insert(nursingNeedRecords);
      if (nnError) throw nnError;
    }
  }

  // 更新問題（先刪後插）
  if (problems !== undefined) {
    await supabase.from('care_plan_problems').delete().eq('care_plan_id', planId);
    if (problems.length > 0) {
      const problemRecords = problems.map((p, index) => ({
        care_plan_id: planId,
        ...p,
        display_order: index
      }));
      const { error: probError } = await supabase
        .from('care_plan_problems')
        .insert(problemRecords);
      if (probError) throw probError;
    }
  }

  return updatedPlan;
};

// 複製計劃（用於復檢）
export const duplicateCarePlan = async (
  sourcePlanId: string,
  newPlanType: PlanType,
  newPlanDate: string,
  createdBy: string
): Promise<CarePlan> => {
  // 獲取原計劃及其明細
  const sourcePlan = await getCarePlanWithDetails(sourcePlanId);
  if (!sourcePlan) throw new Error('Source plan not found');

  // 計算新版本號
  const { data: existingPlans } = await supabase
    .from('care_plans')
    .select('version_number')
    .eq('patient_id', sourcePlan.patient_id)
    .order('version_number', { ascending: false })
    .limit(1);
  const newVersionNumber = (existingPlans?.[0]?.version_number || 0) + 1;

  // 創建新計劃
  const newPlan: Omit<CarePlan, 'id' | 'created_at' | 'updated_at' | 'review_due_date'> = {
    patient_id: sourcePlan.patient_id,
    parent_plan_id: sourcePlanId,
    version_number: newVersionNumber,
    plan_type: newPlanType,
    plan_date: newPlanDate,
    created_by: createdBy,
    status: 'active',
    remarks: `由版本 ${sourcePlan.version_number} 復檢建立`
  };

  // 複製護理需要
  const nursingNeeds = sourcePlan.nursing_needs.map(nn => ({
    nursing_need_item_id: nn.nursing_need_item_id,
    has_need: nn.has_need,
    remarks: nn.remarks
  }));

  // 複製問題（不複製成效檢討，需要重新評估）
  const problems = sourcePlan.problems.map(p => ({
    problem_library_id: p.problem_library_id,
    problem_category: p.problem_category,
    problem_description: p.problem_description,
    expected_goals: p.expected_goals,
    interventions: p.interventions,
    outcome_review: undefined,
    problem_assessor: p.problem_assessor,
    outcome_assessor: undefined,
    display_order: p.display_order
  }));

  // 標記原計劃為已復檢
  await supabase
    .from('care_plans')
    .update({ 
      reviewed_at: new Date().toISOString(),
      reviewed_by: createdBy
    })
    .eq('id', sourcePlanId);

  return createCarePlan(newPlan, nursingNeeds, problems as any);
};

// 封存計劃
export const archiveCarePlan = async (planId: string): Promise<void> => {
  const { error } = await supabase
    .from('care_plans')
    .update({ 
      status: 'archived',
      archived_at: new Date().toISOString()
    })
    .eq('id', planId);
  if (error) throw error;
};

// 刪除計劃
export const deleteCarePlan = async (planId: string): Promise<void> => {
  const { error } = await supabase
    .from('care_plans')
    .delete()
    .eq('id', planId);
  if (error) throw error;
};

// 判斷院友是否需要首月計劃
export const checkFirstMonthPlanRequired = async (patientId: number, admissionDate: string): Promise<boolean> => {
  const admission = new Date(admissionDate);
  const deadline = new Date(admission);
  deadline.setDate(deadline.getDate() + 30);
  
  // 檢查是否已有首月計劃
  const { data } = await supabase
    .from('care_plans')
    .select('id')
    .eq('patient_id', patientId)
    .eq('plan_type', '首月計劃')
    .limit(1);
  
  const hasFirstMonthPlan = (data?.length || 0) > 0;
  const isWithinDeadline = new Date() <= deadline;
  
  return !hasFirstMonthPlan && isWithinDeadline;
};

export default null;