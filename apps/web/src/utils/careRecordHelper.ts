import type { Patient, HealthAssessment, PatientHealthTask, PatientRestraintAssessment, PatientAdmissionRecord } from '../lib/database';

export const TIME_SLOTS = [
  '07:00', '09:00', '11:00', '13:00', '15:00', '17:00',
  '19:00', '21:00', '23:00', '01:00', '03:00', '05:00'
];

export const DIAPER_CHANGE_SLOTS = [
  { time: '7AM-10AM', label: '7AM-10AM' },
  { time: '11AM-2PM', label: '11AM-2PM' },
  { time: '3PM-6PM', label: '3PM-6PM' },
  { time: '7PM-10PM', label: '7PM-10PM' },
  { time: '11PM-2AM', label: '11PM-2AM' },
  { time: '3AM-6AM', label: '3AM-6AM' }
];

export const generateWeekDates = (startDate: Date): Date[] => {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
};

export const getWeekStartDate = (referenceDate: Date = new Date()): Date => {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const addRandomOffset = (baseTime: string): string => {
  const [hours, minutes] = baseTime.split(':').map(Number);
  const randomOffset = Math.floor(Math.random() * 5) - 2;
  const totalMinutes = hours * 60 + minutes + randomOffset;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
};

export const filterPatientsByNursingLevel = (
  patients: Patient[],
  level: '全護理' | '半護理' | '自理'
): Patient[] => {
  return patients.filter(p => p.護理等級 === level && p.在住狀態 === '在住');
};

export const filterPatientsWithRestraints = (
  patients: Patient[],
  restraintAssessments: PatientRestraintAssessment[]
): Patient[] => {
  const latestAssessments = new Map<number, PatientRestraintAssessment>();

  const sortedAssessments = [...restraintAssessments].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  sortedAssessments.forEach(assessment => {
    if (!latestAssessments.has(assessment.patient_id)) {
      latestAssessments.set(assessment.patient_id, assessment);
    }
  });

  const patientIdsWithRestraints = new Set<number>();
  latestAssessments.forEach((assessment) => {
    patientIdsWithRestraints.add(assessment.patient_id);
  });

  return patients.filter(p =>
    patientIdsWithRestraints.has(p.院友id) && p.在住狀態 === '在住'
  );
};

export const filterBedriddenPatients = (
  patients: Patient[],
  healthAssessments: HealthAssessment[]
): Patient[] => {
  const latestAssessments = new Map<number, HealthAssessment>();

  const sortedAssessments = [...healthAssessments].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  sortedAssessments.forEach(assessment => {
    if (!latestAssessments.has(assessment.patient_id)) {
      latestAssessments.set(assessment.patient_id, assessment);
    }
  });

  const bedriddenPatientIds = new Set<number>();
  latestAssessments.forEach((assessment) => {
    if (assessment.daily_activities?.最高活動能力 === '臥床') {
      bedriddenPatientIds.add(assessment.patient_id);
    }
  });

  return patients.filter(p =>
    bedriddenPatientIds.has(p.院友id) && p.在住狀態 === '在住'
  );
};

export const filterPatientsWithTubes = (
  patients: Patient[],
  healthTasks: PatientHealthTask[],
  healthAssessments: HealthAssessment[]
): Patient[] => {
  const patientIdsWithTubes = new Set<number>();

  healthTasks.forEach(task => {
    if (task.health_record_type === '鼻胃飼管更換' || task.health_record_type === '尿導管更換') {
      patientIdsWithTubes.add(task.patient_id);
    }
  });

  const latestAssessments = new Map<number, HealthAssessment>();
  const sortedAssessments = [...healthAssessments].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  sortedAssessments.forEach(assessment => {
    if (!latestAssessments.has(assessment.patient_id)) {
      latestAssessments.set(assessment.patient_id, assessment);
    }
  });

  latestAssessments.forEach((assessment) => {
    const treatmentItems = assessment.treatment_items || [];
    if (treatmentItems.includes('導尿管') || treatmentItems.includes('鼻胃喉')) {
      patientIdsWithTubes.add(assessment.patient_id);
    }
  });

  return patients.filter(p =>
    patientIdsWithTubes.has(p.院友id) && p.在住狀態 === '在住'
  );
};

export const filterPatientsWithToiletTraining = (
  patients: Patient[],
  healthAssessments: HealthAssessment[]
): Patient[] => {
  const latestAssessments = new Map<number, HealthAssessment>();

  const sortedAssessments = [...healthAssessments].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  sortedAssessments.forEach(assessment => {
    if (!latestAssessments.has(assessment.patient_id)) {
      latestAssessments.set(assessment.patient_id, assessment);
    }
  });

  const patientIdsWithTraining = new Set<number>();
  latestAssessments.forEach((assessment) => {
    if (assessment.toilet_training === true) {
      patientIdsWithTraining.add(assessment.patient_id);
    }
  });

  return patients.filter(p =>
    patientIdsWithTraining.has(p.院友id) && p.在住狀態 === '在住'
  );
};

export const getPositionSequence = (scheduledTime: string): '左' | '平' | '右' => {
  const positions: ('左' | '平' | '右')[] = ['左', '平', '右'];
  const timeIndex = TIME_SLOTS.indexOf(scheduledTime);
  if (timeIndex === -1) return '左';
  return positions[timeIndex % 3];
};

export const isOverdue = (dateString: string, timeString: string): boolean => {
  const scheduledDateTime = new Date(`${dateString}T${timeString}:00`);
  const currentDateTime = new Date();
  return scheduledDateTime < currentDateTime;
};

export const isInHospital = (
  patient: Patient,
  targetDate: string,
  targetTime: string,
  admissionRecords: PatientAdmissionRecord[],
  hospitalEpisodes: any[] = []
): boolean => {
  console.log('[isInHospital] 開始檢查:', {
    patientId: patient.院友id,
    patientName: patient.中文姓名,
    targetDate,
    targetTime,
    admissionRecordsCount: admissionRecords.length,
    hospitalEpisodesCount: hospitalEpisodes.length
  });

  // 1. 先檢查 hospital_episodes 表（新的住院事件記錄）
  const patientEpisodes = hospitalEpisodes.filter(ep => ep.patient_id === patient.院友id);
  console.log('[isInHospital] 該院友的住院事件:', patientEpisodes);

  const target = new Date(`${targetDate}T${targetTime}:00`);

  for (const episode of patientEpisodes) {
    if (episode.episode_start_date) {
      const startDate = new Date(`${episode.episode_start_date}T00:00:00`);

      // 如果有結束日期，檢查是否在期間內
      if (episode.episode_end_date) {
        const endDate = new Date(`${episode.episode_end_date}T23:59:59`);
        if (target >= startDate && target <= endDate) {
          console.log('[isInHospital] ✅ 在住院事件期間內（已出院）:', {
            episodeId: episode.id,
            startDate: episode.episode_start_date,
            endDate: episode.episode_end_date,
            hospital: episode.primary_hospital
          });
          return true;
        }
      } else {
        // 沒有結束日期（仍在住院中），只檢查是否在開始日期之後
        if (target >= startDate) {
          console.log('[isInHospital] ✅ 在住院期間（尚未出院）:', {
            episodeId: episode.id,
            startDate: episode.episode_start_date,
            endDate: '尚未出院',
            hospital: episode.primary_hospital,
            status: episode.status
          });
          return true;
        }
      }
    }
  }

  console.log('[isInHospital] ❌ 不在任何住院事件期間內');

  // 2. 檢查 patient_admission_records 表（舊的入院/出院記錄）
  const patientAdmissions = admissionRecords.filter(r => r.patient_id === patient.院友id);
  console.log('[isInHospital] 該院友的入院記錄:', patientAdmissions);

  const admissions = patientAdmissions
    .filter(r => r.event_type === 'hospital_admission')
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  console.log('[isInHospital] 入院事件記錄:', admissions);

  if (admissions.length === 0) {
    console.log('[isInHospital] 沒有入院記錄，返回 false');
    return false;
  }

  const latestAdmission = admissions[0];
  console.log('[isInHospital] 最近的入院記錄:', latestAdmission);

  const discharge = patientAdmissions.find(r =>
    r.event_type === 'hospital_discharge' &&
    new Date(r.event_date) > new Date(latestAdmission.event_date)
  );
  console.log('[isInHospital] 對應的出院記錄:', discharge);

  const admitTime = new Date(`${latestAdmission.event_date}T${latestAdmission.event_time || '00:00'}:00`);

  console.log('[isInHospital] 時間比較:', {
    targetTime: target.toISOString(),
    admitTime: admitTime.toISOString(),
    dischargeTime: discharge ? new Date(`${discharge.event_date}T${discharge.event_time || '23:59'}:00`).toISOString() : 'N/A'
  });

  if (discharge) {
    const dischargeTime = new Date(`${discharge.event_date}T${discharge.event_time || '23:59'}:00`);
    const result = target >= admitTime && target <= dischargeTime;
    console.log('[isInHospital] 有出院記錄，檢查是否在入院期間內:', result);
    return result;
  }

  const result = target >= admitTime;
  console.log('[isInHospital] 無出院記錄，檢查是否在入院時間之後:', result);
  return result;
};

export const formatObservationStatus = (status: 'N' | 'P' | 'S'): string => {
  switch (status) {
    case 'N':
      return '正常';
    case 'P':
      return '異常';
    case 'S':
      return '暫停';
    default:
      return '';
  }
};

export const formatPosition = (position: '左' | '平' | '右'): string => {
  return position;
};
