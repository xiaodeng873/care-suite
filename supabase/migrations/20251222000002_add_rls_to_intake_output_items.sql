-- Migration: 為 intake_items 和 output_items 表添加 RLS 策略
-- Description: 解決無法刪除出入量記錄的問題

-- ============================================
-- 1. 啟用 RLS
-- ============================================
ALTER TABLE intake_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE output_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. 創建策略：允許所有已認證用戶進行所有操作
-- ============================================

-- intake_items 策略
CREATE POLICY "Enable all for authenticated users on intake_items" 
ON intake_items
FOR ALL 
USING (auth.role() = 'authenticated');

-- output_items 策略
CREATE POLICY "Enable all for authenticated users on output_items" 
ON output_items
FOR ALL 
USING (auth.role() = 'authenticated');
