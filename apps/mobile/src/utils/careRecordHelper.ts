import type { Patient, PatientAdmissionRecord } from '../lib/database';

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

export const getPositionSequence = (scheduledTime: string): '左' | '平' | '右' => {
  const positions: ('左' | '平' | '右')[] = ['左', '平', '右'];
  const timeIndex = TIME_SLOTS.indexOf(scheduledTime);
  if (timeIndex === -1) return '左';
  return positions[timeIndex % 3];
};

export const isInHospital = (
  patient: Patient,
  targetDate: string,
  targetTime: string,
  admissionRecords: PatientAdmissionRecord[]
): boolean => {
  const patientAdmissions = admissionRecords.filter(r => r.patient_id === patient.院友id);

  const admissions = patientAdmissions
    .filter(r => r.event_type === 'hospital_admission')
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  if (admissions.length === 0) return false;

  const latestAdmission = admissions[0];

  const discharge = patientAdmissions.find(r =>
    r.event_type === 'hospital_discharge' &&
    new Date(r.event_date) > new Date(latestAdmission.event_date)
  );

  const target = new Date(`${targetDate}T${targetTime}:00`);
  const admitTime = new Date(`${latestAdmission.event_date}T${latestAdmission.event_time || '00:00'}:00`);

  if (discharge) {
    const dischargeTime = new Date(`${discharge.event_date}T${discharge.event_time || '23:59'}:00`);
    return target >= admitTime && target <= dischargeTime;
  }

  return target >= admitTime;
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
