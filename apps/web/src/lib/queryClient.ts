import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Client 配置
 * 
 * 性能優化設定：
 * - staleTime: 5分鐘 - 數據在此時間內視為新鮮，不會重新請求
 * - gcTime: 30分鐘 - 緩存數據保留時間（之前叫 cacheTime）
 * - refetchOnWindowFocus: false - 切換視窗時不自動重取（醫療環境避免干擾）
 * - retry: 1 - 失敗時只重試一次
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 數據新鮮時間：5分鐘內不會重新請求
      staleTime: 5 * 60 * 1000,
      // 緩存保留時間：30分鐘後清除未使用的緩存
      gcTime: 30 * 60 * 1000,
      // 視窗獲得焦點時不自動重取（避免頻繁切換時的請求）
      refetchOnWindowFocus: false,
      // 掛載時如果數據新鮮則不重取
      refetchOnMount: true,
      // 重連時重取
      refetchOnReconnect: true,
      // 失敗時重試次數
      retry: 1,
      // 重試延遲
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Mutation 失敗時不重試
      retry: false,
    },
  },
});

/**
 * Query Keys 工廠
 * 統一管理所有查詢的 key，確保緩存一致性
 */
export const queryKeys = {
  // 病患相關
  patients: {
    all: ['patients'] as const,
    list: (stationId?: number) => ['patients', 'list', { stationId }] as const,
    detail: (id: number) => ['patients', 'detail', id] as const,
    byStation: (stationId: number) => ['patients', 'station', stationId] as const,
  },
  
  // 醫療相關 (MedicalContext)
  medical: {
    followUps: {
      all: ['medical', 'followUps'] as const,
      list: () => ['medical', 'followUps', 'list'] as const,
    },
    diagnoses: {
      all: ['medical', 'diagnoses'] as const,
      byPatient: (patientId: number) => ['medical', 'diagnoses', 'patient', patientId] as const,
    },
    vaccinations: {
      all: ['medical', 'vaccinations'] as const,
      byPatient: (patientId: number) => ['medical', 'vaccinations', 'patient', patientId] as const,
    },
    hospitalOutreach: {
      all: ['medical', 'hospitalOutreach'] as const,
      list: () => ['medical', 'hospitalOutreach', 'list'] as const,
    },
    wounds: {
      all: ['medical', 'wounds'] as const,
      list: () => ['medical', 'wounds', 'list'] as const,
      byPatient: (patientId: number) => ['medical', 'wounds', 'patient', patientId] as const,
    },
    healthRecords: {
      all: ['medical', 'healthRecords'] as const,
      byPatient: (patientId: number) => ['medical', 'healthRecords', 'patient', patientId] as const,
    },
  },
  
  // 工作流相關 (WorkflowContext)
  workflow: {
    schedules: {
      all: ['workflow', 'schedules'] as const,
      list: (date?: string) => ['workflow', 'schedules', 'list', { date }] as const,
      byPatient: (patientId: number, date?: string) => 
        ['workflow', 'schedules', 'patient', patientId, { date }] as const,
    },
    prescriptions: {
      all: ['workflow', 'prescriptions'] as const,
      workflow: (patientId?: number, date?: string) => 
        ['workflow', 'prescriptions', 'workflow', { patientId, date }] as const,
      byPatient: (patientId: number) => 
        ['workflow', 'prescriptions', 'patient', patientId] as const,
    },
    doctorVisits: {
      all: ['workflow', 'doctorVisits'] as const,
      list: () => ['workflow', 'doctorVisits', 'list'] as const,
    },
    drugDatabase: {
      all: ['workflow', 'drugDatabase'] as const,
      search: (query: string) => ['workflow', 'drugDatabase', 'search', query] as const,
    },
    timeSlots: {
      all: ['workflow', 'timeSlots'] as const,
      list: () => ['workflow', 'timeSlots', 'list'] as const,
    },
    inspectionChecks: {
      all: ['workflow', 'inspectionChecks'] as const,
      list: () => ['workflow', 'inspectionChecks', 'list'] as const,
    },
  },
  
  // 紀錄相關 (RecordsContext)
  records: {
    carePlans: {
      all: ['records', 'carePlans'] as const,
      list: () => ['records', 'carePlans', 'list'] as const,
      byPatient: (patientId: number) => ['records', 'carePlans', 'patient', patientId] as const,
    },
    careRecords: {
      all: ['records', 'careRecords'] as const,
      byPatient: (patientId: number) => ['records', 'careRecords', 'patient', patientId] as const,
    },
    assessments: {
      all: ['records', 'assessments'] as const,
      byPatient: (patientId: number) => ['records', 'assessments', 'patient', patientId] as const,
    },
    incidents: {
      all: ['records', 'incidents'] as const,
      list: () => ['records', 'incidents', 'list'] as const,
    },
    meals: {
      all: ['records', 'meals'] as const,
      byPatient: (patientId: number) => ['records', 'meals', 'patient', patientId] as const,
    },
    patientLogs: {
      all: ['records', 'patientLogs'] as const,
      byPatient: (patientId: number) => ['records', 'patientLogs', 'patient', patientId] as const,
    },
    healthTasks: {
      all: ['records', 'healthTasks'] as const,
      list: () => ['records', 'healthTasks', 'list'] as const,
    },
    admissions: {
      all: ['records', 'admissions'] as const,
      byPatient: (patientId: number) => ['records', 'admissions', 'patient', patientId] as const,
    },
    serviceReasons: {
      all: ['records', 'serviceReasons'] as const,
      list: () => ['records', 'serviceReasons', 'list'] as const,
    },
    dailySystemTasks: {
      all: ['records', 'dailySystemTasks'] as const,
      list: (date?: string) => ['records', 'dailySystemTasks', 'list', { date }] as const,
    },
  },
  
  // 站點相關
  stations: {
    all: ['stations'] as const,
    list: () => ['stations', 'list'] as const,
    current: () => ['stations', 'current'] as const,
  },
} as const;

export default queryClient;
