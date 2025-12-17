// 超簡版 DB 型別（手動）——只列出你正在用的表與欄位

// 巡房記錄（patrol_rounds）——注意：已移除 notes 欄位
export interface PatrolRound {
  id?: string;            // uuid（插入時可不傳，DB 會給）
  patient_id: number;     // integer
  patrol_date: string;    // YYYY-MM-DD
  patrol_time: string;    // HH:MM:SS
  scheduled_time: string; // 例如 "07:00"
  recorder: string;
  created_at?: string;    // timestamptz
  updated_at?: string;    // timestamptz
}

// 換片記錄（diaper_change_records）——保留 notes 欄位（用來寫入「入院／渡假／外出」）
export interface DiaperChangeRecord {
  id?: string;
  patient_id: number;
  change_date: string;    // YYYY-MM-DD
  time_slot: string;      // 例如 "7AM-10AM"
  has_urine?: boolean;
  has_stool?: boolean;
  has_none?: boolean;
  urine_amount?: string;  // 多/中/少
  stool_color?: string;   // 正常/有血/有潺/黑便
  stool_texture?: string; // 硬/軟/稀
  stool_amount?: string;  // 多/中/少
  notes?: string;         // 在這裡填「入院／渡假／外出」
  recorder: string;
  created_at?: string;
  updated_at?: string;
}

// 約束物品觀察（restraint_observation_records）——保留 notes 欄位
export interface RestraintObservationRecord {
  id?: string;
  patient_id: number;
  observation_date: string; // YYYY-MM-DD
  observation_time: string; // HH:MM:SS
  scheduled_time: string;
  observation_status: 'N' | 'P' | 'S';
  recorder: string;
  notes?: string;           // 在這裡填「入院／渡假／外出」
  created_at?: string;
  updated_at?: string;
}

// 轉身記錄（position_change_records）——保留 notes 欄位
export interface PositionChangeRecord {
  id?: string;
  patient_id: number;
  change_date: string;   // YYYY-MM-DD
  scheduled_time: string;
  position: '左' | '平' | '右';
  recorder: string;
  notes?: string;        // 在這裡填「入院／渡假／外出」
  created_at?: string;
  updated_at?: string;
}