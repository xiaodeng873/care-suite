import React, { useState, useMemo } from 'react';
import { BarChart3, Download, Calendar, Users, FileText, Activity, Utensils, Stethoscope, AlertCircle } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import MonthlyReportTable from '../components/MonthlyReportTable';
import PatientListModal from '../components/PatientListModal';

type ReportTab = 'daily' | 'monthly' | 'infection' | 'meal' | 'tube' | 'special' | 'drugSensitivity';
type TimeFilter = 'today' | 'yesterday' | 'thisMonth' | 'lastMonth';
type StationFilter = 'all' | string;

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
  const { patients, stations, healthAssessments, woundAssessments, incidentReports, patientHealthTasks, patientRestraintAssessments, prescriptions, healthRecords, mealGuidances, hospitalEpisodes, loading } = usePatients();
  const [activeTab, setActiveTab] = useState<ReportTab>('daily');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [stationFilter, setStationFilter] = useState<StationFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalPatients, setModalPatients] = useState<string[]>([]);

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

  const filteredPatients = useMemo(() => {
    if (stationFilter === 'all') return patients || [];
    return (patients || []).filter(p => p.station_id === stationFilter);
  }, [patients, stationFilter]);

  const dailyReportData = useMemo(() => {
    const targetDate = timeFilter === 'today' ? today : yesterday;
    const activePatients = filteredPatients.filter(p => p.在住狀態 === '在住');

    const 買位Patients = activePatients.filter(p => p.入住類型 === '買位');
    const 私位Patients = activePatients.filter(p => p.入住類型 === '私位');
    const 院舍劵Patients = activePatients.filter(p => p.入住類型 === '院舍卷');
    const 暫住Patients = activePatients.filter(p => p.入住類型 === '暫住');

    const admissionTypeStats = {
      買位: { count: 買位Patients.length, names: 買位Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
      私位: { count: 私位Patients.length, names: 私位Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
      院舍劵: { count: 院舍劵Patients.length, names: 院舍劵Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
      暫住: { count: 暫住Patients.length, names: 暫住Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
    };

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
      住在本站男Names: 住在本站男Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`),
      住在本站女Names: 住在本站女Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`),
      入住醫院男Names: 入住醫院男Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`),
      入住醫院女Names: 入住醫院女Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`),
      暫時回家男Names: 暫時回家男Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`),
      暫時回家女Names: 暫時回家女Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`),
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
      const deathDate = new Date(p.death_date);
      return deathDate >= targetDate && deathDate < new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
    });

    const monthStart = timeFilter === 'today' ? thisMonthStart : lastMonthStart;
    const monthEnd = timeFilter === 'today' ? thisMonthEnd : lastMonthEnd;
    const monthlyDeathPatients = (patients || []).filter(p => {
      if (!p.death_date || p.discharge_reason !== '死亡') return false;
      const deathDate = new Date(p.death_date);
      return deathDate >= monthStart && deathDate <= monthEnd;
    });

    const ngTubePatients = activePatients.filter(p => {
      return (patientHealthTasks || []).some(task =>
        task.patient_id === p.院友id &&
        task.health_record_type === '鼻胃飼管更換'
      );
    });

    const catheterPatients = activePatients.filter(p => {
      return (patientHealthTasks || []).some(task =>
        task.patient_id === p.院友id &&
        task.health_record_type === '尿導管更換'
      );
    });

    const woundPatientIds = new Set<number>();
    const pressureUlcerPatientIds = new Set<number>();
    (woundAssessments || []).forEach(assessment => {
      const patient = activePatients.find(p => p.院友id === assessment.patient_id);
      if (!patient) return;

      assessment.wound_details?.forEach(detail => {
        if (detail.wound_status === '未處理' || detail.wound_status === '治療中') {
          woundPatientIds.add(assessment.patient_id);
          if (detail.wound_type === '壓力性') {
            pressureUlcerPatientIds.add(assessment.patient_id);
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
      return assessment?.bowel_bladder_control?.bowel === '腸造口' || assessment?.bowel_bladder_control?.bladder === '小便造口';
    });

    const infectionControlPatients = activePatients.filter(p =>
      p.感染控制 && p.感染控制.length > 0
    );

    const restraintPatientIds = new Set((patientRestraintAssessments || []).map(r => r.patient_id));
    const restraintPatients = activePatients.filter(p => restraintPatientIds.has(p.院友id));

    const todayIncidents = (incidentReports || []).filter(incident => {
      const incidentDate = new Date(incident.incident_date);
      return incidentDate.toDateString() === targetDate.toDateString();
    });

    const medicationIncidentPatients = todayIncidents.filter(i => i.incident_type === '藥物');
    const fallIncidentPatients = todayIncidents.filter(i => i.incident_nature === '跌倒');

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
        names: newAdmissionsPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`)
      },
      discharge: {
        男: dischargePatients.filter(p => p.性別 === '男').length,
        女: dischargePatients.filter(p => p.性別 === '女').length,
        total: dischargePatients.length,
        names: dischargePatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`)
      },
      death: {
        男: deathPatients.filter(p => p.性別 === '男').length,
        女: deathPatients.filter(p => p.性別 === '女').length,
        total: deathPatients.length,
        names: deathPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`)
      },
      monthlyDeaths: {
        count: monthlyDeathPatients.length,
        names: monthlyDeathPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`)
      },
      medical: {
        鼻胃飼: { count: ngTubePatients.length, names: ngTubePatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        導尿管: { count: catheterPatients.length, names: catheterPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        傷口: { count: woundPatients.length, names: woundPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        壓瘡: { count: pressureUlcerPatients.length, names: pressureUlcerPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        腹膜血液透析: { count: dialysisPatients.length, names: dialysisPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        氧氣治療: { count: oxygenPatients.length, names: oxygenPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        造口: { count: stomaPatients.length, names: stomaPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        感染控制: { count: infectionControlPatients.length, names: infectionControlPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        使用約束物品: { count: restraintPatients.length, names: restraintPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
      },
      incidents: {
        藥物: { count: medicationIncidentPatients.length, names: medicationIncidentPatients.map(i => {
          const p = activePatients.find(patient => patient.院友id === i.patient_id);
          return p ? `${p.床號} ${p.中文姓氏}${p.中文名字}` : '未知';
        })},
        跌倒: { count: fallIncidentPatients.length, names: fallIncidentPatients.map(i => {
          const p = activePatients.find(patient => patient.院友id === i.patient_id);
          return p ? `${p.床號} ${p.中文姓氏}${p.中文名字}` : '未知';
        })},
        死亡: { count: deathPatients.length, names: deathPatients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
      },
      careLevel: {
        全護理男: { count: fullCare男Patients.length, names: fullCare男Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        全護理女: { count: fullCare女Patients.length, names: fullCare女Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        半護理男: { count: semiCare男Patients.length, names: semiCare男Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        半護理女: { count: semiCare女Patients.length, names: semiCare女Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        療養級男: { count: convalescent男Patients.length, names: convalescent男Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
        療養級女: { count: convalescent女Patients.length, names: convalescent女Patients.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`) },
      },
    };
  }, [filteredPatients, timeFilter, healthAssessments, woundAssessments, incidentReports, patientRestraintAssessments, patientHealthTasks, today, yesterday, thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd, patients]);

  const monthlyReportData = useMemo(() => {
    const activePatients = filteredPatients.filter(p => p.在住狀態 === '在住');
    const monthStart = timeFilter === 'today' ? thisMonthStart : lastMonthStart;
    const monthEnd = timeFilter === 'today' ? thisMonthEnd : lastMonthEnd;

    // 半護理
    const semiCarePatients = activePatients.filter(p => p.護理等級 === '半護理');

    // 全護理
    const fullCarePatients = activePatients.filter(p => p.護理等級 === '全護理');

    // 導尿管
    const catheterPatients = activePatients.filter(p => {
      return (patientHealthTasks || []).some(task =>
        task.patient_id === p.院友id &&
        task.health_record_type === '尿導管更換'
      );
    });

    // 遊走
    const wanderingPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.behavior_expression?.includes('遊走');
    });

    // 情緒問題 (抑鬱/激動)
    const emotionalPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.emotional_expression === '抑鬱' || assessment?.emotional_expression === '激動';
    });

    // 長期卧床
    const bedriddenPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.daily_activities?.mobility === '卧床';
    });

    // 長期使用輪椅
    const wheelchairPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.daily_activities?.mobility === '輪椅';
    });

    // 一人協助
    const onePersonAssistPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.daily_activities?.mobility === '一人協助';
    });

    // 二人協助
    const twoPersonAssistPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.daily_activities?.mobility === '二人協助';
    });

    // 需餵食
    const needFeedingPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.daily_activities?.eating === '需要幫助' || assessment?.daily_activities?.eating === '完全依賴';
    });

    // 鼻胃飼
    const ngTubePatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.nutrition_diet?.status === '鼻胃管';
    });

    // 腹膜/血液透析
    const dialysisPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.treatment_items?.includes('腹膜/血液透析');
    });

    // 造口
    const stomaPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.bowel_bladder_control?.bowel === '腸造口' || assessment?.bowel_bladder_control?.bladder === '小便造口';
    });

    // 服藥9種或以上
    const multiMedicationPatients = activePatients.filter(p => {
      const activePrescriptions = (prescriptions || []).filter(rx =>
        rx.patient_id === p.院友id && rx.status === 'active'
      );
      return activePrescriptions.length >= 9;
    });

    // 接受物理治療
    const physioTherapyPatients = activePatients.filter(p => {
      return (patientHealthTasks || []).some(task =>
        task.patient_id === p.院友id &&
        task.notes === '物理治療'
      );
    });

    // 接受職業治療
    const occupationalTherapyPatients = activePatients.filter(p => {
      return (patientHealthTasks || []).some(task =>
        task.patient_id === p.院友id &&
        task.notes === '職業治療'
      );
    });

    // 醫院服務使用人次（本月入院事件總次數，包含重複患者）
    const hospitalServiceEpisodes = (hospitalEpisodes || []).filter(episode => {
      const startDate = new Date(episode.episode_start_date);
      return startDate >= thisMonthStart && startDate <= thisMonthEnd;
    });

    const hospitalServiceCount = hospitalServiceEpisodes.length;

    const hospitalServicePatientNames = hospitalServiceEpisodes.map(episode => {
      const patient = activePatients.find(p => p.院友id === episode.patient_id);
      return patient ? `${patient.床號} ${patient.中文姓氏}${patient.中文名字}` : '';
    }).filter(name => name !== '');

    // 認知障礙
    const cognitiveImpairmentPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.consciousness_cognition?.includes('認知障礙') || assessment?.consciousness_cognition?.includes('失智');
    });

    // 失禁 (全護理)
    const incontinencePatients = fullCarePatients;

    // 如廁訓練
    const toiletTrainingPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.toilet_training === true;
    });

    // 壓瘡
    const pressureUlcerPatientIds = new Set<number>();
    (woundAssessments || []).forEach(assessment => {
      assessment.wound_details?.forEach(detail => {
        if ((detail.wound_status === '未處理' || detail.wound_status === '治療中') &&
            detail.wound_type === '壓力性') {
          pressureUlcerPatientIds.add(assessment.patient_id);
        }
      });
    });
    const pressureUlcerPatients = activePatients.filter(p => pressureUlcerPatientIds.has(p.院友id));

    // 跌倒 (當月)
    const monthlyFallIncidents = (incidentReports || []).filter(incident => {
      const incidentDate = new Date(incident.incident_date);
      return incident.incident_type === '跌倒' &&
             incidentDate >= monthStart &&
             incidentDate <= monthEnd;
    });
    const monthlyFallPatientIds = new Set(monthlyFallIncidents.map(i => i.patient_id));
    const monthlyFallPatients = activePatients.filter(p => monthlyFallPatientIds.has(p.院友id));

    // 體重下降5% (當月與上月比較)
    const lastMonthDate = new Date(monthStart);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const weightDecreasePatients = activePatients.filter(p => {
      const currentMonthRecords = (healthRecords || []).filter(r =>
        r.院友id === p.院友id &&
        r.記錄類型 === '體重控制' &&
        r.體重 &&
        new Date(r.記錄日期) >= monthStart &&
        new Date(r.記錄日期) <= monthEnd
      );
      const lastMonthRecords = (healthRecords || []).filter(r =>
        r.院友id === p.院友id &&
        r.記錄類型 === '體重控制' &&
        r.體重 &&
        new Date(r.記錄日期) >= lastMonthDate &&
        new Date(r.記錄日期) < monthStart
      );
      if (currentMonthRecords.length === 0 || lastMonthRecords.length === 0) return false;
      const currentWeight = currentMonthRecords[currentMonthRecords.length - 1].體重;
      const lastWeight = lastMonthRecords[lastMonthRecords.length - 1].體重;
      if (!currentWeight || !lastWeight) return false;
      const decrease = ((lastWeight - currentWeight) / lastWeight) * 100;
      return decrease >= 5;
    });

    // 使用約束物品
    const restraintPatientIds = new Set((patientRestraintAssessments || []).map(r => r.patient_id));
    const restraintPatients = activePatients.filter(p => restraintPatientIds.has(p.院友id));

    // 轉身 (卧床)
    const turningPatients = bedriddenPatients;

    // 傳染病
    const infectiousDiseasePatients = activePatients.filter(p =>
      p.感染控制 && p.感染控制.length > 0
    );

    // 氧氣治療
    const oxygenTherapyPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.treatment_items?.includes('氧氣治療');
    });

    // 皮下注射
    const subcutaneousInjectionPatients = activePatients.filter(p => {
      return (prescriptions || []).some(rx =>
        rx.patient_id === p.院友id &&
        rx.status === 'active' &&
        (rx.administration_route === '皮下注射' || rx.administration_route?.includes('皮下'))
      );
    });

    // 呼吸器
    const respiratorPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.treatment_items?.includes('呼吸器');
    });

    // 善終（晚晴計劃）
    const palliativeCarePatients = activePatients.filter(p => {
      return (patientHealthTasks || []).some(task =>
        task.patient_id === p.院友id &&
        task.health_record_type === '晚晴計劃'
      );
    });

    // 化療
    const chemotherapyPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.treatment_items?.includes('化療');
    });

    // 放射治療
    const radiotherapyPatients = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.treatment_items?.includes('放射治療');
    });

    // 因情緒問題而轉介 - 從事故報告或備註中判斷
    const emotionalReferralPatients = activePatients.filter(p => {
      const hasEmotionalIssue = emotionalPatients.some(ep => ep.院友id === p.院友id);
      const hasReferral = (incidentReports || []).some(incident =>
        incident.patient_id === p.院友id &&
        (incident.incident_details?.includes('轉介') || incident.incident_details?.includes('情緒'))
      );
      return hasEmotionalIssue && hasReferral;
    });

    // 錯發藥物（當月）
    const medicationErrorIncidents = (incidentReports || []).filter(incident => {
      const incidentDate = new Date(incident.incident_date);
      return (incident.incident_type === '其他' &&
              (incident.other_incident_type?.includes('藥物') ||
               incident.other_incident_type?.includes('錯發') ||
               incident.incident_details?.includes('藥物') ||
               incident.incident_details?.includes('錯發'))) &&
             incidentDate >= monthStart &&
             incidentDate <= monthEnd;
    });
    const medicationErrorPatientIds = new Set(medicationErrorIncidents.map(i => i.patient_id));
    const medicationErrorPatients = activePatients.filter(p => medicationErrorPatientIds.has(p.院友id));

    // 哽塞（當月）
    const chokingIncidents = (incidentReports || []).filter(incident => {
      const incidentDate = new Date(incident.incident_date);
      return (incident.other_incident_type?.includes('哽塞') ||
              incident.other_incident_type?.includes('吞嚥') ||
              incident.incident_details?.includes('哽塞') ||
              incident.incident_details?.includes('吞嚥困難')) &&
             incidentDate >= monthStart &&
             incidentDate <= monthEnd;
    });
    const chokingPatientIds = new Set(chokingIncidents.map(i => i.patient_id));
    const chokingPatients = activePatients.filter(p => chokingPatientIds.has(p.院友id));

    // 脫水（當月）
    const dehydrationIncidents = (incidentReports || []).filter(incident => {
      const incidentDate = new Date(incident.incident_date);
      return (incident.other_incident_type?.includes('脫水') ||
              incident.incident_details?.includes('脫水')) &&
             incidentDate >= monthStart &&
             incidentDate <= monthEnd;
    });
    const dehydrationPatientIds = new Set(dehydrationIncidents.map(i => i.patient_id));
    const dehydrationPatients = activePatients.filter(p => dehydrationPatientIds.has(p.院友id));

    // 入住醫院（當前正在住院的患者）
    const hospitalizedPatientIds = new Set<number>();
    (hospitalEpisodes || []).forEach(episode => {
      if (episode.status === 'active') {
        hospitalizedPatientIds.add(episode.patient_id);
      }
    });
    const hospitalizedPatients = activePatients.filter(p => hospitalizedPatientIds.has(p.院友id));

    // 尿道炎 - 這需要從健康記錄或備註中判斷,暫時留空
    const utiPatients: typeof activePatients = [];

    const formatPatientName = (p: typeof activePatients[0]) => `${p.床號} ${p.中文姓氏}${p.中文名字}`;

    return {
      半護理: { count: semiCarePatients.length, names: semiCarePatients.map(formatPatientName) },
      全護理: { count: fullCarePatients.length, names: fullCarePatients.map(formatPatientName) },
      導尿管: { count: catheterPatients.length, names: catheterPatients.map(formatPatientName) },
      遊走: { count: wanderingPatients.length, names: wanderingPatients.map(formatPatientName) },
      情緒問題: { count: emotionalPatients.length, names: emotionalPatients.map(formatPatientName) },
      因情緒問題而轉介: { count: emotionalReferralPatients.length, names: emotionalReferralPatients.map(formatPatientName) },
      長期卧床: { count: bedriddenPatients.length, names: bedriddenPatients.map(formatPatientName) },
      長期使用輪椅: { count: wheelchairPatients.length, names: wheelchairPatients.map(formatPatientName) },
      一人協助: { count: onePersonAssistPatients.length, names: onePersonAssistPatients.map(formatPatientName) },
      二人協助: { count: twoPersonAssistPatients.length, names: twoPersonAssistPatients.map(formatPatientName) },
      需餵食: { count: needFeedingPatients.length, names: needFeedingPatients.map(formatPatientName) },
      鼻胃飼: { count: ngTubePatients.length, names: ngTubePatients.map(formatPatientName) },
      腹膜血液透析: { count: dialysisPatients.length, names: dialysisPatients.map(formatPatientName) },
      造口: { count: stomaPatients.length, names: stomaPatients.map(formatPatientName) },
      氧氣治療: { count: oxygenTherapyPatients.length, names: oxygenTherapyPatients.map(formatPatientName) },
      皮下注射: { count: subcutaneousInjectionPatients.length, names: subcutaneousInjectionPatients.map(formatPatientName) },
      呼吸器: { count: respiratorPatients.length, names: respiratorPatients.map(formatPatientName) },
      善終: { count: palliativeCarePatients.length, names: palliativeCarePatients.map(formatPatientName) },
      化療: { count: chemotherapyPatients.length, names: chemotherapyPatients.map(formatPatientName) },
      放射治療: { count: radiotherapyPatients.length, names: radiotherapyPatients.map(formatPatientName) },
      服藥9種或以上: { count: multiMedicationPatients.length, names: multiMedicationPatients.map(formatPatientName) },
      入住醫院: { count: hospitalizedPatients.length, names: hospitalizedPatients.map(formatPatientName) },
      認知障礙: { count: cognitiveImpairmentPatients.length, names: cognitiveImpairmentPatients.map(formatPatientName) },
      錯發藥物: { count: medicationErrorPatients.length, names: medicationErrorPatients.map(formatPatientName) },
      失禁: { count: incontinencePatients.length, names: incontinencePatients.map(formatPatientName) },
      如廁訓練: { count: toiletTrainingPatients.length, names: toiletTrainingPatients.map(formatPatientName) },
      壓瘡: { count: pressureUlcerPatients.length, names: pressureUlcerPatients.map(formatPatientName) },
      跌倒: { count: monthlyFallPatients.length, names: monthlyFallPatients.map(formatPatientName) },
      體重下降5: { count: weightDecreasePatients.length, names: weightDecreasePatients.map(formatPatientName) },
      哽塞: { count: chokingPatients.length, names: chokingPatients.map(formatPatientName) },
      脫水: { count: dehydrationPatients.length, names: dehydrationPatients.map(formatPatientName) },
      使用約束物品: { count: restraintPatients.length, names: restraintPatients.map(formatPatientName) },
      轉身: { count: turningPatients.length, names: turningPatients.map(formatPatientName) },
      傳染病: { count: infectiousDiseasePatients.length, names: infectiousDiseasePatients.map(formatPatientName) },
      尿道炎: { count: utiPatients.length, names: utiPatients.map(formatPatientName) },
    };
  }, [filteredPatients, timeFilter, healthAssessments, woundAssessments, incidentReports, patientRestraintAssessments, patientHealthTasks, prescriptions, healthRecords, hospitalEpisodes, thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  const renderDailyReport = () => {
    const targetDate = timeFilter === 'today' ? today : yesterday;
    const displayDate = targetDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
      <div className="space-y-6">
        <div className="flex space-x-4 mb-4 print:hidden">
          <div className="flex space-x-2">
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-4 py-2 rounded-lg ${timeFilter === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              當日
            </button>
            <button
              onClick={() => setTimeFilter('yesterday')}
              className={`px-4 py-2 rounded-lg ${timeFilter === 'yesterday' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              昨日
            </button>
          </div>
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="form-input"
          >
            <option value="all">全部站點</option>
            {(stations || []).map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
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

            {/* 本區過去 24 小時 */}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">【本區過去 24 小時】</h3>
              <div className="space-y-3">
                <div className="text-base leading-loose">
                  <span className="text-gray-700">
                    1. 過去 24 小時新收院友: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('新收院友', dailyReportData.newAdmissions.names)}>
                      {dailyReportData.newAdmissions.count}
                    </span> 人; 男 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.newAdmissions.男}</span> 人); 女 (<span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold">{dailyReportData.newAdmissions.女}</span> 人)
                  </span>
                </div>
                <div className="border-t border-gray-300"></div>

                <div className="text-base leading-loose">
                  <span className="text-gray-700">
                    2. 過去 24 小時死亡人數: <span className="inline-block w-12 border-b-2 border-gray-400 text-center font-bold cursor-pointer hover:bg-yellow-100" title="點擊查看院友名單" onClick={() => showPatientList('死亡院友', dailyReportData.death.names)}>
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

      const hasCatheter = (patientHealthTasks || []).some(task =>
        task.patient_id === patient.院友id &&
        task.health_record_type === '尿導管更換'
      );

      const hasWandering = assessment?.behavior_expression?.includes('遊走');
      const hasEmotionalIssue = assessment?.emotional_expression === '抑鬱' || assessment?.emotional_expression === '激動';

      const hasEmotionalReferral = hasEmotionalIssue && (incidentReports || []).some(incident =>
        incident.patient_id === patient.院友id &&
        (incident.incident_details?.includes('轉介') || incident.incident_details?.includes('情緒'))
      );

      const hasPressureUlcer = (woundAssessments || []).some(wa =>
        wa.patient_id === patient.院友id &&
        wa.wound_details?.some(detail =>
          (detail.wound_status === '未處理' || detail.wound_status === '治療中') &&
          detail.wound_type === '壓力性'
        )
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
          r.記錄類型 === '體重控制' &&
          r.體重 &&
          new Date(r.記錄日期) >= monthStart &&
          new Date(r.記錄日期) <= monthEnd
        );
        const lastMonthRecords = (healthRecords || []).filter(r =>
          r.院友id === patient.院友id &&
          r.記錄類型 === '體重控制' &&
          r.體重 &&
          new Date(r.記錄日期) >= lastMonthDate &&
          new Date(r.記錄日期) < monthStart
        );
        if (currentMonthRecords.length === 0 || lastMonthRecords.length === 0) return false;
        const currentWeight = currentMonthRecords[currentMonthRecords.length - 1].體重;
        const lastWeight = lastMonthRecords[lastMonthRecords.length - 1].體重;
        if (!currentWeight || !lastWeight) return false;
        const decrease = ((lastWeight - currentWeight) / lastWeight) * 100;
        return decrease >= 5;
      })();

      const isHospitalized = (hospitalEpisodes || []).some(episode =>
        episode.patient_id === patient.院友id && episode.status === 'active'
      );

      const hasRestraint = (patientRestraintAssessments || []).some(r =>
        r.patient_id === patient.院友id
      );

      const hasPalliativeCare = (patientHealthTasks || []).some(task =>
        task.patient_id === patient.院友id &&
        task.health_record_type === '晚晴計劃'
      );

      return {
        patientId: patient.院友id,
        bedNumber: patient.床號 || '',
        name: `${patient.中文姓氏}${patient.中文名字}`,
        半護理: patient.護理等級 === '半護理' ? 1 : 0,
        全護理: patient.護理等級 === '全護理' ? 1 : 0,
        導尿管: hasCatheter ? 1 : 0,
        遊走: hasWandering ? 1 : 0,
        情緒問題: hasEmotionalIssue ? 1 : 0,
        因情緒問題而轉介: hasEmotionalReferral ? 1 : 0,
        長期卧床: assessment?.daily_activities?.mobility === '卧床' ? 1 : 0,
        長期使用輪椅: assessment?.daily_activities?.mobility === '輪椅' ? 1 : 0,
        一人協助: assessment?.daily_activities?.mobility === '一人協助' ? 1 : 0,
        二人協助: assessment?.daily_activities?.mobility === '二人協助' ? 1 : 0,
        需餵食: (assessment?.daily_activities?.eating === '需要幫助' || assessment?.daily_activities?.eating === '完全依賴') ? 1 : 0,
        鼻胃飼: assessment?.nutrition_diet?.status === '鼻胃管' ? 1 : 0,
        腹膜血液透析: assessment?.treatment_items?.includes('腹膜/血液透析') ? 1 : 0,
        造口: (assessment?.bowel_bladder_control?.bowel === '腸造口' || assessment?.bowel_bladder_control?.bladder === '小便造口') ? 1 : 0,
        氧氣治療: assessment?.treatment_items?.includes('氧氣治療') ? 1 : 0,
        皮下注射: activePrescriptions.some(rx => rx.administration_route === '皮下注射' || rx.administration_route?.includes('皮下')) ? 1 : 0,
        呼吸器: assessment?.treatment_items?.includes('呼吸器') ? 1 : 0,
        善終: hasPalliativeCare ? 1 : 0,
        化療: assessment?.treatment_items?.includes('化療') ? 1 : 0,
        放射治療: assessment?.treatment_items?.includes('放射治療') ? 1 : 0,
        服藥9種或以上: activePrescriptions.length >= 9 ? 1 : 0,
        入住醫院: isHospitalized ? 1 : 0,
        認知障礙: (assessment?.consciousness_cognition?.includes('認知障礙') || assessment?.consciousness_cognition?.includes('失智')) ? 1 : 0,
        錯發藥物: hasMedicationError ? 1 : 0,
        失禁: patient.護理等級 === '全護理' ? 1 : 0,
        如廁訓練: assessment?.toilet_training === true ? 1 : 0,
        壓瘡: hasPressureUlcer ? 1 : 0,
        跌倒: hasFall ? 1 : 0,
        體重下降5: hasWeightDecrease ? 1 : 0,
        哽塞: hasChoking ? 1 : 0,
        脫水: hasDehydration ? 1 : 0,
        轉身: assessment?.daily_activities?.mobility === '卧床' ? 1 : 0,
        傳染病: (patient.感染控制 && patient.感染控制.length > 0) ? 1 : 0,
        尿道炎: 0,
      };
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-4">
            <div className="flex space-x-2">
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
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">所有分區</option>
              {stations?.map(station => (
                <option key={station.id} value={station.id}>{station.name}</option>
              ))}
            </select>
          </div>
        </div>

        <MonthlyReportTable data={tableData} />
      </div>
    );
  };

  const renderInfectionReport = () => {
    const activePatients = filteredPatients.filter(p => p.在住狀態 === '在住');
    const infectionPatients = activePatients.filter(p => p.感染控制 && Array.isArray(p.感染控制) && p.感染控制.length > 0);

    const infectionStats = {
      MRSA: infectionPatients.filter(p => p.感染控制.includes('MRSA')),
      CPE: infectionPatients.filter(p => p.感染控制.includes('CPE')),
      VRE: infectionPatients.filter(p => p.感染控制.includes('VRE')),
      其他: infectionPatients.filter(p =>
        p.感染控制.some((item: string) => !['MRSA', 'CPE', 'VRE'].includes(item))
      ),
    };

    return (
      <div className="space-y-6">
        <div className="flex space-x-4 mb-4">
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="form-input"
          >
            <option value="all">所有分區</option>
            {stations?.map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">感染控制統計</h3>
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              title="MRSA"
              value={infectionStats.MRSA.length}
              bgColor="bg-red-50"
              textColor="text-red-600"
              patientNames={infectionStats.MRSA.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`)}
            />
            <StatCard
              title="CPE"
              value={infectionStats.CPE.length}
              bgColor="bg-orange-50"
              textColor="text-orange-600"
              patientNames={infectionStats.CPE.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`)}
            />
            <StatCard
              title="VRE"
              value={infectionStats.VRE.length}
              bgColor="bg-yellow-50"
              textColor="text-yellow-600"
              patientNames={infectionStats.VRE.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`)}
            />
            <StatCard
              title="其他"
              value={infectionStats.其他.length}
              bgColor="bg-blue-50"
              textColor="text-blue-600"
              patientNames={infectionStats.其他.map(p => `${p.床號} ${p.中文姓氏}${p.中文名字}`)}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">感染控制名單 (共 {infectionPatients.length} 人)</h3>
          <div className="space-y-4">
            {infectionPatients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無感染控制記錄</p>
            ) : (
              infectionPatients.map(patient => (
                <div key={patient.院友id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-lg text-red-800">{patient.床號} {patient.中文姓氏}{patient.中文名字}</h4>
                      <p className="text-sm text-gray-700 mt-1">性別: {patient.性別} | 護理等級: {patient.護理等級 || '未設定'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Array.isArray(patient.感染控制) && patient.感染控制.map((infection: string, idx: number) => (
                          <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            {infection}
                          </span>
                        ))}
                      </div>
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

  const renderMealReport = () => {
    const activePatients = filteredPatients.filter(p => p.在住狀態 === '在住');
    const patientsWithMealGuidance = activePatients.filter(p =>
      (mealGuidances || []).some(mg => mg.patient_id === p.院友id)
    );

    const filteredGuidances = (mealGuidances || []).filter(mg =>
      patientsWithMealGuidance.some(p => p.院友id === mg.patient_id)
    );

    const statistics = {
      總餐膳數: filteredGuidances.length,
      正飯: filteredGuidances.filter(g => g.meal_combination?.includes('正飯')).length,
      軟飯: filteredGuidances.filter(g => g.meal_combination?.includes('軟飯')).length,
      糊飯: filteredGuidances.filter(g => g.meal_combination?.includes('糊飯')).length,
      正餸: filteredGuidances.filter(g => g.meal_combination?.includes('正餸')).length,
      碎餸: filteredGuidances.filter(g => g.meal_combination?.includes('碎餸')).length,
      糊餸: filteredGuidances.filter(g => g.meal_combination?.includes('糊餸')).length,
      糖尿餐: filteredGuidances.filter(g => g.special_diets?.includes('糖尿餐')).length,
      痛風餐: filteredGuidances.filter(g => g.special_diets?.includes('痛風餐')).length,
      低鹽餐: filteredGuidances.filter(g => g.special_diets?.includes('低鹽餐')).length,
      雞蛋總數: filteredGuidances
        .filter(g => g.special_diets?.includes('雞蛋') && g.egg_quantity)
        .reduce((sum, g) => sum + (g.egg_quantity || 0), 0),
      需要凝固粉: filteredGuidances.filter(g => g.needs_thickener).length
    };

    return (
      <div className="space-y-6">
        <div className="flex space-x-4 mb-4">
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="form-input"
          >
            <option value="all">所有分區</option>
            {stations?.map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">廚房準備統計</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3">總數統計</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">餐膳總數</span>
                  <span className="font-bold text-blue-600 text-lg">{statistics.總餐膳數} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">需要凝固粉</span>
                  <span className="font-medium text-blue-600">{statistics.需要凝固粉} 份</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3">主食需求</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">正飯</span>
                  <span className="font-medium text-green-600">{statistics.正飯} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">軟飯</span>
                  <span className="font-medium text-yellow-600">{statistics.軟飯} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">糊飯</span>
                  <span className="font-medium text-orange-600">{statistics.糊飯} 份</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3">配菜需求</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">正餸</span>
                  <span className="font-medium text-green-600">{statistics.正餸} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">碎餸</span>
                  <span className="font-medium text-yellow-600">{statistics.碎餸} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">糊餸</span>
                  <span className="font-medium text-orange-600">{statistics.糊餸} 份</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3">特殊餐膳需求</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">糖尿餐</span>
                  <span className="font-medium text-blue-600">{statistics.糖尿餐} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">痛風餐</span>
                  <span className="font-medium text-purple-600">{statistics.痛風餐} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">低鹽餐</span>
                  <span className="font-medium text-green-600">{statistics.低鹽餐} 份</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">雞蛋</span>
                  <span className="font-medium text-yellow-600">{statistics.雞蛋總數} 隻</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTubeReport = () => {
    const activePatients = filteredPatients.filter(p => p.在住狀態 === '在住');
    const tubeTypes = ['鼻胃飼管更換', '尿導管更換'];

    const tubeTasks = (patientHealthTasks || []).filter(task =>
      tubeTypes.includes(task.health_record_type) &&
      activePatients.some(p => p.院友id === task.patient_id)
    );

    return (
      <div className="space-y-6">
        <div className="flex space-x-4 mb-4">
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="form-input"
          >
            <option value="all">所有分區</option>
            {stations?.map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">喉管相關報表 (共 {tubeTasks.length} 項)</h3>
          <div className="space-y-4">
            {tubeTasks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無喉管相關任務</p>
            ) : (
              tubeTasks.map(task => {
                const patient = activePatients.find(p => p.院友id === task.patient_id);
                if (!patient) return null;
                return (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-lg mb-2">{patient.床號} {patient.中文姓氏}{patient.中文名字}</h4>
                        <p className="text-sm text-gray-600">任務類型: <span className="font-medium">{task.health_record_type}</span></p>
                      </div>
                      <div className="space-y-1 text-sm">
                        {task.last_completed_at && (
                          <p className="text-gray-700">
                            上次完成: <span className="font-medium">{new Date(task.last_completed_at).toLocaleDateString('zh-TW')}</span>
                          </p>
                        )}
                        {task.next_due_at && (
                          <p className="text-blue-600">
                            下次到期: <span className="font-medium">{new Date(task.next_due_at).toLocaleDateString('zh-TW')}</span>
                          </p>
                        )}
                        {task.tube_type && (
                          <p className="text-gray-700">
                            喉管類型: <span className="font-medium">{task.tube_type}</span>
                          </p>
                        )}
                        {task.tube_size && (
                          <p className="text-gray-700">
                            管徑: <span className="font-medium">{task.tube_size}</span>
                          </p>
                        )}
                        {task.notes && (
                          <p className="text-gray-500">
                            備註: {task.notes}
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
    const activePatients = filteredPatients.filter(p => p.在住狀態 === '在住');
    const specialCareTasks = (patientHealthTasks || []).filter(task =>
      task.health_record_type === '生命表徵' &&
      task.notes === '特別關顧' &&
      activePatients.some(p => p.院友id === task.patient_id)
    );

    const specialCarePatientIds = new Set(specialCareTasks.map(t => t.patient_id));
    const specialCarePatients = activePatients.filter(p => specialCarePatientIds.has(p.院友id));

    return (
      <div className="space-y-6">
        <div className="flex space-x-4 mb-4">
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="form-input"
          >
            <option value="all">所有分區</option>
            {stations?.map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
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
                        <h4 className="font-semibold text-lg text-red-800">{patient.床號} {patient.中文姓氏}{patient.中文名字}</h4>
                        <p className="text-sm text-gray-700 mt-1">性別: {patient.性別} | 護理等級: {patient.護理等級 || '未設定'}</p>
                        <div className="mt-3 space-y-2">
                          {tasks.map(task => (
                            <div key={task.id} className="bg-white p-2 rounded border border-red-200">
                              <p className="text-sm">
                                <span className="font-medium text-red-700">監測頻率:</span>{' '}
                                {task.frequency_unit === 'hourly' && `每 ${task.frequency_value} 小時`}
                                {task.frequency_unit === 'daily' && `每日 ${task.frequency_value} 次`}
                                {task.frequency_unit === 'weekly' && `每週 ${task.frequency_value} 次`}
                              </p>
                              {task.specific_times && Array.isArray(task.specific_times) && task.specific_times.length > 0 && (
                                <p className="text-sm text-gray-600">
                                  指定時間: {task.specific_times.join(', ')}
                                </p>
                              )}
                              {task.next_due_at && (
                                <p className="text-sm text-blue-600">
                                  下次: {new Date(task.next_due_at).toLocaleString('zh-TW')}
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
    const activePatients = filteredPatients.filter(p => p.在住狀態 === '在住');
    const drugSensitivityPatients = activePatients.filter(p =>
      (p.藥物敏感 && Array.isArray(p.藥物敏感) && p.藥物敏感.length > 0) ||
      (p.不良藥物反應 && Array.isArray(p.不良藥物反應) && p.不良藥物反應.length > 0)
    );

    return (
      <div className="space-y-6">
        <div className="flex space-x-4 mb-4">
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="form-input"
          >
            <option value="all">所有分區</option>
            {stations?.map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
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
                      <h4 className="font-semibold text-lg text-orange-800">{patient.床號} {patient.中文姓氏}{patient.中文名字}</h4>
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">統計報表</h1>
          </div>
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
      </div>
    </div>
  );
};

export default Reports;
