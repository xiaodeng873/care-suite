import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Settings,
  User,
  Baby,
  Shield,
  RotateCcw,
  Droplets,
  GraduationCap,
  Plus,
  X
} from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from '../components/PatientAutocomplete';
import PatrolRoundModal from '../components/PatrolRoundModal';
import DiaperChangeModal from '../components/DiaperChangeModal';
import RestraintObservationModal from '../components/RestraintObservationModal';
import PositionChangeModal from '../components/PositionChangeModal';
import {
  TIME_SLOTS,
  DIAPER_CHANGE_SLOTS,
  generateWeekDates,
  getWeekStartDate,
  formatDate,
  isInHospital,
  getPositionSequence
} from '../utils/careRecordHelper';
import type { Patient, PatrolRound, DiaperChangeRecord, RestraintObservationRecord, PositionChangeRecord, PatientCareTab } from '../lib/database';
import * as db from '../lib/database';
import { supabase } from '../lib/supabase';
import {
  loadPatientCareTabs,
  initializePatientCareTabs,
  addPatientCareTab,
  hidePatientCareTab,
  getVisibleTabTypes
} from '../utils/careTabsHelper';

type TabType = 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training';

const CareRecords: React.FC = () => {
  const {
    patients,
    patientRestraintAssessments,
    healthAssessments,
    admissionRecords,
    hospitalEpisodes
  } = usePatients();

  // 本地狀態管理護理記錄數據
  const [loading, setLoading] = useState(false);
  const [patrolRounds, setPatrolRounds] = useState<PatrolRound[]>([]);
  const [diaperChangeRecords, setDiaperChangeRecords] = useState<DiaperChangeRecord[]>([]);
  const [restraintObservationRecords, setRestraintObservationRecords] = useState<RestraintObservationRecord[]>([]);
  const [positionChangeRecords, setPositionChangeRecords] = useState<PositionChangeRecord[]>([]);

  const { user } = useAuth();
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '未知';

  const [activeTab, setActiveTab] = useState<TabType>('patrol');
  const [weekStartDate, setWeekStartDate] = useState(getWeekStartDate());
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  const [showPatrolModal, setShowPatrolModal] = useState(false);
  const [showDiaperModal, setShowDiaperModal] = useState(false);
  const [showRestraintModal, setShowRestraintModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);

  const [modalDate, setModalDate] = useState('');
  const [modalTimeSlot, setModalTimeSlot] = useState('');
  const [modalExistingRecord, setModalExistingRecord] = useState<any>(null);

  const [patientCareTabs, setPatientCareTabs] = useState<PatientCareTab[]>([]);
  const [showAddTabMenu, setShowAddTabMenu] = useState(false);

  const weekDates = useMemo(() => generateWeekDates(weekStartDate), [weekStartDate]);

  // 將 Date 物件轉換為 YYYY-MM-DD 字串格式，用於與資料庫日期比對
  const weekDateStrings = useMemo(() =>
    weekDates.map(date => formatDate(date)),
    [weekDates]
  );

  const sortedActivePatients = useMemo(() => {
    return patients
      .filter(p => p.在住狀態 === '在住')
      .sort((a, b) => a.床號.localeCompare(b.床號, 'zh-Hant', { numeric: true }));
  }, [patients]);

  useEffect(() => {
    if (!selectedPatientId && sortedActivePatients.length > 0) {
      setSelectedPatientId(sortedActivePatients[0].院友id.toString());
    }
  }, [selectedPatientId, sortedActivePatients]);

  const selectedPatient = useMemo(() => {
    const patientIdNum = parseInt(selectedPatientId);
    return patients.find(p => p.院友id === patientIdNum);
  }, [selectedPatientId, patients]);

  useEffect(() => {
    const loadAndInitializeTabs = async () => {
      if (!selectedPatient) return;

      const existingTabs = await loadPatientCareTabs(selectedPatient.院友id);

      if (existingTabs.length === 0) {
        const healthTasks: any[] = [];
        const initializedTabs = await initializePatientCareTabs(
          selectedPatient,
          healthAssessments,
          patientRestraintAssessments,
          healthTasks
        );
        setPatientCareTabs(initializedTabs);
      } else {
        setPatientCareTabs(existingTabs);
      }
    };

    loadAndInitializeTabs();
  }, [selectedPatient, healthAssessments, patientRestraintAssessments]);

  const visibleTabTypes = useMemo(() => {
    if (!selectedPatient) return ['patrol'] as TabType[];

    return getVisibleTabTypes(
      selectedPatient.院友id,
      patientCareTabs,
      patrolRounds,
      diaperChangeRecords,
      restraintObservationRecords,
      positionChangeRecords
    ) as TabType[];
  }, [selectedPatient, patientCareTabs, patrolRounds, diaperChangeRecords, restraintObservationRecords, positionChangeRecords]);

  const patientPatrolRounds = useMemo(() => {
    if (!selectedPatientId) return [];
    const patientIdNum = parseInt(selectedPatientId);
    const filtered = patrolRounds.filter(r => r.patient_id === patientIdNum);
    return filtered;
  }, [selectedPatientId, patrolRounds]);

  const patientDiaperChanges = useMemo(() => {
    if (!selectedPatientId) return [];
    const patientIdNum = parseInt(selectedPatientId);
    const filtered = diaperChangeRecords.filter(r => r.patient_id === patientIdNum);
    return filtered;
  }, [selectedPatientId, diaperChangeRecords]);

  const patientRestraintObservations = useMemo(() => {
    if (!selectedPatientId) return [];
    const patientIdNum = parseInt(selectedPatientId);
    const filtered = restraintObservationRecords.filter(r => r.patient_id === patientIdNum);
    return filtered;
  }, [selectedPatientId, restraintObservationRecords]);

  const patientPositionChanges = useMemo(() => {
    if (!selectedPatientId) return [];
    const patientIdNum = parseInt(selectedPatientId);
    const filtered = positionChangeRecords.filter(r => r.patient_id === patientIdNum);
    return filtered;
  }, [selectedPatientId, positionChangeRecords]);

  const handlePreviousWeek = () => {
    const prevWeek = new Date(weekStartDate);
    prevWeek.setDate(prevWeek.getDate() - 7);
    setWeekStartDate(prevWeek);
  };

  // 加載當前週的護理記錄數據
  const loadCareRecordsForWeek = async (startDate: string, endDate: string, silent = false) => {
    // silent 模式下不顯示全螢幕 loading，避免畫面閃爍
    if (!silent) {
      setLoading(true);
    }
    try {
      const [patrolData, diaperData, restraintData, positionData] = await Promise.all([
        db.getPatrolRoundsInDateRange(startDate, endDate),
        db.getDiaperChangeRecordsInDateRange(startDate, endDate),
        db.getRestraintObservationRecordsInDateRange(startDate, endDate),
        db.getPositionChangeRecordsInDateRange(startDate, endDate)
      ]);

      setPatrolRounds(patrolData);
      setDiaperChangeRecords(diaperData);
      setRestraintObservationRecords(restraintData);
      setPositionChangeRecords(positionData);
    } catch (error) {
      console.error('載入護理記錄失敗:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // 當週期改變時重新加載數據
  useEffect(() => {
    if (weekDateStrings.length > 0) {
      const startDate = weekDateStrings[0];
      const endDate = weekDateStrings[weekDateStrings.length - 1];
      loadCareRecordsForWeek(startDate, endDate);
    }
  }, [weekDateStrings]);

  const handleNextWeek = () => {
    const nextWeek = new Date(weekStartDate);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setWeekStartDate(nextWeek);
  };

  const handleCurrentWeek = () => {
    setWeekStartDate(getWeekStartDate());
  };

  const goToPreviousPatient = () => {
    const currentIndex = sortedActivePatients.findIndex(p => p.院友id.toString() === selectedPatientId);
    if (currentIndex > 0) {
      setSelectedPatientId(sortedActivePatients[currentIndex - 1].院友id.toString());
    } else if (sortedActivePatients.length > 0) {
      setSelectedPatientId(sortedActivePatients[sortedActivePatients.length - 1].院友id.toString());
    }
  };

  const goToNextPatient = () => {
    const currentIndex = sortedActivePatients.findIndex(p => p.院友id.toString() === selectedPatientId);
    if (currentIndex < sortedActivePatients.length - 1 && currentIndex !== -1) {
      setSelectedPatientId(sortedActivePatients[currentIndex + 1].院友id.toString());
    } else if (sortedActivePatients.length > 0) {
      setSelectedPatientId(sortedActivePatients[0].院友id.toString());
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  const handleAddTab = async (tabType: TabType) => {
    if (!selectedPatient) return;

    const newTab = await addPatientCareTab(selectedPatient.院友id, tabType);
    if (newTab) {
      setPatientCareTabs(prev => [...prev.filter(t => t.id !== newTab.id), newTab]);
      setActiveTab(tabType);
    }
    setShowAddTabMenu(false);
  };

  const handleRemoveTab = async (tabType: TabType) => {
    if (!selectedPatient || tabType === 'patrol') return;

    const tabToRemove = patientCareTabs.find(
      t => t.patient_id === selectedPatient.院友id && t.tab_type === tabType
    );

    if (!tabToRemove) return;

    const hasRecords =
      (tabType === 'diaper' && diaperChangeRecords.some(r => r.patient_id === selectedPatient.院友id)) ||
      (tabType === 'restraint' && restraintObservationRecords.some(r => r.patient_id === selectedPatient.院友id)) ||
      (tabType === 'position' && positionChangeRecords.some(r => r.patient_id === selectedPatient.院友id)) ||
      (tabType === 'patrol' && patrolRounds.some(r => r.patient_id === selectedPatient.院友id));

    const confirmMessage = hasRecords
      ? `該選項卡有記錄，刪除後選項卡將隱藏但記錄仍保留，確定要刪除嗎？`
      : `確定要刪除此選項卡嗎？`;

    if (!window.confirm(confirmMessage)) return;

    const success = await hidePatientCareTab(tabToRemove.id);
    if (success) {
      setPatientCareTabs(prev => prev.filter(t => t.id !== tabToRemove.id));
      if (activeTab === tabType) {
        setActiveTab('patrol');
      }
    }
  };

  const handleCellClick = (date: string, timeSlot: string, existingRecord?: any) => {
    if (!selectedPatient) return;

    setModalDate(date);
    setModalTimeSlot(timeSlot);
    setModalExistingRecord(existingRecord || null);

    switch (activeTab) {
      case 'patrol':
        setShowPatrolModal(true);
        break;
      case 'diaper':
        setShowDiaperModal(true);
        break;
      case 'restraint':
        setShowRestraintModal(true);
        break;
      case 'position':
        setShowPositionModal(true);
        break;
    }
  };

  const handlePatrolSubmit = async (data: Omit<PatrolRound, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (modalExistingRecord) {
        await db.updatePatrolRound({ ...modalExistingRecord, ...data });
      } else {
        await db.createPatrolRound(data);
      }
      setShowPatrolModal(false);
      setModalExistingRecord(null);
      // 靜默重新加載當前週數據，避免畫面閃爍
      await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
    } catch (error) {
      console.error('❌ 巡房記錄操作失敗:', error);
    }
  };

  const handleDiaperSubmit = async (data: Omit<DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (modalExistingRecord) {
        await db.updateDiaperChangeRecord({ ...modalExistingRecord, ...data });
      } else {
        await db.createDiaperChangeRecord(data);
      }
      setShowDiaperModal(false);
      setModalExistingRecord(null);
      // 靜默重新加載當前週數據，避免畫面閃爍
      await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
    } catch (error) {
      console.error('❌ 保存換片記錄失敗:', error);
    }
  };

  const handleRestraintSubmit = async (data: Omit<RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (modalExistingRecord) {
        await db.updateRestraintObservationRecord({ ...modalExistingRecord, ...data });
      } else {
        await db.createRestraintObservationRecord(data);
      }
      setShowRestraintModal(false);
      setModalExistingRecord(null);
      // 靜默重新加載當前週數據，避免畫面閃爍
      await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
    } catch (error) {
      console.error('❌ 保存約束觀察記錄失敗:', error);
    }
  };

  const handlePositionSubmit = async (data: Omit<PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createPositionChangeRecord(data);
      setShowPositionModal(false);
      setModalExistingRecord(null);
      // 靜默重新加載當前週數據，避免畫面閃爍
      await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
    } catch (error) {
      console.error('❌ 創建轉身記錄失敗:', error);
    }
  };

  const renderPatrolTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                時段
              </th>
              {weekDates.map((date) => {
                const d = new Date(date);
                const month = d.getMonth() + 1;
                const dayOfMonth = d.getDate();
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                const weekday = weekdays[d.getDay()];
                return (
                  <th key={date} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
                    {month}/{dayOfMonth}<br/>({weekday})
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {TIME_SLOTS.map((timeSlot) => (
              <tr key={timeSlot} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border">
                  {timeSlot}
                </td>
                {weekDates.map((date, index) => {
                  const dateString = weekDateStrings[index];
                  const record = patientPatrolRounds.find(
                    r => {
                      const match = r.patrol_date === dateString && r.scheduled_time === timeSlot;
                      return match;
                    }
                  );
                  const inHospital = selectedPatient && isInHospital(selectedPatient, dateString, timeSlot, admissionRecords, hospitalEpisodes);

                  return (
                    <td
                      key={dateString}
                      className={`px-2 py-3 text-center text-sm border cursor-pointer ${
                        inHospital ? 'bg-gray-100' :
                        record ? 'bg-green-50 hover:bg-green-100' :
                        'hover:bg-blue-50'
                      }`}
                      onClick={() => !inHospital && handleCellClick(dateString, timeSlot, record)}
                    >
                      {inHospital ? (
                        <span className="text-gray-500">入院</span>
                      ) : record ? (
                        <div>
                          <div className="text-green-600 font-bold">✓</div>
                          <div className="text-xs text-gray-600">{record.recorder}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">待巡</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDiaperTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                時段
              </th>
              {weekDates.map((date) => {
                const d = new Date(date);
                const month = d.getMonth() + 1;
                const dayOfMonth = d.getDate();
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                const weekday = weekdays[d.getDay()];
                return (
                  <th key={date} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
                    {month}/{dayOfMonth}<br/>({weekday})
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {DIAPER_CHANGE_SLOTS.map((slot) => (
              <tr key={slot.time} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border">
                  <div>{slot.label}</div>
                  <div className="text-xs text-gray-500">{slot.time}</div>
                </td>
                {weekDates.map((date, index) => {
                  const dateString = weekDateStrings[index];
                  const record = patientDiaperChanges.find(
                    r => r.change_date === dateString && r.time_slot === slot.time
                  );
                  const timeStr = slot.time.split('-')[0];
                  const inHospital = selectedPatient && isInHospital(selectedPatient, dateString, timeStr, admissionRecords, hospitalEpisodes);

                  return (
                    <td
                      key={dateString}
                      className={`px-2 py-3 text-center text-sm border cursor-pointer ${
                        inHospital ? 'bg-gray-100' :
                        record ? 'bg-blue-50 hover:bg-blue-100' :
                        'hover:bg-blue-50'
                      }`}
                      onClick={() => !inHospital && handleCellClick(dateString, slot.time, record)}
                    >
                      {inHospital ? (
                        <span className="text-gray-500">入院</span>
                      ) : record ? (
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">
                            {record.has_urine && '小便'}
                            {record.has_urine && record.has_stool && '/'}
                            {record.has_stool && '大便'}
                            {record.has_none && '無'}
                          </div>
                          {record.has_urine && record.urine_amount && (
                            <div className="text-xs text-gray-600">小便: {record.urine_amount}</div>
                          )}
                          {record.has_stool && (
                            <div className="text-xs text-gray-600">
                              大便: {record.stool_color || ''}{record.stool_texture ? ` ${record.stool_texture}` : ''}{record.stool_amount ? ` ${record.stool_amount}` : ''}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">{record.recorder}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">待記錄</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderRestraintTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                時段
              </th>
              {weekDates.map((date) => {
                const d = new Date(date);
                const month = d.getMonth() + 1;
                const dayOfMonth = d.getDate();
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                const weekday = weekdays[d.getDay()];
                return (
                  <th key={date} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
                    {month}/{dayOfMonth}<br/>({weekday})
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {TIME_SLOTS.map((timeSlot) => (
              <tr key={timeSlot} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border">
                  {timeSlot}
                </td>
                {weekDates.map((date, index) => {
                  const dateString = weekDateStrings[index];
                  const record = patientRestraintObservations.find(
                    r => r.observation_date === dateString && r.scheduled_time === timeSlot
                  );
                  const inHospital = selectedPatient && isInHospital(selectedPatient, dateString, timeSlot, admissionRecords, hospitalEpisodes);

                  return (
                    <td
                      key={dateString}
                      className={`px-2 py-3 text-center text-sm border cursor-pointer ${
                        inHospital ? 'bg-gray-100' :
                        record ? (
                          record.observation_status === 'N' ? 'bg-green-50 hover:bg-green-100' :
                          record.observation_status === 'P' ? 'bg-red-50 hover:bg-red-100' :
                          'bg-orange-50 hover:bg-orange-100'
                        ) :
                        'hover:bg-blue-50'
                      }`}
                      onClick={() => !inHospital && handleCellClick(dateString, timeSlot, record)}
                    >
                      {inHospital ? (
                        <span className="text-gray-500">入院</span>
                      ) : record ? (
                        <div>
                          <div className={`font-bold ${
                            record.observation_status === 'N' ? 'text-green-600' :
                            record.observation_status === 'P' ? 'text-red-600' :
                            'text-orange-600'
                          }`}>
                            {record.observation_status === 'N' ? '🟢N' :
                             record.observation_status === 'P' ? '🔴P' : '🟠S'}
                          </div>
                          <div className="text-xs text-gray-600">{record.recorder}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">待觀察</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPositionTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                時段
              </th>
              {weekDates.map((date) => {
                const d = new Date(date);
                const month = d.getMonth() + 1;
                const dayOfMonth = d.getDate();
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                const weekday = weekdays[d.getDay()];
                return (
                  <th key={date} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
                    {month}/{dayOfMonth}<br/>({weekday})
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {TIME_SLOTS.map((timeSlot, index) => (
              <tr key={timeSlot} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border">
                  {timeSlot}
                </td>
                {weekDates.map((date, dateIndex) => {
                  const dateString = weekDateStrings[dateIndex];
                  const record = patientPositionChanges.find(
                    r => r.change_date === dateString && r.scheduled_time === timeSlot
                  );
                  const inHospital = selectedPatient && isInHospital(selectedPatient, dateString, timeSlot, admissionRecords, hospitalEpisodes);
                  const expectedPosition = getPositionSequence(index);

                  return (
                    <td
                      key={dateString}
                      className={`px-2 py-3 text-center text-sm border cursor-pointer ${
                        inHospital ? 'bg-gray-100' :
                        record ? 'bg-purple-50 hover:bg-purple-100' :
                        'hover:bg-blue-50'
                      }`}
                      onClick={() => !inHospital && handleCellClick(dateString, timeSlot, record)}
                    >
                      {inHospital ? (
                        <span className="text-gray-500">入院</span>
                      ) : record ? (
                        <div>
                          <div className="font-medium text-purple-600">{record.position}</div>
                          <div className="text-xs text-gray-600">{record.recorder}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">[{expectedPosition}]</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPlaceholder = (tabName: string) => {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-gray-500">
          <p className="text-lg">{tabName}功能開發中</p>
          <p className="text-sm mt-2">敬請期待</p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky Heading 區域 */}
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <ClipboardCheck className="h-7 w-7 text-blue-600" />
            <span>護理記錄</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={goToPreviousPatient}
              disabled={sortedActivePatients.length <= 1}
              className="btn-secondary flex items-center space-x-1"
              title="上一位院友"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>上一位</span>
            </button>
            <button
              onClick={goToNextPatient}
              disabled={sortedActivePatients.length <= 1}
              className="btn-secondary flex items-center space-x-1"
              title="下一位院友"
            >
              <span>下一位</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={handlePreviousWeek}
              className="btn-secondary flex items-center space-x-1"
              title="上一週"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>上週</span>
            </button>
            <button
              onClick={handleNextWeek}
              className="btn-secondary flex items-center space-x-1"
              title="下一週"
            >
              <span>下週</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1])}
              className="btn-secondary flex items-center space-x-1"
              title="重新載入"
            >
              <RefreshCw className="h-4 w-4" />
              <span>重新整理</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky 搜索和選擇區域 */}
      <div className="sticky top-16 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-700">選擇院友</label>
              <div className="flex items-center space-x-2">
                <div className="flex-1 min-w-0">
                  <PatientAutocomplete
                    value={selectedPatientId}
                    onChange={setSelectedPatientId}
                    placeholder="搜尋院友..."
                    showResidencyFilter={true}
                    defaultResidencyStatus="在住"
                  />
                </div>
              </div>
              {sortedActivePatients.length > 0 && (
                <div className="text-sm text-gray-600 text-center lg:text-left">
                  第 {sortedActivePatients.findIndex(p => p.院友id.toString() === selectedPatientId) + 1} / {sortedActivePatients.length} 位院友
                  {selectedPatient && (
                    <span className="ml-2 text-blue-600">
                      (床號: {selectedPatient.床號})
                    </span>
                  )}
                </div>
              )}
            </div>

            {selectedPatient && (
              <div className="lg:w-80 border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-4">
                <label className="text-sm font-medium text-gray-700 block mb-2">院友資訊</label>
                <div className="flex items-start space-x-3">
                  {selectedPatient.院友相片 ? (
                    <img
                      src={selectedPatient.院友相片}
                      alt={selectedPatient.中文姓名}
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="h-10 w-10 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-semibold text-gray-900">
                      {selectedPatient.中文姓名} ({selectedPatient.性別})
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedPatient.出生日期 && (
                        <div>{calculateAge(selectedPatient.出生日期)}歲</div>
                      )}
                      {selectedPatient.出生日期 && (
                        <div>{new Date(selectedPatient.出生日期).toLocaleDateString('zh-TW')}</div>
                      )}
                      <div>{selectedPatient.身份證號碼}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPatientId && (
        <>
          <div className="card">
            <div className="flex flex-wrap lg:flex-nowrap items-start justify-between gap-4 p-4 border-b border-gray-200">
              <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                {visibleTabTypes.map(tabType => {
                  const tabConfig = {
                    patrol: { icon: ClipboardCheck, label: '巡房記錄' },
                    diaper: { icon: Baby, label: '換片記錄' },
                    intake_output: { icon: Droplets, label: '出入量記錄' },
                    restraint: { icon: Shield, label: '約束觀察' },
                    position: { icon: RotateCcw, label: '轉身記錄' },
                    toilet_training: { icon: GraduationCap, label: '如廁訓練' }
                  }[tabType];

                  const Icon = tabConfig.icon;

                  return (
                    <div key={tabType} className="relative group">
                      <button
                        onClick={() => setActiveTab(tabType)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center space-x-2 ${
                          activeTab === tabType
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tabConfig.label}</span>
                      </button>
                      {tabType !== 'patrol' && (
                        <button
                          onClick={() => handleRemoveTab(tabType)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex hover:bg-red-600"
                          title="刪除此選項卡"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="relative">
                  <button
                    onClick={() => setShowAddTabMenu(!showAddTabMenu)}
                    className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center space-x-1 text-gray-600 hover:bg-gray-100 border-2 border-dashed border-gray-300"
                    title="添加選項卡"
                  >
                    <Plus className="h-4 w-4" />
                    <span>添加</span>
                  </button>

                  {showAddTabMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[150px]">
                      {(['diaper', 'intake_output', 'restraint', 'position', 'toilet_training'] as TabType[])
                        .filter(tabType => !visibleTabTypes.includes(tabType))
                        .map(tabType => {
                          const labels = {
                            diaper: '換片記錄',
                            intake_output: '出入量記錄',
                            restraint: '約束觀察',
                            position: '轉身記錄',
                            toilet_training: '如廁訓練'
                          };

                          return (
                            <button
                              key={tabType}
                              onClick={() => handleAddTab(tabType)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                            >
                              {labels[tabType]}
                            </button>
                          );
                        })}
                      {(['diaper', 'intake_output', 'restraint', 'position', 'toilet_training'] as TabType[])
                        .filter(tabType => !visibleTabTypes.includes(tabType)).length === 0 && (
                        <div className="px-4 py-2 text-sm text-gray-500">
                          所有選項卡已添加
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePreviousWeek}
                    className="btn-secondary flex items-center space-x-1 px-3 py-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>上週</span>
                  </button>
                  <button
                    onClick={handleCurrentWeek}
                    className="btn-primary px-4 py-2"
                  >
                    本週
                  </button>
                  <button
                    onClick={handleNextWeek}
                    className="btn-secondary flex items-center space-x-1 px-3 py-2"
                  >
                    <span>下週</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-sm text-gray-600">
                  📅 {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
                </div>
              </div>
            </div>

            <div className="p-4">
              {activeTab === 'patrol' && renderPatrolTable()}
              {activeTab === 'diaper' && renderDiaperTable()}
              {activeTab === 'intake_output' && renderPlaceholder('出入量記錄')}
              {activeTab === 'restraint' && renderRestraintTable()}
              {activeTab === 'position' && renderPositionTable()}
              {activeTab === 'toilet_training' && renderPlaceholder('如廁訓練記錄')}
            </div>
          </div>
        </>
      )}

      {showPatrolModal && selectedPatient && (
        <PatrolRoundModal
          key={modalExistingRecord?.id || `new-patrol-${modalDate}-${modalTimeSlot}`}
          patient={selectedPatient}
          date={modalDate}
          timeSlot={modalTimeSlot}
          staffName={displayName}
          existingRecord={modalExistingRecord}
          onClose={() => { setShowPatrolModal(false); setModalExistingRecord(null); }}
          onSubmit={handlePatrolSubmit}
          onDelete={async (id) => {
            try {
              await db.deletePatrolRound(id);
              setShowPatrolModal(false);
              setModalExistingRecord(null);
              // 立即從本地狀態中移除記錄
              setPatrolRounds(prev => prev.filter(r => r.id !== id));
              // 在背景静默重新加載以確保同步（不顯示 loading 動畫）
              await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
            } catch (error) {
              console.error('❌ 刪除巡房記錄失敗:', error);
              alert('刪除巡房記錄失敗，請重試');
            }
          }}
        />
      )}

      {showDiaperModal && selectedPatient && (
        <DiaperChangeModal
          key={modalExistingRecord?.id || `new-diaper-${modalDate}-${modalTimeSlot}`}
          patient={selectedPatient}
          date={modalDate}
          timeSlot={modalTimeSlot}
          staffName={displayName}
          existingRecord={modalExistingRecord}
          onClose={() => { setShowDiaperModal(false); setModalExistingRecord(null); }}
          onSubmit={handleDiaperSubmit}
          onDelete={async (id) => {
            try {
              await db.deleteDiaperChangeRecord(id);
              setShowDiaperModal(false);
              setModalExistingRecord(null);
              // 立即從本地狀態中移除記錄
              setDiaperChangeRecords(prev => prev.filter(r => r.id !== id));
              // 在背景静默重新加載以確保同步（不顯示 loading 動畫）
              await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
            } catch (error) {
              console.error('❌ 刪除換片記錄失敗:', error);
              alert('刪除換片記錄失敗，請重試');
            }
          }}
        />
      )}

      {showRestraintModal && selectedPatient && (
        <RestraintObservationModal
          key={modalExistingRecord?.id || `new-restraint-${modalDate}-${modalTimeSlot}`}
          patient={selectedPatient}
          date={modalDate}
          timeSlot={modalTimeSlot}
          staffName={displayName}
          existingRecord={modalExistingRecord}
          restraintAssessments={patientRestraintAssessments}
          onClose={() => { setShowRestraintModal(false); setModalExistingRecord(null); }}
          onSubmit={handleRestraintSubmit}
          onDelete={async (id) => {
            try {
              await db.deleteRestraintObservationRecord(id);
              setShowRestraintModal(false);
              setModalExistingRecord(null);
              // 立即從本地狀態中移除記錄
              setRestraintObservationRecords(prev => prev.filter(r => r.id !== id));
              // 在背景静默重新加載以確保同步（不顯示 loading 動畫）
              await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
            } catch (error) {
              console.error('❌ 刪除約束觀察記錄失敗:', error);
              alert('刪除約束觀察記錄失敗，請重試');
            }
          }}
        />
      )}

      {showPositionModal && selectedPatient && (
        <PositionChangeModal
          key={modalExistingRecord?.id || `new-position-${modalDate}-${modalTimeSlot}`}
          patient={selectedPatient}
          date={modalDate}
          timeSlot={modalTimeSlot}
          staffName={displayName}
          existingRecord={modalExistingRecord}
          onClose={() => { setShowPositionModal(false); setModalExistingRecord(null); }}
          onSubmit={handlePositionSubmit}
          onDelete={async (id) => {
            try {
              await db.deletePositionChangeRecord(id);
              setShowPositionModal(false);
              setModalExistingRecord(null);
              // 立即從本地狀態中移除記錄
              setPositionChangeRecords(prev => prev.filter(r => r.id !== id));
              // 在背景静默重新加載以確保同步（不顯示 loading 動畫）
              await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
            } catch (error) {
              console.error('❌ 刪除轉身記錄失敗:', error);
              alert('刪除轉身記錄失敗，請重試');
            }
          }}
        />
      )}
    </div>
  );
};

export default CareRecords;
