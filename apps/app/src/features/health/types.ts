export type HealthRecordType = '生命表徵' | '血糖控制' | '體重控制';

export interface HealthRecord {
  記錄id: number;
  院友id: number;
  task_id?: string;
  記錄日期: string;
  記錄時間: string;
  記錄類型: HealthRecordType;
  血壓收縮壓?: number;
  血壓舒張壓?: number;
  脈搏?: number;
  體溫?: number;
  血含氧量?: number;
  呼吸頻率?: number;
  血糖值?: number;
  體重?: number;
  備註?: string;
  記錄人員?: string;
  created_at?: string;
}
