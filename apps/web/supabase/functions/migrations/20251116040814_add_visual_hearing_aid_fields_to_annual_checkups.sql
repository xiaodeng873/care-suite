/*
  # 在年度体检表添加视力矫正器和助听器字段

  ## 说明
  根据《安老院实务守则》附件12.1 - Functional Assessment（身体机能评估）的要求，
  在评估视力和听力时需要记录院友是否配戴辅助器具。

  ## 新增字段
  
  1. `with_visual_corrective_devices` (boolean, nullable)
     - 是否配戴视力矫正器（眼镜等）
     - 选项：有 (true) / 没有 (false) / 未选择 (null)
     - 用于记录在视力评估时院友是否配戴视力矫正器具
  
  2. `with_hearing_aids` (boolean, nullable)
     - 是否配戴助听器
     - 选项：有 (true) / 没有 (false) / 未选择 (null)
     - 用于记录在听力评估时院友是否配戴助听器
  
  ## 重要说明
  
  - 这两个字段允许为 null，代表尚未选择或不适用
  - true 代表"有配戴"，false 代表"没有配戴"
  - 不设置默认值，保持为 null 直到用户明确选择
  - 这些信息对于准确评估院友的功能状态很重要
*/

-- 添加视力矫正器字段
ALTER TABLE annual_health_checkups 
ADD COLUMN IF NOT EXISTS with_visual_corrective_devices boolean;

-- 添加助听器字段
ALTER TABLE annual_health_checkups 
ADD COLUMN IF NOT EXISTS with_hearing_aids boolean;

-- 添加列注释以提高可维护性
COMMENT ON COLUMN annual_health_checkups.with_visual_corrective_devices IS '是否配戴视力矫正器（有/没有配戴视力矫正器）- true=有, false=没有, null=未选择';
COMMENT ON COLUMN annual_health_checkups.with_hearing_aids IS '是否配戴助听器（有/没有配戴助听器）- true=有, false=没有, null=未选择';
