/**
 * 處方日誌工具：欄位中文標籤、值格式化、逐欄差異計算
 */
import type { PrescriptionFieldChange } from '../lib/database';
import { formatMealTimingFrom } from './mealTiming';

export const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: '在服處方',
  pending_change: '待變更處方',
  inactive: '停用處方',
};

const FREQUENCY_TYPE_LABELS: Record<string, string> = {
  daily: '每日服',
  every_x_days: '每N日服',
  every_x_weeks: '每N星期服',
  every_x_months: '每N月服',
  weekly_days: '指定星期',
  odd_even_days: '單雙日服',
  hourly: '每N小時服',
  each_time: '每次',
};

const PREPARATION_METHOD_LABELS: Record<string, string> = {
  immediate: '即時備藥',
  advanced: '提前備藥',
  custom: '自理',
};

const ODD_EVEN_LABELS: Record<string, string> = {
  odd: '單日',
  even: '雙日',
  none: '無',
};

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

// 檢測項規則 → 中文句式（同藥物一覽表注意事項欄一致，行動用「注意」）
const INSPECTION_OP_LABELS: Record<string, string> = {
  gt: '大於',
  lt: '小於',
  gte: '大於或等於',
  lte: '小於或等於',
};
const INSPECTION_ACTION_LABELS: Record<string, string> = {
  block_dispensing: '停服一次',
  warning_only: '注意',
  dispense_if_met: '才需服用',
};
const INSPECTION_UNIT_LABELS: Record<string, string> = {
  上壓: 'mmHg',
  下壓: 'mmHg',
  脈搏: '/min',
  血糖值: 'mmol/L',
  呼吸: '/min',
  血含氧量: '%',
  體溫: '°C',
};
const formatInspectionRuleValue = (value: any): string => {
  if (!Array.isArray(value)) return String(value);
  if (value.length === 0) return '（空）';
  return value.map((r: any) => {
    const op = INSPECTION_OP_LABELS[r?.condition_operator ?? ''] ?? '';
    const action = INSPECTION_ACTION_LABELS[r?.action_if_met ?? ''] ?? (r?.action_if_met ?? '');
    const unit = INSPECTION_UNIT_LABELS[r?.vital_sign_type ?? ''] ?? '';
    return `${r?.vital_sign_type ?? ''}${op}${r?.condition_value ?? ''}${unit}時${action}`;
  }).join('、');
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  create: '新增處方',
  update: '更新處方',
  delete: '刪除處方',
  status_change: '狀態遷移',
  replace: '取代處方',
  batch_date_update: '批次更新處方日期',
  restore: '還原操作',
};

// 需要逐欄比較的處方欄位（依顯示順序）
const FIELD_DEFINITIONS: { field: string; label: string }[] = [
  { field: 'medication_name', label: '藥物名稱' },
  { field: 'medication_source', label: '藥物來源' },
  { field: 'prescription_date', label: '處方日期' },
  { field: 'start_date', label: '開始日期' },
  { field: 'start_time', label: '開始時間' },
  { field: 'end_date', label: '結束日期' },
  { field: 'end_time', label: '結束時間' },
  { field: 'dosage_form', label: '劑型' },
  { field: 'administration_route', label: '服用途徑' },
  { field: 'dosage_amount', label: '服用份量' },
  { field: 'dosage_unit', label: '單位' },
  { field: 'special_dosage_instruction', label: '特殊用法' },
  { field: 'frequency_type', label: '頻率類型' },
  { field: 'frequency_value', label: '頻率值' },
  { field: 'daily_frequency', label: '每日次數' },
  { field: 'specific_weekdays', label: '指定星期' },
  { field: 'is_odd_even_day', label: '單雙日' },
  { field: 'is_prn', label: '需要時 (PRN)' },
  { field: 'medication_time_slots', label: '服用時段' },
  { field: 'meal_timings', label: '餐次' },
  { field: 'preparation_method', label: '備藥方式' },
  { field: 'medication_quantity', label: '藥物數量' },
  { field: 'medication_days', label: '藥物日數' },
  { field: 'cannot_crush', label: '不可磨碎' },
  { field: 'inspection_rules', label: '檢測項' },
  { field: 'notes', label: '備註' },
  { field: 'status', label: '處方狀態' },
];

export function formatFieldValue(field: string, value: any): string {
  if (value === null || value === undefined || value === '') return '（空）';

  switch (field) {
    case 'inspection_rules':
      return formatInspectionRuleValue(value);
    case 'status':
      return PRESCRIPTION_STATUS_LABELS[value] || String(value);
    case 'frequency_type':
      return FREQUENCY_TYPE_LABELS[value] || String(value);
    case 'preparation_method':
      return PREPARATION_METHOD_LABELS[value] || String(value);
    case 'is_odd_even_day':
      return ODD_EVEN_LABELS[value] || String(value);
    case 'is_prn':
    case 'cannot_crush':
      return value === true || value === 'true' ? '是' : '否';
    case 'specific_weekdays':
      if (Array.isArray(value)) {
        if (value.length === 0) return '（空）';
        return value.map((d: number) => `星期${WEEKDAY_NAMES[d] ?? d}`).join('、');
      }
      return String(value);
    case 'medication_time_slots':
      if (Array.isArray(value)) {
        return value.length === 0 ? '（空）' : value.join('、');
      }
      return String(value);
    case 'meal_timings':
      return formatMealTimingFrom({ meal_timings: value }) || '（空）';
    default:
      return String(value);
  }
}

// 將值正規化為可比較的字串（處理陣列 / 空值差異）
function normalizeForCompare(field: string, value: any): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    if (value.length === 0) return ''; // 空陣列視同空值（undefined ↔ [] 唔算變更）
    // 物件陣列（檢測項）順序冇意義嘅 sort 做唔到，直接序列化；原始陣列（星期/時段）排序後比較
    return typeof value[0] === 'object' && value[0] !== null
      ? JSON.stringify(value)
      : JSON.stringify([...value].sort());
  }
  if (typeof value === 'object') return JSON.stringify(value); // meal_timings 等 jsonb 物件
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * 比較兩份處方，回傳逐欄 old→new 差異清單。
 */
export function diffPrescriptions(oldP: any, newP: any): PrescriptionFieldChange[] {
  const changes: PrescriptionFieldChange[] = [];
  if (!oldP || !newP) return changes;

  for (const { field, label } of FIELD_DEFINITIONS) {
    const oldVal = oldP[field];
    const newVal = newP[field];
    if (normalizeForCompare(field, oldVal) !== normalizeForCompare(field, newVal)) {
      changes.push({
        field,
        label,
        old: formatFieldValue(field, oldVal),
        new: formatFieldValue(field, newVal),
      });
    }
  }
  return changes;
}
