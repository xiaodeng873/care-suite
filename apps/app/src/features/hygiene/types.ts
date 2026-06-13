export interface HygieneRecord {
  id: string;
  patient_id: number;
  record_date: string;
  time_slot: string;
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
  // 大便
  bowel_count?: number;
  bowel_amount?: string;
  bowel_consistency?: string;
  bowel_medication?: string;
  // 其他
  status_notes?: string;
  notes?: string;
  recorder: string;
  created_at: string;
  updated_at: string;
}

export const HYGIENE_ITEMS: { key: keyof HygieneRecord; label: string }[] = [
  { key: 'has_bath', label: '沐浴' },
  { key: 'has_face_wash', label: '洗面' },
  { key: 'has_shave', label: '剃鬚' },
  { key: 'has_oral_care', label: '洗牙漱口' },
  { key: 'has_denture_care', label: '洗口受假牙' },
  { key: 'has_haircut', label: '剪髮' },
  { key: 'has_nail_trim', label: '剪指甲' },
  { key: 'has_bedding_change', label: '換被套' },
  { key: 'has_sheet_pillow_change', label: '換床單枕袋' },
  { key: 'has_cup_wash', label: '洗杯' },
  { key: 'has_bedside_cabinet', label: '整理床頭櫃' },
  { key: 'has_wardrobe', label: '整理衣箱' },
];
