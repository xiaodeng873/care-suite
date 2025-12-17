# 藥物工作流程顯示邏輯修復

## 修復日期
2025年11月9日

## 問題描述

### 問題1：未開始的處方錯誤顯示
**現象：** 11月9日才開始的處方出現在11月2-8日的週次表格中

**原因：** 前端過濾邏輯只檢查了 `start_date <= weekEnd`，沒有過濾還未開始的處方

### 問題2：已結束的處方仍然顯示
**現象：** 結束日期在週開始之前的處方仍然顯示在表格中

**原因：** 結束日期檢查被註釋掉了（為了支持查看歷史記錄），但沒有正確實現

## 修復內容

### 更新的過濾邏輯

**文件：** `src/pages/MedicationWorkflow.tsx`

**修復前的邏輯：**
```typescript
if (p.status === 'active') {
  const startDate = new Date(p.start_date);
  if (startDate > weekEnd) {
    return false;
  }
  // 結束日期檢查被註釋掉
  return true;
}
```

**修復後的邏輯：**
```typescript
if (p.status === 'active') {
  const weekStart = new Date(weekDates[0]);
  const weekEnd = new Date(weekDates[6]);
  const startDate = new Date(p.start_date);

  // 處方必須在週結束日期之前或當天開始
  if (startDate > weekEnd) {
    return false;
  }

  // 如果有結束日期，處方必須在週開始日期之後或當天結束
  if (p.end_date) {
    const endDate = new Date(p.end_date);
    if (endDate < weekStart) {
      return false;
    }
  }

  return true;
}
```

### 新的過濾規則

#### 1. 在服處方（status = 'active'）
顯示條件：
- ✅ `start_date <= weekEnd`（處方已經開始或在當週開始）
- ✅ `end_date >= weekStart` 或 `end_date is null`（處方未結束或在當週結束）

不顯示：
- ❌ `start_date > weekEnd`（處方還未開始）
- ❌ `end_date < weekStart`（處方已在本週之前結束）

#### 2. 停用處方（status = 'inactive'）
顯示條件：
- ✅ 當週有該處方的工作流程記錄（`weekPrescriptionIds.has(p.id)`）

#### 3. 其他狀態（如 pending_change）
- ❌ 不顯示

## 測試場景

### 場景1：Ciprofloxacin 處方（11月2-8日）
**處方信息：**
- start_date: 2025-11-02
- end_date: 2025-11-08
- status: inactive

**預期結果：**
- ✅ 在 11月2-8日週次顯示（有工作流程記錄）
- ❌ 在 11月9-15日週次不顯示（無工作流程記錄）

### 場景2：Amlodipine 處方（11月9日開始）
**處方信息：**
- start_date: 2025-11-09
- end_date: null
- status: pending_change

**預期結果：**
- ❌ 在 11月2-8日週次不顯示（pending_change 狀態）
- ❌ 在 11月2-8日週次不顯示（即使改為 active，start_date > weekEnd）
- ✅ 在 11月9-15日週次顯示（如果改為 active）

### 場景3：Amoxicillin 處方（11月9日開始）
**處方信息：**
- start_date: 2025-11-09
- end_date: null
- status: active

**預期結果：**
- ❌ 在 11月2-8日週次不顯示（start_date > weekEnd）
- ✅ 在 11月9-15日週次顯示（start_date <= weekEnd）

## 修復驗證

### 驗證步驟
1. 進入「藥物工作流程」頁面
2. 切換到 11月2-8日週次
3. 確認只顯示：
   - 在該週期內有效的在服處方
   - 在該週期內有工作流程記錄的停用處方
4. 確認不顯示：
   - 11月9日才開始的處方
   - pending_change 狀態的處方
   - 在11月2日之前就結束的處方

### 已確認修復
- ✅ Ciprofloxacin 處方的21筆工作流程記錄已生成
- ✅ 前端顯示邏輯已修復
- ✅ 構建成功，無錯誤

## 相關文件
- 修復文件: `src/pages/MedicationWorkflow.tsx`
- Edge Function: `supabase/functions/generate-daily-medication-workflow/index.ts`
- 生成邏輯說明: `WORKFLOW_GENERATION_UPDATE.md`

## 注意事項

### ⚠️ 日期比較邏輯
- 所有日期比較使用 JavaScript Date 對象
- 時區問題已在 Edge Function 中處理（使用本地日期）
- 前端顯示邏輯使用 `weekDates[0]` 和 `weekDates[6]` 作為週範圍

### ⚠️ 狀態過濾
- `active`：檢查日期有效性
- `inactive`：只檢查是否有工作流程記錄
- `pending_change` 和其他：不顯示

### ⚠️ 工作流程記錄的生成
- 工作流程記錄不受處方狀態限制
- 只要目標日期在處方有效期內，都可以生成記錄
- 生成後的記錄會永久保存，即使處方後來被停用

## 常見問題

**Q: 為什麼停用的 Ciprofloxacin 處方還能看到？**
A: 因為該處方在11月2-8日期間有工作流程記錄，系統會顯示它以便查看和匯出歷史記錄。

**Q: 為什麼 11月9日的處方不顯示在 11月2-8日的週次？**
A: 因為該處方的開始日期（11月9日）在當週結束日期（11月8日）之後，不符合顯示條件。

**Q: 如何查看已結束處方的歷史記錄？**
A: 切換到該處方有效期內的週次，如果該週有工作流程記錄，處方會自動顯示。

**Q: pending_change 狀態的處方會顯示嗎？**
A: 不會。只有 active 和 inactive（且有記錄）的處方才會顯示。
