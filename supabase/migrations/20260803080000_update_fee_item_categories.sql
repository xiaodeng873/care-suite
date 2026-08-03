ALTER TABLE fee_items DROP CONSTRAINT IF EXISTS fee_items_category_check;
UPDATE fee_items SET category = CASE
  WHEN category = 'service' THEN '服務'
  WHEN category = 'supply' THEN '用品'
  ELSE '服務'
END;
ALTER TABLE fee_items ADD CONSTRAINT fee_items_category_check CHECK (category IN ('服務','用品'));
