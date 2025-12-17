# Excel 匯出修復詳細說明

## 修復日期
2025-11-09（第二次修復）

## 問題重現

在第一次修復後，使用者測試發現以下問題：

1. ❌ **A6 儲存格沒有保持範本內容**
2. ❌ **I7 表頭沒有正確顯示**
3. ❌ **I 欄沒有顯示修改者資訊**

---

## 根本原因分析

### 問題 1：範本提取邏輯有嚴重缺陷

**原始程式碼**（第 67-68 行）：
```typescript
if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
  cellData.value = cell.value;
}
```

**問題**：
- 只有當儲存格**有值**時才會提取 `value`
- 如果範本中的 A6 或 I7 是**空值**或**只有樣式**，value 不會被提取
- 導致後續應用範本時，這些儲存格沒有 value 屬性，無法正確保留

**影響範圍**：
- A6 如果在範本中是空的，不會被保護
- I7 如果在範本中是空的或只有樣式，不會被複製
- 所有空值但有樣式的儲存格都不會被正確處理

---

### 問題 2：範本應用邏輯有條件判斷

**原始程式碼**（第 309-311 行）：
```typescript
if (cellData.value !== undefined) {
  cell.value = cellData.value;
}
```

**問題**：
- 只有當 `cellData.value` 不是 undefined 時才會設定 value
- 由於範本提取時跳過了空值，這裡的條件導致空值儲存格永遠不會被設定
- 即使修復了範本提取，這個條件判斷仍會阻止空值的正確應用

---

### 問題 3：分頁邏輯也有相同問題

**原始程式碼**（第 400 行）：
```typescript
if (cellData.value !== undefined) targetCell.value = cellData.value;
```

**問題**：
- 分頁時複製表頭（包括 I7）也有條件判斷
- 導致新頁面的 I7 表頭無法被正確複製

---

### 問題 4：deepCopyRange 函數也有相同問題

**原始程式碼**（第 154-156 行）：
```typescript
if (cellData.value !== undefined) {
  targetCell.value = cellData.value;
}
```

**問題**：
- 用於複製資料列（第 8 列）的函數也有條件判斷
- 導致 I 欄的範本格式（空值但有樣式）無法被正確複製到新的資料列

---

## 修復方案

### 修復 1：範本提取邏輯

**新程式碼**（第 67-69 行）：
```typescript
// CRITICAL: Always extract value, even if null or empty
// This ensures template cells like A6 and I7 are preserved
cellData.value = cell.value;
```

**改進**：
- **無條件**提取所有儲存格的 value，包括 null、undefined、空字串
- 確保範本中的所有儲存格（包括空值儲存格）都被完整提取
- A6 和 I7 的值（即使是空的）都會被保留在範本資料中

---

### 修復 2：範本應用邏輯

**新程式碼**（第 306-328 行）：
```typescript
// Apply all template cells including A6 and I7
Object.entries(template.cellData).forEach(([address, cellData]) => {
  const cell = worksheet.getCell(address);

  // Always apply value (even if null) to preserve template defaults
  cell.value = cellData.value;

  if (cellData.font) {
    cell.font = cellData.font;
  }
  // ... 其他樣式設定
});
```

**改進**：
- **無條件**設定所有儲存格的 value
- 即使 value 是 null 或 undefined，也會被設定到新工作表
- 確保 A6 和 I7 的範本預設值被正確應用

---

### 修復 3：分頁邏輯

**新程式碼**（第 392-410 行）：
```typescript
// Copy all header rows (1-7) including A6 and I7
for (let headerRow = 1; headerRow <= 7; headerRow++) {
  const targetRow = pageStartRow + headerRow - 1;
  Object.entries(template.cellData).forEach(([address, cellData]) => {
    const cell = worksheet.getCell(address);
    if (cell.row === headerRow) {
      const colLetter = address.replace(/\d+/, '');
      const targetCell = worksheet.getCell(colLetter + targetRow);

      // Always copy value to preserve template defaults (including A6 and I7)
      targetCell.value = cellData.value;
      if (cellData.font) targetCell.font = { ...cellData.font, name: 'MingLiU' };
      // ... 其他樣式設定
    }
  });
}
```

**改進**：
- 新增註釋說明複製所有表頭列（包括 A6 和 I7）
- **無條件**複製 value 到新頁面
- 確保每個新頁面的 A6 和 I7 都有正確的範本預設值

---

### 修復 4：deepCopyRange 函數

**新程式碼**（第 145-175 行）：
```typescript
Object.entries(template.cellData).forEach(([address, cellData]) => {
  const cell = worksheet.getCell(address);
  const rowNum = cell.row;

  if (rowNum === sourceRow) {
    const colLetter = address.replace(/\d+/, '');
    const targetAddress = colLetter + targetRow;
    const targetCell = worksheet.getCell(targetAddress);

    // Always copy value to preserve template format (including column I)
    targetCell.value = cellData.value;

    if (cellData.font) {
      targetCell.font = { ...cellData.font, name: 'MingLiU' };
    } else {
      targetCell.font = { name: 'MingLiU' };
    }
    // ... 其他樣式設定
  }
});
```

**改進**：
- **無條件**複製 value 到目標列
- 確保 I 欄的範本格式（包括空值和樣式）被正確複製到所有資料列

---

## 修復效果

### ✅ A6 儲存格
- **首頁**：
  - 範本提取時：A6 的值（即使為空）被提取
  - 範本應用時：A6 的值被設定到新工作表
  - 結果：A6 保持範本的預設內容
- **分頁**：
  - 每頁的 A6 equivalent（pageStartRow + 5）都從範本複製
  - 結果：每頁的 A6 都保持範本預設內容

### ✅ I7 表頭
- **首頁**：
  - 範本提取時：I7 的值和樣式被提取
  - 範本應用時：I7 的值和樣式被設定到新工作表
  - 結果：I7 表頭正確顯示
- **分頁**：
  - 每頁的 I7（pageStartRow + 6）都從範本複製
  - 結果：每頁的 I7 表頭都正確顯示

### ✅ I 欄資料（I8, I9...）
- **範本複製**：
  - deepCopyRange 無條件複製 I8 的範本格式到所有資料列
  - 結果：每個資料列的 I 欄都有正確的樣式
- **資料填入**：
  - 第 488-490 行從資料庫讀取 `last_modified_by` 或 `created_by`
  - 結果：I 欄顯示修改者資訊（如果資料庫有資料）

---

## 關鍵改進總結

### 核心原則變更

**修復前**：
- ❌ 只提取和應用**有值**的儲存格
- ❌ 使用條件判斷 `if (value !== undefined)` 來決定是否設定值
- ❌ 導致空值儲存格的範本預設值無法被保留

**修復後**：
- ✅ **無條件**提取所有儲存格的值（包括 null/undefined）
- ✅ **無條件**應用所有儲存格的值到新工作表
- ✅ 確保範本中的所有儲存格（包括空值儲存格）都被完整保留

### 影響的函數

1. **extractSheetFormat**（範本提取）
   - 修改：無條件提取 value
   - 效果：A6 和 I7 的值被保留在範本資料中

2. **applyPersonalMedicationListTemplate**（範本應用 - 首頁）
   - 修改：無條件設定 value
   - 效果：首頁的 A6 和 I7 被正確設定

3. **分頁邏輯**（範本應用 - 新頁面）
   - 修改：無條件複製 value 到新頁面
   - 效果：每頁的 A6 和 I7 都被正確設定

4. **deepCopyRange**（資料列複製）
   - 修改：無條件複製 value 到新資料列
   - 效果：I 欄的範本格式被正確複製到所有資料列

---

## 測試檢查清單

### A6 測試
- [ ] 檢查範本的 A6 內容（記錄原始值）
- [ ] 匯出首頁，檢查 A6 是否與範本相同
- [ ] 匯出多頁（超過 15 筆處方），檢查每頁的 A6 是否與範本相同
- [ ] 確認 A6 沒有被任何處方資料覆寫

### I7 表頭測試
- [ ] 檢查範本的 I7 內容（記錄表頭文字和樣式）
- [ ] 匯出首頁，檢查 I7 表頭是否正確顯示
- [ ] 匯出多頁，檢查每頁的 I7 表頭是否都正確顯示
- [ ] 確認 I7 的字型、邊框、背景色等樣式與範本相同

### I 欄資料測試
- [ ] 確認資料庫已執行遷移（created_by 和 last_modified_by 欄位存在）
- [ ] 新增一筆處方，檢查資料庫是否記錄了 created_by
- [ ] 修改一筆處方，檢查資料庫是否更新了 last_modified_by
- [ ] 匯出包含新/修改處方的個人藥物記錄
- [ ] 檢查 I8, I9... 是否顯示修改者資訊（使用者 email）
- [ ] 檢查歷史處方（沒有 created_by）的 I 欄是否顯示為空白

### 樣式測試
- [ ] 檢查 I 欄的字型是否為 MingLiU
- [ ] 檢查 I 欄的邊框是否與範本相同
- [ ] 檢查 I 欄的對齊方式是否與範本相同

---

## 技術細節

### ExcelJS 的 value 處理

在 ExcelJS 中，儲存格的 `value` 可以是：
- **字串**：`"文字"`
- **數字**：`123`
- **日期**：`Date` 物件
- **公式**：`{ formula: '=SUM(A1:A10)' }`
- **Rich Text**：`{ richText: [...] }`
- **null**：空值
- **undefined**：未設定

**關鍵發現**：
- 即使 `value` 是 `null` 或 `undefined`，儲存格仍可能有樣式（font, border, fill）
- 範本中的空白儲存格通常 `value` 為 `null` 但有邊框等樣式
- 如果不保留 `null` 值，會導致儲存格的樣式無法正確應用

### 範本提取的完整性

**修復前的問題**：
```typescript
// 只提取有值的儲存格
if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
  cellData.value = cell.value;  // ❌ 空值儲存格的 value 不會被提取
}

if (Object.keys(cellData).length > 0) {
  extractedTemplate.cellData[address] = cellData;  // 只有樣式，沒有 value
}
```

**修復後的改進**：
```typescript
// 無條件提取所有儲存格的 value
cellData.value = cell.value;  // ✅ 包括 null、undefined、空字串

// 所有儲存格都會被保存
extractedTemplate.cellData[address] = cellData;  // 包含 value 和樣式
```

### 資料填入的優先順序

在填入資料時，處理順序很重要：

1. **範本應用**（設定預設值和樣式）
   ```typescript
   cell.value = cellData.value;  // 設定範本預設值（可能是 null）
   ```

2. **病人資訊填入**（覆寫特定儲存格）
   ```typescript
   worksheet.getCell('B3').value = patient.中文姓氏 + patient.中文名字;
   ```

3. **處方資料填入**（覆寫資料列）
   ```typescript
   worksheet.getCell('I' + itemRow).value = prescription.last_modified_by || '';
   ```

**關鍵點**：
- 只有在步驟 2 和 3 中**明確指定**的儲存格會被覆寫
- 其他儲存格（如 A6 和 I7）保持範本的預設值
- 這個順序確保範本預設值不會被意外覆寫

---

## 檔案變更總結

### 修改的檔案
1. `src/utils/personalMedicationListExcelGenerator.ts`
   - 修改了 4 個關鍵函數的 value 處理邏輯
   - 新增了詳細的註釋說明

### 修改的行數
- **extractSheetFormat**：第 60-106 行（範本提取）
- **applyPersonalMedicationListTemplate**：第 306-328 行（範本應用）
- **分頁邏輯**：第 392-410 行（新頁面表頭複製）
- **deepCopyRange**：第 145-175 行（資料列複製）

### 不需要修改的部分
- 資料填入邏輯（第 440-490 行）：已正確，無需修改
- 病人資訊填入（第 337-370 行）：已正確，保護了 A6
- 資料庫相關程式碼：第一次修復已完成

---

## 預期結果

經過這次修復，Excel 匯出應該完全正常：

### ✅ A6 儲存格
- 保持範本的預設內容
- 不會被任何處方資料覆寫
- 首頁和所有分頁都正確

### ✅ I7 表頭
- 顯示範本中設定的表頭文字
- 保留範本的所有樣式（字型、邊框、背景色）
- 首頁和所有分頁都正確

### ✅ I 欄資料
- 顯示處方的修改者資訊（使用者 email）
- 如果是新處方，顯示建立者
- 如果是歷史處方（沒有記錄），顯示空白
- 字型、邊框等樣式與範本一致

---

## 後續建議

### 範本設計建議
1. 確保範本的 I7 有明確的表頭文字（如："電子簽名"、"修改者"等）
2. 確保範本的 A6 有適當的預設內容（或留空）
3. 確保所有儲存格都有一致的樣式設定（字型、邊框）

### 測試建議
1. 準備多個測試場景：
   - 單頁匯出（少於 15 筆處方）
   - 多頁匯出（超過 15 筆處方）
   - 包含新處方和歷史處方的混合匯出
2. 對比匯出結果與範本，確認所有樣式都正確
3. 檢查資料庫記錄，確認使用者追蹤正常運作

### 維護建議
1. **不要**再對 value 的提取和應用加上條件判斷
2. 如果需要修改範本提取邏輯，確保**所有儲存格**都被提取
3. 如果需要修改範本應用邏輯，確保**所有儲存格**的 value 都被設定

---

## 結論

這次修復解決了範本提取和應用的核心邏輯缺陷。通過**無條件提取和應用所有儲存格的值**，確保了：

1. ✅ A6 儲存格保持範本預設內容
2. ✅ I7 表頭正確顯示
3. ✅ I 欄資料正確填入修改者資訊

所有修改都已通過建置測試，應該可以正常運作。請依照測試檢查清單進行完整測試，確認所有功能都符合預期。
