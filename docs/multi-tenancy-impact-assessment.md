# 多租戶（Multi-Tenant）改造影響評估

> 2026-09-04 盤點。目的：將單院舍系統改造為多院舍（facility_id 隔離），支援試用帳戶及日後 SaaS 多客戶。
> 本文檔為第一步產出（影響清單 + 設計決策 + 分階段計劃），實作前需先拍板「待決策」章節。

## 1. 規模事實

| 項目 | 數量 |
|---|---|
| 存活資料表 | 約 59 張（另有 ~6 張已廢棄） |
| database.tsx 會直連 DB 的 exported 函式 | 269 個（Supabase 呼叫點 328 處） |
| 全表掃描型 getter（無任何過濾） | 約 40+ 個 |
| 前端全量載入的 context | 約 20 個 |
| 直連 supabase 的頁面 | RosterManagement、StationBedManagement、Settings、Reports、TemplateManagement、Dashboard |
| 繞過前端的 service-role edge function | ai-assistant、auth-custom、generate-daily-medication-workflow |
| RPC（DB 函式） | `fn_end_temporary_transfer`、`fn_end_temporary_swap_pair`、`get_overdue_workflow_counts`、`exec_sql_readonly`、`get_user_permissions` 等 |

## 2. 結構性缺口（最大風險）

**目前資料層沒有任何服務端身份。** 前端用 anon key 直連 PostgREST，RLS 幾乎全是
`FOR ALL TO anon, authenticated USING (true)`（59 張表中有「Allow all access」），
custom token 只留在 localStorage，從未帶進資料請求。
「權限於 UI 層控管」= 隔離也只能留在 UI 層，這對多租戶不可接受。

### 特高危出口

1. **ai-assistant `exec_sql_readonly`**：service role + LLM 生成的任意 SQL + 零 tenant 過濾。
   多租戶後任何有權限用戶可用自然語言 SELECT 到所有院舍資料。**必須加 tenant guard。**
2. **get_overdue_workflow_counts 等統計 RPC**：全院統計。
3. **床位調動 RPC**（`fn_end_temporary_transfer`、`fn_end_temporary_swap_pair`）：內部直寫院友主表/beds。
4. **RosterManagement 等頁面直連 supabase**：繞過 database.tsx，改造時易遺漏。

## 3. 設計方案（推薦：claim-based JWT + RLS 隔離）

### 3.1 身份通道（關鍵決策）

**做法**：auth-custom edge function 登入/validate 時，用專案 JWT secret 簽發一支自訂 JWT：

```json
{ "role": "authenticated", "user_id": "...", "facility_id": 1, "exp": ... }
```

前端 supabase client 改以此 token 作為 bearer（取代純 anon key）。
RLS policy 改為：

```sql
facility_id = (auth.jwt() ->> 'facility_id')::int
```

**好處**：
- 隔離下沉到資料庫層，269 個 db 函式**幾乎不用改**（全表 getter 自動只回自己院舍）
- 前端 20 個全量載入 context 在隔離意義上自動安全（效能問題另行處理）
- ai-assistant 可用同一 token 於 SQL 執行前注入 facility 過濾

**替代方案（不推）**：所有資料走 edge function 代理 → 等同重寫全部 328 個呼叫點。

### 3.2 資料模型

- 新表 `facilities`（id、名稱、啟用狀態、建立日期）
- `user_profiles` 加 `facility_id`（員工歸屬；developer 角色跨院舍）
- `院友主表` 加 `facility_id`（tenant 邊界根）
- 院友級資料表：全部加 `facility_id`（冗余存放，backfill 經由 patient join），
  涵蓋約 40 張（健康監測記錄、約束、晚晴、傷口、事故、藥物、ICP、出入量……）
- 院舍級資源表：`stations`/`rooms`/`beds`/`station_shift_settings`/`user_shift_assignments`/
  `到診排程主表`/`覆診安排主表`/`facility_settings`（拆單例）/`public_holidays`/
  `user_*`（員工假期排班）/`incident_preset_options`/`templates_metadata` 等加 `facility_id`
- Backfill：現有資料全部歸入 facility 1（現有院舍）

### 3.3 Edge function / RPC 配套

- `exec_sql_readonly`：解析後強制注入 `AND facility_id = <claim>`（或拒絕無 facility 條件的查詢）
- `ai-assistant` 手寫 SQL 比對段、mutations 寫入，全部帶 facility
- `generate-daily-medication-workflow`：只處理本 facility 處方
- 床位 RPC：加 facility 校驗
- `get_overdue_workflow_counts`：加 facility 參數

## 4. 決策（2026-09-04 院主拍板）

- **D1 開通方式**：做開通頁面（系統內管理員介面建立 facility + 管理員帳戶）
- **D2 共用資料**：全部共用（facility_id NULL = 全院舍共用：藥物資料庫、problem_library、
  nursing_need_items、incident_preset_options、templates_metadata + storage bucket `templates`）
- **D3 developer 帳戶**：跨全部院舍（RLS 對 developer 角色放行）
- **D4 RLS 處置**：直接改 claim-based，一刀切（不設過渡雙軌）
- **D5 全量載入**：本階段維持不改（隔離後各院舍只拉自己資料，量可接受）；效能優化另開階段

## 5. 分階段計劃

| 階段 | 內容 | 預估 |
|---|---|---|
| P1 Schema | facilities 表、facility_id 欄位（全部表）、backfill、facility_settings 拆單例 | **✅ 已完成 2026-09-04**（migration `20260904100000`：facilities + 68 表加欄位回填、46 張院友級表 INSERT trigger 自動填 facility_id，live 驗證通過） |
| P2 身份 | auth-custom 簽發 claim JWT、前端 bearer 切換、RLS 全面改寫為 claim-based | 核心工作，風險最高，需完整回歸測試 |
| P3 Edge/RPC | exec_sql_readonly tenant guard、ai-assistant、workflow 生成、床位 RPC、統計 RPC | 與 P2 並行 |
| P4 驗證 | 跨院舍洩漏測試（逐頁逐功能，以 facility 2 空帳戶實測）、效能檢查 | 不可省略 |
| P5 試用開通 | 建立 facility 2 + 空白試用管理員帳戶 | 收工 |

## 6. 風險清單

1. **RLS 改寫遺漏任何一張表 = 跨院舍洩漏** → P4 必須用第二院舍帳戶逐功能點驗證
2. **ai-assistant exec_sql_readonly 的 SQL 注入式 tenant guard** 需防繞過（CTE、子查詢、UNION）
3. **遷移期間線上環境**：migration 全部可加 IF NOT EXISTS 且與現行行為相容（facility_id 先加後啟用）
4. **雙軌中文表名**（院友主表/健康監測記錄/到診排程主表）語法差異，改 RLS 時注意
5. **3 張表無 migration CREATE**（patient_health_tasks、health_assessments、new_medication_prescriptions）——改它們前先用 `supabase db dump` 或 dashboard 核對實際結構
