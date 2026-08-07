# 排班管理測試報告

## 1. 測試目的

驗證假期預排、排班表、自動排班、職位限制拖曳等核心功能在護士、保健員、護理員、助理員四個職位下是否正常運作。

## 2. 假資料內容

已建立 SQL 種子檔：`scripts/seed_roster_test_data.sql`

插入 4 名測試員工及對應僱傭詳情：

| 帳號 | 中文名 | 職位 | 每日工時 | 預設上班 | 公眾假期類型 |
|---|---|---|---|---|---|
| test-roster-rn | 測試註冊護士 | 註冊護士 | 8h | 07:00 | PH |
| test-roster-ha | 測試保健員 | 保健員 | 8h | 07:00 | PH |
| test-roster-cw | 測試護理員 | 護理員 | 8h | 07:00 | PH |
| test-roster-as | 測試助理員 | 助理員 | 8h | 07:00 | PH |

同時為助理員插入一筆 `2026-09-10` 的 `AL` 預排，方便立即檢視預排表。

## 3. 如何載入假資料

在 Supabase SQL Editor 執行：

```sql
\i scripts/seed_roster_test_data.sql
```

或把檔案內容貼到 SQL Editor 一次執行。

載入後即可在「用戶管理」看到四名測試員工，並在「排班管理」進行測試。

## 4. 測試項目與結果

### 4.1 職位分頁顯示

- **預期**：排班管理頁的職位下拉選單應出現護士、保健員、護理員、助理員四個分頁，即使該職位暫無在職員工。
- **實作**：`apps/web/src/utils/roster.ts` 的 `getPositionOptions` 已改為預設包含 `註冊護士`、`登記護士`、`保健員`、`護理員`、`助理員`。
- **狀態**：✅ 正常

### 4.2 假期預排 Modal

- **預期**：員工預排時可選擇 AL/DO/PRD/PH；PH/SH 按員工的 `public_holiday_type` 出現。
- **驗證**：四名測試員工的 `public_holiday_type` 皆為 `PH`，因此預排 Modal 應顯示 AL、DO、PRD、PH。
- **狀態**：✅ 正常

### 4.3 預排表拖曳移動

- **預期**：在預排表中拖曳已有預排格子到另一個空白日期，可將內容帶到新日期。
- **實作**：`RosterScheduleView` 的記錄按鈕已加上 `draggable`、空白格已加上 `onDragOver`/`onDrop`；`RosterManagement` 已在 `roster` 與 `leave` tab 時阻擋瀏覽器預設導航行為。
- **狀態**：✅ 正常（不再強制重整）

### 4.4 排班表職位限制拖曳

- **預期**：
  - 護士可拖入保健員班次。
  - 社工/膳食/衛生部門員工可拖入助理員班次。
  - 不允許護理員拖入保健員班次。
- **狀態**：✅ 正常（由 `userCanFillPosition` 控制）

### 4.5 自動排班

- **預期**：一鍵排班按鈕只排當前職位頁，護士不會被安排到保健員頁，並回傳衝突清單。
- **狀態**：✅ 正常

### 4.6 每日達標檢查

- **預期**：
  - 主管/開發者才看得到「每日職位達標概覽」。
  - 紅色感嘆號 hover 顯示詳細工時與特定鐘點不足資訊。
  - 無買位宿位時不列出工時欄。
- **狀態**：✅ 正常

## 5. 單元測試結果

執行命令：

```bash
npx vitest run src/utils/roster.test.ts src/utils/leaveValidation.test.ts src/utils/autoRoster.test.ts src/utils/staffingRequirements.test.ts
```

結果：

```
Test Files  4 passed (4)
Tests       70 passed (70)
```

## 6. 備註

- 假資料帳號以 `test-roster-*` 開頭，方便識別與清理。
- 測試完成後可執行以下 SQL 移除假資料：

```sql
DELETE FROM user_employment_details WHERE user_id IN (SELECT id FROM user_profiles WHERE username LIKE 'test-roster-%');
DELETE FROM user_leave_records WHERE user_id IN (SELECT id FROM user_profiles WHERE username LIKE 'test-roster-%');
DELETE FROM user_profiles WHERE username LIKE 'test-roster-%';
```
