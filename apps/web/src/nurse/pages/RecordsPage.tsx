import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Lock } from 'lucide-react';
import { usePatients } from '../../context/PatientContext';
import { useAuth } from '../../context/AuthContext';
import * as db from '../../lib/database';
import type { Bed, Patient, PatrolRound, DiaperChangeRecord, RestraintObservationRecord, PositionChangeRecord, HygieneRecord, IntakeOutputRecord, PatientCareTab } from '../../lib/database';
import {
  TIME_SLOTS, DIAPER_CHANGE_SLOTS, INTAKE_OUTPUT_SLOTS,
  generateWeekDates, getWeekStartDate, formatDate, isInHospital,
  isSlotOverdue, getActualSlotDate, parseDiaperSlotStartTime,
} from '../../utils/careRecordHelper';
import { loadPatientCareTabs, getVisibleTabTypes } from '../../utils/careTabsHelper';
import NursePatrolRoundModal from '../modals/NursePatrolRoundModal';
import DiaperChangeModal from '../../components/DiaperChangeModal';
import RestraintObservationModal from '../../components/RestraintObservationModal';
import PositionChangeModal from '../../components/PositionChangeModal';
import HygieneModal from '../../components/HygieneModal';
import IntakeOutputModal from '../../components/IntakeOutputModal';
import { t2s, s2t } from '../utils/chinese';

type TabType = 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training' | 'hygiene';

const TAB_CONFIG: Record<TabType, { label: string }> = {
  patrol:          { label: '巡房记录' },
  diaper:          { label: '换片记录' },
  intake_output:   { label: '出入量' },
  restraint:       { label: '约束观察' },
  position:        { label: '转身记录' },
  toilet_training: { label: '如厕训练' },
  hygiene:         { label: '卫生记录' },
};

const LOOKBACK_KEY = 'missingLookbackDays';

interface RecordsPageProps {
  bed: Bed;
  patient: Patient | null;
  onBack: () => void;
  onSelectPatient?: (bed: Bed, patient: Patient | null) => void;
  initialDate?: string;
}

interface ModalState {
  type: TabType;
  date: string;
  timeSlot: string;
  existing: any;
}

const RecordsPage: React.FC<RecordsPageProps> = ({ bed, patient, onBack, onSelectPatient, initialDate }) => {
  const { displayName } = useAuth();
  const { admissionRecords, hospitalEpisodes, patientRestraintAssessments, restraintObservationRecords, beds, patients } = usePatients();

  // ─── Today only view ─────────────────────────────────────────
  const today = new Date();
  const todayStr = formatDate(today);
  
  // Calculate min date (30 days ago)
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - 30);
  const minDateStr = formatDate(minDate);
  
  // Date navigation: default to today, but can be overridden
  const [displayDate, setDisplayDate] = useState(initialDate || todayStr);
  
  const displayDateObj = new Date(displayDate + 'T00:00:00');

  // ─── Tab state ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>('patrol');
  const [patientCareTabs, setPatientCareTabs] = useState<PatientCareTab[]>([]);

  // 計算上一位/下一位院友
  const currentBedIndex = beds.findIndex(b => b.id === bed.id);
  const prevBed = currentBedIndex > 0 ? beds[currentBedIndex - 1] : null;
  const nextBed = currentBedIndex >= 0 && currentBedIndex < beds.length - 1 ? beds[currentBedIndex + 1] : null;

  const handleSelectPrev = () => {
    if (prevBed && onSelectPatient) {
      const prevPatient = patients.find(p => p.床號 === prevBed.bed_number) || null;
      onSelectPatient(prevBed, prevPatient);
    }
  };

  const handleSelectNext = () => {
    if (nextBed && onSelectPatient) {
      const nextPatient = patients.find(p => p.床號 === nextBed.bed_number) || null;
      onSelectPatient(nextBed, nextPatient);
    }
  };

  // 是否缺席（住院）→ 凍結院友相關 tab
  const isAbsent = useMemo(() => {
    if (!patient) return false;
    const todayStr = formatDate(today);
    return isInHospital(patient as any, todayStr, '00:00', admissionRecords, hospitalEpisodes);
  }, [patient, admissionRecords, hospitalEpisodes]);

  // ─── Records data ─────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [patrolRounds,     setPatrolRounds]     = useState<PatrolRound[]>([]);
  const [diaperRecords,    setDiaperRecords]     = useState<DiaperChangeRecord[]>([]);
  const [restraintRecords, setRestraintRecords]  = useState<RestraintObservationRecord[]>([]);
  const [positionRecords,  setPositionRecords]   = useState<PositionChangeRecord[]>([]);
  const [hygieneRecords,   setHygieneRecords]    = useState<HygieneRecord[]>([]);
  const [intakeRecords,    setIntakeRecords]      = useState<IntakeOutputRecord[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load today's data only (but display date might differ)
      const patrol = await db.getPatrolRoundsByBedId(bed.id, displayDate, displayDate, patient?.院友id);
      setPatrolRounds(patrol);

      if (patient) {
        const pid = patient.院友id;
        const [careTabs, diaper, restraint, position, hygiene, intake] = await Promise.all([
          loadPatientCareTabs(pid),
          db.getDiaperChangeRecordsInDateRange(displayDate, displayDate),
          db.getRestraintObservationRecordsInDateRange(displayDate, displayDate),
          db.getPositionChangeRecordsInDateRange(displayDate, displayDate),
          db.getHygieneRecordsInDateRange(displayDate, displayDate),
          db.getIntakeOutputRecordsByPatient(pid, displayDate, displayDate),
        ]);
        setPatientCareTabs(careTabs);
        setDiaperRecords(diaper.filter(r => r.patient_id === pid));
        setRestraintRecords(restraint.filter(r => r.patient_id === pid));
        setPositionRecords(position.filter(r => r.patient_id === pid));
        setHygieneRecords(hygiene.filter(r => r.patient_id === pid));
        setIntakeRecords(intake);
      } else {
        setPatientCareTabs([]);
      }
    } catch (err) {
      console.error('載入護理記錄失敗:', err);
    } finally {
      setLoading(false);
    }
  }, [bed.id, patient, displayDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // 香港時區輔助函數：禁止輸入未來時間
  const nowHK = (): { date: string; time: string } => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    };
  };
  const isFutureDateTime = (dateStr: string, timeStr: string): boolean => {
    const { date, time } = nowHK();
    return dateStr > date || (dateStr === date && timeStr > time);
  };
  const isFutureDate = (dateStr: string): boolean => {
    return dateStr > nowHK().date;
  };

  // ─── Modal ────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalState | null>(null);

  const openCell = useCallback((type: TabType, date: string, timeSlot: string, existing: any) => {
    if (!patient && type !== 'patrol') return;
    if (isAbsent && type !== 'patrol') return; // 缺席凍結
    // 護理員界面禁止輸入未來時間的數據
    if (!existing) {
      if (type === 'hygiene') {
        if (isFutureDate(date)) {
          alert('不可輸入未來日期的數據');
          return;
        }
      } else if (type !== 'toilet_training') {
        const checkTime = type === 'diaper' ? parseDiaperSlotStartTime(timeSlot) : timeSlot;
        if (isFutureDateTime(date, checkTime)) {
          alert('不可輸入未來時間的數據');
          return;
        }
      }
    }
    setModal({ type, date, timeSlot, existing });
  }, [patient, isAbsent]);

  const closeModal = useCallback(() => setModal(null), []);

  // ─── Visible tabs（同 web CareRecords 頁邏輯）────────────────
  const visibleTabs = useMemo<TabType[]>(() => {
    if (!patient) return ['patrol'];
    return getVisibleTabTypes(
      patient.院友id,
      patientCareTabs,
      patrolRounds,
      diaperRecords,
      restraintRecords,
      positionRecords,
      hygieneRecords,
      patientRestraintAssessments,
    ) as TabType[];
  }, [patient, patientCareTabs, patrolRounds, diaperRecords, restraintRecords, positionRecords, hygieneRecords, patientRestraintAssessments]);

  // 若 activeTab 不在 visibleTabs 中，重置為 patrol
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) setActiveTab('patrol');
  }, [visibleTabs]);

  // ─── Lookup helpers ───────────────────────────────────────────
  const getPatrolRecord = (dateStr: string, slot: string) =>
    patrolRounds.find(r => r.patrol_date === dateStr && r.scheduled_time === slot) ?? null;

  const getDiaperRecord = (dateStr: string, slot: string) =>
    diaperRecords.find(r => r.change_date === dateStr && r.time_slot === slot) ?? null;

  const getRestraintRecord = (dateStr: string, slot: string) =>
    restraintRecords.find(r => r.observation_date === dateStr && r.scheduled_time === slot) ?? null;

  const getPositionRecord = (dateStr: string, slot: string) =>
    positionRecords.find(r => r.change_date === dateStr && r.scheduled_time === slot) ?? null;

  const getHygieneRecord = (dateStr: string) =>
    hygieneRecords.find(r => r.record_date === dateStr) ?? null;

  const getIntakeRecord = (dateStr: string, slot: string) =>
    intakeRecords.find(r => r.record_date === dateStr && r.time_slot === slot) ?? null;

  // ─── Slot rows per tab type ───────────────────────────────────
  const slotRows = useMemo(() => {
    switch (activeTab) {
      case 'patrol':        return TIME_SLOTS.map(s => ({ slot: s, label: s }));
      case 'diaper':        return DIAPER_CHANGE_SLOTS.map(s => ({ slot: s.time, label: s.label }));
      case 'intake_output': return INTAKE_OUTPUT_SLOTS.map(s => ({ slot: s.time, label: s.label }));
      case 'restraint':     return TIME_SLOTS.map(s => ({ slot: s, label: s }));
      case 'position':      return TIME_SLOTS.map(s => ({ slot: s, label: s }));
      case 'hygiene':       return [{ slot: 'daily', label: '每日' }];
      default:              return [];
    }
  }, [activeTab]);

  // Check if a cell has a record
  const hasRecord = useCallback((dateStr: string, slot: string): boolean => {
    switch (activeTab) {
      case 'patrol':        return !!getPatrolRecord(dateStr, slot);
      case 'diaper':        return !!getDiaperRecord(dateStr, slot);
      case 'intake_output': return !!getIntakeRecord(dateStr, slot);
      case 'restraint':     return !!getRestraintRecord(dateStr, slot);
      case 'position':      return !!getPositionRecord(dateStr, slot);
      case 'hygiene':       return !!getHygieneRecord(dateStr);
      default:              return false;
    }
  }, [activeTab, patrolRounds, diaperRecords, intakeRecords, restraintRecords, positionRecords, hygieneRecords]);

  const getExisting = useCallback((dateStr: string, slot: string) => {
    switch (activeTab) {
      case 'patrol':        return getPatrolRecord(dateStr, slot);
      case 'diaper':        return getDiaperRecord(dateStr, slot);
      case 'intake_output': return getIntakeRecord(dateStr, slot);
      case 'restraint':     return getRestraintRecord(dateStr, slot);
      case 'position':      return getPositionRecord(dateStr, slot);
      case 'hygiene':       return getHygieneRecord(dateStr);
      default:              return null;
    }
  }, [activeTab, patrolRounds, diaperRecords, intakeRecords, restraintRecords, positionRecords, hygieneRecords]);

  // ─── Submit handlers ──────────────────────────────────────────
  const [saveError, setSaveError] = useState<string | null>(null);

  const wrapSave = async (fn: () => Promise<void>) => {
    setSaveError(null);
    try {
      await fn();
    } catch (err: any) {
      const msg = err?.message || err?.error_description || JSON.stringify(err);
      setSaveError(msg);
      console.error('RecordsPage save error:', err);
    }
  };

  const handlePatrolSubmit = (data: Omit<PatrolRound, 'id' | 'created_at' | 'updated_at'>) =>
    wrapSave(async () => {
      if (isFutureDateTime(data.patrol_date, data.patrol_time)) {
        throw new Error('不可輸入未來時間的數據');
      }
      if (modal?.existing) await db.updatePatrolRound({ ...modal.existing, ...data });
      else await db.createPatrolRound(data);
      closeModal(); loadData();
    });

  const handlePatrolDelete = (id: string) =>
    wrapSave(async () => { await db.deletePatrolRound(id); closeModal(); loadData(); });

  const handleDiaperSubmit = (data: Omit<DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'>) =>
    wrapSave(async () => {
      const converted = { ...data, notes: data.notes ? s2t(data.notes) : data.notes };
      if (modal?.existing) await db.updateDiaperChangeRecord({ ...modal.existing, ...converted });
      else await db.createDiaperChangeRecord(converted);
      closeModal(); loadData();
    });

  const handleDiaperDelete = (id: string) =>
    wrapSave(async () => { await db.deleteDiaperChangeRecord(id); closeModal(); loadData(); });

  const handleRestraintSubmit = (data: any) =>
    wrapSave(async () => {
      if (isFutureDateTime(data.observation_date, data.observation_time)) {
        throw new Error('不可輸入未來時間的數據');
      }
      const converted = { ...data, notes: data.notes ? s2t(data.notes) : data.notes };
      if (modal?.existing) await db.updateRestraintObservationRecord({ ...modal.existing, ...converted });
      else await db.createRestraintObservationRecord(converted);
      closeModal(); loadData();
    });

  const handleRestraintDelete = (id: string) =>
    wrapSave(async () => { await db.deleteRestraintObservationRecord(id); closeModal(); loadData(); });

  const handlePositionSubmit = (data: Omit<PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>) =>
    wrapSave(async () => {
      if (isFutureDateTime(data.change_date, data.scheduled_time)) {
        throw new Error('不可輸入未來時間的數據');
      }
      if (modal?.existing) await db.deletePositionChangeRecord(modal.existing.id);
      await db.createPositionChangeRecord(data);
      closeModal(); loadData();
    });

  const handlePositionDelete = (id: string) =>
    wrapSave(async () => { await db.deletePositionChangeRecord(id); closeModal(); loadData(); });

  const handleHygieneSubmit = (data: any) =>
    wrapSave(async () => {
      const converted = { ...data, status_notes: data.status_notes ? s2t(data.status_notes) : data.status_notes };
      if (modal?.existing) await db.updateHygieneRecord({ ...modal.existing, ...converted });
      else await db.createHygieneRecord(converted);
      closeModal(); loadData();
    });

  const handleHygieneDelete = (id: string) =>
    wrapSave(async () => { await db.deleteHygieneRecord(id); closeModal(); loadData(); });

  const handleIntakeSave = (record: IntakeOutputRecord) =>
    wrapSave(async () => { closeModal(); loadData(); });

  const handleIntakeDelete = (id: string) =>
    wrapSave(async () => { await db.deleteIntakeOutputRecord(id); closeModal(); loadData(); });

  // ─── Helpers ──────────────────────────────────────────────────
  const staffName = displayName || '护理员';

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        {/* Left: Previous button */}
        <button
          onClick={handleSelectPrev}
          disabled={!prevBed}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-gray-700"
          title="上一位"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Center: Patient name and bed number */}
        <div className="flex-1 text-center">
          <p className="font-semibold text-gray-900">
            {patient ? t2s(patient.中文姓名) : '空床'}
            <span className="text-sm font-normal text-gray-500 ml-1">{bed.bed_number}</span>
          </p>
          {isAbsent && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5 justify-center">
              <Lock className="w-3 h-3" /> 院友缺席中，仅可填写巡房
            </p>
          )}
        </div>

        {/* Right: Next button */}
        <button
          onClick={handleSelectNext}
          disabled={!nextBed}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-gray-700"
          title="下一位"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 錯誤提示 */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-start gap-2 flex-shrink-0">
          <span className="text-red-600 text-xs flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* Date navigation - showing one day at a time */}
      <div className="bg-white border-b border-gray-100 flex items-center justify-between px-4 py-2 flex-shrink-0">
        <button
          onClick={() => {
            const d = new Date(displayDateObj);
            d.setDate(d.getDate() - 1);
            const ds = formatDate(d);
            if (ds >= minDateStr) {
              setDisplayDate(ds);
            }
          }}
          disabled={displayDate <= minDateStr}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {displayDateObj.getFullYear()}年{String(displayDateObj.getMonth() + 1).padStart(2, '0')}月{String(displayDateObj.getDate()).padStart(2, '0')}日 星期{['日','一','二','三','四','五','六'][displayDateObj.getDay()]}
        </span>
        <button
          onClick={() => {
            const d = new Date(displayDateObj);
            d.setDate(d.getDate() + 1);
            const ds = formatDate(d);
            if (ds <= todayStr) {
              setDisplayDate(ds);
            }
          }}
          disabled={displayDate >= todayStr}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex overflow-x-auto scrollbar-hide px-2">
          {visibleTabs.map(tab => {
            const frozen = isAbsent && tab !== 'patrol';
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                } ${frozen ? 'opacity-50' : ''}`}
              >
                {TAB_CONFIG[tab].label}
                {frozen && <Lock className="w-3 h-3 inline ml-1 opacity-60" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'toilet_training' ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 p-8 text-center">
            <p className="text-sm">如厕训练记录功能暂未开放</p>
            <p className="text-xs">请在 Web 端护理记录页填写</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-2">
            {/* Date header row - empty, date shown in navigation bar above */}
            <div className="flex mb-1 sticky top-0 bg-gray-50 z-10">
              <div className="w-14 flex-shrink-0" />
              <div className="flex-1 text-center">
                {/* Date display moved to navigation bar */}
              </div>
            </div>

            {/* Slot rows */}
            {slotRows.map(({ slot, label }) => (
              <div key={slot} className="flex mb-0.5">
                {/* Time label */}
                <div className="w-14 flex-shrink-0 flex items-center">
                  <span className="text-[10px] text-gray-400 font-mono leading-none">{label}</span>
                </div>
                {/* Display date's cell */}
                {(() => {
                  const ds = displayDate;
                  const existingRecord = getExisting(ds, activeTab === 'hygiene' ? 'daily' : slot);
                  const done = !!existingRecord;
                  const frozen = isAbsent && activeTab !== 'patrol';

                  // 檢查是否逾期
                  const checkTime =
                    activeTab === 'hygiene' ? '23:59' :
                    activeTab === 'diaper' ? parseDiaperSlotStartTime(slot) :
                    slot;
                  const isOverdue = !done && !frozen && isSlotOverdue(ds, checkTime);

                  // 根據 tab 類型和狀態渲染內容
                  let cellContent: React.ReactNode = null;
                  let cellTextColor = 'text-gray-600';

                  if (done && existingRecord) {
                    // ─── 已填 ───
                    switch (activeTab) {
                      case 'patrol':
                        cellContent = existingRecord.notes || '已巡';
                        cellTextColor = existingRecord.notes ? 'text-orange-600' : 'text-green-600';
                        break;
                      case 'diaper':
                        const diaperContent: string[] = [];
                        if (existingRecord.has_urine) diaperContent.push('小');
                        if (existingRecord.has_stool) diaperContent.push('大');
                        if (existingRecord.has_none) diaperContent.push('無');
                        cellContent = existingRecord.notes || diaperContent.join('/');
                        cellTextColor = existingRecord.notes ? 'text-orange-600' : 'text-blue-600';
                        break;
                      case 'intake_output':
                        cellContent = existingRecord.notes || '已記錄';
                        cellTextColor = existingRecord.notes ? 'text-orange-600' : 'text-blue-600';
                        break;
                      case 'restraint':
                        cellContent = existingRecord.notes || 
                          (existingRecord.observation_status === 'N' ? '正常' :
                           existingRecord.observation_status === 'P' ? '異常' :
                           existingRecord.observation_status === 'S' ? '暫停' : '已觀察');
                        cellTextColor = existingRecord.notes ? 'text-orange-600' : 'text-blue-600';
                        break;
                      case 'position':
                        cellContent = existingRecord.notes || (existingRecord.position || '已記錄');
                        cellTextColor = existingRecord.notes ? 'text-orange-600' : 'text-blue-600';
                        break;
                      case 'hygiene':
                        // 檢查是否有任何卫生项目記錄
                        const hasAnyHygieneItem = existingRecord.status_notes || 
                          (existingRecord.care_items && Object.values(existingRecord.care_items).some(v => v));
                        cellContent = '已完成';
                        cellTextColor = 'text-green-600';
                        break;
                    }
                  } else if (isOverdue) {
                    // ─── 逾期未填 ───
                    switch (activeTab) {
                      case 'patrol':
                        cellContent = '未巡';
                        cellTextColor = 'text-red-600';
                        break;
                      case 'diaper':
                        cellContent = '未記錄';
                        cellTextColor = 'text-red-600';
                        break;
                      case 'intake_output':
                        cellContent = '未記錄';
                        cellTextColor = 'text-red-600';
                        break;
                      case 'restraint':
                        cellContent = '未記錄';
                        cellTextColor = 'text-red-600';
                        break;
                      case 'position':
                        cellContent = '未記錄';
                        cellTextColor = 'text-red-600';
                        break;
                      case 'hygiene':
                        cellContent = '未完成';
                        cellTextColor = 'text-red-600';
                        break;
                    }
                  } else {
                    // ─── 未到點 ───
                    switch (activeTab) {
                      case 'patrol':
                        cellContent = '待巡';
                        cellTextColor = 'text-gray-500';
                        break;
                      case 'diaper':
                        cellContent = '未知';
                        cellTextColor = 'text-gray-500';
                        break;
                      case 'intake_output':
                        cellContent = '未知';
                        cellTextColor = 'text-gray-500';
                        break;
                      case 'restraint':
                        cellContent = '待記錄';
                        cellTextColor = 'text-gray-500';
                        break;
                      case 'position':
                        cellContent = '待記錄';
                        cellTextColor = 'text-gray-500';
                        break;
                      case 'hygiene':
                        cellContent = '待完成';
                        cellTextColor = 'text-gray-500';
                        break;
                    }
                  }

                  return (
                    <button
                      key={ds}
                      disabled={frozen}
                      onClick={() => openCell(activeTab, ds, activeTab === 'hygiene' ? 'daily' : slot, existingRecord)}
                      className={`flex-1 mx-0.5 h-12 rounded-md flex flex-col items-center justify-center transition-colors px-1 text-xs font-medium ${cellTextColor} ${
                        done
                          ? 'bg-green-50'
                          : isOverdue
                          ? 'bg-red-50 border border-red-300'
                          : frozen
                          ? 'bg-gray-100 text-gray-300'
                          : 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      {cellContent}
                      {!done && frozen && <Lock className="w-3 h-3 opacity-40 mt-1" />}
                    </button>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - Return button */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm"
        >
          返回
        </button>
      </div>

      {/* ─── Modals ─────────────────────────────────────────────── */}
      {modal?.type === 'patrol' && (
        <NursePatrolRoundModal
          bed={bed}
          patient={patient}
          date={modal.date}
          timeSlot={modal.timeSlot}
          staffName={staffName}
          existingRecord={modal.existing}
          onClose={closeModal}
          onSubmit={handlePatrolSubmit}
          onDelete={handlePatrolDelete}
        />
      )}

      {modal?.type === 'diaper' && patient && (
        <DiaperChangeModal
          patient={patient}
          date={modal.date}
          timeSlot={modal.timeSlot}
          staffName={staffName}
          existingRecord={modal.existing}
          onClose={closeModal}
          onSubmit={handleDiaperSubmit}
          onDelete={handleDiaperDelete}
        />
      )}

      {modal?.type === 'restraint' && patient && (
        <RestraintObservationModal
          patient={patient}
          date={modal.date}
          timeSlot={modal.timeSlot}
          staffName={staffName}
          existingRecord={modal.existing}
          restraintAssessments={patientRestraintAssessments.filter(a => a.patient_id === patient.院友id)}
          allRestraintRecords={restraintObservationRecords.filter(r => r.patient_id === patient.院友id)}
          onClose={closeModal}
          onSubmit={handleRestraintSubmit}
          onDelete={handleRestraintDelete}
        />
      )}

      {modal?.type === 'position' && patient && (
        <PositionChangeModal
          patient={patient}
          date={modal.date}
          timeSlot={modal.timeSlot}
          staffName={staffName}
          existingRecord={modal.existing}
          onClose={closeModal}
          onSubmit={handlePositionSubmit}
          onDelete={handlePositionDelete}
        />
      )}

      {modal?.type === 'hygiene' && patient && (
        <HygieneModal
          patient={patient}
          date={modal.date}
          staffName={staffName}
          existingRecord={modal.existing}
          onClose={closeModal}
          onSubmit={handleHygieneSubmit}
          onDelete={handleHygieneDelete}
          shouldHideBowelCount={visibleTabs.includes('diaper')}
        />
      )}

      {modal?.type === 'intake_output' && patient && (
        <IntakeOutputModal
          patient={patient}
          date={modal.date}
          timeSlot={modal.timeSlot}
          staffName={staffName}
          existingRecord={modal.existing}
          onClose={closeModal}
          onSave={handleIntakeSave}
          onDelete={handleIntakeDelete}
        />
      )}
    </div>
  );
};

export default RecordsPage;
