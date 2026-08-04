# Mobile 用戶認證系統更新指南

## 概要
需要將 Mobile 應用的認證系統更新為與 Web 應用相同的雙重認證架構（Supabase Auth + 自訂認證）。

## 需要更新的檔案

### 1. `/apps/mobile/src/context/AuthContext.tsx`
複製 web 的 AuthContext 邏輯，包括：
- userProfile state
- customToken state  
- permissions state
- customLogin() 函數
- customLogout() 函數
- callAuthApi() 函數
- hasPermission() 等權限檢查函數
- getUserDisplayName() 包含職位顯示

### 2. `/apps/mobile/src/components/AuthModal.tsx` 或登入畫面
添加：
- 員工/開發者登入模式切換
- 用戶名/密碼輸入（員工模式）
- Email/密碼輸入（開發者模式）

### 3. 所有記錄表單的 recorder/recorder_name 欄位
確保使用 `displayName`（已包含職位），而非簡單的 `staffName`。

需要更新的檔案：
- IntakeOutputModalNew.tsx
- IntakeOutputModal.tsx
- RecordDetailScreen.tsx
- CareRecordsScreen.tsx

### 4. 環境配置
確保 `.env` 或配置檔案中有：
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## 實施步驟

1. 複製 web AuthContext 核心邏輯到 mobile
2. 更新登入介面支援雙模式
3. 批量更新所有 recorder 欄位使用新的 displayName
4. 測試員工登入流程
5. 測試權限過濾功能

## 注意事項
- Mobile 使用 React Native AsyncStorage 代替 localStorage
- API 調用需使用 Expo 的 fetch 或 axios
- UI 元件需使用 React Native 組件而非 HTML

## 職位顯示格式
- 護理職位：`陳大文 (護理師)`
- 專職職位：`李小明 (社工)`
- 其他：優先顯示具體職位，否則顯示部門
