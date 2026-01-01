import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { PatientProvider } from './context/PatientContext';
import { StationProvider } from './context/facility';
import { FollowUpProvider, DiagnosisProvider, HospitalOutreachProvider } from './context/medical';
import { CareRecordsProvider, CarePlanProvider } from './context/care';
import { ScheduleProvider, PrescriptionProvider } from './context/workflow';
import { WoundProvider, HealthRecordProvider } from './context/health';
import { AssessmentProvider } from './context/assessment';
import { IncidentProvider, MealProvider, PatientLogProvider } from './context/records';
import { HealthTaskProvider } from './context/tasks';
import { AdmissionProvider } from './context/admission';
import { ServiceReasonProvider } from './context/service';
import { DailySystemTaskProvider } from './context/system';
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
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Station C</h1>
            <p className="text-gray-600">請登入以繼續使用系統</p>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            登入 / 註冊
          </button>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
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
        <FollowUpProvider>
          <DiagnosisProvider>
            <HospitalOutreachProvider>
              <CareRecordsProvider>
                <CarePlanProvider>
                  <ScheduleProvider>
                    <PrescriptionProvider>
                      <WoundProvider>
                        <HealthRecordProvider>
                          <AssessmentProvider>
                            <IncidentProvider>
                              <MealProvider>
                                <PatientLogProvider>
                                  <HealthTaskProvider>
                                    <AdmissionProvider>
                                      <ServiceReasonProvider>
                                        <DailySystemTaskProvider>
                                          <PatientProvider>
                                            <AppContent />
                                          </PatientProvider>
                                        </DailySystemTaskProvider>
                                      </ServiceReasonProvider>
                                    </AdmissionProvider>
                                  </HealthTaskProvider>
                                </PatientLogProvider>
                              </MealProvider>
                            </IncidentProvider>
                          </AssessmentProvider>
                        </HealthRecordProvider>
                      </WoundProvider>
                    </PrescriptionProvider>
                  </ScheduleProvider>
                </CarePlanProvider>
              </CareRecordsProvider>
            </HospitalOutreachProvider>
          </DiagnosisProvider>
        </FollowUpProvider>
      </StationProvider>
    </AuthProvider>
  );
}

export default App;
