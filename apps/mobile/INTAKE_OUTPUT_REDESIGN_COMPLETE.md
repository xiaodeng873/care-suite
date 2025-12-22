# 出入量記錄 - Mobile端重新設計完成

## 更新日期
2024年12月22日

## 概述
Mobile端的出入量記錄已完全重新設計，現在與換片記錄的模式完全一致，包括：
- 院友姓名（唯讀）
- 記錄日期和時段（唯讀）
- 記錄者（必填）
- 狀態按鈕（入院/渡假/外出）
- 完整的餐食和飲品輸入
- 尿液和胃液輸出記錄

## 修改的文件

### 1. `/apps/mobile/src/utils/careRecordHelper.ts`
**新增：**
```typescript
export const INTAKE_OUTPUT_SLOTS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];
```

### 2. `/apps/mobile/src/screens/CareRecordsScreen.tsx`

#### 2.1 導入更新（第47行）
```typescript
import {
  TIME_SLOTS,
  DIAPER_CHANGE_SLOTS,
  INTAKE_OUTPUT_SLOTS,  // 新增
  // ...
} from '../utils/careRecordHelper';
```

#### 2.2 狀態管理更新（第139行）
```typescript
const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
```
- 從 `selectedHourSlot: number | null` 改為 `selectedTimeSlot: string`

#### 2.3 點擊處理函數重寫（第1098-1152行）
`handleIntakeOutputPress(timeSlot: string)` - 完全重寫：
- 接收 timeSlot 字符串（例如 "08:00"）而不是 hour 數字
- 從 timeSlot 解析 hourSlot：`parseInt(timeSlot.split(':')[0])`
- 初始化所有欄位（餐食、飲品、管飼、尿液、胃液）
- 如果是新記錄，自動填入 recorder = staffName

#### 2.4 保存函數重寫（第1154-1197行）
`saveIntakeOutputRecord()` - 完全重寫：
- 檢查 `if (!selectedTimeSlot)` 而不是 `if (selectedHourSlot === null)`
- 驗證記錄者：`if (!editingIntakeOutput.recorder?.trim())`
- 從 selectedTimeSlot 解析 hourSlot
- 構建完整的數據對象（所有欄位明確設置為 null 或值）
- 支持創建和更新記錄
- 保存成功後清空 selectedTimeSlot 和 editingIntakeOutput

#### 2.5 表格渲染更新（第1199-1237行）
`renderIntakeOutputTable()` - 使用 24 小時格式：
- 使用 `INTAKE_OUTPUT_SLOTS.map(timeSlot =>` 代替 `HOUR_SLOTS.map(hour =>`
- 從 timeSlot 解析 hourSlot 以查找記錄
- 表格列：
  - 時段（timeSlot，例如 "08:00"）
  - 餐食摘要（早1/4 午2/4 茶全份 晚3/4）
  - 攝入量總計（綠色，單位ml）
  - 排出量總計（紅色，單位ml）
  - 記錄者姓名
  - 編輯/新增圖標
- 點擊時調用：`handleIntakeOutputPress(timeSlot)`

#### 2.6 模態框完全重新設計（第2107-2396行）
`renderIntakeOutputModal()` - 匹配換片記錄模式：

**條件檢查：**
```typescript
if (!showIntakeOutputModal || !selectedTimeSlot) return null;
```

**結構：**
1. **院友信息區**
   - 院友姓名（唯讀，灰色背景）
   - 記錄日期（唯讀，灰色背景）
   - 時段（唯讀，顯示 selectedTimeSlot，灰色背景）

2. **記錄者（必填）**
   - 白色背景可編輯輸入框
   - 佔位符：「請輸入記錄者姓名」
   - 當選擇狀態時禁用（灰色背景）

3. **狀態按鈕**
   - 三個按鈕：入院、渡假、外出
   - 選中時藍色背景（#2563eb），白色文字
   - 未選中時灰色背景（#f3f4f6），深色文字
   - 點擊狀態按鈕會清空所有輸入欄位

4. **餐食份量**
   - 早餐、午餐、下午茶、晚餐
   - 文字輸入框，例如：「1/4, 2/4, 全份」
   - 當選擇狀態時禁用

5. **飲品 (ml)**
   - 清水、湯、奶、果汁、糖水、茶
   - 數字輸入框
   - 當選擇狀態時禁用

6. **管飼 (ml)**
   - Isocal、Glucerna、Compleat
   - 數字輸入框
   - 當選擇狀態時禁用

7. **尿液排出**
   - 尿量（數字輸入，ml）
   - 尿色（文字輸入，例如：透明、黃、啡）
   - 當選擇狀態時禁用

8. **胃液排出**
   - 胃液量（數字輸入，ml）
   - pH值（數字輸入，0-14範圍驗證）
   - 胃液顏色（文字輸入，例如：透明、黃、啡）
   - 當選擇狀態時禁用

**狀態按鈕邏輯：**
```typescript
const handleStatusButtonClick = (status: string) => {
  if (editingIntakeOutput.notes === status) {
    setEditingIntakeOutput(prev => ({ ...prev, notes: '' }));
  } else {
    // 清空所有輸入欄位，只保留recorder
    setEditingIntakeOutput({
      ...所有欄位重置為初始值...,
      recorder: editingIntakeOutput.recorder || staffName,
      notes: status,
    });
  }
};
```

**關閉模態框：**
```typescript
setShowIntakeOutputModal(false);
setSelectedTimeSlot('');
setEditingIntakeOutput({});
```

## 與Web端的一致性

Mobile端現在與Web端完全一致：

| 功能 | Web端 | Mobile端 |
|-----|------|---------|
| 時段格式 | timeSlot (string) | timeSlot (string) ✅ |
| 時段數量 | 24 (00:00-23:00) | 24 (00:00-23:00) ✅ |
| 院友姓名 | 唯讀 | 唯讀 ✅ |
| 記錄日期 | 唯讀 | 唯讀 ✅ |
| 時段顯示 | 唯讀 | 唯讀 ✅ |
| 記錄者 | 必填 | 必填 ✅ |
| 狀態按鈕 | 入院/渡假/外出 | 入院/渡假/外出 ✅ |
| 狀態效果 | 清空欄位並禁用 | 清空欄位並禁用 ✅ |
| 餐食輸入 | 文字框 | 文字框 ✅ |
| 管飼選項 | Isocal/Glucerna/Compleat | Isocal/Glucerna/Compleat ✅ |
| 表格顯示 | 餐食摘要 + 記錄者 | 餐食摘要 + 記錄者 ✅ |

## 數據庫字段使用

### 保存到數據庫：
```typescript
{
  patient_id: patient.院友id,
  record_date: dateString,
  hour_slot: parseInt(selectedTimeSlot.split(':')[0]),
  
  // 餐食
  meal_breakfast: string | null,
  meal_lunch: string | null,
  meal_afternoon_tea: string | null,
  meal_dinner: string | null,
  
  // 飲品
  beverage_water: number | null,
  beverage_soup: number | null,
  beverage_milk: number | null,
  beverage_juice: number | null,
  beverage_sugar_water: number | null,
  beverage_tea: number | null,
  
  // 其他入量（設為null）
  other_cookies: null,
  other_snacks: null,
  other_candy: null,
  other_dessert: null,
  
  // 管飼
  tube_isocal: number | null,
  tube_ultracal: number | null,  // 未使用
  tube_glucerna: number | null,
  tube_isosource: null,  // 未使用
  tube_compleat: number | null,
  
  // 尿液
  urine_volume: number | null,
  urine_color: string | null,
  
  // 胃液
  gastric_volume: number | null,
  gastric_ph: number | null,
  gastric_color: string | null,
  
  // 標準欄位
  recorder: string (必填),
  notes: string | undefined (狀態：入院/渡假/外出)
}
```

## 用戶體驗改進

1. **清晰的時段顯示**：24小時格式（00:00-23:00）更直觀
2. **餐食摘要**：表格直接顯示「早1/4 午2/4」等，一目了然
3. **記錄者可見**：表格顯示記錄者姓名，便於追蹤
4. **狀態快速設置**：點擊入院/渡假/外出按鈕自動清空欄位
5. **智能禁用**：選擇狀態後自動禁用所有輸入欄位
6. **數據驗證**：pH值限制在0-14範圍
7. **必填提示**：記錄者欄位有明確的佔位符和驗證

## 測試建議

### 1. 新增記錄
- [ ] 點擊任意時段，模態框顯示正確的院友姓名、日期、時段
- [ ] 記錄者自動填入當前用戶姓名
- [ ] 輸入各類數據（餐食、飲品、管飼、尿液、胃液）
- [ ] 保存成功後表格更新

### 2. 編輯記錄
- [ ] 點擊已有記錄的時段
- [ ] 模態框正確顯示所有已保存的數據
- [ ] 修改數據並保存
- [ ] 表格更新顯示新數據

### 3. 狀態按鈕
- [ ] 點擊「入院」按鈕，所有輸入欄位被清空並禁用
- [ ] 記錄者欄位保持填充但禁用
- [ ] 再次點擊「入院」按鈕，取消狀態，所有欄位恢復可編輯
- [ ] 測試「渡假」和「外出」按鈕同樣行為

### 4. 表格顯示
- [ ] 餐食摘要正確顯示（例如：早1/4 午2/4）
- [ ] 攝入量總計顯示為綠色
- [ ] 排出量總計顯示為紅色
- [ ] 記錄者姓名正確顯示
- [ ] 已有記錄顯示編輯圖標，空時段顯示新增圖標

### 5. 數據驗證
- [ ] 記錄者為空時，保存顯示錯誤提示
- [ ] pH值輸入15時被拒絕
- [ ] pH值輸入7.5時接受（0-14範圍內）

## 後續工作

1. **數據庫遷移**：執行 `20251222000000_create_intake_output_records.sql`
2. **跨平台測試**：在Web和Mobile端測試數據一致性
3. **性能測試**：測試24小時記錄的渲染性能
4. **導出功能**：確認Excel導出包含新格式的出入量記錄

## 技術細節

### 時段轉換
```typescript
// timeSlot -> hourSlot
const hourSlot = parseInt(timeSlot.split(':')[0]);

// hourSlot -> timeSlot (在表格中)
const timeSlot = `${String(hour).padStart(2, '0')}:00`;
```

### 餐食摘要構建
```typescript
const mealParts: string[] = [];
if (record?.meal_breakfast) mealParts.push(`早${record.meal_breakfast}`);
if (record?.meal_lunch) mealParts.push(`午${record.meal_lunch}`);
if (record?.meal_afternoon_tea) mealParts.push(`茶${record.meal_afternoon_tea}`);
if (record?.meal_dinner) mealParts.push(`晚${record.meal_dinner}`);
const mealSummary = mealParts.join(' ') || '-';
```

### 攝入/排出量計算
```typescript
const calculateIntakeTotal = (record?: IntakeOutputRecord | null) => {
  if (!record) return 0;
  return (record.beverage_water || 0) +
         (record.beverage_soup || 0) +
         (record.beverage_milk || 0) +
         (record.beverage_juice || 0) +
         (record.beverage_sugar_water || 0) +
         (record.beverage_tea || 0) +
         (record.tube_isocal || 0) +
         (record.tube_ultracal || 0) +
         (record.tube_glucerna || 0) +
         (record.tube_compleat || 0);
};

const calculateOutputTotal = (record?: IntakeOutputRecord | null) => {
  if (!record) return 0;
  return (record.urine_volume || 0) +
         (record.gastric_volume || 0);
};
```

## 完成狀態

✅ Mobile端重新設計完成
✅ 與Web端模式完全一致
✅ 24小時時段格式
✅ 院友信息唯讀顯示
✅ 記錄者必填驗證
✅ 狀態按鈕功能
✅ 所有輸入欄位支持
✅ 表格顯示餐食摘要和記錄者
✅ 數據保存和更新邏輯
✅ 清空和關閉邏輯

---

**重新設計完成於：** 2024年12月22日
**設計模式：** 複製換片記錄的做法
**完成度：** 100%
