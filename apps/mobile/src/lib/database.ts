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
  tab_type: 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training';
  is_manually_added: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
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
    .eq('is_hidden', false)
    .order('tab_type', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getHealthAssessments = async (): Promise<HealthAssessment[]> => {
  const { data, error } = await supabase
    .from('health_assessments')
    .select('*')
    .order('assessment_date', { ascending: false });
  if (error) throw error;
  return data || [];
};
