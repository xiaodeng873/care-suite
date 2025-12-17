# 狀態選擇器功能 - 數據庫遷移指南

## ⚠️ 重要：必須先執行數據庫遷移

在應用程序能正常工作之前，你**必須**執行以下數據庫遷移：

### 方法 1：使用 Supabase CLI（推薦）

```bash
cd /workspaces/CareApp
supabase db push
```

### 方法 2：手動在 Supabase Dashboard 執行

1. 登錄 Supabase Dashboard
2. 進入你的項目
3. 點擊左側菜單的 "SQL Editor"
4. 執行以下 SQL：

```sql
-- Add notes column to diaper_change_records if it doesn't exist
ALTER TABLE diaper_change_records 
ADD COLUMN IF NOT EXISTS notes text;

-- Add notes column to position_change_records if it doesn't exist
ALTER TABLE position_change_records 
ADD COLUMN IF NOT EXISTS notes text;

-- Create indexes for better query performance when filtering by notes
CREATE INDEX IF NOT EXISTS idx_diaper_change_records_notes 
  ON diaper_change_records (notes) 
  WHERE notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_position_change_records_notes 
  ON position_change_records (notes) 
  WHERE notes IS NOT NULL;
```

5. 點擊 "Run" 執行

## 為什麼需要這個遷移？

當選擇狀態（入院/渡假/外出）時，應用程序會將狀態保存到 `notes` 字段：
- `patrol_rounds.notes` - ✅ 已存在
- `diaper_change_records.notes` - ❌ 需要添加
- `restraint_observation_records.notes` - ✅ 已存在  
- `position_change_records.notes` - ❌ 需要添加

如果不執行遷移，當你嘗試保存換尿片或轉身記錄的狀態時，會看到錯誤：
```
Could not find the 'notes' column of 'diaper_change_records' in the schema cache
Could not find the 'notes' column of 'position_change_records' in the schema cache
```

## 遷移後的測試步驟

執行遷移後，在應用中測試：

### 1. 巡房記錄
- ✅ 點擊任意院友的巡房時段
- ✅ 選擇狀態（入院/渡假/外出）
- ✅ 確認時間輸入框變灰且禁用
- ✅ 點擊保存（應該成功，不需要填寫時間）
- ✅ 返回列表，確認顯示狀態標籤

### 2. 換尿片記錄
- ✅ 點擊任意院友的換片時段
- ✅ 選擇狀態（入院/渡假/外出）
- ✅ 確認所有選項（小便/大便/無）變灰且禁用
- ✅ 點擊保存（應該成功，不需要選擇排泄情況）
- ✅ 返回列表，確認顯示狀態標籤

### 3. 約束觀察記錄
- ✅ 點擊任意院友的約束觀察時段
- ✅ 選擇狀態（入院/渡假/外出）
- ✅ 確認時間輸入框和觀察狀態按鈕變灰且禁用
- ✅ 點擊保存（應該成功，不需要填寫時間和觀察狀態）
- ✅ 返回列表，確認顯示狀態標籤

### 4. 轉身記錄
- ✅ 點擊任意院友的轉身時段
- ✅ 選擇狀態（入院/渡假/外出）
- ✅ 確認位置選擇按鈕（左/平/右）變灰且禁用
- ✅ 點擊保存（應該成功，不需要選擇位置）
- ✅ 返回列表，確認顯示狀態標籤
- ✅ 編輯現有記錄，確認有刪除按鈕

## 代碼修改總結

所有代碼已修復，包括：

### ✅ 添加的函數
- `clearPatrolFields()` - 清空巡房表單
- `handlePatrolStatusSelect()` - 處理巡房狀態選擇

### ✅ 修正的問題
1. **巡房表單**：
   - 修正狀態選擇器調用正確的 handler
   - 添加輸入框禁用邏輯
   - 修改驗證允許只保存狀態
   - 必填標記改為條件性

2. **換尿片表單**：
   - 修正狀態選擇器調用正確的 handler
   - 添加小便量選擇UI（之前缺失）
   - 將狀態選擇器移到表單最後
   - 必填標記改為條件性

3. **約束觀察表單**：
   - 修正狀態選擇器調用正確的 handler
   - 必填標記改為條件性

4. **轉身記錄**：
   - 已經正確實現（無需修改）

### ✅ 所有表單的通用行為
- 選擇狀態後，其他字段自動清空
- 所有輸入控件被禁用（帶 `disabledCheckbox` 或 `disabledInput` 樣式）
- 可以只保存狀態，驗證邏輯已放寬
- 必填標記 `*` 變為條件性：`{!status && '*'}`
- 所有記錄類型都有刪除按鈕（編輯時）

## 文件位置

- 遷移文件：`/workspaces/CareApp/supabase/migrations/20251213000000_add_notes_columns_to_care_records.sql`
- 修改的代碼：`/workspaces/CareApp/src/screens/RecordDetailScreen.tsx`
