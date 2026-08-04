# 出入量记录功能实现指南

## 功能概述
出入量记录是一个新的护理记录类型，用于追踪患者每小时的摄入和排出情况。

## 数据库结构
- **表名**: `intake_output_records`
- **时间粒度**: 每小时一个记录（0-23小时）
- **唯一约束**: `UNIQUE(patient_id, record_date, hour_slot)`

### 字段分类

#### 攝入 (Intake)
1. **餐膳** - 选择分数
   - 早餐/午餐/下午茶/晚餐
   - 值: '1/4', '2/4', '3/4', '全份'

2. **飲料** - 数字输入(毫升)
   - 水、湯、奶、果汁、糖水、茶

3. **其他** - 数字输入(塊/粒)
   - 餅乾、點心、零食、甜品

4. **鼻胃飼** - 数字输入(毫升)
   - Isocal, Ultracal, Glucerna, Isosource, Compleat

#### 排出 (Output)
1. **尿液**
   - 尿量: 数字输入(毫升)
   - 顏色: 选择(透明/黃/啡/紅)

2. **胃液**
   - 胃液量: 数字输入(毫升)
   - pH值: 数字输入(0-14, 1位小数)
   - 顏色: 选择(透明/黃/啡/紅)

## 界面设计

### Mobile端 (React Native)

#### 表格视图
- 显示24行，每行代表一个小时(00:00 - 23:00)
- 列: 时段 | 摄入总计 | 排出总计 | 操作
- 点击行打开模态框编辑

#### 模态框布局
```
┌─────────────────────────────┐
│  XX:00 - XX:59              │
├─────────────────────────────┤
│  【攝入】                    │
│  ┌ 餐膳 ─────────────────┐  │
│  │ 早餐: [选择]  午餐: []  │  │
│  │ 下午茶: []  晚餐: []    │  │
│  └─────────────────────────┘  │
│  ┌ 飲料 ─────────────────┐  │
│  │ 水: [  ]ml  湯: [  ]ml │  │
│  │ 奶: [  ]ml  果汁:[  ]ml│  │
│  │ 糖水:[  ]ml 茶: [  ]ml │  │
│  └─────────────────────────┘  │
│  ┌ 其他 ─────────────────┐  │
│  │ 餅乾: [ ]塊/粒         │  │
│  │ 點心: [ ]塊/粒         │  │
│  └─────────────────────────┘  │
│  ┌ 鼻胃飼 ───────────────┐  │
│  │ Isocal: [ ]ml          │  │
│  │ Ultracal: [ ]ml        │  │
│  └─────────────────────────┘  │
│                               │
│  【排出】                    │
│  ┌ 尿液 ─────────────────┐  │
│  │ 尿量: [    ]ml         │  │
│  │ 顏色: [选择]            │  │
│  └─────────────────────────┘  │
│  ┌ 胃液 ─────────────────┐  │
│  │ 胃液量: [   ]ml        │  │
│  │ pH值: [  ]             │  │
│  │ 顏色: [选择]            │  │
│  └─────────────────────────┘  │
│                               │
│  [取消]         [儲存]        │
└─────────────────────────────┘
```

### Web端 (React)

类似Mobile端，但使用HTML表单元素：
- 下拉选择框用于份量和颜色
- 数字输入框用于毫升/塊粒/pH值
- 内联编辑，点击即可修改

## 实现步骤

### 1. 数据库迁移
✅ 已完成: `20251222000000_create_intake_output_records.sql`

### 2. 类型定义和CRUD函数
✅ 已完成:
- `IntakeOutputRecord` 接口
- `getIntakeOutputRecords()`
- `createIntakeOutputRecord()`
- `updateIntakeOutputRecord()`
- `deleteIntakeOutputRecord()`

### 3. 多语言支持
✅ 已完成: i18n.ts 中的所有翻译键

### 4. Mobile端实现要点

#### 数据加载
```typescript
const [intakeOutputRecords, setIntakeOutputRecords] = useState<IntakeOutputRecord[]>([]);

// 在loadData中添加
const records = await getIntakeOutputRecords();
setIntakeOutputRecords(records.filter(r => r.patient_id === patient.院友id));
```

#### 时间槽生成
```typescript
const HOUR_SLOTS = Array.from({ length: 24 }, (_, i) => i); // [0, 1, 2, ..., 23]

const getHourDisplay = (hour: number) => {
  return `${String(hour).padStart(2, '0')}:00`;
};
```

#### 计算总计
```typescript
const calculateIntakeTotal = (record: IntakeOutputRecord) => {
  let total = 0;
  // 飲料
  total += (record.beverage_water || 0);
  total += (record.beverage_soup || 0);
  // ... 其他飲料
  // 鼻胃飼
  total += (record.tube_isocal || 0);
  // ... 其他鼻胃飼
  return total;
};

const calculateOutputTotal = (record: IntakeOutputRecord) => {
  let total = 0;
  total += (record.urine_volume || 0);
  total += (record.gastric_volume || 0);
  return total;
};
```

#### 模态框状态
```typescript
const [showIntakeOutputModal, setShowIntakeOutputModal] = useState(false);
const [selectedHourSlot, setSelectedHourSlot] = useState<number | null>(null);
const [editingIntakeOutput, setEditingIntakeOutput] = useState<IntakeOutputRecord | null>(null);
```

### 5. Web端实现要点

类似Mobile端，但使用React的表单元素和内联编辑模式。

## 测试场景

1. **创建记录**: 为某小时段创建新的出入量记录
2. **更新记录**: 修改已有记录的各项数据
3. **删除记录**: 删除某小时的记录
4. **跨平台同步**: Web端创建，Mobile端查看；Mobile端修改，Web端同步
5. **数据验证**: pH值范围、负数检查、分数选项
6. **总计计算**: 验证摄入和排出的自动计算

## 注意事项

1. **数据验证**:
   - pH值: 0-14，保留1位小数
   - 所有数量字段: >= 0
   - 餐膳份量: 只能是预定义的4个选项

2. **用户体验**:
   - 空值处理: null vs 0 的区分
   - 焦点管理: 模态框打开时焦点处理
   - 保存提示: 数据变更时的保存确认

3. **性能优化**:
   - 只加载当天的记录
   - 使用 React.memo 避免不必要的重渲染
   - 防抖保存操作

## 下一步

1. 在Supabase执行迁移脚本
2. 实现Mobile端的intake_output选项卡
3. 实现Web端的intake_output选项卡
4. 端到端测试
