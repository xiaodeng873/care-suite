# iPad 數字鍵盤功能測試指南

## 測試環境需求
- 實體 iPad 裝置（建議使用 iPad Pro 或 iPad Air）
- iPad 橫向模式（Landscape orientation）
- Safari 瀏覽器或其他支援 iOS WebKit 的瀏覽器

## 已修改的組件

### 1. HealthRecordModal.tsx（單筆新增/編輯監測記錄）
- 血壓收縮壓：純數字鍵盤
- 血壓舒張壓：純數字鍵盤
- 脈搏：純數字鍵盤
- 體溫：小數點數字鍵盤
- 血含氧量：純數字鍵盤
- 呼吸頻率：純數字鍵盤
- 血糖值：小數點數字鍵盤
- 體重：小數點數字鍵盤

### 2. BatchHealthRecordModal.tsx（批量新增監測記錄）
- 所有生命表徵記錄的數字輸入欄位
- 所有血糖控制記錄的數字輸入欄位
- 所有體重控制記錄的數字輸入欄位

## 技術實現細節

### 純整數輸入欄位配置
```html
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  autoComplete="off"
/>
```
- **`type="text"`**：使用 text 類型而非 number，以確保 iOS Safari 正確識別 inputMode 屬性（重要！）
- `inputMode="numeric"`：在 iOS 裝置上顯示純數字鍵盤（0-9）
- `pattern="[0-9]*"`：提供額外的驗證和舊版 iOS 兼容性
- `autoComplete="off"`：禁用自動完成功能
- **JavaScript 驗證**：在 onChange 事件中使用正則表達式過濾非數字字符，並驗證數值範圍

### 小數輸入欄位配置
```html
<input
  type="text"
  inputMode="decimal"
  pattern="[0-9.]*"
  autoComplete="off"
/>
```
- **`type="text"`**：使用 text 類型而非 number，以確保 iOS Safari 正確識別 inputMode 屬性（重要！）
- `inputMode="decimal"`：在 iOS 裝置上顯示帶小數點的數字鍵盤
- `pattern="[0-9.]*"`：允許數字和小數點輸入
- `autoComplete="off"`：禁用自動完成功能
- **JavaScript 驗證**：在 onChange 事件中使用正則表達式過濾非數字和小數點字符，並驗證數值範圍

### 為什麼使用 `type="text"` 而非 `type="number"`？

在 iOS Safari 上，當 input 元素的 type 設為 "number" 時，瀏覽器會優先使用自己的數字輸入處理邏輯，**忽略 `inputMode` 屬性**。這會導致：
1. 仍然顯示完整的 QWERTY 鍵盤
2. `inputMode="numeric"` 和 `inputMode="decimal"` 無效
3. 用戶體驗不佳

使用 `type="text"` 配合 `inputMode` 和 JavaScript 驗證可以完美解決此問題：
- iOS 會正確顯示數字鍵盤
- 通過 JavaScript 過濾確保只能輸入數字
- 通過範圍驗證確保數值有效性
- 完全控制輸入行為

## 測試步驟

### 測試場景 1：單筆新增生命表徵記錄
1. 在 iPad 上橫向模式開啟應用程式
2. 導航至「健康評估」或相關監測記錄頁面
3. 點擊「新增監測記錄」按鈕
4. 點擊「血壓收縮壓」輸入框
5. **預期結果**：應顯示純數字鍵盤（0-9），無字母鍵
6. 輸入數值（例如：120）
7. 點擊「體溫」輸入框
8. **預期結果**：應顯示帶小數點的數字鍵盤
9. 輸入數值（例如：36.5）
10. 依序測試所有數字輸入欄位

### 測試場景 2：批量新增記錄
1. 在 iPad 橫向模式下開啟應用程式
2. 導航至批量新增監測記錄功能
3. 選擇「生命表徵」記錄類型
4. 點擊任意數字輸入欄位
5. **預期結果**：應顯示對應的數字鍵盤（純數字或帶小數點）
6. 新增多筆記錄並驗證每筆記錄的輸入欄位

### 測試場景 3：編輯現有記錄
1. 開啟現有的監測記錄
2. 點擊「編輯」按鈕
3. 點擊任意數字輸入欄位
4. **預期結果**：應顯示對應的數字鍵盤
5. 修改數值並儲存

## 驗證清單

- [ ] 血壓收縮壓顯示純數字鍵盤
- [ ] 血壓舒張壓顯示純數字鍵盤
- [ ] 脈搏顯示純數字鍵盤
- [ ] 體溫顯示帶小數點的數字鍵盤
- [ ] 血含氧量顯示純數字鍵盤
- [ ] 呼吸頻率顯示純數字鍵盤
- [ ] 血糖值顯示帶小數點的數字鍵盤
- [ ] 體重顯示帶小數點的數字鍵盤
- [ ] 批量新增模式所有數字欄位正常工作
- [ ] 無自動完成提示出現
- [ ] 鍵盤不會遮擋輸入欄位
- [ ] 橫向模式下鍵盤大小適中

## 已知限制

1. **僅支援 iPad 裝置**：此功能針對 iPad 優化，iPhone 可能顯示不同的鍵盤
2. **需要 iOS 12.2+**：`inputMode` 屬性需要較新版本的 iOS 支援
3. **Safari 最佳**：建議使用 Safari 瀏覽器以獲得最佳體驗
4. **不影響桌面瀏覽器**：在桌面瀏覽器上，輸入行為保持不變

## 疑難排解

### 問題：仍然顯示完整鍵盤
**可能原因**：
- iOS 版本過舊（需要 iOS 12.2 或更高版本）
- 使用了不支援 `inputMode` 的瀏覽器
- 裝置語言設定影響

**解決方案**：
- 更新 iOS 到最新版本
- 使用 Safari 瀏覽器
- 檢查裝置語言和鍵盤設定

### 問題：無法輸入小數點
**可能原因**：
- 輸入欄位配置錯誤
- 數字鍵盤類型不正確

**解決方案**：
- 確認欄位使用 `inputMode="decimal"`
- 確認 `pattern` 屬性包含小數點：`pattern="[0-9.]*"`

## 更新日誌

### 2025-11-03 (版本 2 - 修正)
- **關鍵修正**：將所有數字輸入欄位從 `type="number"` 改為 `type="text"`
- 原因：iOS Safari 會忽略 `type="number"` 元素的 `inputMode` 屬性
- 為所有數字輸入欄位添加 JavaScript 驗證以確保數據有效性
- 純整數欄位：過濾非數字字符並驗證範圍（血壓、脈搏、血氧、呼吸頻率）
- 小數欄位：過濾非數字和小數點字符並驗證範圍（體溫、血糖、體重）
- 為 HealthRecordModal 添加數字鍵盤支援
- 為 BatchHealthRecordModal 添加數字鍵盤支援
- 所有數字輸入欄位添加 `autoComplete="off"`

### 2025-11-03 (版本 1 - 初始版本，已廢棄)
- ~~使用 `type="number"` 配合 `inputMode`~~（此方法在 iOS Safari 上無效）

## 相關文件
- [MDN: inputmode 屬性](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode)
- [iOS Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/Introduction/Introduction.html)
