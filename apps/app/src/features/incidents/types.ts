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
  physical_discomfort?: Record<string, any>;
  unsafe_behavior?: Record<string, any>;
  environmental_factors?: Record<string, any>;
  incident_details?: string;
  treatment_date?: string;
  treatment_time?: string;
  vital_signs?: Record<string, any>;
  consciousness_level?: string;
  limb_movement?: { status?: string; details?: string; abnormal_limbs?: string[] };
  injury_situation?: Record<string, any>;
  patient_complaint?: string;
  immediate_treatment?: Record<string, any>;
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
  hospital_treatment?: Record<string, any>;
  hospital_admission?: { hospital?: string; floor?: string; ward?: string; bed_number?: string };
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

export const COMMON_INCIDENT_TYPES = ['跌倒', '其他'] as const;

export const INCIDENT_LOCATIONS = ['客廳/飯廳', '走廊', '廁所', '浴室', '床邊', '其他地方'] as const;

export const MEDICAL_ARRANGEMENTS = ['急症室', '門診', '醫生到診', '沒有送院'] as const;

// ─── 完全對應 web IncidentReportModal 的選項常數 ──────────────────────────────
export const LOCATION_OPTIONS = ['客廳/飯廳', '走廊', '廁所', '浴室', '床邊', '其他地方'] as const;
export const ACTIVITY_OPTIONS = ['躺臥', '站立', '步行', '起身下床/上床', '過床/椅/便椅/沖涼椅', '進食', '梳洗', '如廁', '洗澡', '穿/脫衣服', '其他'] as const;
export const DISCOMFORT_OPTIONS = ['下肢乏力', '關節疼痛', '暈眩', '暈倒', '心跳', '胸部劑痛', '其他', '不適用'] as const;
export const UNSAFE_BEHAVIOR_OPTIONS = ['不安全的動作', '沒有使用合適輔助工具', '沒有找人幫助', '其他', '不適用'] as const;
export const ENVIRONMENTAL_OPTIONS = ['地面濕滑/不平', '光線不足', '傢俬移動(如輪椅/便椅未上鎖)', '雜物障礙', '褲過長', '鞋覆問題', '被別人碰到', '其他', '不適用'] as const;
export const CONSCIOUSNESS_OPTIONS = ['清醒', '混亂', '昏迷'] as const;
export const INJURY_OPTIONS = ['無皮外傷', '表皮擦損', '瘀腫', '骨折', '其他'] as const;
export const TREATMENT_OPTIONS = ['包紮傷口', '其他', '不適用'] as const;
export const MEDICAL_ARRANGEMENT_OPTIONS = ['急症室', '門診', '醫生到診', '沒有送院'] as const;
export const RELATIONSHIP_OPTIONS = ['保證人', '監護人', '家人', '其他'] as const;
export const HOSPITAL_TREATMENT_OPTIONS = ['照X光', '預防破傷風針注射', '洗傷口', '縫針', '不需要留醫', '返回護理院/家', '其他治療(例如藥物等)', '醫院留醫'] as const;
export const ABNORMAL_LIMB_OPTIONS = ['左手', '右手', '左腳', '右腳'] as const;

export const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  跌倒: { bg: 'bg-orange-100', text: 'text-orange-700' },
  其他: { bg: 'bg-gray-100',   text: 'text-gray-600' },
};
