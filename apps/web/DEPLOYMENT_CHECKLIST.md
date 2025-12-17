# iPad 數字鍵盤部署檢查清單

## ✅ 部署前檢查

### 1. 驗證原始碼
```bash
# 檢查 HealthRecordModal.tsx 中的 inputMode 屬性
grep -n "inputMode" src/components/HealthRecordModal.tsx | wc -l
# 應該顯示 8 行

# 檢查 BatchHealthRecordModal.tsx 中的 inputMode 屬性  
grep -n "inputMode" src/components/BatchHealthRecordModal.tsx | wc -l
# 應該顯示 8 行
```

### 2. 重新建置
```bash
# 清除舊的建置
rm -rf dist

# 重新建置
npm run build

# 驗證建置產物中包含 inputMode
grep -a "inputMode" dist/assets/main-*.js | head -3
# 應該看到 inputMode="numeric" 和 inputMode="decimal"
```

### 3. 部署到伺服器
```bash
# 部署整個 dist 資料夾
# 確保 keyboard-test.html 也被部署
```

## ✅ iPad 測試檢查

### 步驟 1: 清除緩存（必須！）
- [ ] 設定 > Safari > 清除瀏覽記錄與網站資料
- [ ] 或長按重新整理按鈕 > 清除緩存並重新載入
- [ ] 完全關閉 Safari 後重新開啟

### 步驟 2: 訪問測試頁面
- [ ] 開啟：`您的網址/keyboard-test.html`
- [ ] 檢查裝置資訊是否正確（iPad, Safari, iOS 版本）
- [ ] 點擊「測試 1」的輸入框
- [ ] **預期**：應該看到純數字鍵盤（0-9）

### 步驟 3: 測試主應用程式
- [ ] 開啟主應用程式
- [ ] 前往「新增監測記錄」
- [ ] 點擊「血壓收縮壓」欄位
- [ ] **預期**：應該看到純數字鍵盤（0-9）
- [ ] 點擊「體溫」欄位  
- [ ] **預期**：應該看到帶小數點的數字鍵盤

## ❌ 如果還是不行

### 問題診斷：

1. **測試頁面也不行**
   - 問題：iOS 版本可能太舊
   - 解決：檢查 iOS 版本是否 >= 12.2
   - 或：Safari 設定有問題

2. **測試頁面可以，主應用程式不行**
   - 問題：主應用程式沒有使用最新建置
   - 解決：重新建置並部署
   - 或：緩存問題，需要更徹底清除

3. **所有輸入框都顯示完整鍵盤**
   - 問題：可能使用了 Chrome 而非 Safari
   - 解決：確認使用的是 Safari 瀏覽器
   - 或：檢查 Settings > Safari > Advanced > Experimental Features

### 終極測試：

在 iPad Safari 控制台執行：
```javascript
// 檢查 inputMode 是否被正確設定
document.querySelector('input[type="text"]').getAttribute('inputmode')
// 應該返回 "numeric" 或 "decimal"

// 檢查所有數字輸入框
document.querySelectorAll('input[type="text"][inputmode]').length
// 應該 > 0
```

## 📞 需要協助

如果以上步驟都確認無誤但仍然無法正常工作，請提供：

1. iPad 型號：_______________
2. iOS 版本：_______________
3. Safari 版本：_______________
4. 測試頁面結果：[ ] 成功 [ ] 失敗
5. 主應用程式結果：[ ] 成功 [ ] 失敗
6. 截圖：鍵盤的樣子

## 🎯 成功標準

- ✅ 血壓收縮壓/舒張壓：純數字鍵盤（0-9）
- ✅ 脈搏：純數字鍵盤（0-9）
- ✅ 血含氧量：純數字鍵盤（0-9）
- ✅ 呼吸頻率：純數字鍵盤（0-9）
- ✅ 體溫：小數點數字鍵盤（0-9 + .）
- ✅ 血糖值：小數點數字鍵盤（0-9 + .）
- ✅ 體重：小數點數字鍵盤（0-9 + .）
- ✅ 無法輸入字母或其他字符
- ✅ 批量新增模式也正常工作
