export type PrescriptionStatusType = 'active' | 'inactive' | 'discontinued';
export type MedicationFrequencyType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'specific_days' | 'odd_even';
export type OddEvenDayType = 'none' | 'odd' | 'even';
export type PreparationMethodType = 'normal' | 'crush' | 'dissolve' | 'other';
export type WorkflowStatusType = 'pending' | 'completed' | 'failed';
export type DispensingFailureReason = '回家' | '入院' | '拒服' | '略去' | '藥物不足' | '其他';

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
  dosage_unit?: string;
  frequency_type: MedicationFrequencyType;
  frequency_value?: number;
  specific_weekdays?: number[];
  is_odd_even_day: OddEvenDayType;
  daily_frequency?: number;
  is_prn: boolean;
  medication_time_slots?: string[];
  meal_timing?: string;
  notes?: string;
  preparation_method: PreparationMethodType;
  status: PrescriptionStatusType;
  medication_source: string;
  created_at: string;
  updated_at: string;
}

export interface MedicationWorkflowRecord {
  id: string;
  prescription_id: string;
  patient_id: number;
  scheduled_date: string;
  scheduled_time: string;
  preparation_status: WorkflowStatusType;
  verification_status: WorkflowStatusType;
  dispensing_status: WorkflowStatusType;
  preparation_staff?: string;
  verification_staff?: string;
  dispensing_staff?: string;
  preparation_time?: string;
  verification_time?: string;
  dispensing_time?: string;
  dispensing_failure_reason?: DispensingFailureReason;
  custom_failure_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
