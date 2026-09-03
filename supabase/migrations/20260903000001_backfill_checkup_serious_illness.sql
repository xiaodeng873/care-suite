/*
  # 回填年度體檢「曾否患嚴重疾病／接受大型手術？」內容

  把現有年度體檢記錄中尚未填寫 serious_illness_details 的資料，
  依照該院友的診斷記錄，用 ", " 串接 diagnosis_item 後回填。
  回填後同時設定 has_serious_illness。
*/

UPDATE annual_health_checkups ah
SET
  serious_illness_details = (
    SELECT COALESCE(STRING_AGG(diagnosis_item, ', ' ORDER BY created_at DESC), '')
    FROM diagnosis_records dr
    WHERE dr.patient_id = ah.patient_id
  ),
  has_serious_illness = EXISTS (
    SELECT 1
    FROM diagnosis_records dr2
    WHERE dr2.patient_id = ah.patient_id
  )
WHERE ah.serious_illness_details IS NULL
   OR ah.serious_illness_details = '';
