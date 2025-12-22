# 出入量記錄 - 記錄者和備註功能更新

## 更新日期
2025年

## 更新內容

### 1. 記錄者功能改進
#### 修改前
- 記錄者字段為只讀顯示
- 無法在模態框中編輯記錄者姓名

#### 修改後
- 記錄者改為可編輯文本輸入框
- 標註為必填字段（帶 * 號）
- 保存時驗證記錄者不能為空
- UI樣式與其他護理表格保持一致

### 2. 狀態快捷按鈕
#### 新增功能
- 添加三個狀態快捷按鈕：入院、渡假、外出
- 點擊狀態按鈕自動填入備註
- 再次點擊可取消選擇
- 選擇狀態後，其他備註輸入框自動隱藏

#### UI設計
```tsx
狀態按鈕樣式：
- 未選中：淺灰色背景 (#f3f4f6)，深色文字
- 已選中：藍色背景 (#2563eb)，白色文字
- 三個按鈕並排顯示，平均分配空間
```

### 3. 備註功能優化
#### 修改前
- 單一備註輸入框

#### 修改後
- 快捷狀態按鈕（入院/渡假/外出）
- 其他備註輸入框（僅在未選擇狀態時顯示）
- 多行文本輸入，支持自由備註

### 4. 數據庫集成改進
#### `getIntakeOutputRecords()` 函數更新
**修改前：**
```typescript
export const getIntakeOutputRecords = async (): Promise<IntakeOutputRecord[]> => {
  const { data, error } = await supabase
    .from('intake_output_records')
    .select('*')
    .order('record_date', { ascending: false })
    .order('time_slot', { ascending: true });
  if (error) throw error;
  return data || [];
};
```

**修改後：**
```typescript
export const getIntakeOutputRecords = async (): Promise<IntakeOutputRecord[]> => {
  // 1. 獲取所有記錄
  const { data: records, error } = await supabase
    .from('intake_output_records')
    .select('*')
    .order('record_date', { ascending: false })
    .order('time_slot', { ascending: true });
  
  if (error) throw error;
  if (!records) return [];

  // 2. 為每條記錄獲取關聯的 items
  const recordsWithItems = await Promise.all(
    records.map(async (record) => {
      // 獲取攝入項目
      const { data: intakeItems } = await supabase
        .from('intake_items')
        .select('*')
        .eq('record_id', record.id)
        .order('created_at', { ascending: true });
      
      // 獲取排出項目
      const { data: outputItems } = await supabase
        .from('output_items')
        .select('*')
        .eq('record_id', record.id)
        .order('created_at', { ascending: true });

      return {
        ...record,
        intake_items: intakeItems || [],
        output_items: outputItems || []
      };
    })
  );

  return recordsWithItems;
};
```

**改進說明：**
- 現在獲取記錄時自動包含所有關聯的攝入和排出項目
- 使用 Promise.all 並行加載所有項目，提高性能
- 確保返回的記錄包含完整的 items 數據

### 5. 表格顯示邏輯更新
#### 從 Items 構建摘要
**修改前：**
- 依賴舊的字段（meal_breakfast, beverage_water 等）
- 使用 calculateIntakeTotal 和 calculateOutputTotal 函數

**修改後：**
```typescript
// 從 intake_items 構建摘要
const itemsSummary: string[] = [];

if (record?.intake_items && record.intake_items.length > 0) {
  // 按類別分組
  const mealItems = record.intake_items.filter(item => item.category === 'meal');
  const beverageItems = record.intake_items.filter(item => item.category === 'beverage');
  const tubeFeedingItems = record.intake_items.filter(item => item.category === 'tube_feeding');
  
  // 餐食摘要：早餐1/2 午餐1
  if (mealItems.length > 0) {
    const mealText = mealItems
      .map(item => `${item.item_type}${item.amount || ''}`)
      .join(' ');
    itemsSummary.push(mealText);
  }
  
  // 飲料總量：飲200ml
  if (beverageItems.length > 0) {
    const beverageTotal = beverageItems.reduce((sum, item) => sum + (item.volume || 0), 0);
    if (beverageTotal > 0) {
      itemsSummary.push(`飲${beverageTotal}ml`);
    }
  }
  
  // 鼻胃飼總量：飼300ml
  if (tubeFeedingItems.length > 0) {
    const tubeTotal = tubeFeedingItems.reduce((sum, item) => sum + (item.volume || 0), 0);
    if (tubeTotal > 0) {
      itemsSummary.push(`飼${tubeTotal}ml`);
    }
  }
}

// 計算總攝入量
let intakeTotal = 0;
if (record?.intake_items) {
  intakeTotal = record.intake_items.reduce((sum, item) => sum + (item.volume || 0), 0);
}

// 計算總排出量
let outputTotal = 0;
if (record?.output_items) {
  outputTotal = record.output_items.reduce((sum, item) => sum + (item.volume || 0), 0);
}
```

#### 表格單元格顯示格式
```tsx
{statusLabel ? (
  <Text style={styles.statusLabel}>{statusLabel}</Text>
) : record ? (
  <View style={styles.completedContent}>
    <View style={{ gap: 2 }}>
      {/* 項目摘要：早餐1/2 午餐1 飲200ml */}
      {itemsSummary.length > 0 && (
        <Text style={[styles.diaperText, { fontSize: 11 }]} numberOfLines={2}>
          {itemsSummary.join(' ')}
        </Text>
      )}
      {/* 攝入總量：▲ 500ml */}
      {intakeTotal > 0 && (
        <Text style={[styles.diaperText, { fontSize: 11, color: '#059669' }]}>
          ▲ {intakeTotal}ml
        </Text>
      )}
      {/* 排出總量：▼ 300ml */}
      {outputTotal > 0 && (
        <Text style={[styles.diaperText, { fontSize: 11, color: '#dc2626' }]}>
          ▼ {outputTotal}ml
        </Text>
      )}
    </View>
    {/* 記錄者名稱 */}
    <Text style={styles.recorderText}>{record.recorder}</Text>
  </View>
) : (
  <Text style={styles.pendingText}>{t('pendingRecord')}</Text>
)}
```

### 6. UI/UX 改進
#### 與其他護理表格保持一致
- 記錄者輸入框樣式統一
- 狀態按鈕布局統一
- 表格單元格顯示格式統一
- 記錄者顯示位置統一（在內容下方）

#### 表格顯示優化
- 項目摘要支持兩行顯示
- 使用顏色區分攝入（綠色）和排出（紅色）
- 簡潔的摘要格式，避免信息過載

### 7. 代碼清理
#### 刪除的過時代碼
- `calculateIntakeTotal()` 函數（已由新邏輯替代）
- `calculateOutputTotal()` 函數（已由新邏輯替代）

#### 保留但未使用的代碼
- `renderIntakeOutputModal()` 函數（舊版模態框，1878-2527行）
- `saveIntakeOutputRecord()` 函數（舊版保存邏輯）
- `editingIntakeOutput` 狀態（舊版狀態管理）

**建議：** 在確認新功能穩定後，可以刪除這些未使用的代碼以減少維護負擔。

## 文件更改清單

### `/apps/mobile/src/components/IntakeOutput/IntakeOutputModal.tsx`
- ✅ 記錄者改為可編輯輸入框
- ✅ 添加狀態快捷按鈕（入院/渡假/外出）
- ✅ 備註輸入框條件顯示
- ✅ 保存時驗證記錄者不為空
- ✅ 添加相應樣式

### `/apps/mobile/src/lib/database.ts`
- ✅ 更新 `getIntakeOutputRecords()` 函數，包含關聯 items
- ✅ 使用 Promise.all 並行加載提高性能

### `/apps/mobile/src/screens/CareRecordsScreen.tsx`
- ✅ 更新 `renderIntakeOutputTable()` 從 items 構建摘要
- ✅ 刪除過時的 `calculateIntakeTotal()` 和 `calculateOutputTotal()` 函數
- ✅ 優化表格單元格顯示邏輯

## 測試要點

### 功能測試
1. ✅ 記錄者輸入框可編輯
2. ✅ 記錄者為空時無法保存
3. ✅ 狀態按鈕點擊切換正常
4. ✅ 選擇狀態後備註輸入框隱藏
5. ✅ 表格正確顯示保存的項目摘要
6. ✅ 表格正確顯示記錄者姓名
7. ✅ 攝入/排出總量計算正確

### UI測試
1. ✅ 記錄者輸入框樣式與其他表格一致
2. ✅ 狀態按鈕樣式正確
3. ✅ 表格單元格布局合理
4. ✅ 顏色使用（綠色=攝入，紅色=排出）清晰

### 數據測試
1. ✅ 記錄包含完整的 intake_items 和 output_items
2. ✅ 新建記錄正確保存
3. ✅ 編輯記錄正確更新
4. ✅ 項目正確關聯到記錄

## 下一步建議

1. **代碼清理**
   - 刪除未使用的 `renderIntakeOutputModal()` 函數
   - 刪除未使用的 `saveIntakeOutputRecord()` 函數
   - 刪除未使用的 `editingIntakeOutput` 狀態

2. **性能優化**
   - 考慮使用 Supabase 的 JOIN 查詢替代多次查詢
   - 添加加載狀態指示器

3. **功能增強**
   - 添加項目類型圖標
   - 支持更多摘要格式選項
   - 添加數據導出功能

## 影響範圍

### 前端
- IntakeOutputModal 組件
- CareRecordsScreen 出入量表格
- 數據庫查詢邏輯

### 後端
- `getIntakeOutputRecords()` 函數性能影響
- 數據庫查詢次數增加（每條記錄需額外2次查詢）

### 數據庫
- 無結構變更
- 查詢負載可能增加

## 兼容性

- ✅ 向後兼容現有數據
- ✅ 不影響其他護理表格
- ✅ 移動端 (React Native) 正常
- ⚠️ Web端需要同步更新（如有）
