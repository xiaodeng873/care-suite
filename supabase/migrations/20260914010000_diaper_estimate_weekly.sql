-- 理遺記錄：尿片/片芯估算由「每月」改為「每週」
-- 生成公式：每日平均 = 每週數量 ÷ 7（原先每月 ÷ 當月日數）

ALTER TABLE diaper_usage_records RENAME COLUMN monthly_diaper_estimate TO weekly_diaper_estimate;
ALTER TABLE diaper_usage_records RENAME COLUMN monthly_core_estimate TO weekly_core_estimate;
