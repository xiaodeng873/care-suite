import type { UserProfile, UserEmploymentDetails, UserLeaveRecord, PublicHoliday, UserShiftAssignment } from '@care-suite/shared';
import {
  getSpecificSlotPosition,
  formatDate,
  isUserEmployedOnDate,
  buildPreScheduleDailyCompliance,
  getDailyContractHours,
} from './roster';
import { getRosterExpectedCounts, isDateInTargetMonth } from './leaveValidation';
import type { ComplianceRow } from './roster';
import type { SpecificHoursConfig } from './facilityNatureSettings';
import { addDays } from './shiftDay';

export interface UserMonthlyBalances {
  doBalance: number;
  doAccumulated: number;
  doEstimated: number;
  restDayFraction: number;
  prdExpected: number;
  prdEstimated: number;
  phAvailable: number;
  phAccumulated: number;
  phEstimated: number;
  shAvailable: number;
  shAccumulated: number;
  shEstimated: number;
  alBalance: number;
  alAccumulated: number;
  alEstimated: number;
  whb: number;
}

export interface AutoLeavePlanInput {
  year: number;
  month: number;
  users: UserProfile[];
  employmentDetails: Record<string, UserEmploymentDetails>;
  leaveRecords: UserLeaveRecord[];
  shiftAssignments: UserShiftAssignment[];
  publicHolidays: PublicHoliday[];
  requiredHours: Record<string, number>;
  requiredHourly: Record<string, number[]>;
  specificHours: SpecificHoursConfig;
  getUserBalances: (userId: string) => UserMonthlyBalances | null;
}

export interface AutoLeavePlacement {
  userId: string;
  userName: string;
  date: string;
  leaveType: 'DO' | 'PRD' | 'PH';
  referencePublicHolidayId?: string;
  holidayName?: string;
}

export interface AutoLeaveWarning {
  userId: string;
  userName: string;
  leaveType: 'DO' | 'PRD' | 'PH';
  plannedDays: number;
  expectedDays: number;
}

export interface AutoLeaveSkipped {
  userId: string;
  userName: string;
  leaveType: 'DO' | 'PRD' | 'PH';
  remainingDays: number;
  reason: 'no_eligible_day' | 'insufficient_capacity';
}

export interface AutoLeavePendingAdjustment {
  userId: string;
  userName: string;
  date: string;
  leaveType: 'AL' | 'PRD' | 'DO' | 'SL' | 'SLN' | 'PH' | 'SH' | null;
}

export interface AutoLeavePlan {
  placements: AutoLeavePlacement[];
  warnings: AutoLeaveWarning[];
  skipped: AutoLeaveSkipped[];
  pendingAdjustments: AutoLeavePendingAdjustment[];
}

/** 以香港時區取得今日 YYYY-MM-DD */
export function getHkTodayString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function getUserPositionComplianceRow(
  compliance: ComplianceRow[],
  user: UserProfile,
): ComplianceRow | undefined {
  const position = getSpecificSlotPosition(user);
  return compliance.find((r) => r.position === position);
}

function getCandidateDates(year: number, month: number, todayStr: string): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d);
    if (dateStr >= todayStr) dates.push(dateStr);
  }
  return dates;
}

function getExistingRecordCount(
  userId: string,
  leaveType: 'DO' | 'PRD' | 'PH',
  year: number,
  month: number,
  leaveRecords: UserLeaveRecord[],
  isAuto?: boolean,
): number {
  return leaveRecords.filter((l) => {
    if (l.user_id !== userId) return false;
    if (l.record_type !== 'leave') return false;
    if (l.leave_type !== leaveType) return false;
    if (!isDateInTargetMonth(l.leave_date, year, month)) return false;
    if (isAuto !== undefined && l.is_auto !== isAuto) return false;
    return true;
  }).length;
}

function getEligibleHolidays(
  userId: string,
  placementDate: string,
  publicHolidays: PublicHoliday[],
  leaveRecords: UserLeaveRecord[],
): PublicHoliday[] {
  const usedIds = new Set(
    leaveRecords
      .filter(
        (l) =>
          l.user_id === userId &&
          l.record_type === 'leave' &&
          l.leave_type === 'PH' &&
          l.reference_public_holiday_id,
      )
      .map((l) => l.reference_public_holiday_id!),
  );

  return publicHolidays
    .filter((h) => {
      if (h.type !== 'PH') return false;
      const expiry = addDays(h.holiday_date, 30);
      if (expiry < placementDate) return false;
      if (h.holiday_date > placementDate) return false;
      if (usedIds.has(h.id)) return false;
      return true;
    })
    .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
}

interface PlanState {
  /** date -> ComplianceRow[] mutable snapshot */
  complianceByDate: Map<string, ComplianceRow[]>;
  /** date -> set of user ids already scheduled as unavailable */
  unavailableByDate: Map<string, Set<string>>;
  /** date -> set of user ids already with shift assignments */
  assignedByDate: Map<string, Set<string>>;
}

function cloneCompliance(rows: ComplianceRow[]): ComplianceRow[] {
  return rows.map((r) => ({ ...r, specificSegments: r.specificSegments.map((s) => ({ ...s })) }));
}

function canPlaceLeave(
  user: UserProfile,
  date: string,
  state: PlanState,
): boolean {
  if (!isUserEmployedOnDate(user, date)) return false;
  if (state.unavailableByDate.get(date)?.has(user.id)) return false;
  if (state.assignedByDate.get(date)?.has(user.id)) return false;

  const compliance = state.complianceByDate.get(date);
  if (!compliance) return false;

  const row = getUserPositionComplianceRow(compliance, user);
  if (!row) return false;

  return true;
}

function applyLeavePlacement(
  user: UserProfile,
  date: string,
  state: PlanState,
  employmentDetails: Record<string, UserEmploymentDetails>,
): void {
  const dailyHours = getDailyContractHours(employmentDetails[user.id]) ?? 8;
  const compliance = state.complianceByDate.get(date);
  if (compliance) {
    const row = getUserPositionComplianceRow(compliance, user);
    if (row) {
      row.actualHours -= dailyHours;
      row.hoursOk = row.actualHours >= row.requiredHours;
      if (row.hasSpecificSlotRequirement) {
        row.actualSpecificHeadcount -= 1;
        row.specificSlotOk = row.actualSpecificHeadcount >= row.requiredSpecificHeadcount;
      }
    }
  }

  if (!state.unavailableByDate.has(date)) state.unavailableByDate.set(date, new Set());
  state.unavailableByDate.get(date)!.add(user.id);
}

interface LeaveTypePlan {
  leaveType: 'DO' | 'PRD' | 'PH';
  targetDays: number;
  expectedDays: number;
}

/** 計算單一員工單一假別的目標天數。
 * 規則：只看當月預計收穫（expected），不看累積；已手動排的天數要扣減。
 * targetDays = max(0, expectedDays - userInputCount) */
function buildLeaveTypePlans(
  user: UserProfile,
  year: number,
  month: number,
  leaveRecords: UserLeaveRecord[],
  expected: { doExpected: number; prdExpected: number; phExpected: number },
  employmentDetails: Record<string, UserEmploymentDetails>,
): LeaveTypePlan[] {
  const plans: LeaveTypePlan[] = [];

  // DO
  const doUserInputCount = getExistingRecordCount(user.id, 'DO', year, month, leaveRecords, false);
  const doTarget = Math.max(0, expected.doExpected - doUserInputCount);
  if (doTarget > 0) {
    plans.push({
      leaveType: 'DO',
      targetDays: doTarget,
      expectedDays: expected.doExpected,
    });
  }

  // PRD
  const prdUserInputCount = getExistingRecordCount(user.id, 'PRD', year, month, leaveRecords, false);
  const prdTarget = Math.max(0, expected.prdExpected - prdUserInputCount);
  if (prdTarget > 0) {
    plans.push({
      leaveType: 'PRD',
      targetDays: prdTarget,
      expectedDays: expected.prdExpected,
    });
  }

  // PH（只對 public_holiday_type='PH' 的員工）
  const details = employmentDetails[user.id];
  if (details?.public_holiday_type === 'PH') {
    const phUserInputCount = getExistingRecordCount(user.id, 'PH', year, month, leaveRecords, false);
    const phTarget = Math.max(0, expected.phExpected - phUserInputCount);
    if (phTarget > 0) {
      plans.push({
        leaveType: 'PH',
        targetDays: phTarget,
        expectedDays: expected.phExpected,
      });
    }
  }

  return plans;
}

function placeLeavesForUser(
  user: UserProfile,
  plans: LeaveTypePlan[],
  candidateDates: string[],
  state: PlanState,
  input: AutoLeavePlanInput,
  placements: AutoLeavePlacement[],
  skipped: AutoLeaveSkipped[],
): void {
  const { employmentDetails, publicHolidays } = input;

  for (const plan of plans) {
    // targetDays 已由 buildLeaveTypePlans 扣減 user-input，直接排即可
    let remaining = plan.targetDays;

    if (remaining <= 0) continue;

    const dailyHours = getDailyContractHours(employmentDetails[user.id]) ?? 8;

    // 按盈餘排序：優先最充裕的日子
    const scoredDates = candidateDates
      .filter((date) => canPlaceLeave(user, date, state))
      .map((date) => {
        const row = getUserPositionComplianceRow(state.complianceByDate.get(date)!, user);
        const surplus = row ? row.actualHours - row.requiredHours : 0;
        return { date, surplus, row };
      })
      .sort((a, b) => b.surplus - a.surplus);

    let placed = 0;
    let capacityInsufficient = false;

    for (const { date, row } of scoredDates) {
      if (remaining <= 0) break;
      if (!row) continue;

      // 工時：放假後該職位仍達標
      if (row.actualHours - row.requiredHours < dailyHours) {
        capacityInsufficient = true;
        continue;
      }

      // 特定鐘點：放假後該職位仍達標（保守扣減 1 人）
      if (
        row.hasSpecificSlotRequirement &&
        row.actualSpecificHeadcount - 1 < row.requiredSpecificHeadcount
      ) {
        capacityInsufficient = true;
        continue;
      }

      let referencePublicHolidayId: string | undefined;
      let holidayName: string | undefined;

      if (plan.leaveType === 'PH') {
        const holidays = getEligibleHolidays(user.id, date, publicHolidays, input.leaveRecords);
        if (holidays.length === 0) continue;
        referencePublicHolidayId = holidays[0].id;
        holidayName = holidays[0].name;
      }

      placements.push({
        userId: user.id,
        userName: user.name_zh,
        date,
        leaveType: plan.leaveType,
        referencePublicHolidayId,
        holidayName,
      });

      applyLeavePlacement(user, date, state, employmentDetails);
      placed++;
      remaining--;
    }

    if (remaining > 0) {
      skipped.push({
        userId: user.id,
        userName: user.name_zh,
        leaveType: plan.leaveType,
        remainingDays: remaining,
        reason: scoredDates.length === 0 ? 'no_eligible_day' : 'insufficient_capacity',
      });
    }
  }
}

export function generateAutoLeavePlan(input: AutoLeavePlanInput): AutoLeavePlan {
  const {
    year,
    month,
    users,
    employmentDetails,
    leaveRecords,
    shiftAssignments,
    publicHolidays,
    requiredHours,
    requiredHourly,
    specificHours,
    getUserBalances,
  } = input;

  const todayStr = getHkTodayString();
  const candidateDates = getCandidateDates(year, month, todayStr);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 預算每日合規狀態快照
  const state: PlanState = {
    complianceByDate: new Map(),
    unavailableByDate: new Map(),
    assignedByDate: new Map(),
  };

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d);
    const compliance = buildPreScheduleDailyCompliance(
      dateStr,
      requiredHours,
      requiredHourly,
      specificHours,
      users,
      employmentDetails,
      leaveRecords,
    );
    state.complianceByDate.set(dateStr, cloneCompliance(compliance));
  }

  // 標記已存在預排記錄的員工為不可用
  for (const record of leaveRecords) {
    if (!isDateInTargetMonth(record.leave_date, year, month)) continue;
    if (!state.unavailableByDate.has(record.leave_date)) {
      state.unavailableByDate.set(record.leave_date, new Set());
    }
    state.unavailableByDate.get(record.leave_date)!.add(record.user_id);
  }

  // 標記已有排班班次的員工
  for (const a of shiftAssignments) {
    if (!isDateInTargetMonth(a.work_date, year, month)) continue;
    if (!state.assignedByDate.has(a.work_date)) {
      state.assignedByDate.set(a.work_date, new Set());
    }
    state.assignedByDate.get(a.work_date)!.add(a.user_id);
  }

  const placements: AutoLeavePlacement[] = [];
  const skipped: AutoLeaveSkipped[] = [];

  // 按員工處理；職位過濾後的名單即為 users
  for (const user of users) {
    // 跳過兼職
    if (user.employment_type === '兼職') continue;

    if (!getUserBalances(user.id)) continue;

    const details = employmentDetails[user.id];
    const expected = getRosterExpectedCounts(
      details?.weekly_work_days ?? null,
      publicHolidays,
      year,
      month,
      details?.rest_day_start_date,
      user.resignation_date,
    );

    const plans = buildLeaveTypePlans(user, year, month, leaveRecords, expected, employmentDetails);
    if (plans.length === 0) continue;

    placeLeavesForUser(user, plans, candidateDates, state, input, placements, skipped);
  }

  // 待調整：當月內與班次衝突的預排（仍要職員上班不代表衝突已解決，衝突根源仍存在）
  const pendingAdjustments: AutoLeavePendingAdjustment[] = [];
  for (const record of leaveRecords) {
    if (record.record_type !== 'leave' || !record.leave_type) continue;
    if (!isDateInTargetMonth(record.leave_date, year, month)) continue;
    const hasShift = shiftAssignments.some(
      (a) => a.user_id === record.user_id && a.work_date === record.leave_date,
    );
    if (hasShift) {
      pendingAdjustments.push({
        userId: record.user_id,
        userName: users.find((u) => u.id === record.user_id)?.name_zh ?? record.user_id,
        date: record.leave_date,
        leaveType: record.leave_type,
      });
    }
  }

  // warnings：某員工某假別當月總預排（user-input + 新排）> 當月收穫量
  const warnings: AutoLeaveWarning[] = [];
  const newPlacementsByUserType = new Map<string, Map<'DO' | 'PRD' | 'PH', number>>();
  for (const p of placements) {
    const byType = newPlacementsByUserType.get(p.userId) || new Map<'DO' | 'PRD' | 'PH', number>();
    byType.set(p.leaveType, (byType.get(p.leaveType) || 0) + 1);
    newPlacementsByUserType.set(p.userId, byType);
  }

  for (const user of users) {
    if (user.employment_type === '兼職') continue;
    const details = employmentDetails[user.id];
    const expected = getRosterExpectedCounts(
      details?.weekly_work_days ?? null,
      publicHolidays,
      year,
      month,
      details?.rest_day_start_date,
      user.resignation_date,
    );

    for (const leaveType of ['DO', 'PRD', 'PH'] as const) {
      if (leaveType === 'PH' && details?.public_holiday_type !== 'PH') continue;
      const userInputCount = getExistingRecordCount(user.id, leaveType, year, month, leaveRecords, false);
      const newCount = newPlacementsByUserType.get(user.id)?.get(leaveType) || 0;
      const totalPlanned = userInputCount + newCount;
      const expectedDays =
        leaveType === 'DO' ? expected.doExpected : leaveType === 'PRD' ? expected.prdExpected : expected.phExpected;

      if (totalPlanned > expectedDays) {
        warnings.push({
          userId: user.id,
          userName: user.name_zh,
          leaveType,
          plannedDays: totalPlanned,
          expectedDays,
        });
      }
    }
  }

  return { placements, warnings, skipped, pendingAdjustments };
}
