# SeniorCare Android 平板應用程式 - 設定指南

## 📱 專案位置

Android 平板應用程式位於專案中的 `mobile-app/` 資料夾：

```
project/
├── src/              ← 網頁版原始碼
├── mobile-app/       ← Android 平板應用程式 (新增)
│   ├── src/
│   │   ├── context/  ← 已完成
│   │   ├── lib/      ← 已完成
│   │   └── utils/    ← 已移植部分
│   ├── App.tsx
│   ├── package.json
│   └── README.md
└── ...
```

## 🚀 快速開始

### 1. 進入 mobile-app 目錄

```bash
cd mobile-app
```

### 2. 安裝依賴（如果尚未安裝）

```bash
npm install
```

### 3. 啟動開發伺服器

```bash
npm start
```

### 4. 運行應用程式

開發伺服器啟動後，您會看到一個 QR Code 和一些選項：

**選項 A: 使用 Android 模擬器**
- 按鍵盤上的 `a` 鍵
- 應用程式會自動在模擬器中啟動

**選項 B: 使用實體 Android 平板**
1. 在平板上安裝 [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) App
2. 使用 Expo Go 掃描終端顯示的 QR Code
3. 應用程式會在您的平板上載入

**選項 C: 網頁預覽（功能受限）**
- 按鍵盤上的 `w` 鍵
- 在瀏覽器中預覽（某些原生功能無法使用）

## ✅ 已完成的功能

### 1. 基礎架構
- ✅ Expo React Native 專案初始化
- ✅ TypeScript 配置
- ✅ 所有必要依賴安裝完成

### 2. 後端整合
- ✅ Supabase 客戶端配置 (`src/lib/supabase.ts`)
- ✅ 與網頁版共享資料庫
- ✅ 環境變數設定 (`.env`)

### 3. 身份驗證
- ✅ AuthContext 實作 (`src/context/AuthContext.tsx`)
- ✅ 支援登入/註冊/登出
- ✅ Session 管理

### 4. 狀態管理
- ✅ PatientContext (`src/context/PatientContext.tsx`)
- ✅ 院友選擇狀態

### 5. 工具函式
- ✅ nameFormatter.ts (姓名格式化)
- ✅ reasonColors.ts (原因顏色)

## 🚧 待開發功能

以下功能需要從網頁版 (`../src`) 移植到 mobile-app：

### 高優先級
1. **登入畫面** (`screens/AuthScreen.tsx`)
2. **導覽系統** (`navigation/AppNavigator.tsx`)
3. **儀表板** (`screens/DashboardScreen.tsx`)
4. **院友管理** (`screens/PatientRecordsScreen.tsx`)
5. **處方管理** (`screens/PrescriptionManagementScreen.tsx`)

### 中優先級
6. 健康評估
7. 傷口管理
8. 排程與任務
9. OCR 相機整合

### 低優先級
10. 所有其他功能模組
11. 報表匯出

## 📦 已安裝的套件

```json
{
  "@supabase/supabase-js": "^2.76.1",
  "@react-navigation/native": "^7.1.18",
  "@react-navigation/drawer": "^7.6.0",
  "react-native-paper": "^5.14.5",
  "expo-camera": "^17.0.8",
  "expo-image-picker": "^17.0.8",
  "@zurmokeeper/exceljs": "^4.4.9",
  // ... 更多套件
}
```

完整列表請參考 `mobile-app/package.json`

## 🔧 開發建議

### 從網頁版移植元件

網頁版和 mobile 版的主要差異：

| 網頁版 | Mobile 版 |
|--------|-----------|
| `<div>` | `<View>` |
| `<span>`, `<p>` | `<Text>` |
| `<button>` | `<Button>` (from react-native-paper) |
| `<input>` | `<TextInput>` |
| `onClick` | `onPress` |
| CSS classes | StyleSheet |
| `import.meta.env.VITE_*` | `process.env.EXPO_PUBLIC_*` |

### 建立新畫面

1. 在 `src/screens/` 建立新檔案
2. 從網頁版複製業務邏輯
3. 將 HTML 元素改為 React Native 元件
4. 調整樣式為 StyleSheet

範例：

```typescript
// src/screens/DashboardScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text>儀表板</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
```

## 📚 相關資源

- [Expo 文件](https://docs.expo.dev/)
- [React Native 文件](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Supabase JS 文件](https://supabase.com/docs/reference/javascript/introduction)

## ⚠️ 注意事項

1. **資料庫共享**: mobile-app 和網頁版使用相同的 Supabase 資料庫，資料會即時同步

2. **環境變數**: `.env` 檔案已經配置，包含與網頁版相同的 Supabase 連線資訊

3. **測試帳號**: 使用與網頁版相同的測試帳號登入

4. **開發模式**: 程式碼修改會自動熱重載（Hot Reload）

## 🎯 下一步

1. **立即可做**: 閱讀 `mobile-app/README.md`
2. **開始開發**: 從登入畫面和導覽系統開始
3. **參考程式碼**: 查看 `../src` 網頁版程式碼作為參考

---

**專案狀態**: 基礎架構完成，準備開發功能模組
**預估時間**: 4 個月全職開發完成所有功能
**技術棧**: React Native + Expo + TypeScript + Supabase
