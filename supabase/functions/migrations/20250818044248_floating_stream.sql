/*
  # 添加傷口詳細記錄外鍵關係

  1. 外鍵關係
    - 在 `wound_details` 表中添加對 `wound_assessments` 表的外鍵約束
    - 確保 `wound_assessment_id` 欄位正確引用 `wound_assessments.id`

  2. 安全性
    - 維持現有的 RLS 策略
    - 確保資料完整性
*/

-- 添加外鍵約束到 wound_details 表
ALTER TABLE wound_details
ADD CONSTRAINT fk_wound_assessment_id
FOREIGN KEY (wound_assessment_id)
REFERENCES wound_assessments(id)
ON DELETE CASCADE;