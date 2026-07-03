export type CareTabType = 'patrol' | 'diaper' | 'position' | 'hygiene';

export const CARE_TABS: { key: CareTabType; label: string; icon: string }[] = [
  { key: 'patrol',   label: '巡房記錄', icon: 'clipboard-outline' },
  { key: 'diaper',   label: '換片記錄', icon: 'water-outline' },
  { key: 'position', label: '轉身記錄', icon: 'refresh-outline' },
  { key: 'hygiene',  label: '衛生記錄', icon: 'medical-outline' },
];

export const TIME_SLOTS = [
  '07:00','09:00','11:00','13:00','15:00','17:00',
  '19:00','21:00','23:00','01:00','03:00','05:00',
];

export const DIAPER_SLOTS = [
  '7AM-10AM','11AM-2PM','3PM-6PM','7PM-10PM','11PM-2AM','3AM-6AM',
];

export interface PatrolRound {
  id: string;
  patient_id: number;
  patrol_date: string;
  patrol_time: string;
  scheduled_time: string;
  recorder: string;
  co_signer?: string | null;
  notes?: string;
  created_at: string;
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
  notes?: string;
  recorder: string;
  created_at: string;
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
}

export interface HygieneRecord {
  id: string;
  patient_id: number;
  record_date: string;
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
  bowel_count: number | null;
  bowel_amount: string | null;
  bowel_consistency: string | null;
  bowel_medication: string | null;
  status_notes?: string;
  recorder: string;
  created_at: string;
}
