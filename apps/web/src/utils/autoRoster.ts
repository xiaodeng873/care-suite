import type {
  UserProfile,
  UserShiftAssignment,
  UserEmploymentDetails,
  UserLeaveRecord,
  StationShiftSetting,
  ShiftName,
} from '@care-suite/shared';
import { getEmploymentPosition } from '@care-suite/shared';
import { GRID_POSITIONS } from './facilityNatureSettings';
import type { SpecificHoursConfig } from './facilityNatureSettings';
import {
  buildDailyCompliance,
  toGridPosition,
  getDailyContractHours,
  getShiftEndTime,
  getDragStartTime,
} from './roster';
import type { ComplianceRow } from './roster';
import type { StaffingResult } from './staffingRequirements';

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
  date: string;
  recordType: 'leave' | 'availability';
  urgency: 'mandatory' | 'preferred';
  description: string;
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

/** 單一職位的缺口分數：工時缺口 + 特定鐘點缺口（加權） */
function computeDeficit(
  compliance: ComplianceRow[],
  position: string,
): number {
  const row = compliance.find((r) => r.position === position);
  if (!row) return 0;
  let deficit = 0;
  if (!row.hoursOk) deficit += row.requiredHours - row.actualHours;
  if (row.hasSpecificSlotRequirement && !row.specificSlotOk) {
    deficit +=
      (row.requiredSpecificHeadcount - row.actualSpecificHeadcount) * 5;
  }
  return deficit;
}

function isNurse(user: UserProfile): boolean {
  const primary = getEmploymentPosition(user);
  if (primary === '註冊護士' || primary === '登記護士') return true;
  return (user.secondary_positions || []).some(
    (p) => p === '註冊護士' || p === '登記護士',
  );
}

/** 判斷員工是否能擔任目標職位 */
export function userCanFillPosition(user: UserProfile, position: string): boolean {
  if (position === '行政') return user.department === '行政';
  if (position === '庶務') return user.department === '庶務';
  const primary = getEmploymentPosition(user);
  if (primary === position) return true;
  if (toGridPosition(primary) === position) return true;
  if ((user.secondary_positions || []).some((p) => p === position || toGridPosition(p) === position)) return true;
  if (position === '保健員' && isNurse(user)) return true;
  return false;
}

/** 該職位是否有工時或特定鐘點要求 */
function positionHasRequirement(
  position: string,
  requiredHours: Record<string, number>,
  requiredHourly: Record<string, number[]>,
): boolean {
  if ((requiredHours[position] ?? 0) > 0) return true;
  const hourly = requiredHourly[position];
  if (!hourly) return false;
  return hourly.some((h) => h > 0);
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

function getAssignmentMinutes(
  assignment: Pick<UserShiftAssignment, 'start_time' | 'end_time'>,
  dailyHours: number,
): { start: number; end: number } {
  const start = timeToMinutes(assignment.start_time);
  const end = assignment.end_time
    ? timeToMinutes(assignment.end_time)
    : (start + Math.round(dailyHours * 60)) % 1440;
  return { start, end };
}

function segmentContains(
  container: { start: number; end: number },
  inner: { start: number; end: number },
): boolean {
  // 支援跨午夜容器（如 22:00-06:00）
  const normalize = (v: number) => (v < container.start ? v + 1440 : v);
  const innerStart = normalize(inner.start);
  const innerEnd = normalize(inner.end);
  // 若 inner 本身跨午夜，且容器不跨午夜，視為不包含
  if (innerEnd <= innerStart) return false;
  return innerStart >= container.start && innerEnd <= container.end;
}

function getAvailabilityWindow(
  userId: string,
  date: string,
  leaveRecords: UserLeaveRecord[] | undefined,
): { start: number; end: number } | null {
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

/** 在候選者分數相同時，按居住區順序、班次順序排優先 */
function candidatePriority(
  candidate: AutoRosterCandidate,
  stationList: (string | null)[],
  shiftOrder: Map<string, number>,
): number {
  const stationIndex = stationList.indexOf(candidate.station_id);
  const shiftIndex = shiftOrder.get(
    `${candidate.station_id ?? 'unassigned'}|${candidate.shift_name}`,
  ) ?? Infinity;
  return stationIndex * 1000 + shiftIndex;
}

/** 依員工偏好居住區產生專屬居住區順序：
 * - 有設定 preferred_station 者：先 primary，再 secondary，其餘在後
 * - 無設定偏好者：未分區優先
 */
function getUserStationList(
  userId: string,
  employmentDetails: Record<string, UserEmploymentDetails>,
  baseList: (string | null)[],
): (string | null)[] {
  const details = employmentDetails[userId];
  const prefs: (string | null)[] = [];
  if (details?.preferred_station_primary) {
    prefs.push(details.preferred_station_primary);
  }
  if (details?.preferred_station_secondary?.length) {
    for (const s of details.preferred_station_secondary) {
      if (!prefs.includes(s)) prefs.push(s);
    }
  }
  const rest = baseList.filter((s) => !prefs.includes(s));
  if (prefs.length > 0) {
    return [...prefs, ...rest];
  }
  // 沒有設定偏好者：未分區優先
  const unassignedIndex = baseList.indexOf(null);
  if (unassignedIndex >= 0) {
    return [null, ...baseList.filter((_, i) => i !== unassignedIndex)];
  }
  return baseList;
}

/**
 * 每日一鍵排班啟發式演算法：
 * 1. 硬性排除：必須放假、不在可用時段、已排班、職位不符。
 * 2. 以雙紅線缺口為目標（特定鐘點權重高於工時）。
 * 3. 每次貪婪選擇「插入後缺口減少最多」的員工＋居住區＋班次。
 * 4. 分數相同時按居住區優先順序、班次順序排優先；有「希望」放假者排後。
 * 5. 當兩條紅線都達標，或再也找不到能改善的候選者時停止。
 * 6. 回傳因無法滿足紅線而被迫忽略的「希望」預排。
 */
export function generateAutoRoster(input: AutoRosterInput): AutoRosterResult {
  const {
    date,
    position,
    users,
    employmentDetails,
    stations,
    stationPriority,
    shiftSettings,
    existingAssignments,
    dailyRequirements,
    staffingResult,
    specific,
    leaveRecords,
  } = input;

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

  const shiftOrder = new Map<string, number>();
  for (const stationId of stationList) {
    const shifts = getActiveShifts(shiftSettings, stationId, position);
    shifts.forEach((s, i) =>
      shiftOrder.set(`${stationId ?? 'unassigned'}|${s.shift_name}`, i),
    );
  }

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
  const initialDeficit = computeDeficit(initialCompliance, position);

  const eligibleUsers = users.filter((u) => {
    if (!userCanFillPosition(u, position)) return false;
    // 自動排班不主動把護士編入保健員表（仍允許手動拖曳）
    if (position === '保健員' && isNurse(u)) return false;
    return true;
  });

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
    const currentDeficit = computeDeficit(currentCompliance, position);
    if (currentDeficit <= 0) break;

    let bestCandidate: AutoRosterCandidate | null = null;
    let bestScore = 0;

    for (const user of eligibleUsers) {
      if (assignedUserIds.has(user.id)) continue;
      if (hasMandatoryLeave(user.id, date, leaveRecords)) continue;

      const dailyHours = getDailyContractHours(employmentDetails[user.id]) ?? 8;
      if (dailyHours <= 0) continue;

      const availability = getAvailabilityWindow(user.id, date, leaveRecords);
      const preferredLeave = getPreferredLeave(user.id, date, leaveRecords);
      const userStationList = getUserStationList(user.id, employmentDetails, stationList);
      const userShiftOrder = new Map<string, number>();
      for (const sid of userStationList) {
        getActiveShifts(shiftSettings, sid, position).forEach((s, i) =>
          userShiftOrder.set(`${sid ?? 'unassigned'}|${s.shift_name}`, i),
        );
      }

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

          const shiftMinutes = getAssignmentMinutes(
            { start_time: shift.start_time, end_time: null },
            dailyHours,
          );
          if (availability && !segmentContains(availability, shiftMinutes)) {
            continue;
          }

          const candidate: AutoRosterCandidate = {
            user_id: user.id,
            work_date: date,
            station_id: stationId,
            shift_name: shift.shift_name,
            start_time: getDragStartTime(employmentDetails[user.id], shift.start_time),
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
          const mockDeficit = computeDeficit(mockCompliance, position);
          const score = currentDeficit - mockDeficit;

          // 同分時：優先沒有「希望」放假者，再按居住區/班次順序
          const preferredPenalty = preferredLeave ? 1 : 0;
          const currentBestPenalty = bestCandidate && getPreferredLeave(bestCandidate.user_id, date, leaveRecords) ? 1 : 0;

          const better =
            score > bestScore ||
            (score === bestScore &&
              (preferredPenalty < currentBestPenalty ||
                (preferredPenalty === currentBestPenalty &&
                  bestCandidate &&
                  candidatePriority(candidate, userStationList, userShiftOrder) <
                    candidatePriority(
                      { ...bestCandidate, work_date: date },
                      userStationList,
                      userShiftOrder,
                    ))));

          if (better) {
            bestCandidate = candidate;
            bestScore = score;
          }
        }
      }
    }

    // 找不到能改善的候選者就停止（已盡力）
    if (!bestCandidate || bestScore <= 0) break;

    insertions.push(bestCandidate);
    simulatedAssignments.push(makeMockAssignment(bestCandidate, employmentDetails));
    assignedUserIds.add(bestCandidate.user_id);
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

  // 收集衝突：「希望」放假但被排了班
  const conflicts: AutoRosterConflict[] = [];
  for (const user of users) {
    const preferred = getPreferredLeave(user.id, date, leaveRecords);
    const isAssigned = simulatedAssignments.some(
      (a) => a.user_id === user.id && a.work_date === date,
    );
    if (preferred && isAssigned) {
      conflicts.push({
        user_id: user.id,
        date,
        recordType: 'leave',
        urgency: 'preferred',
        description: `${date}：${user.name_zh} 希望放假`,
      });
    }
  }

  return {
    insertions,
    finalCompliance,
    initialDeficit,
    finalDeficit: computeDeficit(finalCompliance, position),
    conflicts,
  };
}
