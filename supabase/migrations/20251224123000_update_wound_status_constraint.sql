/*
  # 修改 wound_assessments 表 wound_status constraint，允許中英文狀態值
  英文: 'untreated', 'treating', 'improving', 'healed'
  中文: '未處理', '治療中', '已痊癒'
*/

ALTER TABLE wound_assessments DROP CONSTRAINT IF EXISTS wound_assessments_wound_status_check;
ALTER TABLE wound_assessments
  ADD CONSTRAINT wound_assessments_wound_status_check
  CHECK (wound_status IN (
    'untreated', 'treating', 'improving', 'healed',
    '未處理', '治療中', '已痊癒'
  ));
