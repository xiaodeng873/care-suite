import { supabase } from './supabase';

// 類型定義 (與 Web App 共享)
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
  護理等級?: '全護理' | '半護理' | '自理';
  在住狀態?: '在住' | '待入住' | '已退住';
  station_id?: string;
  bed_id?: string;
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
  created_at: string;
  updated_at: string;
}

export interface PatrolRound {
  id: string;
  patient_id: number;
  patrol_date: string;
  patrol_time: string;
  scheduled_time: string;
  recorder: string;
  notes?: string;
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
  notes?: string;
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
  notes?: string;
  recorder: string;
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

export interface PatientAdmissionRecord {
  id: string;
  patient_id: number;
  event_type: 'hospital_admission' | 'hospital_discharge' | 'transfer_out';
  event_date: string;
  event_time?: string;
  hospital_name?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
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
  amount_numeric: number; // 計算用數值
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
  color?: string; // 透明/黃/啡/紅
  ph_value?: number; // pH值 (僅胃液)
  amount_ml: number; // 容量(ml)
  created_at: string;
}

// ============================================
// 出入量主記錄
// ============================================
export interface IntakeOutputRecord {
  id: string;
  patient_id: number;
  record_date: string;
  hour_slot: number; // 0-23
  time_slot: string; // '08:00', '12:00', '16:00', '20:00', '00:00'
  recorder: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // 關聯數據 (可選，用於聯表查詢)
  intake_items?: IntakeItem[];
  output_items?: OutputItem[];
}

export interface HealthAssessment {
  id: string;
  patient_id: number;
  assessment_date: string;
  next_due_date?: string;
  daily_activities?: {
    max_activity?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

// 資料庫操作函數
export const getPatients = async (): Promise<Patient[]> => {
  const { data, error } = await supabase
    .from('院友主表')
    .select('*')
    .eq('在住狀態', '在住')
    .order('床號', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getStations = async (): Promise<Station[]> => {
  const { data, error } = await supabase
    .from('stations')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getBeds = async (): Promise<Bed[]> => {
  const { data, error } = await supabase
    .from('beds')
    .select('*')
    .order('bed_number', { ascending: true });
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

export const getRestraintAssessments = async (): Promise<PatientRestraintAssessment[]> => {
  const { data, error } = await supabase
    .from('patient_restraint_assessments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getPatientAdmissionRecords = async (): Promise<PatientAdmissionRecord[]> => {
  const { data, error } = await supabase
    .from('patient_admission_records')
    .select('*')
    .order('event_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

// 巡房記錄
export const getPatrolRoundsInDateRange = async (startDate: string, endDate: string): Promise<PatrolRound[]> => {
  const { data, error } = await supabase
    .from('patrol_rounds')
    .select('*')
    .gte('patrol_date', startDate)
    .lte('patrol_date', endDate)
    .order('patrol_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPatrolRound = async (round: Omit<PatrolRound, 'id' | 'created_at' | 'updated_at'>): Promise<PatrolRound> => {
  console.log('[DB] Creating patrol round:', round);
  const { data, error } = await supabase.from('patrol_rounds').insert([round]).select().single();
  if (error) {
    console.error('[DB] Failed to create patrol round:', error);
    throw error;
  }
  console.log('[DB] Patrol round created successfully:', data.id);
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

// 換片記錄
export const getDiaperChangeRecordsInDateRange = async (startDate: string, endDate: string): Promise<DiaperChangeRecord[]> => {
  const { data, error } = await supabase
    .from('diaper_change_records')
    .select('*')
    .gte('change_date', startDate)
    .lte('change_date', endDate)
    .order('change_date', { ascending: false });
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

// 約束觀察記錄
export const getRestraintObservationRecordsInDateRange = async (startDate: string, endDate: string): Promise<RestraintObservationRecord[]> => {
  const { data, error } = await supabase
    .from('restraint_observation_records')
    .select('*')
    .gte('observation_date', startDate)
    .lte('observation_date', endDate)
    .order('observation_date', { ascending: false });
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

// 轉身記錄
export const getPositionChangeRecordsInDateRange = async (startDate: string, endDate: string): Promise<PositionChangeRecord[]> => {
  const { data, error } = await supabase
    .from('position_change_records')
    .select('*')
    .gte('change_date', startDate)
    .lte('change_date', endDate)
    .order('change_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPositionChangeRecord = async (record: Omit<PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>): Promise<PositionChangeRecord> => {
  const { data, error } = await supabase.from('position_change_records').insert([record]).select().single();
  if (error) throw error;
  return data;
};

export const updatePositionChangeRecord = async (record: PositionChangeRecord): Promise<PositionChangeRecord> => {
  const { id, created_at, updated_at, ...updateData } = record;
  const { data, error } = await supabase.from('position_change_records').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deletePositionChangeRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase.from('position_change_records').delete().eq('id', recordId);
  if (error) throw error;
};

export const getPatientCareTabs = async (patientId: number): Promise<PatientCareTab[]> => {
  const { data, error } = await supabase
    .from('patient_care_tabs')
    .select('*')
    .eq('patient_id', patientId)
    .order('tab_type', { ascending: true });
  if (error) throw error;
  // 在客户端过滤 is_hidden，避免类型转换问题
  return (data || []).filter(tab => tab.is_hidden === false || tab.is_hidden === 'false' || !tab.is_hidden);
};

export const getHealthAssessments = async (): Promise<HealthAssessment[]> => {
  const { data, error } = await supabase
    .from('health_assessments')
    .select('*')
    .order('assessment_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

// 衛生記錄
export const getHygieneRecordsInDateRange = async (startDate: string, endDate: string): Promise<HygieneRecord[]> => {
  const { data, error } = await supabase
    .from('hygiene_records')
    .select('*')
    .gte('record_date', startDate)
    .lte('record_date', endDate)
    .order('record_date', { ascending: false });
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

// Intake/Output Records
// ============================================
// 出入量記錄 CRUD 操作
// ============================================

// 獲取出入量記錄 (包含關聯的 items)
export const getIntakeOutputRecords = async (): Promise<IntakeOutputRecord[]> => {
  const { data: records, error } = await supabase
    .from('intake_output_records')
    .select('*')
    .order('record_date', { ascending: false })
    .order('time_slot', { ascending: true });
  
  if (error) throw error;
  if (!records) return [];

  // 為每條記錄獲取關聯的items
  const recordsWithItems = await Promise.all(
    records.map(async (record) => {
      // 獲取攝入項目
      const { data: intakeItems, error: intakeError } = await supabase
        .from('intake_items')
        .select('*')
        .eq('record_id', record.id)
        .order('created_at', { ascending: true });
      
      if (intakeError) console.error('Error fetching intake items:', intakeError);

      // 獲取排出項目
      const { data: outputItems, error: outputError } = await supabase
        .from('output_items')
        .select('*')
        .eq('record_id', record.id)
        .order('created_at', { ascending: true });
      
      if (outputError) console.error('Error fetching output items:', outputError);

      return {
        ...record,
        intake_items: intakeItems || [],
        output_items: outputItems || []
      };
    })
  );

  return recordsWithItems;
};

// 獲取單條記錄及其所有關聯項目
export const getIntakeOutputRecordWithItems = async (recordId: string): Promise<IntakeOutputRecord | null> => {
  const { data: record, error: recordError } = await supabase
    .from('intake_output_records')
    .select('*')
    .eq('id', recordId)
    .single();
  
  if (recordError) throw recordError;
  if (!record) return null;

  // 獲取攝入項目
  const { data: intakeItems, error: intakeError } = await supabase
    .from('intake_items')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: true });
  
  if (intakeError) throw intakeError;

  // 獲取排出項目
  const { data: outputItems, error: outputError } = await supabase
    .from('output_items')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: true });
  
  if (outputError) throw outputError;

  return {
    ...record,
    intake_items: intakeItems || [],
    output_items: outputItems || []
  };
};

// 創建出入量記錄
export const createIntakeOutputRecord = async (
  record: Omit<IntakeOutputRecord, 'id' | 'created_at' | 'updated_at' | 'intake_items' | 'output_items'>
): Promise<IntakeOutputRecord> => {
  const { data, error } = await supabase
    .from('intake_output_records')
    .insert([record])
    .select()
    .single();
  if (error) throw error;
  return data;
};

// 更新出入量記錄
export const updateIntakeOutputRecord = async (
  id: string,
  updates: Partial<Omit<IntakeOutputRecord, 'id' | 'created_at' | 'updated_at' | 'intake_items' | 'output_items'>>
): Promise<IntakeOutputRecord | null> => {
  const { data, error } = await supabase
    .from('intake_output_records')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
};

// 刪除出入量記錄 (級聯刪除關聯的 items)
export const deleteIntakeOutputRecord = async (recordId: string): Promise<void> => {
  const { error } = await supabase
    .from('intake_output_records')
    .delete()
    .eq('id', recordId);
  if (error) throw error;
};

// ============================================
// 攝入項目 CRUD 操作
// ============================================

// 創建攝入項目
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

// 批量創建攝入項目
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

// 獲取記錄的所有攝入項目
export const getIntakeItems = async (recordId: string): Promise<IntakeItem[]> => {
  const { data, error } = await supabase
    .from('intake_items')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

// 刪除攝入項目
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

// 創建排出項目
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

// 批量創建排出項目
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

// 獲取記錄的所有排出項目
export const getOutputItems = async (recordId: string): Promise<OutputItem[]> => {
  const { data, error } = await supabase
    .from('output_items')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

// 刪除排出項目
export const deleteOutputItem = async (itemId: string): Promise<void> => {
  const { error } = await supabase
    .from('output_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
};
