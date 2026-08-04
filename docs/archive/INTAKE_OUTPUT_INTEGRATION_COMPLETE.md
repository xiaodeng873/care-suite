# ✅ 出入量新模态框已集成！

## 已完成的更改

### 1. 添加新组件导入
```typescript
import IntakeOutputModalNew from '../components/IntakeOutputModalNew';
```

### 2. 简化 handleIntakeOutputPress
移除了复杂的状态管理，直接打开模态框：
```typescript
const handleIntakeOutputPress = (timeSlot: string) => {
  setSelectedTimeSlot(timeSlot);
  setShowIntakeOutputModal(true);
};
```

### 3. 集成新组件
在 CareRecordsScreen 的 render 部分使用新组件：
```tsx
<IntakeOutputModalNew
  visible={showIntakeOutputModal}
  onClose={() => {
    setShowIntakeOutputModal(false);
    setSelectedTimeSlot('');
  }}
  patient={patient}
  date={selectedDateString}
  timeSlot={selectedTimeSlot || ''}
  existingRecord={intakeOutputRecords.find(...)}
  onSave={(record) => {
    // 更新记录列表
    setIntakeOutputRecords(prev => {
      const existing = prev.find(r => r.id === record.id);
      if (existing) {
        return prev.map(r => r.id === record.id ? record : r);
      } else {
        return [...prev, record];
      }
    });
    setShowIntakeOutputModal(false);
    setSelectedTimeSlot('');
  }}
  staffName={displayName || '未知'}
/>
```

## 📋 新功能特性

符合 INTAKE_OUTPUT_MODAL_REDESIGN.md 的完整设计：

### ✅ 攝入類別（4種）
- 🍚 **餐膳**: 早餐/午餐/下午茶/晚餐（份數：1, 3/4, 1/2, 1/4）
- 💧 **飲料**: 水/湯/奶/果汁/糖水/茶（毫升）
- 🍪 **其他**: 餅乾/點心/零食/甜品（塊/粒）
- 💊 **鼻胃飼**: Isocal/Ultracal/Glucerna/Isosource/Compleat（毫升）

### ✅ 排出類別（2種）
- 💧 **尿液**: 顏色（透明/黃/啡/紅）+ 容量(ml)
- 🧪 **胃液**: 顏色 + pH值 + 容量(ml)

### ✅ 動態增減
每個類別都可以：
- ➕ 新增多個項目
- 🗑️ 刪除已添加的項目
- 📊 自動計算小計

## ⚠️ 重要：需要執行數據庫遷移

在使用新功能前，**必須**在 Supabase Dashboard 執行以下 SQL：

```sql
-- 添加 time_slot 字段
ALTER TABLE intake_output_records 
ADD COLUMN IF NOT EXISTS time_slot VARCHAR(10);

-- 從 hour_slot 遷移數據
UPDATE intake_output_records
SET time_slot = LPAD(hour_slot::TEXT, 2, '0') || ':00'
WHERE time_slot IS NULL;

-- 設置為非空
ALTER TABLE intake_output_records 
ALTER COLUMN time_slot SET NOT NULL;

-- 創建 intake_items 表
CREATE TABLE IF NOT EXISTS intake_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES intake_output_records(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('meal', 'beverage', 'other', 'tube_feeding')),
  item_type VARCHAR(50) NOT NULL,
  amount VARCHAR(20) NOT NULL,
  amount_numeric DECIMAL(10,2) NOT NULL,
  unit VARCHAR(10) NOT NULL CHECK (unit IN ('portion', 'ml', 'piece')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建 output_items 表
CREATE TABLE IF NOT EXISTS output_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES intake_output_records(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('urine', 'gastric')),
  color VARCHAR(20),
  ph_value DECIMAL(3,1),
  amount_ml INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_intake_items_record_id ON intake_items(record_id);
CREATE INDEX IF NOT EXISTS idx_output_items_record_id ON output_items(record_id);

-- 啟用 RLS
ALTER TABLE intake_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE output_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON intake_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON output_items
  FOR ALL USING (auth.role() = 'authenticated');
```

或直接執行完整的遷移文件：
📄 `/workspaces/care-suite/APPLY_INTAKE_OUTPUT_MIGRATION.sql`

## 🧪 測試步驟

執行遷移後：

1. **重新加載應用**: 在 Expo 終端按 `r`
2. **進入護理記錄**: 選擇患者 → 點擊"出入量"選項卡
3. **測試新增**:
   - 點擊時段（如 08:00）
   - 添加餐膳：早餐 1/2份
   - 添加飲料：水 200ml
   - 添加鼻胃飼：Isocal 250ml
   - 添加尿液：黃色 300ml
   - 檢查小計是否正確顯示
4. **測試保存**: 點擊"儲存記錄"
5. **驗證**: 重新打開記錄，確認數據已保存

## 🎉 完成！

現在出入量記錄功能完全符合設計要求，支持：
- ✅ 動態增減項目
- ✅ 6個類別的詳細配置
- ✅ 自動統計計算
- ✅ 友好的用戶界面
- ✅ Web/Mobile互聯互通（使用相同數據結構）

下一步：實現 Web 端的相同功能。
