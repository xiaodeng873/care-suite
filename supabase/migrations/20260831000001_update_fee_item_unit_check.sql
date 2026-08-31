-- 雜費項目單位增加「程」
ALTER TABLE public.fee_items DROP CONSTRAINT IF EXISTS fee_items_unit_check;
ALTER TABLE public.fee_items ADD CONSTRAINT fee_items_unit_check
  CHECK (unit = ANY (ARRAY['次'::text, '個'::text, '日'::text, '月'::text, '項'::text, '小時'::text, '療程'::text, '程'::text]));
