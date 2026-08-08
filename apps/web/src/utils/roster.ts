import type {
  UserProfile,
  UserEmploymentDetails,
  UserShiftAssignment,
  UserAbsenceRecord,
  UserLeaveRecord,
  PublicHoliday,
  StationShiftSetting,
  EmploymentPosition,
} from '@care-suite/shared';
import { getEmploymentPosition } from '@care-suite/shared';
import { getRosterExpectedCounts, getRosterUsedCounts } from './leaveValidation';
import type { SpecificHoursConfig, TimeSegment } from './facilityNatureSettings';
import { timeToMinutes } from './staffingRequirements';
import { getAssignmentShiftDay, getShiftDayStart, addDays } from './shiftDay';

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

/** 把班次時間轉為簡寫，如 07:00-18:00 -> 7A-6P，13:00-22:00 -> 1P-10P，21:00-07:00 -> 9P-7A */
export function formatShiftTimeAbbreviation(startTime: string, endTime: string): string {
  const format = (time: string): string => {
    const { hours } = parseTime(time);
    if (hours === 0) return '12A';
    if (hours === 12) return '12P';
    if (hours < 12) return `${hours}A`;
    return `${hours - 12}P`;
  };
  return `${format(startTime)}-${format(endTime)}`;
}

export function normalizeTime(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.slice(0, 5);
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

/** 拖入排班表時的優先開始時間：員工預設上班時間 > 班次開始時間 */
export function getDragStartTime(
  details: UserEmploymentDetails | null | undefined,
  shiftStartTime: string,
): string {
  return normalizeTime(details?.default_work_start_time) ?? shiftStartTime.slice(0, 5);
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
  position?: string | null,
): StationShiftSetting[] {
  const matches = settings.filter((s) => s.station_id === stationId && s.is_active);
  // 若有指定職位，先嘗試讀取該職位設定；沒有則回退通用（position IS NULL）設定
  if (position) {
    const positionSpecific = matches.filter((s) => s.position === position);
    if (positionSpecific.length > 0) {
      return positionSpecific.sort((a, b) => a.sort_order - b.sort_order);
    }
  }
  return matches
    .filter((s) => !s.position)
    .sort((a, b) => a.sort_order - b.sort_order);
}

const APPLICABLE_POSITIONS: EmploymentPosition[] = [
  '主管',
  '文員',
  '會計',
  '註冊護士',
  '登記護士',
  '保健員',
  '護理員',
  '物理治療師',
  '物理治療師助理',
  '職業治療師',
  '職業治療師助理',
  '言語治療師',
  '言語治療師助理',
  '社工',
  '社工助理',
  '廚師',
  '清潔員',
];

/** 特定鐘點計算時視為「助理員」的職位（行政、庶務全部非護理崗位） */
const ASSISTANT_SLOT_POSITIONS = new Set<string>(['文員', '會計', '社工', '社工助理', '廚師', '清潔員']);

export function isAssistantSlotContributor(user: UserProfile): boolean {
  const primary = getEmploymentPosition(user);
  return primary ? ASSISTANT_SLOT_POSITIONS.has(primary) : false;
}

export function getPositionOptions(users: UserProfile[]): EmploymentPosition[] {
  const set = new Set<EmploymentPosition>([
    '註冊護士',
    '登記護士',
    '保健員',
    '護理員',
  ]);
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

const GRID_POSITION_ORDER = ['主管', '註冊/登記護士', '保健員', '護理員', '物理治療師'];

/** 回傳用於職位過濾的 grid position 選項（註冊/登記護士合併為一項；助理員不再是真實職位） */
export function getGridPositionOptions(users: UserProfile[]): string[] {
  const set = new Set<string>(['註冊/登記護士', '保健員', '護理員']);
  for (const user of users) {
    const primary = getEmploymentPosition(user);
    if (primary) set.add(toGridPosition(primary));
    for (const pos of user.secondary_positions || []) {
      set.add(toGridPosition(pos));
    }
  }
  return GRID_POSITION_ORDER.filter((p) => set.has(p));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const ROSTER_GROUP_ORDER = [
  '註冊/登記護士',
  '保健員',
  '護理員',
  '行政',
  '物理治療師',
  '物理治療師助理',
  '職業治療師',
  '職業治療師助理',
  '言語治療師',
  '言語治療師助理',
  '庶務',
];

const SINGLE_SHIFT_GROUPS = new Set<string>([
  '行政',
  '物理治療師',
  '物理治療師助理',
  '職業治療師',
  '職業治療師助理',
  '言語治療師',
  '言語治療師助理',
  '庶務',
]);

/** 判斷該排班分頁是否預設單班制（行政、專職、庶務等非護理部門） */
export function isSingleShiftGroup(position: string): boolean {
  return SINGLE_SHIFT_GROUPS.has(position);
}

const ADMIN_POSITIONS_SET = new Set<string>(['主管', '文員', '會計', '社工', '社工助理']);
const GENERAL_AFFAIRS_POSITIONS_SET = new Set<string>(['廚師', '清潔員']);

/** 回傳排班表頂部職位分頁選項；行政部門合併為「行政」（含社工），庶務部門合併為「庶務」，註冊/登記護士合併為一項，專職崗位各自獨立 */
export function getRosterGroupOptions(users: UserProfile[]): string[] {
  const set = new Set<string>();
  for (const user of users) {
    const primary = getEmploymentPosition(user);
    if (primary) {
      if (ADMIN_POSITIONS_SET.has(primary)) {
        set.add('行政');
      } else if (GENERAL_AFFAIRS_POSITIONS_SET.has(primary)) {
        set.add('庶務');
      } else if (primary === '註冊護士' || primary === '登記護士') {
        set.add('註冊/登記護士');
      } else {
        set.add(primary);
      }
    }
    for (const pos of user.secondary_positions || []) {
      if (ADMIN_POSITIONS_SET.has(pos)) {
        set.add('行政');
      } else if (GENERAL_AFFAIRS_POSITIONS_SET.has(pos)) {
        set.add('庶務');
      } else if (pos === '註冊護士' || pos === '登記護士') {
        set.add('註冊/登記護士');
      } else if (APPLICABLE_POSITIONS.includes(pos as EmploymentPosition)) {
        set.add(pos);
      }
    }
  }
  return ROSTER_GROUP_ORDER.filter((p) => set.has(p));
}

/** 取得班次結束時間 = 起始時間 + 該員工 daily_contract_hours（未設定則用預設 8 小時） */
export function getShiftEndTime(
  startTime: string,
  dailyContractHours: number | null,
): string {
  const hours = dailyContractHours ?? 8;
  return addHoursToTime(startTime, hours);
}

export function getAssignmentEndTime(
  assignment: UserShiftAssignment,
  dailyContractHours: number | null,
): string {
  if (assignment.end_time) return assignment.end_time;
  return getShiftEndTime(assignment.start_time, dailyContractHours);
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

/** 取得員工在特定鐘點達標檢查中所屬的職位；
 * 行政、社工、衛生、膳食全部非護理崗位共同計入「助理員」特定鐘點 */
function getSpecificSlotPosition(user: UserProfile): string {
  const primary = getEmploymentPosition(user);
  if (primary && ASSISTANT_SLOT_POSITIONS.has(primary)) return '助理員';
  return toGridPosition(primary);
}

function getAssignmentGridPosition(a: UserShiftAssignment, user: UserProfile): string {
  if (a.position) return a.position;
  return toGridPosition(getEmploymentPosition(user));
}

export function summarizeDailyShiftByPosition(
  date: string,
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  assignments: UserShiftAssignment[],
): Record<string, DailyShiftSummary> {
  const summary: Record<string, DailyShiftSummary> = {};

  for (const a of assignments) {
    // 排班日以每天早上 07:00 為起點
    if (getAssignmentShiftDay(a.work_date, a.start_time) !== date) continue;
    const user = users.find((u) => u.id === a.user_id);
    if (!user) continue;
    // 人手（headcount）按班次所屬職位；工時按員工自身職位
    // 例如：護士替補保健員班次時，算入保健員人手，但工時歸入護士
    const headcountPosition = getAssignmentGridPosition(a, user);
    const hoursPosition = toGridPosition(getEmploymentPosition(user));
    const hours = getDailyContractHours(employmentDetails[a.user_id]) ?? 8;

    const headcountEntry = summary[headcountPosition] || { headcount: 0, hours: 0 };
    headcountEntry.headcount += 1;
    summary[headcountPosition] = headcountEntry;

    if (hoursPosition) {
      const hoursEntry = summary[hoursPosition] || { headcount: 0, hours: 0 };
      hoursEntry.hours += hours;
      summary[hoursPosition] = hoursEntry;
    }
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

export interface PreScheduleSegmentConflict {
  date: string;
  position: string;
  windowLabel: string;
  windowTime: string;
  gapTime: string;
  required: number;
  actualPeople: number;
  equivalent: number;
}

export function canFillPositionInPreSchedule(
  user: UserProfile,
  position: string,
): boolean {
  const primary = getEmploymentPosition(user);
  if (primary === position) return true;
  if (toGridPosition(primary) === position) return true;
  if ((user.secondary_positions || []).some((p) => p === position || toGridPosition(p) === position)) return true;
  if (
    position === '保健員' &&
    (primary === '註冊護士' ||
      primary === '登記護士' ||
      (user.secondary_positions || []).some((p) => p === '註冊護士' || p === '登記護士'))
  ) {
    return true;
  }
  if (position === '助理員') {
    return isAssistantSlotContributor(user);
  }
  return false;
}

export function getDayRecordsMap(
  leaveRecords: UserLeaveRecord[],
): Map<string, Map<string, UserLeaveRecord>> {
  const map = new Map<string, Map<string, UserLeaveRecord>>();
  for (const r of leaveRecords) {
    if (!map.has(r.leave_date)) map.set(r.leave_date, new Map());
    map.get(r.leave_date)!.set(r.user_id, r);
  }
  return map;
}

function hourInSegment(hour: number, seg: TimeSegment): boolean {
  const slotStart = hour * 60;
  const s = timeToMinutes(seg.start);
  const e = timeToMinutes(seg.end);
  if (s <= e) return slotStart >= s && slotStart < e;
  return slotStart >= s || slotStart < e;
}

export function getPreScheduleAvailableByShiftHour(
  date: string,
  position: string,
  users: UserProfile[],
  leaveRecords: UserLeaveRecord[],
): { available: number[]; equivalent: number[] } {
  const available = new Array(24).fill(0);
  const nurseCount = new Array(24).fill(0);
  const nurseEquivalent = new Array(24).fill(0);
  const dayRecords = getDayRecordsMap(leaveRecords);

  for (const u of users) {
    const matchesPosition =
      position === '助理員'
        ? isAssistantSlotContributor(u)
        : canFillPositionInPreSchedule(u, position);
    if (!matchesPosition) continue;
    const primary = getEmploymentPosition(u);
    const isNurse = primary === '註冊護士' || primary === '登記護士';
    for (let h = 0; h < 24; h++) {
      const recordDate = h < 17 ? date : addDays(date, 1);
      const record = dayRecords.get(recordDate)?.get(u.id);
      if (!record) {
        available[h]++;
        if (isNurse) {
          nurseCount[h]++;
          nurseEquivalent[h] += 2;
        }
      } else if (
        record.record_type === 'availability' &&
        record.availability_start_time &&
        record.availability_end_time
      ) {
        const calendarHour = (h + 7) % 24;
        if (
          hourInSegment(calendarHour, {
            start: record.availability_start_time,
            end: record.availability_end_time,
          })
        ) {
          available[h]++;
          if (isNurse) {
            nurseCount[h]++;
            nurseEquivalent[h] += 2;
          }
        }
      }
    }
  }

  if (position === '保健員') {
    const equivalent = available.map((hw, h) => hw - nurseCount[h] + nurseEquivalent[h]);
    return { available, equivalent };
  }
  return { available, equivalent: available };
}

export function getSpecificWindowsForPosition(
  position: string,
  specific: SpecificHoursConfig,
): { label: string; segment: TimeSegment }[] {
  if (position === '護理員') {
    return [
      ...specific.requirement1.segments.map((seg, i) => ({
        label: `護理員指明期間${specific.requirement1.segments.length > 1 ? i + 1 : ''}`,
        segment: seg,
      })),
      ...getComplementSegments(specific.requirement1.segments).map((seg, i) => ({
        label: `護理員非指明期間${i + 1}`,
        segment: seg,
      })),
    ];
  }
  if (position === '註冊/登記護士' || position === '保健員') {
    return [{ label: '護士/保健員指明期間', segment: specific.requirement3 }];
  }
  if (position === '助理員') {
    return [{ label: '助理員指明期間', segment: specific.assistantWindow }];
  }
  return [];
}

function buildPreScheduleSpecificSlotCompliance(
  date: string,
  requiredHourly: Record<string, number[]>,
  specific: SpecificHoursConfig,
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  leaveRecords: UserLeaveRecord[],
): Record<string, SpecificSlotCompliance> {
  const shiftDayRequired = getShiftDayRequiredHourly(date, requiredHourly);
  const result: Record<string, SpecificSlotCompliance> = {};
  const isA1Facility = Math.max(...(requiredHourly['註冊/登記護士'] ?? [])) > 0;
  const nurseWindow: TimeSegment = { start: '07:00', end: '18:00' };

  for (const position of Object.keys(requiredHourly)) {
    const windows = getSpecificWindowsForPosition(position, specific);
    if (windows.length === 0) continue;

    if (position === '註冊/登記護士' && isA1Facility) {
      const dayRecords = getDayRecordsMap(leaveRecords);
      let rnHours = 0;
      for (const u of users) {
        const primary = getEmploymentPosition(u);
        if (primary !== '註冊護士') continue;
        const record = dayRecords.get(date)?.get(u.id);
        if (record) continue;
        const dailyHours = getDailyContractHours(employmentDetails[u.id]) ?? 8;
        rnHours += Math.min(dailyHours, 8);
      }
      result[position] = {
        requiredMinHeadcount: 8,
        actualMinHeadcount: rnHours,
        ok: rnHours >= 8,
        segments: [{ label: `註冊護士 ${formatWindowLabel(nurseWindow)}`, required: 8, actual: rnHours }],
      };
      continue;
    }

    const { available, equivalent } = getPreScheduleAvailableByShiftHour(
      date,
      position,
      users,
      leaveRecords,
    );
    const req = shiftDayRequired[position];

    let requiredMin = Infinity;
    let actualMin = Infinity;
    const segments: SpecificSlotSegment[] = [];
    for (const window of windows) {
      const { startH, endH } = shiftDayWindowToShiftHours(window.segment);
      let segReqMin = Infinity;
      let segActMin = Infinity;
      for (let h = startH; h < endH; h++) {
        const shiftHour = ((h % 24) + 24) % 24;
        const required = req?.[shiftHour] ?? 0;
        if (required <= 0) continue;
        segReqMin = Math.min(segReqMin, required);
        segActMin = Math.min(
          segActMin,
          position === '保健員' ? equivalent[shiftHour] : available[shiftHour],
        );
      }
      if (segReqMin === Infinity) segReqMin = 0;
      if (segActMin === Infinity) segActMin = 0;
      segments.push({ label: window.label, required: segReqMin, actual: segActMin });
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

export function buildPreScheduleDailyCompliance(
  date: string,
  requiredHours: Record<string, number>,
  requiredHourly: Record<string, number[]>,
  specific: SpecificHoursConfig,
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  leaveRecords: UserLeaveRecord[],
): ComplianceRow[] {
  const dayRecords = getDayRecordsMap(leaveRecords);
  const availableHours: Record<string, number> = {};

  for (const position of Object.keys(requiredHours)) {
    let total = 0;
    for (const u of users) {
      if (position === '助理員') {
        if (!isAssistantSlotContributor(u)) continue;
      } else if (!canFillPositionInPreSchedule(u, position)) {
        continue;
      }
      const record = dayRecords.get(date)?.get(u.id);
      if (record) continue;
      total += getDailyContractHours(employmentDetails[u.id]) ?? 8;
    }
    availableHours[position] = total;
  }

  const specificSlot = buildPreScheduleSpecificSlotCompliance(
    date,
    requiredHourly,
    specific,
    users,
    employmentDetails,
    leaveRecords,
  );

  const positions = new Set([
    ...Object.keys(requiredHours),
    ...Object.keys(availableHours),
    ...Object.keys(requiredHourly),
  ]);

  return Array.from(positions).map((position) => ({
    position,
    requiredHours: requiredHours[position] ?? 0,
    actualHours: availableHours[position] ?? 0,
    hoursOk: (availableHours[position] ?? 0) >= (requiredHours[position] ?? 0),
    requiredSpecificHeadcount: specificSlot[position]?.requiredMinHeadcount ?? 0,
    actualSpecificHeadcount: specificSlot[position]?.actualMinHeadcount ?? 0,
    specificSlotOk: specificSlot[position]?.ok ?? true,
    hasSpecificSlotRequirement: (specificSlot[position]?.requiredMinHeadcount ?? 0) > 0,
    specificSegments: specificSlot[position]?.segments ?? [],
  }));
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

export function getComplementSegments(segments: TimeSegment[]): TimeSegment[] {
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

/** 把 calendar 時間窗口轉為排班日內的小時索引（0=07:00，23=翌日06:59） */
export function shiftDayWindowToShiftHours(seg: TimeSegment): { startH: number; endH: number } {
  const dayStartMin = timeToMinutes('07:00');
  const startMin = (timeToMinutes(seg.start) - dayStartMin + 1440) % 1440;
  let endMin = (timeToMinutes(seg.end) - dayStartMin + 1440) % 1440;
  if (endMin <= startMin) endMin += 1440;
  return { startH: Math.floor(startMin / 60), endH: Math.floor(endMin / 60) };
}

/** 把 staffingResult.grid 的 calendar 00-23 required 映射為排班日 0-23 required */
export function getShiftDayRequiredHourly(
  date: string,
  requiredHourly: Record<string, number[]>,
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  const nextDayDate = new Date(date);
  nextDayDate.setDate(nextDayDate.getDate() + 1);
  const nextDayStr = `${nextDayDate.getFullYear()}-${pad(nextDayDate.getMonth() + 1)}-${pad(nextDayDate.getDate())}`;
  // 目前 requiredHourly 每天都一樣，直接用同一組；未來若按日變化可再擴充
  void nextDayStr;
  for (const [position, hourly] of Object.entries(requiredHourly)) {
    result[position] = new Array(24).fill(0).map((_, shiftHour) => {
      const calendarHour = shiftHour < 17 ? shiftHour + 7 : shiftHour - 17;
      return hourly?.[calendarHour] ?? 0;
    });
  }
  return result;
}

/** 計算排班日 date 內每小時的實際在班人數（按員工實際職位歸類，RN/EN 合併） */
function getShiftDayActualHourly(
  date: string,
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  assignments: UserShiftAssignment[],
): { actual: Record<string, number[]>; equivalent: Record<string, number[]> } {
  const positions = ['主管', '註冊/登記護士', '保健員', '護理員', '助理員', '物理治療師', '任何員工'];
  const actual: Record<string, number[]> = {};
  for (const p of positions) actual[p] = new Array(24).fill(0);
  const equivalent: Record<string, number[]> = {};

  const dayStart = getShiftDayStart(date);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  for (const a of assignments) {
    const user = users.find((u) => u.id === a.user_id);
    if (!user) continue;
    const pos = getSpecificSlotPosition(user);
    if (!actual[pos]) continue;

    const dailyHours = getDailyContractHours(employmentDetails[a.user_id]) ?? 8;
    const start = new Date(`${a.work_date}T${a.start_time}:00`);
    const end = a.end_time
      ? new Date(`${a.work_date}T${a.end_time}:00`)
      : new Date(start.getTime() + dailyHours * 60 * 60 * 1000);
    if (end <= start) end.setDate(end.getDate() + 1);

    const effectiveStart = start < dayStart ? dayStart : start;
    const effectiveEnd = end > dayEnd ? dayEnd : end;
    if (effectiveStart >= effectiveEnd) continue;

    for (let h = 0; h < 24; h++) {
      const slotStart = new Date(dayStart.getTime() + h * 60 * 60 * 1000);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      if (slotStart < effectiveEnd && slotEnd > effectiveStart) {
        actual[pos][h]++;
        // 保健員特定鐘點：護士與保健員可混合貢獻，1 護士 = 2 保健員
        if (pos === '註冊/登記護士' || pos === '保健員') {
          if (!equivalent['保健員']) equivalent['保健員'] = new Array(24).fill(0);
          equivalent['保健員'][h] += pos === '註冊/登記護士' ? 2 : 1;
        }
      }
    }
  }
  return { actual, equivalent };
}

/** 計算排班日 date 內 07:00-18:00 有註冊護士當值的小時數（甲一買位合約要求） */
function computeNurseCoverageShiftDayHours(
  date: string,
  assignments: UserShiftAssignment[],
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
): number {
  const coverage = new Array(24).fill(false);
  const dayStart = getShiftDayStart(date);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const windowStart = new Date(`${date}T07:00:00`);
  const windowEnd = new Date(`${date}T18:00:00`);

  for (const a of assignments) {
    const user = users.find((u) => u.id === a.user_id);
    if (!user) continue;
    const primary = getEmploymentPosition(user);
    if (primary !== '註冊護士') continue;

    const dailyHours = getDailyContractHours(employmentDetails[a.user_id]) ?? 8;
    const start = new Date(`${a.work_date}T${a.start_time}:00`);
    const end = a.end_time
      ? new Date(`${a.work_date}T${a.end_time}:00`)
      : new Date(start.getTime() + dailyHours * 60 * 60 * 1000);
    if (end <= start) end.setDate(end.getDate() + 1);

    const effectiveStart = start < dayStart ? dayStart : start;
    const effectiveEnd = end > dayEnd ? dayEnd : end;
    if (effectiveStart >= effectiveEnd) continue;

    for (let h = 0; h < 24; h++) {
      const slotStart = new Date(dayStart.getTime() + h * 60 * 60 * 1000);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      if (slotStart < windowEnd && slotEnd > windowStart && slotStart < effectiveEnd && slotEnd > effectiveStart) {
        coverage[h] = true;
      }
    }
  }
  return coverage.filter(Boolean).length;
}

function formatWindowLabel(seg: TimeSegment): string {
  return `${seg.start}-${seg.end}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildSpecificSlotCompliance(
  date: string,
  requiredHourly: Record<string, number[]>,
  specific: SpecificHoursConfig,
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  assignments: UserShiftAssignment[],
): Record<string, SpecificSlotCompliance> {
  const shiftDayRequired = getShiftDayRequiredHourly(date, requiredHourly);
  const { actual: shiftDayActual, equivalent: shiftDayEquivalent } = getShiftDayActualHourly(
    date,
    users,
    employmentDetails,
    assignments,
  );

  const result: Record<string, SpecificSlotCompliance> = {};
  const isA1Facility = Math.max(...(requiredHourly['註冊/登記護士'] ?? [])) > 0;
  const nurseWindow: TimeSegment = { start: '07:00', end: '18:00' };

  for (const position of Object.keys(requiredHourly)) {
    const windows = getSpecificWindowsForPosition(position, specific);
    if (windows.length === 0) continue;

    // 甲一買位：只有註冊護士（RN）可貢獻 07:00-18:00 內累積不少於 8 小時；登記護士（EN）只計工時，不計此項
    if (position === '註冊/登記護士' && isA1Facility) {
      const actualHours = computeNurseCoverageShiftDayHours(date, assignments, users, employmentDetails);
      result[position] = {
        requiredMinHeadcount: 8,
        actualMinHeadcount: actualHours,
        ok: actualHours >= 8,
        segments: [{ label: `註冊護士 ${formatWindowLabel(nurseWindow)}`, required: 8, actual: actualHours }],
      };
      continue;
    }

    const req = shiftDayRequired[position];
    let requiredMin = Infinity;
    let actualMin = Infinity;
    const segments: SpecificSlotSegment[] = [];
    for (const window of windows) {
      const { startH, endH } = shiftDayWindowToShiftHours(window.segment);
      let segReqMin = Infinity;
      let segActMin = Infinity;
      for (let h = startH; h < endH; h++) {
        const shiftHour = ((h % 24) + 24) % 24;
        // 保健員特定鐘點：護士 + 保健員混合人手
        if (position === '保健員') {
          const requiredEquivalents =
            (req[shiftHour] ?? 0) + 2 * (shiftDayRequired['註冊/登記護士']?.[shiftHour] ?? 0);
          segReqMin = Math.min(segReqMin, requiredEquivalents);
          segActMin = Math.min(segActMin, shiftDayEquivalent['保健員']?.[shiftHour] ?? 0);
        } else {
          segReqMin = Math.min(segReqMin, req[shiftHour] ?? 0);
          segActMin = Math.min(segActMin, shiftDayActual[position]?.[shiftHour] ?? 0);
        }
      }
      if (segReqMin === Infinity) segReqMin = 0;
      if (segActMin === Infinity) segActMin = 0;
      segments.push({ label: formatWindowLabel(window.segment), required: segReqMin, actual: segActMin });
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
