-- ============================================================
-- Migration: 新增 7 種獨立生命表徵監測類型至 health_task_type enum
-- 2026-06-27 (Part 1/2)
--
-- PostgreSQL 要求：ALTER TYPE ADD VALUE 必須在獨立 transaction
-- 提交後，新值才能在 CHECK constraint 或其他 DDL 中使用。
-- 故拆為兩個 migration 檔案：
--   20260627000001：僅加 enum 值（本檔）
--   20260627000002：建表、遷移資料、重建 enum、建 View
-- ============================================================

ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '血壓';
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '脈搏';
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '體溫';
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '血含氧量';
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '呼吸';
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '血糖值';
ALTER TYPE health_task_type ADD VALUE IF NOT EXISTS '體重';
