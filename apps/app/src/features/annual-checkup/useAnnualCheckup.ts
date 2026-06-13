import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── 完全對應 web annual_health_checkups 表結構（年度體檢 SOP 表）─────────────
export interface AnnualCheckup {
  id: string;
  patient_id: number;
  last_doctor_signature_date?: string;
  next_due_date?: string;
  // Part I: 病歷資訊
  has_serious_illness?: boolean;
  serious_illness_details?: string;
  has_allergy?: boolean;
  allergy_details?: string;
  has_infectious_disease?: boolean;
  infectious_disease_details?: string;
  needs_followup_treatment?: boolean;
  followup_treatment_details?: string;
  has_swallowing_difficulty?: boolean;
  swallowing_difficulty_details?: string;
  has_special_diet?: boolean;
  special_diet_details?: string;
  mental_illness_record?: string;
  // Part II: 身體檢查
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  pulse?: number;
  body_weight?: number;
  // Part III: 各系統檢查備註
  cardiovascular_notes?: string;
  respiratory_notes?: string;
  central_nervous_notes?: string;
  musculo_skeletal_notes?: string;
  abdomen_urogenital_notes?: string;
  lymphatic_notes?: string;
  thyroid_notes?: string;
  skin_condition_notes?: string;
  foot_notes?: string;
  eye_ear_nose_throat_notes?: string;
  oral_dental_notes?: string;
  physical_exam_others?: string;
  // Part IV: 身體機能評估
  vision_assessment?: string;
  with_visual_corrective_devices?: boolean | null;
  hearing_assessment?: string;
  with_hearing_aids?: boolean | null;
  speech_assessment?: string;
  mental_state_assessment?: string;
  mobility_assessment?: string;
  continence_assessment?: string;
  adl_assessment?: string;
  // Part V: 建議
  recommendation?: string;
  created_at: string;
  updated_at: string;
}

// ─── 選項常數（完全對應 web annualHealthCheckupHelper.ts）────────────────────
export const VISION_OPTIONS = ['正常', '不能閱讀報紙字體', '不能觀看電視', '只能見光影'] as const;
export const HEARING_OPTIONS = ['正常', '難以正常聲浪溝通', '難以話語的情況下也難以溝通', '大聲話語情況下也不能溝通'] as const;
export const SPEECH_OPTIONS = ['能正常表達', '需慢慢表達', '需靠提示表達', '不能以語言表達'] as const;
export const MENTAL_STATE_GROUP_A = ['正常警覺穩定', '輕度受困擾', '中度受困擾', '嚴重受困擾'] as const;
export const MENTAL_STATE_GROUP_B = ['早期認知障礙症', '中期認知障礙症', '後期認知障礙症'] as const;
export const MOBILITY_OPTIONS = ['獨立行動', '可自行用助行器或輪椅移動', '經常需要別人幫助', '長期臥床'] as const;
export const CONTINENCE_OPTIONS = ['正常', '偶然大小便失禁', '頻繁大小便失禁', '大小便完全失禁'] as const;
export const ADL_OPTIONS: { value: string; description: string }[] = [
  { value: '完全獨立', description: '於洗滌、穿衣、如廁、位置轉移、大小便禁制及進食方面均無需指導或協助' },
  { value: '偶爾需要協助', description: '於洗滌時需要協助及於其他日常生活活動方面需要指導或協助' },
  { value: '經常需要協助', description: '於洗滌及其他不超過四項日常生活活動方面需要指導或協助' },
  { value: '完全需要協助', description: '於日常生活活動方面均需要完全的協助' },
];
export const RECOMMENDATION_OPTIONS: { value: string; description: string }[] = [
  { value: '低度照顧安老院', description: '提供住宿照顧、監管及指導予年滿60歲人士，該等人士有能力保持個人衛生，亦有能力處理家居工作及其他家務' },
  { value: '中度照顧安老院', description: '該等人士有能力保持個人衛生，但在處理清潔、烹飪、洗衣、購物等家居工作方面有一定程度的困難' },
  { value: '高度照顧安老院', description: '該等人士一般健康欠佳，身體機能喪失或衰退，日常起居需要專人照顧，但不需要高度專業醫療或護理' },
  { value: '護養院', description: '該等人士身體機能喪失，日常起居需要專人照顧料理及高度專業護理，但不需要持續醫療監管' },
];

// 病歷布林＋說明欄位對應
export const MEDICAL_HISTORY_FIELDS: { boolKey: keyof AnnualCheckup; detailKey: keyof AnnualCheckup; label: string }[] = [
  { boolKey: 'has_serious_illness', detailKey: 'serious_illness_details', label: '嚴重疾病' },
  { boolKey: 'has_allergy', detailKey: 'allergy_details', label: '藥物敏感' },
  { boolKey: 'has_infectious_disease', detailKey: 'infectious_disease_details', label: '傳染病' },
  { boolKey: 'needs_followup_treatment', detailKey: 'followup_treatment_details', label: '需要跟進治療' },
  { boolKey: 'has_swallowing_difficulty', detailKey: 'swallowing_difficulty_details', label: '吞嚥困難' },
  { boolKey: 'has_special_diet', detailKey: 'special_diet_details', label: '特別飲食' },
];

// 各系統檢查欄位
export const PHYSICAL_EXAM_FIELDS: { key: keyof AnnualCheckup; label: string }[] = [
  { key: 'cardiovascular_notes', label: '循環系統' },
  { key: 'respiratory_notes', label: '呼吸系統' },
  { key: 'central_nervous_notes', label: '中樞神經系統' },
  { key: 'musculo_skeletal_notes', label: '肌骨' },
  { key: 'abdomen_urogenital_notes', label: '腹部／泌尿及生殖系統' },
  { key: 'lymphatic_notes', label: '淋巴系統' },
  { key: 'thyroid_notes', label: '甲狀腺' },
  { key: 'skin_condition_notes', label: '皮膚狀況（如壓瘡）' },
  { key: 'foot_notes', label: '足部' },
  { key: 'eye_ear_nose_throat_notes', label: '眼／耳鼻喉' },
  { key: 'oral_dental_notes', label: '口腔／牙齒狀況' },
  { key: 'physical_exam_others', label: '其他' },
];

export function useAnnualCheckups() {
  return useQuery({
    queryKey: ['annual-checkups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('annual_health_checkups')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnnualCheckup[];
    },
  });
}

export function useCreateAnnualCheckup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checkup: Omit<AnnualCheckup, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('annual_health_checkups')
        .upsert([checkup], { onConflict: 'patient_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annual-checkups'] }),
  });
}

export function useUpdateAnnualCheckup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checkup: AnnualCheckup) => {
      const { data, error } = await supabase
        .from('annual_health_checkups')
        .update({ ...checkup, updated_at: new Date().toISOString() })
        .eq('id', checkup.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annual-checkups'] }),
  });
}

export function useDeleteAnnualCheckup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('annual_health_checkups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annual-checkups'] }),
  });
}

/** 依 last_doctor_signature_date + 1 年計算下次到期日 */
export function calcNextDueDate(signatureDate: string): string {
  const d = new Date(signatureDate);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}
