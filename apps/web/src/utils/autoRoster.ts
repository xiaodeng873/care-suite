import type {
  UserProfile,
  UserShiftAssignment,
  UserEmploymentDetails,
  UserLeaveRecord,
  StationShiftSetting,
  ShiftName,
  LeaveType,
} from '@care-suite/shared';
import { getEmploymentPosition, LEAVE_TYPE_LABELS } from '@care-suite/shared';
import { GRID_POSITIONS } from './facilityNatureSettings';
import type { SpecificHoursConfig } from './facilityNatureSettings';
import {
  buildDailyCompliance,
  getDailyContractHours,
  getShiftEndTime,
  getAssignmentPositionForTable,
  getSpecificWorkingTimeWindow,
  getShiftDayActualHourly,
  getShiftDayRequiredHourly,
  shiftDayWindowToShiftHours,
  getSpecificWindowsForPosition,
  computeNurseCoverageShiftDayHours,
  formatTime,
} from './roster';
import type { ComplianceRow } from './roster';
import type { StaffingResult } from './staffingRequirements';
import type { AutoRosterPrinciples } from './autoRosterPrinciples';

export interface AutoRosterCandidate {
  user_id: string;
  work_date: string;
  station_id: string | null;
  shift_name: ShiftName;
  start_time: string;
  /** 該班次所屬的統計職位（用於跨職位替補時的工時歸屬） */
  position: string;
}

export interface AutoRosterConflict {
  user_id: string;
  name_zh: string;
  date: string;
  recordType: 'leave' | 'availability';
  leaveType: LeaveType | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  urgency: 'mandatory' | 'preferred';
  description: string;
  canOverride: boolean;
}

export interface AutoRosterInput {
  date: string;
  position: string;
  users: UserProfile[];
  employmentDetails: Record<string, UserEmploymentDetails>;
  stations: { id: string; name: string }[];
  /** 居住區優先順序，未提供則使用 stations + 未分區 */
  stationPriority?: (string | null)[];
  shiftSettings: StationShiftSetting[];
  existingAssignments: UserShiftAssignment[];
  dailyRequirements: { position: string; hours: number; peakHeadcount: number }[];
  staffingResult: StaffingResult | null;
  specific: SpecificHoursConfig;
  /** 預排記錄，用於排除必須放假/不可用時段及計算衝突 */
  leaveRecords?: UserLeaveRecord[];
  /** 一鍵排班原則（未提供則全部不啟用） */
  principles?: AutoRosterPrinciples;
}

export interface AutoRosterResult {
  /** 建議新增的班次指派 */
  insertions: AutoRosterCandidate[];
  /** 排班後達標檢查結果 */
  finalCompliance: ComplianceRow[];
  /** 排班前缺口分數 */
  initialDeficit: number;
  /** 排班後缺口分數 */
  finalDeficit: number;
  /** 因紅線無法滿足的「希望」類預排 */
  conflicts: AutoRosterConflict[];
}

/** 把 dailyRequirements 轉成 position → hours 對照表 */
function buildRequiredHoursMap(
  dailyRequirements: { position: string; hours: number }[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of dailyRequirements) map[r.position] = r.hours;
  return map;
}

/** 把 StaffingResult.grid 轉成 position → 24 小時需求對照表 */
function buildRequiredHourly(
  staffingResult: StaffingResult | null,
): Record<string, number[]> {
  if (!staffingResult) return {};
  const map: Record<string, number[]> = {};
  for (let c = 0; c < GRID_POSITIONS.length; c++) {
    const pos = GRID_POSITIONS[c];
    map[pos] = Array.from(
      { length: 24 },
      (_, h) => staffingResult.grid[h]?.[c] ?? 0,
    );
  }
  return map;
}

function isNurse(user: UserProfile): boolean {
  const primary = getEmploymentPosition(user);
  if (primary === '註冊護士' || primary === '登記護士') return true;
  return (user.secondary_positions || []).some(
    (p) => p === '註冊護士' || p === '登記護士',
  );
}

/** 判斷員工是否能擔任目標排班分頁 */
export function userCanFillPosition(user: UserProfile, position: string): boolean {
  return getAssignmentPositionForTable(user, position) !== null;
}

/** 該職位分頁是否有工時或特定鐘點要求 */
function positionHasRequirement(
  position: string,
  requiredHours: Record<string, number>,
  requiredHourly: Record<string, number[]>,
): boolean {
  const positions = getRequirementPositions(position);
  return positions.some((p) => {
    if ((requiredHours[p] ?? 0) > 0) return true;
    const hourly = requiredHourly[p];
    if (!hourly) return false;
    return hourly.some((h) => h > 0);
  });
}

/** 某居住區某職位的啟用班次，按 sort_order 排列 */
function getActiveShifts(
  shiftSettings: StationShiftSetting[],
  stationId: string | null,
  position: string,
): StationShiftSetting[] {
  const matches = shiftSettings.filter(
    (s) => s.station_id === stationId && s.is_active,
  );
  const positionSpecific = matches
    .filter((s) => s.position === position)
    .sort((a, b) => a.sort_order - b.sort_order);
  if (positionSpecific.length > 0) return positionSpecific;
  return matches
    .filter((s) => !s.position)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 把排班分頁映射到底層 requirement 職位鍵 */
function getRequirementPositions(position: string): string[] {
  if (position === '行政' || position === '庶務') return ['助理員'];
  if (position === '護士/保健員') return ['註冊/登記護士', '保健員'];
  return [position];
}

/** 取得員工對某居住區的偏好排名（越前越偏好） */
function getStationRank(
  userId: string,
  stationId: string | null,
  employmentDetails: Record<string, UserEmploymentDetails>,
  baseList: (string | null)[],
  ignorePreference = false,
): number {
  const list = getUserStationList(userId, employmentDetails, baseList, ignorePreference);
  return list.indexOf(stationId);
}

/** 計算特定鐘點窗口內尚未被覆蓋的小時數總和。
 * 把「最低 headcount 缺口」拆成每小時來計算，讓 07:00-15:00 的早班能拿到部分 credit，
 * 避免演算法只選不覆蓋特定鐘點的晚班。 */
function computeSpecificDeficitHours(
  date: string,
  position: string,
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  assignments: UserShiftAssignment[],
  requiredHourly: Record<string, number[]>,
  specific: SpecificHoursConfig,
): number {
  const positions = getRequirementPositions(position);
  const { actual, equivalent } = getShiftDayActualHourly(date, users, employmentDetails, assignments);
  const requiredShiftDay = getShiftDayRequiredHourly(date, requiredHourly);
  let deficit = 0;

  for (const p of positions) {
    const windows = getSpecificWindowsForPosition(p, specific);
    for (const window of windows) {
      const { startH, endH } = shiftDayWindowToShiftHours(window.segment);
      for (let h = startH; h < endH; h++) {
        // 保健員特定鐘點用「等效需求」：保健員需求 + 2 × 護士需求（1 護士 = 2 保健員），
        // 與 buildSpecificSlotCompliance 的判定口徑一致，否則演算法達標但介面仍顯示紅色
        const req = p === '保健員'
          ? (requiredShiftDay['保健員']?.[h] ?? 0) +
            2 * (requiredShiftDay['註冊/登記護士']?.[h] ?? 0)
          : (requiredShiftDay[p]?.[h] ?? 0);
        if (req <= 0) continue;
        const act = p === '保健員'
          ? (equivalent['保健員']?.[h] ?? 0)
          : (actual[p]?.[h] ?? 0);
        if (act < req) {
          deficit += req - act;
        }
      }
    }
  }

  // 甲一買位：註冊護士 07:00-18:00 累積 8 小時當值要求。
  // 不計入缺口會令演算法對此紅線「視而不見」，把 RN 當多餘人手塞去窗口外的晚班。
  if (
    positions.includes('註冊/登記護士') &&
    (requiredHourly['註冊/登記護士'] ?? []).some((r) => r > 0)
  ) {
    const rnHours = computeNurseCoverageShiftDayHours(date, assignments, users, employmentDetails);
    deficit += Math.max(0, 8 - rnHours);
  }

  return deficit;
}

/** 結合工時缺口與特定鐘點未覆蓋小時數的綜合缺口分數。
 * 工時與特定鐘點同權，但特定鐘點以「每小時」計算，避免只看窗口內最低 headcount。 */
function computeGranularDeficit(
  date: string,
  position: string,
  compliance: ComplianceRow[],
  users: UserProfile[],
  employmentDetails: Record<string, UserEmploymentDetails>,
  assignments: UserShiftAssignment[],
  requiredHourly: Record<string, number[]>,
  specific: SpecificHoursConfig,
): number {
  const positions = getRequirementPositions(position);
  let deficit = 0;

  // 工時缺口
  for (const p of positions) {
    const row = compliance.find((r) => r.position === p);
    if (!row) continue;
    if (!row.hoursOk) deficit += row.requiredHours - row.actualHours;
  }

  // 特定鐘點缺口（以小時計）
  deficit += computeSpecificDeficitHours(
    date,
    position,
    users,
    employmentDetails,
    assignments,
    requiredHourly,
    specific,
  );

  return deficit;
}

/** 計算班次覆蓋「有需求小時」的數量（以排班日 07:00 為 h=0）。
 * 第二輪補班用：多餘人手必須優先排入有需求的班次（窗口內），
 * 避免「等效達標就停」後溢出人手被塞進窗口以外的班次（如晚班）。 */
function computeRequiredCoverageHours(
  date: string,
  position: string,
  requiredHourly: Record<string, number[]>,
  startTime: string,
  dailyHours: number,
): number {
  const positions = getRequirementPositions(position);
  const requiredShiftDay = getShiftDayRequiredHourly(date, requiredHourly);
  const startH = Math.floor(
    (((timeToMinutes(startTime) - timeToMinutes('07:00')) % 1440) + 1440) % 1440 / 60,
  );
  let covered = 0;
  const hours = Math.round(dailyHours);
  for (let i = 0; i < hours; i++) {
    const h = (startH + i) % 24;
    if (positions.some((p) => (requiredShiftDay[p]?.[h] ?? 0) > 0)) covered++;
  }
  return covered;
}

/** 把「午夜起計分鐘數」轉為排班日座標（07:00 = 0，範圍 0-1439） */
function toShiftDayMinutes(minutes: number): number {
  return (((minutes - timeToMinutes('07:00')) % 1440) + 1440) % 1440;
}

/** 排班日以 07:00 為起點，跨午夜不是特例：21:00-06:00 即 840-1380，直接比較即可 */
function segmentContains(
  container: { start: number; end: number },
  inner: { start: number; end: number },
): boolean {
  const containerStart = toShiftDayMinutes(container.start);
  let containerEnd = toShiftDayMinutes(container.end);
  if (containerEnd <= containerStart) containerEnd += 1440;
  const innerStart = toShiftDayMinutes(inner.start);
  let innerEnd = toShiftDayMinutes(inner.end);
  if (innerEnd <= innerStart) innerEnd += 1440;
  return innerStart >= containerStart && innerEnd <= containerEnd;
}

/** 排班日座標下兩段時間的重疊分鐘數 */
function spanOverlapMinutes(
  a: { start: number; end: number },
  b: { start: number; end: number },
): number {
  const toSpan = (s: { start: number; end: number }) => {
    const start = toShiftDayMinutes(s.start);
    let end = toShiftDayMinutes(s.end);
    if (end <= start) end += 1440;
    return { start, end };
  };
  const sa = toSpan(a);
  const sb = toSpan(b);
  return Math.max(0, Math.min(sa.end, sb.end) - Math.max(sa.start, sb.start));
}

/** 分鐘數轉回 HH:MM（自動 mod 一天） */
function minutesToTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return formatTime(Math.floor(m / 60), m % 60);
}

/**
 * 計算員工在某班次的候選：
 * - 無特定上班時間/可用時段：跟隨班次設定時間，重疊視為全段。
 * - 有特定上班時間：卡片用員工自己的窗口時間（必須整段落在窗口內），
 *   且窗口與班次時段重疊至少一半工時才屬於這個班次桶；否則回傳 null（衝突，不可排）。
 *   回傳重疊分鐘數供排序：多個班次合格時，歸重疊最多的一個。
 */
function getCandidateStartTime(
  shift: StationShiftSetting,
  dailyHours: number,
  availability: { start: number; end: number } | null,
): { startTime: string; overlap: number } | null {
  const dailyMinutes = Math.round(dailyHours * 60);
  if (!availability) return { startTime: shift.start_time.slice(0, 5), overlap: dailyMinutes };
  const ownStart = availability.start;
  const ownEnd = ownStart + dailyMinutes;
  if (!segmentContains(availability, { start: ownStart, end: ownEnd })) return null;
  const shiftStart = timeToMinutes(shift.start_time);
  const overlap = spanOverlapMinutes(
    { start: ownStart, end: ownEnd },
    { start: shiftStart, end: shiftStart + dailyMinutes },
  );
  // 卡片需與班次時段重疊至少一半工時，才屬於這個班次桶
  if (overlap * 2 < dailyMinutes) return null;
  return { startTime: minutesToTime(ownStart), overlap };
}

function getAvailabilityWindow(
  userId: string,
  date: string,
  leaveRecords: UserLeaveRecord[] | undefined,
  employmentDetails: Record<string, UserEmploymentDetails>,
): { start: number; end: number } | null {
  // 常態化「特定上班時間」優先；有設定時視為強制可用時段
  const constant = getSpecificWorkingTimeWindow(employmentDetails[userId]);
  if (constant) {
    return { start: timeToMinutes(constant.start), end: timeToMinutes(constant.end) };
  }
  // 否則回退單次 availability 記錄
  const record = leaveRecords?.find(
    (l) =>
      l.user_id === userId &&
      l.leave_date === date &&
      l.record_type === 'availability' &&
      !l.is_overridden,
  );
  if (!record?.availability_start_time || !record?.availability_end_time) return null;
  return {
    start: timeToMinutes(record.availability_start_time),
    end: timeToMinutes(record.availability_end_time),
  };
}

function hasMandatoryLeave(
  userId: string,
  date: string,
  leaveRecords: UserLeaveRecord[] | undefined,
): boolean {
  return (
    leaveRecords?.some(
      (l) =>
        l.user_id === userId &&
        l.leave_date === date &&
        l.record_type === 'leave' &&
        l.urgency === 'mandatory' &&
        !l.is_overridden,
    ) ?? false
  );
}

function isOnLeave(
  userId: string,
  date: string,
  leaveRecords: UserLeaveRecord[] | undefined,
): boolean {
  return (
    leaveRecords?.some(
      (l) =>
        l.user_id === userId &&
        l.leave_date === date &&
        l.record_type === 'leave' &&
        !l.is_overridden,
    ) ?? false
  );
}

function isFullTime(user: UserProfile): boolean {
  return user.employment_type === '正職';
}

function getPreferredLeave(
  userId: string,
  date: string,
  leaveRecords: UserLeaveRecord[] | undefined,
): UserLeaveRecord | undefined {
  return leaveRecords?.find(
    (l) =>
      l.user_id === userId &&
      l.leave_date === date &&
      l.record_type === 'leave' &&
      l.urgency === 'preferred' &&
      !l.is_overridden,
  );
}

/** 建立一個假的 UserShiftAssignment，只供 simulation 使用 */
function makeMockAssignment(
  candidate: AutoRosterCandidate,
  employmentDetails: Record<string, UserEmploymentDetails>,
): UserShiftAssignment {
  return {
    id: `tmp-${candidate.user_id}-${candidate.station_id ?? 'unassigned'}-${candidate.shift_name}`,
    user_id: candidate.user_id,
    work_date: candidate.work_date,
    station_id: candidate.station_id,
    position: candidate.position,
    shift_name: candidate.shift_name,
    start_time: candidate.start_time,
    end_time: getShiftEndTime(
      candidate.start_time,
      getDailyContractHours(employmentDetails[candidate.user_id]),
    ),
    created_by: null,
    created_at: '',
    updated_at: '',
  };
}

/** 依員工偏好居住區產生專屬居住區順序；會排除 stations_forbidden 的居住區：
 * - 有設定 preferred_station 者：先 primary，再 secondary，其餘在後
 * - 無設定偏好者：未分區優先
 * - ignorePreference（原則3）時：無視偏好，直接用預設順序（仍排除 forbidden）
 */
function getUserStationList(
  userId: string,
  employmentDetails: Record<string, UserEmploymentDetails>,
  baseList: (string | null)[],
  ignorePreference = false,
): (string | null)[] {
  const details = employmentDetails[userId];
  const forbidden = new Set(details?.stations_forbidden ?? []);
  const isForbidden = (s: string | null) => s !== null && forbidden.has(s);

  if (ignorePreference) {
    return baseList.filter((s) => !isForbidden(s));
  }

  const prefs: (string | null)[] = [];
  if (details?.preferred_station_primary && !isForbidden(details.preferred_station_primary)) {
    prefs.push(details.preferred_station_primary);
  }
  if (details?.preferred_station_secondary?.length) {
    for (const s of details.preferred_station_secondary) {
      if (!isForbidden(s) && !prefs.includes(s)) prefs.push(s);
    }
  }
  const rest = baseList.filter((s) => !prefs.includes(s) && !isForbidden(s));
  if (prefs.length > 0) {
    return [...prefs, ...rest];
  }
  // 沒有設定偏好者：未分區優先（未分區不會在 forbidden uuid[] 內）
  const unassignedIndex = baseList.indexOf(null);
  if (unassignedIndex >= 0) {
    return [null, ...baseList.filter((s, i) => i !== unassignedIndex && !isForbidden(s))];
  }
  return baseList.filter((s) => !isForbidden(s));
}

/**
 * 每日一鍵排班啟發式演算法：
 * 1. 硬性排除：必須放假、不在可用時段、已排班、職位不符。
 * 2. 以「工時缺口 + 特定鐘點未覆蓋小時數」為目標，同權比較所有員工×所有居住區×所有班次。
 * 3. 同分時優先順序：沒有「希望」放假者 > 覆蓋較多「有需求小時」的班次（窗口內優先）
 *    > 居住區偏好 > 班次 start_time（僅為確定性）。
 * 4. 當兩條紅線都達標，或再也找不到能改善的候選者時停止。
 * 5. 第二輪為尚未排班的正職員工補班：優先排入覆蓋「有需求小時」最多的班次（窗口內），
 *    再按居住區偏好、班次 start_time 排序，避免溢出人手被塞進窗口以外的班次。
 * 6. 回傳因無法滿足紅線而被迫忽略的「希望」預排。
 */
export function generateAutoRoster(input: AutoRosterInput): AutoRosterResult {
  const {
    date,
    position,
    users: allUsers,
    employmentDetails,
    stations,
    stationPriority,
    shiftSettings,
    existingAssignments,
    dailyRequirements,
    staffingResult,
    specific,
    leaveRecords,
    principles,
  } = input;
  // 離職日期當日起不再參與自動排班
  const users = allUsers.filter((u) => !u.resignation_date || u.resignation_date > date);
  const ignorePref = principles?.ignoreStationPreference === true;

  const requiredHours = buildRequiredHoursMap(dailyRequirements);
  const requiredHourly = buildRequiredHourly(staffingResult);

  // 該職位無任何要求時直接返回空
  if (!positionHasRequirement(position, requiredHours, requiredHourly)) {
    return {
      insertions: [],
      finalCompliance: buildDailyCompliance(
        date,
        requiredHours,
        requiredHourly,
        specific,
        users,
        employmentDetails,
        existingAssignments,
      ),
      initialDeficit: 0,
      finalDeficit: 0,
      conflicts: [],
    };
  }

  // 居住區順序：優先使用傳入的 stationPriority，否則 stations + 未分區
  const stationList: (string | null)[] =
    stationPriority && stationPriority.length > 0
      ? [...stationPriority]
      : [...stations.map((s) => s.id), null];

  const insertions: AutoRosterCandidate[] = [];
  const simulatedAssignments: UserShiftAssignment[] = [...existingAssignments];
  const assignedUserIds = new Set<string>();

  for (const a of existingAssignments) {
    if (a.work_date === date) assignedUserIds.add(a.user_id);
  }

  const initialCompliance = buildDailyCompliance(
    date,
    requiredHours,
    requiredHourly,
    specific,
    users,
    employmentDetails,
    simulatedAssignments,
  );
  const initialDeficit = computeGranularDeficit(
    date,
    position,
    initialCompliance,
    users,
    employmentDetails,
    simulatedAssignments,
    requiredHourly,
    specific,
  );

  const eligibleUsers = users.filter((u) => {
    if (!userCanFillPosition(u, position)) return false;
    // 自動排班不主動把護士編入保健員表（仍允許手動拖曳）
    if (position === '保健員' && isNurse(u)) return false;
    return true;
  });

  // 原則約束輪（在缺口輪之前）：按啟用的原則先排好各居住區早/午班人數結構。
  // 只計算「居住區」（stationId !== null），未分區不適用。
  const countBucketAssignees = (stationId: string | null, bucket: ShiftName): number =>
    simulatedAssignments.filter(
      (a) =>
        a.work_date === date &&
        a.station_id === stationId &&
        a.shift_name === bucket &&
        (!a.position || a.position === position),
    ).length;

  /** 嘗試把一名合資格員工排入指定居住區的指定班別（早班/午班）；無人可排回 false。
   * 同分時優先「以此居住區為偏好」的員工（原則3 勾選時才無視偏好）。 */
  const tryAssignToBucket = (stationId: string | null, bucket: ShiftName): boolean => {
    const shifts = getActiveShifts(shiftSettings, stationId, position).filter(
      (s) => s.shift_name === bucket,
    );
    if (shifts.length === 0) return false;

    let best: {
      candidate: AutoRosterCandidate;
      preferredPenalty: number;
      stationRank: number;
      startMin: number;
    } | null = null;

    for (const user of eligibleUsers) {
      if (assignedUserIds.has(user.id)) continue;
      if (hasMandatoryLeave(user.id, date, leaveRecords)) continue;

      // 硬性排除：此居住區在員工禁區內（getUserStationList 已排除 forbidden）
      const userStations = getUserStationList(user.id, employmentDetails, stationList, ignorePref);
      if (!userStations.includes(stationId)) continue;

      const dailyHours = getDailyContractHours(employmentDetails[user.id]) ?? 8;
      if (dailyHours <= 0) continue;

      const availability = getAvailabilityWindow(user.id, date, leaveRecords, employmentDetails);
      const preferredLeave = getPreferredLeave(user.id, date, leaveRecords);

      for (const shift of shifts) {
        const candidateSpec = getCandidateStartTime(shift, dailyHours, availability);
        if (!candidateSpec) continue;

        const candidate: AutoRosterCandidate = {
          user_id: user.id,
          work_date: date,
          station_id: stationId,
          shift_name: shift.shift_name,
          start_time: candidateSpec.startTime,
          position,
        };
        const preferredPenalty = preferredLeave ? 1 : 0;
        const stationRank = userStations.indexOf(stationId);
        const startMin = timeToMinutes(candidateSpec.startTime);
        const better =
          !best ||
          preferredPenalty < best.preferredPenalty ||
          (preferredPenalty === best.preferredPenalty && stationRank < best.stationRank) ||
          (preferredPenalty === best.preferredPenalty && stationRank === best.stationRank && startMin < best.startMin);
        if (better) best = { candidate, preferredPenalty, stationRank, startMin };
      }
    }

    if (!best) return false;
    insertions.push(best.candidate);
    simulatedAssignments.push(makeMockAssignment(best.candidate, employmentDetails));
    assignedUserIds.add(best.candidate.user_id);
    return true;
  };

  // 每班最少人數（班次設定 min_staff）：在缺口輪之前先把各居住區各班補到下限。
  // 只計算「居住區」（stationId !== null），未分區不適用。
  for (const stationId of stationList) {
    if (stationId === null) continue;
    const shifts = getActiveShifts(shiftSettings, stationId, position);
    // 同一班別可能有多行設定，取最大 min_staff 為該班別下限
    const bucketMin = new Map<ShiftName, number>();
    for (const s of shifts) {
      const min = s.min_staff ?? 0;
      if (min > (bucketMin.get(s.shift_name) ?? 0)) bucketMin.set(s.shift_name, min);
    }
    for (const [bucket, min] of bucketMin) {
      while (countBucketAssignees(stationId, bucket) < min) {
        if (!tryAssignToBucket(stationId, bucket)) break;
      }
    }
  }

  // 原則2「早班最多 N 名」：上限不用主動補人，在第二輪補班時生效（見 bucketGroup）。

  while (true) {
    const currentCompliance = buildDailyCompliance(
      date,
      requiredHours,
      requiredHourly,
      specific,
      users,
      employmentDetails,
      simulatedAssignments,
    );
    const currentDeficit = computeGranularDeficit(
      date,
      position,
      currentCompliance,
      users,
      employmentDetails,
      simulatedAssignments,
      requiredHourly,
      specific,
    );
    if (currentDeficit <= 0) break;

    let best: {
      candidate: AutoRosterCandidate;
      score: number;
      preferredPenalty: number;
      overlap: number;
      coverage: number;
      stationRank: number;
    } | null = null;

    for (const user of eligibleUsers) {
      if (assignedUserIds.has(user.id)) continue;
      if (hasMandatoryLeave(user.id, date, leaveRecords)) continue;

      const dailyHours = getDailyContractHours(employmentDetails[user.id]) ?? 8;
      if (dailyHours <= 0) continue;

      const availability = getAvailabilityWindow(user.id, date, leaveRecords, employmentDetails);
      const preferredLeave = getPreferredLeave(user.id, date, leaveRecords);
      const userStationList = getUserStationList(user.id, employmentDetails, stationList, ignorePref);

      for (const stationId of userStationList) {
        const shifts = getActiveShifts(shiftSettings, stationId, position);
        if (shifts.length === 0) continue;

        for (const shift of shifts) {
          if (
            simulatedAssignments.some(
              (a) => a.user_id === user.id && a.work_date === date,
            )
          ) {
            continue;
          }

          const candidateSpec = getCandidateStartTime(shift, dailyHours, availability);
          if (!candidateSpec) continue;

          const candidate: AutoRosterCandidate = {
            user_id: user.id,
            work_date: date,
            station_id: stationId,
            shift_name: shift.shift_name,
            // 無特定上班時間者跟隨班次設定時間；有特定上班時間者用其窗口時間
            start_time: candidateSpec.startTime,
            position,
          };

          const mockAssignment = makeMockAssignment(candidate, employmentDetails);
          const mockAssignments = [...simulatedAssignments, mockAssignment];
          const mockCompliance = buildDailyCompliance(
            date,
            requiredHours,
            requiredHourly,
            specific,
            users,
            employmentDetails,
            mockAssignments,
          );
          const mockDeficit = computeGranularDeficit(
            date,
            position,
            mockCompliance,
            users,
            employmentDetails,
            mockAssignments,
            requiredHourly,
            specific,
          );
          const score = currentDeficit - mockDeficit;

          // 同分時優先順序：1. 沒有「希望」放假者；2. 與班次時段重疊較多（決定特定上班時間
          // 員工歸哪個班次桶）；3. 覆蓋較多「有需求小時」的班次（窗口內優先，
          // 避免工時同分時人被塞去窗口外的晚班）；4. 居住區偏好；5. 開始時間（只為確定性）
          const preferredPenalty = preferredLeave ? 1 : 0;
          const overlap = candidateSpec.overlap;
          const coverage = computeRequiredCoverageHours(
            date,
            position,
            requiredHourly,
            candidateSpec.startTime,
            dailyHours,
          );
          const stationRank = getStationRank(user.id, stationId, employmentDetails, stationList, ignorePref);

          const better =
            !best ||
            score > best.score ||
            (score === best.score && preferredPenalty < best.preferredPenalty) ||
            (score === best.score && preferredPenalty === best.preferredPenalty && overlap > best.overlap) ||
            (score === best.score && preferredPenalty === best.preferredPenalty && overlap === best.overlap && coverage > best.coverage) ||
            (score === best.score && preferredPenalty === best.preferredPenalty && overlap === best.overlap && coverage === best.coverage && stationRank < best.stationRank) ||
            (score === best.score && preferredPenalty === best.preferredPenalty && overlap === best.overlap && coverage === best.coverage && stationRank === best.stationRank && timeToMinutes(candidateSpec.startTime) < timeToMinutes(best.candidate.start_time));

          if (better) {
            best = { candidate, score, preferredPenalty, overlap, coverage, stationRank };
          }
        }
      }
    }

    // 找不到能改善的候選者就停止（已盡力）
    if (!best || best.score <= 0) break;

    insertions.push(best.candidate);
    simulatedAssignments.push(makeMockAssignment(best.candidate, employmentDetails));
    assignedUserIds.add(best.candidate.user_id);
  }

  // 第二輪：為尚未排班的正職員工補上班次（考慮所有居住區與班次）。
  // 「達標就停」不代表多餘人手可隨便塞：先選覆蓋最多「有需求小時」的班次（窗口內優先），
  // 再按居住區偏好、班次 start_time 排序，避免溢出人手被塞進窗口以外的班次。
  for (const user of eligibleUsers) {
    if (assignedUserIds.has(user.id)) continue;
    if (!isFullTime(user)) continue;
    if (isOnLeave(user.id, date, leaveRecords)) continue;

    const dailyHours = getDailyContractHours(employmentDetails[user.id]) ?? 8;
    if (dailyHours <= 0) continue;

    const availability = getAvailabilityWindow(user.id, date, leaveRecords, employmentDetails);
    const userStationList = getUserStationList(user.id, employmentDetails, stationList, ignorePref);

    let best: { candidate: AutoRosterCandidate; overlap: number; bucketGroup: number; bucketCount: number; coverage: number; stationRank: number } | null = null;
    for (const stationId of userStationList) {
      const shifts = getActiveShifts(shiftSettings, stationId, position);
      for (const shift of shifts) {
        if (
          simulatedAssignments.some(
            (a) => a.user_id === user.id && a.work_date === date,
          )
        ) {
          continue;
        }

        const candidateSpec = getCandidateStartTime(shift, dailyHours, availability);
        if (!candidateSpec) continue;

        const candidate: AutoRosterCandidate = {
          user_id: user.id,
          work_date: date,
          station_id: stationId,
          shift_name: shift.shift_name,
          start_time: candidateSpec.startTime,
          position,
        };
        const overlap = candidateSpec.overlap;
        // 原則2「早班最多 N 名，有餘攤到各區至各區平均，再有餘攤至午班各站」：
        // group 0 = 未滿 N 的早班（取早班人數最少的區，達至各區平均）；
        // group 1 = 午班（早班全滿後才攤入，同取人數最少的區）；
        // group 2 = 已滿 N 的早班；group 3 = 其他班別。
        let bucketGroup = 0;
        let bucketCount = 0;
        if (principles?.earlyExtra.enabled) {
          const n = principles.earlyExtra.n;
          const earlyCount = countBucketAssignees(stationId, '早班');
          if (shift.shift_name === '早班' && earlyCount < n) {
            bucketGroup = 0;
            bucketCount = earlyCount;
          } else if (shift.shift_name === '午班') {
            bucketGroup = 1;
            bucketCount = countBucketAssignees(stationId, '午班');
          } else if (shift.shift_name === '早班') {
            bucketGroup = 2;
            bucketCount = earlyCount;
          } else {
            bucketGroup = 3;
          }
        }
        const coverage = computeRequiredCoverageHours(
          date,
          position,
          requiredHourly,
          candidateSpec.startTime,
          dailyHours,
        );
        const stationRank = getStationRank(user.id, stationId, employmentDetails, stationList, ignorePref);

        const better =
          !best ||
          overlap > best.overlap ||
          (overlap === best.overlap && bucketGroup < best.bucketGroup) ||
          (overlap === best.overlap && bucketGroup === best.bucketGroup && bucketCount < best.bucketCount) ||
          (overlap === best.overlap && bucketGroup === best.bucketGroup && bucketCount === best.bucketCount && coverage > best.coverage) ||
          (overlap === best.overlap && bucketGroup === best.bucketGroup && bucketCount === best.bucketCount && coverage === best.coverage && stationRank < best.stationRank) ||
          (overlap === best.overlap &&
            bucketGroup === best.bucketGroup &&
            bucketCount === best.bucketCount &&
            coverage === best.coverage &&
            stationRank === best.stationRank &&
            timeToMinutes(candidateSpec.startTime) < timeToMinutes(best.candidate.start_time));
        if (better) best = { candidate, overlap, bucketGroup, bucketCount, coverage, stationRank };
      }
    }

    if (best) {
      insertions.push(best.candidate);
      simulatedAssignments.push(makeMockAssignment(best.candidate, employmentDetails));
      assignedUserIds.add(user.id);
    }
  }

  // 第四輪（原則2）：早班超額修正。前面各輪（min_staff 約束輪、紅線缺口輪）不看早班上限，
  // 可能令某區早班超過 N；此輪把超額的、本次一鍵排班產生的早班人手，
  // 搬往仍未滿 N 且該員工可合法前往的居住區早班（目標取早班人數最少，再按員工偏好）。
  // 手動既有班次不搬；無合法目標（如禁區）就保留，上限仍屬軟性。
  if (principles?.earlyExtra.enabled) {
    const n = principles.earlyExtra.n;
    let anyMoved = true;
    while (anyMoved) {
      anyMoved = false;
      for (const fromStation of stationList) {
        if (fromStation === null) continue;
        while (countBucketAssignees(fromStation, '早班') > n) {
          const movable = insertions.filter(
            (ins) => ins.station_id === fromStation && ins.shift_name === '早班',
          );
          let didMove = false;
          for (const ins of movable) {
            const user = eligibleUsers.find((u) => u.id === ins.user_id);
            if (!user) continue;
            const dailyHours = getDailyContractHours(employmentDetails[user.id]) ?? 8;
            const availability = getAvailabilityWindow(user.id, date, leaveRecords, employmentDetails);
            const userStations = getUserStationList(user.id, employmentDetails, stationList, ignorePref);
            const targets = userStations
              .filter(
                (s): s is string =>
                  s !== null &&
                  s !== fromStation &&
                  countBucketAssignees(s, '早班') < n &&
                  getActiveShifts(shiftSettings, s, position).some((sh) => sh.shift_name === '早班'),
              )
              .sort(
                (a, b) =>
                  countBucketAssignees(a, '早班') - countBucketAssignees(b, '早班') ||
                  userStations.indexOf(a) - userStations.indexOf(b),
              );
            let target: { stationId: string; startTime: string } | null = null;
            for (const stationId of targets) {
              const shifts = getActiveShifts(shiftSettings, stationId, position).filter(
                (sh) => sh.shift_name === '早班',
              );
              for (const shift of shifts) {
                const spec = getCandidateStartTime(shift, dailyHours, availability);
                if (spec) {
                  target = { stationId, startTime: spec.startTime };
                  break;
                }
              }
              if (target) break;
            }
            if (!target) continue;

            ins.station_id = target.stationId;
            ins.start_time = target.startTime;
            const mock = simulatedAssignments.find(
              (a) =>
                a.id.startsWith('tmp-') &&
                a.user_id === ins.user_id &&
                a.work_date === date &&
                a.shift_name === '早班',
            );
            if (mock) {
              mock.station_id = target.stationId;
              mock.start_time = target.startTime;
              mock.end_time = getShiftEndTime(target.startTime, dailyHours);
            }
            didMove = true;
            anyMoved = true;
            break;
          }
          if (!didMove) break;
        }
      }
    }
  }

  const finalCompliance = buildDailyCompliance(
    date,
    requiredHours,
    requiredHourly,
    specific,
    users,
    employmentDetails,
    simulatedAssignments,
  );

  // 收集衝突：列出當天所有影響該職位的預排，並標示可 override 的項目
  // - availability（特定上班時間）：已自動排入班次者視為已滿足，不列衝突；
  //   未被排入者也不算衝突（人手已足）。只在真正發生衝突時才列出。
  // - preferred leave：系統選中該員工時列為衝突，用戶可 override；
  //   未被選中者仍顯示按鈕，讓用戶取消放假後手動安排。
  // - mandatory leave：理論上已被排除，若仍有選中則列為不可 override 的衝突。
  const conflicts: AutoRosterConflict[] = [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const insertionSet = new Set(insertions.map((ins) => `${ins.user_id}|${ins.work_date}`));
  for (const record of leaveRecords ?? []) {
    if (record.leave_date !== date) continue;
    const user = userMap.get(record.user_id);
    if (!user) continue;
    if (!userCanFillPosition(user, position)) continue;

    // availability 已被滿足：系統已排入符合窗口的班次 → 不列衝突
    if (record.record_type === 'availability') continue;

    const isPreferredLeave = record.record_type === 'leave' && record.urgency === 'preferred';
    const isMandatoryLeave = record.record_type === 'leave' && record.urgency === 'mandatory';
    const hasInsertion = insertionSet.has(`${user.id}|${date}`);
    const canOverride = isPreferredLeave;
    const leaveLabel = record.leave_type ? LEAVE_TYPE_LABELS[record.leave_type] : '';
    const desc = `${date}：${user.name_zh} ${leaveLabel}${isMandatoryLeave ? '（必須）' : ''}`;

    if (!hasInsertion && !canOverride) continue;

    conflicts.push({
      user_id: user.id,
      name_zh: user.name_zh,
      date,
      recordType: record.record_type,
      leaveType: record.leave_type,
      availabilityStart: record.availability_start_time,
      availabilityEnd: record.availability_end_time,
      urgency: record.urgency,
      description: desc,
      canOverride,
    });
  }

  return {
    insertions,
    finalCompliance,
    initialDeficit,
    finalDeficit: computeGranularDeficit(
      date,
      position,
      finalCompliance,
      users,
      employmentDetails,
      simulatedAssignments,
      requiredHourly,
      specific,
    ),
    conflicts,
  };
}
