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
  position:        { label: '翻身记录' },
  toilet_training: { label: '如厕训练' },
  hygiene:         { label: '卫生记录' },
};

const LOOKBACK_KEY = 'missingLookbackDays';

interface RecordsPageProps {
  bed: Bed;
  patient: Patient | null;
  onBack: () => void;
}

interface ModalState {
  type: TabType;
  date: string;
  timeSlot: string;
  existing: any;
}

const RecordsPage: React.FC<RecordsPageProps> = ({ bed, patient, onBack }) => {
  const { displayName } = useAuth();
  const { admissionRecords, hospitalEpisodes, patientRestraintAssessments, restraintObservationRecords } = usePatients();

  // ─── Week navigation ──────────────────────────────────────────
  const [weekStart, setWeekStart] = useState(() => getWeekStartDate());
  const weekDates = useMemo(() => generateWeekDates(weekStart), [weekStart]);
  const weekStartStr = formatDate(weekDates[0]);
  const weekEndStr   = formatDate(weekDates[6]);

  const lookback = parseInt(localStorage.getItem(LOOKBACK_KEY) || '7', 10);
  const today = new Date();
  const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - lookback);

  const canGoPrev = weekStart > minDate;
  const canGoNext = weekStart < getWeekStartDate(); // 不允許進入未來週

  const prevWeek = () => {
    if (!canGoPrev) return;
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    if (!canGoNext) return;
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  // ─── Tab state ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>('patrol');
  const [patientCareTabs, setPatientCareTabs] = useState<PatientCareTab[]>([]);

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
      // Patrol: by bed_id，migration 未 push 時自動降級到 patient_id
      const patrol = await db.getPatrolRoundsByBedId(bed.id, weekStartStr, weekEndStr, patient?.院友id);
      setPatrolRounds(patrol);

      if (patient) {
        const pid = patient.院友id;
        const [careTabs, diaper, restraint, position, hygiene, intake] = await Promise.all([
          loadPatientCareTabs(pid),
          db.getDiaperChangeRecordsInDateRange(weekStartStr, weekEndStr),
          db.getRestraintObservationRecordsInDateRange(weekStartStr, weekEndStr),
          db.getPositionChangeRecordsInDateRange(weekStartStr, weekEndStr),
          db.getHygieneRecordsInDateRange(weekStartStr, weekEndStr),
          db.getIntakeOutputRecordsByPatient(pid, weekStartStr, weekEndStr),
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
  }, [bed.id, patient, weekStartStr, weekEndStr]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Modal ────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalState | null>(null);

  const openCell = useCallback((type: TabType, date: string, timeSlot: string, existing: any) => {
    if (!patient && type !== 'patrol') return;
    if (isAbsent && type !== 'patrol') return; // 缺席凍結
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
    ) as TabType[];
  }, [patient, patientCareTabs, patrolRounds, diaperRecords, restraintRecords, positionRecords, hygieneRecords]);

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
      const converted = { ...data, notes: data.notes ? s2t(data.notes) : data.notes };
      if (modal?.existing) await db.updateRestraintObservationRecord({ ...modal.existing, ...converted });
      else await db.createRestraintObservationRecord(converted);
      closeModal(); loadData();
    });

  const handleRestraintDelete = (id: string) =>
    wrapSave(async () => { await db.deleteRestraintObservationRecord(id); closeModal(); loadData(); });

  const handlePositionSubmit = (data: Omit<PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>) =>
    wrapSave(async () => {
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
  const todayStr = formatDate(today);

  const isToday = (date: Date) => formatDate(date) === todayStr;

  const staffName = displayName || '护理员';

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 active:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {patient ? t2s(patient.中文姓名) : '空床'}
            <span className="text-sm font-normal text-gray-500 ml-2">{bed.bed_number}</span>
          </p>
          {isAbsent && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
              <Lock className="w-3 h-3" /> 院友缺席中，仅可填写巡房
            </p>
          )}
        </div>
      </div>

      {/* 錯誤提示 */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-start gap-2 flex-shrink-0">
          <span className="text-red-600 text-xs flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* Week navigation */}
      <div className="bg-white border-b border-gray-100 flex items-center justify-between px-4 py-2 flex-shrink-0">
        <button
          onClick={prevWeek}
          disabled={!canGoPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {weekStartStr} – {weekEndStr}
        </span>
        <button
          onClick={nextWeek}
          disabled={!canGoNext}
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
      <div className="flex-1 overflow-y-auto">
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
            {/* Date header row */}
            <div className="flex mb-1 sticky top-0 bg-gray-50 z-10">
              <div className="w-14 flex-shrink-0" />
              {weekDates.map(d => {
                const ds = formatDate(d);
                const todayCls = isToday(d) ? 'text-blue-600 font-bold' : 'text-gray-600';
                return (
                  <div key={ds} className="flex-1 text-center">
                    <p className={`text-[10px] ${todayCls}`}>
                      {['一','二','三','四','五','六','日'][d.getDay() === 0 ? 6 : d.getDay() - 1]}
                    </p>
                    <p className={`text-[11px] ${todayCls}`}>{d.getDate()}</p>
                  </div>
                );
              })}
            </div>

            {/* Slot rows */}
            {slotRows.map(({ slot, label }) => (
              <div key={slot} className="flex mb-0.5">
                {/* Time label */}
                <div className="w-14 flex-shrink-0 flex items-center">
                  <span className="text-[10px] text-gray-400 font-mono leading-none">{label}</span>
                </div>
                {/* Date cells */}
                {weekDates.map(d => {
                  const ds = formatDate(d);
                  const actualSlot = activeTab === 'hygiene' ? ds : slot;
                  const done = hasRecord(ds, activeTab === 'hygiene' ? 'daily' : slot);
                  const frozen = isAbsent && activeTab !== 'patrol';
                  const isFuture = d > today;
                  const clickable = !frozen && !isFuture;

                  // 紅點：時段實際發生日期在補錄窗口內且已過、未填、未凍結
                  const checkTime =
                    activeTab === 'hygiene' ? '23:59' :
                    activeTab === 'diaper' ? parseDiaperSlotStartTime(slot) :
                    slot;
                  const actualDateStr = getActualSlotDate(ds, checkTime);
                  const showMissingDot =
                    !done && !frozen &&
                    isSlotOverdue(ds, checkTime) &&
                    new Date(actualDateStr + 'T00:00:00') >= minDate;

                  return (
                    <button
                      key={ds}
                      disabled={!clickable}
                      onClick={() => openCell(activeTab, ds, activeTab === 'hygiene' ? 'daily' : slot, getExisting(ds, activeTab === 'hygiene' ? 'daily' : slot))}
                      className={`flex-1 mx-0.5 h-8 rounded-md flex items-center justify-center transition-colors ${
                        done
                          ? 'bg-green-100 text-green-700'
                          : frozen || isFuture
                          ? 'bg-gray-100 text-gray-300'
                          : showMissingDot
                          ? 'bg-red-50 border border-red-300 hover:bg-red-100'
                          : isToday(d)
                          ? 'bg-blue-50 border border-blue-200 text-gray-400 hover:bg-blue-100'
                          : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {done ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : frozen ? (
                        <Lock className="w-3 h-3 opacity-40" />
                      ) : showMissingDot ? (
                        <span className="w-2 h-2 rounded-full bg-red-400 block" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
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
