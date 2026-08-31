-- 雜費項目增加「實報實銷」選項
ALTER TABLE public.fee_items
ADD COLUMN IF NOT EXISTS is_reimbursement boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fee_items.is_reimbursement IS '是否實報實銷（預設單價不固定，每次記錄時自行輸入金額）';
