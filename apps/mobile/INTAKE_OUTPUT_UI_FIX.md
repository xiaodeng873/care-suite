# 出入量記錄 UI 修復更新

## 更新日期
2025-12-22

## 問題修復

### 1. ✅ 取消「其他備註」輸入框
**問題：** 模態框中有「其他備註」輸入框，與設計不符

**解決方案：**
- 移除條件顯示的「其他備註」輸入框
- 僅保留狀態快捷按鈕（入院/渡假/外出）
- 備註字段僅用於存儲狀態選擇

**修改文件：**
- `IntakeOutputModal.tsx` - 刪除其他備註輸入框部分

### 2. ✅ 更新底部按鈕樣式
**問題：** 按鈕文字和樣式與其他護理表格不一致

**修改前：**
- 左按鈕：「取消」
- 右按鈕：「儲存記錄」
- 樣式不統一

**修改後：**
- 左按鈕：「返回」
- 右按鈕：「儲存」
- 樣式與其他modal完全一致

**樣式更新：**
```typescript
footer: {
  flexDirection: 'row',
  gap: 12,  // 統一間距
  padding: 16,
  paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  backgroundColor: '#fff',
  borderTopWidth: 1,
  borderTopColor: '#e0e0e0',
},
button: {
  flex: 1,
  paddingVertical: 12,  // 統一padding
  paddingHorizontal: 16,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
},
cancelButton: {
  backgroundColor: '#f3f4f6',  // 統一顏色
},
cancelButtonText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#374151',
},
saveButton: {
  backgroundColor: '#2563eb',  // 統一藍色
},
saveButtonText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#ffffff',
},
```

### 3. ✅ 修復項目保存和加載問題
**問題：** 
- 保存後表格不顯示項目內容
- 點擊進入modal看不到之前儲存的項目

**根本原因：**
`createIntakeItems` 和 `createOutputItems` 函數需要包含 `record_id` 的items數組

**修改前：**
```typescript
const createdIntakeItems = await createIntakeItems(
  record.id,
  intakeItems as Omit<IntakeItem, 'id' | 'record_id' | 'created_at'>[]
);
```

**修改後：**
```typescript
const itemsWithRecordId = intakeItems.map(item => ({
  ...item,
  record_id: record.id,
})) as Omit<IntakeItem, 'id' | 'created_at'>[];

const createdIntakeItems = await createIntakeItems(itemsWithRecordId);
```

### 4. ✅ 添加調試日誌
**目的：** 幫助排查數據加載問題

**IntakeOutputModal.tsx:**
```typescript
useEffect(() => {
  if (existingRecord) {
    console.log('載入現有記錄:', {
      recorder: existingRecord.recorder,
      notes: existingRecord.notes,
      intakeItemsCount: existingRecord.intake_items?.length || 0,
      outputItemsCount: existingRecord.output_items?.length || 0,
    });
    // ... 加載邏輯
  }
}, [existingRecord, staffName, visible]);
```

**CareRecordsScreen.tsx:**
```typescript
existingRecord={(() => {
  const record = intakeOutputRecords.find(
    r => r.record_date === selectedDateString && r.time_slot === selectedTimeSlot
  );
  if (record) {
    console.log('找到現有記錄:', {
      id: record.id,
      recorder: record.recorder,
      intakeItemsCount: record.intake_items?.length || 0,
      outputItemsCount: record.output_items?.length || 0,
    });
  }
  return record;
})()}
```

## 修改文件清單

### `/apps/mobile/src/components/IntakeOutput/IntakeOutputModal.tsx`
1. ✅ 刪除「其他備註」輸入框
2. ✅ 更新底部按鈕文字：「返回」和「儲存」
3. ✅ 更新底部按鈕樣式與其他modal一致
4. ✅ 修復 `createIntakeItems` 調用，正確添加 `record_id`
5. ✅ 修復 `createOutputItems` 調用，正確添加 `record_id`
6. ✅ 添加調試日誌

### `/apps/mobile/src/screens/CareRecordsScreen.tsx`
1. ✅ 添加 `existingRecord` 查找日誌
2. ✅ 添加 `onSave` 保存日誌

## UI 變更對比

### 底部按鈕區域

**修改前：**
```
┌─────────────────────────────────────┐
│ [ 取消 ]     [ 儲存記錄 ]          │
└─────────────────────────────────────┘
```

**修改後：**
```
┌─────────────────────────────────────┐
│ [ 返回 ]        [ 儲存 ]           │
└─────────────────────────────────────┘
```

### 記錄者和備註區域

**修改前：**
```
┌─────────────────────────────────────┐
│ 記錄者 *                            │
│ [輸入框]                            │
│                                     │
│ 狀態                                │
│ [入院] [渡假] [外出]               │
│                                     │
│ 其他備註:                           │
│ [多行輸入框]                        │
└─────────────────────────────────────┘
```

**修改後：**
```
┌─────────────────────────────────────┐
│ 記錄者 *                            │
│ [輸入框]                            │
│                                     │
│ 狀態                                │
│ [入院] [渡假] [外出]               │
└─────────────────────────────────────┘
```

## 數據流程圖

### 保存流程
```
用戶點擊「儲存」
  ↓
驗證記錄者不為空
  ↓
創建/更新 intake_output_records
  ↓
為 intakeItems 添加 record_id
  ↓
批量創建 intake_items
  ↓
為 outputItems 添加 record_id
  ↓
批量創建 output_items
  ↓
返回完整記錄（含 items）
  ↓
更新 CareRecordsScreen 狀態
  ↓
關閉模態框
```

### 加載流程
```
用戶點擊時段格子
  ↓
從 intakeOutputRecords 查找記錄
  ↓
記錄包含 intake_items 和 output_items
  ↓
傳遞給 IntakeOutputModal
  ↓
useEffect 載入數據
  ↓
設置 intakeItems 和 outputItems 狀態
  ↓
IntakeSection 和 OutputSection 顯示項目
```

## 測試要點

### 功能測試
- [ ] 點擊「返回」按鈕關閉模態框
- [ ] 點擊「儲存」按鈕保存記錄
- [ ] 狀態按鈕可以切換選擇
- [ ] 新增項目後可以正確保存
- [ ] 保存後重新打開可以看到之前的項目
- [ ] 表格格子正確顯示項目摘要

### UI測試
- [ ] 底部按鈕文字為「返回」和「儲存」
- [ ] 底部按鈕樣式與其他modal一致
- [ ] 沒有「其他備註」輸入框
- [ ] 狀態按鈕樣式正確

### 數據測試
- [ ] 新建記錄包含完整的items
- [ ] 編輯記錄可以看到原有items
- [ ] 刪除items正常工作
- [ ] 表格正確計算和顯示摘要

## 已知問題

### 需要進一步測試
1. 確認 `getIntakeOutputRecords()` 是否正確獲取了items
2. 確認表格顯示摘要的邏輯是否正確
3. 確認items的category字段是否正確

### 潛在問題
如果保存後仍然看不到items，可能的原因：
1. `getIntakeOutputRecords()` 查詢有問題
2. 數據庫關聯查詢失敗
3. items的數據結構不匹配

## 下一步

1. **測試完整流程**
   - 新增記錄 → 添加項目 → 保存 → 關閉
   - 點擊格子 → 查看記錄 → 確認項目顯示
   - 編輯記錄 → 修改項目 → 保存 → 確認更新

2. **檢查控制台日誌**
   - 查看「載入現有記錄」日誌
   - 查看「找到現有記錄」日誌
   - 查看「保存記錄成功」日誌
   - 確認items數量是否正確

3. **如果仍有問題**
   - 檢查數據庫中的數據
   - 確認 intake_items 和 output_items 表中有數據
   - 確認 record_id 關聯正確
   - 檢查 `getIntakeOutputRecords()` 的SQL查詢

## 預期結果

完成後應該：
✅ 模態框底部按鈕為「返回」和「儲存」
✅ 沒有「其他備註」輸入框
✅ 保存記錄後包含所有items
✅ 重新打開記錄可以看到之前的items
✅ 表格格子顯示項目摘要和記錄者
