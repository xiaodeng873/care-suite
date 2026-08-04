# 出入量模态框重新设计 - 实施完成

## ✅ 已完成的工作

### 1. 数据库迁移
- ✅ 创建 `intake_items` 表 (攝入項目表)
- ✅ 创建 `output_items` 表 (排出項目表)
- ✅ 添加索引和约束
- ✅ 文件: `/supabase/migrations/20251222000001_create_intake_output_items.sql`

### 2. TypeScript 类型定义
- ✅ 更新 `IntakeOutputRecord` 接口
- ✅ 新增 `IntakeItem` 接口
- ✅ 新增 `OutputItem` 接口
- ✅ 文件: `/apps/mobile/src/lib/database.ts`

### 3. 数据库操作函数
- ✅ `getIntakeOutputRecordWithItems()` - 获取记录及关联项目
- ✅ `createIntakeItems()` / `createOutputItems()` - 批量创建项目
- ✅ `deleteIntakeItem()` / `deleteOutputItem()` - 删除项目
- ✅ 文件: `/apps/mobile/src/lib/database.ts`

### 4. 配置和工具函数
- ✅ `INTAKE_CATEGORIES` - 攝入类别配置
- ✅ `OUTPUT_CATEGORIES` - 排出类别配置
- ✅ `portionToNumber()` - 份量转换函数
- ✅ `formatIntakeSummary()` - 攝入摘要格式化
- ✅ `formatOutputSummary()` - 排出摘要格式化
- ✅ 文件: `/apps/mobile/src/utils/intakeOutputConfig.ts`

### 5. UI 组件
- ✅ `AddIntakeOutputItemModal` - 新增项目子模态框
  - 支持攝入4个类别: 餐膳/饮料/其他/鼻胃飼
  - 支持排出2个类别: 尿液/胃液
  - 文件: `/apps/mobile/src/components/AddIntakeOutputItemModal.tsx`

- ✅ `IntakeOutputModalNew` - 主模态框
  - 动态增减项目
  - 分类显示
  - 实时统计
  - 文件: `/apps/mobile/src/components/IntakeOutputModalNew.tsx`

---

## 📋 数据结构对比

### 旧设计 (JSONB 数组)
```sql
intake_output_records:
  - meals: [{ meal_type, amount }]
  - beverages: [{ type, amount }]
  - tube_feeding: [{ type, amount }]
  - urine_output: [{ volume, color }]
  - gastric_output: [{ volume, ph, color }]
```

### 新设计 (关联表)
```sql
intake_output_records (主记录):
  - id, patient_id, record_date, time_slot, recorder, notes

intake_items (攝入项目):
  - id, record_id, category, item_type, amount, amount_numeric, unit

output_items (排出项目):
  - id, record_id, category, color, ph_value, amount_ml
```

---

## 🔄 待完成工作

### 1. 数据迁移 (重要！)
需要将现有的 JSONB 数据迁移到新表结构：

```sql
-- 迁移攝入数据示例
INSERT INTO intake_items (record_id, category, item_type, amount, amount_numeric, unit)
SELECT 
  id as record_id,
  'meal' as category,
  meal->'meal_type' as item_type,
  meal->'amount' as amount,
  CASE meal->>'amount'
    WHEN '1' THEN 1
    WHEN '3/4' THEN 0.75
    WHEN '1/2' THEN 0.5
    WHEN '1/4' THEN 0.25
  END as amount_numeric,
  'portion' as unit
FROM intake_output_records,
  jsonb_array_elements(meals) as meal
WHERE meals IS NOT NULL AND jsonb_array_length(meals) > 0;
```

### 2. 更新 CareRecordsScreen
需要更新以下部分：
- ✅ 已有基础修复 (boolean类型问题)
- ⏳ 导入新模态框组件
- ⏳ 更新 `renderIntakeOutputTable()` 函数
- ⏳ 更新记录显示逻辑 (使用新数据结构)
- ⏳ 集成 `IntakeOutputModalNew` 替换旧模态框

### 3. Web 端实现
按照相同设计在 Web 端实现：
- ⏳ 创建 Web 版组件
- ⏳ 确保数据互联互通

---

## 🧪 测试步骤

### 步骤 1: 应用数据库迁移
```bash
# 连接到 Supabase
cd /workspaces/care-suite
# 手动在 Supabase Dashboard 执行迁移SQL
# 或使用 supabase CLI (如果已配置)
```

### 步骤 2: 测试新模态框
1. 打开 CareRecordsScreen
2. 点击出入量时段
3. 测试新增功能:
   - 餐膳: 选择早餐/午餐, 份量 1/2
   - 饮料: 添加水 200ml
   - 鼻胃飼: 添加 Isocal 250ml
   - 其他: 添加餅乾 3塊
   - 尿液: 黃色 300ml
   - 胃液: 啡色 pH4 100ml

### 步骤 3: 验证数据保存
检查数据库表:
```sql
-- 查看主记录
SELECT * FROM intake_output_records ORDER BY created_at DESC LIMIT 5;

-- 查看攝入项目
SELECT * FROM intake_items ORDER BY created_at DESC LIMIT 10;

-- 查看排出项目
SELECT * FROM output_items ORDER BY created_at DESC LIMIT 10;
```

### 步骤 4: 测试编辑和删除
1. 点击已有记录
2. 添加新项目
3. 删除现有项目
4. 修改备注
5. 保存并验证

---

## 📊 功能特性

### ✅ 已实现
- [x] 动态增减项目
- [x] 分类清晰 (6个类别)
- [x] 智能单位处理
- [x] 实时统计显示
- [x] 数据验证
- [x] 删除确认
- [x] 表单重置

### 🎯 优势
1. **灵活性**: 可添加任意数量的项目
2. **可扩展性**: 易于添加新类别或类型
3. **数据完整性**: 关联表确保数据一致性
4. **查询效率**: 索引优化查询性能
5. **用户体验**: 清晰的分类和操作流程

---

## 🔧 后续优化建议

1. **性能优化**:
   - 实现增量更新 (只更新变更的项目)
   - 添加本地缓存机制

2. **用户体验**:
   - 添加快速输入模板
   - 支持批量操作
   - 添加统计图表

3. **数据分析**:
   - 每日/每周攝入排出统计
   - 趋势分析
   - 异常提醒

---

## 📝 注意事项

1. **数据迁移**: 在生产环境部署前必须先迁移现有数据
2. **向后兼容**: 保留旧字段一段时间以确保平稳过渡
3. **权限控制**: 确保 RLS 策略正确配置
4. **错误处理**: 添加完善的错误提示和日志记录

---

## 📞 支持

如遇问题，请检查：
1. 数据库迁移是否成功执行
2. TypeScript 类型定义是否匹配
3. 控制台是否有错误信息
4. 网络请求是否成功

---

**实施日期**: 2025-12-22
**版本**: v2.0 - 动态项目设计
**状态**: 核心功能已完成，待集成测试
