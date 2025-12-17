# iPad 橫向模式 Dashboard 卡片縮放修復

## 修復日期
2025-11-29

## 問題描述
在 iPad 橫向模式下，Dashboard 頁面的兩組卡片顯示不一致：
- 第一組：「便條、欠缺必要項目、執核派藥逾期提醒、待變更處方提醒」沒有應用縮放樣式
- 第二組：「監測任務、待辦事項、近期覆診」已正確應用縮放樣式

這導致第一組卡片在 iPad 橫向模式下顯示過大，與第二組卡片的視覺比例不一致。

## 解決方案
在 `src/index.css` 的 iPad 橫向模式媒體查詢區塊（`@media (min-width: 1024px) and (max-width: 1280px)`）中，新增了針對第一組卡片的完整縮放 CSS 規則。

## 修改文件
- `src/index.css`

## 新增的 CSS 規則

### 通用卡片樣式
- 卡片內邊距從 `p-6` (1.5rem) 縮小至 `0.75rem`
- 標題圖標從 `h-6 w-6` (1.5rem) 縮小至 `1rem`
- 主標題從 `text-lg` 縮小至 `0.875rem`
- 副標題從 `text-sm` 縮小至 `0.65rem`

### 列表項目樣式
- 項目內邊距從 `p-3` 縮小至 `0.375rem`
- 列表圖標從 `h-4 w-4` (1rem) 縮小至 `0.75rem`
- font-medium 文字縮小至 `0.75rem`
- text-sm 文字縮小至 `0.65rem`
- 按鈕文字從 `text-xs` 縮小至 `9px`

### 專屬組件樣式

#### 執核派藥逾期提醒卡片 (OverdueWorkflowCard)
- 展開/收起按鈕圖標縮小至 `0.875rem`
- 日期網格間距從 `gap-2` 縮小至 `0.375rem`
- 日期按鈕內邊距和文字大小相應縮小

#### 欠缺必要項目卡片 (MissingRequirementsCard)
- 所有列表項目、按鈕、圖標統一縮放
- ArrowRight 圖標縮小至 `0.75rem`

#### 待變更處方提醒卡片 (PendingPrescriptionCard)
- 按鈕組間距縮小
- 查看詳情按鈕文字和圖標縮小

### 其他優化
- space-y-2 間距從 `0.5rem` 縮小至 `0.375rem`
- space-x-3 間距從 `0.75rem` 縮小至 `0.5rem`
- 空狀態圖標從 `h-12 w-12` (3rem) 縮小至 `2rem`
- 展開/收起按鈕內邊距從 `p-3` 縮小至 `0.5rem`

## 效果
修復後，Dashboard 的所有卡片在 iPad 橫向模式下將呈現統一的縮放比例，充分利用屏幕空間，同時保持良好的可讀性和一致的用戶體驗。

## 測試建議
在 iPad 橫向模式（分辨率 1024px-1280px）下測試：
1. 檢查第一組和第二組卡片的視覺比例是否一致
2. 確認所有文字、圖標、按鈕都能清晰顯示
3. 驗證展開/收起功能正常運作
4. 測試點擊各個按鈕和卡片項目的交互是否正常

## 技術細節
- 使用 CSS 媒體查詢針對 iPad 橫向模式（1024px-1280px）
- 採用 `!important` 標記確保樣式優先級
- 所有縮放比例與第二組卡片保持一致
- 使用類選擇器精確定位需要縮放的元素

## 相關組件
- `src/components/MissingRequirementsCard.tsx`
- `src/components/OverdueWorkflowCard.tsx`
- `src/components/PendingPrescriptionCard.tsx`
- `src/components/NotesCard.tsx`
- `src/pages/Dashboard.tsx`
