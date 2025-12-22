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

export const INTAKE_OUTPUT_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00', '23:00', '00:00',
  '01:00', '02:00', '03:00', '04:00', '05:00', '06:00'
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
  // Use local timezone instead of UTC to avoid date shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  // interpret times before 07:00 as belonging to the next calendar day
  const [hStr] = targetTime.split(':');
  const hour = Number(hStr);
  const target = new Date(`${targetDate}T${targetTime}:00`);
  if (!Number.isNaN(hour) && hour < 7) {
    target.setDate(target.getDate() + 1);
  }
  const admitTime = new Date(`${latestAdmission.event_date}T${latestAdmission.event_time || '00:00'}:00`);

  if (discharge) {
    const dischargeTime = new Date(`${discharge.event_date}T${discharge.event_time || '23:59'}:00`);
    return target >= admitTime && target <= dischargeTime;
  }

  return target >= admitTime;
};

// Parse a time slot string to a HH:MM start time, handling formats like '07:00', '7AM-10AM', '11AM-2PM'
export const parseSlotStartTime = (timeSlot: string): string | null => {
  if (!timeSlot) return null;
  // If already HH:MM
  if (/^\d{1,2}:\d{2}$/.test(timeSlot)) {
    const parts = timeSlot.split(':');
    return `${String(Number(parts[0])).padStart(2,'0')}:${String(parts[1]).padStart(2,'0')}`;
  }
  // If contains '-' like '7AM-10AM' or '7AM'
  const dash = timeSlot.split('-')[0].trim();
  // Convert '7AM' or '11PM' to HH:MM
  const match = dash.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let h = Number(match[1]);
  const m = match[2] ? Number(match[2]) : 0;
  const ampm = match[3];
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
  }
  h = h % 24;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const isPastSlot = (dateStr: string, timeSlot: string): boolean => {
  const now = new Date();
  
  // 處理 'daily' 時段：過了當天 23:59:59 就算過去
  if (timeSlot === 'daily') {
    const endOfDay = new Date(`${dateStr}T23:59:59`);
    return endOfDay.getTime() < now.getTime();
  }
  
  const targetTime = parseSlotStartTime(timeSlot);
  if (!targetTime) return false;
  const [hStr] = targetTime.split(':');
  const hour = Number(hStr);
  const target = new Date(`${dateStr}T${targetTime}:00`);
  // If slot time is before 07:00, it belongs to the following calendar day
  if (!Number.isNaN(hour) && hour < 7) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() < now.getTime();
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

export const STATUS_OPTIONS = ['入院', '渡假', '外出'] as const;
export type PatientStatus = typeof STATUS_OPTIONS[number];

export const isStatusNote = (note?: string | null): note is PatientStatus => {
  if (!note) return false;
  return (STATUS_OPTIONS as readonly string[]).includes(note);
};
