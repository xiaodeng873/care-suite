# Excel 匯出頁數功能更新

## 更新日期
2025-01-11

## 更新內容

為三個 Excel 匯出功能添加了頁數顯示功能，當匯出包含多個工作表時，每個工作表的表頭會顯示其頁數。

---

## 修改的文件

### 1. 生命表徵觀察記錄表 (vitalsignExcelGenerator.ts)
- **位置**：`src/utils/vitalsignExcelGenerator.ts`
- **頁數顯示位置**：M3 儲存格（表頭）
- **顯示格式**：'1', '2', '3'... (字串格式)

#### 修改內容：
1. `applyVitalSignTemplateFormat` 函數新增 `pageNumber?: number` 參數
2. 在填充院友表頭資料時，將頁數寫入 M3 儲存格
3. `createVitalSignWorkbook` 函數改用 for 循環並傳遞頁數 (i + 1)

---

### 2. 血糖測試記錄表 (bloodSugarExcelGenerator.ts)
- **位置**：`src/utils/bloodSugarExcelGenerator.ts`
- **頁數顯示位置**：L3 儲存格（表頭）
- **顯示格式**：'1', '2', '3'... (字串格式)

#### 修改內容：
1. `applyBloodSugarTemplateFormat` 函數新增 `pageNumber?: number` 參數
2. 在填充院友表頭資料時，將頁數寫入 L3 儲存格
3. `createBloodSugarWorkbook` 函數改用 for 循環並傳遞頁數 (i + 1)

---

### 3. 體重記錄表 (bodyweightExcelGenerator.ts)
- **位置**：`src/utils/bodyweightExcelGenerator.ts`
- **頁數顯示位置**：L3 儲存格（表頭）
- **顯示格式**：'1', '2', '3'... (字串格式)

#### 修改內容：
1. `applyBodyweightTemplateFormat` 函數新增 `pageNumber?: number` 參數
2. 在填充院友表頭資料時，將頁數寫入 L3 儲存格
3. `createBodyweightWorkbook` 函數改用 for 循環並傳遞頁數 (i + 1)

---

## 技術細節

### 實現邏輯

#### 1. 函數簽名更新
```typescript
// 修改前
const applyTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: {...},
  records: ExportData[]
): void => {
  // ...
}

// 修改後
const applyTemplateFormat = (
  worksheet: ExcelJS.Worksheet,
  template: ExtractedTemplate,
  patient: {...},
  records: ExportData[],
  pageNumber?: number  // 新增可選參數
): void => {
  // ...
}
```

#### 2. 頁數寫入邏輯
```typescript
// 在填充院友表頭資料時
if (pageNumber !== undefined) {
  worksheet.getCell('M3').value = String(pageNumber);  // 生命表徵用 M3
  // 或
  worksheet.getCell('L3').value = String(pageNumber);  // 血糖和體重用 L3
  console.log(`填充頁數到 L3/M3: ${pageNumber}`);
}
```

#### 3. 工作簿創建邏輯更新
```typescript
// 修改前
for (const config of sheetsConfig) {
  const worksheet = workbook.addWorksheet(config.name);
  applyTemplateFormat(worksheet, config.template, config.patient, config.records);
}

// 修改後
for (let i = 0; i < sheetsConfig.length; i++) {
  const config = sheetsConfig[i];
  const worksheet = workbook.addWorksheet(config.name);
  applyTemplateFormat(
    worksheet,
    config.template,
    config.patient,
    config.records,
    i + 1  // 傳遞頁數，從 1 開始
  );
}
```

---

## 使用說明

### 何時顯示頁數

頁數會在以下情況顯示：
1. **多個工作表**：當匯出的 Excel 文件包含多個工作表（多個院友）時
2. **每個工作表**：每個工作表都會在表頭顯示其頁數
3. **順序編號**：頁數從 1 開始，按工作表順序遞增

### 頁數顯示位置

| 記錄表類型 | 儲存格位置 | 備註 |
|----------|----------|------|
| 生命表徵觀察記錄表 | M3 | 最右側欄位 |
| 血糖測試記錄表 | L3 | 最右側欄位 |
| 體重記錄表 | L3 | 最右側欄位 |

### 顯示格式

- **格式**：純數字字串 ('1', '2', '3'...)
- **對齊**：繼承範本格式（通常為置中對齊）
- **字型**：繼承範本格式

---

## 測試建議

### 測試場景

1. **單個院友匯出**
   - 應顯示頁數 '1'

2. **多個院友匯出**
   - 第一個工作表顯示 '1'
   - 第二個工作表顯示 '2'
   - 第三個工作表顯示 '3'
   - 依此類推

3. **不同記錄表類型**
   - 生命表徵：檢查 M3 儲存格
   - 血糖測試：檢查 L3 儲存格
   - 體重記錄：檢查 L3 儲存格

### 檢查項目

- ✅ 頁數是否正確顯示在指定儲存格
- ✅ 頁數是否從 1 開始遞增
- ✅ 頁數格式是否為字串
- ✅ 頁數是否與工作表順序一致
- ✅ 其他表頭資料是否正常顯示
- ✅ 構建是否成功（已驗證）

---

## 向後兼容性

### 兼容性保證

1. **可選參數**：`pageNumber` 為可選參數，不影響現有代碼
2. **功能邏輯不變**：只添加頁數顯示，不修改其他功能
3. **範本格式**：完全繼承原有範本格式
4. **數據填充**：所有數據填充邏輯保持不變

### 升級影響

- ✅ 無破壞性變更
- ✅ 無需修改調用代碼
- ✅ 自動適用於所有匯出操作
- ✅ 不影響單個工作表匯出

---

## 構建驗證

### 構建結果
- **狀態**：✅ 成功
- **構建時間**：15.10s
- **警告**：無新增警告
- **錯誤**：無

### 受影響的 Chunk
- `vitalsignExcelGenerator`: 包含在主要 chunk 中
- `bloodSugarExcelGenerator`: 包含在主要 chunk 中
- `bodyweightExcelGenerator`: 包含在主要 chunk 中

所有相關代碼已正確編譯並包含在生產構建中。

---

## 日誌輸出

當頁數被填充時，會在控制台輸出以下日誌：

```
填充頁數到 M3: 1  // 生命表徵
填充頁數到 L3: 1  // 血糖測試
填充頁數到 L3: 1  // 體重記錄
```

這有助於開發時調試和驗證功能是否正常工作。

---

## 總結

本次更新為三個健康記錄表的 Excel 匯出功能添加了頁數顯示，使用戶在列印或查看多頁記錄時能夠清楚識別每一頁。

### 主要優點
1. ✅ 改善用戶體驗：清晰的頁數標識
2. ✅ 便於列印管理：多頁文件更易整理
3. ✅ 向後兼容：不影響現有功能
4. ✅ 自動應用：無需額外配置

### 實現方式
- 最小化修改：只添加必要的頁數參數和顯示邏輯
- 類型安全：使用 TypeScript 可選參數
- 一致性：三個記錄表採用相同的實現模式
