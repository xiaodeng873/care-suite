/*
  傷口評估：新增週邊皮膚質感 + 感染症狀多選
  - surrounding_skin_texture: 腫脹 | 僵硬（nullable）
  - infection_signs: text[] 陣列，如 ['紅','腫','痛'] 或 ['無']
*/
ALTER TABLE wound_assessments
  ADD COLUMN IF NOT EXISTS surrounding_skin_texture text,
  ADD COLUMN IF NOT EXISTS infection_signs text[];
