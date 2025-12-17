# 批量OCR空值安全修復

## 修復日期
2025-12-14

## 問題描述

### 錯誤 1: AI 回應被截斷
**症狀：**
```
JSON Parse Error: Unexpected end of JSON input
```

**原因：**
- `maxOutputTokens` 設置為 2048 太小
- 大量記錄導致 JSON 輸出超過限制
- 輸出包含大量不必要的 `null` 值

### 錯誤 2: 空值引用錯誤
**症狀：**
```
TypeError: Cannot read properties of null (reading 'trim')
at parseTimeMarker (BatchHealthRecordOCRModal.tsx:181:26)
```

**原因：**
- AI 可能返回 `記錄時間: null` 或完全省略該欄位
- `parseTimeMarker` 函數直接調用 `timeStr.trim()` 而沒有空值檢查
- 其他函數也缺少空值保護

## 解決方案

### 1. 增加 Token 限制

**Gemini Edge Function (`supabase/functions/gemini-extract/index.ts`):**

```typescript
generationConfig: {
  temperature: 0.1,
  topK: 1,
  topP: 1,
  maxOutputTokens: 8192,  // 從 2048 增加到 8192
}
```

**分類功能的 Token 限制:**
```typescript
maxOutputTokens: 1024,  // 從 512 增加到 1024
```

### 2. 優化 Prompt 減少輸出

**BatchHealthRecordOCRModal.tsx - DEFAULT_PROMPT:**

```typescript
**重要：如果數值缺失或無法辨識，請直接省略該欄位，不要輸出 null 或空字串。**

**提取規則：**
4. **只輸出有值的欄位，跳過空白或無法辨識的數據**

**注意：只包含已填寫的數據欄位，空白欄位不要輸出。所有數值都是數字類型，時間都轉換為標準格式。**
```

**效果：**
- 減少不必要的 `null` 值輸出
- 大幅降低 Token 消耗
- JSON 更緊湊，更容易在限制內完成

### 3. 增加截斷檢測

**gemini-extract/index.ts:**

```typescript
const candidate = geminiData.candidates[0];
const finishReason = candidate.finishReason;

if (finishReason === 'MAX_TOKENS' || finishReason === 'SAFETY') {
  console.error("Response truncated, finish reason:", finishReason);
  return new Response(
    JSON.stringify({
      success: false,
      error: "資料量過大導致AI回應被截斷，請嘗試：1) 分批上傳圖片（建議每次2-3張）2) 優化圖片（裁剪不必要的部分）3) 調整Prompt以減少輸出內容"
    }),
    { status: 413, headers: corsHeaders }
  );
}
```

### 4. 添加空值安全保護

#### `parseTimeMarker` 函數

```typescript
const parseTimeMarker = (timeStr: string | null | undefined): string => {
  // 空值保護：如果沒有時間，返回空字串
  if (!timeStr) return '';

  const time = timeStr.trim().toLowerCase();

  // 如果trim後是空字串，直接返回
  if (!time) return '';

  // ... 其他邏輯
};
```

#### `matchPatient` 函數

```typescript
const matchPatient = (床號: string | null | undefined, 院友姓名: string | null | undefined): any => {
  // 空值保護：如果兩者都沒有，無法匹配
  if (!床號 && !院友姓名) return null;

  return patients.find(p =>
    (床號 && p.床號 === 床號) ||
    (院友姓名 && p.中文姓名 === 院友姓名) ||
    (p.中文姓名 && 院友姓名 && p.中文姓名.includes(院友姓名))
  );
};
```

#### `matchTask` 函數

```typescript
const matchTask = (patientId: number, recordType: string | null | undefined, recordDate: string, recordTime: string): any => {
  // 空值保護：如果沒有記錄類型或時間，無法匹配
  if (!recordType || !recordTime) return null;

  // ... 其他邏輯
};
```

### 5. 增強調試信息

**添加詳細的控制台日誌：**

```typescript
// 檢查空記錄
if (records.length === 0) {
  console.warn('[BatchOCR] AI未識別到任何記錄');
  // ... 錯誤處理
}

// 記錄處理進度
console.log(`[BatchOCR] 正在解析 ${records.length} 條記錄`);

// 記錄每條記錄的詳細信息
const parsedRecords = records.map((record: any, index: number) => {
  console.log(`[BatchOCR] 處理第 ${index + 1} 條記錄:`, {
    床號: record.床號,
    姓名: record.院友姓名,
    時間: record.記錄時間,
    類型: record.記錄類型
  });

  // 檢測並警告缺失的數據
  if (!recordTime) {
    console.warn(`[BatchOCR] 第 ${index + 1} 條記錄缺少時間`);
  }
  if (!matchedPatient) {
    console.warn(`[BatchOCR] 第 ${index + 1} 條記錄無法匹配院友: 床號=${record.床號}, 姓名=${record.院友姓名}`);
  }

  // ... 其他邏輯
});
```

## 測試建議

### 1. 正常情況測試
- ✅ 上傳包含完整數據的圖片
- ✅ 檢查所有記錄是否正確識別
- ✅ 驗證院友匹配是否準確

### 2. 邊界情況測試
- ✅ 上傳包含大量記錄的圖片（測試 Token 限制）
- ✅ 上傳包含空白欄位的圖片（測試空值處理）
- ✅ 上傳缺少時間標記的圖片（測試空值保護）
- ✅ 上傳無法識別的圖片（測試錯誤處理）

### 3. 性能測試
- ✅ 同時上傳多張圖片（2-3張）
- ✅ 檢查處理時間和成功率
- ✅ 監控控制台日誌是否正常

## 調試步驟

當遇到問題時，按以下步驟調試：

### 1. 打開瀏覽器控制台（F12）
查看 `[BatchOCR]` 標記的日誌信息。

### 2. 檢查錯誤類型

**如果看到 "資料量過大導致AI回應被截斷"：**
- 減少每次上傳的圖片數量（建議 2-3 張）
- 裁剪圖片，只保留需要識別的區域
- 檢查圖片中記錄數量是否過多

**如果看到 "Cannot read properties of null"：**
- 檢查 AI 返回的數據結構
- 查看控制台日誌，找出哪個欄位是 null
- 確認 Prompt 是否正確

**如果看到 "AI未識別到任何記錄"：**
- 檢查圖片是否清晰
- 檢查圖片方向是否正確
- 檢查圖片是否包含表格數據
- 嘗試調整 Prompt

### 3. 查看詳細日誌

控制台會顯示每條記錄的處理信息：
```
[BatchOCR] 正在解析 15 條記錄
[BatchOCR] 處理第 1 條記錄: { 床號: "237-1", 姓名: "黃逸雯", 時間: "16:00", 類型: "生命表徵" }
[BatchOCR] 處理第 2 條記錄: ...
```

如果看到警告：
```
[BatchOCR] 第 5 條記錄缺少時間
[BatchOCR] 第 8 條記錄無法匹配院友: 床號=237-1, 姓名=張三
```

這些信息可以幫助你定位具體問題。

### 4. 檢查 Edge Function 日誌

前往 Supabase Dashboard → Edge Functions → gemini-extract → Logs

查看：
- API 調用是否成功
- finishReason 是什麼
- 是否有其他錯誤

## 最佳實踐

### 圖片準備
1. **清晰度**：確保文字清楚可辨
2. **完整性**：包含表格標題（日期）
3. **方向**：圖片方向正確
4. **尺寸**：裁剪不必要的邊緣

### 分批處理
1. **推薦數量**：每次 2-3 張圖片
2. **避免**：一次處理超過 5 張
3. **原因**：防止 Token 超限

### Prompt 優化
1. **明確指示**：告訴 AI 省略空值
2. **格式清楚**：提供明確的 JSON 範例
3. **簡潔明瞭**：不要包含冗長的說明

## 相關文件

- `supabase/functions/gemini-extract/index.ts` - Edge Function
- `src/components/BatchHealthRecordOCRModal.tsx` - 批量OCR Modal
- `BATCH_OCR_TROUBLESHOOTING.md` - 故障排除指南
- `OCR_FEATURE_README.md` - OCR功能說明

## 修復狀態

- ✅ Token 限制增加（2048 → 8192）
- ✅ Prompt 優化以減少輸出
- ✅ 截斷檢測機制
- ✅ 空值安全保護
- ✅ 增強調試信息
- ✅ 構建測試通過

## 後續優化建議

1. **進一步優化 Prompt**：可以考慮使用更簡短的英文欄位名
2. **分段識別**：如果圖片太大，可以考慮自動分段處理
3. **智能重試**：當檢測到截斷時，自動提示用戶分批處理
4. **圖片預處理**：自動裁剪和優化圖片尺寸
