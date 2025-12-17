# Supabase 手動設定說明

由於您遇到 "new row violates row-level security policy" 錯誤，需要在 Supabase Dashboard 中手動設定 Row Level Security (RLS) 策略。

## 第一步：設定 Storage Bucket 策略

1. **登入 Supabase Dashboard**
   - 前往 https://supabase.com/dashboard
   - 選擇您的專案

2. **前往 Storage 設定**
   - 點擊左側選單的 "Storage"
   - 找到並點擊 "templates" bucket

3. **設定 Storage 策略**
   - 點擊 "Policies" 標籤
   - 點擊 "New Policy"
   - 選擇 "For full customization"

4. **新增上傳策略**
   ```
   Policy name: Allow authenticated users to upload templates
   Allowed operation: INSERT
   Target roles: authenticated
   USING expression: 留空
   WITH CHECK expression: bucket_id = 'templates'
   ```
   點擊 "Review" 然後 "Save policy"

5. **新增讀取策略**
   ```
   Policy name: Allow authenticated users to read templates
   Allowed operation: SELECT
   Target roles: authenticated
   USING expression: bucket_id = 'templates'
   WITH CHECK expression: 留空
   ```
   點擊 "Review" 然後 "Save policy"

6. **新增刪除策略**
   ```
   Policy name: Allow authenticated users to delete templates
   Allowed operation: DELETE
   Target roles: authenticated
   USING expression: bucket_id = 'templates'
   WITH CHECK expression: 留空
   ```
   點擊 "Review" 然後 "Save policy"

## 第二步：設定 Database Table 策略

1. **前往 Database 設定**
   - 點擊左側選單的 "Database"
   - 點擊 "Tables"

2. **找到 templates_metadata 表格**
   - 在表格列表中找到 "templates_metadata"
   - 點擊該表格

3. **確認 RLS 已啟用**
   - 在表格詳情頁面，確認 "Row Level Security" 是 "Enabled"
   - 如果沒有啟用，點擊 "Enable RLS"

4. **新增 INSERT 策略**
   - 點擊 "Policies" 標籤
   - 點擊 "New Policy"
   - 選擇 "For full customization"
   ```
   Policy name: Allow authenticated users to insert template metadata
   Allowed operation: INSERT
   Target roles: authenticated
   USING expression: 留空
   WITH CHECK expression: true
   ```
   點擊 "Review" 然後 "Save policy"

5. **新增 SELECT 策略**
   ```
   Policy name: Allow authenticated users to read template metadata
   Allowed operation: SELECT
   Target roles: authenticated
   USING expression: true
   WITH CHECK expression: 留空
   ```
   點擊 "Review" 然後 "Save policy"

6. **新增 UPDATE 策略**
   ```
   Policy name: Allow authenticated users to update template metadata
   Allowed operation: UPDATE
   Target roles: authenticated
   USING expression: true
   WITH CHECK expression: true
   ```
   點擊 "Review" 然後 "Save policy"

7. **新增 DELETE 策略**
   ```
   Policy name: Allow authenticated users to delete template metadata
   Allowed operation: DELETE
   Target roles: authenticated
   USING expression: true
   WITH CHECK expression: 留空
   ```
   點擊 "Review" 然後 "Save policy"

## 第三步：驗證設定

完成上述設定後：

1. 回到您的應用程式
2. 嘗試上傳一個範本檔案
3. 如果仍有錯誤，請檢查：
   - 您是否已登入應用程式
   - 所有策略是否正確建立
   - RLS 是否在相關表格和 bucket 上啟用

## 常見問題

**Q: 如果我找不到 templates_metadata 表格怎麼辦？**
A: 您需要先執行建立表格的 SQL。前往 "SQL Editor"，執行以下 SQL：

```sql
CREATE TABLE IF NOT EXISTS templates_metadata (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type template_type NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT UNIQUE NOT NULL,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  file_size INTEGER NOT NULL,
  description TEXT,
  extracted_format JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE templates_metadata ENABLE ROW LEVEL SECURITY;
```

**Q: 如果我找不到 templates bucket 怎麼辦？**
A: 前往 Storage，點擊 "New bucket"，建立名為 "templates" 的 public bucket。

完成這些設定後，範本上傳功能應該就能正常工作了！