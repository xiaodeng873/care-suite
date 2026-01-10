import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Routes, Route, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { PatientProvider, usePatients } from './context/PatientContext';
import { StationProvider } from './context/facility';
// 使用合併的 Context（減少 Provider 嵌套層級，提升性能）
import { MedicalProvider, useMedical } from './context/merged/MedicalContext';
import { WorkflowProvider, useWorkflow } from './context/merged/WorkflowContext';
import { RecordsProvider, useRecords } from './context/merged/RecordsContext';
import { DashboardReadyProvider, useDashboardReady } from './context/DashboardReadyContext';
import { LoadingScreen } from './components/PageLoadingScreen';
import { NavigationProvider } from './context/NavigationContext';
import './App.css';

// 路由名稱對照表
const routeNames: Record<string, string> = {
  '/': '主頁',
  '/scheduling': 'VMO排程',
  '/station-bed': '床位管理',
  '/follow-up': '覆診管理',
  '/tasks': '任務管理',
  '/meal-guidance': '飲食指導',
  '/patient-logs': '院友日誌',
  '/restraint': '約束物品',
  '/admission-records': '入院記錄',
  '/print-forms': '列印表格',
  '/wound': '傷口管理',
  '/wound-old': '傷口評估',
  '/prescriptions': '處方管理',
  '/drug-database': '藥物資料庫',
  '/medication-workflow': '藥物工作流程',
  '/hospital-outreach': '醫院外展',
  '/annual-health-checkup': '年度體檢',
  '/incident-reports': '意外事故報告',
  '/diagnosis-records': '診斷記錄',
  '/vaccination-records': '疫苗記錄',
  '/care-records': '護理記錄',
  '/patients': '院友列表',
  '/patient-contacts': '院友聯絡人',
  '/templates': '範本管理',
  '/health': '監測記錄',
  '/health-assessments': '健康評估',
  '/individual-care-plan': '個人照顧計劃',
  '/reports': '報表查詢',
  '/settings': '系統設定',
  '/rehabilitation': '復康服務'
};

// 根據當前路由顯示對應名稱的 Loading 組件
const RouteLoadingFallback: React.FC = () => {
  const location = useLocation();
  const pageName = routeNames[location.pathname] || '頁面';
  return <LoadingScreen pageName={pageName} />;
};

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Scheduling = lazy(() => import('./pages/Scheduling'));
const StationBedManagement = lazy(() => import('./pages/StationBedManagement'));
const StationManagement = lazy(() => import('./pages/StationManagement'));
const PatientRecords = lazy(() => import('./pages/PatientRecords'));
const PatientContacts = lazy(() => import('./pages/PatientContacts'));
const TemplateManagement = lazy(() => import('./pages/TemplateManagement'));
const HealthAssessment = lazy(() => import('./pages/HealthAssessment'));
const HealthAssessments = lazy(() => import('./pages/HealthAssessments'));
const Reports = lazy(() => import('./pages/Reports'));
const FollowUpManagement = lazy(() => import('./pages/FollowUpManagement'));
const TaskManagement = lazy(() => import('./pages/TaskManagement'));
const MealGuidance = lazy(() => import('./pages/MealGuidance'));
const PatientLogs = lazy(() => import('./pages/PatientLogs'));
const RestraintManagement = lazy(() => import('./pages/RestraintManagement'));
const AdmissionRecords = lazy(() => import('./pages/AdmissionRecords'));
const PrintForms = lazy(() => import('./pages/PrintForms'));
const WoundManagement = lazy(() => import('./pages/WoundManagement'));
const WoundManagementNew = lazy(() => import('./pages/WoundManagementNew'));
const PrescriptionManagement = lazy(() => import('./pages/PrescriptionManagement'));
const DrugDatabase = lazy(() => import('./pages/DrugDatabase'));
const MedicationWorkflow = lazy(() => import('./pages/MedicationWorkflow'));
const HospitalOutreach = lazy(() => import('./pages/HospitalOutreach'));
const AnnualHealthCheckup = lazy(() => import('./pages/AnnualHealthCheckup'));
const IncidentReports = lazy(() => import('./pages/IncidentReports'));
const DiagnosisRecords = lazy(() => import('./pages/DiagnosisRecords'));
const VaccinationRecords = lazy(() => import('./pages/VaccinationRecords'));
const CareRecords = lazy(() => import('./pages/CareRecords'));
const Settings = lazy(() => import('./pages/Settings'));
const Rehabilitation = lazy(() => import('./pages/Rehabilitation'));
const IndividualCarePlan = lazy(() => import('./pages/IndividualCarePlan'));

function AppContent() {
  const { user, userProfile, loading: authLoading, authReady, signOut, customLogout, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showInitialLoadingScreen, setShowInitialLoadingScreen] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const wasAuthenticatedRef = useRef(false);
  const loadingStartTimeRef = useRef<number | null>(null);

  // 監測登入狀態變化，登入成功後開始顯示加載頁面
  useEffect(() => {
    const isNowAuthenticated = isAuthenticated();
    
    // 從未認證狀態變為認證狀態（即剛登入）
    if (!wasAuthenticatedRef.current && isNowAuthenticated && authReady) {
      setShowInitialLoadingScreen(true);
      setMinTimeElapsed(false);
      loadingStartTimeRef.current = Date.now();
      
      // 設置最短顯示時間（1.5秒），確保加載頁面不會閃現
      const minTimer = setTimeout(() => {
        setMinTimeElapsed(true);
      }, 1500);
      
      wasAuthenticatedRef.current = true;
      return () => {
        clearTimeout(minTimer);
      };
    }
    
    // 更新認證狀態引用
    wasAuthenticatedRef.current = isNowAuthenticated;
  }, [isAuthenticated, authReady]);

  if (authLoading || !authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{authLoading ? '載入中...' : '準備中...'}</p>
        </div>
      </div>
    );
  }

  // 檢查是否已認證（支援 Supabase Auth 或自訂認證）
  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <AuthModal
          isOpen={true}
          onClose={() => {}}
        />
      </div>
    );
  }

  // 登入成功後的初始加載頁面 - 將由 AuthenticatedContent 組件處理
  // 這裡傳遞狀態給 AuthenticatedContent

  // 處理登出（支援兩種認證方式）
  const handleSignOut = async () => {
    if (userProfile) {
      await customLogout();
    }
    if (user) {
      await signOut();
    }
  };

  // 為自訂認證用戶創建一個虛擬的 user 對象供 Layout 使用
  const effectiveUser = user || (userProfile ? {
    id: userProfile.id,
    email: userProfile.username,
    user_metadata: {
      display_name: userProfile.name_zh,
    },
  } as any : null);

  return (
    <AuthenticatedContent 
      effectiveUser={effectiveUser} 
      onSignOut={handleSignOut}
      showInitialLoadingScreen={showInitialLoadingScreen}
      setShowInitialLoadingScreen={setShowInitialLoadingScreen}
      minTimeElapsed={minTimeElapsed}
    />
  );
}

// 獨立的已認證內容組件 - 可以使用所有 Context 獲取真實的加載狀態
function AuthenticatedContent({ 
  effectiveUser, 
  onSignOut, 
  showInitialLoadingScreen,
  setShowInitialLoadingScreen,
  minTimeElapsed
}: {
  effectiveUser: any;
  onSignOut: () => Promise<void>;
  showInitialLoadingScreen: boolean;
  setShowInitialLoadingScreen: (value: boolean) => void;
  minTimeElapsed: boolean;
}) {
  // 獲取所有 Context 的加載狀態
  const { loading: patientLoading, patients } = usePatients();
  const { loading: medicalLoading, healthRecords, followUpAppointments } = useMedical();
  const { scheduleLoading, prescriptionLoading, prescriptions } = useWorkflow();
  const { loading: recordsLoading, patientHealthTasks, mealGuidances, healthAssessments, patientRestraintAssessments, annualHealthCheckups } = useRecords();
  
  // 獲取 Dashboard 準備完成狀態
  const { isDashboardReady, resetDashboardReady } = useDashboardReady();
  
  // 備用超時狀態
  const [fallbackTimeout, setFallbackTimeout] = useState(false);
  
  // 所有數據是否都已加載完成
  const allDataLoaded = !patientLoading && 
                        !medicalLoading && 
                        !scheduleLoading && 
                        !prescriptionLoading && 
                        !recordsLoading;
  
  // 關鍵數據是否已經存在（不只是 loading 完成，而是真的有數據陣列存在）
  const hasEssentialData = Array.isArray(patients) && 
                           Array.isArray(healthRecords) && 
                           Array.isArray(patientHealthTasks) &&
                           Array.isArray(prescriptions) &&
                           Array.isArray(mealGuidances) &&
                           Array.isArray(healthAssessments);
  
  // 當顯示加載頁面時，重置狀態並設置備用超時
  useEffect(() => {
    if (showInitialLoadingScreen) {
      resetDashboardReady();
      setFallbackTimeout(false);
      
      // 備用超時：如果 8 秒後 Dashboard 仍未報告 ready，強制進入
      const fallbackTimer = setTimeout(() => {
        console.log('[Loading] Fallback timeout triggered');
        setFallbackTimeout(true);
      }, 8000);
      
      return () => clearTimeout(fallbackTimer);
    }
  }, [showInitialLoadingScreen, resetDashboardReady]);
  
  // 當數據加載完成、(Dashboard 準備完成 或 備用超時) 且最短時間已過，隱藏加載頁面
  useEffect(() => {
    const canHide = showInitialLoadingScreen && 
                    allDataLoaded && 
                    hasEssentialData && 
                    minTimeElapsed && 
                    (isDashboardReady || fallbackTimeout);
    
    if (canHide) {
      console.log('[Loading] Hiding loading screen', { isDashboardReady, fallbackTimeout });
      setShowInitialLoadingScreen(false);
    }
  }, [showInitialLoadingScreen, allDataLoaded, hasEssentialData, isDashboardReady, fallbackTimeout, minTimeElapsed, setShowInitialLoadingScreen]);

  // 顯示初始加載頁面
  if (showInitialLoadingScreen) {
    return <LoadingScreen pageName="主控台" />;
  }

  return (
    <BrowserRouter>
      <NavigationProvider>
        <Layout user={effectiveUser} onSignOut={onSignOut}>
          <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scheduling" element={<Scheduling />} />
            <Route path="/station-bed" element={<StationBedManagement />} />
            <Route path="/follow-up" element={<FollowUpManagement />} />
            <Route path="/tasks" element={<TaskManagement />} />
            <Route path="/meal-guidance" element={<MealGuidance />} />
            <Route path="/patient-logs" element={<PatientLogs />} />
            <Route path="/restraint" element={<RestraintManagement />} />
            <Route path="/admission-records" element={<AdmissionRecords />} />
            <Route path="/print-forms" element={<PrintForms />} />
            <Route path="/wound" element={<WoundManagementNew />} />
            <Route path="/wound-old" element={<WoundManagement />} />
            <Route path="/prescriptions" element={<PrescriptionManagement />} />
            <Route path="/drug-database" element={<DrugDatabase />} />
            <Route path="/medication-workflow" element={<MedicationWorkflow />} />
            <Route path="/hospital-outreach" element={<HospitalOutreach />} />
            <Route path="/annual-health-checkup" element={<AnnualHealthCheckup />} />
            <Route path="/incident-reports" element={<IncidentReports />} />
            <Route path="/diagnosis-records" element={<DiagnosisRecords />} />
            <Route path="/vaccination-records" element={<VaccinationRecords />} />
            <Route path="/care-records" element={<CareRecords />} />
            <Route path="/patients" element={<PatientRecords />} />
            <Route path="/patient-contacts" element={<PatientContacts />} />
            <Route path="/templates" element={<TemplateManagement />} />
            <Route path="/health" element={<HealthAssessment />} />
            <Route path="/health-assessments" element={<HealthAssessments />} />
            <Route path="/individual-care-plan" element={<IndividualCarePlan />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/rehabilitation" element={<Rehabilitation />} />
          </Routes>
          </Suspense>
        </Layout>
      </NavigationProvider>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardReadyProvider>
        <AuthProvider>
          <StationProvider>
            <MedicalProvider>
              <WorkflowProvider>
                <RecordsProvider>
                  <PatientProvider>
                    <AppContent />
                  </PatientProvider>
                </RecordsProvider>
              </WorkflowProvider>
            </MedicalProvider>
          </StationProvider>
        </AuthProvider>
      </DashboardReadyProvider>
      {/* React Query DevTools - 僅開發環境顯示 */}
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
    </QueryClientProvider>
  );
}

export default App;
