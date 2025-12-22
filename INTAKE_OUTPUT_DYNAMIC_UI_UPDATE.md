# 出入量記錄動態UI更新 - 2024年12月22日

## 概述
將出入量記錄系統從固定字段設計改為動態增減項設計，以支持更靈活的數據輸入。

## 主要變更

### 1. 數據庫遷移 (`supabase/migrations/20251222000000_create_intake_output_records.sql`)

**舊結構** (40+個固定列):
```sql
meal_breakfast TEXT,
meal_lunch TEXT,
beverage_water INTEGER,
beverage_soup INTEGER,
... (40+ columns)
```

**新結構** (5個JSONB列):
```sql
meals JSONB DEFAULT '[]'::jsonb,           -- [{meal_type, amount}]
beverages JSONB DEFAULT '[]'::jsonb,       -- [{type, amount}]
tube_feeding JSONB DEFAULT '[]'::jsonb,    -- [{type, amount}]
urine_output JSONB DEFAULT '[]'::jsonb,    -- [{volume, color}]
gastric_output JSONB DEFAULT '[]'::jsonb,  -- [{volume, ph, color}]
recorder TEXT NOT NULL,
notes TEXT
```

### 2. TypeScript類型定義 (`apps/mobile/src/lib/database.ts`)

新增5個接口：

```typescript
export interface MealItem {
  meal_type: '早餐' | '午餐' | '下午茶' | '晚餐';
  amount: '1' | '1/4' | '1/2' | '3/4';
}

export interface BeverageItem {
  type: '清水' | '湯' | '奶' | '果汁' | '糖水' | '茶';
  amount: number;  // ml
}

export interface TubeFeedingItem {
  type: 'Isocal' | 'Glucerna' | 'Compleat';
  amount: number;  // ml
}

export interface UrineOutputItem {
  volume: number;  // ml
  color: string;
}

export interface GastricOutputItem {
  volume: number;  // ml
  ph: number;      // 0-14
  color: string;
}
```

更新 `IntakeOutputRecord` 接口：
```typescript
export interface IntakeOutputRecord {
  id: string;
  patient_id: number;
  record_date: string;
  hour_slot: number;
  meals: MealItem[];
  beverages: BeverageItem[];
  tube_feeding: TubeFeedingItem[];
  urine_output: UrineOutputItem[];
  gastric_output: GastricOutputItem[];
  recorder: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

### 3. Web端 (`apps/web/src/components/IntakeOutputModal.tsx`)

#### 狀態管理變更：
**舊方式**:
```typescript
const [mealBreakfast, setMealBreakfast] = useState('');
const [mealLunch, setMealLunch] = useState('');
const [beverageWater, setBeverageWater] = useState('');
... (40+ individual states)
```

**新方式**:
```typescript
const [meals, setMeals] = useState<MealItem[]>([]);
const [beverages, setBeverages] = useState<BeverageItem[]>([]);
const [tubeFeeding, setTubeFeeding] = useState<TubeFeedingItem[]>([]);
const [urineOutput, setUrineOutput] = useState<UrineOutputItem[]>([]);
const [gastricOutput, setGastricOutput] = useState<GastricOutputItem[]>([]);
```

#### UI功能：
- **餐食區域**：
  - 下拉選擇：早餐/午餐/下午茶/晚餐
  - 份量選擇：1, 1/4, 1/2, 3/4
  - 新增/刪除按鈕

- **飲品區域**：
  - 下拉選擇：清水/湯/奶/果汁/糖水/茶
  - 數字輸入：ml量
  - 新增/刪除按鈕

- **管飼區域**：
  - 下拉選擇：Isocal/Glucerna/Compleat
  - 數字輸入：ml量
  - 新增/刪除按鈕

- **尿液區域**：
  - 容量輸入 (ml)
  - 顏色文本輸入
  - 新增/刪除按鈕

- **胃液區域**：
  - 容量輸入 (ml)
  - pH值輸入 (0-14，帶驗證)
  - 顏色文本輸入
  - 新增/刪除按鈕

### 4. Mobile端 (`apps/mobile/src/screens/CareRecordsScreen.tsx`)

#### 新增導入：
```typescript
import { Picker } from '@react-native-picker/picker';
import {
  MealItem,
  BeverageItem,
  TubeFeedingItem,
  UrineOutputItem,
  GastricOutputItem,
} from '../lib/database';
```

#### 函數更新：

1. **handleIntakeOutputPress**:
   ```typescript
   // 舊方式：設置40+個字段
   // 新方式：設置5個數組
   setEditingIntakeOutput({
     meals: existingRecord.meals || [],
     beverages: existingRecord.beverages || [],
     tube_feeding: existingRecord.tube_feeding || [],
     urine_output: existingRecord.urine_output || [],
     gastric_output: existingRecord.gastric_output || [],
     recorder: existingRecord.recorder,
     notes: existingRecord.notes || '',
   });
   ```

2. **saveIntakeOutputRecord**:
   ```typescript
   const data: Omit<IntakeOutputRecord, 'id' | 'created_at' | 'updated_at'> = {
     patient_id: patient.院友id,
     record_date: dateString,
     hour_slot: hourSlot,
     meals: editingIntakeOutput.meals || [],
     beverages: editingIntakeOutput.beverages || [],
     tube_feeding: editingIntakeOutput.tube_feeding || [],
     urine_output: editingIntakeOutput.urine_output || [],
     gastric_output: editingIntakeOutput.gastric_output || [],
     recorder: editingIntakeOutput.recorder.trim(),
     notes: editingIntakeOutput.notes?.trim() || undefined,
   };
   ```

3. **renderIntakeOutputModal**:
   - 使用 React Native `<Picker>` 組件實現下拉選擇
   - 使用 `.map()` 動態渲染項目列表
   - 使用 `Ionicons trash-outline` 作為刪除按鈕
   - 新增/刪除按鈕帶狀態禁用功能

#### Mobile UI特點：
- 使用原生 Picker 組件（需要 `@react-native-picker/picker` 包）
- 觸控優化的刪除按鈕 (40x40px)
- 綠色 (#10b981) 新增按鈕用於攝入量
- 紅色 (#dc2626) 新增按鈕用於排出量
- 響應式佈局適配不同屏幕尺寸

## 數據流程

### 新增記錄：
1. 用戶點擊時間槽 → `handleIntakeOutputPress`
2. 初始化空數組狀態
3. 用戶點擊"新增"按鈕添加項目
4. 選擇/輸入數據
5. 點擊"儲存" → `saveIntakeOutputRecord`
6. 數據以JSONB格式存入數據庫

### 編輯記錄：
1. 用戶點擊已有記錄 → `handleIntakeOutputPress`
2. 從JSONB載入數組數據
3. 渲染現有項目列表
4. 用戶可添加/刪除/修改項目
5. 點擊"更新" → 保存更新的JSONB數據

## 驗證邏輯

### Web端：
```typescript
// pH值驗證
for (const item of gastricOutput) {
  if (item.ph < 0 || item.ph > 14) {
    alert('pH值必須在0-14之間');
    return;
  }
}

// 記錄者必填
if (!recorder.trim()) {
  alert('請輸入記錄者姓名');
  return;
}
```

### Mobile端：
```typescript
// pH值輸入時即時驗證
onChangeText={(text) => {
  const ph = parseFloat(text) || 0;
  if (ph >= 0 && ph <= 14) {
    newGastricOutput[index].ph = ph;
    setEditingIntakeOutput(prev => ({ ...prev, gastric_output: newGastricOutput }));
  }
}}
```

## 依賴包

### Mobile新增：
```json
{
  "@react-native-picker/picker": "^2.x.x"
}
```

## 遷移注意事項

⚠️ **重要**：需要在Supabase Dashboard中手動執行數據庫遷移：

1. 登錄 Supabase Dashboard
2. 進入 SQL Editor
3. 執行 `/workspaces/care-suite/supabase/migrations/20251222000000_create_intake_output_records.sql`
4. 驗證表結構已更新為JSONB列

## 測試檢查清單

### Web端：
- [ ] 打開出入量記錄模態框
- [ ] 添加餐食記錄（測試下拉選擇）
- [ ] 添加飲品記錄（測試數字輸入）
- [ ] 添加管飼記錄
- [ ] 添加尿液記錄
- [ ] 添加胃液記錄（測試pH驗證）
- [ ] 刪除項目
- [ ] 保存新記錄
- [ ] 編輯現有記錄
- [ ] 測試狀態按鈕（入院/渡假/外出）

### Mobile端：
- [ ] 打開出入量記錄模態框
- [ ] 測試所有Picker組件
- [ ] 測試數字鍵盤輸入
- [ ] 測試添加/刪除按鈕觸控
- [ ] 測試滾動性能
- [ ] 保存並驗證數據正確存儲
- [ ] 重新打開驗證數據正確加載

## 已知問題

1. TypeScript LSP可能顯示臨時JSX錯誤，但實際運行正常
2. 需要手動安裝 `@react-native-picker/picker` 包
3. 需要手動執行數據庫遷移

## 效益

✅ **靈活性**：用戶可以根據實際情況動態添加任意數量的項目  
✅ **易用性**：下拉選擇減少輸入錯誤  
✅ **數據完整性**：類型定義確保數據結構正確  
✅ **可擴展性**：新增類型只需更新dropdown選項  
✅ **存儲優化**：JSONB格式高效存儲動態數據

## 後續工作

- [ ] 執行數據庫遷移
- [ ] 更新表格顯示邏輯以解析JSONB數據
- [ ] 更新導出功能以處理新的數據結構
- [ ] 添加數據遷移腳本（如需從舊格式遷移）
- [ ] 更新相關文檔
