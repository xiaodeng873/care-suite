import React, { useState } from 'react';
import { usePatients } from '../context/PatientContext';
import BottomTabBar, { type TabName } from './components/BottomTabBar';
import ScanPage from './pages/ScanPage';
import PatientListPage from './pages/PatientListPage';
import SettingsPage from './pages/SettingsPage';
import RecordsPage from './pages/RecordsPage';
import type { Bed, Patient } from '../lib/database';

interface NurseAppProps {
  onSignOut: () => Promise<void>;
}

type NurseNav =
  | { screen: 'scan' }
  | { screen: 'patients' }
  | { screen: 'settings' }
  | { screen: 'records'; bed: Bed; patient: Patient | null };

const NurseApp: React.FC<NurseAppProps> = () => {
  const { loading: dataLoading } = usePatients();
  const [nav, setNav] = useState<NurseNav>({ screen: 'scan' });

  const activeTab: TabName =
    nav.screen === 'records' ? 'scan' :
    nav.screen === 'patients' ? 'patients' :
    nav.screen === 'settings' ? 'settings' : 'scan';

  const handlePatientFound = (bed: Bed, patient: Patient | null) => {
    setNav({ screen: 'records', bed, patient });
  };

  const handleGoToPatients = () => setNav({ screen: 'patients' });

  const handleTabChange = (tab: TabName) => {
    if (tab === 'scan')     setNav({ screen: 'scan' });
    if (tab === 'patients') setNav({ screen: 'patients' });
    if (tab === 'settings') setNav({ screen: 'settings' });
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen max-w-md mx-auto flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">加载中…</p>
        </div>
      </div>
    );
  }

  const showBottomTab = nav.screen !== 'records';

  return (
    <div
      lang="zh-Hans"
      className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col relative"
      style={{ fontFamily: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans SC',sans-serif" }}
    >
      {/* Page content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${showBottomTab ? 'pb-16' : ''}`}>
        {nav.screen === 'scan' && (
          <ScanPage
            onPatientFound={handlePatientFound}
            onGoToPatients={handleGoToPatients}
          />
        )}

        {nav.screen === 'patients' && (
          <PatientListPage onSelectPatient={handlePatientFound} />
        )}

        {nav.screen === 'settings' && (
          <SettingsPage />
        )}

        {nav.screen === 'records' && (
          <RecordsPage
            bed={nav.bed}
            patient={nav.patient}
            onBack={() => setNav({ screen: 'scan' })}
          />
        )}
      </div>

      {/* Bottom tab bar (hidden when in records page) */}
      {showBottomTab && (
        <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </div>
  );
};

export default NurseApp;
