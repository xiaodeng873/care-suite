/*
  # 補全 wound_assessments 表所有缺失欄位
  依據前端/後端需求，補上 area_length, area_width, cleanser, cleanser_other, dressings, dressing_other, wound_photos, remarks, exudate_present, exudate_amount, exudate_color, exudate_type, odor, granulation, necrosis, infection, temperature, surrounding_skin_condition, surrounding_skin_color
*/

ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS area_length numeric(5,2);
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS area_width numeric(5,2);
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS cleanser text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS cleanser_other text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS dressings jsonb;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS dressing_other text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS wound_photos jsonb;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS exudate_present boolean;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS exudate_amount text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS exudate_color text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS exudate_type text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS odor text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS granulation text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS necrosis text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS infection text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS temperature text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS surrounding_skin_condition text;
ALTER TABLE wound_assessments ADD COLUMN IF NOT EXISTS surrounding_skin_color text;
