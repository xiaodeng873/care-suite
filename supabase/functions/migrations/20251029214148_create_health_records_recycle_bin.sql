/*
  # 创建健康记录回收筒

  1. 新增表
    - `deleted_health_records` - 健康记录回收筒
      - 包含所有健康记录主表的字段
      - 添加删除相关的元数据字段：
        - `original_record_id` - 原始记录ID
        - `deleted_at` - 删除时间
        - `deleted_by` - 删除操作人
        - `deletion_reason` - 删除原因

  2. 安全设置
    - 启用 RLS (Row Level Security)
    - 允许已认证用户查看、恢复和永久删除回收筒记录

  3. 索引
    - 按院友id索引以加速查询
    - 按删除时间索引以支持排序
    - 按原始记录id索引以支持恢复操作
*/

-- 创建记录类型枚举（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '記錄類型') THEN
    CREATE TYPE 記錄類型 AS ENUM ('生命表徵', '血糖控制', '體重控制');
  END IF;
END $$;

-- 创建健康记录回收筒表
CREATE TABLE IF NOT EXISTS deleted_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_record_id INT NOT NULL,
  院友id INT NOT NULL,
  記錄日期 DATE NOT NULL,
  記錄時間 TIME NOT NULL,
  記錄類型 記錄類型 NOT NULL,
  血壓收縮壓 INT,
  血壓舒張壓 INT,
  脈搏 INT,
  體溫 DECIMAL(4,1),
  血含氧量 INT,
  呼吸頻率 INT,
  血糖值 DECIMAL(4,1),
  體重 DECIMAL(5,1),
  備註 TEXT,
  記錄人員 VARCHAR(50),
  created_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_by VARCHAR(100),
  deletion_reason VARCHAR(200) DEFAULT '记录去重' NOT NULL
);

-- 启用 RLS
ALTER TABLE deleted_health_records ENABLE ROW LEVEL SECURITY;

-- 创建索引以提升查询效能
CREATE INDEX IF NOT EXISTS idx_deleted_health_records_patient_id ON deleted_health_records(院友id);
CREATE INDEX IF NOT EXISTS idx_deleted_health_records_deleted_at ON deleted_health_records(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_health_records_original_id ON deleted_health_records(original_record_id);
CREATE INDEX IF NOT EXISTS idx_deleted_health_records_record_date ON deleted_health_records(記錄日期);

-- 设置 RLS 策略
-- 允许已认证用户读取回收筒记录
CREATE POLICY "允许已认证用户读取回收筒记录" ON deleted_health_records
  FOR SELECT TO authenticated USING (true);

-- 允许已认证用户插入回收筒记录（删除操作）
CREATE POLICY "允许已认证用户插入回收筒记录" ON deleted_health_records
  FOR INSERT TO authenticated WITH CHECK (true);

-- 允许已认证用户删除回收筒记录（永久删除或恢复操作）
CREATE POLICY "允许已认证用户删除回收筒记录" ON deleted_health_records
  FOR DELETE TO authenticated USING (true);

-- 允许已认证用户更新回收筒记录
CREATE POLICY "允许已认证用户更新回收筒记录" ON deleted_health_records
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);