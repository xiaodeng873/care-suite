-- ============================================
-- 院友專屬二維碼資料庫遷移腳本
-- 為每個院友生成專屬二維碼
-- ============================================

-- 1. 檢查 qr_code_id 欄位是否已存在
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = '院友主表' 
        AND column_name = 'qr_code_id'
    ) THEN
        -- 2. 添加 qr_code_id 欄位
        ALTER TABLE "院友主表" 
        ADD COLUMN qr_code_id TEXT UNIQUE DEFAULT gen_random_uuid()::text;
        
        RAISE NOTICE '已添加 qr_code_id 欄位';
    ELSE
        RAISE NOTICE 'qr_code_id 欄位已存在，跳過';
    END IF;
END $$;

-- 3. 為現有的沒有 qr_code_id 的院友生成二維碼ID
UPDATE "院友主表"
SET qr_code_id = gen_random_uuid()::text
WHERE qr_code_id IS NULL;

-- 4. 驗證結果
SELECT 
    院友id,
    床號,
    中文姓名,
    qr_code_id
FROM "院友主表"
ORDER BY 床號
LIMIT 20;

-- 5. 顯示統計
SELECT 
    COUNT(*) as 總院友數,
    COUNT(qr_code_id) as 有二維碼院友數,
    COUNT(*) - COUNT(qr_code_id) as 無二維碼院友數
FROM "院友主表";
