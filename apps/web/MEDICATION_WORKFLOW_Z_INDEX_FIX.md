# 藥物工作流程頁面 Z-Index 根本解決方案

## 修復日期
2025-12-09

## 問題描述

### 1. 小分頁 TAB 位置錯誤
- **問題**：小分頁 TAB（全部、提前備藥、即時備藥）位置不在主表格欄的上方
- **原因**：TAB 作為獨立的 sticky 元素，在表格容器外部

### 2. 一鍵清單被遮擋
- **問題**：在 iPad 橫向模式中，一鍵清單被院友資訊區塊遮擋
- **原因**：院友資訊區的 z-index (z-[15]) 高於一鍵清單，導致層疊順序錯誤

## 根本解決方案

### 1. 重組小分頁 TAB 結構

**修改前：**
```tsx
<div className="card overflow-hidden">
  {/* TAB 在外部作為獨立 sticky */}
  <div className="sticky top-48 z-10...">
    小分頁 TAB
  </div>

  {filteredPrescriptions.length > 0 && (
    <div className="relative">
      表格容器
    </div>
  )}
</div>
```

**修改後：**
```tsx
<div className="card overflow-hidden">
  {filteredPrescriptions.length > 0 && (
    <div className="relative">
      {/* TAB 在表格容器內部，作為表格的一部分 */}
      <div className="border-b border-gray-200 bg-gray-50">
        小分頁 TAB
      </div>

      表格容器
    </div>
  )}
</div>
```

**效果：**
- 小分頁 TAB 現在是表格的一部分，始終顯示在表格頭部上方
- 不再使用 sticky 定位，避免層疊上下文衝突
- TAB 隨表格一起滾動，更符合用戶預期

### 2. 優化 Z-Index 層級系統

**調整前的層級：**
```
頁面標題：z-30
院友資訊卡：z-[15]
小分頁 TAB：z-10
一鍵清單：z-9999
```

**調整後的層級：**
```
頁面標題：z-[25]
院友資訊卡：z-[5]    ← 降低到最低
小分頁 TAB：無 z-index（不需要）
一鍵清單：z-9999（inline style）
```

**關鍵變更：**
1. **院友資訊卡降低至 z-[5]**
   - 確保不會遮擋任何浮動元素
   - 只需要高於普通內容即可

2. **一鍵清單使用 inline style**
   ```tsx
   style={{
     zIndex: 9999  // 最高優先級
   }}
   ```
   - 使用 inline style 而非 Tailwind class，確保瀏覽器正確應用
   - z-9999 足夠高，避免與其他元素衝突

3. **小分頁 TAB 移除 z-index**
   - 不再使用 sticky 定位
   - 作為表格的一部分，不需要 z-index

## 技術原理

### 為什麼 inline style 比 Tailwind class 更可靠？

**問題根源：**
- Tailwind 的 z-index utility classes 有預設值限制
- 某些瀏覽器（尤其是移動設備）在處理超大數字的 z-index class 時可能不穩定
- Tailwind 的層疊上下文可能與頁面其他元素產生衝突

**解決方案：**
```tsx
// ❌ 不可靠
<div className="z-[99999]">

// ✅ 可靠
<div style={{ zIndex: 9999 }}>
```

### 層疊上下文（Stacking Context）

正確的層級順序：
1. **頁面標題** (z-25) - 最頂層 sticky
2. **一鍵清單** (z-9999) - 浮動彈出層，必須在所有元素之上
3. **院友資訊卡** (z-5) - 第二層 sticky
4. **普通內容** (z-0 或無) - 基礎層

## 測試驗證

### 桌面模式測試
- [x] 小分頁 TAB 在表格頭部上方
- [x] 一鍵清單可以正常顯示
- [x] 點擊一鍵清單功能正常

### iPad 橫向模式測試
- [x] 小分頁 TAB 位置正確
- [x] 一鍵清單不被院友資訊區遮擋
- [x] 一鍵清單可以正常點擊和操作
- [x] 滾動時所有層級正常

### 預期結果
```
當點擊日期欄位時：
1. 一鍵清單正確彈出
2. 清單顯示在所有元素之上
3. 清單不被任何 sticky 元素遮擋
4. 清單內按鈕可以正常點擊
```

## 代碼位置

**文件：** `/src/pages/MedicationWorkflow.tsx`

**關鍵修改：**
1. **行 3033**：院友資訊卡 z-index 降為 z-[5]
2. **行 3068-3110**：小分頁 TAB 移到表格容器內部
3. **行 3221**：一鍵清單使用 inline style zIndex: 9999

## 總結

這次修復採用了**根本性解決方案**：
1. **重組結構** - 將 TAB 移到正確的位置（表格容器內部）
2. **簡化層級** - 降低不必要的 z-index 值
3. **確保可靠性** - 關鍵元素使用 inline style

這種方式不僅解決了當前問題，也避免了未來可能出現的類似問題。
