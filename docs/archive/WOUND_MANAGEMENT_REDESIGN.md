# 傷口管理系統重新設計

## 設計理念

根據業務需求重新設計傷口管理系統，實現以下邏輯：

1. **每個病人可以有多個傷口**
2. **每個傷口有獨立的發現日期**
3. **每個傷口自發現起最少每週評估一次，直到痊癒**
4. **每次評估都保存記錄**
5. **主表格顯示一院友對多傷口（子級層次結構）**
6. **評估內容保持不變**

---

## 數據庫結構設計

### 新表結構

#### 1. `wounds` - 傷口主表（新增）

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `id` | uuid | 主鍵 |
| `patient_id` | integer | 院友ID，外鍵關聯院友主表 |
| `wound_code` | text | 傷口編號（如 W001, W002）|
| `wound_name` | text | 傷口名稱/描述 |
| `discovery_date` | date | 發現日期 |
| `wound_location` | jsonb | 傷口位置（人形圖座標）|
| `wound_type` | text | 傷口類型（壓瘡、創傷、手術傷口等）|
| `wound_origin` | text | 傷口來源（本院發現、外來傷口）|
| `status` | text | 傷口狀態（active, healed, transferred）|
| `healed_date` | date | 痊癒日期（狀態為 healed 時填寫）|
| `next_assessment_due` | date | 下次評估到期日 |
| `remarks` | text | 備註 |
| `created_at` | timestamptz | 創建時間 |
| `updated_at` | timestamptz | 更新時間 |

#### 2. `wound_assessments` - 傷口評估記錄表（修改）

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `id` | uuid | 主鍵 |
| `wound_id` | uuid | 傷口ID，外鍵關聯 wounds 表 |
| `patient_id` | integer | 院友ID（冗餘，方便查詢）|
| `assessment_date` | date | 評估日期 |
| `assessor` | text | 評估者 |
| `area_length` | numeric | 長度 (cm) |
| `area_width` | numeric | 闊度 (cm) |
| `area_depth` | numeric | 深度 (cm) |
| `stage` | text | 階段 |
| `wound_status` | text | 本次評估時的傷口狀態 |
| `exudate_present` | boolean | 是否有滲出物 |
| `exudate_amount` | text | 滲出物量 |
| `exudate_color` | text | 滲出物顏色 |
| `exudate_type` | text | 滲出物種類 |
| `odor` | text | 氣味 |
| `granulation` | text | 肉芽 |
| `necrosis` | text | 壞死 |
| `infection` | text | 感染 |
| `temperature` | text | 體溫 |
| `surrounding_skin_condition` | text | 周邊皮膚狀況 |
| `surrounding_skin_color` | text | 周邊皮膚顏色 |
| `cleanser` | text | 洗劑 |
| `cleanser_other` | text | 其他洗劑 |
| `dressings` | jsonb | 敷料（可複選）|
| `dressing_other` | text | 其他敷料 |
| `wound_photos` | text[] | 傷口照片 |
| `remarks` | text | 備註 |
| `created_at` | timestamptz | 創建時間 |
| `updated_at` | timestamptz | 更新時間 |

---

## 實體關係圖 (ERD)

```
┌─────────────────┐
│    院友主表      │
│   (患者資料)     │
└────────┬────────┘
         │ 1
         │
         │ *
┌────────▼────────┐
│     wounds      │
│   (傷口主表)     │
│                 │
│ • wound_code    │
│ • discovery_date│
│ • wound_location│
│ • status        │
│ • healed_date   │
└────────┬────────┘
         │ 1
         │
         │ *
┌────────▼────────────┐
│  wound_assessments  │
│   (傷口評估記錄)     │
│                     │
│ • assessment_date   │
│ • stage             │
│ • wound_status      │
│ • measurements      │
│ • treatment details │
└─────────────────────┘
```

---

## 業務流程設計

### 流程 1：新增傷口

```
┌──────────────┐
│   發現傷口    │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ 創建傷口記錄 (wounds) │
│ • 填寫發現日期        │
│ • 標記傷口位置        │
│ • 選擇傷口類型        │
│ • 設定傷口來源        │
└──────────┬───────────┘
           │
           ▼
┌───────────────────────────┐
│ 創建首次評估記錄           │
│ (wound_assessments)       │
│ • 自動帶入傷口資訊         │
│ • 填寫評估詳細內容         │
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│ 系統自動計算下次評估日期   │
│ (發現日期 + 7 天)          │
└───────────────────────────┘
```

### 流程 2：定期評估

```
┌────────────────────────────┐
│ 系統提醒：傷口評估到期      │
│ (每週自動檢查)              │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ 選擇要評估的傷口            │
│ (從病人的傷口清單選擇)      │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ 填寫評估內容                │
│ • 尺寸測量                  │
│ • 狀態評估                  │
│ • 治療記錄                  │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ 更新傷口狀態                │
│ • 如狀態 = 痊癒：           │
│   - 設定 healed_date       │
│   - 清除下次評估到期日      │
│ • 如狀態 ≠ 痊癒：           │
│   - 計算下次評估日期 (+7天) │
└────────────────────────────┘
```

### 流程 3：傷口痊癒

```
┌────────────────────────────┐
│ 評估時選擇「已痊癒」狀態    │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ 系統自動處理：              │
│ • wounds.status = 'healed' │
│ • wounds.healed_date = 今天│
│ • 清除 next_assessment_due │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ 傷口進入歷史記錄            │
│ (不再產生評估提醒)          │
└────────────────────────────┘
```

---

## 介面設計

### 主表格設計（一院友對多傷口）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 傷口管理                                                     [+ 新增傷口]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔍 搜尋院友...          [篩選: ▼全部] [傷口狀態: ▼進行中]                   │
├──────┬────────────┬─────────┬──────────────────────────────────────────────┤
│ 床號 │ 院友姓名   │ 傷口數量 │ 傷口概覽                                     │
├──────┼────────────┼─────────┼──────────────────────────────────────────────┤
│ ▼ A1 │ 張三       │ 2       │ 🔴 W001 (進行中) 🟢 W002 (已痊癒)            │
│ ──────────────────────────────────────────────────────────────────────────│
│ │ 傷口 W001                                                               │
│ │ ┌───────────────────────────────────────────────────────────────────┐  │
│ │ │ 發現日期: 2025-12-01 │ 位置: 左腳踝 │ 類型: 壓瘡                   │  │
│ │ │ 狀態: 進行中         │ 下次評估: 2025-12-29 ⚠️ (逾期2天)           │  │
│ │ ├───────────────────────────────────────────────────────────────────┤  │
│ │ │ 評估記錄：                                                        │  │
│ │ │ • 2025-12-22 階段2 (2×3cm) - 由 護士A 評估 [查看]                 │  │
│ │ │ • 2025-12-15 階段2 (2.5×3.5cm) - 由 護士B 評估 [查看]             │  │
│ │ │ • 2025-12-08 階段3 (3×4cm) - 由 護士A 評估 [查看]                 │  │
│ │ │ • 2025-12-01 階段3 (3.5×4.5cm) 首次評估 [查看]                    │  │
│ │ └───────────────────────────────────────────────────────────────────┘  │
│ │                                                    [新增評估] [編輯傷口]│
│ │                                                                         │
│ │ 傷口 W002 (已痊癒)                                                      │
│ │ ┌───────────────────────────────────────────────────────────────────┐  │
│ │ │ 發現日期: 2025-11-01 │ 痊癒日期: 2025-12-10 │ 位置: 右手背        │  │
│ │ │ 評估次數: 6 次                                                    │  │
│ │ └───────────────────────────────────────────────────────────────────┘  │
│ ──────────────────────────────────────────────────────────────────────────│
│   B2 │ 李四       │ 1       │ 🟡 W001 (治療中)                             │
│   C3 │ 王五       │ 0       │ -                                            │
└──────┴────────────┴─────────┴──────────────────────────────────────────────┘
```

### 新增傷口 Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ 新增傷口                                              [X]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 院友選擇：  [選擇院友 ▼]                                        │
│                                                                 │
│ ──── 傷口基本資料 ────                                          │
│                                                                 │
│ 傷口編號：  [ W001 ] (自動生成)                                 │
│                                                                 │
│ 發現日期：  [ 2025-12-22 📅 ]                                   │
│                                                                 │
│ 傷口位置：  [人形圖選擇區域]                                    │
│             [前面 ○] [後面 ○]                                   │
│                                                                 │
│ 傷口類型：  [ 壓瘡 ▼ ]                                          │
│             壓瘡 / 創傷 / 手術傷口 / 糖尿病傷口 / 其他          │
│                                                                 │
│ 傷口來源：  [ 本院發現 ▼ ]                                      │
│             本院發生 / 入住前發生 / 醫院發生                    │
│                                                                 │
│ 備註：      [                                          ]        │
│                                                                 │
│ ──── 首次評估（選填）────                                       │
│                                                                 │
│ ☑️ 同時進行首次評估                                             │
│                                                                 │
│ [首次評估表單...]                                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [取消]  [儲存傷口]                 │
└─────────────────────────────────────────────────────────────────┘
```

### 新增評估 Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ 傷口評估 - W001                                       [X]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 院友：張三 (A1)                                                 │
│ 傷口：W001 - 左腳踝 (發現日期: 2025-12-01)                      │
│ 上次評估：2025-12-15 - 階段2                                    │
│                                                                 │
│ ──── 評估資料 ────                                              │
│                                                                 │
│ 評估日期：  [ 2025-12-22 📅 ]                                   │
│ 評估者：    [ 護士A ]                                           │
│                                                                 │
│ [傷口尺寸/狀態/治療等評估欄位...]                               │
│                                                                 │
│ ──── 傷口狀態更新 ────                                          │
│                                                                 │
│ 傷口狀態：  ○ 治療中  ○ 改善中  ● 已痊癒                        │
│                                                                 │
│ ⚠️ 選擇「已痊癒」後，此傷口將不再產生評估提醒                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [取消]  [儲存評估]                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 評估提醒邏輯

### 每週評估檢查

```javascript
// 取得需要評估的傷口
function getOverdueWounds() {
  return wounds.filter(wound => {
    // 排除已痊癒的傷口
    if (wound.status === 'healed') return false;
    
    // 檢查是否超過下次評估日期
    const today = new Date();
    const dueDate = new Date(wound.next_assessment_due);
    return dueDate <= today;
  });
}

// 取得即將到期的傷口（3天內）
function getUpcomingWounds() {
  return wounds.filter(wound => {
    if (wound.status === 'healed') return false;
    
    const today = new Date();
    const dueDate = new Date(wound.next_assessment_due);
    const daysUntilDue = (dueDate - today) / (1000 * 60 * 60 * 24);
    return daysUntilDue > 0 && daysUntilDue <= 3;
  });
}
```

### 下次評估日期計算

```javascript
// 在創建評估後自動計算下次評估日期
function calculateNextAssessmentDate(assessmentDate) {
  const next = new Date(assessmentDate);
  next.setDate(next.getDate() + 7);
  return next;
}

// 儲存評估時更新傷口的下次評估日期
async function saveAssessment(assessmentData, woundStatus) {
  // 儲存評估記錄
  await createWoundAssessment(assessmentData);
  
  // 更新傷口狀態
  if (woundStatus === 'healed') {
    await updateWound({
      id: assessmentData.wound_id,
      status: 'healed',
      healed_date: assessmentData.assessment_date,
      next_assessment_due: null
    });
  } else {
    await updateWound({
      id: assessmentData.wound_id,
      status: woundStatus,
      next_assessment_due: calculateNextAssessmentDate(assessmentData.assessment_date)
    });
  }
}
```

---

## 遷移計劃

### 階段 1：數據庫遷移

1. 創建 `wounds` 表
2. 修改 `wound_assessments` 表（添加 `wound_id` 欄位）
3. 遷移現有數據（將 `wound_details` 中的傷口提取到 `wounds` 表）

### 階段 2：後端 API 更新

1. 添加 `wounds` CRUD 操作
2. 修改 `wound_assessments` 以支持關聯查詢
3. 添加傷口狀態更新邏輯

### 階段 3：前端更新

1. 重構 `WoundManagement.tsx` 為層次結構顯示
2. 創建 `WoundModal.tsx` 用於管理傷口
3. 修改 `WoundAssessmentModal.tsx` 以關聯特定傷口
4. 添加評估提醒視覺提示

---

## TypeScript 類型定義

```typescript
// 傷口主表
export interface Wound {
  id: string;
  patient_id: number;
  wound_code: string;
  wound_name?: string;
  discovery_date: string;
  wound_location: {
    x: number;
    y: number;
    side: 'front' | 'back';
    description?: string;
  };
  wound_type: 'pressure_ulcer' | 'trauma' | 'surgical' | 'diabetic' | 'other';
  wound_origin: 'facility' | 'admission' | 'hospital_referral';
  status: 'active' | 'healed' | 'transferred';
  healed_date?: string;
  next_assessment_due?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

// 傷口評估記錄
export interface WoundAssessment {
  id: string;
  wound_id: string;
  patient_id: number;
  assessment_date: string;
  assessor?: string;
  area_length?: number;
  area_width?: number;
  area_depth?: number;
  stage?: string;
  wound_status: 'untreated' | 'treating' | 'improving' | 'healed';
  exudate_present: boolean;
  exudate_amount?: string;
  exudate_color?: string;
  exudate_type?: string;
  odor: string;
  granulation: string;
  necrosis: string;
  infection: string;
  temperature: string;
  surrounding_skin_condition?: string;
  surrounding_skin_color?: string;
  cleanser: string;
  cleanser_other?: string;
  dressings: string[];
  dressing_other?: string;
  wound_photos: string[];
  remarks?: string;
  created_at: string;
  updated_at: string;
}

// 傷口及其評估記錄的組合視圖
export interface WoundWithAssessments extends Wound {
  assessments: WoundAssessment[];
  latest_assessment?: WoundAssessment;
  assessment_count: number;
  is_overdue: boolean;
  days_until_due?: number;
}

// 病人及其傷口的組合視圖
export interface PatientWithWounds {
  patient: Patient;
  wounds: WoundWithAssessments[];
  active_wound_count: number;
  healed_wound_count: number;
  overdue_assessment_count: number;
}
```

---

## 待開發項目清單

### 數據庫

- [x] 創建 `wounds` 表遷移腳本 ✅ `supabase/migrations/20251222000000_wound_management_restructure.sql`
- [x] 修改 `wound_assessments` 表遷移腳本 ✅
- [x] 創建數據遷移腳本（從舊結構遷移）✅

### 後端/API

- [x] 添加 `wounds` CRUD 函數到 `database.tsx` ✅
- [x] 修改 `wound_assessments` 函數支持 `wound_id` ✅
- [x] 添加傷口狀態更新邏輯 ✅
- [x] 更新 `PatientContext.tsx` 添加傷口管理函數 ✅

### 前端

- [x] 創建 `WoundModal.tsx` - 新增/編輯傷口 ✅
- [x] 創建 `WoundManagementNew.tsx` - 層次結構顯示 ✅
- [x] 創建 `SingleWoundAssessmentModal.tsx` - 單傷口評估 ✅
- [ ] 添加評估提醒視覺組件（在 WoundManagementNew 中已實現基本功能）
- [ ] 添加傷口歷史時間軸視圖（可選功能）

### 測試

- [ ] 單元測試：日期計算邏輯
- [ ] 整合測試：傷口創建到痊癒完整流程
- [ ] UI 測試：表格展開收合功能

---

## 訪問新功能

新的傷口管理頁面可通過以下路徑訪問：

- **舊版傷口管理**：`/wound`
- **新版傷口管理**：`/wound-new`

建議在確認新版本穩定後，將 `/wound` 路由替換為新版本。
