# 選項卡消失問題排查與解決方案

## 🔴 問題現象
在添加衛生記錄功能後，mobile app 院友介面的所有選項卡都消失了。

## 🔍 問題根源

### 主要原因：數據庫遷移未執行

選項卡消失的根本原因是 **數據庫遷移文件還沒有在 Supabase 中執行**。

### 技術細節

1. **patient_care_tabs 表的 CHECK 約束**
   - 舊約束：`tab_type IN ('patrol', 'diaper', 'intake_output', 'restraint', 'position', 'toilet_training')`
   - 新約束（需要遷移）：增加 `'hygiene'`

2. **當約束未更新時的行為**
   - 任何嘗試查詢或插入 `tab_type = 'hygiene'` 的記錄都會失敗
   - `getPatientCareTabs()` 函數可能返回空數組或報錯
   - 導致 `availableTabs` 為空，所有選項卡消失

3. **hygiene_records 表缺少字段**
   - 原始遷移缺少 `status_notes` 字段
   - 已修復：添加了 `status_notes text` 字段

## ✅ 解決方案

### 步驟 1：執行數據庫遷移（必須按順序）

在 Supabase Dashboard 的 SQL Editor 中依次執行：

#### 遷移 1：擴展 patient_care_tabs 表
```sql
-- 文件：20251221000000_extend_patient_care_tabs_tracking.sql
-- 此遷移會：
-- 1. 添加 last_activated_at 字段
-- 2. 更新 tab_type CHECK 約束以包含 'hygiene'
-- 3. 創建觸發器追蹤選項卡啟用時間
```

執行文件：`apps/mobile/supabase/migrations/20251221000000_extend_patient_care_tabs_tracking.sql`

#### 遷移 2：創建 hygiene_records 表
```sql
-- 文件：20251221000001_create_hygiene_records_table.sql
-- 此遷移會：
-- 1. 創建 hygiene_records 表（包含所有護理項目和大便記錄）
-- 2. 設置 RLS 政策
-- 3. 創建索引
-- 4. 添加 updated_at 觸發器
```

執行文件：`apps/mobile/supabase/migrations/20251221000001_create_hygiene_records_table.sql`

### 步驟 2：驗證遷移成功

在 Supabase SQL Editor 執行驗證查詢：

```sql
-- 1. 驗證 patient_care_tabs 約束
SELECT con.conname, pg_get_constraintdef(con.oid) 
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'patient_care_tabs' 
AND con.conname LIKE '%tab_type%';

-- 應該看到約束包含 'hygiene'

-- 2. 驗證 hygiene_records 表存在
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'hygiene_records'
ORDER BY ordinal_position;

-- 應該看到所有字段，包括 status_notes

-- 3. 驗證 last_activated_at 字段
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'patient_care_tabs' 
AND column_name = 'last_activated_at';

-- 應該返回一行結果
```

### 步驟 3：重啟 Mobile App

執行遷移後：

1. 停止當前運行的 Expo 服務器（Ctrl+C）
2. 重新啟動：
   ```bash
   cd apps/mobile
   npx expo start --tunnel
   ```
3. 重新掃描二維碼或刷新應用

## 🎯 預期結果

執行遷移後，應該看到：

1. ✅ 所有原有選項卡正常顯示（巡房、換片、約束、轉身等）
2. ✅ 可以添加衛生記錄選項卡
3. ✅ 衛生記錄功能完整可用
4. ✅ 紅點補錄邏輯基於 last_activated_at 正常工作

## 🔧 修復內容總結

### 數據庫層面
- ✅ 添加 `patient_care_tabs.last_activated_at` 字段
- ✅ 更新 `patient_care_tabs.tab_type` CHECK 約束包含 'hygiene'
- ✅ 創建 `hygiene_records` 表（修復：添加了 status_notes 字段）
- ✅ 創建觸發器追蹤選項卡啟用時間
- ✅ 設置 RLS 政策和索引

### 代碼層面（已完成）
- ✅ Mobile app: CareRecordsScreen.tsx 集成衛生記錄
- ✅ Mobile app: database.ts 添加 HygieneRecord 接口和 CRUD
- ✅ Mobile app: i18n.ts 添加翻譯
- ✅ Web app: CareRecords.tsx 集成衛生記錄
- ✅ Web app: HygieneModal.tsx 創建表單組件
- ✅ Web app: database.tsx 添加 HygieneRecord 接口和 CRUD

## 📝 注意事項

1. **遷移順序很重要**：必須先執行 `20251221000000`，再執行 `20251221000001`
2. **執行前備份**：建議在執行遷移前備份數據庫
3. **RLS 政策**：遷移會自動設置 RLS，確保已認證用戶可以訪問
4. **現有數據**：遷移使用 `IF NOT EXISTS` 和 `DROP CONSTRAINT IF EXISTS`，可以安全重複執行

## 🚨 如果問題仍然存在

如果執行遷移後選項卡仍然消失，請檢查：

1. **瀏覽器/應用緩存**：清除緩存或強制刷新
2. **Supabase 連接**：確認應用正確連接到數據庫
3. **錯誤日誌**：查看 Expo 終端的錯誤信息
4. **數據驗證**：運行上面的驗證查詢確認遷移成功

---

**最後更新**：2024-12-21  
**修復文件**：
- `apps/mobile/supabase/migrations/20251221000000_extend_patient_care_tabs_tracking.sql`
- `apps/mobile/supabase/migrations/20251221000001_create_hygiene_records_table.sql` （已修復 status_notes 字段）
