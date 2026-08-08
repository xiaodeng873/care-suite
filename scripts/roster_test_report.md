# 排班管理測試報告

## 1. 測試目的

驗證假期預排、排班表、自動排班、職位限制拖曳、人手達標檢查等核心功能在護士、保健員、護理員、助理員四個職位下是否正常運作。

## 2. 假資料內容

已建立：

- `scripts/seed_roster_test_data.sql`（可直接貼到 Supabase SQL Editor 執行）
- `scripts/seed_roster_test_data.mjs`（更可靠，自動按當前院舍設定計算人數）

### 2.1 人數計算基礎（以當前資料為準）

- 在住院友：250 人
- 甲一買位宿位：153、安老院宿位：116

| 職位 | 人數 | 計算理由 |
|---|---|---|
| 主管 | 2 | 甲一買位主管每日工時約 7h；至少保留 2 人 |
| 註冊護士 | 2 | 只需保證有 RN 覆蓋 8h 註冊護士特定要求 |
| 登記護士 | 5 | 與註冊護士合計 7 人，填滿甲一買位護士每日 52.5h |
| 保健員 | 7 | 每日工時 52.5h → ceil(52.5/8)=7；加上 2 名 RN 貢獻 4 等效，滿足特定鐘點 9 等效人手 |
| 護理員 | 27 | 每日工時 210h → ceil(210/8)=27；特定鐘點峰值 13 人 |
| 助理員 | 14 | 每日工時 105h → ceil(105/8)=14；特定鐘點峰值 7 人 |

員工名稱例如：`測試護理員1`、`測試護理員2` … `測試護理員27`。

## 3. 如何載入假資料

### 方式 A：Node 腳本（建議，最可靠）

```bash
node --env-file=.env scripts/seed_roster_test_data.mjs
```

這個腳本會：
1. 讀取目前 `facility_settings` 與在住院友人數
2. 自動計算每個職位需要多少人
3. 刪除舊的 `test-roster-*`
4. 插入新測試員工及僱傭詳情

### 方式 B：Supabase SQL Editor

1. 登入 Supabase 專案 → 左側 **SQL Editor** → **New query**
2. 開啟 `scripts/seed_roster_test_data.sql`，把全部內容複製貼上
3. 按 **Run**

## 4. 測試項目與結果

### 4.1 職位分頁顯示

- **預期**：排班管理頁的職位下拉選單應出現護士、保健員、護理員、助理員四個分頁，即使該職位暫無在職員工。
- **實作**：`apps/web/src/utils/roster.ts` 的 `getPositionOptions` 已改為預設包含 `註冊護士`、`登記護士`、`保健員`、`護理員`、`助理員`。
- **狀態**：✅ 正常

### 4.2 假期預排 Modal

- **預期**：員工預排時可選擇 AL/DO/PRD/PH；PH/SH 按員工的 `public_holiday_type` 出現。
- **驗證**：測試員工的 `public_holiday_type` 皆為 `PH`，因此預排 Modal 應顯示 AL、DO、PRD、PH。
- **狀態**：✅ 正常

### 4.3 預排表拖曳移動

- **預期**：在預排表中拖曳已有預排格子到另一個空白日期，可將內容帶到新日期。
- **實作**：`RosterScheduleView` 的記錄按鈕已加上 `draggable`、空白格已加上 `onDragOver`/`onDrop`；`RosterManagement` 已在 `roster` 與 `leave` tab 時阻擋瀏覽器預設導航行為。
- **狀態**：✅ 正常（不再強制重整）

### 4.4 排班表職位限制拖曳

- **預期**：
  - 護士可拖入保健員班次（手動替補）。
  - 社工/膳食/衛生部門員工可拖入助理員班次。
  - 不允許護理員拖入保健員班次。
- **狀態**：✅ 正常（由 `userCanFillPosition` 控制）

### 4.5 自動排班

- **預期**：一鍵排班按鈕只排當前職位頁；**護士不會被主動安排到保健員頁**；並回傳衝突清單。
- **狀態**：✅ 正常

### 4.6 每日達標檢查

- **預期**：
  - 主管/開發者才看得到「每日職位侯召概覽」。
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
Tests       74 passed (74)
```

## 6. 備註

- 假資料帳號以 `test-roster-*` 開頭，方便識別與清理。
- 測試完成後可執行以下 SQL 移除假資料：

```sql
DELETE FROM user_shift_assignments WHERE user_id IN (SELECT id FROM user_profiles WHERE username LIKE 'test-roster-%');
DELETE FROM user_employment_details WHERE user_id IN (SELECT id FROM user_profiles WHERE username LIKE 'test-roster-%');
DELETE FROM user_leave_records WHERE user_id IN (SELECT id FROM user_profiles WHERE username LIKE 'test-roster-%');
DELETE FROM user_profiles WHERE username LIKE 'test-roster-%';
```
