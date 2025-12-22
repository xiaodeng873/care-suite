-- Migration: 重新设计出入量记录表结构
-- Description: 创建动态的 intake_items 和 output_items 表，支持灵活的项目增减

-- ============================================
-- 0. 添加 time_slot 字段到现有表
-- ============================================
-- 添加 time_slot 字段 (字符串格式: '08:00', '12:00' 等)
ALTER TABLE intake_output_records 
ADD COLUMN IF NOT EXISTS time_slot VARCHAR(10);

-- 从 hour_slot 迁移数据到 time_slot
UPDATE intake_output_records
SET time_slot = LPAD(hour_slot::TEXT, 2, '0') || ':00'
WHERE time_slot IS NULL;

-- 设置 time_slot 为非空
ALTER TABLE intake_output_records 
ALTER COLUMN time_slot SET NOT NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_intake_output_time_slot ON intake_output_records(time_slot);

-- ============================================
-- 1. 创建攝入項目表 (Intake Items)
-- ============================================
CREATE TABLE IF NOT EXISTS intake_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES intake_output_records(id) ON DELETE CASCADE,
  
  -- 分类: meal, beverage, other, tube_feeding
  category VARCHAR(20) NOT NULL CHECK (category IN ('meal', 'beverage', 'other', 'tube_feeding')),
  
  -- 具体类型: 早餐/午餐/水/湯/餅乾/Isocal 等
  item_type VARCHAR(50) NOT NULL,
  
  -- 显示用的数量 (如 '1/2', '200ml', '3塊')
  amount VARCHAR(20) NOT NULL,
  
  -- 用于计算的数值
  amount_numeric DECIMAL(10,2) NOT NULL,
  
  -- 单位: portion, ml, piece
  unit VARCHAR(10) NOT NULL CHECK (unit IN ('portion', 'ml', 'piece')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. 创建排出項目表 (Output Items)
-- ============================================
CREATE TABLE IF NOT EXISTS output_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES intake_output_records(id) ON DELETE CASCADE,
  
  -- 分类: urine, gastric
  category VARCHAR(20) NOT NULL CHECK (category IN ('urine', 'gastric')),
  
  -- 颜色: 透明/黃/啡/紅
  color VARCHAR(20),
  
  -- pH值 (仅胃液)
  ph_value DECIMAL(3,1),
  
  -- 容量(ml)
  amount_ml INTEGER NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. 创建索引以优化查询性能
-- ============================================
CREATE INDEX IF NOT EXISTS idx_intake_items_record_id ON intake_items(record_id);
CREATE INDEX IF NOT EXISTS idx_intake_items_category ON intake_items(category);
CREATE INDEX IF NOT EXISTS idx_output_items_record_id ON output_items(record_id);
CREATE INDEX IF NOT EXISTS idx_output_items_category ON output_items(category);

-- ============================================
-- 4. 添加注释
-- ============================================
COMMENT ON TABLE intake_items IS '攝入項目表 - 支持动态添加餐膳、饮料、其他、鼻胃飼等项目';
COMMENT ON TABLE output_items IS '排出項目表 - 支持动态添加尿液、胃液等项目';

COMMENT ON COLUMN intake_items.category IS '分类: meal(餐膳), beverage(饮料), other(其他), tube_feeding(鼻胃飼)';
COMMENT ON COLUMN intake_items.item_type IS '具体类型，如: 早餐/午餐/水/湯/餅乾/Isocal';
COMMENT ON COLUMN intake_items.amount IS '显示用的数量字符串，如: 1/2, 200ml, 3塊';
COMMENT ON COLUMN intake_items.amount_numeric IS '用于计算的数值';
COMMENT ON COLUMN intake_items.unit IS '单位: portion(份), ml(毫升), piece(塊/粒)';

COMMENT ON COLUMN output_items.category IS '分类: urine(尿液), gastric(胃液)';
COMMENT ON COLUMN output_items.color IS '颜色: 透明/黃/啡/紅';
COMMENT ON COLUMN output_items.ph_value IS 'pH值 (仅适用于胃液)';
COMMENT ON COLUMN output_items.amount_ml IS '容量(ml)';
