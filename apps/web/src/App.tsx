import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { PatientProvider } from './context/PatientContext';
import { StationProvider } from './context/facility';
// 使用合併的 Context（減少 Provider 嵌套層級，提升性能）
import { MedicalProvider } from './context/merged/MedicalContext';
import { WorkflowProvider } from './context/merged/WorkflowContext';
import { RecordsProvider } from './context/merged/RecordsContext';
import './App.css';

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

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">載入中...</p>
    </div>
  </div>
);

function AppContent() {
  const { user, userProfile, loading, authReady, signOut, customLogout, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading || !authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{loading ? '載入中...' : '準備中...'}</p>
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
    <BrowserRouter>
      <Layout user={effectiveUser} onSignOut={handleSignOut}>
        <Suspense fallback={<LoadingFallback />}>
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
    </BrowserRouter>
  );
}

function App() {
  return (
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
  );
}

export default App;
