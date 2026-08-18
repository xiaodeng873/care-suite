import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart3, Calendar, FileText, Activity, Utensils, Stethoscope, AlertCircle, Bot, Printer, Droplets, Receipt, ChevronDown, ChevronRight } from 'lucide-react';
import { usePatientData, useFilteredPatients } from '../context/PatientContext';
import { useStationFilter } from '../context/StationFilterContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import MonthlyReportTable from '../components/MonthlyReportTable';
import PatientListModal from '../components/PatientListModal';
import PatientPrintModal from '../components/PatientPrintModal';
import { AiUsageStatsPanel } from '../components/AiUsageStatsPanel';
import BedNumberImprint from '../components/BedNumberImprint';
import { formatFrequencyDescription } from '../utils/taskScheduler';
import { supabase } from '../lib/supabase';
import type { Patient, PatientCareTab, Station, PatientTubeCareRecord, MealGuidance } from '../lib/database';
import { formatDisplayDate, formatDisplayDateTime, formatTimeToHHMM } from '../utils/dateFormat';
import DateInput from '../components/DateInput';


import { getPrintBedNumber } from '../utils/bedTransferUtils';
type ReportTab = 'daily' | 'monthly' | 'infection' | 'meal' | 'tube' | 'special' | 'drugSensitivity' | 'diaper' | 'fee' | 'aiUsage';
type TimeFilter = 'today' | 'yesterday' | 'thisMonth' | 'lastMonth';

interface StatCardProps {
  title: string;
  value: number;
  bgColor: string;
  textColor: string;
  subtitle?: string;
  patientNames?: string[];
}

const StatCard: React.FC<StatCardProps> = ({ title, value, bgColor, textColor, subtitle, patientNames }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={`${bgColor} p-4 rounded-lg relative cursor-pointer`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <p className="text-sm text-gray-600">{title}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>

      {showTooltip && patientNames && patientNames.length > 0 && (
        <div className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl -top-2 left-full ml-2 w-48 max-h-64 overflow-y-auto">
          <div className="font-semibold mb-2">院友名單:</div>
          <ul className="space-y-1">
            {patientNames.map((name, idx) => (
              <li key={idx} className="text-gray-200">{name}</li>
            ))}
          </ul>
          <div className="absolute w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-900 -left-2 top-4"></div>
        </div>
      )}
    </div>
  );
};

const Reports: React.FC = () => {
  const { allPatients, stations, healthAssessments, incidentReports, patientHealthTasks, patientRestraintAssessments, prescriptions, healthRecords, mealGuidances, hospitalEpisodes, diagnosisRecords, patientTubeCareRecords, patientsWithWounds, infectionControlRecords, diaperChangeRecords, loading } = usePatientData();
  const patients = useFilteredPatients();
  const { selectedStationIds } = useStationFilter();
  const [activeTab, setActiveTab] = useState<ReportTab>('daily');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [reportDate, setReportDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalPatients, setModalPatients] = useState<string[]>([]);
  const [patientCareTabs, setPatientCareTabs] = useState<PatientCareTab[]>([]);
  // 尿片矩陣：已展開的居住區（預設全部摺疊，只顯示居住區行及小計行）
  const [expandedDiaperStations, setExpandedDiaperStations] = useState<Set<string>>(new Set());
  // 尿片矩陣：月份範圍（YYYY-MM；空字串 = 自動，預設最近 9 個月）
  const [diaperStartMonth, setDiaperStartMonth] = useState('');
  const [diaperEndMonth, setDiaperEndMonth] = useState('');
  const toggleDiaperStation = (stationId: string) => {
    setExpandedDiaperStations(prev => {
      const next = new Set(prev);
      if (next.has(stationId)) next.delete(stationId);
      else next.add(stationId);
      return next;
    });
  };

  // 載入所有啟用中的 care tabs，供「轉身」判斷
  useEffect(() => {
    const loadCareTabs = async () => {
      try {
        const { data, error } = await supabase
          .from('patient_care_tabs')
          .select('*')
          .eq('is_hidden', false);
        if (error) throw error;
        setPatientCareTabs(data || []);
      } catch (error) {
        console.error('載入 patient_care_tabs 失敗:', error);
      }
    };
    loadCareTabs();
  }, []);

  const showPatientList = (title: string, names: string[]) => {
    setModalTitle(title);
    setModalPatients(names);
    setModalOpen(true);
  };

  const getDateRanges = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    return { today, yesterday, thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd };
  };

  const { today, yesterday, thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd } = getDateRanges();

  const getReportStationId = (p: Patient): string | null | undefined => {
    if (p.在住狀態 === '在住') return p.station_id;
    return p.last_station_id || p.station_id;
  };

  interface StationStat {
    stationId: string;
    stationName: string;
    count: number;
    patientNames: string[];
  }

  const computeStationStats = (
    activePatients: Patient[],
    stations: Station[],
    predicate: (p: Patient) => boolean
  ): StationStat[] => {
    const stationMap = new Map(stations.map(s => [s.id, s]));
    const byStation = new Map<string, Patient[]>();
    for (const p of activePatients) {
      const stationId = getReportStationId(p) || 'unknown';
      const list = byStation.get(stationId) || [];
      list.push(p);
      byStation.set(stationId, list);
    }
    const stats: StationStat[] = [];
    for (const [stationId, patients] of byStation) {
      const matched = patients.filter(predicate);
      stats.push({
        stationId,
        stationName: stationMap.get(stationId)?.name || '未分區',
        count: matched.length,
        patientNames: matched.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`),
      });
    }
    stats.sort((a, b) => {
      const idxA = stations.findIndex(s => s.id === a.stationId);
      const idxB = stations.findIndex(s => s.id === b.stationId);
      if (idxA === -1 && idxB === -1) return a.stationName.localeCompare(b.stationName, 'zh-Hant');
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
    return stats;
  };

  const renderStationStatCards = (stats: StationStat[], bgColor: string, textColor: string) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(stat => (
        <StatCard
          key={stat.stationId}
          title={stat.stationName}
          value={stat.count}
          bgColor={bgColor}
          textColor={textColor}
          patientNames={stat.patientNames}
        />
      ))}
    </div>
  );

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [initialPrintDocumentIds, setInitialPrintDocumentIds] = useState<string[]>([]);

  const TAB_DOCUMENT_MAP: Record<Exclude<ReportTab, 'daily' | 'monthly' | 'aiUsage'>, string> = {
    meal: 'meal_statistics_report',
    tube: 'tube_care_statistics_report',
    infection: 'infection_control_statistics_report',
    special: 'special_care_statistics_report',
    drugSensitivity: 'drug_sensitivity_statistics_report',
    diaper: 'diaper_statistics_report',
    fee: 'fee_statistics_report',
  };

  const filteredPatients = useMemo(() => {
    if (!selectedStationIds.length || !stations.length || selectedStationIds.length >= stations.length) return allPatients || [];
    return (allPatients || []).filter(p => {
      const stationId = getReportStationId(p);
      return stationId && selectedStationIds.includes(stationId);
    });
  }, [allPatients, selectedStationIds, stations]);
  const handlePrintStatistics = async (
    selectedPatients: Patient[],
    selectedDocuments: string[],
    startDate: string,
    endDate: string,
    contentMode: 'basic' | 'data' | 'blank',
    printOptions?: import('../components/PatientPrintModal').PrintDocumentOptions
  ) => {
    const { generatePatientPrintBundle } = await import('../utils/patientPrintBundleGenerator');
    await generatePatientPrintBundle({
      patients: selectedPatients,
      documentIds: selectedDocuments,
      startDate,
      endDate,
      contentMode,
      printOptions,
      stations,
      mealGuidances,
      patientHealthTasks,
      patientTubeCareRecords,
      infectionControlRecords,
      diaperChangeRecords,
    });
  };

  /** Parse a TEXT column that may contain a JSON array, '、'-delimited string, or already be an array */
  const parseTextToArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string' && value) {
      const trimmed = value.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map(String);
        } catch { /* fall through */ }
      }
      return trimmed.split('、').filter(Boolean);
    }
    return [];
  };

  const matchesCognitiveDiagnosis = (diagnosisItem?: string): boolean => {
    if (!diagnosisItem) return false;
    const lower = diagnosisItem.toLowerCase();
    const keywords = ['dementia', 'cognitive impairment', 'cognitive problem', 'mental retardation', 'retarded'];
    return keywords.some(k => lower.includes(k));
  };

  const hasTubeCare = useCallback((patientId: number, careType: string): boolean => {
    return (patientTubeCareRecords || []).some(record =>
      record.patient_id === patientId && record.care_type === careType
    );
  }, [patientTubeCareRecords]);

  const hasCareTab = (patientId: number, tabType: PatientCareTab['tab_type']): boolean => {
    return patientCareTabs.some(tab => tab.patient_id === patientId && tab.tab_type === tabType);
  };

  const hasPressureUlcer = (patientId: number): boolean => {
    const patientWounds = (patientsWithWounds || []).find(pw => pw.patient_id === patientId);
    if (!patientWounds) return false;
    return patientWounds.wounds.some(wound =>
      wound.wound_type === 'pressure_ulcer' &&
      wound.status === 'active' &&
      wound.latest_assessment &&
      wound.latest_assessment.wound_status !== 'healed'
    );
  };

  const hasHealthTask = useCallback((patientId: number, taskType: string): boolean => {
    return (patientHealthTasks || []).some(task =>
      task.patient_id === patientId && task.health_record_type === taskType
    );
  }, [patientHealthTasks]);

  const dailyReportData = useMemo(() => {
    const targetDate = reportDate;

    const parseDateOnly = (dateString: string): Date => {
      const date = new Date(dateString);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };

    const isBeforeOrSameDate = (date1: Date, date2: Date): boolean => {
      const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
      const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
      return d1.getTime() <= d2.getTime();
    };

    const isAfterDate = (date1: Date, date2: Date): boolean => {
      const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
      const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
      return d1.getTime() > d2.getTime();
    };

    const activePatients = filteredPatients.filter(p => {
      if (!p.入住日期) return false;
      const admissionDate = parseDateOnly(p.入住日期);
      if (isAfterDate(admissionDate, targetDate)) return false;
      if (p.退住日期) {
        const dischargeDate = parseDateOnly(p.退住日期);
        if (!isAfterDate(dischargeDate, targetDate)) return false;
      }
      if (p.death_date) {
        const deathDate = parseDateOnly(p.death_date);
        if (!isAfterDate(deathDate, targetDate)) return false;
      }
      return true;
    });

    const 買位Patients = activePatients.filter(p => p.入住類型 === '買位');
    const 私位Patients = activePatients.filter(p => p.入住類型 === '私位');
    const 院舍劵Patients = activePatients.filter(p => p.入住類型 === '院舍卷級別0' || p.入住類型 === '院舍卷級別1-7');
    const 暫住Patients = activePatients.filter(p => p.入住類型 === '暫住');

    const admissionTypeStats = {
      買位: { count: 買位Patients.length, names: 買位Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
      私位: { count: 私位Patients.length, names: 私位Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
      院舍劵: { count: 院舍劵Patients.length, names: 院舍劵Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
      暫住: { count: 暫住Patients.length, names: 暫住Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
    };

    const getIsHospitalizedAtDate = (patientId: number, targetDate: Date): boolean => {
      const patientEpisodes = hospitalEpisodes.filter(episode => episode.patient_id === patientId);

      for (const episode of patientEpisodes) {
        if (!episode.episode_events || !Array.isArray(episode.episode_events)) {
          continue;
        }

        const sortedEvents = [...episode.episode_events].sort((a: any, b: any) => {
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        });

        for (let i = 0; i < sortedEvents.length; i++) {
          const event = sortedEvents[i];

          if (event.event_type === 'admission' || event.event_type === 'transfer') {
            const admissionDate = parseDateOnly(event.event_date);

            if (isBeforeOrSameDate(admissionDate, targetDate)) {
              let dischargeEvent = null;
              for (let j = i + 1; j < sortedEvents.length; j++) {
                if (sortedEvents[j].event_type === 'discharge') {
                  dischargeEvent = sortedEvents[j];
                  break;
                }
              }

              if (!dischargeEvent) {
                return true;
              }

              const dischargeDate = parseDateOnly(dischargeEvent.event_date);
              if (isAfterDate(dischargeDate, targetDate)) {
                return true;
              }
            }
          }
        }
      }

      return false;
    };

    const getIsOnVacationAtDate = (patientId: number, targetDate: Date): boolean => {
      const patientEpisodes = hospitalEpisodes.filter(episode => episode.patient_id === patientId);

      for (const episode of patientEpisodes) {
        if (!episode.episode_events || !Array.isArray(episode.episode_events)) {
          continue;
        }

        const sortedEvents = [...episode.episode_events].sort((a: any, b: any) => {
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        });

        for (let i = 0; i < sortedEvents.length; i++) {
          const event = sortedEvents[i];

          if (event.event_type === 'vacation_start') {
            const vacationStartDate = parseDateOnly(event.event_date);

            if (isBeforeOrSameDate(vacationStartDate, targetDate)) {
              let vacationEndEvent = null;
              for (let j = i + 1; j < sortedEvents.length; j++) {
                if (sortedEvents[j].event_type === 'vacation_end') {
                  vacationEndEvent = sortedEvents[j];
                  break;
                }
              }

              if (!vacationEndEvent) {
                return true;
              }

              const vacationEndDate = parseDateOnly(vacationEndEvent.event_date);
              if (isAfterDate(vacationEndDate, targetDate)) {
                return true;
              }
            }
          }
        }
      }

      return false;
    };

    const 住在本站男Patients = activePatients.filter(p => p.性別 === '男' && !getIsHospitalizedAtDate(p.院友id, targetDate) && !getIsOnVacationAtDate(p.院友id, targetDate));
    const 住在本站女Patients = activePatients.filter(p => p.性別 === '女' && !getIsHospitalizedAtDate(p.院友id, targetDate) && !getIsOnVacationAtDate(p.院友id, targetDate));
    const 入住醫院男Patients = activePatients.filter(p => p.性別 === '男' && getIsHospitalizedAtDate(p.院友id, targetDate));
    const 入住醫院女Patients = activePatients.filter(p => p.性別 === '女' && getIsHospitalizedAtDate(p.院友id, targetDate));
    const 暫時回家男Patients = activePatients.filter(p => p.性別 === '男' && getIsOnVacationAtDate(p.院友id, targetDate));
    const 暫時回家女Patients = activePatients.filter(p => p.性別 === '女' && getIsOnVacationAtDate(p.院友id, targetDate));

    const residenceStats = {
      住在本站男: 住在本站男Patients.length,
      住在本站女: 住在本站女Patients.length,
      入住醫院男: 入住醫院男Patients.length,
      入住醫院女: 入住醫院女Patients.length,
      暫時回家男: 暫時回家男Patients.length,
      暫時回家女: 暫時回家女Patients.length,
      住在本站男Names: 住在本站男Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`),
      住在本站女Names: 住在本站女Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`),
      入住醫院男Names: 入住醫院男Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`),
      入住醫院女Names: 入住醫院女Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`),
      暫時回家男Names: 暫時回家男Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`),
      暫時回家女Names: 暫時回家女Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`),
    };

    const newAdmissionsPatients = filteredPatients.filter(p => {
      if (!p.入住日期) return false;
      const admissionDate = new Date(p.入住日期);
      return admissionDate >= targetDate && admissionDate < new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
    });

    const dischargePatients = filteredPatients.filter(p => {
      if (!p.退住日期) return false;
      const dischargeDate = new Date(p.退住日期);
      return dischargeDate.toDateString() === targetDate.toDateString();
    });

    const deathPatients = filteredPatients.filter(p => {
      if (!p.death_date || p.discharge_reason !== '死亡') return false;
      const deathDate = parseDateOnly(p.death_date);
      return deathDate >= targetDate && deathDate < new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
    });

    const monthlyDeathPatients = filteredPatients.filter(p => {
      if (!p.death_date || p.discharge_reason !== '死亡') return false;
      const deathDate = parseDateOnly(p.death_date);
      return deathDate.getFullYear() === targetDate.getFullYear() && deathDate.getMonth() === targetDate.getMonth();
    });

    const ngTubePatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.nutrition_diet?.status === '鼻胃管' ||
        hasHealthTask(p.院友id, '鼻胃飼管更換') ||
        hasTubeCare(p.院友id, '鼻胃飼管更換');
    });

    const catheterPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.bowel_bladder_control?.bladder === '導尿管' ||
        hasHealthTask(p.院友id, '導尿管更換') ||
        hasTubeCare(p.院友id, '導尿管更換');
    });

    const woundPatientIds = new Set<number>();
    const pressureUlcerPatientIds = new Set<number>();
    (patientsWithWounds || []).forEach(pw => {
      pw.wounds.forEach(wound => {
        if (wound.status === 'active' && wound.latest_assessment && wound.latest_assessment.wound_status !== 'healed') {
          woundPatientIds.add(pw.patient_id);
          if (wound.wound_type === 'pressure_ulcer') {
            pressureUlcerPatientIds.add(pw.patient_id);
          }
        }
      });
    });
    const woundPatients = activePatients.filter(p => woundPatientIds.has(p.院友id));
    const pressureUlcerPatients = activePatients.filter(p => pressureUlcerPatientIds.has(p.院友id));

    const dialysisPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.treatment_items?.includes('腹膜/血液透析');
    });

    const oxygenPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.treatment_items?.includes('氧氣治療');
    });

    const stomaPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.bowel_bladder_control?.bowel === '腸造口' ||
        assessment?.bowel_bladder_control?.bladder === '小便造口' ||
        hasTubeCare(p.院友id, '造口袋更換');
    });

    const infectionControlPatients = activePatients.filter(p =>
      infectionControlRecords.some(r => r.patient_id === p.院友id && !r.recovery_date)
    );

    const restraintPatientIds = new Set((patientRestraintAssessments || []).map(r => r.patient_id));
    const restraintPatients = activePatients.filter(p => restraintPatientIds.has(p.院友id));

    const filteredPatientIds = new Set(filteredPatients.map(p => p.院友id));
    const todayIncidents = (incidentReports || []).filter(incident => {
      const incidentDate = new Date(incident.incident_date);
      return incidentDate.toDateString() === targetDate.toDateString() && filteredPatientIds.has(incident.patient_id);
    });

    const medicationIncidentPatients = todayIncidents.filter(i => i.incident_type === '藥物');
    const fallIncidentPatients = todayIncidents.filter(i => i.incident_type === '跌倒');

    const fullCare男Patients = activePatients.filter(p => p.護理等級 === '全護理' && p.性別 === '男');
    const fullCare女Patients = activePatients.filter(p => p.護理等級 === '全護理' && p.性別 === '女');
    const semiCare男Patients = activePatients.filter(p => p.護理等級 === '半護理' && p.性別 === '男');
    const semiCare女Patients = activePatients.filter(p => p.護理等級 === '半護理' && p.性別 === '女');
    const convalescent男Patients = activePatients.filter(p => p.護理等級 === '療養級' && p.性別 === '男');
    const convalescent女Patients = activePatients.filter(p => p.護理等級 === '療養級' && p.性別 === '女');

    return {
      admissionTypeStats,
      residenceStats,
      newAdmissions: {
        男: newAdmissionsPatients.filter(p => p.性別 === '男').length,
        女: newAdmissionsPatients.filter(p => p.性別 === '女').length,
        count: newAdmissionsPatients.length,
        names: newAdmissionsPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`)
      },
      discharge: {
        男: dischargePatients.filter(p => p.性別 === '男').length,
        女: dischargePatients.filter(p => p.性別 === '女').length,
        total: dischargePatients.length,
        names: dischargePatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`)
      },
      death: {
        男: deathPatients.filter(p => p.性別 === '男').length,
        女: deathPatients.filter(p => p.性別 === '女').length,
        total: deathPatients.length,
        names: deathPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`)
      },
      monthlyDeaths: {
        count: monthlyDeathPatients.length,
        names: monthlyDeathPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`)
      },
      medical: {
        鼻胃飼: { count: ngTubePatients.length, names: ngTubePatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        導尿管: { count: catheterPatients.length, names: catheterPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        傷口: { count: woundPatients.length, names: woundPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        壓瘡: { count: pressureUlcerPatients.length, names: pressureUlcerPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        腹膜血液透析: { count: dialysisPatients.length, names: dialysisPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        氧氣治療: { count: oxygenPatients.length, names: oxygenPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        造口: { count: stomaPatients.length, names: stomaPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        感染控制: { count: infectionControlPatients.length, names: infectionControlPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        使用約束物品: { count: restraintPatients.length, names: restraintPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
      },
      incidents: {
        藥物: { count: medicationIncidentPatients.length, names: medicationIncidentPatients.map(i => {
          const p = activePatients.find(patient => patient.院友id === i.patient_id);
          return p ? `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}` : '未知';
        })},
        跌倒: { count: fallIncidentPatients.length, names: fallIncidentPatients.map(i => {
          const p = activePatients.find(patient => patient.院友id === i.patient_id);
          return p ? `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}` : '未知';
        })},
        死亡: { count: deathPatients.length, names: deathPatients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
      },
      careLevel: {
        全護理男: { count: fullCare男Patients.length, names: fullCare男Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        全護理女: { count: fullCare女Patients.length, names: fullCare女Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        半護理男: { count: semiCare男Patients.length, names: semiCare男Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        半護理女: { count: semiCare女Patients.length, names: semiCare女Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        療養級男: { count: convalescent男Patients.length, names: convalescent男Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
        療養級女: { count: convalescent女Patients.length, names: convalescent女Patients.map(p => `${getPrintBedNumber(p)} ${p.中文姓氏}${p.中文名字}`) },
      },
    };
  }, [filteredPatients, reportDate, healthAssessments, patientsWithWounds, incidentReports, patientRestraintAssessments, hasHealthTask, hasTubeCare, hospitalEpisodes, infectionControlRecords]);


  if (loading) {
    return <LoadingScreen pageName="報表查詢" />;
  }

  const renderDailyReport = () => {
    const targetDate = reportDate;
    const displayDate = targetDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

    const handleDateChange = (value: string) => {
      if (value) {
        const [year, month, day] = value.split('-').map(Number);
        setReportDate(new Date(year, month - 1, day));
      }
    };

    const formatInputDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4 mb-4 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600">報告日期：</label>
            <DateInput
              value={formatInputDate(reportDate)}
              max={formatInputDate(new Date())}
              onChange={handleDateChange}
              className="form-input"
            />
          </div>
        </div>

        {/* 紙質表格風格的報表 */}
        <div className="bg-white border-4 border-gray-900 shadow-lg print:shadow-none print:border-2">
          {/* 標題 */}
          <div className="border-b-4 border-gray-900 bg-gray-50 p-6 text-center">     
            <p className="text-lg text-gray-700">日期: {displayDate}</p>
          </div>

          {/* 表格主體 */}
          <div className="p-8 space-y-1">
            {/* 入住類型統計 - 頂置 */}
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900 mb-3">【入住類型統計】</h3>
              <div className="flex items-center text-base leading-loose">
                <span className="text-gray-700">
                  買位: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('買位院友', dailyReportData.admissionTypeStats.買位.names)}>
                    {dailyReportData.admissionTypeStats.買位.count}
                  </span> 人;
                </span>
                <span className="text-gray-700 ml-4">
                  私位: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('私位院友', dailyReportData.admissionTypeStats.私位.names)}>
                    {dailyReportData.admissionTypeStats.私位.count}
                  </span> 人;
                </span>
                <span className="text-gray-700 ml-4">
                  院舍劵: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('院舍劵院友', dailyReportData.admissionTypeStats.院舍劵.names)}>
                    {dailyReportData.admissionTypeStats.院舍劵.count}
                  </span> 人;
                </span>
                <span className="text-gray-700 ml-4">
                  暫住: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('暫住院友', dailyReportData.admissionTypeStats.暫住.names)}>
                    {dailyReportData.admissionTypeStats.暫住.count}
                  </span> 人
                </span>
              </div>
            </div>
            <div className="border-t-2 border-gray-300 my-3"></div>

            {/* 在住狀態統計 */}
            <div className="space-y-3">
              <div className="text-base leading-loose">
                <span className="text-gray-700">
                  1. 住在本區人數: 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('住在本站男院友', dailyReportData.residenceStats.住在本站男Names)}>
                    {dailyReportData.residenceStats.住在本站男}
                  </span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('住在本站女院友', dailyReportData.residenceStats.住在本站女Names)}>
                    {dailyReportData.residenceStats.住在本站女}
                  </span> 人)
                </span>
              </div>
              <div className="border-t border-gray-300"></div>

              <div className="text-base leading-loose">
                <span className="text-gray-700">
                  2. 入住醫院人數: 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('入住醫院男院友', dailyReportData.residenceStats.入住醫院男Names)}>
                    {dailyReportData.residenceStats.入住醫院男}
                  </span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('入住醫院女院友', dailyReportData.residenceStats.入住醫院女Names)}>
                    {dailyReportData.residenceStats.入住醫院女}
                  </span> 人)
                </span>
              </div>
              <div className="border-t border-gray-300"></div>

              <div className="text-base leading-loose">
                <span className="text-gray-700">
                  3. 暫時回家人數: 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('暫時回家男院友', dailyReportData.residenceStats.暫時回家男Names)}>
                    {dailyReportData.residenceStats.暫時回家男}
                  </span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('暫時回家女院友', dailyReportData.residenceStats.暫時回家女Names)}>
                    {dailyReportData.residenceStats.暫時回家女}
                  </span> 人)
                </span>
              </div>
              <div className="border-t border-gray-300"></div>

              <div className="text-base leading-loose">
                <span className="text-gray-700">
                  4. 總人數 [a+b+c]: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">
                    {dailyReportData.residenceStats.住在本站男 + dailyReportData.residenceStats.住在本站女 + dailyReportData.residenceStats.入住醫院男 + dailyReportData.residenceStats.入住醫院女 + dailyReportData.residenceStats.暫時回家男 + dailyReportData.residenceStats.暫時回家女}
                  </span> 人; 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">
                    {dailyReportData.residenceStats.住在本站男 + dailyReportData.residenceStats.入住醫院男 + dailyReportData.residenceStats.暫時回家男}
                  </span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">
                    {dailyReportData.residenceStats.住在本站女 + dailyReportData.residenceStats.入住醫院女 + dailyReportData.residenceStats.暫時回家女}
                  </span> 人)
                </span>
              </div>
            </div>
            <div className="border-t-2 border-gray-300 my-3"></div>

            {/* 本區 {displayDate} */}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">【{displayDate}】</h3>
              <div className="space-y-3">
                <div className="text-base leading-loose">
                  <span className="text-gray-700">
                    1. 當日新收院友: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('新收院友', dailyReportData.newAdmissions.names)}>
                      {dailyReportData.newAdmissions.count}
                    </span> 人; 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.newAdmissions.男}</span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.newAdmissions.女}</span> 人)
                  </span>
                </div>
                <div className="border-t border-gray-300"></div>

                <div className="text-base leading-loose">
                  <span className="text-gray-700">
                    2. 當日死亡人數: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('死亡院友', dailyReportData.death.names)}>
                      {dailyReportData.death.total}
                    </span> 人; 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.death.男}</span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.death.女}</span> 人)
                  </span>
                </div>
                <div className="border-t border-gray-300"></div>

                <div className="text-base leading-loose">
                  <span className="text-gray-700">
                    3. 當日退住人數: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('退住院友', dailyReportData.discharge.names)}>
                      {dailyReportData.discharge.total}
                    </span> 人; 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.discharge.男}</span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.discharge.女}</span> 人)
                  </span>
                </div>
                <div className="border-t border-gray-300"></div>

                <div className="text-base leading-loose">
                  <span className="text-gray-700">
                    4. 當月累積死亡: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('當月累積死亡', dailyReportData.monthlyDeaths.names)}>
                      {dailyReportData.monthlyDeaths.count}
                    </span> 人
                  </span>
                </div>
              </div>
            </div>
            <div className="border-t-2 border-gray-300 my-3"></div>

            {/* 醫療項目 */}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">【醫療項目】</h3>
              <div className="space-y-3">
                <div className="flex items-center text-base leading-loose">
                  <span className="text-gray-700">
                    鼻胃飼: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('鼻胃飼院友', dailyReportData.medical.鼻胃飼.names)}>
                      {dailyReportData.medical.鼻胃飼.count}
                    </span> 人;
                  </span>
                  <span className="text-gray-700 ml-4">
                    尿管: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('尿管院友', dailyReportData.medical.導尿管.names)}>
                      {dailyReportData.medical.導尿管.count}
                    </span> 人;
                  </span>
                  <span className="text-gray-700 ml-4">
                    傷口: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('傷口院友', dailyReportData.medical.傷口.names)}>
                      {dailyReportData.medical.傷口.count}
                    </span> 人;
                  </span>
                  <span className="text-gray-700 ml-4">
                    壓瘡: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('壓瘡院友', dailyReportData.medical.壓瘡.names)}>
                      {dailyReportData.medical.壓瘡.count}
                    </span> 人
                  </span>
                </div>
                <div className="border-t border-gray-300"></div>

                <div className="flex items-center text-base leading-loose">
                  <span className="text-gray-700">
                    腹膜/血液透析: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('腹膜/血液透析院友', dailyReportData.medical.腹膜血液透析.names)}>
                      {dailyReportData.medical.腹膜血液透析.count}
                    </span> 人;
                  </span>
                  <span className="text-gray-700 ml-4">
                    吸氧: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('吸氧院友', dailyReportData.medical.氧氣治療.names)}>
                      {dailyReportData.medical.氧氣治療.count}
                    </span> 人
                  </span>
                </div>
                <div className="border-t border-gray-300"></div>

                <div className="flex items-center text-base leading-loose">
                  <span className="text-gray-700">
                    造口: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('造口院友', dailyReportData.medical.造口.names)}>
                      {dailyReportData.medical.造口.count}
                    </span> 人;
                  </span>
                  <span className="text-gray-700 ml-4">
                    傳染病隔離: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('傳染病隔離院友', dailyReportData.medical.感染控制.names)}>
                      {dailyReportData.medical.感染控制.count}
                    </span> 人;
                  </span>
                  <span className="text-gray-700 ml-4">
                    使用約束物品: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('使用約束物品院友', dailyReportData.medical.使用約束物品.names)}>
                      {dailyReportData.medical.使用約束物品.count}
                    </span> 人
                  </span>
                </div>
              </div>
            </div>
            <div className="border-t-2 border-gray-300 my-3"></div>

            {/* 意外事件 */}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">【意外事件】</h3>
              <div className="flex items-center text-base leading-loose">
                <span className="text-gray-700">
                  藥物: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('藥物意外院友', dailyReportData.incidents.藥物.names)}>
                    {dailyReportData.incidents.藥物.count}
                  </span> 人 ( <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.incidents.藥物.count}</span> 次);
                </span>
                <span className="text-gray-700 ml-4">
                  跌倒: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('跌倒意外院友', dailyReportData.incidents.跌倒.names)}>
                    {dailyReportData.incidents.跌倒.count}
                  </span> 人 ( <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.incidents.跌倒.count}</span> 次);
                </span>
                <span className="text-gray-700 ml-4">
                  死亡: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('死亡意外院友', dailyReportData.incidents.死亡.names)}>
                    {dailyReportData.incidents.死亡.count}
                  </span> 人
                </span>
              </div>
            </div>
            <div className="border-t-2 border-gray-300 my-3"></div>

            {/* 護理等級 */}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">【護理等級】</h3>
              <div className="space-y-3">
                <div className="text-base leading-loose">
                  <span className="text-gray-700">
                    a) 半護理: 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('半護理男院友', dailyReportData.careLevel.半護理男.names)}>
                      {dailyReportData.careLevel.半護理男.count}
                    </span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('半護理女院友', dailyReportData.careLevel.半護理女.names)}>
                      {dailyReportData.careLevel.半護理女.count}
                    </span> 人); 總人數: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">
                      {dailyReportData.careLevel.半護理男.count + dailyReportData.careLevel.半護理女.count}
                    </span> 人
                  </span>
                </div>
                <div className="border-t border-gray-300"></div>

                <div className="text-base leading-loose">
                  <span className="text-gray-700">
                    b) 全護理: 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('全護理男院友', dailyReportData.careLevel.全護理男.names)}>
                      {dailyReportData.careLevel.全護理男.count}
                    </span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('全護理女院友', dailyReportData.careLevel.全護理女.names)}>
                      {dailyReportData.careLevel.全護理女.count}
                    </span> 人); 總人數: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">
                      {dailyReportData.careLevel.全護理男.count + dailyReportData.careLevel.全護理女.count}
                    </span> 人
                  </span>
                </div>
                <div className="border-t border-gray-300"></div>

                <div className="text-base leading-loose">
                  <span className="text-gray-700">
                    c) 療養級: 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('療養級男院友', dailyReportData.careLevel.療養級男.names)}>
                      {dailyReportData.careLevel.療養級男.count}
                    </span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('療養級女院友', dailyReportData.careLevel.療養級女.names)}>
                      {dailyReportData.careLevel.療養級女.count}
                    </span> 人); 總人數: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">
                      {dailyReportData.careLevel.療養級男.count + dailyReportData.careLevel.療養級女.count}
                    </span> 人
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PatientListModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={modalTitle}
          patientNames={modalPatients}
        />
      </div>
    );
  };

  const renderMonthlyReport = () => {
    const activePatients = filteredPatients.filter(p => p.在住狀態 === '在住');

    const tableData = activePatients.map(patient => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === patient.院友id);
      const activePrescriptions = (prescriptions || []).filter(rx =>
        rx.patient_id === patient.院友id && rx.status === 'active'
      );

      const hasCatheter = assessment?.bowel_bladder_control?.bladder === '導尿管' ||
        hasHealthTask(patient.院友id, '導尿管更換') ||
        hasTubeCare(patient.院友id, '導尿管更換');

      const hasWandering = assessment?.behavior_expression?.includes('遊走');

      const emotionalExpressions = parseTextToArray(assessment?.emotional_expression);
      const hasEmotionalIssue = emotionalExpressions.includes('抑鬱') || emotionalExpressions.includes('激動');

      const hasEmotionalReferral = hasEmotionalIssue && (incidentReports || []).some(incident =>
        incident.patient_id === patient.院友id &&
        (incident.incident_details?.includes('轉介') || incident.incident_details?.includes('情緒'))
      );

      const monthStart = timeFilter === 'today' ? thisMonthStart : lastMonthStart;
      const monthEnd = timeFilter === 'today' ? thisMonthEnd : lastMonthEnd;

      const hasFall = (incidentReports || []).some(incident => {
        const incidentDate = new Date(incident.incident_date);
        return incident.incident_type === '跌倒' &&
               incident.patient_id === patient.院友id &&
               incidentDate >= monthStart &&
               incidentDate <= monthEnd;
      });

      const hasMedicationError = (incidentReports || []).some(incident => {
        const incidentDate = new Date(incident.incident_date);
        return incident.patient_id === patient.院友id &&
               incident.incident_type === '其他' &&
               (incident.other_incident_type?.includes('藥物') ||
                incident.other_incident_type?.includes('錯發') ||
                incident.incident_details?.includes('藥物') ||
                incident.incident_details?.includes('錯發')) &&
               incidentDate >= monthStart &&
               incidentDate <= monthEnd;
      });

      const hasChoking = (incidentReports || []).some(incident => {
        const incidentDate = new Date(incident.incident_date);
        return incident.patient_id === patient.院友id &&
               (incident.other_incident_type?.includes('哽塞') ||
                incident.other_incident_type?.includes('吞嚥') ||
                incident.incident_details?.includes('哽塞') ||
                incident.incident_details?.includes('吞嚥困難')) &&
               incidentDate >= monthStart &&
               incidentDate <= monthEnd;
      });

      const hasDehydration = (incidentReports || []).some(incident => {
        const incidentDate = new Date(incident.incident_date);
        return incident.patient_id === patient.院友id &&
               (incident.other_incident_type?.includes('脫水') ||
                incident.incident_details?.includes('脫水')) &&
               incidentDate >= monthStart &&
               incidentDate <= monthEnd;
      });

      const lastMonthDate = new Date(monthStart);
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

      const hasWeightDecrease = (() => {
        const currentMonthRecords = (healthRecords || []).filter(r =>
          r.院友id === patient.院友id &&
          r.監測類型 === '體重' &&
          r.數值 &&
          new Date(r.記錄日期) >= monthStart &&
          new Date(r.記錄日期) <= monthEnd
        );
        const lastMonthRecords = (healthRecords || []).filter(r =>
          r.院友id === patient.院友id &&
          r.監測類型 === '體重' &&
          r.數值 &&
          new Date(r.記錄日期) >= lastMonthDate &&
          new Date(r.記錄日期) < monthStart
        );
        if (currentMonthRecords.length === 0 || lastMonthRecords.length === 0) return false;
        const currentWeight = currentMonthRecords[currentMonthRecords.length - 1].數值;
        const lastWeight = lastMonthRecords[lastMonthRecords.length - 1].數值;
        if (!currentWeight || !lastWeight) return false;
        const decrease = ((lastWeight - currentWeight) / lastWeight) * 100;
        return decrease >= 5;
      })();

      const isHospitalized = (hospitalEpisodes || []).some(episode =>
        episode.patient_id === patient.院友id && episode.status === 'active'
      );

      const hasPalliativeCare = (patientHealthTasks || []).some(task =>
        task.patient_id === patient.院友id &&
        task.health_record_type === '預設醫療指示'
      );

      const consciousness = parseTextToArray(assessment?.consciousness_cognition);
      const hasCognitiveImpairment = consciousness.includes('認知障礙') || consciousness.includes('失智') ||
        (diagnosisRecords || []).some(d =>
          d.patient_id === patient.院友id && matchesCognitiveDiagnosis(d.diagnosis_item)
        );

      const hasFeeding = (mealGuidances || []).some(mg =>
        mg.patient_id === patient.院友id && mg.needs_feeding === true
      );

      return {
        patientId: patient.院友id,
        bedNumber: getPrintBedNumber(patient) || '',
        name: `${patient.中文姓氏}${patient.中文名字}`,
        半護理: patient.護理等級 === '半護理' ? 1 : 0,
        全護理: patient.護理等級 === '全護理' ? 1 : 0,
        導尿管: hasCatheter ? 1 : 0,
        遊走: hasWandering ? 1 : 0,
        情緒問題: hasEmotionalIssue ? 1 : 0,
        因情緒問題而轉介: hasEmotionalReferral ? 1 : 0,
        長期卧床: assessment?.daily_activities?.is_bedridden ? 1 : 0,
        長期使用輪椅: assessment?.daily_activities?.is_wheelchair ? 1 : 0,
        一人協助: assessment?.daily_activities?.mobility === '一人協助' ? 1 : 0,
        二人協助: assessment?.daily_activities?.mobility === '二人協助' ? 1 : 0,
        需餵食: hasFeeding ? 1 : 0,
        鼻胃飼: (assessment?.nutrition_diet?.status === '鼻胃管' || hasHealthTask(patient.院友id, '鼻胃飼管更換') || hasTubeCare(patient.院友id, '鼻胃飼管更換')) ? 1 : 0,
        腹膜血液透析: assessment?.treatment_items?.includes('腹膜/血液透析') ? 1 : 0,
        造口: (assessment?.bowel_bladder_control?.bowel === '腸造口' || assessment?.bowel_bladder_control?.bladder === '小便造口' || hasTubeCare(patient.院友id, '造口袋更換')) ? 1 : 0,
        氧氣治療: assessment?.treatment_items?.includes('氧氣治療') ? 1 : 0,
        皮下注射: activePrescriptions.some(rx => rx.administration_route === '皮下注射' || rx.administration_route?.includes('皮下')) ? 1 : 0,
        呼吸器: assessment?.treatment_items?.includes('呼吸器') ? 1 : 0,
        善終: hasPalliativeCare ? 1 : 0,
        化療: assessment?.treatment_items?.includes('化療') ? 1 : 0,
        放射治療: assessment?.treatment_items?.includes('放射治療') ? 1 : 0,
        服藥9種或以上: activePrescriptions.length >= 9 ? 1 : 0,
        入住醫院: isHospitalized ? 1 : 0,
        認知障礙: hasCognitiveImpairment ? 1 : 0,
        錯發藥物: hasMedicationError ? 1 : 0,
        失禁: patient.護理等級 === '全護理' ? 1 : 0,
        如廁訓練: assessment?.bowel_bladder_control?.toilet_training ? 1 : 0,
        壓瘡: hasPressureUlcer(patient.院友id) ? 1 : 0,
        跌倒: hasFall ? 1 : 0,
        體重下降5: hasWeightDecrease ? 1 : 0,
        哽塞: hasChoking ? 1 : 0,
        脫水: hasDehydration ? 1 : 0,
        轉身: hasCareTab(patient.院友id, 'position') ? 1 : 0,
        傳染病: infectionControlRecords.some(r => r.patient_id === patient.院友id && !r.recovery_date) ? 1 : 0,
        尿道炎: 0,
      };
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center mb-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTimeFilter('today')}
                className={`px-4 py-2 rounded-lg ${timeFilter === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                當月
              </button>
              <button
                onClick={() => setTimeFilter('yesterday')}
                className={`px-4 py-2 rounded-lg ${timeFilter === 'yesterday' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                上月
              </button>
            </div>
          </div>
        </div>

        <MonthlyReportTable data={tableData} />
      </div>
    );
  };

  const renderInfectionReport = () => {
    const activePatients = (allPatients || []).filter(p => p.在住狀態 === '在住');
    const activeInfections = infectionControlRecords.filter(r => !r.recovery_date);
    const infectionPatients = activePatients.filter(p =>
      activeInfections.some(r => r.patient_id === p.院友id)
    );
    const infectionStats = computeStationStats(
      activePatients,
      stations,
      p => activeInfections.some(r => r.patient_id === p.院友id)
    );

    // 按感染性質動態分組，僅為實際存在的性質生成卡片

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">感染控制統計</h3>
          {infectionStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暫無感染控制記錄</p>
          ) : (
            renderStationStatCards(infectionStats, 'bg-red-100', 'text-red-700')
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">感染控制名單 (共 {infectionPatients.length} 人)</h3>
          <div className="space-y-4">
            {infectionPatients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無感染控制記錄</p>
            ) : (
              infectionPatients.map(patient => {
                const patientActiveInfections = infectionControlRecords.filter(
                  r => r.patient_id === patient.院友id && !r.recovery_date
                );
                return (
                  <div key={patient.院友id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-lg text-red-800"><BedNumberImprint patient={patient} size="lg" /> {patient.中文姓氏}{patient.中文名字}</h4>
                        <p className="text-sm text-gray-700 mt-1">性別: {patient.性別} | 護理等級: {patient.護理等級 || '未設定'}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {patientActiveInfections.map((infection) => (
                            <span key={infection.id} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                              {infection.infection_type}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMealKitchenStats = (guidances: MealGuidance[], title: string) => {
    const statistics = {
      總餐膳數: guidances.length,
      正飯: guidances.filter(g => g.meal_combination?.includes('正飯')).length,
      軟飯: guidances.filter(g => g.meal_combination?.includes('軟飯')).length,
      糊飯: guidances.filter(g => g.meal_combination?.includes('糊飯')).length,
      正餸: guidances.filter(g => g.meal_combination?.includes('正餸')).length,
      碎餸: guidances.filter(g => g.meal_combination?.includes('碎餸')).length,
      糊餸: guidances.filter(g => g.meal_combination?.includes('糊餸')).length,
      糖尿餐: guidances.filter(g => g.special_diets?.includes('糖尿餐')).length,
      痛風餐: guidances.filter(g => g.special_diets?.includes('痛風餐')).length,
      低鹽餐: guidances.filter(g => g.special_diets?.includes('低鹽餐')).length,
      雞蛋總數: guidances
        .filter(g => g.special_diets?.includes('雞蛋') && g.egg_quantity)
        .reduce((sum, g) => sum + (g.egg_quantity || 0), 0),
      需要凝固粉: guidances.filter(g => g.needs_thickener).length,
    };

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">總數統計</h4>
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">餐膳總數</span>
                <span className="font-bold text-blue-600 text-lg">{statistics.總餐膳數} 份</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">需要凝固粉</span>
                <span className="font-medium text-blue-600">{statistics.需要凝固粉} 份</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">主食需求</h4>
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">正飯</span>
                <span className="font-medium text-green-600">{statistics.正飯} 份</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">軟飯</span>
                <span className="font-medium text-yellow-600">{statistics.軟飯} 份</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">糊飯</span>
                <span className="font-medium text-orange-600">{statistics.糊飯} 份</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">配菜需求</h4>
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">正餸</span>
                <span className="font-medium text-green-600">{statistics.正餸} 份</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">碎餸</span>
                <span className="font-medium text-yellow-600">{statistics.碎餸} 份</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">糊餸</span>
                <span className="font-medium text-orange-600">{statistics.糊餸} 份</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">特殊餐膳需求</h4>
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">糖尿餐</span>
                <span className="font-medium text-blue-600">{statistics.糖尿餐} 份</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">痛風餐</span>
                <span className="font-medium text-purple-600">{statistics.痛風餐} 份</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">低鹽餐</span>
                <span className="font-medium text-green-600">{statistics.低鹽餐} 份</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                <span className="text-sm text-gray-600">雞蛋</span>
                <span className="font-medium text-yellow-600">{statistics.雞蛋總數} 隻</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMealReport = () => {
    const activePatients = (allPatients || []).filter(p => p.在住狀態 === '在住');
    const stationMap = new Map(stations.map(s => [s.id, s]));
    const byStation = new Map<string, Patient[]>();
    for (const p of activePatients) {
      const stationId = getReportStationId(p) || 'unknown';
      const list = byStation.get(stationId) || [];
      list.push(p);
      byStation.set(stationId, list);
    }

    const stationStats = [] as { stationId: string; stationName: string; guidances: MealGuidance[] }[];
    for (const [stationId, stationPatients] of byStation) {
      const patientIds = new Set(stationPatients.map(p => p.院友id));
      const guidances = (mealGuidances || []).filter(mg => patientIds.has(mg.patient_id));
      stationStats.push({
        stationId,
        stationName: stationMap.get(stationId)?.name || '未分區',
        guidances,
      });
    }
    stationStats.sort((a, b) => {
      const idxA = stations.findIndex(s => s.id === a.stationId);
      const idxB = stations.findIndex(s => s.id === b.stationId);
      if (idxA === -1 && idxB === -1) return a.stationName.localeCompare(b.stationName, 'zh-Hant');
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    const allGuidances = (mealGuidances || []).filter(mg => activePatients.some(p => p.院友id === mg.patient_id));

    return (
      <div className="space-y-6">
        {allGuidances.length > 0 ? (
          renderMealKitchenStats(allGuidances, '全部廚房統計')
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">餐膳統計</h3>
            <p className="text-gray-500 text-center py-8">暫無餐膳記錄</p>
          </div>
        )}
        {stationStats.map(stat =>
          stat.guidances.length > 0 ? (
            <div key={stat.stationId}>
              {renderMealKitchenStats(stat.guidances, stat.stationName + ' 廚房統計')}
            </div>
          ) : null
        )}
      </div>
    );
  };

  const renderTubeReport = () => {
    const activePatients = (allPatients || []).filter(p => p.在住狀態 === '在住');
    const nonTerminatedRecords = (patientTubeCareRecords || []).filter(record => !record.is_terminated);

    const latestByCareType = new Map<string, PatientTubeCareRecord>();
    for (const record of nonTerminatedRecords) {
      const key = `${record.patient_id}_${record.care_type}`;
      const existing = latestByCareType.get(key);
      if (!existing) {
        latestByCareType.set(key, record);
      } else {
        const getDate = (r: PatientTubeCareRecord) => r.execution_date || r.updated_at || r.created_at;
        const recordDate = getDate(record);
        const existingDate = getDate(existing);
        if (recordDate && (!existingDate || new Date(recordDate) > new Date(existingDate))) {
          latestByCareType.set(key, record);
        }
      }
    }
    const activeTubeRecords = Array.from(latestByCareType.values());

    const tubeStats = computeStationStats(
      activePatients,
      stations,
      p => activeTubeRecords.some(record => record.patient_id === p.院友id)
    );

    const recordMap = new Map<number, PatientTubeCareRecord[]>();
    for (const record of activeTubeRecords) {
      const list = recordMap.get(record.patient_id) || [];
      list.push(record);
      recordMap.set(record.patient_id, list);
    }

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">喉管護理統計</h3>
          {tubeStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暫無喉管護理記錄</p>
          ) : (
            renderStationStatCards(tubeStats, 'bg-teal-100', 'text-teal-700')
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">喉管相關報表 (共 {activeTubeRecords.length} 項)</h3>
          <div className="space-y-4">
            {activeTubeRecords.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無喉管相關記錄</p>
            ) : (
              activeTubeRecords.map(record => {
                const patient = activePatients.find(p => p.院友id === record.patient_id);
                if (!patient) return null;
                const tubeNature = [record.tube_material, record.oxygen_action].filter(Boolean).join(' / ');
                return (
                  <div key={record.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-lg mb-2"><BedNumberImprint patient={patient} size="lg" /> {patient.中文姓氏}{patient.中文名字}</h4>
                        <p className="text-sm text-gray-600">喉管護理類型: <span className="font-medium">{record.care_type}</span></p>
                      </div>
                      <div className="space-y-1 text-sm">
                        {record.execution_date && (
                          <p className="text-gray-700">
                            上次完成: <span className="font-medium">{formatDisplayDate(record.execution_date)}</span>
                          </p>
                        )}
                        {record.next_due_date && (
                          <p className="text-blue-600">
                            下次到期: <span className="font-medium">{formatDisplayDate(record.next_due_date)}</span>
                          </p>
                        )}
                        {tubeNature && (
                          <p className="text-gray-700">
                            喉管性質: <span className="font-medium">{tubeNature}</span>
                          </p>
                        )}
                        {record.tube_size && (
                          <p className="text-gray-700">
                            管徑: <span className="font-medium">{record.tube_size}</span>
                          </p>
                        )}
                        {record.notes && (
                          <p className="text-gray-500">
                            備註: {record.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSpecialCareList = () => {
    const activePatients = (allPatients || []).filter(p => p.在住狀態 === '在住');
    const specialCareTasks = (patientHealthTasks || []).filter(task =>
      task.notes === '特別關顧' &&
      activePatients.some(p => p.院友id === task.patient_id)
    );
    const specialCareStats = computeStationStats(
      activePatients,
      stations,
      p => (patientHealthTasks || []).some(task =>
        task.notes === '特別關顧' && task.patient_id === p.院友id
      )
    );
    const specialCarePatientIds = new Set(specialCareTasks.map(t => t.patient_id));
    const specialCarePatients = activePatients.filter(p => specialCarePatientIds.has(p.院友id));

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">特別關顧統計</h3>
          {specialCareStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暫無特別關顧記錄</p>
          ) : (
            renderStationStatCards(specialCareStats, 'bg-red-100', 'text-red-700')
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">特別關顧名單 (共 {specialCarePatients.length} 人)</h3>
          <div className="space-y-4">
            {specialCarePatients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無特別關顧院友</p>
            ) : (
              specialCarePatients.map(patient => {
                const tasks = specialCareTasks.filter(t => t.patient_id === patient.院友id);
                return (
                  <div key={patient.院友id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg text-red-800"><BedNumberImprint patient={patient} size="lg" /> {patient.中文姓氏}{patient.中文名字}</h4>
                        <p className="text-sm text-gray-700 mt-1">性別: {patient.性別} | 護理等級: {patient.護理等級 || '未設定'}</p>
                        <div className="mt-3 space-y-2">
                          {tasks.map(task => (
                            <div key={task.id} className="bg-white p-2 rounded border border-red-200">
                              <p className="text-sm">
                                <span className="font-medium text-red-700">監測項目：</span>
                                {task.health_record_type}
                              </p>
                              <p className="text-sm">
                                <span className="font-medium text-red-700">頻率：</span>
                                {task.frequency_unit === 'hourly' ? `每 ${task.frequency_value} 小時 1 次` : formatFrequencyDescription(task)}
                              </p>
                              {task.specific_times && Array.isArray(task.specific_times) && task.specific_times.length > 0 && (
                                <p className="text-sm text-gray-600">
                                  指定時間：{task.specific_times.map((t) => formatTimeToHHMM(t)).join(', ')}
                                </p>
                              )}
                              {task.next_due_at && (
                                <p className="text-sm text-blue-600">
                                  下次到期：{formatDisplayDateTime(new Date(task.next_due_at))}
                                </p>
                              )}
                              {task.notes && (
                                <p className="text-sm text-gray-600">
                                  備註：{task.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDrugSensitivityReport = () => {
    const activePatients = (allPatients || []).filter(p => p.在住狀態 === '在住');
    const drugSensitivityPatients = activePatients.filter(p =>
      (p.藥物敏感 && Array.isArray(p.藥物敏感) && p.藥物敏感.length > 0) ||
      (p.不良藥物反應 && Array.isArray(p.不良藥物反應) && p.不良藥物反應.length > 0)
    );

    const drugStats = computeStationStats(
      activePatients,
      stations,
      p => Boolean(
        (p.藥物敏感 && Array.isArray(p.藥物敏感) && p.藥物敏感.length > 0) ||
        (p.不良藥物反應 && Array.isArray(p.不良藥物反應) && p.不良藥物反應.length > 0)
      )
    );
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">藥物敏感統計</h3>
          {drugStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暫無藥物敏感或不良反應記錄</p>
          ) : (
            renderStationStatCards(drugStats, 'bg-orange-100', 'text-orange-700')
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">藥物敏感報表 (共 {drugSensitivityPatients.length} 人)</h3>
          <div className="space-y-4">
            {drugSensitivityPatients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無藥物敏感或不良反應記錄</p>
            ) : (
              drugSensitivityPatients.map(patient => (
                <div key={patient.院友id} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg text-orange-800"><BedNumberImprint patient={patient} size="lg" /> {patient.中文姓氏}{patient.中文名字}</h4>
                      <p className="text-sm text-gray-700 mt-1">性別: {patient.性別} | 護理等級: {patient.護理等級 || '未設定'}</p>

                      {patient.藥物敏感 && Array.isArray(patient.藥物敏感) && patient.藥物敏感.length > 0 && (
                        <div className="mt-3">
                          <p className="font-medium text-orange-800 mb-2">藥物敏感:</p>
                          <div className="flex flex-wrap gap-2">
                            {patient.藥物敏感.map((drug: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                                {drug}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {patient.不良藥物反應 && Array.isArray(patient.不良藥物反應) && patient.不良藥物反應.length > 0 && (
                        <div className="mt-3">
                          <p className="font-medium text-red-800 mb-2">不良藥物反應:</p>
                          <div className="flex flex-wrap gap-2">
                            {patient.不良藥物反應.map((drug: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                {drug}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDiaperStatisticsReport = () => {
    const patientById = new Map((allPatients || []).map(p => [p.院友id, p]));

    const monthTotalsByPatient = new Map<number, Map<string, { urineCount: number; coreCount: number }>>();
    let minMonth: string | null = null;
    let maxMonth: string | null = null;
    for (const record of (diaperChangeRecords || [])) {
      const month = record.change_date.slice(0, 7);
      if (!minMonth || month < minMonth) minMonth = month;
      if (!maxMonth || month > maxMonth) maxMonth = month;
      const patientMonthMap = monthTotalsByPatient.get(record.patient_id) || new Map<string, { urineCount: number; coreCount: number }>();
      const existing = patientMonthMap.get(month) || { urineCount: 0, coreCount: 0 };
      existing.urineCount += record.urine_count ?? 0;
      existing.coreCount += record.core_count ?? 0;
      patientMonthMap.set(month, existing);
      monthTotalsByPatient.set(record.patient_id, patientMonthMap);
    }

    // 月份範圍：用戶指定優先，預設最近 9 個月（以最後記錄月份為結束）
    const shiftMonth = (month: string, delta: number): string => {
      let year = Number(month.slice(0, 4));
      let monthNum = Number(month.slice(5, 7)) + delta;
      while (monthNum > 12) { monthNum -= 12; year += 1; }
      while (monthNum < 1) { monthNum += 12; year -= 1; }
      return `${year}-${String(monthNum).padStart(2, '0')}`;
    };
    const effectiveEndMonth = diaperEndMonth || maxMonth;
    const effectiveStartMonth = diaperStartMonth || (effectiveEndMonth ? shiftMonth(effectiveEndMonth, -8) : null);
    const months: string[] = [];
    if (effectiveStartMonth && effectiveEndMonth) {
      const rangeStart = effectiveStartMonth <= effectiveEndMonth ? effectiveStartMonth : effectiveEndMonth;
      const rangeEnd = effectiveStartMonth <= effectiveEndMonth ? effectiveEndMonth : effectiveStartMonth;
      let current = rangeStart;
      let guard = 0;
      while (current <= rangeEnd && guard < 600) {
        months.push(current);
        current = shiftMonth(current, 1);
        guard += 1;
      }
    }

    interface DiaperMatrixPatient {
      patientId: number;
      patient: Patient | undefined;
      bed: string;
      name: string;
    }

    // 列入院友 = 床頭記錄開啟「換片記錄」tab 的院友 ∪ 有換片記錄行的院友（不作在住狀態過濾）
    const diaperPatientIds = new Set<number>(monthTotalsByPatient.keys());
    for (const tab of (patientCareTabs || [])) {
      if (tab.tab_type === 'diaper') diaperPatientIds.add(tab.patient_id);
    }

    const byStation = new Map<string, DiaperMatrixPatient[]>();
    for (const patientId of diaperPatientIds) {
      const patient = patientById.get(patientId);
      const stationId = (patient ? getReportStationId(patient) : null) || 'unknown';
      const name = patient
        ? (`${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`.trim() || patient.中文姓名 || `院友 #${patientId}`)
        : `院友 #${patientId}`;
      const list = byStation.get(stationId) || [];
      list.push({ patientId, patient, bed: patient?.床號 || '', name });
      byStation.set(stationId, list);
    }

    const sortMatrixPatients = (list: DiaperMatrixPatient[]) => [...list].sort((a, b) => {
      if (a.bed !== b.bed) return a.bed.localeCompare(b.bed, 'zh-Hant');
      return a.name.localeCompare(b.name, 'zh-Hant');
    });

    const knownStationIds = new Set(stations.map(s => s.id));
    const groups: { stationId: string; stationName: string; patients: DiaperMatrixPatient[] }[] = stations.map(station => ({
      stationId: station.id,
      stationName: station.name,
      patients: sortMatrixPatients(byStation.get(station.id) || []),
    }));
    const unassigned: DiaperMatrixPatient[] = [];
    for (const [stationId, list] of byStation) {
      if (!knownStationIds.has(stationId)) unassigned.push(...list);
    }
    if (unassigned.length > 0) {
      groups.push({ stationId: 'unknown', stationName: '未分區', patients: sortMatrixPatients(unassigned) });
    }

    const getPatientMonth = (patientId: number, month: string) =>
      monthTotalsByPatient.get(patientId)?.get(month) || { urineCount: 0, coreCount: 0 };

    const getGroupMonthTotals = (group: { patients: DiaperMatrixPatient[] }, month: string) => {
      let urine = 0;
      let core = 0;
      for (const p of group.patients) {
        const total = getPatientMonth(p.patientId, month);
        urine += total.urineCount;
        core += total.coreCount;
      }
      return { urine, core };
    };

    const grandMonthTotals = months.map(month => {
      let urine = 0;
      let core = 0;
      for (const group of groups) {
        const total = getGroupMonthTotals(group, month);
        urine += total.urine;
        core += total.core;
      }
      return { month, urine, core };
    });

    const matrixColSpan = 2 + months.length * 2;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-1">每月尿片統計矩陣</h3>
          <p className="text-sm text-gray-500 mb-3">點擊居住區行可展開／收合該區院友明細</p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">月份範圍：</label>
            <input
              type="month"
              value={effectiveStartMonth || ''}
              onChange={e => setDiaperStartMonth(e.target.value)}
              className="form-input text-sm"
            />
            <span className="text-sm text-gray-500">至</span>
            <input
              type="month"
              value={effectiveEndMonth || ''}
              onChange={e => setDiaperEndMonth(e.target.value)}
              className="form-input text-sm"
            />
            <span className="text-xs text-gray-500">（預設最近 9 個月，可指定任何月份）</span>
          </div>
          {months.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暫無尿片記錄</p>
          ) : (
            <div className="overflow-auto max-h-[75vh]">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th rowSpan={2} className="sticky left-0 top-0 z-30 bg-gray-50 w-24 min-w-24 px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 whitespace-nowrap">床號</th>
                    <th rowSpan={2} className="sticky left-24 top-0 z-30 bg-gray-50 min-w-28 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 whitespace-nowrap">姓名</th>
                    {months.map(month => (
                      <th key={month} colSpan={2} className="sticky top-0 z-20 bg-gray-50 h-9 px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 whitespace-nowrap">{month}</th>
                    ))}
                  </tr>
                  <tr className="bg-gray-50">
                    {months.map(month => (
                      <React.Fragment key={month}>
                        <th className="sticky top-9 z-20 bg-gray-50 px-2 py-1 text-center text-xs font-medium text-gray-500 border border-gray-200 whitespace-nowrap">尿片</th>
                        <th className="sticky top-9 z-20 bg-gray-50 px-2 py-1 text-center text-xs font-medium text-gray-500 border border-gray-200 whitespace-nowrap">片芯</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groups.map(group => {
                    const isExpanded = expandedDiaperStations.has(group.stationId);
                    return (
                    <React.Fragment key={group.stationId}>
                      <tr className="bg-gray-100 cursor-pointer" onClick={() => toggleDiaperStation(group.stationId)}>
                        <td colSpan={matrixColSpan} className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 border border-gray-200">
                          <span className="inline-flex items-center gap-1">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {group.stationName}（{group.patients.length} 位院友）
                          </span>
                        </td>
                      </tr>
                      {isExpanded && group.patients.map(matrixPatient => {
                        return (
                          <tr key={matrixPatient.patientId}>
                            <td className="sticky left-0 z-10 bg-white px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center border border-gray-200">
                              {matrixPatient.patient ? <BedNumberImprint patient={matrixPatient.patient} size="sm" /> : '—'}
                            </td>
                            <td className="sticky left-24 z-10 bg-white px-3 py-2 whitespace-nowrap text-sm text-gray-900 border border-gray-200">{matrixPatient.name}</td>
                            {months.map(month => {
                              const monthTotal = getPatientMonth(matrixPatient.patientId, month);
                              return (
                                <React.Fragment key={month}>
                                  <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900 text-right border border-gray-200">{monthTotal.urineCount}</td>
                                  <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900 text-right border border-gray-200">{monthTotal.coreCount}</td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={2} className="sticky left-0 z-10 bg-gray-50 px-3 py-2 whitespace-nowrap text-sm text-gray-900 border border-gray-200">{group.stationName} 小計</td>
                        {months.map(month => {
                          const monthTotal = getGroupMonthTotals(group, month);
                          return (
                            <React.Fragment key={month}>
                              <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900 text-right border border-gray-200">{monthTotal.urine}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900 text-right border border-gray-200">{monthTotal.core}</td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                    );
                  })}
                  <tr className="bg-blue-50 font-bold">
                    <td colSpan={2} className="sticky left-0 z-10 bg-blue-50 px-3 py-2 whitespace-nowrap text-sm text-gray-900 border border-gray-200">所有居住區總計</td>
                    {grandMonthTotals.map(monthTotal => (
                      <React.Fragment key={monthTotal.month}>
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900 text-right border border-gray-200">{monthTotal.urine}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900 text-right border border-gray-200">{monthTotal.core}</td>
                      </React.Fragment>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFeeReport = () => {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <Receipt className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-3 text-lg font-semibold text-gray-900">雜費記錄報表</h3>
        <p className="mt-2 text-sm text-gray-500">
          請使用右上角「列印」按鈕，選擇月份及院友後產生 A4 卡片式報表。
        </p>
      </div>
    );
  };

  return (
    <>
    <div className="p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">統計報表</h1>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'meal' || activeTab === 'tube' || activeTab === 'infection' || activeTab === 'special' || activeTab === 'drugSensitivity' || activeTab === 'diaper' || activeTab === 'fee') {
                setInitialPrintDocumentIds([TAB_DOCUMENT_MAP[activeTab]]);
                setPrintModalOpen(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" />
            列印
          </button>
        </div>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 font-medium ${activeTab === 'daily' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Calendar className="h-4 w-4 inline mr-1" />
            每日報表
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 font-medium ${activeTab === 'monthly' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <FileText className="h-4 w-4 inline mr-1" />
            每月報表
          </button>
          <button
            onClick={() => setActiveTab('infection')}
            className={`px-4 py-2 font-medium ${activeTab === 'infection' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <AlertCircle className="h-4 w-4 inline mr-1" />
            感染控制報表
          </button>
          <button
            onClick={() => setActiveTab('meal')}
            className={`px-4 py-2 font-medium ${activeTab === 'meal' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Utensils className="h-4 w-4 inline mr-1" />
            餐膳報表
          </button>
          <button
            onClick={() => setActiveTab('tube')}
            className={`px-4 py-2 font-medium ${activeTab === 'tube' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Stethoscope className="h-4 w-4 inline mr-1" />
            喉管相關報表
          </button>
          <button
            onClick={() => setActiveTab('special')}
            className={`px-4 py-2 font-medium ${activeTab === 'special' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Activity className="h-4 w-4 inline mr-1" />
            特別關顧名單
          </button>
          <button
            onClick={() => setActiveTab('drugSensitivity')}
            className={`px-4 py-2 font-medium ${activeTab === 'drugSensitivity' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <AlertCircle className="h-4 w-4 inline mr-1" />
            藥物敏感報表
          </button>
          <button
            onClick={() => setActiveTab('diaper')}
            className={`px-4 py-2 font-medium ${activeTab === 'diaper' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Droplets className="h-4 w-4 inline mr-1" />
            尿片統計報表
          </button>
          <button
            onClick={() => setActiveTab('fee')}
            className={`px-4 py-2 font-medium ${activeTab === 'fee' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Receipt className="h-4 w-4 inline mr-1" />
            雜費記錄報表
          </button>
          <button
            onClick={() => setActiveTab('aiUsage')}
            className={`px-4 py-2 font-medium ${activeTab === 'aiUsage' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Bot className="h-4 w-4 inline mr-1" />
            AI 使用統計
          </button>
        </div>
      </div>

      <div>
        {activeTab === 'daily' && renderDailyReport()}
        {activeTab === 'monthly' && renderMonthlyReport()}
        {activeTab === 'infection' && renderInfectionReport()}
        {activeTab === 'meal' && renderMealReport()}
        {activeTab === 'tube' && renderTubeReport()}
        {activeTab === 'special' && renderSpecialCareList()}
        {activeTab === 'drugSensitivity' && renderDrugSensitivityReport()}
        {activeTab === 'diaper' && renderDiaperStatisticsReport()}
        {activeTab === 'fee' && renderFeeReport()}
        {activeTab === 'aiUsage' && <AiUsageStatsPanel />}
      </div>
    </div>
    {printModalOpen && (
      <PatientPrintModal
        patients={(allPatients || []).filter(p => p.在住狀態 === '在住')}
        onClose={() => setPrintModalOpen(false)}
        onPrint={handlePrintStatistics}
        initialTab="統計報表"
        initialSelectedDocumentIds={initialPrintDocumentIds}
        initialSelectedPatientIds={(allPatients || []).filter(p => p.在住狀態 === '在住').map(p => p.院友id)}
        initialStartDate={(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; })()}
        initialEndDate={new Date().toISOString().split('T')[0]}
      />
    )}
    </>
  );
};

export default Reports;

