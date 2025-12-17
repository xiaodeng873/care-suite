# 護理記錄 Mobile App

這是「護理記錄」手機應用程式，專為院舍巡邏護理記錄設計，支援 iOS 和 Android 平台。

## 功能特點

### 核心功能
- **登入認證**：與 Web App 共用 Supabase 認證系統
- **院友列表**：顯示所有在住院友，可搜尋和點選進入詳情
- **QR Code 掃描**：掃描床位 QR Code 快速找到對應院友
- **護理記錄**：
  - 巡房記錄
  - 換片記錄
  - 約束物品觀察記錄
  - 轉身記錄
  - 出入量記錄（開發中）
  - 如廁訓練記錄（開發中）

### 資料同步
- 與 Web App 共享同一個 Supabase 資料庫
- 即時資料同步，支援多端操作

## 技術棧

- **框架**：React Native + Expo
- **語言**：TypeScript
- **導航**：React Navigation
- **後端**：Supabase (PostgreSQL)
- **認證**：Supabase Auth
- **相機**：Expo Camera

## 專案結構

```
mobile/
├── App.tsx                    # 主入口
├── app.json                   # Expo 配置
├── package.json               # 依賴配置
├── assets/                    # 靜態資源
└── src/
    ├── context/
    │   └── AuthContext.tsx    # 認證上下文
    ├── lib/
    │   ├── supabase.ts        # Supabase 客戶端
    │   └── database.ts        # 資料庫操作函數
    ├── navigation/
    │   └── AppNavigator.tsx   # 導航配置
    ├── screens/
    │   ├── LoginScreen.tsx    # 登入頁面
    │   ├── HomeScreen.tsx     # 院友列表
    │   ├── ScanScreen.tsx     # QR Code 掃描
    │   ├── SettingsScreen.tsx # 設定頁面
    │   ├── CareRecordsScreen.tsx    # 護理記錄主頁
    │   └── RecordDetailScreen.tsx   # 記錄詳情/編輯
    └── utils/
        └── careRecordHelper.ts # 護理記錄輔助函數
```

## 共享資料表

與 Web App 共用以下 Supabase 資料表：

1. **patrol_rounds** - 巡房記錄
2. **diaper_change_records** - 換片記錄
3. **restraint_observation_records** - 約束物品觀察記錄
4. **position_change_records** - 轉身記錄
5. **院友主表** - 院友基本資料
6. **beds** - 床位資料（包含 QR Code ID）
7. **stations** - 站點資料

## 開發指南

### 安裝依賴
```bash
cd mobile
npm install
# 或
yarn install
```

### 啟動開發服務器
```bash
npm start
# 或
yarn start
```

### 運行 iOS 模擬器
```bash
npm run ios
# 或
yarn ios
```

### 運行 Android 模擬器
```bash
npm run android
# 或
yarn android
```

## 構建發佈

### iOS
```bash
eas build --platform ios
```

### Android
```bash
eas build --platform android
```

## QR Code 格式

床位 QR Code 包含以下 JSON 結構：
```json
{
  "type": "bed",
  "qr_code_id": "uuid-string",
  "bed_number": "A01"
}
```

## 設計風格

手機 App 完全複製 Web App 的設計風格：
- 主色調：藍色 (#2563eb)
- 背景色：淺灰 (#f3f4f6)
- 卡片背景：白色 (#ffffff)
- 圓角設計：12px
- 陰影效果：柔和陰影

## 注意事項

1. QR Code 與床位綁定，但對應的院友可能會改變
2. 巡邏資料跟隨院友（patient_id），不是床位
3. 出入量記錄和如廁訓練記錄標記為「開發中」，與 Web App 保持一致
4. 需要相機權限才能使用 QR Code 掃描功能

## 版本歷史

- **v1.0.0** - 初始版本
  - 登入/登出功能
  - 院友列表瀏覽
  - QR Code 掃描
  - 巡房記錄 CRUD
  - 換片記錄 CRUD
  - 約束觀察記錄 CRUD
  - 轉身記錄 CRUD
