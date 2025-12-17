import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { PatientProvider } from './context/PatientContext';
import './App.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Scheduling = lazy(() => import('./pages/Scheduling'));
const StationBedManagement = lazy(() => import('./pages/StationBedManagement'));
const StationManagement = lazy(() => import('./pages/StationManagement'));
const PatientRecords = lazy(() => import('./pages/PatientRecords'));
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
const PrescriptionManagement = lazy(() => import('./pages/PrescriptionManagement'));
const DrugDatabase = lazy(() => import('./pages/DrugDatabase'));
const MedicationWorkflow = lazy(() => import('./pages/MedicationWorkflow'));
const StaffWorkPanel = lazy(() => import('./pages/StaffWorkPanel'));
const HospitalOutreach = lazy(() => import('./pages/HospitalOutreach'));
const AnnualHealthCheckup = lazy(() => import('./pages/AnnualHealthCheckup'));
const IncidentReports = lazy(() => import('./pages/IncidentReports'));
const DiagnosisRecords = lazy(() => import('./pages/DiagnosisRecords'));
const VaccinationRecords = lazy(() => import('./pages/VaccinationRecords'));
const OCRDocumentRecognition = lazy(() => import('./pages/OCRDocumentRecognition'));
const CareRecords = lazy(() => import('./pages/CareRecords'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">載入中...</p>
    </div>
  </div>
);

function AppContent() {
  const { user, loading, authReady, signOut } = useAuth();
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

  if (!user) {
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

  return (
    <BrowserRouter>
      <Layout user={user} onSignOut={signOut}>
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
            <Route path="/wound" element={<WoundManagement />} />
            <Route path="/prescriptions" element={<PrescriptionManagement />} />
            <Route path="/drug-database" element={<DrugDatabase />} />
            <Route path="/medication-workflow" element={<MedicationWorkflow />} />
            <Route path="/staff-work-panel" element={<StaffWorkPanel />} />
            <Route path="/hospital-outreach" element={<HospitalOutreach />} />
            <Route path="/annual-health-checkup" element={<AnnualHealthCheckup />} />
            <Route path="/incident-reports" element={<IncidentReports />} />
            <Route path="/diagnosis-records" element={<DiagnosisRecords />} />
            <Route path="/vaccination-records" element={<VaccinationRecords />} />
            <Route path="/ocr" element={<OCRDocumentRecognition />} />
            <Route path="/care-records" element={<CareRecords />} />
            <Route path="/patients" element={<PatientRecords />} />
            <Route path="/templates" element={<TemplateManagement />} />
            <Route path="/health" element={<HealthAssessment />} />
            <Route path="/health-assessments" element={<HealthAssessments />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <PatientProvider>
        <AppContent />
      </PatientProvider>
    </AuthProvider>
  );
}

export default App;
