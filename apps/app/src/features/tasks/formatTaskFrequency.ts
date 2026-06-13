import { FREQUENCY_UNITS, type FrequencyUnit } from './constants';

/**
 * 將工作頻率轉換成繁體中文顯示字串。
 * 例：formatTaskFrequency(2, 'weekly') → '每2每週'
 *
 * @param value   頻率數值（空字串時回退到 '1'）
 * @param unit    頻率單位
 */
export function formatTaskFrequency(value: number | string, unit: FrequencyUnit): string {
  const label = FREQUENCY_UNITS.find((f) => f.key === unit)?.label ?? unit;
  const v = value || '1';
  return `每${v}${label}`;
}
