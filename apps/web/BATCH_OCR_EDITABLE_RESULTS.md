# 批量OCR可編輯結果功能

## 更新日期
2025-12-14

## 功能概述

批量OCR識別結果現在完全可編輯，支持手動修正AI識別錯誤，並提供智能自動填充功能，大幅提升數據錄入效率和準確性。

## 核心功能

### 1. 完全可編輯的結果表格

所有識別結果欄位都可以直接在表格中編輯，無需打開單獨的編輯對話框。

**可編輯欄位：**
- ✅ 床號
- ✅ 院友姓名
- ✅ 記錄日期
- ✅ 記錄時間
- ✅ 記錄類型（下拉選擇）
- ✅ 血壓收縮壓
- ✅ 血壓舒張壓
- ✅ 脈搏
- ✅ 體溫
- ✅ 血含氧量
- ✅ 呼吸頻率
- ✅ 血糖值
- ✅ 體重
- ✅ 備註

### 2. 智能自動填充

**輸入床號 → 自動填充院友資料**
```typescript
// 當用戶輸入或修改床號時
if (field === '床號' && value) {
  const matchedPatient = patients.find(p => p.床號 === value);
  if (matchedPatient) {
    // 自動填充：
    - 院友ID
    - 院友姓名
    - 區域（從床號提取）
    - 院友完整資料
  }
}
```

**範例：**
- 輸入床號 "237-1"
- 自動填充姓名 "黃逸雯"
- 自動設定區域 "237"
- 狀態變為 "已匹配" ✓

**輸入姓名 → 自動填充床號**
```typescript
// 當用戶輸入或修改姓名時
if (field === '院友姓名' && value) {
  const matchedPatient = patients.find(p =>
    p.中文姓名 === value ||
    p.中文姓名.includes(value)  // 支持模糊匹配
  );
  if (matchedPatient) {
    // 自動填充：
    - 院友ID
    - 床號
    - 區域
    - 院友完整資料
  }
}
```

**範例：**
- 輸入姓名 "黃逸雯"
- 自動填充床號 "237-1"
- 自動設定區域 "237"
- 狀態變為 "已匹配" ✓

### 3. 時間預設值

當AI無法識別時間時，自動使用預設值 `08:00`。

```typescript
const parseTimeMarker = (timeStr: string | null | undefined): string => {
  // 空值保護：如果沒有時間，返回預設值 08:00
  if (!timeStr) return '08:00';

  const time = timeStr.trim().toLowerCase();

  // 如果trim後是空字串，返回預設值
  if (!time) return '08:00';

  // 時間標記解析
  if (time.match(/^7[ap]?$/i)) return '07:00';
  if (time.match(/^12[np]?$/i)) return '12:00';
  if (time.match(/^4p?$/i)) return '16:00';

  // 其他格式解析...
}
```

**效果：**
- AI未識別時間 → 預設 08:00
- 用戶可手動修改為正確時間
- 避免因缺少時間導致錯誤

### 4. 即時狀態反饋

每條記錄都顯示匹配狀態：

**已匹配（綠色）**
- ✓ 圖標 + "匹配" 文字
- 表示已成功匹配到院友
- 可以正常儲存

**未匹配（紅色）**
- ⚠️ 圖標 + "未匹配" 文字
- 表示無法找到對應院友
- 需要手動修正床號或姓名

### 5. 記錄管理

**刪除記錄**
- 點擊刪除按鈕（垃圾桶圖標）
- 確認對話框防止誤刪
- 從列表中移除記錄

**批量儲存檢查**
- 自動檢測未匹配記錄
- 提示用戶確認是否跳過
- 只儲存已匹配的記錄

## 使用流程

### 標準流程

1. **上傳圖片**
   - 選擇健康記錄表照片
   - 支持多張上傳

2. **開始識別**
   - 點擊「開始批量識別」
   - AI自動提取所有數據

3. **檢查和修正**
   - 查看識別結果
   - 修正錯誤或不完整的欄位
   - 利用自動填充功能快速補全

4. **確認匹配狀態**
   - 檢查每條記錄的狀態
   - 確保所有重要記錄都已匹配

5. **批量儲存**
   - 點擊「批量儲存」
   - 系統自動儲存所有已匹配記錄

### 快速修正流程

**情況1：AI識別床號錯誤**
1. 直接在床號欄位修改
2. 按Enter或點擊其他欄位
3. 系統自動填充正確的院友姓名
4. 狀態變為「已匹配」✓

**情況2：AI識別姓名錯誤**
1. 直接在姓名欄位修改
2. 按Enter或點擊其他欄位
3. 系統自動填充正確的床號
4. 狀態變為「已匹配」✓

**情況3：時間缺失**
1. 查看時間欄位顯示 "08:00"（預設值）
2. 如果正確，無需修改
3. 如果錯誤，直接修改為正確時間

**情況4：數值錯誤**
1. 直接在對應欄位修改
2. 支持小數輸入（體溫、血糖、體重）
3. 修改即時生效

## 表格欄位說明

| 欄位 | 類型 | 說明 | 單位/格式 |
|------|------|------|-----------|
| 床號 | 文字 | 自動填充姓名 | - |
| 姓名 | 文字 | 自動填充床號 | - |
| 日期 | 日期 | 記錄日期 | YYYY-MM-DD |
| 時間 | 時間 | 記錄時間，預設08:00 | HH:MM |
| 類型 | 下拉 | 記錄類型 | 生命表徵/血糖/體重 |
| 收縮壓 | 數字 | 血壓收縮壓 | mmHg |
| 舒張壓 | 數字 | 血壓舒張壓 | mmHg |
| 脈搏 | 數字 | 心跳 | bpm |
| 體溫 | 小數 | 體溫 | °C |
| 血氧 | 數字 | 血氧飽和度 | % |
| 呼吸 | 數字 | 呼吸頻率 | /min |
| 血糖 | 小數 | 血糖值 | mmol/L |
| 體重 | 小數 | 體重 | kg |
| 備註 | 文字 | 補充說明 | - |
| 狀態 | 顯示 | 匹配狀態 | 已匹配/未匹配 |

## 技術實現

### 更新記錄函數

```typescript
const updateRecord = (tempId: string, field: keyof ParsedHealthRecord, value: any) => {
  setAllParsedRecords(prev => prev.map(record => {
    if (record.tempId !== tempId) return record;

    const updated = { ...record, [field]: value };

    // 床號自動填充
    if (field === '床號' && value) {
      const matchedPatient = patients.find(p => p.床號 === value);
      if (matchedPatient) {
        updated.院友id = matchedPatient.院友id;
        updated.院友姓名 = matchedPatient.中文姓名;
        updated.matchedPatient = matchedPatient;
        updated.區域 = value.match(/^[A-Z]+/)?.[0] || '未知';
        console.log(`[BatchOCR] 床號 ${value} 自動匹配院友: ${matchedPatient.中文姓名}`);
      }
    }

    // 姓名自動填充
    if (field === '院友姓名' && value) {
      const matchedPatient = patients.find(p =>
        p.中文姓名 === value ||
        (p.中文姓名 && p.中文姓名.includes(value))
      );
      if (matchedPatient) {
        updated.院友id = matchedPatient.院友id;
        updated.床號 = matchedPatient.床號;
        updated.matchedPatient = matchedPatient;
        updated.區域 = matchedPatient.床號?.match(/^[A-Z]+/)?.[0] || '未知';
        console.log(`[BatchOCR] 院友 ${value} 自動匹配床號: ${matchedPatient.床號}`);
      }
    }

    return updated;
  }));
};
```

### 刪除記錄函數

```typescript
const deleteRecord = (tempId: string) => {
  if (confirm('確定要刪除這條記錄嗎？')) {
    setAllParsedRecords(prev => prev.filter(record => record.tempId !== tempId));
  }
};
```

### 可編輯輸入欄位範例

```tsx
{/* 床號 - 可編輯，自動填充院友 */}
<input
  type="text"
  value={record.床號 || ''}
  onChange={(e) => updateRecord(record.tempId, '床號', e.target.value)}
  className="w-20 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500"
  placeholder="床號"
/>

{/* 體溫 - 支持小數 */}
<input
  type="number"
  step="0.1"
  value={record.體溫 || ''}
  onChange={(e) => updateRecord(record.tempId, '體溫', e.target.value ? Number(e.target.value) : null)}
  className="w-16 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500"
  placeholder="°C"
/>

{/* 記錄類型 - 下拉選擇 */}
<select
  value={record.記錄類型}
  onChange={(e) => updateRecord(record.tempId, '記錄類型', e.target.value)}
  className="w-24 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500"
>
  <option value="生命表徵">生命表徵</option>
  <option value="血糖控制">血糖控制</option>
  <option value="體重控制">體重控制</option>
</select>
```

## 使用建議

### 提高識別準確度

1. **圖片準備**
   - 確保文字清晰可辨
   - 避免反光和陰影
   - 保持表格完整

2. **分批處理**
   - 建議每次2-3張圖片
   - 避免一次處理過多

3. **Prompt優化**
   - 根據表格格式調整Prompt
   - 明確指定欄位名稱

### 提高錄入效率

1. **利用自動填充**
   - 優先輸入床號（通常更準確）
   - 讓系統自動填充姓名

2. **批量檢查**
   - 先查看「未匹配」的記錄
   - 集中處理需要修正的項目

3. **快捷鍵使用**
   - Tab鍵快速切換欄位
   - Enter鍵確認輸入

4. **分區處理**
   - 結果按區域分組顯示
   - 可逐區檢查和修正

## 常見問題

### Q1: 為什麼時間顯示08:00？
**A:** 這是預設值，當AI無法識別時間時會使用。如果實際時間不是08:00，請手動修改。

### Q2: 輸入床號後沒有自動填充姓名？
**A:** 可能的原因：
- 床號輸入錯誤
- 系統中沒有該床號的院友
- 床號格式不匹配

解決方法：檢查床號是否正確，或直接輸入姓名。

### Q3: 可以只修改部分欄位嗎？
**A:** 可以！所有欄位都是獨立的，你可以只修改需要修正的欄位，其他欄位保持不變。

### Q4: 修改後如何確認已保存？
**A:** 修改會立即反映在表格中，但需要點擊「批量儲存」按鈕才會真正保存到資料庫。

### Q5: 刪除記錄可以恢復嗎？
**A:** 在批量儲存前刪除的記錄無法恢復，刪除前會有確認對話框。但未儲存到資料庫前，可以重新識別圖片。

### Q6: 為什麼有些記錄顯示「未匹配」？
**A:** 可能的原因：
- AI識別的床號或姓名不正確
- 該院友不在系統中
- 姓名拼寫與系統記錄不符

解決方法：手動修正床號或姓名，系統會自動重新匹配。

## 優勢總結

✅ **提高效率**
- 所有欄位可直接編輯
- 智能自動填充減少輸入
- 批量處理大量記錄

✅ **提高準確性**
- 即時查看和修正錯誤
- 狀態反饋清晰明確
- 預設值防止遺漏

✅ **使用便捷**
- 無需切換多個對話框
- 表格式顯示一目了然
- 分區顯示易於管理

✅ **智能化**
- 自動匹配院友資料
- 自動計算區域
- 自動檢測未匹配記錄

## 相關文件

- `src/components/BatchHealthRecordOCRModal.tsx` - 批量OCR Modal
- `BATCH_OCR_NULL_SAFETY_FIX.md` - 空值安全修復
- `BATCH_OCR_TROUBLESHOOTING.md` - 故障排除指南
- `OCR_FEATURE_README.md` - OCR功能說明

## 未來改進方向

1. **鍵盤導航增強**
   - 支持方向鍵移動
   - 支持快捷鍵操作

2. **批量編輯**
   - 選擇多條記錄
   - 批量設定相同欄位

3. **歷史記錄**
   - 撤銷/重做功能
   - 修改歷史追蹤

4. **驗證規則**
   - 數值範圍檢查
   - 必填欄位提示

5. **匯出功能**
   - 匯出識別結果
   - 匯出錯誤報告
