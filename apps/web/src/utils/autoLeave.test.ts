import { describe, it, expect, vi } from 'vitest';
import { generateAutoLeavePlan, getHkTodayString, type UserMonthlyBalances } from './autoLeave';
import type { UserProfile, UserEmploymentDetails, UserLeaveRecord, PublicHoliday, UserShiftAssignment } from '@care-suite/shared';
import { DEFAULT_SPECIFIC_HOURS_CONFIG } from './facilityNatureSettings';

const baseUser: UserProfile = {
  id: 'user-1',
  username: 'test-user',
  name_zh: '測試員工',
  name_en: null,
  id_number: null,
  date_of_birth: null,
  department: '護理',
  nursing_position: '註冊護士',
  allied_health_position: null,
  hygiene_position: null,
  other_position: null,
  employment_type: '正職',
  monthly_hour_limit: null,
  role: 'staff',
  secondary_positions: [],
  auth_user_id: null,
  login_qr_code_id: 'qr-1',
  avatar_url: null,
  hire_date: '2026-01-01',
  resignation_date: null,
  is_active: true,
  created_by: null,
  created_at: '',
  updated_at: '',
};

const baseEmployment: UserEmploymentDetails = {
  id: 'emp-1',
  user_id: 'user-1',
  work_pattern: null,
  weekly_contract_hours: null,
  daily_contract_hours: 8,
  default_work_start_time: null,
  weekly_work_days: 5,
  hours_balance: 0,
  rest_day_fraction: 0,
  accumulated_rest_days: 0,
  rest_day_start_date: '2026-01-01',
  annual_leave_days_per_year: 0,
  annual_leave_start_date: null,
  public_holiday_type: 'PH',
  public_holiday_start_date: '2026-01-01',
  preferred_station_primary: null,
  preferred_station_secondary: [],
  stations_forbidden: [],
  created_at: '',
  updated_at: '',
};

function makeInput(
  overrides: {
    users?: UserProfile[];
    employmentDetails?: Record<string, UserEmploymentDetails>;
    leaveRecords?: UserLeaveRecord[];
    shiftAssignments?: UserShiftAssignment[];
    publicHolidays?: PublicHoliday[];
    requiredHours?: Record<string, number>;
    requiredHourly?: Record<string, number[]>;
    getUserBalances?: (userId: string) => UserMonthlyBalances | null;
    year?: number;
    month?: number;
  } = {},
) {
  const year = overrides.year ?? 2026;
  const month = overrides.month ?? 8;
  const requiredHourly: Record<string, number[]> = {};
  for (const pos of ['主管', '註冊/登記護士', '保健員', '護理員', '助理員', '物理治療師', '任何員工']) {
    requiredHourly[pos] = new Array(24).fill(0);
  }

  return {
    year,
    month,
    users: [baseUser],
    employmentDetails: { 'user-1': baseEmployment },
    leaveRecords: [] as UserLeaveRecord[],
    shiftAssignments: [] as UserShiftAssignment[],
    publicHolidays: [] as PublicHoliday[],
    requiredHours: { '註冊/登記護士': 8 },
    requiredHourly,
    specificHours: DEFAULT_SPECIFIC_HOURS_CONFIG,
    getUserBalances: () => ({
      doBalance: 0,
      doAccumulated: 0,
      doEstimated: 0,
      restDayFraction: 0,
      prdExpected: 0,
      prdEstimated: 0,
      phAvailable: 0,
      phAccumulated: 0,
      phEstimated: 0,
      shAvailable: 0,
      shAccumulated: 0,
      shEstimated: 0,
      alBalance: 0,
      alAccumulated: 0,
      alEstimated: 0,
      whb: 0,
    }),
    ...overrides,
  };
}

const baseRecord = (overrides: Partial<UserLeaveRecord>): UserLeaveRecord => ({
  id: `rec-${Math.random().toString(36).slice(2)}`,
  user_id: 'user-1',
  leave_date: '2026-08-10',
  record_type: 'leave',
  leave_type: 'DO',
  reference_public_holiday_id: null,
  urgency: 'mandatory',
  availability_start_time: null,
  availability_end_time: null,
  is_overridden: false,
  overridden_by: null,
  overridden_at: null,
  remark: null,
  created_at: '',
  updated_at: '',
  is_auto: false,
  ...overrides,
});

describe('generateAutoLeavePlan', () => {
  it('跳過兼職員工', () => {
    const partTime = { ...baseUser, employment_type: '兼職' as const };
    const input = makeInput({
      users: [partTime],
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        doEstimated: 4,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.placements).toHaveLength(0);
    expect(plan.skipped).toHaveLength(0);
  });

  it('有 DO 預計收穫時優先排在最充裕的星期日', () => {
    // 2026-09 每周工作 6 天 => 當月 DO 預計收穫 4 天（9 月有 4 個星期日）
    const input = makeInput({
      year: 2026,
      month: 9,
      requiredHours: { '註冊/登記護士': 0 },
      employmentDetails: {
        'user-1': { ...baseEmployment, weekly_work_days: 6 },
      },
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        doEstimated: 4,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.placements).toHaveLength(4);
    expect(plan.placements.every((p) => p.leaveType === 'DO')).toBe(true);
    expect(plan.placements.every((p) => p.date >= getHkTodayString())).toBe(true);
  });

  it('不覆蓋用戶輸入的預排', () => {
    // 2026-09 每周工作 6 天 => DO 預計收穫 4 天；用戶已手動排 1 天，工具應再排 3 天
    const input = makeInput({
      year: 2026,
      month: 9,
      requiredHours: { '註冊/登記護士': 0 },
      employmentDetails: {
        'user-1': { ...baseEmployment, weekly_work_days: 6 },
      },
      leaveRecords: [
        baseRecord({ leave_date: '2026-09-06', is_auto: false }),
      ],
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        doBalance: 0,
        doEstimated: 4,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.placements).toHaveLength(3);
    expect(plan.placements.every((p) => p.date !== '2026-09-06')).toBe(true);
  });

  it('is_auto 記錄不影響目標天數，但會佔用日期', () => {
    // 2026-09 每周工作 6 天 => DO 預計收穫 4 天；舊 is_auto 已佔 1 天，仍會再排 4 天
    const input = makeInput({
      year: 2026,
      month: 9,
      requiredHours: { '註冊/登記護士': 0 },
      employmentDetails: {
        'user-1': { ...baseEmployment, weekly_work_days: 6 },
      },
      leaveRecords: [
        baseRecord({ leave_date: '2026-09-06', is_auto: true }),
      ],
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        doBalance: 0,
        doEstimated: 4,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.placements).toHaveLength(4);
    expect(plan.placements.every((p) => p.date !== '2026-09-06')).toBe(true);
  });

  it('跳過已有排班的日期', () => {
    // 2026-09 每周工作 6 天 => DO 預計收穫 4 天；9/6 已有排班，應排其餘 4 天
    const input = makeInput({
      year: 2026,
      month: 9,
      requiredHours: { '註冊/登記護士': 0 },
      employmentDetails: {
        'user-1': { ...baseEmployment, weekly_work_days: 6 },
      },
      shiftAssignments: [
        {
          id: 'shift-1',
          user_id: 'user-1',
          work_date: '2026-09-06',
          station_id: null,
          position: '註冊護士',
          shift_name: '早班',
          start_time: '07:00',
          end_time: '15:00',
          created_by: null,
          created_at: '',
          updated_at: '',
        },
      ],
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        doEstimated: 4,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.placements).toHaveLength(4);
    expect(plan.placements.every((p) => p.date !== '2026-09-06')).toBe(true);
  });

  it('工時不足時不排假', () => {
    // 每天 requiredHours=16，只有 1 名員工 daily=8，actual=8，放假後剩 0 < 16
    const input = makeInput({
      requiredHours: { '註冊/登記護士': 16 },
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        doEstimated: 1,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.placements).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].reason).toBe('insufficient_capacity');
  });

  it('PH 員工可排公眾假期，並選定 reference_public_holiday_id', () => {
    const holiday: PublicHoliday = {
      id: 'ph-1',
      holiday_date: '2026-09-10',
      name: '中秋節翌日',
      type: 'PH',
      created_by: null,
      created_at: '',
      updated_at: '',
    };
    const input = makeInput({
      year: 2026,
      month: 9,
      requiredHours: { '註冊/登記護士': 0 },
      employmentDetails: {
        'user-1': { ...baseEmployment, weekly_work_days: 7, public_holiday_type: 'PH' },
      },
      publicHolidays: [holiday],
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        phAvailable: 0,
        phEstimated: 1,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    const phPlacements = plan.placements.filter((p) => p.leaveType === 'PH');
    expect(phPlacements).toHaveLength(1);
    expect(phPlacements[0].referencePublicHolidayId).toBe('ph-1');
  });

  it('SH 員工不排 PH', () => {
    const holiday: PublicHoliday = {
      id: 'ph-1',
      holiday_date: '2026-09-10',
      name: '中秋節翌日',
      type: 'PH',
      created_by: null,
      created_at: '',
      updated_at: '',
    };
    const input = makeInput({
      year: 2026,
      month: 9,
      users: [{ ...baseUser, id: 'user-1' }],
      employmentDetails: {
        'user-1': { ...baseEmployment, weekly_work_days: 7, public_holiday_type: 'SH' },
      },
      requiredHours: { '註冊/登記護士': 0 },
      publicHolidays: [holiday],
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        phAvailable: 0,
        phEstimated: 1,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.placements).toHaveLength(0);
  });

  it('當月總預排超過收穫量時產生 warning', () => {
    // 使用 2026-09（候選日充足），每周工作 6 天 => 當月 DO 收穫 4 天；
    // 用戶已手動排 6 天，超過當月收穫，規劃器不會再新增，只發 warning
    const input = makeInput({
      year: 2026,
      month: 9,
      requiredHours: { '註冊/登記護士': 0 },
      employmentDetails: {
        'user-1': { ...baseEmployment, weekly_work_days: 6 },
      },
      leaveRecords: Array.from({ length: 6 }, (_, i) =>
        baseRecord({ leave_date: `2026-09-${6 + i}`, is_auto: false }),
      ),
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        doBalance: 0,
        doEstimated: 0,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.placements).toHaveLength(0);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0].leaveType).toBe('DO');
    expect(plan.warnings[0].plannedDays).toBe(6);
    expect(plan.warnings[0].expectedDays).toBe(4);
  });

  it('PRD 按當月預計收穫排假', () => {
    // 2026-09 每周工作 5.5 天 => DO 預計收穫 4 天，PRD 預計收穫 2 天
    const input = makeInput({
      year: 2026,
      month: 9,
      requiredHours: { '註冊/登記護士': 0 },
      employmentDetails: {
        'user-1': { ...baseEmployment, weekly_work_days: 5.5 },
      },
      getUserBalances: () => ({
        ...makeInput().getUserBalances('user-1')!,
        restDayFraction: 1.5,
        prdEstimated: 2,
      }),
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.placements.filter((p) => p.leaveType === 'PRD')).toHaveLength(2);
  });

  it('列出與班次衝突且未覆蓋的預排作為待調整', () => {
    const input = makeInput({
      year: 2026,
      month: 8,
      leaveRecords: [baseRecord({ leave_date: '2026-08-10', is_overridden: false })],
      shiftAssignments: [
        {
          id: 'shift-1',
          user_id: 'user-1',
          work_date: '2026-08-10',
          station_id: null,
          position: '註冊護士',
          shift_name: '早班',
          start_time: '07:00',
          end_time: '15:00',
          created_by: null,
          created_at: '',
          updated_at: '',
        },
      ],
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.pendingAdjustments).toHaveLength(1);
    expect(plan.pendingAdjustments[0].date).toBe('2026-08-10');
    expect(plan.pendingAdjustments[0].leaveType).toBe('DO');
    expect(plan.pendingAdjustments[0].userName).toBe('測試員工');
  });

  it('已覆蓋的衝突預排不會列入待調整', () => {
    const input = makeInput({
      year: 2026,
      month: 8,
      leaveRecords: [baseRecord({ leave_date: '2026-08-10', is_overridden: true })],
      shiftAssignments: [
        {
          id: 'shift-1',
          user_id: 'user-1',
          work_date: '2026-08-10',
          station_id: null,
          position: '註冊護士',
          shift_name: '早班',
          start_time: '07:00',
          end_time: '15:00',
          created_by: null,
          created_at: '',
          updated_at: '',
        },
      ],
    });
    const plan = generateAutoLeavePlan(input);
    expect(plan.pendingAdjustments).toHaveLength(0);
  });
});
