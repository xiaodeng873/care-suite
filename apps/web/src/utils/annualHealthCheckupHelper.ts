import { supabase } from '../lib/supabase';

export interface AnnualHealthCheckup {
  id: string;
  patient_id: number;
  last_doctor_signature_date: string | null;
  next_due_date: string | null;

  has_serious_illness: boolean;
  serious_illness_details: string | null;
  has_allergy: boolean;
  allergy_details: string | null;
  has_infectious_disease: boolean;
  infectious_disease_details: string | null;
  needs_followup_treatment: boolean;
  followup_treatment_details: string | null;
  has_swallowing_difficulty: boolean;
  swallowing_difficulty_details: string | null;
  has_special_diet: boolean;
  special_diet_details: string | null;
  mental_illness_record: string | null;

  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  pulse: number | null;
  body_weight: number | null;
  physical_exam_specify: string | null;

  cardiovascular_notes: string | null;
  respiratory_notes: string | null;
  central_nervous_notes: string | null;
  musculo_skeletal_notes: string | null;
  abdomen_urogenital_notes: string | null;
  lymphatic_notes: string | null;
  thyroid_notes: string | null;
  skin_condition_notes: string | null;
  foot_notes: string | null;
  eye_ear_nose_throat_notes: string | null;
  oral_dental_notes: string | null;
  physical_exam_others: string | null;

  vision_assessment: string | null;
  with_visual_corrective_devices: boolean | null;
  hearing_assessment: string | null;
  with_hearing_aids: boolean | null;
  speech_assessment: string | null;
  mental_state_assessment: string | null;
  mobility_assessment: string | null;
  continence_assessment: string | null;
  adl_assessment: string | null;

  recommendation: string | null;

  created_at: string;
  updated_at: string;
}

export interface LatestHealthReadings {
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  pulse: number | null;
  body_weight: number | null;
}

export interface MentalStateData {
  mental_state: string;
  dementia_stage: string;
}

export type CheckupStatus = '有效' | '即將到期' | '已逾期' | '未簽署';

export const VISION_OPTIONS = [
  '正常',
  '不能閱讀報紙字體',
  '不能觀看電視',
  '只能見光影'
];

export const HEARING_OPTIONS = [
  '正常',
  '難以正常聲浪溝通',
  '難以話語的情況下也難以溝通',
  '大聲話語情況下也不能溝通'
];

export const SPEECH_OPTIONS = [
  '能正常表達',
  '需慢慢表達',
  '需靠提示表達',
  '不能以語言表達'
];

export const MENTAL_STATE_GROUP_A = [
  '正常警覺穩定',
  '輕度受困擾',
  '中度受困擾',
  '嚴重受困擾'
];

export const MENTAL_STATE_GROUP_B = [
  '早期認知障礙症',
  '中期認知障礙症',
  '後期認知障礙症'
];

export const MENTAL_STATE_OPTIONS = [
  ...MENTAL_STATE_GROUP_A,
  ...MENTAL_STATE_GROUP_B
];

export const MOBILITY_OPTIONS = [
  '獨立行動',
  '可自行用助行器或輪椅移動',
  '經常需要別人幫助',
  '長期臥床'
];

export const CONTINENCE_OPTIONS = [
  '正常',
  '偶然大小便失禁',
  '頻繁大小便失禁',
  '大小便完全失禁'
];

export const ADL_OPTIONS = [
  {
    value: '完全獨立',
    description: '於洗滌、穿衣、如廁、位置轉移、大小便禁制及進食方面均無需指導或協助'
  },
  {
    value: '偶爾需要協助',
    description: '於洗滌時需要協助及於其他日常生活活動方面需要指導或協助'
  },
  {
    value: '經常需要協助',
    description: '於洗滌及其他不超過四項日常生活活動方面需要指導或協助'
  },
  {
    value: '完全需要協助',
    description: '於日常生活活動方面均需要完全的協助'
  }
];

export const RECOMMENDATION_OPTIONS = [
  {
    value: '低度照顧安老院',
    description: '即提供住宿照顧、監管及指導予年滿60歲人士的機構，而該等人士有能力保持個人衛生，亦有能力處理關於清潔、烹飪、洗衣、購物的家居工作及其他家務'
  },
  {
    value: '中度照顧安老院',
    description: '即提供住宿照顧、監管及指導予年滿60歲人士的機構，而該等人士有能力保持個人衛生，但在處理關於清潔、烹飪、洗衣、購物的家居工作及其他家務方面，有一定程度的困難'
  },
  {
    value: '高度照顧安老院',
    description: '即提供住宿照顧、監管及指導予年滿60歲人士的機構，而該等人士一般健康欠佳，而且身體機能喪失或衰退，以致在日常起居方面需要專人照顧料理，但不需要高度的專業醫療或護理'
  },
  {
    value: '護養院',
    description: '即提供住宿照顧、監管及指導予年滿60歲人士的機構，而該等人士身體機能喪失，程度達到在日常起居方面，需要專人照顧料理及高度的專業護理，但不需要持續醫療監管'
  }
];

export function calculateNextDueDate(lastSignatureDate: string): string {
  const date = new Date(lastSignatureDate);
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split('T')[0];
}

export function getCheckupStatus(checkup: AnnualHealthCheckup): CheckupStatus {
  if (!checkup.last_doctor_signature_date || !checkup.next_due_date) {
    return '未簽署';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDueDate = new Date(checkup.next_due_date);
  nextDueDate.setHours(0, 0, 0, 0);

  const diffTime = nextDueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return '已逾期';
  } else if (diffDays <= 14) {
    return '即將到期';
  } else {
    return '有效';
  }
}

export function isOverdue(checkup: AnnualHealthCheckup): boolean {
  return getCheckupStatus(checkup) === '已逾期';
}

export function isDueSoon(checkup: AnnualHealthCheckup): boolean {
  return getCheckupStatus(checkup) === '即將到期';
}

export function getStatusColor(status: CheckupStatus): string {
  switch (status) {
    case '有效':
      return 'bg-green-100 text-green-800';
    case '即將到期':
      return 'bg-orange-100 text-orange-800';
    case '已逾期':
      return 'bg-red-100 text-red-800';
    case '未簽署':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export async function getLatestHealthReadings(patientId: number): Promise<LatestHealthReadings> {
  const result: LatestHealthReadings = {
    blood_pressure_systolic: null,
    blood_pressure_diastolic: null,
    pulse: null,
    body_weight: null
  };

  try {
    const { data: vitalSignRecords } = await supabase
      .from('健康記錄主表')
      .select('血壓收縮壓, 血壓舒張壓, 脈搏')
      .eq('院友id', patientId)
      .eq('記錄類型', '生命表徵')
      .not('血壓收縮壓', 'is', null)
      .order('記錄日期', { ascending: false })
      .order('記錄時間', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vitalSignRecords) {
      if (vitalSignRecords.血壓收縮壓) {
        result.blood_pressure_systolic = vitalSignRecords.血壓收縮壓;
      }
      if (vitalSignRecords.血壓舒張壓) {
        result.blood_pressure_diastolic = vitalSignRecords.血壓舒張壓;
      }
      if (vitalSignRecords.脈搏) {
        result.pulse = vitalSignRecords.脈搏;
      }
    }

    const { data: bodyWeightRecord } = await supabase
      .from('健康記錄主表')
      .select('體重')
      .eq('院友id', patientId)
      .eq('記錄類型', '體重控制')
      .not('體重', 'is', null)
      .order('記錄日期', { ascending: false })
      .order('記錄時間', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bodyWeightRecord && bodyWeightRecord.體重) {
      result.body_weight = bodyWeightRecord.體重;
    }
  } catch (error) {
    console.error('Error fetching latest health readings:', error);
  }

  return result;
}

export function parseMentalStateAssessment(value: string | null): MentalStateData {
  if (!value) {
    return { mental_state: '', dementia_stage: '' };
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        mental_state: parsed.mental_state || '',
        dementia_stage: parsed.dementia_stage || ''
      };
    }
  } catch {
    if (MENTAL_STATE_GROUP_A.includes(value)) {
      return { mental_state: value, dementia_stage: '' };
    }
    if (MENTAL_STATE_GROUP_B.includes(value)) {
      return { mental_state: '', dementia_stage: value };
    }
  }

  return { mental_state: '', dementia_stage: '' };
}

export function combineMentalStateAssessment(mental_state: string, dementia_stage: string): string {
  if (!mental_state && !dementia_stage) {
    return '';
  }

  return JSON.stringify({
    mental_state: mental_state || '',
    dementia_stage: dementia_stage || ''
  });
}

export function formatMentalStateForDisplay(value: string | null): string {
  if (!value) return '';

  const parsed = parseMentalStateAssessment(value);
  const parts = [];

  if (parsed.mental_state) {
    parts.push(parsed.mental_state);
  }
  if (parsed.dementia_stage) {
    parts.push(parsed.dementia_stage);
  }

  return parts.join(' | ');
}
