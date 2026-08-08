-- 衛生部職位 enum 加入「清潔員」
-- 護理部「助理員」職位保留不變；此處只擴展 hygiene_position_type

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'hygiene_position_type' AND e.enumlabel = '清潔員') THEN
    ALTER TYPE hygiene_position_type ADD VALUE '清潔員';
  END IF;
END $$;
