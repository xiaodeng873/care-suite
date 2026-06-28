/** 7 種生命表徵監測類型 */
export type VitalSignType = '血壓' | '脈搏' | '體溫' | '血含氧量' | '呼吸' | '血糖值' | '體重';

/** @deprecated 保留互相容，新代碼請使用 VitalSignType */
export type HealthRecordType = VitalSignType;

export interface HealthRecord {
  記錄id: string;          // UUID
  院友id: number;
  任務id?: string;
  記錄日期: string;
  記錄時間: string;
  監測類型: VitalSignType;
  數值: number;
  數值_副?: number;          // 僅血壓使用（舒張壓）
  備註?: string;
  記錄人員?: string;
  建立時間?: string;
}
