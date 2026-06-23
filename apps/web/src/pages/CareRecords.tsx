import React, { useState, useEffect, useMemo } from 'react';
import { LoadingScreen } from '../components/PageLoadingScreen';
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
  X,
  FileText
} from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from '../components/PatientAutocomplete';
import PatrolRoundModal from '../components/PatrolRoundModal';
import DiaperChangeModal from '../components/DiaperChangeModal';
import RestraintObservationModal from '../components/RestraintObservationModal';
import PositionChangeModal from '../components/PositionChangeModal';
import HygieneModal from '../components/HygieneModal';
import IntakeOutputModal from '../components/IntakeOutputModal';
import {
  TIME_SLOTS,
  DIAPER_CHANGE_SLOTS,
  INTAKE_OUTPUT_SLOTS,
  generateWeekDates,
  getWeekStartDate,
  formatDate,
  isInHospital,
  getPositionSequence
} from '../utils/careRecordHelper';
import type { Patient, PatrolRound, DiaperChangeRecord, RestraintObservationRecord, PositionChangeRecord, HygieneRecord, IntakeOutputRecord, PatientCareTab } from '../lib/database';
import * as db from '../lib/database';
import { supabase } from '../lib/supabase';
import {
  loadPatientCareTabs,
  initializePatientCareTabs,
  addPatientCareTab,
  hidePatientCareTab,
  getVisibleTabTypes
} from '../utils/careTabsHelper';
import { exportRestraintObservationHtml } from '../utils/restraintObservationHtmlExporter';
import { exportDiaperRecordHtml } from '../utils/diaperRecordHtmlExporter';
import { exportHygieneRecordHtml } from '../utils/hygieneRecordHtmlExporter';
type TabType = 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training' | 'hygiene';
// 衛生記錄項目配置（16項：備註 + 11護理項目 + 4大便項目）
type HygieneItemConfig = {
  key: string;
  label: string;
  isStatus?: boolean;
  isBowelCount?: boolean;
  isBowelAmount?: boolean;
  isBowelConsistency?: boolean;
  isBowelMedication?: boolean;
};
const HYGIENE_ITEMS: HygieneItemConfig[] = [
  { key: 'status_notes', label: '備註', isStatus: true },
  { key: 'has_bath', label: '沐浴' },
  { key: 'has_face_wash', label: '洗面' },
  { key: 'has_shave', label: '剃鬚' },
  { key: 'has_oral_care', label: '洗牙漱口' },
  { key: 'has_denture_care', label: '洗口受假牙' },
  { key: 'has_nail_trim', label: '剪指甲' },
  { key: 'has_bedding_change', label: '換被套' },
  { key: 'has_sheet_pillow_change', label: '換床單枕袋' },
  { key: 'has_cup_wash', label: '洗杯' },
  { key: 'has_bedside_cabinet', label: '整理床頭櫃' },
  { key: 'has_wardrobe', label: '整理衣箱' },
  { key: 'bowel_count', label: '大便次數', isBowelCount: true },
  { key: 'bowel_amount', label: '大便量', isBowelAmount: true },
  { key: 'bowel_consistency', label: '大便性質', isBowelConsistency: true },
  { key: 'bowel_medication', label: '大便藥', isBowelMedication: true },
];
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
  const [hygieneRecords, setHygieneRecords] = useState<HygieneRecord[]>([]);
  const [intakeOutputRecords, setIntakeOutputRecords] = useState<IntakeOutputRecord[]>([]);
  const { user } = useAuth();
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '未知';
  const [activeTab, setActiveTab] = useState<TabType>('patrol');
  const [weekStartDate, setWeekStartDate] = useState(getWeekStartDate());
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [showPatrolModal, setShowPatrolModal] = useState(false);
  const [showDiaperModal, setShowDiaperModal] = useState(false);
  const [showRestraintModal, setShowRestraintModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [showHygieneModal, setShowHygieneModal] = useState(false);
  const [showIntakeOutputModal, setShowIntakeOutputModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [modalTimeSlot, setModalTimeSlot] = useState('');
  const [modalExistingRecord, setModalExistingRecord] = useState<any>(null);
  const [patientCareTabs, setPatientCareTabs] = useState<PatientCareTab[]>([]);
  const [showAddTabMenu, setShowAddTabMenu] = useState(false);
  const [restraintExportStartDate, setRestraintExportStartDate] = useState<string>('');
  const [diaperExportStartDate, setDiaperExportStartDate] = useState<string>('');
  const [hygieneExportMonth, setHygieneExportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
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
      positionChangeRecords,
      hygieneRecords
    ) as TabType[];
  }, [selectedPatient, patientCareTabs, patrolRounds, diaperChangeRecords, restraintObservationRecords, positionChangeRecords, hygieneRecords]);
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
  const patientHygieneRecords = useMemo(() => {
    if (!selectedPatientId) return [];
    const patientIdNum = parseInt(selectedPatientId);
    const filtered = hygieneRecords.filter(r => r.patient_id === patientIdNum);
    return filtered;
  }, [selectedPatientId, hygieneRecords]);
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
      const [patrolData, diaperData, restraintData, positionData, hygieneData, intakeOutputData] = await Promise.all([
        db.getPatrolRoundsInDateRange(startDate, endDate),
        db.getDiaperChangeRecordsInDateRange(startDate, endDate),
        db.getRestraintObservationRecordsInDateRange(startDate, endDate),
        db.getPositionChangeRecordsInDateRange(startDate, endDate),
        db.getHygieneRecordsInDateRange(startDate, endDate).catch(() => []), // 如果衛生記錄表不存在，返回空數組
        db.getIntakeOutputRecords().catch(() => []) // 出入量記錄
      ]);
      setPatrolRounds(patrolData);
      setDiaperChangeRecords(diaperData);
      setRestraintObservationRecords(restraintData);
      setPositionChangeRecords(positionData);
      setHygieneRecords(hygieneData);
      setIntakeOutputRecords(intakeOutputData.filter((r: IntakeOutputRecord) => 
        r.record_date >= startDate && r.record_date <= endDate
      ));
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
      (tabType === 'hygiene' && hygieneRecords.some(r => r.patient_id === selectedPatient.院友id));
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
      case 'hygiene':
        setShowHygieneModal(true);
        break;
      case 'intake_output':
        setShowIntakeOutputModal(true);
        break;
    }
  };
  // 衛生記錄：inline toggle護理項目
  const toggleHygieneCareItem = async (date: string, itemKey: string, currentValue: boolean) => {
    if (!selectedPatient) return;
    try {
      const existingRecord = hygieneRecords.find(r => r.record_date === date && r.patient_id === selectedPatient.院友id);
      if (existingRecord) {
        const updated = await db.updateHygieneRecord(existingRecord.id, {
          [itemKey]: !currentValue,
        });
        if (updated) {
          setHygieneRecords(prev => prev.map(r => r.id === existingRecord.id ? updated : r));
        }
      } else {
        const newRecord = await db.createHygieneRecord({
          patient_id: selectedPatient.院友id,
          record_date: date,
          time_slot: 'daily',
          has_bath: itemKey === 'has_bath',
          has_face_wash: itemKey === 'has_face_wash',
          has_shave: itemKey === 'has_shave',
          has_oral_care: itemKey === 'has_oral_care',
          has_denture_care: itemKey === 'has_denture_care',
          has_haircut: itemKey === 'has_haircut',
          has_nail_trim: itemKey === 'has_nail_trim',
          has_bedding_change: itemKey === 'has_bedding_change',
          has_sheet_pillow_change: itemKey === 'has_sheet_pillow_change',
          has_cup_wash: itemKey === 'has_cup_wash',
          has_bedside_cabinet: itemKey === 'has_bedside_cabinet',
          has_wardrobe: itemKey === 'has_wardrobe',
          bowel_count: null,
          bowel_amount: null,
          bowel_consistency: null,
          bowel_medication: null,
          recorder: displayName,
        });
        if (newRecord) {
          setHygieneRecords(prev => [...prev, newRecord]);
        }
      }
    } catch (error) {
      console.error('Toggle hygiene care item failed:', error);
    }
  };
  // 衛生記錄：更新備註狀態（入院/渡假/外出） - 下拉選單版本
  const updateHygieneStatus = async (date: string, status: string, e: any) => {
    e.stopPropagation();
    if (!selectedPatient) return;
    try {
      const existingRecord = hygieneRecords.find(r => r.record_date === date && r.patient_id === selectedPatient.院友id);
      // 準備更新數據：當選擇入院/渡假/外出時，清空所有其他欄位
      const updates: any = { status_notes: status || null };
      if (status) {
        // 選擇了入院/渡假/外出，清空所有護理項目和大便欄位
        updates.has_bath = false;
        updates.has_face_wash = false;
        updates.has_shave = false;
        updates.has_oral_care = false;
        updates.has_denture_care = false;
        updates.has_nail_trim = false;
        updates.has_bedding_change = false;
        updates.has_sheet_pillow_change = false;
        updates.has_cup_wash = false;
        updates.has_bedside_cabinet = false;
        updates.has_wardrobe = false;
        updates.bowel_count = null;
        updates.bowel_amount = null;
        updates.bowel_consistency = null;
        updates.bowel_medication = null;
      }
      if (existingRecord) {
        const updated = await db.updateHygieneRecord(existingRecord.id, updates);
        if (updated) {
          setHygieneRecords(prev => prev.map(r => r.id === existingRecord.id ? updated : r));
        }
      } else if (status) {
        // 只有選擇非空值時才創建新記錄
        const newRecord = await db.createHygieneRecord({
          patient_id: selectedPatient.院友id,
          record_date: date,
          time_slot: 'daily',
          has_bath: false,
          has_face_wash: false,
          has_shave: false,
          has_oral_care: false,
          has_denture_care: false,
          has_haircut: false,
          has_nail_trim: false,
          has_bedding_change: false,
          has_sheet_pillow_change: false,
          has_cup_wash: false,
          has_bedside_cabinet: false,
          has_wardrobe: false,
          bowel_count: null,
          bowel_amount: null,
          bowel_consistency: null,
          bowel_medication: null,
          status_notes: status,
          recorder: displayName,
        });
        if (newRecord) {
          setHygieneRecords(prev => [...prev, newRecord]);
        }
      }
    } catch (error) {
      console.error('Update hygiene status failed:', error);
    }
  };
  // 衛生記錄：更新大便欄位（次數/量/性質/藥）
  const updateHygieneBowel = async (date: string, field: string, value: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedPatient) return;
    try {
      const existingRecord = hygieneRecords.find(r => r.record_date === date && r.patient_id === selectedPatient.院友id);
      if (existingRecord) {
        const updated = await db.updateHygieneRecord(existingRecord.id, {
          [field]: value,
        });
        if (updated) {
          setHygieneRecords(prev => prev.map(r => r.id === existingRecord.id ? updated : r));
        }
      } else {
        const newRecord = await db.createHygieneRecord({
          patient_id: selectedPatient.院友id,
          record_date: date,
          time_slot: 'daily',
          has_bath: false,
          has_face_wash: false,
          has_shave: false,
          has_oral_care: false,
          has_denture_care: false,
          has_haircut: false,
          has_nail_trim: false,
          has_bedding_change: false,
          has_sheet_pillow_change: false,
          has_cup_wash: false,
          has_bedside_cabinet: false,
          has_wardrobe: false,
          bowel_count: field === 'bowel_count' ? value : null,
          bowel_amount: field === 'bowel_amount' ? value : null,
          bowel_consistency: field === 'bowel_consistency' ? value : null,
          bowel_medication: field === 'bowel_medication' ? value : null,
          recorder: displayName,
        });
        if (newRecord) {
          setHygieneRecords(prev => [...prev, newRecord]);
        }
      }
    } catch (error) {
      console.error('Update hygiene bowel failed:', error);
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
  const handleHygieneSubmit = async (data: Omit<HygieneRecord, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (modalExistingRecord) {
        await db.updateHygieneRecord(modalExistingRecord.id, data);
      } else {
        await db.createHygieneRecord(data);
      }
      setShowHygieneModal(false);
      setModalExistingRecord(null);
      // 靜默重新加載當前週數據，避免畫面閃爍
      await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
    } catch (error) {
      console.error('❌ 保存衛生記錄失敗:', error);
    }
  };
  const handleIntakeOutputDelete = async (recordId: string) => {
    try {
      await db.deleteIntakeOutputRecord(recordId);
      setShowIntakeOutputModal(false);
      setModalExistingRecord(null);
      setModalTimeSlot('');
      // 立即從本地狀態中移除記錄
      setIntakeOutputRecords(prev => prev.filter(r => r.id !== recordId));
      // 在背景静默重新加載以確保同步
      await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
    } catch (error) {
      console.error('❌ 刪除出入量記錄失敗:', error);
      alert('刪除出入量記錄失敗，請重試');
    }
  };
  const renderPatrolTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[768px] border-collapse">
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
                  <th key={date.toISOString()} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
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
    return <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[768px] border-collapse">
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
                  <th key={date.toISOString()} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
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
                        record ? (
                          record.notes && ['入院', '渡假', '外出'].includes(record.notes)
                            ? 'bg-orange-50 hover:bg-orange-100'
                            : 'bg-blue-50 hover:bg-blue-100'
                        ) :
                        'hover:bg-blue-50'
                      }`}
                      onClick={() => !inHospital && handleCellClick(dateString, slot.time, record)}
                    >
                      {inHospital ? (
                        <span className="text-gray-500">入院</span>
                      ) : record ? (
                        record.notes && ['入院', '渡假', '外出'].includes(record.notes) ? (
                          <div className="space-y-1">
                            <div className="font-medium text-orange-600">{record.notes}</div>
                            <div className="text-xs text-gray-500">{record.recorder}</div>
                          </div>
                        ) : (
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
                        )
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
      {/* 匯出換片記錄表按鈕 */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">匯出開始日期：</label>
            <input
              type="date"
              value={diaperExportStartDate || weekDateStrings[0]}
              onChange={(e) => setDiaperExportStartDate(e.target.value)}
              className="form-input text-sm px-3 py-2 border border-gray-300 rounded-lg"
            />
            <span className="text-sm text-gray-500">(4天記錄)</span>
          </div>
          <button
            onClick={() => {
              if (!selectedPatient) {
                alert('請先選擇院友');
                return;
              }
              const startDate = diaperExportStartDate || weekDateStrings[0];
              exportDiaperRecordHtml(
                selectedPatient,
                diaperChangeRecords.filter(r => r.patient_id === selectedPatient.院友id),
                startDate
              );
            }}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <FileText className="h-4 w-4" />
            匯出換片記錄表
          </button>
        </div>
      </div>
    </>;
  };
  const renderRestraintTable = () => {
    return <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[768px] border-collapse">
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
                  <th key={date.toISOString()} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
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
                          record.notes && ['入院', '渡假', '外出'].includes(record.notes)
                            ? 'bg-orange-50 hover:bg-orange-100'
                            : record.observation_status === 'N' ? 'bg-green-50 hover:bg-green-100'
                            : record.observation_status === 'P' ? 'bg-red-50 hover:bg-red-100'
                            : 'bg-orange-50 hover:bg-orange-100'
                        ) :
                        'hover:bg-blue-50'
                      }`}
                      onClick={() => !inHospital && handleCellClick(dateString, timeSlot, record)}
                    >
                      {inHospital ? (
                        <span className="text-gray-500">入院</span>
                      ) : record ? (
                        record.notes && ['入院', '渡假', '外出'].includes(record.notes) ? (
                          <div>
                            <div className="font-medium text-orange-600">{record.notes}</div>
                            <div className="text-xs text-gray-500">{record.recorder}</div>
                          </div>
                        ) : (
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
                        )
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
      {/* 匯出約束觀察記錄表按鈕 */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">匯出開始日期：</label>
            <input
              type="date"
              value={restraintExportStartDate || weekDateStrings[0]}
              onChange={(e) => setRestraintExportStartDate(e.target.value)}
              className="form-input text-sm px-3 py-2 border border-gray-300 rounded-lg"
            />
            <span className="text-sm text-gray-500">(4天觀察記錄)</span>
          </div>
          <button
            onClick={() => {
              if (!selectedPatient) {
                alert('請先選擇院友');
                return;
              }
              const startDate = restraintExportStartDate || weekDateStrings[0];
              const assessment = patientRestraintAssessments.find(a => a.patient_id === selectedPatient.院友id);
              exportRestraintObservationHtml(
                selectedPatient,
                restraintObservationRecords.filter(r => r.patient_id === selectedPatient.院友id),
                assessment || null,
                startDate
              );
            }}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <FileText className="h-4 w-4" />
            匯出觀察記錄表
          </button>
        </div>
      </div>
    </>;
  };
  const renderPositionTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[768px] border-collapse">
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
                  <th key={date.toISOString()} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
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
                  const expectedPosition = getPositionSequence(timeSlot);
                  return (
                    <td
                      key={dateString}
                      className={`px-2 py-3 text-center text-sm border cursor-pointer ${
                        inHospital ? 'bg-gray-100' :
                        record ? (
                          record.notes && ['入院', '渡假', '外出'].includes(record.notes)
                            ? 'bg-orange-50 hover:bg-orange-100'
                            : 'bg-purple-50 hover:bg-purple-100'
                        ) :
                        'hover:bg-blue-50'
                      }`}
                      onClick={() => !inHospital && handleCellClick(dateString, timeSlot, record)}
                    >
                      {inHospital ? (
                        <span className="text-gray-500">入院</span>
                      ) : record ? (
                        record.notes && ['入院', '渡假', '外出'].includes(record.notes) ? (
                          <div>
                            <div className="font-medium text-orange-600">{record.notes}</div>
                            <div className="text-xs text-gray-500">{record.recorder}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-purple-600">{record.position}</div>
                            <div className="text-xs text-gray-600">{record.recorder}</div>
                          </div>
                        )
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
  // 出入量記錄渲染函數
  const renderIntakeOutputTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[768px] border-collapse">
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
                  <th key={date.toISOString()} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
                    {month}/{dayOfMonth}<br/>({weekday})
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {INTAKE_OUTPUT_SLOTS.map((slot) => (
              <tr key={slot.time} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border">
                  {slot.label}
                </td>
                {weekDates.map((date, index) => {
                  const dateString = weekDateStrings[index];
                  const hourSlot = parseInt(slot.time.split(':')[0]);
                  const record = intakeOutputRecords.find(
                    r => r.record_date === dateString && (r.hour_slot === hourSlot || r.time_slot === slot.time)
                  );
                  const inHospital = selectedPatient && isInHospital(selectedPatient, dateString, slot.time, admissionRecords, hospitalEpisodes);
                  const statusLabel = record && record.notes && ['入院', '渡假', '外出'].includes(String(record.notes)) ? String(record.notes) : undefined;
                  // 從 intake_items 構建詳細項目列表
                  const intakeDetails: string[] = [];
                  const outputDetails: string[] = [];
                  if (record?.intake_items && record.intake_items.length > 0) {
                    record.intake_items.forEach(item => {
                      if (item.category === 'meal') {
                        intakeDetails.push(`${item.item_type}${item.amount || ''}`);
                      } else if (item.category === 'beverage') {
                        intakeDetails.push(`${item.item_type}${item.amount_numeric || 0}ml`);
                      } else if (item.category === 'tube_feeding') {
                        intakeDetails.push(`${item.item_type}${item.amount_numeric || 0}ml`);
                      } else if (item.category === 'other') {
                        intakeDetails.push(`${item.item_type}${item.amount || ''}`);
                      }
                    });
                  }
                  if (record?.output_items && record.output_items.length > 0) {
                    record.output_items.forEach(item => {
                      if (item.category === 'urine') {
                        if (item.color === '無' || item.amount_ml === 0) {
                          outputDetails.push('無尿');
                        } else {
                          outputDetails.push(`尿(${item.color || ''}) ${item.amount_ml}ml`);
                        }
                      } else if (item.category === 'gastric') {
                        if (item.color === '無' || item.amount_ml === 0) {
                          outputDetails.push('無胃液');
                        } else {
                          const phText = item.ph_value ? ` pH${item.ph_value}` : '';
                          outputDetails.push(`胃液(${item.color || ''})${phText} ${item.amount_ml}ml`);
                        }
                      }
                    });
                  }
                  return (
                    <td
                      key={dateString}
                      className={`px-2 py-3 text-center text-sm border cursor-pointer ${
                        inHospital ? 'bg-gray-100' :
                        record ? (
                          statusLabel
                            ? 'bg-orange-50 hover:bg-orange-100'
                            : 'bg-blue-50 hover:bg-blue-100'
                        ) :
                        'hover:bg-blue-50'
                      }`}
                      onClick={() => !inHospital && handleCellClick(dateString, slot.time, record)}
                    >
                      {inHospital ? (
                        <span className="text-gray-500">入院</span>
                      ) : record ? (
                        statusLabel ? (
                          <div className="space-y-1">
                            <div className="font-medium text-orange-600">{statusLabel}</div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {intakeDetails.length > 0 && (
                              <div className="text-xs text-green-600 truncate" title={intakeDetails.join('、')}>
                                ▲ {intakeDetails.join('、')}
                              </div>
                            )}
                            {outputDetails.length > 0 && (
                              <div className="text-xs text-red-600 truncate" title={outputDetails.join('、')}>
                                ▼ {outputDetails.join('、')}
                              </div>
                            )}
                          </div>
                        )
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
  const renderHygieneTable = () => {
    // 檢查該院友是否有換片記錄選項卡（而不是檢查是否有實際的換片記錄數據）
    const hasDiaperTab = visibleTabTypes.includes('diaper');
    // 調試：輸出換片記錄信息
    if (selectedPatient) {
    }
    return (
      <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[768px] border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                項目 \ 日期
              </th>
              {weekDates.map((date) => {
                const d = new Date(date);
                const month = d.getMonth() + 1;
                const dayOfMonth = d.getDate();
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                const weekday = weekdays[d.getDay()];
                return (
                  <th key={date.toISOString()} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">
                    {month}/{dayOfMonth}<br/>({weekday})
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white">
            {HYGIENE_ITEMS.map((item) => {
              // 如果該院友有換片記錄選項卡，則4個大便相關項目變成不可選
              const isBowelItem = item.isBowelCount || item.isBowelAmount || item.isBowelConsistency || item.isBowelMedication;
              const bowelItemDisabledByDiaper = hasDiaperTab && isBowelItem;
              // 調試：輸出大便項目信息
              if (isBowelItem && selectedPatient) {
                console.log(`項目 ${item.label}:`, {
                  isBowelItem,
                  hasDiaperTab,
                  bowelItemDisabledByDiaper
                });
              }
              return (
                <tr key={item.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border">
                    {item.label}
                  </td>
                  {weekDates.map((date, dateIndex) => {
                    const dateString = weekDateStrings[dateIndex];
                    const record = patientHygieneRecords.find(
                      r => r.record_date === dateString
                    );
                    const inHospital = selectedPatient && isInHospital(selectedPatient, dateString, 'daily', admissionRecords, hospitalEpisodes);
                    const hasStatusNotes = record?.status_notes && ['入院', '渡假', '外出'].includes(record.status_notes);
                    const isDisabled = Boolean(hasStatusNotes && !item.isStatus) || bowelItemDisabledByDiaper;
                    let cellContent: React.ReactNode = null;
                    let cellClassName = 'px-2 py-3 text-center text-sm border ';
                    if (inHospital) {
                      cellClassName += 'bg-gray-100 text-gray-500';
                      cellContent = <span>入院</span>;
                    } else if (bowelItemDisabledByDiaper) {
                      // 有換片記錄時，大便項目顯示"參閱換片記錄"（優先於其他所有條件）
                      cellClassName += 'bg-gray-100 text-gray-500 cursor-not-allowed';
                      cellContent = <span className="text-xs">參閱換片記錄</span>;
                    } else if (hasStatusNotes && !item.isStatus) {
                      // 當有狀態備註時，其他項目變灰
                      cellClassName += 'bg-gray-200 text-gray-400 cursor-not-allowed';
                      cellContent = <span>-</span>;
                    } else if (item.isStatus) {
                      // 備註行 - 下拉選單
                      cellClassName += 'p-1';
                      cellContent = (
                        <select
                          value={record?.status_notes || ''}
                          onChange={(e) => updateHygieneStatus(dateString, e.target.value, e as any)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- 選擇 --</option>
                          <option value="入院">入院</option>
                          <option value="渡假">渡假</option>
                          <option value="外出">外出</option>
                        </select>
                      );
                    } else if (item.isBowelCount) {
                      // 大便次數行 - inline數字輸入
                      cellClassName += 'p-1';
                      cellContent = (
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={record?.bowel_count ?? ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? null : parseInt(e.target.value);
                            if (value === null || (value >= 0 && value <= 10)) {
                              updateHygieneBowel(dateString, 'bowel_count', value, e as any);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isDisabled}
                          className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0"
                        />
                      );
                    } else if (item.isBowelAmount) {
                      // 大便量行 - 下拉選單
                      cellClassName += 'p-1';
                      cellContent = (
                        <select
                          value={record?.bowel_amount || ''}
                          onChange={(e) => updateHygieneBowel(dateString, 'bowel_amount', e.target.value || null, e as any)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isDisabled}
                        >
                          <option value="">-- 選擇 --</option>
                          <option value="少">少</option>
                          <option value="中">中</option>
                          <option value="多">多</option>
                        </select>
                      );
                    } else if (item.isBowelConsistency) {
                      // 大便性質行 - 下拉選單
                      cellClassName += 'p-1';
                      cellContent = (
                        <select
                          value={record?.bowel_consistency || ''}
                          onChange={(e) => updateHygieneBowel(dateString, 'bowel_consistency', e.target.value || null, e as any)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isDisabled}
                        >
                          <option value="">-- 選擇 --</option>
                          <option value="硬">硬</option>
                          <option value="軟">軟</option>
                          <option value="稀">稀</option>
                          <option value="水狀">水狀</option>
                        </select>
                      );
                    } else if (item.isBowelMedication) {
                      // 大便藥行 - 下拉選單
                      cellClassName += 'p-1';
                      cellContent = (
                        <select
                          value={record?.bowel_medication || ''}
                          onChange={(e) => updateHygieneBowel(dateString, 'bowel_medication', e.target.value || null, e as any)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isDisabled}
                        >
                          <option value="">-- 選擇 --</option>
                          <option value="樂可舒">樂可舒</option>
                          <option value="氧化鎂">氧化鎂</option>
                          <option value="軟便劑">軟便劑</option>
                          <option value="其他">其他</option>
                        </select>
                      );
                    } else {
                      // 護理項目行 - 點擊toggle
                      if (record && (record as any)[item.key]) {
                        cellClassName += 'bg-green-50 hover:bg-green-100 cursor-pointer';
                        cellContent = <div className="font-medium text-green-600">✓</div>;
                      } else {
                        cellClassName += 'hover:bg-blue-50 cursor-pointer';
                        cellContent = <span className="text-gray-400 text-xs">-</span>;
                      }
                    }
                    // 護理項目用click toggle
                    const isCareItem = !item.isStatus && !item.isBowelCount && !item.isBowelAmount && !item.isBowelConsistency && !item.isBowelMedication;
                    const handleClick = () => {
                      if (inHospital || isDisabled || !isCareItem) return;
                      toggleHygieneCareItem(dateString, item.key, record ? (record as any)[item.key] : false);
                    };
                    return (
                      <td
                        key={`${item.key}-${dateString}`}
                        className={cellClassName}
                        onClick={handleClick}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 匯出衛生記錄表按鈕 */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">匯出月份：</label>
            <input
              type="month"
              value={hygieneExportMonth}
              onChange={(e) => setHygieneExportMonth(e.target.value)}
              className="form-input text-sm px-3 py-2 border border-gray-300 rounded-lg"
            />
            <span className="text-sm text-gray-500">(整月記錄)</span>
          </div>
          <button
            onClick={async () => {
              if (!selectedPatient) {
                alert('請先選擇院友');
                return;
              }
              const [yearStr, monthStr] = hygieneExportMonth.split('-');
              const year = parseInt(yearStr);
              const month = parseInt(monthStr);
              
              // 計算該月的日期範圍
              const startDate = `${year}-${monthStr}-01`;
              const lastDay = new Date(year, month, 0).getDate();
              const endDate = `${year}-${monthStr}-${lastDay.toString().padStart(2, '0')}`;
              
              try {
                // 從資料庫抓取該月的完整資料
                const monthRecords = await db.getHygieneRecordsInDateRange(startDate, endDate);
                const patientMonthRecords = monthRecords.filter(r => r.patient_id === selectedPatient.院友id);
                
                exportHygieneRecordHtml(
                  selectedPatient,
                  patientMonthRecords,
                  year,
                  month
                );
              } catch (error) {
                console.error('匯出衛生記錄失敗:', error);
                alert('匯出失敗，請稍後再試');
              }
            }}
            className="btn-primary flex items-center gap-2 px-4 py-2"
          >
            <FileText className="h-4 w-4" />
            匯出衛生記錄表
          </button>
        </div>
      </div>
      </>
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
    return <LoadingScreen pageName="護理記錄" />;
  }
  return (
    <div className="space-y-6">
      {/* Sticky Heading 區域 */}
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 flex flex-wrap items-center gap-2">
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
              <div className="flex flex-wrap items-center gap-2">
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
                <div className="flex items-start gap-3">
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
          {/* ── 週選取器（card 之上） ── */}
          <div className="card px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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

          {/* ── Grid 容器（第一張：tab + 表格，橫跨全寬；後續可在此添加更多 card） ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card col-span-full">
              <div className="flex flex-wrap gap-1 p-4 border-b border-gray-200">
                {visibleTabTypes.map(tabType => {
                  const tabConfig = {
                    patrol: { icon: ClipboardCheck, label: '巡房記錄' },
                    diaper: { icon: Baby, label: '換片記錄' },
                    intake_output: { icon: Droplets, label: '出入量記錄' },
                    restraint: { icon: Shield, label: '約束觀察' },
                    position: { icon: RotateCcw, label: '轉身記錄' },
                    toilet_training: { icon: GraduationCap, label: '如廁訓練' },
                    hygiene: { icon: Droplets, label: '衛生記錄' }
                  }[tabType];
                  const Icon = tabConfig.icon;
                  return (
                    <div key={tabType} className="relative group">
                      <button
                        onClick={() => setActiveTab(tabType)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex flex-wrap items-center gap-2 ${
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
                      {(['diaper', 'intake_output', 'restraint', 'position', 'toilet_training', 'hygiene'] as TabType[])
                        .filter(tabType => !visibleTabTypes.includes(tabType))
                        .map(tabType => {
                          const labels: Record<TabType, string> = {
                            patrol: '巡視記錄',
                            diaper: '換片記錄',
                            intake_output: '出入量記錄',
                            restraint: '約束觀察',
                            position: '轉身記錄',
                            toilet_training: '如廁訓練',
                            hygiene: '衛生記錄'
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
                      {(['diaper', 'intake_output', 'restraint', 'position', 'toilet_training', 'hygiene'] as TabType[])
                        .filter(tabType => !visibleTabTypes.includes(tabType)).length === 0 && (
                        <div className="px-4 py-2 text-sm text-gray-500">
                          所有選項卡已添加
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4">
                {activeTab === 'patrol' && renderPatrolTable()}
                {activeTab === 'diaper' && renderDiaperTable()}
                {activeTab === 'intake_output' && renderIntakeOutputTable()}
                {activeTab === 'restraint' && renderRestraintTable()}
                {activeTab === 'position' && renderPositionTable()}
                {activeTab === 'toilet_training' && renderPlaceholder('如廁訓練記錄')}
                {activeTab === 'hygiene' && renderHygieneTable()}
              </div>
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
          allRestraintRecords={restraintObservationRecords}
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
      {showHygieneModal && selectedPatient && (
        <HygieneModal
          key={modalExistingRecord?.id || `new-hygiene-${modalDate}`}
          patient={selectedPatient}
          date={modalDate}
          staffName={displayName}
          existingRecord={modalExistingRecord}
          onClose={() => { setShowHygieneModal(false); setModalExistingRecord(null); }}
          onSubmit={handleHygieneSubmit}
          onDelete={async (id) => {
            try {
              await db.deleteHygieneRecord(id);
              setShowHygieneModal(false);
              setModalExistingRecord(null);
              // 立即從本地狀態中移除記錄
              setHygieneRecords(prev => prev.filter(r => r.id !== id));
              // 在背景静默重新加載以確保同步（不顯示 loading 動畫）
              await loadCareRecordsForWeek(weekDateStrings[0], weekDateStrings[weekDateStrings.length - 1], true);
            } catch (error) {
              console.error('❌ 刪除衛生記錄失敗:', error);
              alert('刪除衛生記錄失敗，請重試');
            }
          }}
        />
      )}
      {showIntakeOutputModal && selectedPatient && modalTimeSlot && (
        <IntakeOutputModal
          key={modalExistingRecord?.id || `new-intake-output-${modalDate}-${modalTimeSlot}`}
          patient={selectedPatient}
          date={modalDate}
          timeSlot={modalTimeSlot}
          staffName={displayName}
          existingRecord={modalExistingRecord}
          onClose={() => {
            setShowIntakeOutputModal(false);
            setModalExistingRecord(null);
            setModalTimeSlot('');
          }}
          onSave={async (record) => {
            // 更新本地狀態
            setIntakeOutputRecords(prev => {
              const existing = prev.find(r => r.id === record.id);
              if (existing) {
                return prev.map(r => r.id === record.id ? record : r);
              } else {
                return [...prev, record];
              }
            });
            setShowIntakeOutputModal(false);
            setModalExistingRecord(null);
            setModalTimeSlot('');
          }}
          onDelete={handleIntakeOutputDelete}
        />
      )}
    </div>
  );
};
export default CareRecords;
