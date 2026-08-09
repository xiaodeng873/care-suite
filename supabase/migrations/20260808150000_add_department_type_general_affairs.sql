-- 為 department_type 枚舉加入「庶務」值，供後續 migration 使用
-- 此 migration 僅新增枚舉值，不操作資料，避免與使用新值的語句同處一個 transaction
ALTER TYPE department_type ADD VALUE IF NOT EXISTS '庶務';
