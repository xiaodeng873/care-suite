/*
  # 入住類型 enum 錯字修正：「院舍卷」→「院舍券」

  admission_type_enum 嘅兩個值有錯字（「卷」應為「券」），
  呢度直接 RENAME VALUE 修正 enum 真值，現有資料自動跟住改。
  新表 patient_stay_log（20260924000000）嘅 CHECK 約束已直接用新值。
*/

ALTER TYPE public.admission_type_enum RENAME VALUE '院舍卷級別0' TO '院舍券級別0';
ALTER TYPE public.admission_type_enum RENAME VALUE '院舍卷級別1-7' TO '院舍券級別1-7';
