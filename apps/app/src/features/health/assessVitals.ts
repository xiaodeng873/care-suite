import type { HealthRecord } from './types';

export interface VitalAlerts {
  /** 收縮壓異常（< 90 或 > 160 mmHg）*/
  sbpAbnormal: boolean;
  /** 舒張壓異常（< 60 或 > 100 mmHg）*/
  dbpAbnormal: boolean;
  /** 血壓任一異常（UI 便利旗標）*/
  bpAbnormal: boolean;
  /** 血氧偏低（< 95 %）*/
  spo2Low: boolean;
  /** 體溫異常（< 35.5 或 > 37.5 °C）*/
  tempAbnormal: boolean;
  /** 血糖偏高（> 11.1 mmol/L）*/
  glucoseHigh: boolean;
  /** 血糖偏低（< 4.0 mmol/L）*/
  glucoseLow: boolean;
  /** 任一指標異常 */
  hasAlert: boolean;
}

type VitalsInput = Pick<
  HealthRecord,
  '血壓收縮壓' | '血壓舒張壓' | '血含氧量' | '體溫' | '血糖值'
>;

/**
 * 評估生命體徵是否超出正常範圍。
 * 未輸入（undefined / null）的指標不觸發警示。
 */
export function assessVitals(record: VitalsInput): VitalAlerts {
  const sbp = record.血壓收縮壓;
  const dbp = record.血壓舒張壓;
  const spo2 = record.血含氧量;
  const temp = record.體溫;
  const glucose = record.血糖值;

  const sbpAbnormal = sbp != null && (sbp < 90 || sbp > 160);
  const dbpAbnormal = dbp != null && (dbp < 60 || dbp > 100);
  const bpAbnormal = sbpAbnormal || dbpAbnormal;
  const spo2Low = spo2 != null && spo2 < 95;
  const tempAbnormal = temp != null && (temp < 35.5 || temp > 37.5);
  const glucoseHigh = glucose != null && glucose > 11.1;
  const glucoseLow = glucose != null && glucose < 4.0;
  const hasAlert = bpAbnormal || spo2Low || tempAbnormal || glucoseHigh || glucoseLow;

  return { sbpAbnormal, dbpAbnormal, bpAbnormal, spo2Low, tempAbnormal, glucoseHigh, glucoseLow, hasAlert };
}
