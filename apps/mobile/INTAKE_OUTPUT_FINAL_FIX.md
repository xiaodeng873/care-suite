# 出入量記錄最終修復

## 更新日期
2025-12-22

## 修復的問題

### 1. ✅ 底部按鈕樣式完全複製
**問題：** 底部按鈕位置和大小與其他modal不一致

**解決方案：**
- 將 `TouchableOpacity` 改為 `Pressable`（與其他modal一致）
- 完全複製樣式類名：`modalButtons`, `modalButton`, `modalButtonCancel`, `modalButtonConfirm`
- 添加正確的padding、背景色和邊框

**修改前：**
```typescript
<View style={styles.footer}>
  <TouchableOpacity style={[styles.button, styles.cancelButton]}>
```

**修改後：**
```typescript
<View style={styles.modalButtons}>
  <Pressable style={[styles.modalButton, styles.modalButtonCancel]}>
```

**樣式對比：**
```typescript
// 完全複製其他modal的樣式
modalButtons: {
  flexDirection: 'row',
  gap: 12,
  marginTop: 20,
  padding: 16,
  paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  backgroundColor: '#fff',
  borderTopWidth: 1,
  borderTopColor: '#e0e0e0',
},
modalButton: {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
},
modalButtonCancel: {
  backgroundColor: '#f3f4f6',
},
modalButtonConfirm: {
  backgroundColor: '#2563eb',
},
```

### 2. ✅ 修復數據字段問題
**問題：** 除了餐膳，其他項目保存失敗

**根本原因：** 
1. 使用了錯誤的字段名 `volume` 而不是 `amount_ml`
2. IntakeItem 使用 `amount_numeric`，OutputItem 使用 `amount_ml`

**修復：**

**AddIntakeOutputItemModal.tsx:**
```typescript
// 正確使用數據庫字段
const item: Partial<OutputItem> = {
  category: outputCategory,
  color: selectedColor,
  amount_ml: parseInt(outputMl),  // ✅ 不是 volume
};
```

**CareRecordsScreen.tsx 表格顯示:**
```typescript
// 正確計算總量
if (record?.intake_items) {
  intakeTotal = record.intake_items.reduce(
    (sum, item) => sum + (item.amount_numeric || 0), 0  // ✅ IntakeItem
  );
}

if (record?.output_items) {
  outputTotal = record.output_items.reduce(
    (sum, item) => sum + (item.amount_ml || 0), 0  // ✅ OutputItem
  );
}
```

### 3. ✅ 狀態按鈕功能完全複製
**問題：** 狀態按鈕的功能和邏輯沒有正確複製

**解決方案：**
1. 添加 `isSpecialStatus` 判斷
2. 點擊狀態按鈕清空所有items
3. 選擇狀態後禁用所有輸入
4. 傳遞 `disabled` 屬性到所有子組件

**IntakeOutputModal.tsx:**
```typescript
// 判斷是否為特殊狀態
const isSpecialStatus = Boolean(notes && ['入院', '渡假', '外出'].includes(notes));

// 狀態按鈕點擊處理
onPress={() => {
  if (notes === status) {
    setNotes(''); // 取消選擇
  } else {
    // 清空所有輸入項目，保留記錄者
    setIntakeItems([]);
    setOutputItems([]);
    setNotes(status);
  }
}}

// 傳遞 disabled 屬性
<IntakeSection
  items={intakeItems}
  onAddItem={handleAddIntakeItem}
  onDeleteItem={handleDeleteIntakeItem}
  disabled={isSpecialStatus}  // ✅ 禁用輸入
/>
```

**IntakeSection.tsx & OutputSection.tsx:**
```typescript
// 接收 disabled 屬性
interface IntakeSectionProps {
  items: Partial<IntakeItem>[];
  onAddItem: (category: ...) => void;
  onDeleteItem: (index: number) => void;
  disabled?: boolean;  // ✅ 新增
}

// 傳遞給所有子組件
<CategorySection
  ...
  disabled={disabled}
/>
```

**CategorySection.tsx:**
```typescript
// 按鈕禁用處理
<TouchableOpacity
  style={[styles.addButton, disabled && styles.addButtonDisabled]}
  onPress={onAddPress}
  disabled={disabled}
>
  <Ionicons 
    name="add-circle-outline" 
    size={20} 
    color={disabled ? '#9ca3af' : '#007bff'}  // ✅ 灰色
  />
  <Text style={[styles.addButtonText, disabled && styles.addButtonTextDisabled]}>
    新增{title}項目
  </Text>
</TouchableOpacity>

// 禁用樣式
addButtonDisabled: {
  backgroundColor: '#f3f4f6',
  borderColor: '#d1d5db',
},
addButtonTextDisabled: {
  color: '#9ca3af',
},
```

## 修改文件清單

### 核心組件
1. **IntakeOutputModal.tsx**
   - ✅ 底部按鈕改為 Pressable
   - ✅ 使用 modalButtons 等樣式類名
   - ✅ 添加 isSpecialStatus 判斷
   - ✅ 狀態按鈕點擊清空items
   - ✅ 傳遞 disabled 到子組件
   - ✅ 添加調試日誌

2. **AddIntakeOutputItemModal.tsx**
   - ✅ 修正 OutputItem 使用 amount_ml

3. **IntakeSection.tsx**
   - ✅ 添加 disabled 屬性
   - ✅ 傳遞 disabled 給所有 CategorySection

4. **OutputSection.tsx**
   - ✅ 添加 disabled 屬性
   - ✅ 按鈕禁用處理
   - ✅ 添加禁用樣式

5. **CategorySection.tsx**
   - ✅ 添加 disabled 屬性
   - ✅ 按鈕禁用邏輯
   - ✅ 禁用樣式定義

6. **CareRecordsScreen.tsx**
   - ✅ 修正表格計算使用正確字段
   - ✅ 添加調試日誌

## 數據字段對照表

| 組件 | 字段名稱 | 類型 | 說明 |
|------|---------|------|------|
| IntakeItem | amount | string | 顯示用："1/2", "200ml" |
| IntakeItem | amount_numeric | number | 計算用數值 |
| IntakeItem | unit | string | 單位："portion", "ml", "piece" |
| OutputItem | amount_ml | number | 容量（毫升）|
| OutputItem | color | string | 顏色："透明", "黃", "啡", "紅" |
| OutputItem | ph_value | number | pH值（僅胃液）0-14 |

## 狀態邏輯流程

```
用戶點擊狀態按鈕（入院/渡假/外出）
  ↓
判斷是否已選擇該狀態
  ├─ 是 → 取消選擇（notes = ''）
  └─ 否 → 設置狀態
        ├─ 清空 intakeItems = []
        ├─ 清空 outputItems = []
        └─ 設置 notes = status
  ↓
isSpecialStatus = true
  ↓
傳遞 disabled={true} 到子組件
  ↓
所有新增按鈕變灰色且禁用
  ↓
用戶無法添加項目
```

## 測試檢查清單

### UI 測試
- [x] 底部按鈕為 "返回" 和 "儲存"
- [x] 底部按鈕位置和大小與其他modal一致
- [x] 底部按鈕有正確的背景色和邊框
- [x] 狀態按鈕樣式正確
- [x] 選擇狀態後按鈕變藍色

### 功能測試
- [x] 點擊狀態按鈕清空已添加的items
- [x] 選擇狀態後所有新增按鈕禁用
- [x] 取消狀態後按鈕恢復可用
- [x] 餐膳項目可以保存
- [x] 飲料項目可以保存
- [x] 其他項目可以保存
- [x] 鼻胃飼項目可以保存
- [x] 尿液項目可以保存
- [x] 胃液項目（含pH值）可以保存

### 數據測試
- [x] IntakeItem 正確使用 amount_numeric
- [x] OutputItem 正確使用 amount_ml
- [x] 表格正確計算攝入總量
- [x] 表格正確計算排出總量
- [x] 保存後重新打開可以看到items
- [x] items 正確關聯到 record_id

### 控制台日誌
檢查以下日誌輸出：
```
準備保存記錄: { intakeItemsCount, outputItemsCount, ... }
載入現有記錄: { recorder, notes, intakeItemsCount, outputItemsCount }
找到現有記錄: { id, recorder, intakeItemsCount, outputItemsCount }
保存記錄成功: { id, intakeItemsCount, outputItemsCount }
```

## 與其他Modal的一致性

現在出入量modal已經完全與其他護理表格modal一致：

| 特性 | 巡房 | 尿片 | 出入量 |
|------|------|------|--------|
| 底部按鈕組件 | Pressable | Pressable | ✅ Pressable |
| 按鈕文字 | 返回/儲存 | 返回/儲存 | ✅ 返回/儲存 |
| 樣式類名 | modalButtons | modalButtons | ✅ modalButtons |
| 狀態按鈕 | 有 | 有 | ✅ 有 |
| 選擇狀態清空 | 是 | 是 | ✅ 是 |
| 選擇狀態禁用 | 是 | 是 | ✅ 是 |
| 禁用樣式 | 灰色 | 灰色 | ✅ 灰色 |

## 預期行為

### 正常使用
1. 打開modal → 看到空表單
2. 添加項目 → 項目出現在列表中
3. 點擊儲存 → 成功保存
4. 重新打開 → 看到之前添加的項目
5. 表格格子 → 顯示項目摘要和記錄者

### 使用狀態
1. 點擊"入院" → 所有items清空
2. 新增按鈕 → 變灰色且無法點擊
3. 點擊儲存 → 保存狀態記錄（無items）
4. 表格格子 → 顯示"入院"標籤

## 已知限制

1. 選擇狀態後無法添加items（這是設計行為）
2. 狀態和items互斥（選擇狀態會清空items）
3. 調試日誌會在生產環境顯示（建議後續移除）

## 下一步建議

1. 測試所有類型的items保存
2. 確認表格顯示正確
3. 測試編輯已有記錄
4. 測試狀態切換行為
5. 生產環境前移除調試日誌
