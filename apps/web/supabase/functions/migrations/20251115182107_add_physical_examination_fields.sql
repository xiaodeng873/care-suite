/*
  # 新增身體檢查欄位到年度體檢表格

  1. 新增欄位
    - Part III 身體檢查系統備註欄位:
      - `cardiovascular_notes` - 循環系統備註
      - `respiratory_notes` - 呼吸系統備註
      - `central_nervous_notes` - 中樞神經系統備註
      - `musculo_skeletal_notes` - 肌骨備註
      - `abdomen_urogenital_notes` - 腹部/泌尿及生殖系統備註
      - `lymphatic_notes` - 淋巴系統備註
      - `thyroid_notes` - 甲狀腺備註
      - `skin_condition_notes` - 皮膚狀況備註
      - `foot_notes` - 足部備註
      - `eye_ear_nose_throat_notes` - 眼/耳鼻喉備註
      - `oral_dental_notes` - 口腔/牙齒狀況備註
      - `physical_exam_others` - 身體檢查其他備註
      - `physical_exam_specify` - 身體檢查請註明（血壓/脈搏的特殊說明）

  2. 說明
    - 所有新欄位皆為 text 類型，允許 null
    - 這些欄位對應表格中 Part III 各系統的備註欄
*/

-- 新增 Part III 身體檢查欄位
ALTER TABLE annual_health_checkups
  ADD COLUMN IF NOT EXISTS cardiovascular_notes text,
  ADD COLUMN IF NOT EXISTS respiratory_notes text,
  ADD COLUMN IF NOT EXISTS central_nervous_notes text,
  ADD COLUMN IF NOT EXISTS musculo_skeletal_notes text,
  ADD COLUMN IF NOT EXISTS abdomen_urogenital_notes text,
  ADD COLUMN IF NOT EXISTS lymphatic_notes text,
  ADD COLUMN IF NOT EXISTS thyroid_notes text,
  ADD COLUMN IF NOT EXISTS skin_condition_notes text,
  ADD COLUMN IF NOT EXISTS foot_notes text,
  ADD COLUMN IF NOT EXISTS eye_ear_nose_throat_notes text,
  ADD COLUMN IF NOT EXISTS oral_dental_notes text,
  ADD COLUMN IF NOT EXISTS physical_exam_others text,
  ADD COLUMN IF NOT EXISTS physical_exam_specify text;
