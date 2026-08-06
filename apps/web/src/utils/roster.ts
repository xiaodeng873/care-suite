import type {
  UserProfile,
  UserEmploymentDetails,
  UserShiftAssignment,
  UserAbsenceRecord,
  UserLeaveRecord,
  PublicHoliday,
  StationShiftSetting,
  ShiftName,
  EmploymentPosition,
} from '@care-suite/shared';
import { getEmploymentPosition, SHIFT_NAMES } from '@care-suite/shared';
import { getRosterExpectedCounts, getRosterUsedCounts } from './leaveValidation';
import type { SpecificHoursConfig, TimeSegment } from './facilityNatureSettings';
import { timeToMinutes } from './staffingRequirements';

export interface WeekDay {
  date: string;
  dayOfMonth: number;
  weekday: string;
  weekdayIndex: number;
}

/** 取得以星期日為起始的 7 天區間 */
export function getWeekRange(anchorDate: Date): { start: Date; end: Date } {
  const day = anchorDate.getDay(); // 0 = Sunday
  const start = new Date(anchorDate);
  start.setDate(anchorDate.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function getWeekDays(anchorDate: Date): WeekDay[] {
  const { start } = getWeekRange(anchorDate);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      date: formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      dayOfMonth: d.getDate(),
      weekday: weekdays[d.getDay()],
      weekdayIndex: d.getDay(),
    };
  });
}

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':');
  return { hours: parseInt(h || '0', 10), minutes: parseInt(m || '0', 10) };
}

export function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function addHoursToTime(timeStr: string, hoursToAdd: number): string {
  const { hours, minutes } = parseTime(timeStr);
  const totalMinutes = hours * 60 + minutes + Math.round(hoursToAdd * 60);
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return formatTime(Math.floor(normalized / 60), normalized % 60);
}

export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function getApplicablePosition(
  user: UserProfile,
  position: EmploymentPosition,
): boolean {
  const primary = getEmploymentPosition(user);
  if (primary === position) return true;
  return (user.secondary_positions || []).includes(position);
}

export function getUserDisplayPosition(user: UserProfile): string {
  const primary = getEmploymentPosition(user);
  if (primary) return primary;
  return user.other_position || user.department || '未設定';
}

export function getUserAllPositions(user: UserProfile): string[] {
  const primary = getEmploymentPosition(user);
  const secondary = user.secondary_positions || [];
  if (!primary) return secondary;
  return [primary, ...secondary.filter((p) => p !== primary)];
}

export function getDailyContractHours(
  details: UserEmploymentDetails | null | undefined,
): number | null {
  return details?.daily_contract_hours ?? null;
}

export interface RosterUserBalance {
  doBalance: number;
  prdBalance: number;
  alBalance: number;
  phBalance: number;
  shBalance: number;
}

export function getRosterUserBalance(
  userId: string,
  employmentMap: Record<string, UserEmploymentDetails>,
  leaveRecords: UserLeaveRecord[],
  publicHolidays: PublicHoliday[],
  year: number,
  month: number,
): RosterUserBalance {
  const details = employmentMap[userId];
  const userLeaves = leaveRecords.filter((l) => l.user_id === userId);
  const expected = getRosterExpectedCounts(
    details?.weekly_work_days ?? null,
    details?.rest_day_fraction ?? 0,
    publicHolidays,
    year,
    month,
    details?.rest_day_start_date,
  );
  const used = getRosterUsedCounts(userLeaves, year, month);

  return {
    doBalance: expected.doExpected - used.doUsed,
    prdBalance: expected.prdExpected - used.prdUsed,
    alBalance: (details?.annual_leave_days_per_year ?? 0) - used.alUsed,
    phBalance: expected.phExpected - used.phUsed,
    shBalance: expected.shExpected - used.shUsed,
  };
}

export function buildShiftAssignmentMap(
  assignments: UserShiftAssignment[],
): {
  byKey: Map<string, UserShiftAssignment[]>;
  byUserDate: Map<string, UserShiftAssignment>;
} {
  const byKey = new Map<string, UserShiftAssignment[]>();
  const byUserDate = new Map<string, UserShiftAssignment>();

  for (const a of assignments) {
    const key = `${a.station_id ?? 'unassigned'}|${a.shift_name}|${a.work_date}`;
    const list = byKey.get(key) || [];
    list.push(a);
    byKey.set(key, list);

    byUserDate.set(`${a.user_id}|${a.work_date}`, a);
  }

  return { byKey, byUserDate };
}

export function buildAbsenceMap(
  records: UserAbsenceRecord[],
): Map<string, UserAbsenceRecord> {
  const map = new Map<string, UserAbsenceRecord>();
  for (const r of records) {
    map.set(`${r.user_id}|${r.absence_date}`, r);
  }
  return map;
}

export function getActiveShiftSettings(
  settings: StationShiftSetting[],
  stationId: string | null,
): StationShiftSetting[] {
  return settings
    .filter((s) => s.station_id === stationId && s.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

const APPLICABLE_POSITIONS: EmploymentPosition[] = [
  '主管',
  '註冊護士',
  '登記護士',
  '保健員',
  '護理員',
  '助理員',
  '物理治療師',
];

export function getPositionOptions(users: UserProfile[]): EmploymentPosition[] {
  const set = new Set<EmploymentPosition>();
  for (const user of users) {
    const primary = getEmploymentPosition(user);
    if (primary) set.add(primary);
    for (const pos of user.secondary_positions || []) {
      if (APPLICABLE_POSITIONS.includes(pos as EmploymentPosition)) {
        set.add(pos as EmploymentPosition);
      }
    }
  }
  return Array.from(set).sort();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 取得班次結束時間 = 起始時間 + 該員工 daily_contract_hours（未設定則用預設 8 小時） */
export function getShiftEndTime(
  startTime: string,
  dailyContractHours: number | null,
): string {
  const hours = dailyContractHours ?? 8;
  return addHoursToTime(startTime, hours);
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime}-${endTime}`;
}

// =====================================================
// 每日人手達標檢查
// =====================================================

export interface DailyShiftSummary {
  /** 該日該職位已排班人數 */
  headcount: number;
  /** 該日該職位已排班總工時 */
  hours: number;
}

export function toGridPosition(position: string | null | undefined): string {
  if (!position) return '其他';
  if (position === '註冊護士' || position === '登記護士') return '註冊/登記護士';
  return position;
}

export function summarizeDailyShiftByPosition(
  date: string,
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  assignments: UserShiftAssignment[],
): Record<string, DailyShiftSummary> {
  const summary: Record<string, DailyShiftSummary> = {};

  for (const a of assignments.filter((x) => x.work_date === date)) {
    const user = users.find((u) => u.id === a.user_id);
    if (!user) continue;
    const position = toGridPosition(getEmploymentPosition(user));
    const hours = getDailyContractHours(employmentDetails[a.user_id]) ?? 8;
    const entry = summary[position] || { headcount: 0, hours: 0 };

    // 同一員工同一天只會有一班，所以 headcount 直接加 1
    entry.headcount += 1;
    entry.hours += hours;
    summary[position] = entry;
  }

  return summary;
}

export interface SpecificSlotSegment {
  label: string;
  required: number;
  actual: number;
}

export interface SpecificSlotCompliance {
  requiredMinHeadcount: number;
  actualMinHeadcount: number;
  ok: boolean;
  segments: SpecificSlotSegment[];
}

export interface ComplianceRow {
  position: string;
  requiredHours: number;
  actualHours: number;
  hoursOk: boolean;
  requiredSpecificHeadcount: number;
  actualSpecificHeadcount: number;
  specificSlotOk: boolean;
  hasSpecificSlotRequirement: boolean;
  specificSegments: SpecificSlotSegment[];
}

export function buildDailyCompliance(
  date: string,
  requiredHours: Record<string, number>,
  requiredHourly: Record<string, number[]>,
  specific: SpecificHoursConfig,
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  assignments: UserShiftAssignment[],
): ComplianceRow[] {
  const actual = summarizeDailyShiftByPosition(date, users, employmentDetails, assignments);
  const specificSlot = buildSpecificSlotCompliance(date, requiredHourly, specific, users, employmentDetails, assignments);
  const positions = new Set([
    ...Object.keys(requiredHours),
    ...Object.keys(actual),
    ...Object.keys(requiredHourly),
  ]);

  return Array.from(positions).map((position) => ({
    position,
    requiredHours: requiredHours[position] ?? 0,
    actualHours: actual[position]?.hours ?? 0,
    hoursOk: (actual[position]?.hours ?? 0) >= (requiredHours[position] ?? 0),
    requiredSpecificHeadcount: specificSlot[position]?.requiredMinHeadcount ?? 0,
    actualSpecificHeadcount: specificSlot[position]?.actualMinHeadcount ?? 0,
    specificSlotOk: specificSlot[position]?.ok ?? true,
    hasSpecificSlotRequirement: (specificSlot[position]?.requiredMinHeadcount ?? 0) > 0,
    specificSegments: specificSlot[position]?.segments ?? [],
  }));
}

// =====================================================
// 特定鐘點達標檢查
// =====================================================

function getComplementSegments(segments: TimeSegment[]): TimeSegment[] {
  if (segments.length === 0) return [{ start: '00:00', end: '00:00' }];
  const sorted = [...segments].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const merged: TimeSegment[] = [];
  for (const seg of sorted) {
    if (merged.length === 0) {
      merged.push({ ...seg });
      continue;
    }
    const last = merged[merged.length - 1];
    const lastEnd = timeToMinutes(last.end);
    const segStart = timeToMinutes(seg.start);
    const segEnd = timeToMinutes(seg.end);
    if (segStart <= lastEnd) {
      const newEnd = Math.max(lastEnd, segEnd);
      last.end = formatTime(Math.floor(newEnd / 60), newEnd % 60);
    } else {
      merged.push({ ...seg });
    }
  }

  const firstStart = timeToMinutes(merged[0].start);
  const lastEnd = timeToMinutes(merged[merged.length - 1].end);
  const complement: TimeSegment[] = [];

  for (let i = 0; i < merged.length - 1; i++) {
    const end = timeToMinutes(merged[i].end);
    const start = timeToMinutes(merged[i + 1].start);
    if (start > end) {
      complement.push({
        start: formatTime(Math.floor(end / 60), end % 60),
        end: formatTime(Math.floor(start / 60), start % 60),
      });
    }
  }

  if (firstStart > 0 && lastEnd < 1440) {
    complement.push({
      start: formatTime(Math.floor(lastEnd / 60), lastEnd % 60),
      end: formatTime(Math.floor(firstStart / 60), firstStart % 60),
    });
  } else {
    if (firstStart > 0) {
      complement.push({
        start: '00:00',
        end: formatTime(Math.floor(firstStart / 60), firstStart % 60),
      });
    }
    if (lastEnd < 1440) {
      complement.push({
        start: formatTime(Math.floor(lastEnd / 60), lastEnd % 60),
        end: '00:00',
      });
    }
  }

  complement.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  return complement;
}

function getSpecificWindowsForPosition(
  position: string,
  specific: SpecificHoursConfig,
): TimeSegment[] {
  if (position === '註冊/登記護士' || position === '保健員') {
    return [specific.requirement3];
  }
  if (position === '護理員') {
    return [...specific.requirement1.segments, ...getComplementSegments(specific.requirement1.segments)];
  }
  if (position === '助理員') {
    return [specific.assistantWindow];
  }
  return [];
}

function getAssignmentMinutes(startTime: string, dailyHours: number): { start: number; end: number } {
  const start = timeToMinutes(startTime);
  const end = (start + Math.round(dailyHours * 60)) % 1440;
  return { start, end };
}

function assignmentCoversHour(
  startMinutes: number,
  endMinutes: number,
  hour: number,
): boolean {
  const slotStart = hour * 60;
  const slotEnd = slotStart + 60;
  if (endMinutes > startMinutes) {
    return slotStart < endMinutes && slotEnd > startMinutes;
  }
  if (endMinutes < startMinutes) {
    return slotStart < endMinutes || slotEnd > startMinutes;
  }
  return true;
}

function formatWindowLabel(seg: TimeSegment): string {
  return `${seg.start}-${seg.end}`;
}

export function buildSpecificSlotCompliance(
  date: string,
  requiredHourly: Record<string, number[]>,
  specific: SpecificHoursConfig,
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  assignments: UserShiftAssignment[],
): Record<string, SpecificSlotCompliance> {
  // 建立實際每小時在班人數（按表格欄位歸類，RN/EN 合併）
  const actualHourly: Record<string, number[]> = {};
  for (const position of Object.keys(requiredHourly)) {
    actualHourly[position] = new Array(24).fill(0);
  }
  for (const user of users) {
    const pos = toGridPosition(getEmploymentPosition(user));
    if (!actualHourly[pos]) actualHourly[pos] = new Array(24).fill(0);
  }

  for (const a of assignments.filter((x) => x.work_date === date)) {
    const user = users.find((u) => u.id === a.user_id);
    if (!user) continue;
    const pos = toGridPosition(getEmploymentPosition(user));
    if (!actualHourly[pos]) continue;
    const dailyHours = getDailyContractHours(employmentDetails[a.user_id]) ?? 8;
    const { start, end } = getAssignmentMinutes(a.start_time, dailyHours);
    for (let h = 0; h < 24; h++) {
      if (assignmentCoversHour(start, end, h)) {
        actualHourly[pos][h]++;
      }
    }
  }

  const result: Record<string, SpecificSlotCompliance> = {};
  for (const position of Object.keys(requiredHourly)) {
    const windows = getSpecificWindowsForPosition(position, specific);
    if (windows.length === 0) continue;
    const req = requiredHourly[position];
    let requiredMin = Infinity;
    let actualMin = Infinity;
    const segments: SpecificSlotSegment[] = [];
    for (const window of windows) {
      const s = timeToMinutes(window.start);
      const e = timeToMinutes(window.end);
      const startH = Math.floor(s / 60);
      const endH = e > s ? Math.floor(e / 60) : 24 + Math.floor(e / 60);
      let segReqMin = Infinity;
      let segActMin = Infinity;
      for (let hi = startH; hi < endH; hi++) {
        const hour = ((hi % 24) + 24) % 24;
        segReqMin = Math.min(segReqMin, req[hour] ?? 0);
        segActMin = Math.min(segActMin, actualHourly[position]?.[hour] ?? 0);
      }
      if (segReqMin === Infinity) segReqMin = 0;
      if (segActMin === Infinity) segActMin = 0;
      segments.push({ label: formatWindowLabel(window), required: segReqMin, actual: segActMin });
      requiredMin = Math.min(requiredMin, segReqMin);
      actualMin = Math.min(actualMin, segActMin);
    }
    if (requiredMin === Infinity) requiredMin = 0;
    if (actualMin === Infinity) actualMin = 0;
    result[position] = {
      requiredMinHeadcount: requiredMin,
      actualMinHeadcount: actualMin,
      ok: actualMin >= requiredMin,
      segments,
    };
  }
  return result;
}
