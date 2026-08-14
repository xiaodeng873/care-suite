import React, { useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { usePatientData, useFilteredPatients, type Patient, type PatientHealthTask, type FollowUpAppointment } from '../context/PatientContext';
import { useDashboardReady } from '../context/DashboardReadyContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import TaskModal from '../components/TaskModal';
import { Hop as Home, Users, Calendar, Heart, SquareCheck as CheckSquare, TriangleAlert as AlertTriangle, Clock, TrendingUp, TrendingDown, Activity, Droplets, Scale, FileText, Stethoscope, Shield, CalendarCheck, Utensils, BookOpen, Guitar as Hospital, Pill, Building2, X, User, ArrowRight, Repeat, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isTaskOverdue, isTaskPendingToday, isTaskDueSoon, getTaskStatus, isDocumentTask, isMonitoringTask, isNursingTask, isRestraintAssessmentOverdue, isRestraintAssessmentDueSoon, isHealthAssessmentOverdue, isHealthAssessmentDueSoon, isTubeCareOverdue, isTubeCareDueSoon, calculateNextDueDate, isTaskScheduledForDate, formatFrequencyDescription, findFirstMissingDate } from '../utils/taskScheduler';
import { getPatientsWithOverdueWorkflow } from '../utils/workflowStatusHelper';
import { computeEstimatedEndDate, daysUntil } from '../utils/estimatedEndDate';
import HealthRecordModal from '../components/HealthRecordModal';
import MealGuidanceModal from '../components/MealGuidanceModal';
import FollowUpModal from '../components/FollowUpModal';
import DocumentTaskModal from '../components/DocumentTaskModal';
import RestraintAssessmentModal from '../components/RestraintAssessmentModal';
import TubeCareModal from '../components/TubeCareModal';
import HealthAssessmentModal from '../components/HealthAssessmentModal';
import AnnualHealthCheckupModal from '../components/AnnualHealthCheckupModal';
import MissingRequirementsCard from '../components/MissingRequirementsCard';
import NotesCard from '../components/NotesCard';
import OverdueWorkflowCard from '../components/OverdueWorkflowCard';
import PendingPrescriptionCard from '../components/PendingPrescriptionCard';
import MedicationRemindersCard from '../components/MedicationRemindersCard';
import CarePlanDueReminderCard from '../components/CarePlanDueReminderCard';
import ActivityRecordReminderCard from '../components/ActivityRecordReminderCard';
import ActivityRecordModal from '../components/ActivityRecordModal';
import PatientModal from '../components/PatientModal';
import VaccinationRecordModal from '../components/VaccinationRecordModal';
import TaskHistoryModal from '../components/TaskHistoryModal';
import MonitoringTaskWorksheetModal from '../components/MonitoringTaskWorksheetModal';
import BatchHealthRecordOCRModal from '../components/BatchHealthRecordOCRModal';
import SingleWoundAssessmentModal from '../components/SingleWoundAssessmentModal';
import BedNumberImprint from '../components/BedNumberImprint';
import { syncTaskStatus, SYNC_CUTOFF_DATE_STR } from '../lib/database';
import { supabase } from '../lib/supabase';
import { getMissingMonitoringVitals } from '../utils/monitoringCoverage';
import { hasInProgressCarePlan } from '../utils/carePlanStatus';
import { formatDisplayDate , formatDisplayDateTime } from '../utils/dateFormat';

type HealthTask = PatientHealthTask;
// 每位院友只保留最新一筆（以 created_at 比較，null-safe），避免歷史記錄重複計入提醒
function pickLatestPerPatient<T extends { patient_id: number; created_at?: string | null }>(records: T[]): T[] {
  const latestPerPatient = new Map<number, T>();
  const toTime = (value?: string | null) => {
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isNaN(time) ? -Infinity : time;
  };
  records.forEach(record => {
    const existing = latestPerPatient.get(record.patient_id);
    if (!existing || toTime(record.created_at) > toTime(existing.created_at)) {
      latestPerPatient.set(record.patient_id, record);
    }
  });
  return Array.from(latestPerPatient.values());
}
const Dashboard: React.FC = () => {
  const patientData = usePatientData();
  const patients = useFilteredPatients();
  const { schedules, prescriptions, followUpAppointments, patientHealthTasks, setPatientHealthTasks, healthRecords, patientRestraintAssessments, patientTubeCareRecords, healthAssessments, mealGuidances, prescriptionWorkflowRecords, annualHealthCheckups, vaccinationRecords, carePlans, patientsWithWounds, activityRecords, beds, loading, updatePatientHealthTask, refreshData, refreshHealthTaskData, refreshWoundData } = patientData;
  const [showActivityRecordModal, setShowActivityRecordModal] = useState(false);
  const [activityRecordPatientId, setActivityRecordPatientId] = useState<number | undefined>(undefined);
  const [showHealthRecordModal, setShowHealthRecordModal] = useState(false);
  // [防穿透] 記錄監測 modal 關閉時間：快速雙擊「儲存」時，第二下點擊會穿透到底層任務卡片，
  // 重新打開一個全新表單（看起來就像「表單被清空重置」）
  const lastHealthModalCloseAtRef = React.useRef(0);
  const [selectedHealthRecordInitialData, setSelectedHealthRecordInitialData] = useState<any>({});
  const [showDocumentTaskModal, setShowDocumentTaskModal] = useState(false);
  const [selectedDocumentTask, setSelectedDocumentTask] = useState<{ task: HealthTask; patient: Patient } | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpAppointment | null>(null);
  const [showRestraintAssessmentModal, setShowRestraintAssessmentModal] = useState(false);
  const [selectedRestraintAssessment, setSelectedRestraintAssessment] = useState<any | null>(null);
  const [renewFromRestraintAssessment, setRenewFromRestraintAssessment] = useState<any | null>(null);
  const [showTubeCareModal, setShowTubeCareModal] = useState(false);
  const [selectedTubeCareRecord, setSelectedTubeCareRecord] = useState<any | null>(null);
  const [renewFromTubeCare, setRenewFromTubeCare] = useState<any | null>(null);
  const [showHealthAssessmentModal, setShowHealthAssessmentModal] = useState(false);
  const [selectedHealthAssessment, setSelectedHealthAssessment] = useState<any | null>(null);
  const [showAnnualCheckupModal, setShowAnnualCheckupModal] = useState(false);
  const [selectedAnnualCheckup, setSelectedAnnualCheckup] = useState<any | null>(null);
  const [renewFromAnnualCheckup, setRenewFromAnnualCheckup] = useState<any | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<'生命表徵' | null>(null);
  const [prefilledAnnualCheckupPatientId, setPrefilledAnnualCheckupPatientId] = useState<number | null>(null);
  const [selectedPatientForTask, setSelectedPatientForTask] = useState<any>(null);
  const [showMealGuidanceModal, setShowMealGuidanceModal] = useState(false);
  const [selectedPatientForMeal, setSelectedPatientForMeal] = useState<any>(null);
  const [prefilledTaskData, setPrefilledTaskData] = useState<any>(null);
  const [prefilledMealData, setPrefilledMealData] = useState<any>(null);
  const [showDailyTaskModal, setShowDailyTaskModal] = useState(false);
  const [selectedOverdueDate, setSelectedOverdueDate] = useState<string>('');
  const [isGeneratingTemperature, setIsGeneratingTemperature] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<any>(null);
  const [showVaccinationModal, setShowVaccinationModal] = useState(false);
  const [selectedPatientForVaccination, setSelectedPatientForVaccination] = useState<any>(null);
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  // 傷口評估 Modal 狀態
  const [showWoundAssessmentModal, setShowWoundAssessmentModal] = useState(false);
  const [selectedWoundForAssessment, setSelectedWoundForAssessment] = useState<any | null>(null);
  // 歷史日曆 Modal 狀態
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<{ task: HealthTask; patient: Patient; initialDate?: Date | null; groupTasks?: HealthTask[] } | null>(null);
  const uniquePatientHealthTasks = useMemo(() => {
    const seen = new Map<string, boolean>();
    const uniqueTasks: typeof patientHealthTasks = [];
    patientHealthTasks.forEach(task => {
      if (!seen.has(task.id)) {
        seen.set(task.id, true);
        uniqueTasks.push(task);
      }
    });
    return uniqueTasks;
  }, [patientHealthTasks]);
  const handleTaskClick = (task: HealthTask, date?: string, groupTasks?: HealthTask[]) => {
    // [防穿透] modal 關閉後 300ms 內忽略開啟請求
    if (Date.now() - lastHealthModalCloseAtRef.current < 300) {
      return;
    }
    const patient = patients.find(p => p.院友id === task.patient_id);
    // 调试：呂葉少芳
    const isLyuPatient = patient?.中文姓名 === '呂葉少芳';
    if (isLyuPatient) {
    }
    let targetDate = date;
    if (!targetDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // 获取院友入住日期
      const admissionDate = patient?.入住日期 ? new Date(patient.入住日期) : null;
      if (admissionDate) {
        admissionDate.setHours(0, 0, 0, 0);
      }
      // [修復] 獲取任務開始執行日期（與 TaskHistoryModal 保持一致）
      const taskStartDate = task.start_date ? new Date(task.start_date) : null;
      if (taskStartDate) {
        taskStartDate.setHours(0, 0, 0, 0);
      }
      const normalizedTaskTimes = task.specific_times?.map(normalizeTime) || [];
      if (isLyuPatient) {
      }
      for (let i = 0; i <= 28; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = formatLocalDate(checkDate);
        // 如果检查日期早于 CUT OFF DATE，跳过
        if (dateStr <= SYNC_CUTOFF_DATE_STR) {
          if (isLyuPatient) {
          }
          continue;
        }
        // 如果检查日期早于入住日期，跳过
        if (admissionDate && checkDate < admissionDate) {
          if (isLyuPatient) {
          }
          continue;
        }
        // [修復] 如果检查日期早于任務開始執行日期，跳过（與 TaskHistoryModal 保持一致）
        if (taskStartDate && checkDate < taskStartDate) {
          if (isLyuPatient) {
          }
          continue;
        }
        if (!isTaskScheduledForDate(task, checkDate)) {
          if (isLyuPatient) {
          }
          continue;
        }
        let isDateCompleted = false;
        if (normalizedTaskTimes.length > 0) {
          isDateCompleted = normalizedTaskTimes.every(time =>
            hasRecordWithinTolerance([`${task.id}_${dateStr}`, `${task.patient_id?.toString()}_${task.health_record_type}_${dateStr}`], time)
          );
        } else {
          const keyWithTaskId = `${task.id}_${dateStr}`;
          const keyWithPatientId = `${task.patient_id?.toString()}_${task.health_record_type}_${dateStr}`;
          isDateCompleted = recordLookup.has(keyWithTaskId) || recordLookup.has(keyWithPatientId);
        }
        if (!isDateCompleted) {
          targetDate = dateStr;
          if (isLyuPatient) {
          }
        } else if (isLyuPatient) {
        }
      }
      if (isLyuPatient) {
      }
      if (!targetDate) {
        targetDate = formatLocalDate(today);
      }
    }
    let selectedTime: string | undefined;
    if (task.specific_times && task.specific_times.length > 0) {
      const dateRecords = healthRecords.filter(r => {
        if (r.任務id && r.任務id === task.id) {
          return r.記錄日期 === targetDate;
        }
        return r.院友id.toString() === task.patient_id.toString() &&
               r.監測類型 === task.health_record_type &&
               r.記錄日期 === targetDate;
      });
      const completedTimes = new Set(dateRecords.map(r => normalizeTime(r.記錄時間)));
      selectedTime = task.specific_times.find(time => !completedTimes.has(normalizeTime(time)));
    }
    const initialDataForModal = {
      patient: patient ? {
        院友id: patient.院友id,
        中文姓名: patient.中文姓名,
        床號: patient.床號
      } : undefined,
      task: {
        id: task.id,
        health_record_type: task.health_record_type,
        next_due_at: task.next_due_at,
        specific_times: task.specific_times,
        notes: task.notes
      },
      任務清單: (groupTasks && groupTasks.length > 0 ? groupTasks : [task]).map(t => ({
        id: t.id,
        health_record_type: t.health_record_type,
        notes: t.notes,
      })),
      預設日期: targetDate,
      預設時間: selectedTime
    };
    setSelectedHealthRecordInitialData(initialDataForModal);
    setShowHealthRecordModal(true);
  };
  const handleDocumentTaskClick = (task: HealthTask) => {
    const patient = patients.find(p => p.院友id === task.patient_id);
    if (patient) {
      setSelectedDocumentTask({ task, patient });
      setShowDocumentTaskModal(true);
    }
  };
  const handleFollowUpClick = (appointment: FollowUpAppointment) => {
    setSelectedFollowUp(appointment);
    setShowFollowUpModal(true);
  };
  const handleRestraintAssessmentClick = (assessment: any) => {
    setRenewFromRestraintAssessment(assessment);
    setSelectedRestraintAssessment(null);
    setShowRestraintAssessmentModal(true);
  };
  const handleTubeCareClick = (record: any) => {
    setRenewFromTubeCare(record);
    setSelectedTubeCareRecord(null);
    setShowTubeCareModal(true);
  };
  const handleHealthAssessmentClick = (assessment: any) => {
    setSelectedHealthAssessment(assessment);
    setShowHealthAssessmentModal(true);
  };
  const handleAnnualCheckupClick = (checkup: any) => {
    setRenewFromAnnualCheckup(checkup);
    setSelectedAnnualCheckup(null);
    setShowAnnualCheckupModal(true);
  };
  // [核心修復] 標準化時間格式的輔助函數
  const normalizeTime = (time: string | undefined): string => {
    if (!time) return '';
    // 統一轉換為 HH:MM 格式（去除秒數）
    return time.split(':').slice(0, 2).join(':');
  };
  // [時區修復] 正確格式化本地日期為 YYYY-MM-DD（避免 UTC 時區偏移）
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  // [效能優化+修復可能性3] 建立健康記錄的快速查找表 (Set)
  // 解決 "速度沒有變快" 的核心：將 O(N) 查找轉為 O(1)
  // [修正] 支持時間點區分：記錄格式改為包含時間
  const recordLookup = useMemo(() => {
    const lookup = new Set<string>();
    healthRecords.forEach((r) => {
      if (r.任務id) {
        const normalizedTime = normalizeTime(r.記錄時間);
        const keyWithTime = `${r.任務id}_${r.記錄日期}_${normalizedTime}`;
        const keyWithoutTime = `${r.任務id}_${r.記錄日期}`;
        lookup.add(keyWithTime);
        lookup.add(keyWithoutTime);
      }
      const normalizedTime = normalizeTime(r.記錄時間);
      const patientIdStr = r.院友id?.toString() || '';
      const oldKeyWithTime = `${patientIdStr}_${r.監測類型}_${r.記錄日期}_${normalizedTime}`;
      const oldKeyWithoutTime = `${patientIdStr}_${r.監測類型}_${r.記錄日期}`;
      lookup.add(oldKeyWithTime);
      lookup.add(oldKeyWithoutTime);
    });
    return lookup;
  }, [healthRecords]);
  // [時間容差] 建立「日期鍵 → 已記錄時間（分鐘）」查找表，支援 ±30 分鐘容差比對
  const recordTimes = useMemo(() => {
    const map = new Map<string, number[]>();
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    healthRecords.forEach((r) => {
      const minutes = toMin(normalizeTime(r.記錄時間));
      const patientIdStr = r.院友id?.toString() || '';
      const keys = [`${patientIdStr}_${r.監測類型}_${r.記錄日期}`];
      if (r.任務id) keys.push(`${r.任務id}_${r.記錄日期}`);
      keys.forEach(k => {
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(minutes);
      });
    });
    return map;
  }, [healthRecords]);
  const TIME_TOLERANCE_MIN = 30;
  const hasRecordWithinTolerance = (dateKeys: string[], time: string): boolean => {
    const [h, m] = normalizeTime(time).split(':').map(Number);
    const target = (h || 0) * 60 + (m || 0);
    return dateKeys.some(k => (recordTimes.get(k) || []).some(min => Math.abs(min - target) <= TIME_TOLERANCE_MIN));
  };
  // [輔助函數] 檢查特定日期和時間是否有記錄
  const hasRecordForDateTime = (task: HealthTask, dateStr: string, timeStr?: string) => {
    // [關鍵修復] 確保 patient_id 類型一致
    const patientIdStr = task.patient_id?.toString() || '';
    // [修復] 如果任務有多個時間點，需要檢查所有時間點
    if (task.specific_times && task.specific_times.length > 0) {
      if (timeStr) {
        // 檢查特定時間點（±30 分鐘容差）
        return hasRecordWithinTolerance([`${task.id}_${dateStr}`, `${patientIdStr}_${task.health_record_type}_${dateStr}`], timeStr);
      } else {
        // 檢查所有時間點是否都完成（±30 分鐘容差）
        return task.specific_times.every(time =>
          hasRecordWithinTolerance([`${task.id}_${dateStr}`, `${patientIdStr}_${task.health_record_type}_${dateStr}`], time)
        );
      }
    } else {
      if (timeStr) {
        // 有時間但任務沒有定義時間點（±30 分鐘容差）
        return hasRecordWithinTolerance([`${task.id}_${dateStr}`, `${patientIdStr}_${task.health_record_type}_${dateStr}`], timeStr);
      } else {
        // 檢查整天（不分時間）
        return recordLookup.has(`${task.id}_${dateStr}`) ||
               recordLookup.has(`${patientIdStr}_${task.health_record_type}_${dateStr}`);
      }
    }
  };
  // [修復可能性5] 改進錯過日期檢查邏輯
  const findMostRecentMissedDate = (task: HealthTask) => {
    if (!isMonitoringTask(task.health_record_type)) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    // [優化問題4] 檢查範圍縮短為過去 14 天（避免過度追溯）
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = formatLocalDate(d);
      // 遇到 Cutoff Date 停止
      if (dateStr <= SYNC_CUTOFF_DATE_STR) {
        return null;
      }
      // 如果這天該做但沒有記錄，就是錯過了
      if (isTaskScheduledForDate(task, d)) {
        const hasRecord = hasRecordForDateTime(task, dateStr);
        if (!hasRecord) {
          return d;
        }
      }
    }
    return null;
  };
  const isAnnualCheckupOverdue = (checkup: any): boolean => {
    if (!checkup.next_due_date) return false;
    const today = new Date();
    const dueDate = new Date(checkup.next_due_date);
    return dueDate < today;
  };
  const isAnnualCheckupDueSoon = (checkup: any): boolean => {
    if (!checkup.next_due_date) return false;
    const today = new Date();
    const dueDate = new Date(checkup.next_due_date);
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 14 && daysDiff > 0;
  };
  const missingTasks = useMemo(() => {
    const result: { patient: any; missingTaskTypes: string[] }[] = [];
    patients.forEach(patient => {
      const patientTasks = patientHealthTasks.filter(task => task.patient_id === patient.院友id);
      const missing: string[] = [];
      const hasAnnualCheckup = annualHealthCheckups.some(checkup => checkup.patient_id === patient.院友id);
      if (!hasAnnualCheckup) missing.push('年度體檢');
      // 依頻率規則檢查欠缺的必要生命表徵任務
      // （血壓/脈搏/血含氧量/呼吸：每周；體溫：每天）
      getMissingMonitoringVitals(patientTasks).forEach(vital => missing.push(vital));
      if (missing.length > 0) result.push({ patient, missingTaskTypes: missing });
    });
    return result;
  }, [patients, patientHealthTasks, annualHealthCheckups]);
  const missingMealGuidance = useMemo(() => {
    return patients.filter(patient => !mealGuidances.some(guidance => guidance.patient_id === patient.院友id));
  }, [patients, mealGuidances]);
  const missingDeathDate = useMemo(() => {
    return patients.filter(p => p.在住狀態 === '已退住' && p.discharge_reason === '死亡' && (!p.death_date || p.death_date === '')).map(patient => ({ patient, missingInfo: '死亡日期' }));
  }, [patients]);
  const missingVaccination = useMemo(() => {
    return patients.filter(p => !vaccinationRecords.some(record => record.patient_id === p.院友id)).map(patient => ({ patient, missingInfo: '疫苗記錄' }));
  }, [patients, vaccinationRecords]);
  // 欠缺健康評估的院友
  const missingHealthAssessment = useMemo(() => {
    return patients.filter(patient => !healthAssessments.some(assessment => assessment.patient_id === patient.院友id)).map(patient => ({ patient, missingInfo: '健康評估' }));
  }, [patients, healthAssessments]);
  // 欠缺個人護理計劃的院友（必須有一份生效中且未過期 ICP）
  const missingCarePlan = useMemo(() => {
    return patients
      .filter(patient => patient.在住狀態 === '在住' && !hasInProgressCarePlan(carePlans, Number(patient.院友id)))
      .map(patient => ({ patient, missingInfo: '個人護理計劃' }));
  }, [patients, carePlans]);
  const overdueWorkflows = useMemo(() => {
    const result = getPatientsWithOverdueWorkflow(prescriptionWorkflowRecords, patients, prescriptions);
    return result.map(({ patient, overdueCount, overdueDates }) => {
      const dates: { [date: string]: number } = {};
      overdueDates.forEach(date => {
        const count = prescriptionWorkflowRecords.filter(r => r.patient_id === patient.院友id && r.scheduled_date === date && (r.preparation_status === 'pending' || r.verification_status === 'pending' || r.dispensing_status === 'pending')).length;
        dates[date] = count;
      });
      return { patient, overdueCount, dates };
    });
  }, [prescriptionWorkflowRecords, patients, prescriptions]);
  const pendingPrescriptions = useMemo(() => {
    return patients.filter(p => p.在住狀態 === '在住').map(patient => {
        const count = prescriptions.filter(pr => pr.patient_id === patient.院友id && pr.status === 'pending_change').length;
        return { patient, count };
      }).filter(item => item.count > 0);
  }, [patients, prescriptions]);
  const patientsMap = useMemo(() => new Map(patients.map(p => [p.院友id, p])), [patients]);

  // 藥物庫存不足：長期藥物（無明確結束日期但有預計結束日期），於預計結束日期前 4 週提醒續藥。
  // 依 處方日期 + 藥物來源(機構+專科) + 預計結束日期 歸組；預計結束日期過去即消失。
  const lowStockGroups = useMemo(() => {
    const today = new Date();
    const activePatientIds = new Set(patients.filter(p => p.在住狀態 === '在住').map(p => p.院友id));
    const groupsMap = new Map<string, {
      patient: any;
      source: string;
      specialty: string;
      prescriptionDate: string;
      estimatedEndDate: string;
      remainingDays: number;
      count: number;
    }>();
    (prescriptions || []).forEach((pr: any) => {
      if (pr.status !== 'active') return;
      if (pr.end_date) return;                       // 只處理長期藥物
      if (!activePatientIds.has(pr.patient_id)) return;
      const estEnd = pr.estimated_end_date || computeEstimatedEndDate(pr);
      if (!estEnd) return;
      const remaining = daysUntil(estEnd, today);
      if (remaining < 0 || remaining > 28) return;   // 未到 4 週或已過期則不提醒
      const source = pr.medication_source || '（未填來源）';
      const specialty = pr.medication_source_specialty || '';
      const key = `${pr.patient_id}|${pr.prescription_date}|${source}|${specialty}|${estEnd}`;
      const existing = groupsMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        const patient = patientsMap.get(pr.patient_id);
        if (!patient) return;
        groupsMap.set(key, {
          patient,
          source,
          specialty,
          prescriptionDate: pr.prescription_date,
          estimatedEndDate: estEnd,
          remainingDays: remaining,
          count: 1,
        });
      }
    });
    return Array.from(groupsMap.values()).sort((a, b) => a.remainingDays - b.remainingDays);
  }, [prescriptions, patients, patientsMap]);
  const recentSchedules = useMemo(() => schedules.filter(s => new Date(s.到診日期) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.到診日期).getTime() - new Date(b.到診日期).getTime()).slice(0, 5), [schedules]);
  const upcomingFollowUps = useMemo(() => followUpAppointments.filter(a => { if (new Date(a.覆診日期) < new Date()) return false; const patient = patientsMap.get(a.院友id); return patient && patient.在住狀態 === '在住'; }).sort((a, b) => new Date(a.覆診日期).getTime() - new Date(b.覆診日期).getTime()).slice(0, 10), [followUpAppointments, patientsMap]);
  const monitoringTasks = useMemo(() => patientHealthTasks.filter(task => isMonitoringTask(task.health_record_type)), [patientHealthTasks]);
  const documentTasks = useMemo(() => patientHealthTasks.filter(task => isDocumentTask(task.health_record_type)), [patientHealthTasks]);
  const urgentMonitoringTasks = useMemo(() => {
    const urgent: Array<typeof monitoringTasks[0] & { 
      firstIncompleteDate?: Date;
      incompleteDates?: Date[];
    }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    monitoringTasks.forEach(task => {
      const patient = patientsMap.get(task.patient_id);
      if (!patient || patient.在住狀態 !== '在住') return;
      // 获取院友入住日期
      const admissionDate = patient.入住日期 ? new Date(patient.入住日期) : null;
      if (admissionDate) {
        admissionDate.setHours(0, 0, 0, 0);
      }
      // [修復] 獲取任務開始執行日期（與 TaskHistoryModal 保持一致）
      const taskStartDate = task.start_date ? new Date(task.start_date) : null;
      if (taskStartDate) {
        taskStartDate.setHours(0, 0, 0, 0);
      }
      const normalizedTaskTimes = task.specific_times?.map(normalizeTime) || [];
      let firstIncompleteDate: Date | null = null;
      const incompleteDates: Date[] = [];
      for (let i = 0; i <= 28; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = formatLocalDate(checkDate);
        // 如果检查日期早于 CUT OFF DATE，跳过
        if (dateStr <= SYNC_CUTOFF_DATE_STR) {
          continue;
        }
        // 如果检查日期早于入住日期，跳过
        if (admissionDate && checkDate < admissionDate) {
          continue;
        }
        // [修復] 如果检查日期早于任務開始執行日期，跳过（與 TaskHistoryModal 保持一致）
        if (taskStartDate && checkDate < taskStartDate) {
          continue;
        }
        if (!isTaskScheduledForDate(task, checkDate)) {
          continue;
        }
        let isDateCompleted = false;
        if (normalizedTaskTimes.length > 0) {
          isDateCompleted = normalizedTaskTimes.every(time =>
            hasRecordWithinTolerance([`${task.id}_${dateStr}`, `${task.patient_id?.toString()}_${task.health_record_type}_${dateStr}`], time)
          );
        } else {
          const keyWithTaskId = `${task.id}_${dateStr}`;
          const keyWithPatientId = `${task.patient_id?.toString()}_${task.health_record_type}_${dateStr}`;
          isDateCompleted = recordLookup.has(keyWithTaskId) || recordLookup.has(keyWithPatientId);
        }
        if (!isDateCompleted) {
          const incompleteDate = new Date(checkDate);
          incompleteDates.push(incompleteDate);
          // 持續覆寫：循環從今天往回扫描，最後賦値 = 最早未完成日期
          firstIncompleteDate = incompleteDate;
        }
      }
      if (firstIncompleteDate) {
        urgent.push({ ...task, firstIncompleteDate, incompleteDates });
      }
    });
    // 顯示「首個未完成日期 ≤ 今天」的任務（包含逾期補錄）
    const todayStr = formatLocalDate(today);
    return urgent.filter(t =>
      t.firstIncompleteDate ? formatLocalDate(t.firstIncompleteDate) <= todayStr : false
    );
  }, [monitoringTasks, patientsMap, recordLookup, recordTimes]);
  const taskGroups = useMemo(() => {
    const breakfast: typeof urgentMonitoringTasks = [];
    const lunch: typeof urgentMonitoringTasks = [];
    const dinner: typeof urgentMonitoringTasks = [];
    const snack: typeof urgentMonitoringTasks = [];
    const temperature: typeof urgentMonitoringTasks = [];
    const weight: typeof urgentMonitoringTasks = [];
    urgentMonitoringTasks.forEach(task => {
      // 體溫/體重 抽離至獨立時段
      if (task.health_record_type === '體溫') {
        temperature.push(task);
        return;
      }
      if (task.health_record_type === '體重' || (task.health_record_type as string) === '體重控制') {
        weight.push(task);
        return;
      }
      // 以最早特定時間決定時段，無特定時間才用 next_due_at
      let hour: number;
      if (task.specific_times && task.specific_times.length > 0) {
        hour = Math.min(...task.specific_times.map(t => Number(normalizeTime(t).split(':')[0]) || 0));
      } else {
        hour = new Date(task.next_due_at).getHours();
      }
      if (hour >= 7 && hour < 10) breakfast.push(task);
      else if (hour >= 10 && hour < 13) lunch.push(task);
      else if (hour >= 13 && hour < 18) dinner.push(task);
      else if (hour >= 18 && hour <= 20) snack.push(task);
      else breakfast.push(task); // 無特定時段（如午夜 00:00）或超出範圍，預設歸入早餐段確保不被丟棄
    });
    // 第一順序：任務特定時間（時:分，忽略日期）；第二順序：床號
    const timeOfDay = (task: typeof urgentMonitoringTasks[number]) => {
      // 優先用 specific_times 的最早時間，否則用 next_due_at 的時:分
      if (task.specific_times && task.specific_times.length > 0) {
        const mins = task.specific_times.map(t => {
          const [h, m] = normalizeTime(t).split(':').map(Number);
          return (h || 0) * 60 + (m || 0);
        });
        return Math.min(...mins);
      }
      const d = new Date(task.next_due_at);
      return d.getHours() * 60 + d.getMinutes();
    };
    const sortByTimeThenBed = (a: typeof urgentMonitoringTasks[number], b: typeof urgentMonitoringTasks[number]) => {
      const timeA = timeOfDay(a);
      const timeB = timeOfDay(b);
      if (timeA !== timeB) return timeA - timeB;
      const bedA = patientsMap.get(a.patient_id)?.床號 || '';
      const bedB = patientsMap.get(b.patient_id)?.床號 || '';
      return bedA.localeCompare(bedB, 'zh-Hant', { numeric: true });
    };
    breakfast.sort(sortByTimeThenBed);
    lunch.sort(sortByTimeThenBed);
    dinner.sort(sortByTimeThenBed);
    snack.sort(sortByTimeThenBed);
    // 體溫/體重：逾期優先，再按床號（數值排序）
    const todayStrSort = formatLocalDate(new Date());
    const sortByOverdueThenBed = (a: typeof urgentMonitoringTasks[number], b: typeof urgentMonitoringTasks[number]) => {
      const aOverdue = a.firstIncompleteDate ? formatLocalDate(a.firstIncompleteDate) < todayStrSort : false;
      const bOverdue = b.firstIncompleteDate ? formatLocalDate(b.firstIncompleteDate) < todayStrSort : false;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      const bedA = patientsMap.get(a.patient_id)?.床號 || '';
      const bedB = patientsMap.get(b.patient_id)?.床號 || '';
      return bedA.localeCompare(bedB, 'zh-Hant', { numeric: true });
    };
    temperature.sort(sortByOverdueThenBed);
    weight.sort(sortByOverdueThenBed);
    return { breakfast, lunch, dinner, snack, temperature, weight };
  }, [urgentMonitoringTasks, patientsMap]);
  const { breakfast: breakfastTasks, lunch: lunchTasks, dinner: dinnerTasks, snack: snackTasks, temperature: temperatureTasks, weight: weightTasks } = taskGroups;
  const { overdueDocumentTasks, pendingDocumentTasks, dueSoonDocumentTasks } = useMemo(() => {
    const overdue: typeof documentTasks = [];
    const pending: typeof documentTasks = [];
    const dueSoon: typeof documentTasks = [];
    const todayStr = formatLocalDate(new Date());
    documentTasks.forEach(task => {
      const patient = patientsMap.get(task.patient_id);
      if (patient && patient.在住狀態 === '在住') {
        if (isTaskOverdue(task, recordLookup, todayStr)) overdue.push(task);
        else if (isTaskPendingToday(task, recordLookup, todayStr)) pending.push(task);
        else if (isTaskDueSoon(task, recordLookup, todayStr)) dueSoon.push(task);
      }
    });
    return { overdueDocumentTasks: overdue, pendingDocumentTasks: pending, dueSoonDocumentTasks: dueSoon };
  }, [documentTasks, patientsMap, recordLookup]);
  const urgentDocumentTasks = [...overdueDocumentTasks, ...pendingDocumentTasks, ...dueSoonDocumentTasks].slice(0, 10);
  const nursingTasks = useMemo(() => patientHealthTasks.filter(task => { const patient = patientsMap.get(task.patient_id); return patient && patient.在住狀態 === '在住' && isNursingTask(task.health_record_type); }), [patientHealthTasks, patientsMap]);
  const overdueNursingTasks = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    return nursingTasks.filter(task => isTaskOverdue(task, recordLookup, todayStr));
  }, [nursingTasks, recordLookup]);
  const pendingNursingTasks = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    return nursingTasks.filter(task => isTaskPendingToday(task, recordLookup, todayStr));
  }, [nursingTasks, recordLookup]);
  const dueSoonNursingTasks = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    return nursingTasks.filter(task => isTaskDueSoon(task, recordLookup, todayStr));
  }, [nursingTasks, recordLookup]);
  const urgentNursingTasks = [...overdueNursingTasks, ...pendingNursingTasks, ...dueSoonNursingTasks].slice(0, 10);
  const { overdueRestraintAssessments, dueSoonRestraintAssessments } = useMemo(() => {
    // 每位院友只取最新一筆，續期（新檔）後舊記錄不再計入提醒
    const latestAssessments = pickLatestPerPatient(patientRestraintAssessments);
    const overdue = latestAssessments.filter(assessment => { const patient = patientsMap.get(assessment.patient_id); return patient && patient.在住狀態 === '在住' && isRestraintAssessmentOverdue(assessment); });
    const dueSoon = latestAssessments.filter(assessment => { const patient = patientsMap.get(assessment.patient_id); return patient && patient.在住狀態 === '在住' && isRestraintAssessmentDueSoon(assessment); });
    return { overdueRestraintAssessments: overdue, dueSoonRestraintAssessments: dueSoon };
  }, [patientRestraintAssessments, patientsMap]);
  const urgentRestraintAssessments = [...overdueRestraintAssessments, ...dueSoonRestraintAssessments];
  const { overdueTubeCare, dueSoonTubeCare } = useMemo(() => {
    const addDaysStr = (dateStr: string, days: number): string => {
      const d = new Date(dateStr);
      const due = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
      const yyyy = due.getFullYear();
      const mm = String(due.getMonth() + 1).padStart(2, '0');
      const dd = String(due.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const execTime = (r: any) => (r?.execution_date ? new Date(r.execution_date).getTime() : -Infinity);

    // 非氧氣（導尿管/鼻胃飼管/造口袋）：每位院友每類最新一筆
    const latestByStream = new Map<string, any>();
    const oxygenByPatient = new Map<number, any[]>();
    (patientTubeCareRecords || []).forEach((r: any) => {
      if (r.care_type === '氧氣喉管清洗/更換') {
        if (!oxygenByPatient.has(r.patient_id)) oxygenByPatient.set(r.patient_id, []);
        oxygenByPatient.get(r.patient_id)!.push(r);
        return;
      }
      const key = `${r.patient_id}|${r.care_type}`;
      const existing = latestByStream.get(key);
      if (!existing || execTime(r) > execTime(existing)) latestByStream.set(key, r);
    });

    // 氧氣：一條喉管同時帶清洗/更換兩排程；更換時清洗計時一併歸零；只取較早到期那條
    const oxygenStreams: any[] = [];
    oxygenByPatient.forEach((records, _patientId) => {
      const latestWash = records.filter((r: any) => r.oxygen_action === '清洗').sort((a, b) => execTime(b) - execTime(a))[0];
      const latestReplace = records.filter((r: any) => r.oxygen_action === '更換').sort((a, b) => execTime(b) - execTime(a))[0];
      const mostRecent = records.slice().sort((a, b) => execTime(b) - execTime(a))[0];
      if (!mostRecent) return;
      const washCycle = mostRecent.wash_cycle_days ?? latestWash?.wash_cycle_days ?? latestReplace?.wash_cycle_days;
      // 清洗基準日 = 最近一次清洗或更換（更換亦清潔）
      const washBaseline = [latestWash, latestReplace].filter(Boolean).sort((a, b) => execTime(b) - execTime(a))[0];
      const washDue = (washBaseline && typeof washCycle === 'number' && washCycle > 0)
        ? addDaysStr(washBaseline.execution_date, washCycle) : undefined;
      const replaceCycle = latestReplace?.replace_cycle_days;
      const replaceDue = (latestReplace && typeof replaceCycle === 'number' && replaceCycle > 0)
        ? addDaysStr(latestReplace.execution_date, replaceCycle) : undefined;
      const candidates = [
        washDue ? { action: '清洗', due: washDue, base: washBaseline } : null,
        replaceDue ? { action: '更換', due: replaceDue, base: latestReplace } : null,
      ].filter(Boolean) as { action: string; due: string; base: any }[];
      if (candidates.length === 0) return;
      // 只顯示較早到期那條
      const earliest = candidates.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())[0];
      oxygenStreams.push({ ...earliest.base, next_due_date: earliest.due, oxygen_action: earliest.action });
    });

    const finalStreams = [...Array.from(latestByStream.values()), ...oxygenStreams].filter((r: any) => {
      const p = patientsMap.get(r.patient_id);
      return p && p.在住狀態 === '在住';
    });
    const overdue = finalStreams.filter((r: any) => isTubeCareOverdue(r));
    const dueSoon = finalStreams.filter((r: any) => !isTubeCareOverdue(r) && isTubeCareDueSoon(r));
    return { overdueTubeCare: overdue, dueSoonTubeCare: dueSoon };
  }, [patientTubeCareRecords, patientsMap]);
  const urgentTubeCare = [...overdueTubeCare, ...dueSoonTubeCare];
  const { overdueHealthAssessments, dueSoonHealthAssessments } = useMemo(() => {
    // 每位院友只取最新一筆，續期（新檔）後舊記錄不再計入提醒
    const latestAssessments = pickLatestPerPatient(healthAssessments);
    const overdue = latestAssessments.filter(assessment => { const patient = patientsMap.get(assessment.patient_id); return patient && patient.在住狀態 === '在住' && isHealthAssessmentOverdue(assessment); });
    const dueSoon = latestAssessments.filter(assessment => { const patient = patientsMap.get(assessment.patient_id); return patient && patient.在住狀態 === '在住' && isHealthAssessmentDueSoon(assessment); });
    return { overdueHealthAssessments: overdue, dueSoonHealthAssessments: dueSoon };
  }, [healthAssessments, patientsMap]);
  const urgentHealthAssessments = [...overdueHealthAssessments, ...dueSoonHealthAssessments];
  const { overdueAnnualCheckups, dueSoonAnnualCheckups } = useMemo(() => {
    // 每位院友只取最新一筆（created_at 最大），避免多筆歷史記錄重複計入
    const latestCheckups = pickLatestPerPatient(annualHealthCheckups);
    const overdue = latestCheckups.filter(checkup => { const patient = patientsMap.get(checkup.patient_id); return patient && patient.在住狀態 === '在住' && isAnnualCheckupOverdue(checkup); });
    const dueSoon = latestCheckups.filter(checkup => { const patient = patientsMap.get(checkup.patient_id); return patient && patient.在住狀態 === '在住' && isAnnualCheckupDueSoon(checkup); });
    return { overdueAnnualCheckups: overdue, dueSoonAnnualCheckups: dueSoon };
  }, [annualHealthCheckups, patientsMap]);
  
  // 獲取 Dashboard 準備完成通知函數
  const { setDashboardReady } = useDashboardReady();
  
  const urgentAnnualCheckups = [...overdueAnnualCheckups, ...dueSoonAnnualCheckups];

  // 傷口評估待辦：逾期或 3 天內到期
  const urgentWoundAssessments = useMemo(() => {
    const today = new Date();
    const result: Array<{ wound: any; patientId: number; patientName: string; bedNumber: string }> = [];
    (patientsWithWounds || []).forEach(pd => {
      const patient = patients.find(p => p.院友id === pd.patient_id);
      if (!patient || patient.在住狀態 !== '在住') return;
      (pd.wounds || []).forEach(wound => {
        if (!wound.next_assessment_due || wound.status !== 'active') return;
        const dueDate = new Date(wound.next_assessment_due);
        const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (wound.is_overdue || (daysDiff >= 0 && daysDiff <= 3)) {
          result.push({ wound, patientId: pd.patient_id, patientName: pd.patient_name, bedNumber: pd.bed_number });
        }
      });
    });
    return result.sort((a, b) => new Date(a.wound.next_assessment_due).getTime() - new Date(b.wound.next_assessment_due).getTime());
  }, [patientsWithWounds, patients]);

  const filteredUrgentDocumentTasks = urgentDocumentTasks.filter(task => task.health_record_type !== '年度體檢');
  // 過濾年度體檢：只保留有有效患者的記錄
  const validAnnualCheckups = urgentAnnualCheckups.filter(checkup => 
    checkup.patient_id && patientsMap.has(checkup.patient_id)
  );
  const combinedUrgentTasks = [
    ...filteredUrgentDocumentTasks.map(task => ({ type: 'document', data: task })),
    ...urgentNursingTasks.map(task => ({ type: 'nursing', data: task })),
    ...urgentRestraintAssessments.map(assessment => ({ type: 'restraint', data: assessment })),
    ...urgentTubeCare.map(record => ({ type: 'tube-care', data: record })),
    ...urgentHealthAssessments.map(assessment => ({ type: 'health-assessment', data: assessment })),
    ...validAnnualCheckups.map(checkup => ({ type: 'annual-checkup', data: checkup })),
    ...urgentWoundAssessments.slice(0, 8).map(item => ({ type: 'wound', data: item }))
  ].sort((a, b) => {
    const getDate = (x: typeof combinedUrgentTasks[number]) => {
      if (x.type === 'document' || x.type === 'nursing') return new Date(x.data.next_due_at);
      if (x.type === 'wound') return new Date(x.data.wound.next_assessment_due || '');
      return new Date(x.data.next_due_date || '');
    };
    return getDate(a).getTime() - getDate(b).getTime();
  });
  
  // 當所有必要數據都已加載且 DOM 渲染完成後，通知 App.tsx
  useLayoutEffect(() => {
    // 必須滿足所有條件才設為 ready：
    // 1. loading 完成
    // 2. 有院友數據
    // 3. 有健康記錄數據
    // 4. useMemo 計算完成
    const hasAllRequiredData = 
      !loading &&
      Array.isArray(patients) && patients.length > 0 &&
      Array.isArray(healthRecords) && healthRecords.length > 0 &&
      Array.isArray(uniquePatientHealthTasks) &&
      patientsMap.size > 0 &&
      Array.isArray(missingTasks) &&
      Array.isArray(combinedUrgentTasks);
    
    if (hasAllRequiredData) {
      // 使用 requestAnimationFrame 確保 DOM 已經渲染
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDashboardReady(true);
        });
      });
    }
  }, [loading, patients, healthRecords, uniquePatientHealthTasks, patientsMap, missingTasks, combinedUrgentTasks, setDashboardReady]);
  
  const handleCreateMissingTask = (patient: any, taskType: string) => {
    if (taskType === '年度體檢') {
      setPrefilledAnnualCheckupPatientId(patient.院友id);
      setSelectedAnnualCheckup(null);
      setShowAnnualCheckupModal(true);
    } else {
      const defaultFrequency = { unit: 'daily', value: 1 };
      const prefilledData = {
        patient_id: patient.院友id,
        health_record_type: taskType,
        frequency_unit: defaultFrequency.unit,
        frequency_value: defaultFrequency.value,
        specific_times: '08:00',
        notes: '定期',
        is_recurring: true
      };
      setPrefilledTaskData(prefilledData);
      setShowTaskModal(true);
    }
  };
  const handleAddMealGuidance = (patient: any) => {
    const prefilledData = { patient_id: patient.院友id, meal_combination: '正飯+正餸' };
    setPrefilledMealData(prefilledData);
    setShowMealGuidanceModal(true);
  };
  const handleEditPatientForDeathDate = (patient: any) => {
    const fullPatient = patients.find(p => p.院友id === patient.院友id);
    setSelectedPatientForEdit(fullPatient);
    setShowPatientModal(true);
  };
  const handleAddVaccinationRecord = (patient: any) => {
    setSelectedPatientForVaccination(patient);
    setShowVaccinationModal(true);
  };
  const handleAddHealthAssessment = (patient: any) => {
    setSelectedHealthAssessment({
      patient_id: patient.院友id,
      patient_name: `${patient.中文姓氏}${patient.中文名字}`,
      bed_number: patient.床號
    });
    setShowHealthAssessmentModal(true);
  };
  const handleAddCarePlan = (patient: any) => {
    // Navigate to individual care plan page with the patient selected
    window.location.href = `/individual-care-plan?patient_id=${patient.院友id}`;
  };
  const handleAddActivityRecord = (patient: any) => {
    setActivityRecordPatientId(patient.院友id);
    setShowActivityRecordModal(true);
  };
  const handleTaskCompleted = (taskId: string) => {
    // 不再立即關閉 modal，改為背景同步，避免全畫面重整
    void (async () => {
      try {
        await syncTaskStatus(taskId);
        await refreshHealthTaskData();
      } catch (error) {
        console.error('同步失敗:', error);
      }
    })();
  };
  // [自動修復機制] 在頁面首次載入時，檢查並修復 next_due_at 過期但有最新記錄的任務
  // 使用 useRef 來追蹤是否已執行過，避免重複執行
  const autoFixExecutedRef = React.useRef(false);
  useEffect(() => {
    const autoFixOutdatedTasks = async () => {
      // 只在首次載入時執行一次
      if (autoFixExecutedRef.current) return;
      if (loading || !patientHealthTasks.length || !healthRecords.length) return;
      autoFixExecutedRef.current = true;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = formatLocalDate(today);
      // 找出所有 next_due_at 過期超過3天的任務
      const outdatedTasks = patientHealthTasks.filter(task => {
        if (!task.next_due_at) return false;
        const nextDueDate = new Date(task.next_due_at);
        nextDueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
        // 只修復過期超過3天的任務（避免誤修復今天或昨天的正常逾期任務）
        return daysDiff > 3;
      });
      if (outdatedTasks.length === 0) return;
      const tasksToSync: string[] = [];
      for (const task of outdatedTasks) {
        const nextDueDate = new Date(task.next_due_at!);
        const taskRecords = healthRecords.filter(r => {
          if (r.任務id === task.id) return true;
          return r.院友id?.toString() === task.patient_id?.toString() &&
                 r.監測類型 === task.health_record_type;
        });
        if (taskRecords.length === 0) continue;
        const latestRecordDate = taskRecords.reduce((latest, r) => {
          const recordDate = new Date(r.記錄日期);
          return recordDate > latest ? recordDate : latest;
        }, new Date('2000-01-01'));
        if (latestRecordDate > nextDueDate) {
          tasksToSync.push(task.id);
        }
      }
      if (tasksToSync.length > 0) {
        for (const taskId of tasksToSync) {
          try {
            await syncTaskStatus(taskId);
          } catch (error) {
            // Silent error
          }
        }
        // 不再調用 refreshData()，避免不必要的刷新
      }
    };
    // 延遲1秒執行，確保所有數據都已載入
    const timer = setTimeout(autoFixOutdatedTasks, 1000);
    return () => clearTimeout(timer);
  }, [loading, patientHealthTasks, healthRecords]);
  const handleDocumentTaskCompleted = async (taskId: string, completionDate: string, nextDueDate: string, tubeType?: string, tubeSize?: string) => {
    try {
      const task = patientHealthTasks.find(t => t.id === taskId);
      if (!task) throw new Error('未找到對應任務');
      const updatedTask = {
        ...task,
        last_completed_at: completionDate,
        next_due_at: nextDueDate ? new Date(nextDueDate).toISOString() : null,
        tube_type: tubeType || task.tube_type,
        tube_size: tubeSize || task.tube_size
      };
      setShowDocumentTaskModal(false);
      setSelectedDocumentTask(null);
      setPatientHealthTasks(prev => {
        if (updatedTask.next_due_at === null) return prev.filter(t => t.id !== taskId);
        return prev.map(t => t.id === taskId ? (updatedTask as PatientHealthTask) : t);
      });
      updatePatientHealthTask(updatedTask as PatientHealthTask).then(() => refreshData()).catch(err => {
        console.error('文件任務更新失敗:', err);
        alert(`文件任務失敗: ${err.message}`);
        return refreshData();
      });
    } catch (error) {
      console.error('文件任務失敗:', error);
      alert(`文件任務失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      setShowDocumentTaskModal(false);
      setSelectedDocumentTask(null);
      await refreshData();
    }
  };
  const getNotesBadgeClass = (notes: string) => {
    switch (notes) {
      case '服藥前': return 'bg-blue-500 text-white';
      case '注射前': return 'bg-red-500 text-white';
      case '定期': return 'bg-green-500 text-white';
      case '特別關顧': return 'bg-orange-500 text-white';
      case '社康': return 'bg-purple-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };
  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case '生命表徵': return <Activity className="h-4 w-4" />;
      case '血糖控制': return <Droplets className="h-4 w-4" />;
      case '體重控制': return <Scale className="h-4 w-4" />;
      case '約束物品同意書': return <FileText className="h-4 w-4" />;
      case '年度體檢': return <Stethoscope className="h-4 w-4" />;
      case '導尿管更換': return <FileText className="h-4 w-4" />;
      case '鼻胃飼管更換': return <FileText className="h-4 w-4" />;
      case '傷口換症': return <FileText className="h-4 w-4" />;
      case '預設醫療指示': return <Heart className="h-4 w-4" />;
      default: return <CheckSquare className="h-4 w-4" />;
    }
  };
  const slotBgClasses = [
    'bg-red-100 hover:bg-red-200',      // 早餐
    'bg-yellow-100 hover:bg-yellow-200', // 午餐
    'bg-green-100 hover:bg-green-200',   // 晚餐
    'bg-purple-100 hover:bg-purple-200', // 夜宵
    'bg-orange-100 hover:bg-orange-200', // 體溫
    'bg-teal-100 hover:bg-teal-200',     // 體重
  ];
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case '尚未安排': return 'bg-red-100 text-red-800';
      case '已安排': return 'bg-blue-100 text-blue-800';
      case '已完成': return 'bg-green-100 text-green-800';
      case '改期': return 'bg-orange-100 text-orange-800';
      case '取消': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // App.tsx 已經在所有數據加載完成前顯示 LoadingScreen
  // 所以這裡不需要再檢查 loading 狀態

  return (
    <div className="space-y-6 lg:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-gray-500">
          最後更新: {formatDisplayDateTime(new Date())}
        </div>
      </div>
      {/* 提醒卡直接做 grid children：卡片無資料時會 return null，
          外面再包 col-span-1 div 會留低空格位，造成中間間隔 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 min-w-0 w-full">
        <NotesCard />
        <MissingRequirementsCard
          missingTasks={missingTasks}
          missingMealGuidance={missingMealGuidance}
          missingDeathDate={missingDeathDate}
          missingVaccination={missingVaccination}
          missingHealthAssessment={missingHealthAssessment}
          missingCarePlan={missingCarePlan}
          onCreateTask={handleCreateMissingTask}
          onAddMealGuidance={handleAddMealGuidance}
          onEditPatient={handleEditPatientForDeathDate}
          onAddVaccinationRecord={handleAddVaccinationRecord}
          onAddHealthAssessment={handleAddHealthAssessment}
          onAddCarePlan={handleAddCarePlan}
        />
        <CarePlanDueReminderCard carePlans={carePlans} patients={patients} />
        <MedicationRemindersCard overdueWorkflows={overdueWorkflows} pendingPrescriptions={pendingPrescriptions} lowStockGroups={lowStockGroups} />
        <ActivityRecordReminderCard
          activityRecords={activityRecords}
          onAddActivityRecord={handleAddActivityRecord}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 min-w-0 w-full">
        <div className="card p-3 sm:p-4 lg:p-4 lg:col-span-2 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 section-title">監測任務</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowWorksheetModal(true)}
                className="btn-primary flex flex-wrap items-center gap-2 text-sm"
              >
                <FileText className="h-4 w-4" />
                <span>匯出監測記錄工作紙</span>
              </button>
              <button
                onClick={() => setShowOCRModal(true)}
                className="btn-secondary flex items-center gap-1.5 text-sm"
                title="拍照識別監測工作紙"
              >
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">識別工作紙</span>
              </button>
              <Link to="/tasks" className="text-sm text-blue-600 hover:text-blue-700 font-medium">查看全部</Link>
            </div>
          </div>
          <div className="space-y-6 lg:space-y-3">
            {[
              { title: "早餐 (07:00 - 09:59)", tasks: taskGroups.breakfast },
              { title: "午餐 (10:00 - 12:59)", tasks: taskGroups.lunch },
              { title: "晚餐 (13:00 - 17:59)", tasks: taskGroups.dinner },
              { title: "夜宵 (18:00 - 20:00)", tasks: taskGroups.snack }
            ].map((slot, idx) => {
              const slotBgClass = slotBgClasses[idx] ?? 'bg-gray-50 hover:bg-gray-100';
              return slot.tasks.length > 0 && (
                <div key={idx}>
                  <h3 className="text-md font-medium text-gray-700 mb-2 time-slot-title">{slot.title}</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-2 w-full min-w-0">
                    {(() => {
                      // 同一院友、同一時間點的多種監測類型整合為一張卡片（逾期與今日未完成合併顯示）
                      const padTime = (t: string) => {
                        const [h, m] = (t || '').split(':');
                        return `${String(Number(h) || 0).padStart(2, '0')}:${String(Number(m) || 0).padStart(2, '0')}`;
                      };
                      const earliestTime = (t: typeof slot.tasks[number]) => {
                        if (t.specific_times && t.specific_times.length > 0) {
                          return t.specific_times.map(normalizeTime).map(padTime).sort()[0];
                        }
                        return new Date(t.next_due_at).toTimeString().slice(0, 5);
                      };
                      const groups = new Map<string, typeof slot.tasks>();
                      slot.tasks.forEach(t => {
                        const timeToken = earliestTime(t);
                        const key = `${t.patient_id}_${timeToken}`;
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key)!.push(t);
                      });
                      return Array.from(groups.entries())
                        .sort(([ka, ga], [kb, gb]) => {
                          // 與工作紙(monitoringTaskWorksheetGenerator)完全一致：時間 → 備註優先序 → 床號(localeCompare)
                          const toMin = (k: string) => { const t = k.split('_')[1] || '00:00'; const [h, m] = t.split(':'); return (Number(h) || 0) * 60 + (Number(m) || 0); };
                          const ma = toMin(ka); const mb = toMin(kb);
                          if (ma !== mb) return ma - mb;
                          const notePriority = (note: string) => {
                            if (note.includes('注射前')) return 1;
                            if (note.includes('服藥前')) return 2;
                            if (note.includes('特別關顧')) return 3;
                            if (note.includes('定期')) return 4;
                            return 5;
                          };
                          const groupNote = (g: typeof ga) => Math.min(...g.map(t => notePriority(t.notes || '')));
                          const na = groupNote(ga); const nb = groupNote(gb);
                          if (na !== nb) return na - nb;
                          const pa = ka.split('_')[0];
                          const pb = kb.split('_')[0];
                          const bedA = patients.find(p => String(p.院友id) === pa)?.床號 || '';
                          const bedB = patients.find(p => String(p.院友id) === pb)?.床號 || '';
                          return bedA.localeCompare(bedB);
                        })
                        .map(([groupKey, group]) => {
                        // 以最早 firstIncompleteDate 為代表任務（確保逾期日期優先作為 initialDate）
                        const rep = [...group].sort((a, b) => {
                          const da = a.firstIncompleteDate?.getTime() ?? Infinity;
                          const db = b.firstIncompleteDate?.getTime() ?? Infinity;
                          return da - db;
                        })[0];
                        const patient = patients.find(p => p.院友id === rep.patient_id);
                        const todayStrCard = formatLocalDate(new Date());
                        const isOverdueCard = group.some(t => t.firstIncompleteDate ? formatLocalDate(t.firstIncompleteDate) < todayStrCard : false);
                        const hasMultipleDates = group.some(t => t.incompleteDates && t.incompleteDates.length > 1) || isOverdueCard;
                        return (
                        <div
                          key={groupKey || rep.id}
                          className={`relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 ${slotBgClass} rounded-lg cursor-pointer transition-colors dashboard-task-card w-full min-w-0`}
                          onClick={() => {
                            // 逾期或有多个未完成日期，弹出小日历以便補回
                            if (hasMultipleDates && patient) {
                              setSelectedHistoryTask({
                                task: rep,
                                patient,
                                initialDate: rep.firstIncompleteDate || null,
                                groupTasks: group,
                              });
                              setShowHistoryModal(true);
                            } else {
                              // 只有一个日期，直接打开记录模态框（同時間多種監測類型一起輸入）
                              handleTaskClick(rep, undefined, group);
                            }
                          }}
                        >
                          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center task-avatar">
                              {patient?.院友相片 ? (
                                <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : ''}</p>
                                {patient ? <BedNumberImprint patient={patient} beds={beds} size="sm" className="text-xs text-gray-500" /> : <span className="text-xs text-gray-500">—</span>}
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {(() => {
                                  // 按「備註 × 頻率」分組，每個唯一組合顯示一個小塊
                                  type FreqGroup = { count: number; note: string; freqTask: typeof group[number] };
                                  const freqGroups = new Map<string, FreqGroup>();
                                  group.forEach(t => {
                                    const note = (t.notes && isMonitoringTask(t.health_record_type)) ? t.notes : '';
                                    const key = `${note}||${t.frequency_unit}||${t.frequency_value}`;
                                    if (!freqGroups.has(key)) freqGroups.set(key, { count: 0, note, freqTask: t });
                                    freqGroups.get(key)!.count += 1;
                                  });
                                  return Array.from(freqGroups.values()).map(({ count, note, freqTask }, i) => (
                                    <span key={i} className="inline-flex flex-col px-2 py-1 bg-white/70 rounded-lg border border-white/60 text-xs text-gray-700">
                                      <span className="flex items-center gap-1">
                                        <span className="font-medium">{count}個項目</span>
                                        {note && <span className={`px-1.5 rounded-full font-medium ${getNotesBadgeClass(note)}`}>{note}</span>}
                                      </span>
                                      <span className="flex items-center gap-0.5 text-gray-500 mt-0.5">
                                        <Repeat className="h-2.5 w-2.5 flex-shrink-0" />
                                        <span>{formatFrequencyDescription(freqTask)}</span>
                                      </span>
                                    </span>
                                  ));
                                })()}
                              </div>
                            </div>
                            <span className={`status-badge flex-shrink-0 ${
                              isOverdueCard ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {isOverdueCard ? '逾期' : '未完成'}
                            </span>
                          </div>
                        </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              );
            })}
            {/* 體溫 時段 */}
            {temperatureTasks.length > 0 && (() => {
              const slotBgClass = slotBgClasses[4];
              const todayStrCard = formatLocalDate(new Date());
              const groups = new Map<string, typeof temperatureTasks>();
              temperatureTasks.forEach(t => {
                const key = String(t.patient_id);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(t);
              });
              return (
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-2 time-slot-title">體溫</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-2 w-full min-w-0">
                    {Array.from(groups.entries())
                      .sort(([ka, ga], [kb, gb]) => {
                        const aOv = ga.some(t => t.firstIncompleteDate ? formatLocalDate(t.firstIncompleteDate) < todayStrCard : false);
                        const bOv = gb.some(t => t.firstIncompleteDate ? formatLocalDate(t.firstIncompleteDate) < todayStrCard : false);
                        if (aOv !== bOv) return aOv ? -1 : 1;
                        const bedA = patients.find(p => String(p.院友id) === ka)?.床號 || '';
                        const bedB = patients.find(p => String(p.院友id) === kb)?.床號 || '';
                        return bedA.localeCompare(bedB, 'zh-Hant', { numeric: true });
                      })
                      .map(([groupKey, group]) => {
                        const rep = [...group].sort((a, b) => (a.firstIncompleteDate?.getTime() ?? Infinity) - (b.firstIncompleteDate?.getTime() ?? Infinity))[0];
                        const patient = patients.find(p => p.院友id === rep.patient_id);
                        const isOverdueCard = group.some(t => t.firstIncompleteDate ? formatLocalDate(t.firstIncompleteDate) < todayStrCard : false);
                        const hasMultipleDates = group.some(t => t.incompleteDates && t.incompleteDates.length > 1) || isOverdueCard;
                        return (
                          <div
                            key={groupKey || rep.id}
                            className={`relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 ${slotBgClass} rounded-lg cursor-pointer transition-colors dashboard-task-card w-full min-w-0`}
                            onClick={() => {
                              if (hasMultipleDates && patient) {
                                setSelectedHistoryTask({ task: rep, patient, initialDate: rep.firstIncompleteDate || null, groupTasks: group });
                                setShowHistoryModal(true);
                              } else {
                                handleTaskClick(rep, undefined, group);
                              }
                            }}
                          >
                            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center task-avatar">
                                {patient?.院友相片 ? (
                                  <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : ''}</p>
                                  {patient ? <BedNumberImprint patient={patient} beds={beds} size="sm" className="text-xs text-gray-500" /> : <span className="text-xs text-gray-500">—</span>}
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {(() => {
                                    type FreqGroup = { count: number; note: string; freqTask: typeof group[number] };
                                    const freqGroups = new Map<string, FreqGroup>();
                                    group.forEach(t => {
                                      const note = (t.notes && isMonitoringTask(t.health_record_type)) ? t.notes : '';
                                      const key = `${note}||${t.frequency_unit}||${t.frequency_value}`;
                                      if (!freqGroups.has(key)) freqGroups.set(key, { count: 0, note, freqTask: t });
                                      freqGroups.get(key)!.count += 1;
                                    });
                                    return Array.from(freqGroups.values()).map(({ count, note, freqTask }, i) => (
                                      <span key={i} className="inline-flex flex-col px-2 py-1 bg-white/70 rounded-lg border border-white/60 text-xs text-gray-700">
                                        <span className="flex items-center gap-1">
                                          <span className="font-medium">{count}個項目</span>
                                          {note && <span className={`px-1.5 rounded-full font-medium ${getNotesBadgeClass(note)}`}>{note}</span>}
                                        </span>
                                        <span className="flex items-center gap-0.5 text-gray-500 mt-0.5">
                                          <Repeat className="h-2.5 w-2.5 flex-shrink-0" />
                                          <span>{formatFrequencyDescription(freqTask)}</span>
                                        </span>
                                      </span>
                                    ));
                                  })()}
                                </div>
                              </div>
                              <span className={`status-badge flex-shrink-0 ${isOverdueCard ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {isOverdueCard ? '逾期' : '未完成'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })()}
            {/* 體重 時段 */}
            {weightTasks.length > 0 && (() => {
              const slotBgClass = slotBgClasses[5];
              const todayStrCard = formatLocalDate(new Date());
              const groups = new Map<string, typeof weightTasks>();
              weightTasks.forEach(t => {
                const key = String(t.patient_id);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(t);
              });
              return (
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-2 time-slot-title">體重</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-2 w-full min-w-0">
                    {Array.from(groups.entries())
                      .sort(([ka, ga], [kb, gb]) => {
                        const aOv = ga.some(t => t.firstIncompleteDate ? formatLocalDate(t.firstIncompleteDate) < todayStrCard : false);
                        const bOv = gb.some(t => t.firstIncompleteDate ? formatLocalDate(t.firstIncompleteDate) < todayStrCard : false);
                        if (aOv !== bOv) return aOv ? -1 : 1;
                        const bedA = patients.find(p => String(p.院友id) === ka)?.床號 || '';
                        const bedB = patients.find(p => String(p.院友id) === kb)?.床號 || '';
                        return bedA.localeCompare(bedB, 'zh-Hant', { numeric: true });
                      })
                      .map(([groupKey, group]) => {
                        const rep = [...group].sort((a, b) => (a.firstIncompleteDate?.getTime() ?? Infinity) - (b.firstIncompleteDate?.getTime() ?? Infinity))[0];
                        const patient = patients.find(p => p.院友id === rep.patient_id);
                        const isOverdueCard = group.some(t => t.firstIncompleteDate ? formatLocalDate(t.firstIncompleteDate) < todayStrCard : false);
                        const hasMultipleDates = group.some(t => t.incompleteDates && t.incompleteDates.length > 1) || isOverdueCard;
                        return (
                          <div
                            key={groupKey || rep.id}
                            className={`relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 ${slotBgClass} rounded-lg cursor-pointer transition-colors dashboard-task-card w-full min-w-0`}
                            onClick={() => {
                              if (hasMultipleDates && patient) {
                                setSelectedHistoryTask({ task: rep, patient, initialDate: rep.firstIncompleteDate || null, groupTasks: group });
                                setShowHistoryModal(true);
                              } else {
                                handleTaskClick(rep, undefined, group);
                              }
                            }}
                          >
                            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center task-avatar">
                                {patient?.院友相片 ? (
                                  <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : ''}</p>
                                  {patient ? <BedNumberImprint patient={patient} beds={beds} size="sm" className="text-xs text-gray-500" /> : <span className="text-xs text-gray-500">—</span>}
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {(() => {
                                    type FreqGroup = { count: number; note: string; freqTask: typeof group[number] };
                                    const freqGroups = new Map<string, FreqGroup>();
                                    group.forEach(t => {
                                      const note = (t.notes && isMonitoringTask(t.health_record_type)) ? t.notes : '';
                                      const key = `${note}||${t.frequency_unit}||${t.frequency_value}`;
                                      if (!freqGroups.has(key)) freqGroups.set(key, { count: 0, note, freqTask: t });
                                      freqGroups.get(key)!.count += 1;
                                    });
                                    return Array.from(freqGroups.values()).map(({ count, note, freqTask }, i) => (
                                      <span key={i} className="inline-flex flex-col px-2 py-1 bg-white/70 rounded-lg border border-white/60 text-xs text-gray-700">
                                        <span className="flex items-center gap-1">
                                          <span className="font-medium">{count}個項目</span>
                                          {note && <span className={`px-1.5 rounded-full font-medium ${getNotesBadgeClass(note)}`}>{note}</span>}
                                        </span>
                                        <span className="flex items-center gap-0.5 text-gray-500 mt-0.5">
                                          <Repeat className="h-2.5 w-2.5 flex-shrink-0" />
                                          <span>{formatFrequencyDescription(freqTask)}</span>
                                        </span>
                                      </span>
                                    ));
                                  })()}
                                </div>
                              </div>
                              <span className={`status-badge flex-shrink-0 ${isOverdueCard ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {isOverdueCard ? '逾期' : '未完成'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })()}
            {breakfastTasks.length === 0 && lunchTasks.length === 0 && dinnerTasks.length === 0 && snackTasks.length === 0 && temperatureTasks.length === 0 && weightTasks.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>無待處理任務</p>
              </div>
            )}
          </div>
        </div>
        <div className="card p-6 lg:p-4 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 section-title">待辦事項</h2>
            <Link to="/tasks" className="text-sm text-blue-600 hover:text-blue-700 font-medium">查看全部</Link>
          </div>
          <div className="space-y-3">
             {combinedUrgentTasks.map((item, index) => {
               if (item.type === 'document' || item.type === 'nursing') {
                 const task = item.data;
                 const patient = patients.find(p => p.院友id === task.patient_id);
                 const status = getTaskStatus(task);
                 return (
                    <div key={`${item.type}-${task.id}`} className={`flex flex-wrap items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${item.type === 'nursing' ? 'bg-teal-50 hover:bg-teal-100 border border-teal-200' : 'bg-gray-50 hover:bg-gray-100'}`} onClick={() => handleDocumentTaskClick(task)}>
                        <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ${item.type === 'nursing' ? 'bg-teal-100' : 'bg-blue-100'}`}>
                           {patient?.院友相片 ? <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" /> : <User className={`h-5 w-5 ${item.type === 'nursing' ? 'text-teal-600' : 'text-blue-600'}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : ''}</p>
                                {patient ? <BedNumberImprint patient={patient} beds={beds} size="sm" className="text-xs text-gray-500" /> : <span className="text-xs text-gray-500">—</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                {getTaskTypeIcon(task.health_record_type)}
                                <p className="text-sm text-gray-600">{task.health_record_type}</p>
                            </div>
                             {task.notes && <p className="text-xs text-gray-500 mt-1">{task.notes}</p>}
                            <p className="text-xs text-gray-500">到期: {formatDisplayDate(task.next_due_at)}</p>
                        </div>
                         <span className={`status-badge ${status === 'overdue' ? 'bg-red-100 text-red-800' : status === 'pending' ? 'bg-green-100 text-green-800' : status === 'due_soon' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}`}>
                            {status === 'overdue' ? '逾期' : status === 'pending' ? '未完成' : status === 'due_soon' ? '即將到期' : '排程中'}
                        </span>
                    </div>
                 )
               } else {
                  const assessment = item.data;
                  const patient = patients.find(p => p.院友id === assessment.patient_id);
                  if (item.type === 'tube-care') {
                    const record = item.data;
                    const isOverdue = isTubeCareOverdue(record);
                    const isDueSoon = isTubeCareDueSoon(record);
                    const detail = record.care_type === '氧氣喉管清洗/更換'
                      ? `氧氣喉管${record.oxygen_action ?? ''}`
                      : record.care_type;
                    return (
                      <div key={`tube-care-${record.id}`} className="flex flex-wrap items-center gap-3 p-3 bg-teal-50 rounded-lg cursor-pointer hover:bg-teal-100 transition-colors border border-teal-200" onClick={() => handleTubeCareClick(record)}>
                        <div className="w-10 h-10 bg-teal-100 rounded-full overflow-hidden flex items-center justify-center">
                          {patient?.院友相片 ? (
                            <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-teal-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : ''}</p>
                            {patient ? <BedNumberImprint patient={patient} beds={beds} size="sm" className="text-xs text-gray-500" /> : <span className="text-xs text-gray-500">—</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Stethoscope className="h-4 w-4 text-teal-600" />
                            <p className="text-sm text-gray-600">{detail}</p>
                          </div>
                          <p className="text-xs text-gray-500">到期: {record.next_due_date ? formatDisplayDate(record.next_due_date) : '未設定'}</p>
                        </div>
                        <span className={`status-badge ${isOverdue ? 'bg-red-100 text-red-800' : isDueSoon ? 'bg-orange-100 text-orange-800' : 'bg-teal-100 text-teal-800'}`}>
                          {isOverdue ? '逾期' : isDueSoon ? '即將到期' : '排程中'}
                        </span>
                      </div>
                    );
                  } else if (item.type === 'restraint') {
                    const isOverdue = isRestraintAssessmentOverdue(assessment);
                    const isDueSoon = isRestraintAssessmentDueSoon(assessment);
                    return (
                      <div key={`restraint-${assessment.id}`} className="flex flex-wrap items-center gap-3 p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors border border-yellow-200" onClick={() => handleRestraintAssessmentClick(assessment)}>
                         <div className="w-10 h-10 bg-yellow-100 rounded-full overflow-hidden flex items-center justify-center">
                          {patient?.院友相片 ? (
                            <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-yellow-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : ''}</p>
                            {patient ? <BedNumberImprint patient={patient} beds={beds} size="sm" className="text-xs text-gray-500" /> : <span className="text-xs text-gray-500">—</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Shield className="h-4 w-4 text-yellow-600" />
                            <p className="text-sm text-gray-600">約束物品評估</p>
                          </div>
                          <p className="text-xs text-gray-500">到期: {assessment.next_due_date ? formatDisplayDate(assessment.next_due_date) : '未設定'}</p>
                        </div>
                        <span className={`status-badge ${isOverdue ? 'bg-red-100 text-red-800' : isDueSoon ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {isOverdue ? '逾期' : isDueSoon ? '即將到期' : '排程中'}
                        </span>
                      </div>
                    );
                  } else if (item.type === 'health-assessment') {
                     const isOverdue = isHealthAssessmentOverdue(assessment);
                    const isDueSoon = isHealthAssessmentDueSoon(assessment);
                    return (
                      <div key={`health-assessment-${assessment.id}`} className="flex flex-wrap items-center gap-3 p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors border border-red-200" onClick={() => handleHealthAssessmentClick(assessment)}>
                         <div className="w-10 h-10 bg-red-100 rounded-full overflow-hidden flex items-center justify-center">
                          {patient?.院友相片 ? (
                            <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : ''}</p>
                            {patient ? <BedNumberImprint patient={patient} beds={beds} size="sm" className="text-xs text-gray-500" /> : <span className="text-xs text-gray-500">—</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Stethoscope className="h-4 w-4 text-red-600" />
                            <p className="text-sm text-gray-600">健康評估</p>
                          </div>
                          <p className="text-xs text-gray-500">到期: {assessment.next_due_date ? formatDisplayDate(assessment.next_due_date) : '未設定'}</p>
                        </div>
                        <span className={`status-badge ${isOverdue ? 'bg-red-100 text-red-800' : isDueSoon ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                          {isOverdue ? '逾期' : isDueSoon ? '即將到期' : '排程中'}
                        </span>
                      </div>
                    );
                  } else if (item.type === 'wound') {
                    const wItem = item.data;
                    const wound = wItem.wound;
                    const isOverdue = wound.is_overdue;
                    return (
                      <a href="/wound" key={`wound-${wound.id}`} className="block" onClick={e => { e.preventDefault(); setSelectedWoundForAssessment(wound); setShowWoundAssessmentModal(true); }}>
                        <div className={`flex flex-wrap items-center gap-3 p-3 rounded-lg transition-colors border ${
                          isOverdue ? 'bg-red-50 hover:bg-red-100 border-red-200' : 'bg-orange-50 hover:bg-orange-100 border-orange-200'
                        }`}>
                          <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ${
                            isOverdue ? 'bg-red-100' : 'bg-orange-100'
                          }`}>
                            {patient?.院友相片
                              ? <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                              : <Activity className={`h-5 w-5 ${isOverdue ? 'text-red-600' : 'text-orange-600'}`} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : wItem.patientName}</p>
                              <span className="text-xs text-gray-500">({wItem.bedNumber})</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Activity className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-orange-500'}`} />
                              <p className="text-sm text-gray-600">傷口評估 — {wound.wound_code}</p>
                              {wound.wound_name && <span className="text-xs text-gray-400">{wound.wound_name}</span>}
                            </div>
                            <p className="text-xs text-gray-500">到期: {wound.next_assessment_due ? formatDisplayDate(wound.next_assessment_due) : '未設定'}</p>
                          </div>
                          <span className={`status-badge ${isOverdue ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                            {isOverdue ? '逾期' : '即將到期'}
                          </span>
                        </div>
                      </a>
                    );
                  } else if (item.type === 'annual-checkup') {
                    const checkup = item.data;
                    const isOverdue = isAnnualCheckupOverdue(checkup);
                    const isDueSoon = isAnnualCheckupDueSoon(checkup);
                    return (
                      <div key={`annual-checkup-${checkup.id}`} className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors border border-blue-200" onClick={() => handleAnnualCheckupClick(checkup)}>
                        <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                          {patient?.院友相片 ? (
                            <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : ''}</p>
                            {patient ? <BedNumberImprint patient={patient} beds={beds} size="sm" className="text-xs text-gray-500" /> : <span className="text-xs text-gray-500">—</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <CalendarCheck className="h-4 w-4 text-blue-600" />
                            <p className="text-sm text-gray-600">年度體檢</p>
                          </div>
                          <p className="text-xs text-gray-500">到期: {checkup.next_due_date ? formatDisplayDate(checkup.next_due_date) : '未設定'}</p>
                        </div>
                        <span className={`status-badge ${isOverdue ? 'bg-red-100 text-red-800' : isDueSoon ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                          {isOverdue ? '逾期' : isDueSoon ? '即將到期' : '排程中'}
                        </span>
                      </div>
                    );
                  }
               }
             })}
</div>
        </div>
        <div className="card p-6 lg:p-4 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 section-title">近期覆診</h2>
            <Link to="/follow-up" className="text-sm text-blue-600 hover:text-blue-700 font-medium">查看全部</Link>
          </div>
          <div className="space-y-3">
             {upcomingFollowUps.map(appointment => {
                const patient = patients.find(p => p.院友id === appointment.院友id);
                return (
                   <div key={appointment.覆診id} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleFollowUpClick(appointment)}>
                      <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center task-avatar">
                        {patient?.院友相片 ? <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">{patient ? `${patient.中文姓氏}${patient.中文名字}` : ''}</p>
                          {patient ? <BedNumberImprint patient={patient} beds={beds} size="sm" className="text-xs text-gray-500" /> : <span className="text-xs text-gray-500">—</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <p className="text-sm text-gray-600">{appointment.覆診專科}</p>
                        </div>
                        <p className="text-xs text-gray-500">{formatDisplayDate(appointment.覆診日期)} - {appointment.覆診地點}</p>
                      </div>
                      <span className={`status-badge ${getStatusBadgeClass(appointment.狀態)}`}>{appointment.狀態}</span>
                   </div>
                )
             })}
          </div>
        </div>
      </div>
      {showTaskModal && (
        <TaskModal
          task={prefilledTaskData}
          onClose={() => { setShowTaskModal(false); setPrefilledTaskData(null); }}
          onUpdate={refreshHealthTaskData}
        />
      )}
      {showMealGuidanceModal && (
        <MealGuidanceModal
          guidance={prefilledMealData}
          onClose={() => { setShowMealGuidanceModal(false); setPrefilledMealData(null); }}
        />
      )}
      {showHealthRecordModal && (
        <HealthRecordModal
          initialData={selectedHealthRecordInitialData}
          onClose={() => {
            lastHealthModalCloseAtRef.current = Date.now();
            setShowHealthRecordModal(false);
            setSelectedHealthRecordInitialData({});
          }}
          onTaskCompleted={handleTaskCompleted}
        />
      )}
      {/* 歷史日曆 Modal */}
      {showHistoryModal && selectedHistoryTask && (
        <TaskHistoryModal
          task={selectedHistoryTask.task}
          patient={selectedHistoryTask.patient}
          healthRecords={healthRecords}
          initialDate={selectedHistoryTask.initialDate}
          cutoffDateStr={selectedHistoryTask.patient.入住日期 || SYNC_CUTOFF_DATE_STR}
          onClose={() => setShowHistoryModal(false)}
          onDateSelect={(date) => {
            handleTaskClick(selectedHistoryTask.task, date, selectedHistoryTask.groupTasks);
            // 選擇日期後關閉日曆
            setShowHistoryModal(false);
          }}
        />
      )}
      {showDocumentTaskModal && selectedDocumentTask && <DocumentTaskModal onClose={() => { setShowDocumentTaskModal(false); setSelectedDocumentTask(null); }} task={selectedDocumentTask.task} patient={selectedDocumentTask.patient} onTaskCompleted={handleDocumentTaskCompleted} />}
      {showFollowUpModal && selectedFollowUp && <FollowUpModal onClose={() => { setShowFollowUpModal(false); setSelectedFollowUp(null); }} appointment={selectedFollowUp} />}
      {showRestraintAssessmentModal && <RestraintAssessmentModal onClose={() => { setShowRestraintAssessmentModal(false); setSelectedRestraintAssessment(null); setRenewFromRestraintAssessment(null); }} assessment={selectedRestraintAssessment ?? undefined} renewFrom={renewFromRestraintAssessment} onUpdate={refreshData} />}
      {showTubeCareModal && <TubeCareModal onClose={() => { setShowTubeCareModal(false); setSelectedTubeCareRecord(null); setRenewFromTubeCare(null); }} record={selectedTubeCareRecord ?? undefined} renewFrom={renewFromTubeCare} onUpdate={refreshData} />}
      {showHealthAssessmentModal && selectedHealthAssessment && <HealthAssessmentModal onClose={() => { setShowHealthAssessmentModal(false); setSelectedHealthAssessment(null); }} assessment={selectedHealthAssessment} />}
      {showActivityRecordModal && (
        <ActivityRecordModal
          onClose={() => { setShowActivityRecordModal(false); setActivityRecordPatientId(undefined); }}
          defaultPatientId={activityRecordPatientId}
        />
      )}
      {showAnnualCheckupModal && <AnnualHealthCheckupModal checkup={selectedAnnualCheckup} renewFrom={renewFromAnnualCheckup} onClose={() => { setShowAnnualCheckupModal(false); setSelectedAnnualCheckup(null); setRenewFromAnnualCheckup(null); setPrefilledAnnualCheckupPatientId(null); }} onSave={refreshData} prefilledPatientId={prefilledAnnualCheckupPatientId} />}
      {showPatientModal && <PatientModal patient={selectedPatientForEdit} onClose={() => { setShowPatientModal(false); setSelectedPatientForEdit(null); refreshData(); }} />}
      {showVaccinationModal && <VaccinationRecordModal patientId={selectedPatientForVaccination?.院友id} onClose={() => { setShowVaccinationModal(false); setSelectedPatientForVaccination(null); }} />}
      {showWorksheetModal && (
        <MonitoringTaskWorksheetModal
          onClose={() => setShowWorksheetModal(false)}
        />
      )}
      {showOCRModal && (
        <BatchHealthRecordOCRModal onClose={() => setShowOCRModal(false)} />
      )}
      {showWoundAssessmentModal && selectedWoundForAssessment && (
        <SingleWoundAssessmentModal
          wound={selectedWoundForAssessment}
          prefillFrom={selectedWoundForAssessment.assessments?.[0] ?? null}
          onClose={() => { setShowWoundAssessmentModal(false); setSelectedWoundForAssessment(null); }}
          onSave={() => { setShowWoundAssessmentModal(false); setSelectedWoundForAssessment(null); refreshWoundData(); }}
        />
      )}
    </div>
  );
};
export default Dashboard;