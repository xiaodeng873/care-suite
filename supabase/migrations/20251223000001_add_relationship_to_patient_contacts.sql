/*
  # 添加關係欄位到院友聯絡人表

  1. 修改
    - 在 patient_contacts 表中添加「關係」欄位
*/

-- 添加關係欄位
ALTER TABLE patient_contacts 
ADD COLUMN IF NOT EXISTS 關係 VARCHAR(50);

-- 添加欄位註釋
COMMENT ON COLUMN patient_contacts.關係 IS '與院友的關係（如：子女、配偶、親友等）';
