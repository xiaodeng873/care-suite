export type WoundType = 'pressure_ulcer' | 'trauma' | 'surgical' | 'diabetic' | 'venous' | 'arterial' | 'other';
export type WoundStatus = 'active' | 'healed' | 'transferred';
export type WoundOrigin = 'facility' | 'admission' | 'hospital_referral';
export type WoundStage = '階段1' | '階段2' | '階段3' | '階段4' | '無法評估';
export type WoundAssessmentStatus = 'untreated' | 'treating' | 'improving' | 'healed';

export interface Wound {
  id: string;
  patient_id: number;
  wound_code: string;
  wound_name?: string;
  discovery_date: string;
  wound_location?: { x: number; y: number; side: string };
  wound_type: WoundType;
  wound_type_other?: string;
  wound_origin: WoundOrigin;
  status: WoundStatus;
  healed_date?: string;
  next_assessment_due?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface WoundAssessment {
  id: string;
  patient_id: number;
  wound_id?: string;
  assessment_date: string;
  next_assessment_date?: string;
  assessor?: string;
  stage?: WoundStage;
  wound_status?: WoundAssessmentStatus;
  area_length?: number;
  area_width?: number;
  area_depth?: number;
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
  cleanser?: string;
  dressings?: string[];
  remarks?: string;
  created_at: string;
}

export const WOUND_TYPE_LABEL: Record<WoundType, string> = {
  pressure_ulcer: '壓瘡',
  trauma: '創傷',
  surgical: '手術傀口',
  diabetic: '糖尿病傀口',
  venous: '靜脈性潰瑞',
  arterial: '動脈性潰瑞',
  other: '其他',
};

export const WOUND_STATUS_COLOR: Record<WoundStatus, string> = {
  active: 'bg-red-100 text-red-700',
  healed: 'bg-green-100 text-green-700',
  transferred: 'bg-gray-100 text-gray-600',
};

export const WOUND_STATUS_LABEL: Record<WoundStatus, string> = {
  active: '進行中',
  healed: '已痊癒',
  transferred: '已轉移',
};

export const WOUND_ORIGIN_LABEL: Record<WoundOrigin, string> = {
  facility: '本院發現',
  admission: '入院時已有',
  hospital_referral: '醫院轉介',
};

export const RESPONSIBLE_UNIT_LABEL: Record<string, string> = {
  community_health: '社康',
  cgat: 'CGAT',
  facility_staff: '本院職員',
  other: '其他',
};

export const ASSESSMENT_STATUS_COLOR: Record<WoundAssessmentStatus, string> = {
  untreated: 'bg-gray-100 text-gray-700',
  treating: 'bg-yellow-100 text-yellow-700',
  improving: 'bg-blue-100 text-blue-700',
  healed: 'bg-green-100 text-green-700',
};

export const ASSESSMENT_STATUS_LABEL: Record<WoundAssessmentStatus, string> = {
  untreated: '未處理',
  treating: '處理中',
  improving: '改善中',
  healed: '已癒合',
};
