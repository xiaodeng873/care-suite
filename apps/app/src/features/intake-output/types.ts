export type IntakeCategory = 'meal' | 'beverage' | 'other' | 'tube_feeding';
export type IntakeUnit = 'portion' | 'ml' | 'piece';
export type OutputCategory = 'urine' | 'gastric';

export interface IntakeItem {
  id: string;
  record_id: string;
  category: IntakeCategory;
  item_type: string;
  amount: string;
  amount_numeric: number;
  unit: IntakeUnit;
  created_at: string;
}

export interface OutputItem {
  id: string;
  record_id: string;
  category: OutputCategory;
  color?: string;
  ph_value?: number;
  amount_ml: number;
  created_at: string;
}

export interface IntakeOutputRecord {
  id: string;
  patient_id: number;
  record_date: string;
  hour_slot: number;
  time_slot: string;
  recorder: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  intake_items?: IntakeItem[];
  output_items?: OutputItem[];
}

export const INTAKE_CATEGORY_LABEL: Record<IntakeCategory, string> = {
  meal: '餐膳',
  beverage: '飲料',
  tube_feeding: '鼻胃飼',
  other: '其他',
};

export const OUTPUT_CATEGORY_LABEL: Record<OutputCategory, string> = {
  urine: '尿液',
  gastric: '胃液',
};

export const UNIT_LABEL: Record<IntakeUnit, string> = {
  portion: '份',
  ml: 'ml',
  piece: '件',
};
