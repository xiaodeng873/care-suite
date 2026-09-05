import { supabase } from './supabase';
import { softDeleteRecord } from './recycleBin';
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
  身份證相片?: string;
  藥物敏感?: string[];
  不良藥物反應?: string[];
  感染控制?: string[];
  入住日期?: string;
  退住日期?: string;
  護理等級?: '全護理' | '半護理' | '自理';
  入住類型?: '私位' | '買位' | '院舍卷級別0' | '院舍卷級別1-7' | '暫住';
  社會福利?: { type: string; subtype?: string };
  公務員?: '公務員/家屬' | '醫管局員工/家屬';
  在住狀態?: '在住' | '待入住' | '已退住';
  station_id?: string;
  bed_id?: string;
  last_station_id?: string;
  last_bed_id?: string;
  is_hospitalized?: boolean;
  discharge_reason?: '死亡' | '回家' | '留醫' | '轉往其他機構';
  death_date?: string;
  transfer_facility_name?: string;
  needs_medication_crushing?: boolean;
  qr_code_id?: string; // 院友專屬二維碼 ID
  // 床位調動印記欄位
  original_bed_id?: string;
  original_bed_number?: string; // 去正規化原床位號，供顯示/列印時直接使用
  original_station_id?: string;
  bed_transfer_type?: 'routine' | 'temporary' | null;
  temporary_transfer_started_at?: string;
  // 院友個人及健康記錄（P1/P2）擴充欄位
  通訊電話?: string;
  通訊地址?: string;
  教育程度?: string;
  從前主要職業?: string;
  宗教信仰?: string;
  婚姻狀況?: string;
  首次記錄職員姓名?: string;
  首次記錄職級?: string;
  首次記錄簽署?: string;
  首次記錄日期?: string;
  social_status_json?: Record<string, any>;
  medical_history_json?: Record<string, any>;
  vaccination_records_json?: Record<string, any>;
  medical_services_json?: Record<string, any>;
  nursing_assessment_json?: Record<string, any>;
}
export interface Station {
  id: string;
  name: string;
  description?: string;
  code?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}
export interface Room {
  id: string;
  station_id: string;
  room_number: string;
  description?: string;
  created_at: string;
  updated_at: string;
}
export interface Bed {
  id: string;
  station_id: string;
  room_id?: string;
  bed_no?: string;
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
/** 7 種獨立生命表徵監測類型（narrow table 每 row 一種） */
export type VitalSignType = '血壓' | '脈搏' | '體溫' | '血含氧量' | '呼吸' | '血糖值' | '體重';

export interface HealthRecord {
  記錄id: string;          // UUID（原 SERIAL 已改為 UUID）
  院友id: number;
  任務id?: string;          // FK → patient_health_tasks.id
  記錄日期: string;
  記錄時間: string;
  監測類型: VitalSignType;  // 每 row 只存一種量度
  數值: number;             // 主要數值（收縮壓 / 體溫 / 血糖…）
  數值_副?: number;          // 僅血壓使用（舒張壓），血壓必須同時提供
  備註?: string;
  記錄人員?: string;
  建立時間?: string;
}

/** @deprecated 回收筒已廢棄（deleted_health_records 表已移除），保留型別供上游 Context 編譯相容 */
export interface DeletedHealthRecord {
  id: string;
  original_record_id: string;
  院友id: number;
  記錄日期: string;
  記錄時間: string;
  監測類型: VitalSignType;
  數值: number;
  數值_副?: number;
  備註?: string;
  記錄人員?: string;
  建立時間?: string;
  deleted_at: string;
  deleted_by?: string;
  deletion_reason: string;
}

/** @deprecated narrow table 無需去重，保留型別供上游編譯相容 */
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
export type MealCombinationType = '正飯+正餸' | '正飯+碎餸' | '正飯+糊餸' | '軟飯+正餸' | '軟飯+碎餸' | '軟飯+糊餸' | '糊飯+糊餸' | '不適用';
export type SpecialDietType = '糖尿餐' | '痛風餐' | '低鹽餐' | '鼻胃飼' | '雞蛋' | '素食';
export interface MealGuidance {
  id: string;
  patient_id: number;
  meal_combination: MealCombinationType;
  special_diets: SpecialDietType[];
  needs_thickener: boolean;
  needs_feeding?: boolean;
  thickener_amount?: string;
  thickener_formula?: string;
  egg_quantity?: number;
  tube_feeding_brand?: string;
  tube_feeding_daily_amount_ml?: number;
  remarks?: string;
  guidance_date?: string;
  guidance_source?: string;
  created_at: string;
  updated_at: string;
}
/** 所有任務類型（VitalSignType 為其子集，監測任務用；'生命表徵' 為四項合一的合併任務）*/
export type HealthTaskType = '生命表徵' | VitalSignType | '約束物品同意書' | '年度體檢' | '導尿管更換' | '鼻胃飼管更換' | '傷口換症' | '藥物自存同意書' | '預設醫療指示' | '氧氣喉管清洗/更換';
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
  is_terminated?: boolean;
  usage_record?: any;  // 約束物品使用紀錄 { start_date, end_date, doctor, reasons, types, observations }
  created_at: string;
  updated_at: string;
}
export interface PatientEveningCarePlan {
  id: string;
  patient_id: number;
  /** ACP 醫生簽署日期（"YYYY-MM-DD"；到期日 = 簽署日期 + 1 年） */
  acp_sign_date?: string;
  /** AMD 醫生簽署日期 */
  amd_sign_date?: string;
  /** DNACPR 醫生簽署日期 */
  dnacpr_sign_date?: string;
  notes?: string;
  is_terminated?: boolean;
  created_at: string;
  updated_at: string;
}
export type EveningCareDocumentType = 'ACP' | 'AMD' | 'DNACPR';
// 晚晴計劃文件到期日 = 醫生簽署日期 + 1 年（2/29 簽署 → 翌年 2/28）
export const getEveningCareExpiryDate = (signDate?: string): string | undefined => {
  if (!signDate) return undefined;
  const [y, m, d] = signDate.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const result = new Date(y + 1, m - 1, d);
  // 閏年 2/29：加一年後月份會移位（變 3/1），夾返做 2/28
  if (result.getMonth() !== m - 1) {
    result.setDate(0);
  }
  const fmt = (n: number) => String(n).padStart(2, '0');
  return `${result.getFullYear()}-${fmt(result.getMonth() + 1)}-${fmt(result.getDate())}`;
};
export type TubeCareType = '導尿管更換' | '鼻胃飼管更換' | '氧氣喉管清洗/更換' | '造口袋更換';
export type OxygenAction = '清洗' | '更換';
export interface PatientTubeCareRecord {
  id: string;
  patient_id: number;
  care_type: TubeCareType;
  execution_date: string;
  next_due_date?: string;
  tube_material?: string;
  tube_size?: string;
  oxygen_action?: OxygenAction;
  cycle_days?: number;
  wash_cycle_days?: number;
  replace_cycle_days?: number;
  notes?: string;
  is_terminated?: boolean;
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
  subcategory?: string;
  description?: string;
  expected_goals: string[];
  interventions: string[];
  keywords?: string[];
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
export type CarePlanStatus = '生效中' | '待檢討' | '已完成' | '待生效';
export interface CarePlan {
  id: string;
  patient_id: number;
  parent_plan_id?: string;
  version_number: number;
  plan_type: PlanType;
  plan_date: string;
  review_due_date?: string;
  review_date?: string;                // 成效檢討完成日期（檢討日期）
  reviewed_at?: string;
  reviewed_by?: string;
  created_by?: string;
  status: CarePlanStatus;
  archived_at?: string;
  remarks?: string;
  // 個案會議欄位
  case_conference_date?: string;
  case_conference_professionals?: CaseConferenceProfessional[];
  family_contact_date?: string;
  family_member_name?: string;
  family_participated?: boolean;     // 邀請家人及院友參與個人護理計劃過程，徵詢意見
  responsible_staff?: string;        // 負責職員
  special_care_needs?: string;       // 特別護理需求/其他專業意見(如有)
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
  outcome_review_details?: string;  // 成效檢討詳情（當選擇部分滿意或需要持續改善時填寫）
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
  assessment_frequency_unit?: 'daily' | 'weekly';  // 預設 daily
  assessment_frequency_value?: number;             // daily: 1-7天，weekly: 不用
  assessment_specific_days_of_week?: number[];     // weekly 時用：1=週一...6=週六,7=週日（同任務模型）
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
  infection?: string;          // 舊字串尌容
  infection_signs?: string[];   // 新：多選 ['\u7121'] | ['\u7d05','\u816b',...]
  temperature?: string;
  surrounding_skin_condition?: string;
  surrounding_skin_color?: string;
  surrounding_skin_texture?: string;  // 新： 腫脹 | 僵硬
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
  witness_found_by?: any;
  injury_location?: string;
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
  last_patrol_time?: string;
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
export interface InfectionControlRecord {
  id: string;
  patient_id: number;
  infection_type: string;
  diagnosis_date: string;
  recovery_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
export interface PatrolRound {
  id: string;
  bed_id?: string;           // 床位 ID（巡房以床位為主；空床時 patient_id 為 null）
  patient_id?: number | null; // 可空：空床巡房時無院友
  patrol_date: string;
  patrol_time: string;
  scheduled_time: string;
  recorder: string;
  co_signer?: string | null;
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
  urine_count?: number | null;
  core_count?: number | null;
  recorder: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// 尿片記錄：院友每月尿片/片芯用量估算與虛擬生成數據
export interface DiaperUsageRecord {
  id: string;
  patient_id: number;
  year: number;
  month: number; // 1-12
  monthly_diaper_estimate?: number | null;
  monthly_core_estimate?: number | null;
  daily_min_diaper?: number | null;
  daily_max_diaper?: number | null;
  daily_min_core?: number | null;
  daily_max_core?: number | null;
  // 每次換片用量範圍（生成依據：設定後逐時段在範圍內隨機，取代每日總量分配）
  per_change_min_diaper?: number | null;
  per_change_max_diaper?: number | null;
  per_change_min_core?: number | null;
  per_change_max_core?: number | null;
  // { "YYYY-MM-DD": { "7AM-11AM": { urine: number, core: number }, ... } }
  generated_data?: Record<string, Record<string, { urine: number; core: number }>>;
  created_at: string;
  updated_at: string;
}

export type FeeItemCategory = '服務' | '用品';
export type FeeItemUnit = '次' | '個' | '日' | '月' | '項' | '小時' | '療程' | '程';

export interface FeeItem {
  id: string;
  code: string;
  name_zh: string;
  category: FeeItemCategory;
  unit: FeeItemUnit;
  unit_price: number;
  is_reimbursement?: boolean;
  description?: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PatientFeeRecord {
  id: string;
  patient_id: number;
  fee_item_id?: string | null;
  record_date: string;
  start_time?: string | null;
  end_time?: string | null;
  item_name: string;
  item_category: string;
  unit: string;
  unit_price: number;
  quantity: number;
  amount: number;
  is_recurring: boolean;
  notes?: string | null;
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
  co_signer?: string | null;
  notes?: string | null;
  used_restraints?: any | null;
  created_at: string;
  updated_at: string;
}
export interface PositionChangeRecord {
  id: string;
  patient_id: number;
  change_date: string;
  scheduled_time: string;
  position: '左' | '平' | '右' | '坐';
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
  has_haircut: boolean;
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
// 院友活動記錄類型定義
// ============================================
export interface PatientActivityRecord {
  id: string;
  patient_id: number;
  record_date: string;
  // 集體活動
  has_birthday_party: boolean;
  has_festival_celebration: boolean;
  has_performance: boolean;
  // 戶外集體活動
  has_outing: boolean;
  has_visit: boolean;
  has_shopping_dimsum: boolean;
  has_games: boolean;
  // 小組活動
  has_interest_group: boolean;
  has_learning_group: boolean;
  // 個人活動
  has_self_care_training: boolean;
  has_individual_interest: boolean;
  has_individual_counseling: boolean;
  has_individual_therapy: boolean;
  has_group_visit: boolean;
  // 運動 / 健康教育講座
  has_exercise: boolean;
  has_health_talk: boolean;
  // 其他欄位
  other_activity?: string;
  notes?: string;
  is_absent: boolean;
  absence_reason?: string;
  recorder?: string;
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
  amount_numeric: number; // 計算用數值（必填，數據庫 NOT NULL）
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
  /** @deprecated 藥物類型欄位已改為 dosage_form，保留僅供向後兼容 */
  drug_type?: string;
  dosage_form?: string;
  administration_route?: string;
  unit?: string;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
export type InspectionVitalSignType = '上壓' | '下壓' | '脈搏' | '血糖值' | '呼吸' | '血含氧量' | '體溫';
export type ConditionOperatorType = 'gt' | 'lt' | 'gte' | 'lte';
export interface MedicationInspectionRule {
  id: string;
  prescription_id: string;
  vital_sign_type: InspectionVitalSignType;
  condition_operator: ConditionOperatorType;
  condition_value: number;
  action_if_met?: string;
  created_at: string;
  updated_at: string;
}
// 新增 hourly 以符合前端用法
export type MedicationFrequencyType = 'daily' | 'every_x_days' | 'every_x_weeks' | 'every_x_months' | 'weekly_days' | 'odd_even_days' | 'hourly' | 'each_time';
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
  // 前端會顯示的劑量單位
  dosage_unit?: string;
  frequency_type: MedicationFrequencyType;
  frequency_value?: number;
  specific_weekdays?: number[];
  is_odd_even_day: OddEvenDayType;
  // 每日次數（非必填）
  daily_frequency?: number;
  is_prn: boolean;
  medication_time_slots?: string[];
  // 餐次描述
  meal_timing?: string;
  notes?: string;
  preparation_method: PreparationMethodType;
  status: PrescriptionStatusType;
  medication_source: string;
  // 藥物來源專科（醫管局專科，選填）
  medication_source_specialty?: string;
  // 藥物數量（供推算預計結束日期）
  medication_quantity?: string;
  // 預計結束日期（推算值，僅在無明確 end_date 時計算）
  estimated_end_date?: string;
  // 首次登記時是否為長期藥物（true=長期，false=短期）。停服後不應改變此值
  is_long_term?: boolean;
  // 檢測規則（可能為空陣列）
  inspection_rules?: MedicationInspectionRule[];
  // 最近完成給藥的日期（自動抓取）
  last_taken_date?: string;
  // 是否在備藥及給藥記錄中顯示上次服用日期
  show_last_taken_in_record?: boolean;
  // 不可碎藥（顯示時會與藥物資料庫的同名旗標合併判斷）
  cannot_crush?: boolean;
  // 不可與中和胃酸藥同服（顯示時會與藥物資料庫的同名旗標合併判斷）
  no_antacid?: boolean;
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
  身份證號碼?: string;
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
  patient_id?: number | null;
  batch_cutoff_time?: string;
  enable_one_click_functions: boolean;
  enable_immediate_preparation_alerts: boolean;
  auto_jump_to_next_patient: boolean;
  default_preparation_lead_time: number;
  created_at?: string;
  updated_at?: string;
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
  // 藥名變更需連動所有處方（兩表無外鍵，只靠名稱對照）：先取舊名
  let oldName: string | undefined;
  if (drug.drug_name) {
    const { data: existing } = await supabase
      .from('medication_drug_database')
      .select('drug_name')
      .eq('id', drug.id)
      .single();
    oldName = existing?.drug_name;
  }
  const { data, error } = await supabase.from('medication_drug_database').update(drug).eq('id', drug.id).select().single();
  if (error) throw error;
  await cascadeDrugRenameToPrescriptions(oldName, drug.drug_name);
  return data;
};
/** 藥物改名連動：所有使用舊藥名的處方（不分有效/停服/歷史）一併改為新名 */
export const cascadeDrugRenameToPrescriptions = async (oldName?: string, newName?: string): Promise<void> => {
  if (!oldName || !newName || oldName === newName) return;
  const { error } = await supabase
    .from('new_medication_prescriptions')
    .update({ medication_name: newName })
    .eq('medication_name', oldName);
  if (error) throw error;
};
export const deleteDrug = async (id: string): Promise<void> => {
  const { error } = await supabase.from('medication_drug_database').delete().eq('id', id);
  if (error) throw error;
};
const normalizeFollowUp = (row: any): FollowUpAppointment => {
  if (!row) return row;
  return {
    ...row,
    覆診id: row.覆診id || row.id,
  };
};

export const getFollowUps = async (options?: { futureOnly?: boolean; daysBack?: number }): Promise<FollowUpAppointment[]> => {
  let query = supabase.from('覆診安排主表').select('*').order('覆診日期', { ascending: true });

  if (options?.futureOnly) {
    // 只載入今天及未來的覆診
    const today = new Date().toISOString().split('T')[0];
    query = query.gte('覆診日期', today);
  } else if (options?.daysBack) {
    // 載入過去 N 天
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
    query = query.gte('覆診日期', cutoffDate.toISOString().split('T')[0]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeFollowUp);
};
export const createFollowUp = async (appointment: Omit<FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>): Promise<FollowUpAppointment> => {
  const { data, error } = await supabase.from('覆診安排主表').insert([appointment]).select().single();
  if (error) throw error;
  return normalizeFollowUp(data);
};
export const updateFollowUp = async (appointment: FollowUpAppointment): Promise<FollowUpAppointment> => {
  const raw = appointment as any;
  const id = raw.覆診id || raw.id;
  const idColumn = raw.覆診id ? '覆診id' : 'id';
  if (!id) throw new Error('缺少覆診 ID，無法更新');

  const { 覆診id: _, id: __, ...updateData } = raw;
  // Clean up empty string values by converting them to null
  const cleanedData = { ...updateData };
  Object.keys(cleanedData).forEach(key => {
    if (cleanedData[key] === '') {
      cleanedData[key] = null;
    }
  });
  const { data, error } = await supabase.from('覆診安排主表').update(cleanedData).eq(idColumn, id).select().single();
  if (error) throw error;
  return normalizeFollowUp(data);
};
export const deleteFollowUp = async (id: string): Promise<void> => {
  // 軟刪除：搬入通用回收筒（白名單表 覆診安排主表，主鍵 覆診id）
  await softDeleteRecord('覆診安排主表', id);
};
export const getPrescriptions = async (patientId?: number): Promise<MedicationPrescription[]> => {
  const PAGE_SIZE = 1000;
  const allData: MedicationPrescription[] = [];
  let pageNo = 0;

  while (true) {
    let query = supabase.from('new_medication_prescriptions').select('*').order('created_at', { ascending: false });
    if (patientId) query = query.eq('patient_id', patientId);
    const { data, error } = await query.range(pageNo * PAGE_SIZE, (pageNo + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < PAGE_SIZE) break;
    pageNo++;
  }

  return allData;
};
export const getMedicationPrescriptions = getPrescriptions; // Alias
export const createPrescription = async (prescription: Omit<MedicationPrescription, 'id' | 'created_at' | 'updated_at'>): Promise<MedicationPrescription> => {
  const { data, error } = await supabase.from('new_medication_prescriptions').insert([prescription]).select().single();
  if (error) throw error;
  return data;
};
export const updatePrescription = async (prescription: Partial<MedicationPrescription> & { id: string }): Promise<MedicationPrescription> => {
  const { id, ...updateData } = prescription;
  // 不可為 NULL 的文字欄位：空字串需保留（轉成 null 會違反 NOT NULL 限制）
  const notNullTextColumns = new Set(['medication_source', 'medication_name']);
  // Clean up empty string values by converting them to null
  const cleanedData = { ...updateData } as Record<string, any>;
  Object.keys(cleanedData).forEach(key => {
    if (cleanedData[key] === '' && !notNullTextColumns.has(key)) {
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

// ========== CGAT 記錄（社區老人評估小組，取代舊醫院外展）==========
export interface CgatRecord {
  id: string;
  patient_id: number;
  // 個案類型
  case_type?: '新症' | '舊症';
  is_cgas: boolean;
  is_eol: boolean;
  // 藥物配發
  medication_end_date?: string;
  pharmacy_arrangement?: '個別取藥' | '集體取藥';
  is_urgent_medication: boolean;
  // 侯診原因
  reason_renew: boolean;
  reason_discharge: boolean;
  reason_sign_letter: boolean;
  reason_referral_letter: boolean;
  reason_view_report: boolean;
  report_bld: boolean;
  report_xray: boolean;
  report_ct: boolean;
  report_usg: boolean;
  report_other?: string;
  // CGAT 到診安排
  cgat_visit_date?: string;
  cgat_visit_unknown?: boolean;
  medication_pickup_arrangement?: '家人前往' | '院舍代勞' | '每次詢問';
  // 費用結算
  fee_exempted: boolean;
  consultation_fee: number;
  medication_fee_per_item: number;
  prescription_count?: number;
  treatment_weeks?: number;
  total_fee?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export const getCgatRecords = async (patientId?: number): Promise<CgatRecord[]> => {
  let query = supabase.from('cgat_records').select('*').order('created_at', { ascending: false });
  if (patientId) query = query.eq('patient_id', patientId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};
export const createCgatRecord = async (record: Omit<CgatRecord, 'id' | 'created_at' | 'updated_at'>): Promise<CgatRecord> => {
  const { data, error } = await supabase.from('cgat_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};
export const updateCgatRecord = async (record: Partial<CgatRecord> & { id: string }): Promise<CgatRecord> => {
  const { id, ...updateData } = record;
  const { data, error } = await supabase.from('cgat_records').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};
export const deleteCgatRecord = async (id: string): Promise<void> => {
  const { error } = await supabase.from('cgat_records').delete().eq('id', id);
  if (error) throw error;
};

// ========== 處方日誌（Prescription Activity Log）==========
export type PrescriptionActivityActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'replace'
  | 'batch_date_update'
  | 'restore';

export interface PrescriptionFieldChange {
  field: string;
  label: string;
  old: string;
  new: string;
}

export interface PrescriptionActivityLogEntry {
  id: string;
  patient_id: number;
  prescription_id: string | null;
  medication_name: string | null;
  action_type: PrescriptionActivityActionType;
  from_status: string | null;
  to_status: string | null;
  field_changes: PrescriptionFieldChange[];
  snapshot_before: any | null;
  snapshot_after: any | null;
  actor_user_id: string | null;
  actor_username: string | null;
  actor_name: string | null;
  actor_role: string | null;
  actor_department: string | null;
  restored_from_log_id: string | null;
  group_id: string | null;
  created_at: string;
}

export const getPrescriptionActivityLog = async (patientId: number): Promise<PrescriptionActivityLogEntry[]> => {
  const { data, error } = await supabase
    .from('prescription_activity_log')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PrescriptionActivityLogEntry[];
};

export const getPrescriptionActivityLogByPrescriptionId = async (
  prescriptionId: string
): Promise<PrescriptionActivityLogEntry[]> => {
  const { data, error } = await supabase
    .from('prescription_activity_log')
    .select('*')
    .eq('prescription_id', prescriptionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PrescriptionActivityLogEntry[];
};

export const createPrescriptionActivityLogEntry = async (
  entry: Omit<PrescriptionActivityLogEntry, 'id' | 'created_at'>
): Promise<void> => {
  const { error } = await supabase.from('prescription_activity_log').insert([entry]);
  if (error) throw error;
};

// ========== 床位調動類型與日誌（Bed Transfer）==========
export type BedTransferType = 'routine' | 'temporary';
export type BedTransferActionType =
  | 'admission'
  | 'discharge'
  | 'routine_transfer'
  | 'temporary_transfer'
  | 'swap'
  | 'return'
  | 'cancel_temporary'
  | 'original_bed_change';

export interface BedTransferLogEntry {
  id: string;
  patient_id: number | null;
  patient_name: string | null;
  from_bed_id: string | null;
  to_bed_id: string | null;
  from_bed_number: string | null;
  to_bed_number: string | null;
  action_type: BedTransferActionType;
  transfer_subtype: string | null;
  actor_user_id: string | null;
  actor_username: string | null;
  actor_name: string | null;
  actor_role: string | null;
  actor_department: string | null;
  notes: string | null;
  group_id: string | null;
  created_at: string;
}

export const getBedTransferLog = async (patientId: number): Promise<BedTransferLogEntry[]> => {
  const { data, error } = await supabase
    .from('bed_transfer_log')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as BedTransferLogEntry[];
};

export const getBedTransferLogByBedId = async (bedId: string): Promise<BedTransferLogEntry[]> => {
  const { data, error } = await supabase
    .from('bed_transfer_log')
    .select('*')
    .or(`from_bed_id.eq.${bedId},to_bed_id.eq.${bedId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as BedTransferLogEntry[];
};

export const getAllBedTransferLog = async (): Promise<BedTransferLogEntry[]> => {
  const { data, error } = await supabase
    .from('bed_transfer_log')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as BedTransferLogEntry[];
};

export const createBedTransferLogEntry = async (
  entry: Omit<BedTransferLogEntry, 'id' | 'created_at'>
): Promise<void> => {
  const { error } = await supabase.from('bed_transfer_log').insert([entry]);
  if (error) throw error;
};

export const deleteBedTransferLogEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from('bed_transfer_log').delete().eq('id', id);
  if (error) throw error;
};

// 其他基礎函式
export const getPatients = async (): Promise<Patient[]> => {
  const [{ data, error }, beds] = await Promise.all([
    supabase.from('院友主表').select('*').order('床號', { ascending: true }),
    getBeds(),
  ]);
  if (error) throw error;
  const bedMap = new Map(beds.map(b => [b.id, b.bed_number]));
  return ((data || []) as Patient[]).map(p => ({
    ...p,
    original_bed_number: p.original_bed_id ? bedMap.get(p.original_bed_id) || p.床號 : p.床號,
  }));
};

// 院友主表欄位清單（排除 院友相片、身份證相片）。兩者皆係 base64，佔全表流量約九成，
// 初始載入用 light 版本（實測 3459ms/5.1MB → 約 400ms/0.3MB），院友相片背景補載；
// 身份證相片只喺留檔時寫入，日常畫面毋需讀取，故唔補載。
// ⚠️ 院友主表 新增欄位時請同步加入此清單；dev 模式會自動對比並 console.warn。
// （PostgREST 唔支援排除欄位語法，OpenAPI spec endpoint 又只限 service_role，所以只能列明。）
const PATIENTS_LIGHT_COLUMNS = '院友id,床號,中文姓名,英文姓名,性別,身份證號碼,出生日期,藥物敏感,不良藥物反應,感染控制,入住日期,退住日期,護理等級,入住類型,社會福利,在住狀態,中文姓氏,中文名字,英文姓氏,英文名字,station_id,bed_id,is_hospitalized,discharge_reason,death_date,transfer_facility_name,needs_medication_crushing,qr_code_id,公務員,通訊電話,通訊地址,教育程度,從前主要職業,宗教信仰,婚姻狀況,首次記錄職員姓名,首次記錄職級,首次記錄簽署,首次記錄日期,social_status_json,medical_history_json,vaccination_records_json,medical_services_json,nursing_assessment_json,last_station_id,last_bed_id,original_bed_id,original_station_id,bed_transfer_type,temporary_transfer_started_at,facility_id';

// dev-only：對比遠端實際欄位同 light 清單，新增欄位漏咗更新時及早警告
let patientsLightColumnsChecked = false;
const checkPatientsLightColumnsDrift = async (): Promise<void> => {
  if (patientsLightColumnsChecked || !import.meta.env.DEV) return;
  patientsLightColumnsChecked = true;
  try {
    const { data, error } = await supabase.from('院友主表').select('*').limit(1);
    if (error || !data?.length) return;
    const expected = new Set([...PATIENTS_LIGHT_COLUMNS.split(','), '院友相片', '身份證相片']);
    const missing = Object.keys(data[0]).filter(c => !expected.has(c));
    if (missing.length) {
      console.warn(`[getPatientsLight] 院友主表 有新欄位未加入 PATIENTS_LIGHT_COLUMNS：${missing.join(', ')}，請更新 database.tsx`);
    }
  } catch {
    // 對比失敗唔影響主流程
  }
};

// 初始載入用：同 getPatients，但排除 base64 院友相片（約佔全表流量九成），
// 相片由 getPatientPhotos 背景補載。
export const getPatientsLight = async (): Promise<Patient[]> => {
  checkPatientsLightColumnsDrift();
  const [{ data, error }, beds] = await Promise.all([
    supabase.from('院友主表').select(PATIENTS_LIGHT_COLUMNS).order('床號', { ascending: true }),
    getBeds(),
  ]);
  if (error) throw error;
  const bedMap = new Map(beds.map(b => [b.id, b.bed_number]));
  return ((data || []) as unknown as Patient[]).map(p => ({
    ...p,
    original_bed_number: p.original_bed_id ? bedMap.get(p.original_bed_id) || p.床號 : p.床號,
  }));
};

// 背景補載有相片的院友：院友id → 院友相片
// 相片總量只有幾 MB，逾時主因係 app 啟動時大量重型查詢並發，DB 被擠爆；
// 所以用呢度「順序細頁 + 指數退避重試」策略，唔再並行轟炸，等啟動高峰過後自然成功。
export const getPatientPhotos = async (): Promise<Map<number, string | null>> => {
  const fetchPage = async (from: number, to: number) => {
    const { data, error } = await supabase
      .from('院友主表')
      .select('院友id, 院友相片')
      .not('院友相片', 'is', null)
      .order('院友id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    return data || [];
  };

  const isTimeout = (err: any) =>
    err?.code === '57014' || /statement timeout|timeout/i.test(err?.message || '');

  // 逐頁順序載入；每頁失敗會以退避重試，頁大小逐步縮細
  const loadPhotos = async (pageSize: number): Promise<Map<number, string | null>> => {
    const map = new Map<number, string | null>();
    let from = 0;
    for (;;) {
      const rows = await fetchPage(from, from + pageSize - 1);
      for (const p of rows as any[]) map.set(p.院友id, p.院友相片);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return map;
  };

  const attempts: Array<{ pageSize: number; delayMs: number }> = [
    { pageSize: 50, delayMs: 0 },
    { pageSize: 25, delayMs: 3000 },
    { pageSize: 10, delayMs: 8000 },
  ];

  let lastErr: any = null;
  for (const attempt of attempts) {
    try {
      if (attempt.delayMs > 0) {
        console.warn(`載入院友相片逾時，${attempt.delayMs / 1000}s 後改用每頁 ${attempt.pageSize} 筆重試`);
        await new Promise(resolve => setTimeout(resolve, attempt.delayMs));
      }
      return await loadPhotos(attempt.pageSize);
    } catch (err: any) {
      lastErr = err;
      if (!isTimeout(err)) throw err;
    }
  }
  throw lastErr;
};
export const createPatient = async (patient: Omit<Patient, '院友id'>): Promise<Patient> => {
  // 清理空字符串，將其轉換為 null
  const cleanedPatient = { ...patient } as Record<string, any>;
  Object.keys(cleanedPatient).forEach(key => {
    if (cleanedPatient[key] === '') cleanedPatient[key] = null;
  });
  // 若遠端 DB 尚未套用 20260616000000_add_civil_servant_to_patients migration，
  // '公務員' 欄位不存在，傳 null 會觸發 PGRST204；null 時直接省略即可。
  if (cleanedPatient.公務員 == null) delete cleanedPatient.公務員;
  // 若遠端 DB 尚未套用 20260724000000_add_nursing_assessment_json migration，
  // 'nursing_assessment_json' 欄位不存在，空物件時直接省略避免 PGRST204/schema cache 錯誤。
  if (cleanedPatient.nursing_assessment_json && Object.keys(cleanedPatient.nursing_assessment_json).length === 0) {
    delete cleanedPatient.nursing_assessment_json;
  }

  // 防止重複身份證號碼建立院友（跨所有在住狀態，使用正規化比對）
  if (cleanedPatient.身份證號碼) {
    const normalizeHKID = (value: string) => value.replace(/[\s()]/g, '').toUpperCase();
    const targetHKID = normalizeHKID(cleanedPatient.身份證號碼);

    const { data: existingPatients, error: checkError } = await supabase
      .from('院友主表')
      .select('院友id, 中文姓名, 床號, 在住狀態, 身份證號碼')
      .not('身份證號碼', 'is', null) as { data: Partial<Patient>[] | null; error: any };

    if (checkError) throw checkError;

    const duplicatedPatient = (existingPatients || []).find((p) => {
      const currentHKID = normalizeHKID(p.身份證號碼 || '');
      return !!currentHKID && currentHKID === targetHKID;
    });

    if (duplicatedPatient) {
      throw new Error(
        `身份證號碼已存在（${duplicatedPatient.中文姓名 || '未命名'} / ${duplicatedPatient.床號 || '無床號'} / ${duplicatedPatient.在住狀態 || '未知狀態'}），不能重複新增`
      );
    }
  }

  const { data, error } = await supabase.from('院友主表').insert(cleanedPatient).select('*').single();
  if (error) throw error;
  return data;
};
export const updatePatient = async (patient: Patient): Promise<Patient> => {
  const cleanedPatient = { ...patient } as Record<string, any>;
  Object.keys(cleanedPatient).forEach(key => {
    if (cleanedPatient[key] === '') cleanedPatient[key] = null;
  });
  // 同上：若欄位不存在於 DB，null 值直接省略避免 PGRST204。
  if (cleanedPatient.公務員 == null) delete cleanedPatient.公務員;
  // 同上：若 nursing_assessment_json 為空物件且欄位不存在，省略避免 schema cache 錯誤。
  if (cleanedPatient.nursing_assessment_json && Object.keys(cleanedPatient.nursing_assessment_json).length === 0) {
    delete cleanedPatient.nursing_assessment_json;
  }
  // 遠端 DB 可能尚未套用最新 migration：欄位不存在時 PostgREST 回 PGRST204，
  // 逐一移除 schema cache 不認識的欄位後重試，避免單一新欄位令整個更新失敗。
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase.from('院友主表').update(cleanedPatient).eq('院友id', patient.院友id).select().single();
    if (!error) return data;
    const missingColumn = error.code === 'PGRST204'
      ? /'([^']+)' column/.exec(error.message || '')?.[1]
      : undefined;
    if (missingColumn && missingColumn in cleanedPatient) {
      console.warn(`[updatePatient] 遠端 DB 缺少欄位「${missingColumn}」，已略過（請儘快套用對應 migration）`);
      delete cleanedPatient[missingColumn];
      continue;
    }
    throw error;
  }
  throw new Error('updatePatient: 超過缺少欄位重試上限');
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
  const { id, ...updateData } = station;
  const { data, error } = await supabase.from('stations').update(updateData).eq('id', id).select().single();
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
  const { id, ...updateData } = bed;
  const { data, error } = await supabase.from('beds').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};
export const deleteBed = async (bedId: string): Promise<void> => {
  const { error } = await supabase.from('beds').delete().eq('id', bedId);
  if (error) throw error;
};
export const getRooms = async (): Promise<Room[]> => {
  const { data, error } = await supabase.from('rooms').select('*').order('room_number', { ascending: true });
  if (error) throw error;
  return data || [];
};
export const createRoom = async (room: Omit<Room, 'id' | 'created_at' | 'updated_at'>): Promise<Room> => {
  const { data, error } = await supabase.from('rooms').insert([room]).select().single();
  if (error) throw error;
  return data;
};
export const updateRoom = async (room: Pick<Room, 'id'> & Partial<Room>): Promise<Room> => {
  const { id, ...updateData } = room;
  const { data, error } = await supabase.from('rooms').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};
export const deleteRoom = async (roomId: string): Promise<void> => {
  const { error } = await supabase.from('rooms').delete().eq('id', roomId);
  if (error) throw error;
};
// 根據床位 ID 查詢在住院友
export const getPatientByBedId = async (bedId: string): Promise<Patient | null> => {
  const { data, error } = await supabase
    .from('院友主表')
    .select('*')
    .eq('bed_id', bedId)
    .eq('在住狀態', '在住')
    .maybeSingle();
  if (error) throw error;
  return data;
};

// 按床位 ID 查詢指定日期範圍內的巡房記錄（護理員頁專用）
export const getPatrolRoundsByBedId = async (
  bedId: string,
  startDate: string,
  endDate: string,
  fallbackPatientId?: number
): Promise<PatrolRound[]> => {
  const { data, error } = await supabase
    .from('patrol_rounds')
    .select('*')
    .eq('bed_id', bedId)
    .gte('patrol_date', startDate)
    .lte('patrol_date', endDate)
    .order('patrol_date', { ascending: true })
    .order('scheduled_time', { ascending: true });
  if (error) {
    // migration 未 push → bed_id 欄不存在，降級到 patient_id 查詢
    if ((error.code === '42703' || error.message?.includes('bed_id'))) {
      if (fallbackPatientId != null) {
        const { data: d2, error: e2 } = await supabase
          .from('patrol_rounds')
          .select('*')
          .eq('patient_id', fallbackPatientId)
          .gte('patrol_date', startDate)
          .lte('patrol_date', endDate)
          .order('patrol_date', { ascending: true })
          .order('scheduled_time', { ascending: true });
        if (e2) throw e2;
        return d2 || [];
      }
      return []; // 空床且無 patient_id 可 fallback
    }
    throw error;
  }
  return data || [];
};

// 按院友 ID 查詢指定日期範圍內的出入量記錄（護理員頁專用）
export const getIntakeOutputRecordsByPatient = async (patientId: number, startDate: string, endDate: string): Promise<IntakeOutputRecord[]> => {
  const { data, error } = await supabase
    .from('intake_output_records')
    .select('*, intake_items(*), output_items(*)')
    .eq('patient_id', patientId)
    .gte('record_date', startDate)
    .lte('record_date', endDate)
    .order('record_date', { ascending: true })
    .order('hour_slot', { ascending: true });
  if (error) throw error;
  return data || [];
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

// 根據二維碼ID獲取院友資料
export const getPatientByQrCodeId = async (qrCodeId: string): Promise<Patient | null> => {
  const { data, error } = await supabase
    .from('院友主表')
    .select('*')
    .eq('qr_code_id', qrCodeId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const assignPatientToBed = async (
  patientId: number,
  bedId: string,
  transferType: BedTransferType = 'routine',
  opts?: { originalBedId?: string }
): Promise<void> => {
  const [{ data: bed, error: bedError }, { data: patient, error: patientError }] = await Promise.all([
    supabase.from('beds').select('id, station_id, bed_number').eq('id', bedId).single(),
    supabase.from('院友主表').select('院友id, bed_id, station_id, 床號, original_bed_id, original_station_id, bed_transfer_type, 在住狀態').eq('院友id', patientId).single()
  ]) as [{ data: Partial<Bed>; error: any }, { data: Partial<Patient>; error: any }];
  if (bedError) throw bedError;
  if (patientError) throw patientError;

  const wasTemporary = patient.bed_transfer_type === 'temporary';
  const oldBedId = patient.bed_id;

  // 防止同一床位被兩位在住院友佔用（自己換到自己床位除外）
  if (bedId !== oldBedId) {
    const { data: occupant, error: occupantError } = await supabase
      .from('院友主表')
      .select('院友id, 中文姓氏, 中文名字, 床號')
      .eq('bed_id', bedId)
      .eq('在住狀態', '在住')
      .neq('院友id', patientId)
      .maybeSingle() as { data: Partial<Patient> | null; error: any };
    if (occupantError) throw occupantError;
    if (occupant) {
      throw new Error(`床位 ${bed.bed_number} 已被院友 ${occupant.中文姓氏 || ''}${occupant.中文名字 || ''}（${occupant.床號 || ''}）佔用，請先將該院友遷離。`);
    }
  }

  let updateData: any = {
    bed_id: bed.id,
    station_id: bed.station_id,
    床號: bed.bed_number,
    在住狀態: '在住'
  };

  if (transferType === 'routine') {
    updateData.original_bed_id = bed.id;
    updateData.original_station_id = bed.station_id;
    updateData.bed_transfer_type = 'routine';
    updateData.temporary_transfer_started_at = null;
  } else {
    // temporary
    if (!wasTemporary) {
      // 首次暫調：保留原床為根
      updateData.original_bed_id = oldBedId || bed.id;
      updateData.original_station_id = patient.station_id || bed.station_id;
      updateData.bed_transfer_type = 'temporary';
      updateData.temporary_transfer_started_at = new Date().toISOString();
    } else {
      // 再次暫調：根保持不變
      updateData.bed_transfer_type = 'temporary';
      if (opts?.originalBedId) {
        // 同時更改原床位
        updateData.original_bed_id = opts.originalBedId;
      }
    }
  }

  // 若顯式指定新的原床位（routine 或 temporary 都可能）
  if (opts?.originalBedId && transferType !== 'temporary') {
    const { data: originalBed } = await supabase.from('beds').select('station_id').eq('id', opts.originalBedId).single();
    updateData.original_bed_id = opts.originalBedId;
    updateData.original_station_id = originalBed?.station_id || bed.station_id;
  }

  const { error } = await supabase.from('院友主表').update(updateData).eq('院友id', patientId);
  if (error) throw error;
};

export const changeOriginalBed = async (patientId: number, newOriginalBedId: string): Promise<void> => {
  const { data: bed, error: bedError } = await supabase
    .from('beds')
    .select('id, station_id, bed_number')
    .eq('id', newOriginalBedId)
    .single();
  if (bedError) throw bedError;

  const { error } = await supabase.from('院友主表').update({
    original_bed_id: bed.id,
    original_station_id: bed.station_id
  }).eq('院友id', patientId);
  if (error) throw error;
};

export const endTemporaryTransfer = async (patientId: number): Promise<void> => {
  const { data: patient, error: patientError } = await supabase
    .from('院友主表')
    .select('院友id, bed_id, station_id, 床號, original_bed_id, original_station_id')
    .eq('院友id', patientId)
    .single() as { data: Partial<Patient>; error: any };
  if (patientError) throw patientError;
  if (!patient.original_bed_id) throw new Error('沒有原床位');

  const { data: bed, error: bedError } = await supabase
    .from('beds')
    .select('id, station_id, bed_number')
    .eq('id', patient.original_bed_id)
    .single();
  if (bedError) throw bedError;

  const { error } = await supabase.from('院友主表').update({
    bed_id: bed.id,
    station_id: bed.station_id,
    床號: bed.bed_number,
    original_bed_id: bed.id,
    original_station_id: bed.station_id,
    bed_transfer_type: 'routine',
    temporary_transfer_started_at: null
  }).eq('院友id', patientId);
  if (error) throw error;
};

export const cancelTemporaryTransfer = async (
  patientId: number,
  actor?: { user_id?: string; username?: string; name?: string; role?: string; department?: string }
): Promise<{ success: boolean; reason?: string }> => {
  const { data, error } = await supabase.rpc('fn_end_temporary_transfer', {
    p_patient_id: patientId,
    p_actor: actor || null
  });
  if (error) throw error;
  return data as { success: boolean; reason?: string };
};

export const cancelTemporarySwapPair = async (
  patientId1: number,
  patientId2: number,
  actor?: { user_id?: string; username?: string; name?: string; role?: string; department?: string }
): Promise<{ success: boolean; reason?: string }> => {
  const { data, error } = await supabase.rpc('fn_end_temporary_swap_pair', {
    p_patient_id1: patientId1,
    p_patient_id2: patientId2,
    p_actor: actor || null
  });
  if (error) throw error;
  return data as { success: boolean; reason?: string };
};

export const swapPatientBeds = async (
  patientId1: number,
  patientId2: number,
  transferType: BedTransferType = 'routine'
): Promise<void> => {
  const { data: patients, error: fetchError } = await supabase
    .from('院友主表')
    .select('院友id, bed_id, station_id, 床號, original_bed_id, original_station_id, bed_transfer_type')
    .in('院友id', [patientId1, patientId2]) as { data: Partial<Patient>[] | null; error: any };
  if (fetchError) throw fetchError;
  const patient1 = patients?.find(p => p.院友id === patientId1);
  const patient2 = patients?.find(p => p.院友id === patientId2);
  if (!patient1 || !patient2) throw new Error('找不到院友資料');

  const bedIds = [patient1.bed_id, patient2.bed_id].filter(Boolean) as string[];
  const { data: beds, error: bedsError } = await supabase
    .from('beds')
    .select('id, station_id, bed_number')
    .in('id', bedIds);
  if (bedsError) throw bedsError;

  const bed1 = beds?.find(b => b.id === patient1.bed_id);
  const bed2 = beds?.find(b => b.id === patient2.bed_id);
  if (!bed1 || !bed2) throw new Error('找不到床位資料');

  const p1WasTemporary = patient1.bed_transfer_type === 'temporary';
  const p2WasTemporary = patient2.bed_transfer_type === 'temporary';

  let p1Update: any = {
    bed_id: bed2.id,
    station_id: bed2.station_id,
    床號: bed2.bed_number
  };
  let p2Update: any = {
    bed_id: bed1.id,
    station_id: bed1.station_id,
    床號: bed1.bed_number
  };

  if (transferType === 'routine') {
    // 根跟人走
    p1Update.original_bed_id = bed2.id;
    p1Update.original_station_id = bed2.station_id;
    p1Update.bed_transfer_type = 'routine';
    p1Update.temporary_transfer_started_at = null;

    p2Update.original_bed_id = bed1.id;
    p2Update.original_station_id = bed1.station_id;
    p2Update.bed_transfer_type = 'routine';
    p2Update.temporary_transfer_started_at = null;
  } else {
    // 暫時互換：根不動，只交換現床位
    p1Update.bed_transfer_type = p1WasTemporary ? 'temporary' : 'temporary';
    p2Update.bed_transfer_type = p2WasTemporary ? 'temporary' : 'temporary';
    // 若原本常規，互換後變成暫時（根仍是原床）
    if (!p1WasTemporary) {
      p1Update.original_bed_id = bed1.id;
      p1Update.original_station_id = bed1.station_id;
      p1Update.temporary_transfer_started_at = new Date().toISOString();
    }
    if (!p2WasTemporary) {
      p2Update.original_bed_id = bed2.id;
      p2Update.original_station_id = bed2.station_id;
      p2Update.temporary_transfer_started_at = new Date().toISOString();
    }
  }

  // 為避免部分唯一索引（在住 + bed_id 唯一）在互換中途觸發 duplicate key，
  // 先把 patient1 的 bed_id 設為 NULL，再更新 patient2，最後更新 patient1。
  const { error: clearError1 } = await supabase
    .from('院友主表')
    .update({ bed_id: null })
    .eq('院友id', patientId1);
  if (clearError1) throw clearError1;

  const { error: updateError2 } = await supabase.from('院友主表').update(p2Update).eq('院友id', patientId2);
  if (updateError2) throw updateError2;
  const { error: updateError1 } = await supabase.from('院友主表').update(p1Update).eq('院友id', patientId1);
  if (updateError1) throw updateError1;
};
export const moveBedToStation = async (bedId: string, newStationId: string): Promise<void> => {
  const { error } = await supabase.from('beds').update({ station_id: newStationId }).eq('id', bedId);
  if (error) throw error;

  const { error: patientError } = await supabase
    .from('院友主表')
    .update({ station_id: newStationId })
    .eq('bed_id', bedId)
    .eq('在住狀態', '在住');
  if (patientError) throw patientError;
};
export const getSchedules = async (): Promise<Schedule[]> => {
  const { data, error } = await supabase.from('到診排程主表').select('*').order('到診日期', { ascending: false });
  if (error) throw error;
  return data || [];
};

// 優化版本：一次性獲取所有排程及其詳情，避免 N+1 查詢
export const getSchedulesWithDetails = async (options?: { daysBack?: number }): Promise<Array<Schedule & { 院友列表: ScheduleDetail[] }>> => {
  // 計算日期範圍
  let dateFilter: string | null = null;
  if (options?.daysBack) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
    dateFilter = cutoffDate.toISOString().split('T')[0];
  }
  
  // 第一步：獲取所有排程（有日期限制）
  let schedulesQuery = supabase.from('到診排程主表').select('*').order('到診日期', { ascending: false });
  if (dateFilter) {
    schedulesQuery = schedulesQuery.gte('到診日期', dateFilter);
  }
  const { data: schedulesData, error: schedulesError } = await schedulesQuery;
  if (schedulesError) throw schedulesError;
  if (!schedulesData || schedulesData.length === 0) return [];
  
  const scheduleIds = schedulesData.map(s => s.排程id);
  
  // 第二步：一次性獲取所有看診院友細項
  const { data: allDetails, error: detailsError } = await supabase
    .from('看診院友細項')
    .select('*')
    .in('排程id', scheduleIds);
  if (detailsError) throw detailsError;
  
  // 第三步：一次性獲取所有看診原因關聯
  const detailIds = (allDetails || []).map(d => d.細項id);
  let allReasonRelations: any[] = [];
  if (detailIds.length > 0) {
    const { data: reasonRelations, error: reasonRelError } = await supabase
      .from('到診院友_看診原因')
      .select('細項id, 原因id')
      .in('細項id', detailIds);
    if (reasonRelError) throw reasonRelError;
    allReasonRelations = reasonRelations || [];
  }
  
  // 第四步：一次性獲取所有看診原因選項（只需一次）
  let allReasonOptions: any[] = [];
  const allReasonIds = [...new Set(allReasonRelations.map(r => r.原因id))];
  if (allReasonIds.length > 0) {
    const { data: reasonData, error: reasonError } = await supabase
      .from('看診原因選項')
      .select('原因id, 原因名稱')
      .in('原因id', allReasonIds);
    if (reasonError) throw reasonError;
    allReasonOptions = reasonData || [];
  }
  
  // 組合數據
  return schedulesData.map(schedule => {
    const scheduleDetails = (allDetails || []).filter(d => d.排程id === schedule.排程id);
    const detailsWithReasons = scheduleDetails.map(detail => {
      const detailReasons = allReasonRelations
        .filter(r => r.細項id === detail.細項id)
        .map(r => allReasonOptions.find(opt => opt.原因id === r.原因id))
        .filter(Boolean);
      return { ...detail, reasons: detailReasons };
    });
    return { ...schedule, 院友列表: detailsWithReasons };
  });
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
  // 第一步：获取看診院友細項
  const { data: detailsData, error: detailsError } = await supabase
    .from('看診院友細項')
    .select('*')
    .eq('排程id', scheduleId);
  
  if (detailsError) throw detailsError;
  if (!detailsData || detailsData.length === 0) return [];
  
  // 第二步：获取所有细项的看診原因
  const detailIds = detailsData.map(d => d.細項id);
  const { data: reasonRelations, error: reasonRelError } = await supabase
    .from('到診院友_看診原因')
    .select('細項id, 原因id')
    .in('細項id', detailIds) as { data: { 細項id: number; 原因id: number }[] | null; error: any };
  
  if (reasonRelError) throw reasonRelError;
  
  // 第三步：如果有原因，获取原因详情
  let reasonOptions: any[] = [];
  if (reasonRelations && reasonRelations.length > 0) {
    const reasonIds = [...new Set(reasonRelations.map(r => r.原因id))];
    const { data: reasonData, error: reasonError } = await supabase
      .from('看診原因選項')
      .select('原因id, 原因名稱')
      .in('原因id', reasonIds);
    
    if (reasonError) throw reasonError;
    reasonOptions = reasonData || [];
  }
  
  // 组合数据
  return detailsData.map(detail => {
    const detailReasons = reasonRelations
      ?.filter(r => r.細項id === detail.細項id)
      .map(r => reasonOptions.find(opt => opt.原因id === r.原因id))
      .filter(Boolean) || [];
    
    return {
      ...detail,
      reasons: detailReasons
    };
  });
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

// 刪除特定院友在指定日期後的所有 VMO 排程記錄
export const deletePatientSchedulesAfterDate = async (patientId: number, afterDate: string): Promise<{ deletedCount: number }> => {
  // 1. 先找出所有在指定日期之後的排程
  const { data: futureSchedules, error: scheduleError } = await supabase
    .from('到診排程主表')
    .select('排程id')
    .gt('到診日期', afterDate) as { data: { 排程id: number }[] | null; error: any };
  
  if (scheduleError) throw scheduleError;
  if (!futureSchedules || futureSchedules.length === 0) return { deletedCount: 0 };
  
  const scheduleIds = futureSchedules.map(s => s.排程id);
  
  // 2. 刪除該院友在這些排程中的細項
  const { data: deletedDetails, error: deleteError } = await supabase
    .from('看診院友細項')
    .delete()
    .eq('院友id', patientId)
    .in('排程id', scheduleIds)
    .select('細項id');
  
  if (deleteError) throw deleteError;
  
  return { deletedCount: deletedDetails?.length || 0 };
};

export const getReasons = async (): Promise<ServiceReason[]> => {
  const { data, error } = await supabase.from('看診原因選項').select('*').order('原因名稱', { ascending: true });
  if (error) throw error;
  return data || [];
};
// 並行分頁載入：PostgREST 單次最多 1000 行，大表序列逐頁會好慢。
// 第 1 頁攞 exact count 計總頁數，之後每批 6 頁並行，保持原有排序語義。
const PAGE_FETCH_CONCURRENCY = 6;
type PageResult = { data: any[] | null; error: any; count?: number | null };
export const fetchAllPagesParallel = async (
  fetchPage: (from: number, to: number, withCount: boolean) => Promise<PageResult>,
  pageSize = 1000,
): Promise<any[]> => {
  const first = await fetchPage(0, pageSize - 1, true);
  if (first.error) throw first.error;
  const all = [...(first.data || [])];
  const total = first.count ?? all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  for (let p = 1; p < totalPages; p += PAGE_FETCH_CONCURRENCY) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(PAGE_FETCH_CONCURRENCY, totalPages - p) }, (_, j) => {
        const pageNo = p + j;
        return fetchPage(pageNo * pageSize, (pageNo + 1) * pageSize - 1, false);
      })
    );
    for (const r of batch) {
      if (r.error) throw r.error;
      all.push(...(r.data || []));
    }
  }
  return all;
};

export const getHealthRecords = async (options?: { limit?: number; daysBack?: number; sequential?: boolean }): Promise<HealthRecord[]> => {
  if (options?.limit !== undefined) {
    const { data, error } = await supabase
      .from('健康監測記錄')
      .select('*')
      .order('記錄日期', { ascending: false })
      .order('記錄時間', { ascending: false })
      .limit(options.limit);
    if (error) throw error;
    return (data || []) as HealthRecord[];
  }

  if (options?.daysBack !== undefined) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    return (await fetchAllPagesParallel(async (from, to, withCount) =>
      await supabase
        .from('健康監測記錄')
        .select('*', withCount ? { count: 'exact' } : undefined)
        .gte('記錄日期', cutoffDateStr)
        .order('記錄日期', { ascending: false })
        .order('記錄時間', { ascending: false })
        // 分頁必須有唯一 tiebreaker：(日期,時間) 有大量同值（批量輸入），
        // 冇 tiebreaker 跨頁會重複/漏行
        .order('記錄id', { ascending: false })
        .range(from, to)
    )) as HealthRecord[];
  }

  const fetchAllPagesQuery = async (from: number, to: number, withCount: boolean) =>
    await supabase
      .from('健康監測記錄')
      .select('*', withCount ? { count: 'exact' } : undefined)
      .order('記錄日期', { ascending: false })
      .order('記錄時間', { ascending: false })
      // 同上：唯一 tiebreaker 保證分頁穩定
      .order('記錄id', { ascending: false })
      .range(from, to);

  // sequential 模式：順序逐頁載入 + 頁間喘息，畀啟動關鍵查詢先用 DB（避免全表掃描轟炸導致 statement timeout）
  if (options?.sequential) {
    const pageSize = 1000;
    const first = await fetchAllPagesQuery(0, pageSize - 1, true);
    if (first.error) throw first.error;
    const all = [...(first.data || [])];
    const total = first.count ?? all.length;
    for (let from = pageSize; from < total; from += pageSize) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const page = await fetchAllPagesQuery(from, from + pageSize - 1, false);
      if (page.error) throw page.error;
      all.push(...(page.data || []));
    }
    return all as HealthRecord[];
  }

  return (await fetchAllPagesParallel(fetchAllPagesQuery)) as HealthRecord[];
};
export const createHealthRecord = async (record: Omit<HealthRecord, '記錄id' | '建立時間'>): Promise<HealthRecord> => {
  const { data, error } = await supabase.from('健康監測記錄').insert([record]).select('記錄id').single();
  if (error) { console.error('Error creating health record:', error); throw error; }
  return { ...record, ...(data as Record<string, any>) } as HealthRecord;
};

/** 批量建立同一 session 的多筆 narrow 記錄（動態 modal submit 用，相同 記錄日期/記錄時間）*/
export const createHealthRecordsForSession = async (
  records: Omit<HealthRecord, '記錄id' | '建立時間'>[]
): Promise<HealthRecord[]> => {
  if (records.length === 0) return [];
  // 血壓記錄必須有舒張壓
  for (const r of records) {
    if (r.監測類型 === '血壓' && (r.數值_副 == null)) {
      throw new Error('血壓記錄必須同時提供收縮壓（數值）和舒張壓（數值_副）');
    }
  }
  const { data, error } = await supabase.from('健康監測記錄').insert(records).select();
  if (error) { console.error('Error creating session health records:', error); throw error; }
  return (data || []) as HealthRecord[];
};

export const updateHealthRecord = async (record: HealthRecord): Promise<HealthRecord> => {
  if (!record.記錄id) {
    throw new Error('無法更新監測記錄：缺少記錄id');
  }
  const { data, error } = await supabase.from('健康監測記錄').update(record).eq('記錄id', record.記錄id).select();
  if (error) { console.error('Error updating health record:', error); throw error; }
  if (!data || data.length === 0) {
    throw new Error(`找不到要更新的監測記錄（記錄id: ${record.記錄id}），可能已被刪除或 ID 無效`);
  }
  return data[0] as HealthRecord;
};
export const getHealthRecordById = async (recordId: string): Promise<HealthRecord | null> => {
  const { data, error } = await supabase.from('健康監測記錄').select('*').eq('記錄id', recordId).maybeSingle();
  if (error) { console.error('Error fetching health record:', error); throw error; }
  return (data || null) as HealthRecord | null;
};
export const deleteHealthRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('健康監測記錄').delete().eq('記錄id', recordId);
  if (error) { console.error('Error deleting health record:', error); throw error; }
};
export const getHealthRecordByDateTime = async (
  patientId: number,
  recordDate: string,
  recordTime: string,
  monitoringType: VitalSignType
): Promise<HealthRecord | null> => {
  const { data, error } = await supabase
    .from('健康監測記錄')
    .select('*')
    .eq('院友id', patientId)
    .eq('記錄日期', recordDate)
    .eq('記錄時間', recordTime)
    .eq('監測類型', monitoringType)
    .order('建立時間', { ascending: false })
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
  monitoringType: VitalSignType,
  limit: number = 5
): Promise<HealthRecord[]> => {
  const { data, error } = await supabase
    .from('健康監測記錄')
    .select('*')
    .eq('院友id', patientId)
    .eq('監測類型', monitoringType)
    .order('記錄日期', { ascending: false })
    .order('記錄時間', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[getRecentHealthRecordsByPatient] 查詢錯誤:', error);
    throw error;
  }
  const filtered = (data as HealthRecord[])?.filter(
    record => !record.備註?.includes('無法量度')
  ) || [];
  return filtered;
};
export const getHealthTasks = async (): Promise<PatientHealthTask[]> => {
  // Supabase 默認/配置常有 1000 行上限，用分頁確保載入全部任務
  const all: PatientHealthTask[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('patient_health_tasks')
      .select('*')
      .order('next_due_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
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
  await softDeleteRecord('meal_guidance', guidanceId);
};
export const getPatientLogs = async (options?: { daysBack?: number }): Promise<PatientLog[]> => {
  let query = supabase.from('patient_logs').select('*').order('log_date', { ascending: false }).order('created_at', { ascending: false });
  
  if (options?.daysBack) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
    query = query.gte('log_date', cutoffDate.toISOString().split('T')[0]);
  }
  
  const { data, error } = await query;
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
  const cleanedAssessment = { ...assessment } as Record<string, any>;
  Object.keys(cleanedAssessment).forEach(key => {
    if (cleanedAssessment[key] === '') {
      cleanedAssessment[key] = null;
    }
  });
  const { error } = await supabase.from('patient_restraint_assessments').update(cleanedAssessment).eq('id', cleanedAssessment.id);
  if (error) throw error;
  return cleanedAssessment as PatientRestraintAssessment;
};
export const deleteRestraintAssessment = async (assessmentId: string): Promise<void> => {
  await softDeleteRecord('patient_restraint_assessments', assessmentId);
};
export const getEveningCarePlans = async (): Promise<PatientEveningCarePlan[]> => {
  const { data, error } = await supabase.from('patient_evening_care_plans').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};
export const createEveningCarePlan = async (plan: Omit<PatientEveningCarePlan, 'id' | 'created_at' | 'updated_at'>): Promise<PatientEveningCarePlan> => {
  const { data, error } = await supabase.from('patient_evening_care_plans').insert([plan]).select().single();
  if (error) throw error;
  return data;
};
export const updateEveningCarePlan = async (plan: PatientEveningCarePlan): Promise<PatientEveningCarePlan> => {
  // Clean up empty string values by converting them to null
  const cleanedPlan = { ...plan } as Record<string, any>;
  Object.keys(cleanedPlan).forEach(key => {
    if (cleanedPlan[key] === '') {
      cleanedPlan[key] = null;
    }
  });
  const { error } = await supabase.from('patient_evening_care_plans').update(cleanedPlan).eq('id', cleanedPlan.id);
  if (error) throw error;
  return cleanedPlan as PatientEveningCarePlan;
};
export const deleteEveningCarePlan = async (planId: string): Promise<void> => {
  await softDeleteRecord('patient_evening_care_plans', planId);
};
export const getTubeCareRecords = async (): Promise<PatientTubeCareRecord[]> => {
  const { data, error } = await supabase.from('patient_tube_care_records').select('*').order('execution_date', { ascending: false });
  if (error) throw error;
  return data || [];
};
export const createTubeCareRecord = async (record: Omit<PatientTubeCareRecord, 'id' | 'created_at' | 'updated_at'>): Promise<PatientTubeCareRecord> => {
  const { data, error } = await supabase.from('patient_tube_care_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};
export const updateTubeCareRecord = async (record: PatientTubeCareRecord): Promise<PatientTubeCareRecord> => {
  const cleaned: any = { ...record };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === '') {
      cleaned[key] = null;
    }
  });
  const { error } = await supabase.from('patient_tube_care_records').update(cleaned).eq('id', cleaned.id);
  if (error) throw error;
  return cleaned;
};
export const deleteTubeCareRecord = async (recordId: string): Promise<void> => {
  await softDeleteRecord('patient_tube_care_records', recordId);
};
export const getHealthAssessments = async (statusFilter: 'active' | 'archived' | 'all' = 'active'): Promise<HealthAssessment[]> => {
  let query = supabase.from('health_assessments').select('*');
  if (statusFilter !== 'all') {
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
  await softDeleteRecord('health_assessments', assessmentId);
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
    const [{ data: patients, error: patientsError }, beds] = await Promise.all([
      supabase
        .from('院友主表')
        .select('院友id, 床號, 中文姓氏, 中文名字, original_bed_id')
        .eq('在住狀態', '在住'),
      getBeds(),
    ]) as [{ data: Partial<Patient>[] | null; error: any }, Bed[]];
    if (patientsError) throw patientsError;
    const bedMap = new Map(beds.map(b => [b.id, b.bed_number]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 組合數據
    const result = (patients || []).map(patient => {
      const patientWounds = (wounds || []).filter(w => w.patient_id === patient.院友id);
      const woundsWithAssessments: WoundWithAssessments[] = patientWounds.map(wound => {
        const woundAssessments = (assessments || []).filter(a => a.wound_id === wound.id);
        // 動態計算下次評估日期：以「最新評估日期」為基準（無評估則用發現日期），
        // 依「當前頻率設定」重算，確保頻率改變後狀態立即更新，不受舊存值影響
        const latestAssessmentDate = woundAssessments.length > 0
          ? woundAssessments
              .map(a => a.assessment_date)
              .filter(Boolean)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          : null;
        const baseDate = latestAssessmentDate ?? wound.discovery_date;
        const computedNextDue = wound.status === 'active' && baseDate
          ? computeNextAssessmentDue(baseDate, wound)
          : null;
        const dueDate = computedNextDue ? new Date(computedNextDue) : null;
        if (dueDate) dueDate.setHours(0, 0, 0, 0);
        return {
          ...wound,
          next_assessment_due: computedNextDue ?? wound.next_assessment_due,
          assessments: woundAssessments,
          latest_assessment: woundAssessments[0],
          assessment_count: woundAssessments.length,
          is_overdue: wound.status === 'active' && dueDate ? dueDate < today : false,
          days_until_due: dueDate && wound.status === 'active'
            ? Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : undefined
        };
      });
      return {
        patient_id: patient.院友id,
        bed_number: patient.original_bed_id ? bedMap.get(patient.original_bed_id) || patient.床號 : patient.床號,
        patient_name: `${patient.中文姓氏}${patient.中文名字}`,
        wounds: woundsWithAssessments,
        active_wound_count: woundsWithAssessments.filter(w => w.status === 'active').length,
        healed_wound_count: woundsWithAssessments.filter(w => w.status === 'healed').length,
        overdue_assessment_count: woundsWithAssessments.filter(w => w.is_overdue).length
      };
    }) as PatientWithWounds[];
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
    // 先將相關評估記錄搬入回收筒（每筆獨立回收筒記錄，可個別還原）
    const { data: assessments, error: fetchError } = await supabase
      .from('wound_assessments')
      .select('id')
      .eq('wound_id', woundId);
    if (fetchError && fetchError.code !== '42P01') {
      throw fetchError;
    }
    if (assessments) {
      for (const assessment of assessments) {
        await softDeleteRecord('wound_assessments', assessment.id);
      }
    }
    // 再將傷口搬入回收筒
    await softDeleteRecord('wounds', woundId);
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
// 從評估日期 + 傷口頻率設定計算下次評估日期（沿用任務管理頻率模型）
export const computeNextAssessmentDue = (
  baseDate: string,
  wound: Pick<Wound, 'assessment_frequency_unit' | 'assessment_frequency_value' | 'assessment_specific_days_of_week'>
): string => {
  const unit = wound.assessment_frequency_unit ?? 'daily';
  const value = wound.assessment_frequency_value ?? 7;
  if (unit === 'weekly' && wound.assessment_specific_days_of_week?.length) {
    // 同任務計算器：7=週日→ JS getDay() 0
    const targetDays = wound.assessment_specific_days_of_week.map(d => d === 7 ? 0 : d);
    for (let i = 1; i <= 7; i++) {
      const check = new Date(baseDate);
      check.setDate(check.getDate() + i);
      if (targetDays.includes(check.getDay())) return check.toISOString().split('T')[0];
    }
  }
  const next = new Date(baseDate);
  next.setDate(next.getDate() + value);
  return next.toISOString().split('T')[0];
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
export const getWoundAssessments = async (statusFilter: 'active' | 'archived' | 'all' = 'active'): Promise<WoundAssessment[]> => {
  let query = supabase.from('wound_assessments').select('*');
  if (statusFilter !== 'all') {
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
  // 新欄位（類型推斷趣避）
  const infection_signs = (assessment as any).infection_signs as string[] | undefined;
  const surrounding_skin_texture = (assessment as any).surrounding_skin_texture as string | undefined;
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
      infection_signs,
      temperature,
      surrounding_skin_condition,
      surrounding_skin_color,
      surrounding_skin_texture,
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
  // 傷口主表狀態（status / healed_date / next_assessment_due）將在 SingleWoundAssessmentModal 中統一更新
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
  const { id, created_at, updated_at, wound_details, ...rest } = assessment as any;
  const { data, error } = await supabase.from('wound_assessments').update({
    patient_id:                rest.patient_id,
    assessment_date:           rest.assessment_date,
    assessor:                  rest.assessor,
    area_length:               rest.area_length,
    area_width:                rest.area_width,
    area_depth:                rest.area_depth,
    stage:                     rest.stage,
    wound_status:              rest.wound_status,
    exudate_present:           rest.exudate_present,
    exudate_amount:            rest.exudate_amount,
    exudate_color:             rest.exudate_color,
    exudate_type:              rest.exudate_type,
    odor:                      rest.odor,
    granulation:               rest.granulation,
    necrosis:                  rest.necrosis,
    infection:                 rest.infection,
    infection_signs:           rest.infection_signs,
    temperature:               rest.temperature,
    surrounding_skin_condition: rest.surrounding_skin_condition,
    surrounding_skin_color:    rest.surrounding_skin_color,
    surrounding_skin_texture:  rest.surrounding_skin_texture,
    cleanser:                  rest.cleanser,
    cleanser_other:            rest.cleanser_other,
    dressings:                 rest.dressings || [],
    dressing_other:            rest.dressing_other,
    wound_photos:              rest.wound_photos || [],
    remarks:                   rest.remarks,
    status:                    rest.status,
    archived_at:               rest.archived_at,
  }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};
export const deleteWoundAssessment = async (assessmentId: string): Promise<void> => {
  await softDeleteRecord('wound_assessments', assessmentId);
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
  await softDeleteRecord('hospital_episodes', episodeId);
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
    query = query.or(`drug_name.ilike.%${searchTerm}%,drug_code.ilike.%${searchTerm}%,dosage_form.ilike.%${searchTerm}%,administration_route.ilike.%${searchTerm}%,unit.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
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
  vital_sign_type: InspectionVitalSignType;
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
  vital_sign_type: InspectionVitalSignType;
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
// 獲取特定院友的工作流程設定（包含截止時間）
export const getPatientWorkflowSettings = async (userId: string, patientId: number): Promise<MedicationWorkflowSettings | null> => {
  const { data, error } = await supabase
    .from('medication_workflow_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};
// 更新特定院友的截止時間設定
export const updatePatientBatchCutoffTime = async (
  userId: string,
  patientId: number,
  batchCutoffTime: string
): Promise<MedicationWorkflowSettings> => {
  const { data: existing } = await supabase
    .from('medication_workflow_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .single();
  
  let result;
  if (existing) {
    const { data, error } = await supabase
      .from('medication_workflow_settings')
      .update({ batch_cutoff_time: batchCutoffTime })
      .eq('user_id', userId)
      .eq('patient_id', patientId)
      .select()
      .single();
    if (error) throw error;
    result = data;
  } else {
    const { data, error } = await supabase
      .from('medication_workflow_settings')
      .insert([{
        user_id: userId,
        patient_id: patientId,
        batch_cutoff_time: batchCutoffTime,
        enable_one_click_functions: true,
        enable_immediate_preparation_alerts: true,
        auto_jump_to_next_patient: false,
        default_preparation_lead_time: 60
      }])
      .select()
      .single();
    if (error) throw error;
    result = data;
  }
  return result;
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
// 給藥完成時同步處方的上次服用日期（自動覆蓋手入值；只向前推，不被舊日期回推）
const syncPrescriptionLastTakenDate = async (workflowRecord: any): Promise<void> => {
  try {
    if (!workflowRecord || workflowRecord.dispensing_status !== 'completed') return;
    const { prescription_id, scheduled_date } = workflowRecord;
    if (!prescription_id || !scheduled_date) return;
    const { error } = await supabase
      .from('new_medication_prescriptions')
      .update({ last_taken_date: scheduled_date })
      .eq('id', prescription_id)
      .or(`last_taken_date.is.null,last_taken_date.lt.${scheduled_date}`);
    if (error) console.warn('同步上次服用日期失敗:', error);
  } catch (err) {
    console.warn('同步上次服用日期失敗:', err);
  }
};
export const createMedicationWorkflowRecord = async (record: any): Promise<MedicationWorkflowRecord> => {
  const { data, error } = await supabase.from('medication_workflow_records').insert([record]).select().single();
  if (error) throw error;
  await syncPrescriptionLastTakenDate(data);
  return data;
};
export const updateMedicationWorkflowRecord = async (record: MedicationWorkflowRecord): Promise<MedicationWorkflowRecord> => {
  const { data, error } = await supabase.from('medication_workflow_records').update(record).eq('id', record.id).select().single();
  if (error) throw error;
  await syncPrescriptionLastTakenDate(data);
  return data;
};
export const deleteMedicationWorkflowRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('medication_workflow_records').delete().eq('id', recordId);
  if (error) throw error;
  return;
};

// 注射區域前綴 → 區域名稱對照（與 InjectionSiteModal 一致）
const INJECTION_AREA_LABELS: Record<string, string> = {
  A: '左上臂區',
  B: '右上臂區',
  C: '腹部左區',
  D: '腹部右區',
  E: '左大腿區',
  F: '右大腿區',
};

export interface RecentInjectionSite {
  scheduled_date: string;
  scheduled_time: string;
  site: string;        // 例如 C3
  areaLabel: string;   // 例如 腹部左區
}

// 取得某院友最近 N 次已完成派藥的注射位置（跨所有注射藥物，用於全身輪替提醒）
export const getRecentInjectionSites = async (
  patientId: number,
  beforeDate: string,
  limit = 2
): Promise<RecentInjectionSite[]> => {
  const { data, error } = await supabase
    .from('medication_workflow_records')
    .select('scheduled_date, scheduled_time, notes')
    .eq('patient_id', patientId)
    .eq('dispensing_status', 'completed')
    .lt('scheduled_date', beforeDate)
    .not('notes', 'is', null)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false });
  if (error) throw error;

  const results: RecentInjectionSite[] = [];
  for (const row of data || []) {
    const match = String(row.notes ?? '').match(/注射位置[：:]\s*([^|]+)/);
    if (!match) continue;
    const site = match[1].trim();
    if (!site) continue;
    const prefix = site.charAt(0).toUpperCase();
    results.push({
      scheduled_date: row.scheduled_date,
      scheduled_time: row.scheduled_time,
      site,
      areaLabel: INJECTION_AREA_LABELS[prefix] ?? '',
    });
    if (results.length >= limit) break;
  }
  return results;
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
  const { data, error } = await supabase
    .from('annual_health_checkups')
    .insert([checkup])
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
  await softDeleteRecord('annual_health_checkups', checkupId);
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
  await softDeleteRecord('incident_reports', reportId);
};
export const getDiagnosisRecords = async (): Promise<DiagnosisRecord[]> => {
  const { data, error } = await supabase.from('diagnosis_records').select('*').order('diagnosis_date', { ascending: false });
  if (error) throw error;
  return data || [];
};
export const getDiagnosisRecordsByPatientId = async (patientId: number): Promise<DiagnosisRecord[]> => {
  const { data, error } = await supabase.from('diagnosis_records').select('*').eq('patient_id', patientId).order('diagnosis_date', { ascending: false });
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
  await softDeleteRecord('diagnosis_records', recordId);
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
  await softDeleteRecord('vaccination_records', recordId);
};
export const getInfectionControlRecords = async (): Promise<InfectionControlRecord[]> => {
  const { data, error } = await supabase.from('infection_control_records').select('*').order('diagnosis_date', { ascending: false });
  if (error) throw error;
  return data || [];
};
export const createInfectionControlRecord = async (record: Omit<InfectionControlRecord, 'id' | 'created_at' | 'updated_at'>): Promise<InfectionControlRecord> => {
  const { data, error } = await supabase.from('infection_control_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};
export const updateInfectionControlRecord = async (record: InfectionControlRecord): Promise<InfectionControlRecord> => {
  const { id, created_at, updated_at, ...updateData } = record;
  const { data, error } = await supabase.from('infection_control_records').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};
export const deleteInfectionControlRecord = async (recordId: string): Promise<void> => {
  await softDeleteRecord('infection_control_records', recordId);
};
export const getPatientNotes = async (options?: { incompleteOnly?: boolean; daysBack?: number }): Promise<PatientNote[]> => {
  let query = supabase.from('patient_notes').select('*').order('is_completed', { ascending: true }).order('note_date', { ascending: false });
  
  if (options?.incompleteOnly) {
    // 只載入未完成的筆記
    query = query.eq('is_completed', false);
  } else if (options?.daysBack) {
    // 載入過去 N 天
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
    query = query.gte('note_date', cutoffDate.toISOString().split('T')[0]);
  }
  
  const { data, error } = await query;
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
export const getPatrolRounds = async (options?: { daysBack?: number }): Promise<PatrolRound[]> => {
  let query = supabase.from('patrol_rounds').select('*').order('patrol_date', { ascending: false }).order('scheduled_time', { ascending: false });
  
  if (options?.daysBack) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
    query = query.gte('patrol_date', cutoffDate.toISOString().split('T')[0]);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};
export const createPatrolRound = async (round: Omit<PatrolRound, 'id' | 'created_at' | 'updated_at'>): Promise<PatrolRound> => {
  // 只插入有值的欄位，避免把尚未在 DB 中的欄位（如 bed_id）發送給還沒 migrate 的資料庫
  const roundData: Record<string, any> = {
    patient_id:     round.patient_id ?? undefined,
    patrol_date:    round.patrol_date,
    patrol_time:    round.patrol_time,
    scheduled_time: round.scheduled_time,
    recorder:       round.recorder,
  };
  if (round.co_signer)  roundData.co_signer = round.co_signer;
  if (round.bed_id)     roundData.bed_id    = round.bed_id;
  const { data, error } = await supabase.from('patrol_rounds').insert([roundData]).select().single();
  if (error) {
    // code 42703 = "column does not exist"（migration 未 push 時 bed_id 欄位不存在），自動降級重試
    if ((error.code === '42703' || error.message?.includes('bed_id')) && roundData.bed_id) {
      delete roundData.bed_id;
      const { data: data2, error: error2 } = await supabase.from('patrol_rounds').insert([roundData]).select().single();
      if (error2) throw error2;
      return data2;
    }
    throw error;
  }
  return data;
};
export const updatePatrolRound = async (round: PatrolRound): Promise<PatrolRound> => {
  const { id, created_at, updated_at, bed_id, ...coreData } = round;
  // bed_id 只在有值時才加入更新（避免在 migration 上線前把 undefined 欄位發給 DB）
  const updateData: Record<string, any> = { ...coreData };
  if (bed_id) updateData.bed_id = bed_id;
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

// 尿片記錄（每月估算 + 虛擬生成數據）
export const getDiaperUsageRecords = async (): Promise<DiaperUsageRecord[]> => {
  const { data, error } = await supabase.from('diaper_usage_records').select('*').order('year', { ascending: false }).order('month', { ascending: false });
  if (error) throw error;
  return data || [];
};
export const createDiaperUsageRecord = async (record: Omit<DiaperUsageRecord, 'id' | 'created_at' | 'updated_at'>): Promise<DiaperUsageRecord> => {
  const { data, error } = await supabase.from('diaper_usage_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};
export const updateDiaperUsageRecord = async (record: DiaperUsageRecord): Promise<DiaperUsageRecord> => {
  const { id, created_at, updated_at, ...updateData } = record;
  const { data, error } = await supabase.from('diaper_usage_records').update({ ...updateData, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};
export const deleteDiaperUsageRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('diaper_usage_records').delete().eq('id', recordId);
  if (error) throw error;
};

// 清除無效的尿片/片芯數據：無大小便（has_none 或無任何排泄記錄）或備註為入院/渡假/外出的記錄，
// 其尿片/片芯數應為空（例如被誤插入的虛擬數據）。回傳清除筆數。
export const clearInvalidDiaperUsageCounts = async (): Promise<number> => {
  const { data, error } = await supabase
    .from('diaper_change_records')
    .update({ urine_count: null, core_count: null })
    .or('notes.in.(入院,渡假,外出),has_none.eq.true,and(has_urine.eq.false,has_stool.eq.false)')
    .or('urine_count.not.is.null,core_count.not.is.null')
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
};

// User Profiles (staff)
export interface UserProfile {
  id: string;
  username: string;
  password_hash: string;
  name_zh: string;
  name_en?: string | null;
  id_number?: string | null;
  date_of_birth?: string | null;
  department: string;
  nursing_position?: string | null;
  allied_health_position?: string | null;
  hygiene_position?: string | null;
  other_position?: string | null;
  hire_date: string;
  employment_type: string;
  monthly_hour_limit?: number | null;
  role: string;
  is_active: boolean;
  auth_user_id?: string | null;
  facility_id?: number | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export const getUserProfiles = async (activeOnly = true): Promise<UserProfile[]> => {
  let query = supabase.from('user_profiles').select('*').order('name_zh', { ascending: true });
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Fee Items and Patient Fee Records
export const generateFeeItemCode = async (category: FeeItemCategory): Promise<string> => {
  const prefix = category === '服務' ? 'S' : 'M';
  const { data, error } = await supabase
    .from('fee_items')
    .select('code')
    .ilike('code', `${prefix}___`)
    .order('code', { ascending: true });
  if (error) throw error;
  const used = new Set<number>();
  const regex = new RegExp(`^${prefix}(\\d{3})$`);
  for (const row of (data || [])) {
    const match = row.code.match(regex);
    if (match) used.add(Number(match[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
};

export const getFeeItems = async (): Promise<FeeItem[]> => {
  const { data, error } = await supabase.from('fee_items').select('*').order('display_order', { ascending: true }).order('code', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createFeeItem = async (item: Omit<FeeItem, 'id' | 'created_at' | 'updated_at'>): Promise<FeeItem> => {
  const { data, error } = await supabase.from('fee_items').insert([item]).select().single();
  if (error) throw error;
  return data;
};

export const updateFeeItem = async (item: FeeItem): Promise<FeeItem> => {
  const { id, created_at, updated_at, ...updateData } = item;
  const { data, error } = await supabase.from('fee_items').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteFeeItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('fee_items').delete().eq('id', id);
  if (error) throw error;
};

export const getPatientFeeRecordsInDateRange = async (startDate: string, endDate: string): Promise<PatientFeeRecord[]> => {
  const { data, error } = await supabase
    .from('patient_fee_records')
    .select('*')
    .gte('record_date', startDate)
    .lte('record_date', endDate)
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPatientFeeRecord = async (record: Omit<PatientFeeRecord, 'id' | 'created_at' | 'updated_at'>): Promise<PatientFeeRecord> => {
  const { data, error } = await supabase.from('patient_fee_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updatePatientFeeRecord = async (record: PatientFeeRecord): Promise<PatientFeeRecord> => {
  const { id, created_at, updated_at, ...updateData } = record;
  const { data, error } = await supabase.from('patient_fee_records').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deletePatientFeeRecord = async (id: string): Promise<void> => {
  const { error } = await supabase.from('patient_fee_records').delete().eq('id', id);
  if (error) throw error;
};

export const carryForwardRecurringFeeRecordsForPatient = async (
  patientId: number,
  targetYear: number,
  targetMonth: number
): Promise<PatientFeeRecord[]> => {
  const targetStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const prevDate = new Date(targetYear, targetMonth - 2, 1);
  const prevStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`;
  const prevEnd = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const targetEnd = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(new Date(targetYear, targetMonth, 0).getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('patient_fee_records')
    .select('*')
    .eq('patient_id', patientId)
    .gte('record_date', prevStart)
    .lt('record_date', prevEnd)
    .eq('is_recurring', true);
  if (error) throw error;

  // 只查詢同一位院友的目標月份記錄，避免不同院友互相干擾
  const { data: existingRowsRaw, error: existingError } = await supabase
    .from('patient_fee_records')
    .select('*')
    .eq('patient_id', patientId)
    .gte('record_date', targetStart)
    .lte('record_date', targetEnd);
  if (existingError) throw existingError;

  const existingRows: PatientFeeRecord[] = existingRowsRaw || [];

  const toInsert: Omit<PatientFeeRecord, 'id' | 'created_at' | 'updated_at'>[] = [];
  for (const record of (data || [])) {
    const alreadyExists = existingRows.some(
      e =>
        e.fee_item_id === record.fee_item_id &&
        e.item_name === record.item_name &&
        e.unit_price === record.unit_price &&
        e.unit === record.unit &&
        e.start_time === record.start_time &&
        e.end_time === record.end_time
    );
    if (alreadyExists) continue;
    toInsert.push({
      patient_id: record.patient_id,
      fee_item_id: record.fee_item_id,
      record_date: targetStart,
      start_time: record.start_time,
      end_time: record.end_time,
      item_name: record.item_name,
      item_category: record.item_category,
      unit: record.unit,
      unit_price: record.unit_price,
      quantity: record.quantity,
      amount: record.amount,
      is_recurring: true,
      notes: record.notes,
    });
  }
  if (toInsert.length === 0) return [];
  const { data: inserted, error: insertError } = await supabase.from('patient_fee_records').insert(toInsert).select();
  if (insertError) throw insertError;
  return inserted || [];
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
// Patient Activity Records（院友活動記錄）
export const getPatientActivityRecords = async (): Promise<PatientActivityRecord[]> => {
  const { data, error } = await supabase.from('patient_activity_records').select('*').order('record_date', { ascending: false });
  if (error) throw error;
  return data || [];
};
export const getPatientActivityRecordsInDateRange = async (startDate: string, endDate: string): Promise<PatientActivityRecord[]> => {
  const { data, error } = await supabase.from('patient_activity_records').select('*').gte('record_date', startDate).lte('record_date', endDate).order('record_date', { ascending: false });
  if (error) throw error;
  return data || [];
};
// 批量新增/更新（同一日期，多位院友）：以 (patient_id, record_date) upsert，避免違反唯一鍵
export const upsertPatientActivityRecords = async (
  records: Array<Omit<PatientActivityRecord, 'id' | 'created_at' | 'updated_at'>>
): Promise<PatientActivityRecord[]> => {
  const { data, error } = await supabase
    .from('patient_activity_records')
    .upsert(records, { onConflict: 'patient_id,record_date' })
    .select();
  if (error) throw error;
  return data || [];
};
export const updatePatientActivityRecord = async (id: string, updates: Partial<Omit<PatientActivityRecord, 'id' | 'created_at' | 'updated_at'>>): Promise<PatientActivityRecord | null> => {
  const { data, error } = await supabase.from('patient_activity_records').update(updates).eq('id', id).select();
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
};
export const deletePatientActivityRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('patient_activity_records').delete().eq('id', recordId);
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
  console.log('[Step 2] 開始上傳到 Storage, path:', storagePath, ', size:', file.size, ', type:', file.type);
  const { data, error } = await supabase.storage.from('templates').upload(storagePath, file, { cacheControl: '3600', upsert: false });
  if (error) {
    console.error('[Step 2] Storage 上傳失敗:', JSON.stringify(error, null, 2));
    throw new Error(`[Storage上傳] ${error.message}`);
  }
  console.log('[Step 2] Storage 上傳成功:', data.path);
  return data.path;
};
export const createTemplateMetadata = async (metadata: any) => {
  const formatSize = JSON.stringify(metadata.extracted_format || {}).length;
  console.log('[Step 3] 開始寫入 Metadata, type:', metadata.type, ', extracted_format size:', formatSize, 'bytes');
  const { data, error } = await supabase.from('templates_metadata').insert([metadata]).select().single();
  if (error) {
    console.error('[Step 3] Metadata 寫入失敗:', JSON.stringify(error, null, 2));
    throw new Error(`[Metadata寫入] ${error.message}`);
  }
  console.log('[Step 3] Metadata 寫入成功, id:', data.id);
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
/** @deprecated 回收筒已廢棄。直接永久刪除記錄。 */
export const moveHealthRecordToRecycleBin = async (record: HealthRecord, _deletedBy?: string, _deletionReason?: string): Promise<void> => {
  await deleteHealthRecord(record.記錄id);
};
/** @deprecated 回收筒已廢棄，永遠回傳空陣列。 */
export const getDeletedHealthRecords = async (): Promise<DeletedHealthRecord[]> => [];
/** @deprecated 回收筒已廢棄，此功能已移除。 */
export const restoreHealthRecordFromRecycleBin = async (_deletedRecordId: string): Promise<void> => {
  throw new Error('回收筒功能已移除，無法還原記錄');
};
/** @deprecated 回收筒已廢棄，此功能已移除。 */
export const permanentlyDeleteHealthRecord = async (_deletedRecordId: string): Promise<void> => {};
/** @deprecated narrow table 無需去重，永遠回傳空陣列。 */
export const findDuplicateHealthRecords = async (): Promise<DuplicateRecordGroup[]> => [];
/** @deprecated 已移除。 */
export const batchMoveDuplicatesToRecycleBin = async (_duplicateRecordIds: string[], _deletedBy?: string): Promise<void> => {};
// [修復可能性2] 核心同步功能 - 使用智能推進策略並添加詳細日誌
export const syncTaskStatus = async (taskId: string) => {
  const SYNC_CUTOFF_DATE = new Date(SYNC_CUTOFF_DATE_STR);
  const { data: task, error: taskError } = await supabase
    .from('patient_health_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();
  if (taskError || !task) {
    return;
  }
  // [修復] 遷移的舊記錄 任務id 為 NULL，無法只靠 任務id 連結；改用 任務id 或 (院友id + 監測類型) 後備配對
  const { data: latestRecords } = await supabase
    .from('健康監測記錄')
    .select('記錄日期, 記錄時間, 任務id')
    .or(`任務id.eq.${taskId},and(院友id.eq.${task.patient_id},監測類型.eq.${task.health_record_type})`)
    .order('記錄日期', { ascending: false })
    .order('記錄時間', { ascending: false })
    .limit(1) as { data: Partial<HealthRecord>[] | null; error: any };
  const latestRecord = latestRecords && latestRecords.length > 0 ? latestRecords[0] : null;
  let updates = {};
  if (latestRecord) {
    const recordDate = new Date(latestRecord.記錄日期!);
    if (recordDate <= SYNC_CUTOFF_DATE) {
      return;
    }
    const lastCompletedAt = new Date(`${latestRecord.記錄日期!}T${latestRecord.記錄時間!}`);
    const { findFirstMissingDate } = await import('../utils/taskScheduler');
    const startDate = new Date(latestRecord.記錄日期!);
    startDate.setDate(startDate.getDate() - 14);
    startDate.setHours(0, 0, 0, 0);
    if (startDate < SYNC_CUTOFF_DATE) {
      startDate.setTime(SYNC_CUTOFF_DATE.getTime());
    }
    const nextDueAt = await findFirstMissingDate(task, startDate, supabase);
    updates = {
      last_completed_at: lastCompletedAt.toISOString(),
      next_due_at: nextDueAt.toISOString()
    };
  } else {
    updates = {
      last_completed_at: null,
      next_due_at: task.next_due_at
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

// 取得前一版複檢計劃的複檢日期
export const getPreviousCarePlanReviewDate = async (planId: string): Promise<string | null> => {
  // 先取得當前計劃
  const { data: currentPlan, error: currentError } = await supabase
    .from('care_plans')
    .select('*')
    .eq('id', planId)
    .single();
  if (currentError) throw currentError;
  if (!currentPlan) return null;

  // 找出同一院友版本號較小的計劃，取最新 plan_date 作為上次複檢日期
  const { data, error } = await supabase
    .from('care_plans')
    .select('plan_date, version_number')
    .eq('patient_id', currentPlan.patient_id)
    .lt('version_number', currentPlan.version_number)
    .order('plan_date', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0].plan_date : null;
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
    status: '生效中',
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
// 封存計劃（視為已完成）
export const archiveCarePlan = async (planId: string): Promise<void> => {
  const { error } = await supabase
    .from('care_plans')
    .update({ 
      status: '已完成',
      archived_at: new Date().toISOString()
    })
    .eq('id', planId);
  if (error) throw error;
};
// 刪除計劃
export const deleteCarePlan = async (planId: string): Promise<void> => {
  await softDeleteRecord('care_plans', planId);
};

// 取得院友目前生效中的 ICP（未過期）
export const getPatientActiveCarePlan = async (patientId: number): Promise<CarePlan | null> => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('care_plans')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', '生效中')
    .lte('plan_date', today)
    .gte('review_due_date', today)
    .order('plan_date', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

// 取代生效中計劃：舊計劃提前到今天結束並變為待檢討，新增生效中計劃
export const replaceActiveCarePlan = async (
  sourcePlanId: string,
  newPlanType: PlanType,
  createdBy: string,
  remarks?: string
): Promise<CarePlan> => {
  const sourcePlan = await getCarePlanWithDetails(sourcePlanId);
  if (!sourcePlan) throw new Error('Source plan not found');

  const today = new Date().toISOString().split('T')[0];

  // 把舊計劃提前到今天結束
  const { error: updateError } = await supabase
    .from('care_plans')
    .update({
      review_due_date: today,
      status: '待檢討'
    })
    .eq('id', sourcePlanId);
  if (updateError) throw updateError;

  // 複製內容到新的生效中計劃
  const newPlan = await duplicateCarePlanInternal(
    sourcePlan,
    newPlanType,
    today,
    createdBy,
    remarks,
    '生效中'
  );
  return newPlan;
};

// 加入待生效計劃：計劃日期緊接在生效中計劃的複檢到期日之後
export const addPendingCarePlan = async (
  sourcePlanId: string,
  newPlanType: PlanType,
  createdBy: string,
  remarks?: string
): Promise<CarePlan> => {
  const sourcePlan = await getCarePlanWithDetails(sourcePlanId);
  if (!sourcePlan) throw new Error('Source plan not found');
  if (!sourcePlan.review_due_date) throw new Error('Active plan has no review due date');

  const planDate = new Date(sourcePlan.review_due_date);
  planDate.setDate(planDate.getDate() + 1);
  const planDateStr = planDate.toISOString().split('T')[0];

  const newPlan = await duplicateCarePlanInternal(
    sourcePlan,
    newPlanType,
    planDateStr,
    createdBy,
    remarks,
    '待生效'
  );
  return newPlan;
};

// 內部：複製計劃內容並建立新計劃（不觸發舊計劃狀態變更）
const duplicateCarePlanInternal = async (
  sourcePlan: CarePlanWithDetails,
  newPlanType: PlanType,
  newPlanDate: string,
  createdBy: string,
  remarks?: string,
  status: CarePlanStatus = '生效中'
): Promise<CarePlan> => {
  const { data: existingPlans } = await supabase
    .from('care_plans')
    .select('version_number')
    .eq('patient_id', sourcePlan.patient_id)
    .order('version_number', { ascending: false })
    .limit(1);
  const newVersionNumber = (existingPlans?.[0]?.version_number || 0) + 1;

  const plan: Omit<CarePlan, 'id' | 'created_at' | 'updated_at' | 'review_due_date'> = {
    patient_id: sourcePlan.patient_id,
    parent_plan_id: sourcePlan.id,
    version_number: newVersionNumber,
    plan_type: newPlanType,
    plan_date: newPlanDate,
    created_by: createdBy,
    status,
    remarks: remarks || `由版本 ${sourcePlan.version_number} 建立`
  };

  const nursingNeeds = sourcePlan.nursing_needs.map(nn => ({
    nursing_need_item_id: nn.nursing_need_item_id,
    has_need: nn.has_need,
    remarks: nn.remarks
  }));

  const problems = sourcePlan.problems.map(p => ({
    problem_library_id: p.problem_library_id,
    problem_category: p.problem_category,
    problem_description: p.problem_description,
    expected_goals: p.expected_goals,
    interventions: p.interventions,
    outcome_review: undefined as undefined,
    problem_assessor: p.problem_assessor,
    outcome_assessor: undefined as undefined,
    display_order: p.display_order
  }));

  return createCarePlan(plan, nursingNeeds, problems as any);
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

// 意外事件報告預設選項介面
export interface IncidentPresetOption {
  id: string;
  option_type: 'immediate_improvement_actions' | 'prevention_methods';
  option_text: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// 獲取預設選項
// 獲取預設選項
export const getIncidentPresetOptions = async (optionType: 'immediate_improvement_actions' | 'prevention_methods'): Promise<IncidentPresetOption[]> => {
  console.log('Querying preset options for type:', optionType);
  console.log('Current user:', { session: true });
  
  const { data, error } = await supabase
    .from('incident_preset_options')
    .select('*')
    .eq('option_type', optionType)
    .order('display_order', { ascending: true }) as { data: IncidentPresetOption[] | null; error: any };
  
  console.log(`Query result for ${optionType}:`, { data, error: error ? { code: error.code, message: error.message, details: error.details, status: error.status } : null });
  
  if (error) {
    const errorMsg = `[${error.code || 'UNKNOWN'}] ${error.message} (status: ${error.status}). Details: ${error.details || 'N/A'}`;
    console.error('getIncidentPresetOptions error:', errorMsg);
    throw new Error(errorMsg);
  }
  
  console.log(`Successfully loaded ${data?.length || 0} options for ${optionType}`);
  return data || [];
};

// 建立新預設選項
export const createIncidentPresetOption = async (optionType: 'immediate_improvement_actions' | 'prevention_methods', optionText: string, displayOrder?: number): Promise<IncidentPresetOption | null> => {
  try {
    console.log('Creating preset option:', { optionType, optionText, displayOrder });
    
    const { data, error } = await supabase
      .from('incident_preset_options')
      .insert({
        option_type: optionType,
        option_text: optionText,
        display_order: displayOrder || 999
      })
      .select()
      .single() as { data: IncidentPresetOption | null; error: any };
    
    if (error) {
      const errorMsg = `[${error.code || 'UNKNOWN'}] ${error.message} (status: ${error.status}). Details: ${error.details || 'N/A'}`;
      console.error('createIncidentPresetOption error:', errorMsg);
      throw new Error(errorMsg);
    }
    
    console.log('Successfully created preset option:', data);
    return data;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('createIncidentPresetOption error caught:', errorMsg);
    alert(`添加失敗：${errorMsg}`);
    return null;
  }
};

// 刪除預設選項
export const deleteIncidentPresetOption = async (id: string): Promise<boolean> => {
  try {
    console.log('Deleting preset option:', id);
    
    const { error } = await supabase
      .from('incident_preset_options')
      .delete()
      .eq('id', id) as { data: any; error: any };
    
    if (error) {
      const errorMsg = `[${error.code || 'UNKNOWN'}] ${error.message} (status: ${error.status}). Details: ${error.details || 'N/A'}`;
      console.error('deleteIncidentPresetOption error:', errorMsg);
      throw new Error(errorMsg);
    }
    console.log('Successfully deleted preset option:', id);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('deleteIncidentPresetOption error caught:', errorMsg);
    alert(`刪除失敗：${errorMsg}`);
    return false;
  }
};

// 更新預設選項順序
export const updateIncidentPresetOptionOrder = async (id: string, displayOrder: number): Promise<IncidentPresetOption> => {
  const { data, error } = await supabase
    .from('incident_preset_options')
    .update({ display_order: displayOrder })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
export default null;