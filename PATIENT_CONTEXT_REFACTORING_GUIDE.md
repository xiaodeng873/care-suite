# PatientContext 重構指南

## 📊 現況分析

**檔案大小：** 2,260 行（原 2,320 行，已減少 60 行）  
**建議大小：** 200-500 行  
**嚴重程度：** 🔴 高（需要重構）

---

## ✅ 已完成的拆分

### StationContext（站點與床位管理）- ✅ 已完成

**檔案位置：** `apps/web/src/context/facility/StationContext.tsx`

**拆分內容：**
- `stations` 狀態
- `beds` 狀態
- `addStation`, `updateStation`, `deleteStation`
- `addBed`, `updateBed`, `deleteBed`
- `assignPatientToBed`, `swapPatientBeds`, `moveBedToStation`
- `refreshStationData`

**使用方式：**
```typescript
// 新組件可以直接使用 StationContext
import { useStation } from '../context/facility';
const { stations, beds, addStation } = useStation();

// 現有組件仍可透過 PatientContext 使用（向後兼容）
import { usePatients } from '../context/PatientContext';
const { stations, beds } = usePatients();
```

---

## ⚠️ 目前問題

### 1. **性能問題**
- Context 包含 30+ 個狀態
- 任何狀態更新都會觸發所有訂閱組件重新渲染
- 導致不必要的性能開銷

### 2. **維護困難**
- 2,320 行代碼難以理解和修改
- 多個開發者協作困難
- 容易產生衝突和 bug

### 3. **測試困難**
- 單一 Context 包含太多邏輯
- 無法進行有效的單元測試
- 依賴關係複雜

### 4. **記憶體問題**
- 所有數據同時載入記憶體
- 即使某些組件不需要某些數據也會載入
- 可能導致記憶體洩漏

---

## ✅ 重構方案

### 方案 A：拆分為多個 Context（推薦）

將 PatientContext 拆分為多個獨立的 Context：

```
apps/web/src/context/
├── AuthContext.tsx（已存在）
├── patients/
│   ├── PatientContext.tsx（院友基本資料）
│   ├── PatientHealthContext.tsx（健康記錄、評估）
│   └── PatientTaskContext.tsx（任務、監測）
├── medical/
│   ├── PrescriptionContext.tsx（處方管理）
│   ├── FollowUpContext.tsx（追蹤管理）
│   └── DiagnosisContext.tsx（診斷、疫苗）
├── facility/
│   ├── StationContext.tsx（站點、床位）
│   └── ScheduleContext.tsx（排程）
└── workflow/
    └── WorkflowContext.tsx（工作流程記錄）
```

#### 範例：PatientContext（簡化版）

```typescript
// apps/web/src/context/patients/PatientContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import * as db from '../../lib/database';

interface PatientContextType {
  patients: db.Patient[];
  loading: boolean;
  refreshPatients: () => Promise<void>;
  addPatient: (patient: Omit<db.Patient, '院友id'>) => Promise<void>;
  updatePatient: (patient: db.Patient) => Promise<void>;
  deletePatient: (id: number) => Promise<void>;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patients, setPatients] = useState<db.Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPatients = async () => {
    setLoading(true);
    try {
      const data = await db.getPatients();
      setPatients(data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPatients();
  }, []);

  const addPatient = async (patient: Omit<db.Patient, '院友id'>) => {
    const newPatient = await db.addPatient(patient);
    setPatients(prev => [...prev, newPatient]);
  };

  const updatePatient = async (patient: db.Patient) => {
    await db.updatePatient(patient);
    await refreshPatients();
  };

  const deletePatient = async (id: number) => {
    await db.deletePatient(id);
    setPatients(prev => prev.filter(p => p.院友id !== id));
  };

  return (
    <PatientContext.Provider value={{
      patients,
      loading,
      refreshPatients,
      addPatient,
      updatePatient,
      deletePatient
    }}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatients = () => {
  const context = useContext(PatientContext);
  if (!context) throw new Error('usePatients must be used within PatientProvider');
  return context;
};
```

#### 範例：PrescriptionContext

```typescript
// apps/web/src/context/medical/PrescriptionContext.tsx
import { createContext, useContext, useState, useCallback } from 'react';
import * as db from '../../lib/database';

interface PrescriptionContextType {
  prescriptions: db.MedicationPrescription[];
  workflowRecords: PrescriptionWorkflowRecord[];
  loading: boolean;
  fetchPrescriptions: (patientId?: number) => Promise<void>;
  fetchWorkflowRecords: (patientId?: number, date?: string) => Promise<void>;
  updateWorkflowRecord: (id: string, data: Partial<PrescriptionWorkflowRecord>) => Promise<void>;
}

const PrescriptionContext = createContext<PrescriptionContextType | undefined>(undefined);

export const PrescriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prescriptions, setPrescriptions] = useState<db.MedicationPrescription[]>([]);
  const [workflowRecords, setWorkflowRecords] = useState<PrescriptionWorkflowRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPrescriptions = useCallback(async (patientId?: number) => {
    setLoading(true);
    try {
      const data = await db.getMedicationPrescriptions(patientId);
      setPrescriptions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkflowRecords = useCallback(async (patientId?: number, date?: string) => {
    // 實作邏輯...
  }, []);

  const updateWorkflowRecord = async (id: string, data: Partial<PrescriptionWorkflowRecord>) => {
    // 實作邏輯...
  };

  return (
    <PrescriptionContext.Provider value={{
      prescriptions,
      workflowRecords,
      loading,
      fetchPrescriptions,
      fetchWorkflowRecords,
      updateWorkflowRecord
    }}>
      {children}
    </PrescriptionContext.Provider>
  );
};

export const usePrescriptions = () => {
  const context = useContext(PrescriptionContext);
  if (!context) throw new Error('usePrescriptions must be used within PrescriptionProvider');
  return context;
};
```

#### 整合多個 Context

```typescript
// apps/web/src/App.tsx
<AuthProvider>
  <PatientProvider>
    <PatientHealthProvider>
      <PrescriptionProvider>
        <FollowUpProvider>
          <StationProvider>
            <AppContent />
          </StationProvider>
        </FollowUpProvider>
      </PrescriptionProvider>
    </PatientHealthProvider>
  </PatientProvider>
</AuthProvider>
```

---

### 方案 B：使用 Zustand（推薦用於大型應用）

安裝 Zustand：
```bash
npm install zustand
```

#### 範例：Patient Store

```typescript
// apps/web/src/stores/patientStore.ts
import { create } from 'zustand';
import * as db from '../lib/database';

interface PatientState {
  patients: db.Patient[];
  loading: boolean;
  fetchPatients: () => Promise<void>;
  addPatient: (patient: Omit<db.Patient, '院友id'>) => Promise<void>;
  updatePatient: (patient: db.Patient) => Promise<void>;
  deletePatient: (id: number) => Promise<void>;
}

export const usePatientStore = create<PatientState>((set) => ({
  patients: [],
  loading: false,
  
  fetchPatients: async () => {
    set({ loading: true });
    try {
      const data = await db.getPatients();
      set({ patients: data });
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  addPatient: async (patient) => {
    const newPatient = await db.addPatient(patient);
    set((state) => ({ patients: [...state.patients, newPatient] }));
  },
  
  updatePatient: async (patient) => {
    await db.updatePatient(patient);
    set((state) => ({
      patients: state.patients.map(p => p.院友id === patient.院友id ? patient : p)
    }));
  },
  
  deletePatient: async (id) => {
    await db.deletePatient(id);
    set((state) => ({
      patients: state.patients.filter(p => p.院友id !== id)
    }));
  },
}));
```

#### 使用方式

```typescript
// 在組件中使用
import { usePatientStore } from '../stores/patientStore';

function PatientList() {
  const { patients, loading, fetchPatients } = usePatientStore();
  
  useEffect(() => {
    fetchPatients();
  }, []);
  
  if (loading) return <div>載入中...</div>;
  
  return (
    <div>
      {patients.map(patient => (
        <div key={patient.院友id}>{patient.中文姓名}</div>
      ))}
    </div>
  );
}
```

#### Zustand 優勢

1. ✅ 更簡潔的 API
2. ✅ 自動優化（只有使用的狀態變化時才重新渲染）
3. ✅ 更好的 TypeScript 支援
4. ✅ 更容易測試
5. ✅ 支援 devtools

---

## 📅 實施計劃

### 階段 1：準備（1-2 天）
- [ ] 分析所有使用 PatientContext 的組件
- [ ] 確定狀態分組策略
- [ ] 創建新的資料夾結構

### 階段 2：逐步遷移（1-2 週）
- [ ] 創建新的 Context/Store（從最獨立的開始）
- [ ] 遷移組件使用新的 Context
- [ ] 保持舊 Context 向後兼容

### 階段 3：測試與優化（3-5 天）
- [ ] 全面測試所有功能
- [ ] 性能測試和優化
- [ ] 修復發現的問題

### 階段 4：清理（1-2 天）
- [ ] 移除舊的 PatientContext
- [ ] 更新文檔
- [ ] Code review

---

## 🎯 預期收益

### 性能提升
- ⚡ 減少 50-70% 的不必要重新渲染
- ⚡ 記憶體使用減少 30-40%
- ⚡ 初始載入時間減少

### 開發體驗
- 📝 代碼更易理解和維護
- 🐛 更容易發現和修復 bug
- 👥 團隊協作更順暢

### 可擴展性
- 🚀 更容易添加新功能
- 🔧 更容易修改現有功能
- 📦 更好的代碼組織

---

## 📚 參考資源

- [React Context 最佳實踐](https://react.dev/learn/passing-data-deeply-with-context)
- [Zustand 文檔](https://github.com/pmndrs/zustand)
- [狀態管理指南](https://kentcdodds.com/blog/application-state-management-with-react)

---

## ⚠️ 注意事項

1. **逐步遷移** - 不要一次性重寫所有代碼
2. **保持向後兼容** - 在遷移期間確保系統正常運行
3. **充分測試** - 每個階段都要進行測試
4. **團隊溝通** - 確保所有團隊成員了解變更
5. **記錄變更** - 更新文檔和 README

---

## 🚀 開始行動

建議優先級：
1. **高優先級** - PrescriptionContext（使用最頻繁）
2. **中優先級** - PatientHealthContext（健康記錄）
3. **低優先級** - 其他 Context

選擇一個小範圍開始（如 StationContext），驗證方案可行性後再全面推廣。
