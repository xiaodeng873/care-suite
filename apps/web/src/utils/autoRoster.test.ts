import { describe, it, expect } from 'vitest';
import { generateAutoRoster } from './autoRoster';
import type { UserProfile, UserEmploymentDetails, UserShiftAssignment, StationShiftSetting } from '@care-suite/shared';
import type { SpecificHoursConfig } from './facilityNatureSettings';
import type { StaffingResult } from './staffingRequirements';

const specific: SpecificHoursConfig = {
  requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
  requirement3: { start: '07:00', end: '20:00' },
  assistantWindow: { start: '07:00', end: '18:00' },
};

const staffingResult: StaffingResult = {
  grid: Array.from({ length: 24 }, () => [0, 0, 0, 0, 0, 0, 0]),
  dailySummaries: [],
};
// 護理員 07:00-17:00 需要 1 人
for (let h = 7; h < 17; h++) staffingResult.grid[h][3] = 1;

const user: UserProfile = {
  id: 'u1',
  username: 'u1',
  name_zh: '張護理',
  name_en: null,
  email: null,
  role: 'staff',
  is_active: true,
  avatar_url: null,
  id_number: null,
  date_of_birth: null,
  phone: null,
  department: 'nursing',
  nursing_position: '護理員',
  allied_health_position: null,
  hygiene_position: null,
  other_position: null,
  secondary_positions: [],
  hire_date: '',
  employment_type: '正職',
  monthly_hour_limit: null,
  auth_user_id: null,
  login_qr_code_id: '',
  created_by: null,
  created_at: '',
  updated_at: '',
} as unknown as UserProfile;

const details: UserEmploymentDetails = {
  id: 'd1',
  user_id: 'u1',
  work_pattern: null,
  daily_contract_hours: 8,
  default_work_start_time: null,
  weekly_contract_hours: null,
  weekly_work_days: 5,
  hours_balance: 0,
  rest_day_fraction: 0,
  accumulated_rest_days: 0,
  rest_day_start_date: null,
  annual_leave_days_per_year: 0,
  annual_leave_start_date: null,
  public_holiday_type: 'PH',
  created_at: '',
  updated_at: '',
} as unknown as UserEmploymentDetails;

const shiftSetting: StationShiftSetting = {
  id: 's1',
  station_id: 'station-1',
  position: null,
  shift_name: '早班',
  start_time: '07:00',
  is_active: true,
  sort_order: 1,
  created_at: '',
  updated_at: '',
};

describe('generateAutoRoster', () => {
  it(' inserts a nurse when there is a specific-slot shortfall', () => {
    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [user],
      employmentDetails: { u1: details },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [shiftSetting],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult,
      specific,
    });

    expect(result.insertions.length).toBe(1);
    expect(result.insertions[0]).toMatchObject({
      user_id: 'u1',
      station_id: 'station-1',
      shift_name: '早班',
      start_time: '07:00',
    });
    // 護理員 07:00-15:00 只覆蓋 07:00-15:00，15:00-17:00 仍有 2 小時缺口
    expect(result.finalDeficit).toBe(2);
  });

  it('inserts admin staff through merged admin tab using assistant-slot requirement', () => {
    const adminUser: UserProfile = {
      ...user,
      id: 'u2',
      username: 'u2',
      name_zh: '張文員',
      nursing_position: null,
      other_position: '文員',
      department: '行政',
    } as unknown as UserProfile;
    const adminDetails: UserEmploymentDetails = { ...details, user_id: 'u2', id: 'd2', daily_contract_hours: 11 } as unknown as UserEmploymentDetails;
    const adminShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's2',
      position: '行政',
    } as unknown as StationShiftSetting;
    const adminStaffing: StaffingResult = {
      grid: Array.from({ length: 24 }, () => [0, 0, 0, 0, 0, 0, 0]),
      dailySummaries: [],
    };
    for (let h = 7; h < 18; h++) adminStaffing.grid[h][4] = 1; // 助理員 07-18 需要 1 人

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '行政',
      users: [adminUser],
      employmentDetails: { u2: adminDetails },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [adminShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '助理員', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult: adminStaffing,
      specific,
    });

    expect(result.insertions.length).toBe(1);
    expect(result.insertions[0]).toMatchObject({
      user_id: 'u2',
      station_id: 'station-1',
      shift_name: '早班',
      start_time: '07:00',
      position: '行政',
    });
    expect(result.finalDeficit).toBe(0);
  });

  it('inserts nurses and health workers through merged nurse/health worker tab', () => {
    const rn: UserProfile = {
      ...user,
      id: 'u3',
      username: 'u3',
      name_zh: '張護士',
      nursing_position: '註冊護士',
      other_position: null,
      department: 'nursing',
    } as unknown as UserProfile;
    const hw: UserProfile = {
      ...user,
      id: 'u4',
      username: 'u4',
      name_zh: '張保健',
      nursing_position: '保健員',
      other_position: null,
      department: 'nursing',
    } as unknown as UserProfile;
    const rnDetails: UserEmploymentDetails = { ...details, user_id: 'u3', id: 'd3', daily_contract_hours: 13 } as unknown as UserEmploymentDetails;
    const hwDetails: UserEmploymentDetails = { ...details, user_id: 'u4', id: 'd4', daily_contract_hours: 13 } as unknown as UserEmploymentDetails;
    const mergedShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's3',
      position: '護士/保健員',
    } as unknown as StationShiftSetting;
    const mergedStaffing: StaffingResult = {
      grid: Array.from({ length: 24 }, () => [0, 0, 0, 0, 0, 0, 0]),
      dailySummaries: [],
    };
    for (let h = 7; h < 20; h++) {
      mergedStaffing.grid[h][1] = 1; // 註冊/登記護士 07-20 需要 1 人
      mergedStaffing.grid[h][2] = 1; // 保健員 07-20 需要 1 人
    }

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護士/保健員',
      users: [rn, hw],
      employmentDetails: { u3: rnDetails, u4: hwDetails },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [mergedShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '註冊/登記護士', hours: 8, peakHeadcount: 1 },
        { position: '保健員', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult: mergedStaffing,
      specific,
    });

    expect(result.insertions.length).toBe(2);
    const userIds = result.insertions.map((i) => i.user_id).sort();
    expect(userIds).toEqual(['u3', 'u4']);
    expect(result.finalDeficit).toBe(0);
  });

  it('uses station preference as tie-breaker when shifts are equally valuable', () => {
    const aShift: StationShiftSetting = {
      ...shiftSetting,
      id: 'sA',
      station_id: 'station-a',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const bShift: StationShiftSetting = {
      ...shiftSetting,
      id: 'sB',
      station_id: 'station-b',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [user],
      employmentDetails: { u1: details },
      stations: [
        { id: 'station-a', name: 'A區' },
        { id: 'station-b', name: 'B區' },
      ],
      stationPriority: ['station-a', 'station-b', null],
      shiftSettings: [aShift, bShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult,
      specific,
    });

    expect(result.insertions.length).toBe(1);
    expect(result.insertions[0]).toMatchObject({
      station_id: 'station-a',
      shift_name: '早班',
      start_time: '07:00',
    });
  });

  it('respects mandatory specific working time window', () => {
    const withinWindowShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-morning',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const outsideWindowShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-afternoon',
      shift_name: '午班',
      start_time: '13:00',
    } as unknown as StationShiftSetting;
    const userWithDefaultStart: UserProfile = {
      ...user,
      id: 'u1',
    } as unknown as UserProfile;
    const detailsWithDefaultStart: UserEmploymentDetails = {
      ...details,
      user_id: 'u1',
      id: 'd1',
      daily_contract_hours: 8,
      default_work_start_time: '07:00',
    } as unknown as UserEmploymentDetails;

    // 08:00-16:00 落在 07:00-15:00 窗口內，可排班
    const withinResult = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [userWithDefaultStart],
      employmentDetails: { u1: detailsWithDefaultStart },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [withinWindowShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult,
      specific,
    });
    expect(withinResult.insertions.length).toBe(1);
    expect(withinResult.insertions[0]).toMatchObject({
      shift_name: '早班',
      start_time: '07:00',
    });

    // 13:00-21:00 超出 07:00-15:00 窗口，不可排班
    const outsideResult = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [userWithDefaultStart],
      employmentDetails: { u1: detailsWithDefaultStart },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [outsideWindowShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult,
      specific,
    });
    expect(outsideResult.insertions.length).toBe(0);
  });

  it('places a night worker whose specific working time window crosses midnight', () => {
    // 特定上班時間 21:00、每日 9 小時（窗口 21:00-06:00 跨午夜）；
    // 排班日以 07:00 為起點，跨午夜不應令窗口判定失效
    const nightShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-night',
      shift_name: '晚班',
      start_time: '21:00',
    } as unknown as StationShiftSetting;
    const nightDetails: UserEmploymentDetails = {
      ...details,
      daily_contract_hours: 9,
      default_work_start_time: '21:00',
    } as unknown as UserEmploymentDetails;

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [user],
      employmentDetails: { u1: nightDetails },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [nightShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 9, peakHeadcount: 1 },
      ],
      staffingResult,
      specific,
    });

    expect(result.insertions.length).toBe(1);
    expect(result.insertions[0]).toMatchObject({
      user_id: 'u1',
      shift_name: '晚班',
      start_time: '21:00',
    });
  });

  it('places a night worker into an overlapping night shift using her own window time', () => {
    // 半門檻：特定上班時間 21:00、每日 9 小時（窗口 21:00-06:00），
    // 晚班設定 22:00 開始，重疊 8/9 小時 ≥ 一半 → 排入晚班桶，卡片用她自己的 21:00
    const nightShift22: StationShiftSetting = {
      ...shiftSetting,
      id: 's-night-22',
      shift_name: '晚班',
      start_time: '22:00',
    } as unknown as StationShiftSetting;
    const nightDetails: UserEmploymentDetails = {
      ...details,
      daily_contract_hours: 9,
      default_work_start_time: '21:00',
    } as unknown as UserEmploymentDetails;

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [user],
      employmentDetails: { u1: nightDetails },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [nightShift22],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 9, peakHeadcount: 1 },
      ],
      staffingResult,
      specific,
    });

    expect(result.insertions.length).toBe(1);
    expect(result.insertions[0]).toMatchObject({
      user_id: 'u1',
      shift_name: '晚班',
      start_time: '21:00',
    });
  });

  it('assigns a mid-shift worker to the bucket with the most overlap', () => {
    // 窗口 11:00-20:00（9 小時）：對早班（07:00 起）重疊 5h、對午班（13:00 起）重疊 7h，
    // 兩者都過半 → 歸重疊最多的午班，卡片時間仍是 11:00
    const morningShift9: StationShiftSetting = {
      ...shiftSetting,
      id: 's-morning-9',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const afternoonShift9: StationShiftSetting = {
      ...shiftSetting,
      id: 's-afternoon-9',
      shift_name: '午班',
      start_time: '13:00',
      sort_order: 2,
    } as unknown as StationShiftSetting;
    const midDetails: UserEmploymentDetails = {
      ...details,
      daily_contract_hours: 9,
      default_work_start_time: '11:00',
    } as unknown as UserEmploymentDetails;

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [user],
      employmentDetails: { u1: midDetails },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [morningShift9, afternoonShift9],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 9, peakHeadcount: 1 },
      ],
      staffingResult,
      specific,
    });

    expect(result.insertions.length).toBe(1);
    expect(result.insertions[0]).toMatchObject({
      user_id: 'u1',
      shift_name: '午班',
      start_time: '11:00',
    });
  });

  it('does not insert a user already assigned on the date', () => {
    const existing: UserShiftAssignment = {
      id: 'a1',
      user_id: 'u1',
      work_date: '2026-08-02',
      station_id: 'station-1',
      position: '護理員',
      shift_name: '早班',
      start_time: '07:00',
      end_time: '15:00',
      created_by: null,
      created_at: '',
      updated_at: '',
    };
    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [user],
      employmentDetails: { u1: details },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [shiftSetting],
      existingAssignments: [existing],
      dailyRequirements: [
        { position: '護理員', hours: 16, peakHeadcount: 2 },
      ],
      staffingResult,
      specific,
    });

    expect(result.insertions.length).toBe(0);
    expect(result.finalDeficit).toBeGreaterThan(0);
  });

  it('falls back no-preference users to the first station with shifts when unassigned zone has none', () => {
    const aShift: StationShiftSetting = {
      ...shiftSetting,
      id: 'sA',
      station_id: 'station-a',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const bShift: StationShiftSetting = {
      ...shiftSetting,
      id: 'sB',
      station_id: 'station-b',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const nurse2: UserProfile = {
      ...user,
      id: 'u2',
      username: 'u2',
      name_zh: '李護理',
    } as unknown as UserProfile;
    const details2: UserEmploymentDetails = {
      ...details,
      user_id: 'u2',
      id: 'd2',
    } as unknown as UserEmploymentDetails;

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [user, nurse2],
      employmentDetails: { u1: details, u2: details2 },
      stations: [
        { id: 'station-a', name: 'A區' },
        { id: 'station-b', name: 'B區' },
      ],
      stationPriority: ['station-a', 'station-b', null],
      shiftSettings: [aShift, bShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 16, peakHeadcount: 2 },
      ],
      staffingResult,
      specific,
    });

    expect(result.insertions.length).toBe(2);
    expect(result.insertions.every((i) => i.station_id === 'station-a')).toBe(true);
    expect(result.insertions.every((i) => i.shift_name === '早班')).toBe(true);
    expect(result.insertions.some((i) => i.station_id === null)).toBe(false);
  });

  it('prefers morning shift over evening shift for specific-hours coverage (hourly indexing regression)', () => {
    const morningShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-morning',
      station_id: 'station-a',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const eveningShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-evening',
      station_id: 'station-a',
      shift_name: '晚班',
      start_time: '22:00',
      sort_order: 2,
    } as unknown as StationShiftSetting;
    // 護理員 07:00-17:00 需要 1 人，工時需要 8 小時
    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [user],
      employmentDetails: { u1: details },
      stations: [{ id: 'station-a', name: 'A區' }],
      shiftSettings: [morningShift, eveningShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult,
      specific,
    });

    // 早班覆蓋 07:00-15:00 的特定鐘點，晚班完全不覆蓋；早班分數必須更高
    expect(result.insertions.length).toBe(1);
    expect(result.insertions[0]).toMatchObject({
      shift_name: '早班',
      start_time: '07:00',
    });
    expect(result.finalDeficit).toBeLessThan(result.initialDeficit);
  });

  it('places excess full-time staff into in-window shifts, not the unassigned-zone night shift', () => {
    // 重現 2026-08-09 的情況：達標後多餘人手被塞進未分區晚班（窗口外）
    const morningShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-morning',
      station_id: 'station-a',
      position: '護士/保健員',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const afternoonShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-afternoon',
      station_id: 'station-a',
      position: '護士/保健員',
      shift_name: '午班',
      start_time: '13:00',
      sort_order: 2,
    } as unknown as StationShiftSetting;
    const nightShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-night',
      station_id: null,
      position: '護士/保健員',
      shift_name: '晚班',
      start_time: '22:00',
      sort_order: 3,
    } as unknown as StationShiftSetting;
    const mkNurse = (id: string): UserProfile => ({
      ...user,
      id,
      username: id,
      name_zh: `護士${id}`,
      nursing_position: '註冊護士',
    }) as unknown as UserProfile;
    const mkDetails = (id: string): UserEmploymentDetails => ({
      ...details,
      id: `d-${id}`,
      user_id: id,
    }) as unknown as UserEmploymentDetails;
    // 註冊/登記護士 07:00-20:00 需要 1 人、工時 8 小時；兩名 RN 已足夠達標
    const nurseStaffing: StaffingResult = {
      grid: Array.from({ length: 24 }, () => [0, 0, 0, 0, 0, 0, 0]),
      dailySummaries: [],
    };
    for (let h = 7; h < 20; h++) nurseStaffing.grid[h][1] = 1;

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護士/保健員',
      users: [mkNurse('r1'), mkNurse('r2'), mkNurse('r3')],
      employmentDetails: { r1: mkDetails('r1'), r2: mkDetails('r2'), r3: mkDetails('r3') },
      stations: [{ id: 'station-a', name: 'A區' }],
      stationPriority: ['station-a', null],
      shiftSettings: [morningShift, afternoonShift, nightShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '註冊/登記護士', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult: nurseStaffing,
      specific,
    });

    // 三人都要上班，但第三人是多餘人手：必須排入窗口內班次，不能塞去未分區晚班
    expect(result.insertions.length).toBe(3);
    expect(result.insertions.every((i) => i.station_id === 'station-a')).toBe(true);
    expect(result.insertions.some((i) => i.shift_name === '晚班')).toBe(false);
  });

  it('never dumps staff into the unassigned-zone night shift while requirements are still unmet', () => {
    // 工時目標未達標時，晚班與早班對工時同分；舊邏輯 tie-break 落到居住區偏好，
    // 把未達標所需的人手塞去未分區晚班（窗口外）
    const morningShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-morning',
      station_id: 'station-a',
      position: '護士/保健員',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const afternoonShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-afternoon',
      station_id: 'station-a',
      position: '護士/保健員',
      shift_name: '午班',
      start_time: '13:00',
      sort_order: 2,
    } as unknown as StationShiftSetting;
    const nightShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-night',
      station_id: null,
      position: '護士/保健員',
      shift_name: '晚班',
      start_time: '22:00',
      sort_order: 3,
    } as unknown as StationShiftSetting;
    const mkNurse = (id: string): UserProfile => ({
      ...user,
      id,
      username: id,
      name_zh: `護士${id}`,
      nursing_position: '註冊護士',
    }) as unknown as UserProfile;
    const mkDetails = (id: string): UserEmploymentDetails => ({
      ...details,
      id: `d-${id}`,
      user_id: id,
    }) as unknown as UserEmploymentDetails;
    // 護士 07:00-20:00 需要 1 人、工時需要 24 小時（三人才夠）
    const nurseStaffing: StaffingResult = {
      grid: Array.from({ length: 24 }, () => [0, 0, 0, 0, 0, 0, 0]),
      dailySummaries: [],
    };
    for (let h = 7; h < 20; h++) nurseStaffing.grid[h][1] = 1;

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護士/保健員',
      users: [mkNurse('r1'), mkNurse('r2'), mkNurse('r3')],
      employmentDetails: { r1: mkDetails('r1'), r2: mkDetails('r2'), r3: mkDetails('r3') },
      stations: [{ id: 'station-a', name: 'A區' }],
      stationPriority: ['station-a', null],
      shiftSettings: [morningShift, afternoonShift, nightShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '註冊/登記護士', hours: 24, peakHeadcount: 3 },
      ],
      staffingResult: nurseStaffing,
      specific,
    });

    // 三人都未達標前必須全部排入窗口內班次
    expect(result.insertions.length).toBe(3);
    expect(result.insertions.every((i) => i.station_id === 'station-a')).toBe(true);
    expect(result.insertions.some((i) => i.station_id === null)).toBe(false);
    expect(result.finalDeficit).toBe(0);
    // RN 07:00-18:00 累積當值必須達標
    const nurseRow = result.finalCompliance.find((r) => r.position === '註冊/登記護士')!;
    expect(nurseRow.specificSlotOk).toBe(true);
  });

  it('falls back to unassigned zone when all stations are forbidden', () => {
    const forbiddenShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-forbidden',
      station_id: 'station-a',
      position: '護士/保健員',
      shift_name: '早班',
      start_time: '07:00',
    } as unknown as StationShiftSetting;
    const unassignedShift: StationShiftSetting = {
      ...shiftSetting,
      id: 's-unassigned',
      station_id: null,
      position: '護士/保健員',
      shift_name: '早班',
      start_time: '07:00',
      sort_order: 2,
    } as unknown as StationShiftSetting;
    const nurse: UserProfile = {
      ...user,
      id: 'r1',
      username: 'r1',
      name_zh: '護士1',
      nursing_position: '註冊護士',
    } as unknown as UserProfile;
    const nurseDetails: UserEmploymentDetails = {
      ...details,
      id: 'd-r1',
      user_id: 'r1',
      stations_forbidden: ['station-a'],
    } as unknown as UserEmploymentDetails;

    const nurseStaffing: StaffingResult = {
      grid: Array.from({ length: 24 }, () => [0, 0, 0, 0, 0, 0, 0]),
      dailySummaries: [],
    };
    for (let h = 7; h < 20; h++) nurseStaffing.grid[h][1] = 1;

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護士/保健員',
      users: [nurse],
      employmentDetails: { r1: nurseDetails },
      stations: [{ id: 'station-a', name: 'A區' }],
      stationPriority: ['station-a', null],
      shiftSettings: [forbiddenShift, unassignedShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '註冊/登記護士', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult: nurseStaffing,
      specific,
    });

    expect(result.insertions.length).toBe(1);
    expect(result.insertions[0].station_id).toBeNull();
    expect(result.insertions[0].shift_name).toBe('早班');
  });

  describe('一鍵排班原則', () => {
    const makeHw = (id: string): UserProfile =>
      ({
        ...user,
        id,
        username: id,
        name_zh: `保健員${id}`,
        nursing_position: '保健員',
      }) as unknown as UserProfile;

    const makeHwDetails = (id: string, extra?: Partial<UserEmploymentDetails>): UserEmploymentDetails =>
      ({
        ...details,
        id: `d-${id}`,
        user_id: id,
        ...extra,
      }) as unknown as UserEmploymentDetails;

    const earlyShift = (stationId: string, minStaff = 0): StationShiftSetting => ({
      ...shiftSetting,
      id: `${stationId}-early`,
      station_id: stationId,
      shift_name: '早班',
      start_time: '07:00',
      min_staff: minStaff,
    });
    const lateShift = (stationId: string, minStaff = 0): StationShiftSetting => ({
      ...shiftSetting,
      id: `${stationId}-late`,
      station_id: stationId,
      shift_name: '午班',
      start_time: '14:00',
      min_staff: minStaff,
    });

    const zeroStaffing: StaffingResult = {
      grid: Array.from({ length: 24 }, () => [0, 0, 0, 0, 0, 0, 0]),
      dailySummaries: [],
    };

    const hwRequirement = [{ position: '保健員', hours: 8, peakHeadcount: 1 }];

    it('班次設定 min_staff：各居住區早班、午班補到最少人數', () => {
      const users = ['h1', 'h2', 'h3', 'h4'].map(makeHw);
      const result = generateAutoRoster({
        date: '2026-08-02',
        position: '護士/保健員',
        users,
        employmentDetails: Object.fromEntries(users.map((u) => [u.id, makeHwDetails(u.id)])),
        stations: [
          { id: 'station-1', name: 'A區' },
          { id: 'station-2', name: 'B區' },
        ],
        stationPriority: ['station-1', 'station-2', null],
        shiftSettings: [
          earlyShift('station-1', 1),
          lateShift('station-1', 1),
          earlyShift('station-2', 1),
          lateShift('station-2', 1),
        ],
        existingAssignments: [],
        dailyRequirements: hwRequirement,
        staffingResult: zeroStaffing,
        specific,
      });

      for (const stationId of ['station-1', 'station-2']) {
        for (const bucket of ['早班', '午班']) {
          const count = result.insertions.filter(
            (i) => i.station_id === stationId && i.shift_name === bucket,
          ).length;
          expect(count).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('原則2：早班最多 N 名，有餘攤到各區至各區平均，再有餘攤至午班各站', () => {
      const users = ['h1', 'h2', 'h3', 'h4'].map(makeHw);
      const result = generateAutoRoster({
        date: '2026-08-02',
        position: '護士/保健員',
        users,
        employmentDetails: Object.fromEntries(users.map((u) => [u.id, makeHwDetails(u.id)])),
        stations: [
          { id: 'station-1', name: 'A區' },
          { id: 'station-2', name: 'B區' },
        ],
        stationPriority: ['station-1', 'station-2', null],
        shiftSettings: [
          earlyShift('station-1'),
          lateShift('station-1'),
          earlyShift('station-2'),
          lateShift('station-2'),
        ],
        existingAssignments: [],
        dailyRequirements: hwRequirement,
        staffingResult: zeroStaffing,
        specific,
        principles: {
          earlyExtra: { enabled: true, n: 1 },
          ignoreStationPreference: false,
        },
      });

      // 早班每區上限 1：先各區早班補 1（各區平均），再有餘攤至午班各站 → 每區早 1 午 1
      for (const stationId of ['station-1', 'station-2']) {
        const early = result.insertions.filter(
          (i) => i.station_id === stationId && i.shift_name === '早班',
        ).length;
        const late = result.insertions.filter(
          (i) => i.station_id === stationId && i.shift_name === '午班',
        ).length;
        expect(early).toBe(1);
        expect(late).toBe(1);
      }
    });

    it('min_staff 約束輪仍尊重偏好居住區（原則3 未勾選時）', () => {
      const users = ['h1', 'h2', 'h3', 'h4'].map(makeHw);
      const detailsMap = {
        h1: makeHwDetails('h1', { preferred_station_primary: 'station-2' } as Partial<UserEmploymentDetails>),
        h2: makeHwDetails('h2', { preferred_station_primary: 'station-2' } as Partial<UserEmploymentDetails>),
        h3: makeHwDetails('h3', { preferred_station_primary: 'station-1' } as Partial<UserEmploymentDetails>),
        h4: makeHwDetails('h4', { preferred_station_primary: 'station-1' } as Partial<UserEmploymentDetails>),
      };
      const result = generateAutoRoster({
        date: '2026-08-02',
        position: '護士/保健員',
        users,
        employmentDetails: detailsMap,
        stations: [
          { id: 'station-1', name: 'A區' },
          { id: 'station-2', name: 'B區' },
        ],
        stationPriority: ['station-1', 'station-2', null],
        shiftSettings: [
          earlyShift('station-1', 1),
          lateShift('station-1', 1),
          earlyShift('station-2', 1),
          lateShift('station-2', 1),
        ],
        existingAssignments: [],
        dailyRequirements: hwRequirement,
        staffingResult: zeroStaffing,
        specific,
      });

      const stationOf = (userId: string) =>
        result.insertions.find((i) => i.user_id === userId)?.station_id;
      expect(stationOf('h1')).toBe('station-2');
      expect(stationOf('h2')).toBe('station-2');
      expect(stationOf('h3')).toBe('station-1');
      expect(stationOf('h4')).toBe('station-1');
    });

    it('約束輪硬性排除禁區員工（不會被派往不可前往的居住區）', () => {
      // h1 只可到 station-2（station-1 為禁區）；min_staff 要求兩區各 1 早 1 午
      const users = ['h1', 'h2', 'h3'].map(makeHw);
      const detailsMap = {
        h1: makeHwDetails('h1', { stations_forbidden: ['station-1'] } as Partial<UserEmploymentDetails>),
        h2: makeHwDetails('h2'),
        h3: makeHwDetails('h3'),
      };
      const result = generateAutoRoster({
        date: '2026-08-02',
        position: '護士/保健員',
        users,
        employmentDetails: detailsMap,
        stations: [
          { id: 'station-1', name: 'A區' },
          { id: 'station-2', name: 'B區' },
        ],
        stationPriority: ['station-1', 'station-2', null],
        shiftSettings: [
          earlyShift('station-1', 1),
          lateShift('station-1', 1),
          earlyShift('station-2', 1),
          lateShift('station-2', 1),
        ],
        existingAssignments: [],
        dailyRequirements: hwRequirement,
        staffingResult: zeroStaffing,
        specific,
      });

      const h1Assignment = result.insertions.find((i) => i.user_id === 'h1');
      // h1 絕不可出現在 station-1
      expect(h1Assignment?.station_id).not.toBe('station-1');
      // station-1 的早/午班由其他人補齊
      for (const bucket of ['早班', '午班']) {
        const count = result.insertions.filter(
          (i) => i.station_id === 'station-1' && i.shift_name === bucket,
        ).length;
        expect(count).toBeGreaterThanOrEqual(1);
      }
    });

    it('原則2 超額修正輪：早班超過 N 的人手被搬往未滿 N 的居住區', () => {
      // B 站早班 min_staff=3（約束輪會先塞 3 人，超過上限 2），
      // 修正輪應把 1 名可移的 B 站早班人手搬到未滿額的 C/D 站早班
      const users = ['h1', 'h2', 'h3', 'h4', 'h5'].map(makeHw);
      const detailsMap = {
        h1: makeHwDetails('h1', { stations_forbidden: ['station-c', 'station-d'] } as Partial<UserEmploymentDetails>),
        h2: makeHwDetails('h2', { preferred_station_primary: 'station-b' } as Partial<UserEmploymentDetails>),
        h3: makeHwDetails('h3', { preferred_station_primary: 'station-b' } as Partial<UserEmploymentDetails>),
        h4: makeHwDetails('h4', { preferred_station_primary: 'station-c' } as Partial<UserEmploymentDetails>),
        h5: makeHwDetails('h5', { preferred_station_primary: 'station-d' } as Partial<UserEmploymentDetails>),
      };
      const result = generateAutoRoster({
        date: '2026-08-02',
        position: '護士/保健員',
        users,
        employmentDetails: detailsMap,
        stations: [
          { id: 'station-b', name: 'B區' },
          { id: 'station-c', name: 'C區' },
          { id: 'station-d', name: 'D區' },
        ],
        stationPriority: ['station-b', 'station-c', 'station-d', null],
        shiftSettings: [
          earlyShift('station-b', 3),
          earlyShift('station-c'),
          earlyShift('station-d'),
        ],
        existingAssignments: [],
        dailyRequirements: hwRequirement,
        staffingResult: zeroStaffing,
        specific,
        principles: {
          earlyExtra: { enabled: true, n: 2 },
          ignoreStationPreference: false,
        },
      });

      const earlyAt = (stationId: string) =>
        result.insertions.filter((i) => i.station_id === stationId && i.shift_name === '早班').length;
      // 修正後 B 站早班回落至上限 2
      expect(earlyAt('station-b')).toBe(2);
      expect(earlyAt('station-c')).toBe(2);
      expect(earlyAt('station-d')).toBe(1);
      // 只可到 B 站的 h1 不會被搬走
      expect(
        result.insertions.find((i) => i.user_id === 'h1')?.station_id,
      ).toBe('station-b');
    });

    it('原則3：無視優先指派居住區', () => {
      const hw = makeHw('h1');
      const preferred = makeHwDetails('h1', { preferred_station_primary: 'station-2' } as Partial<UserEmploymentDetails>);
      const baseInput = {
        date: '2026-08-02',
        position: '護士/保健員',
        users: [hw],
        employmentDetails: { h1: preferred },
        stations: [
          { id: 'station-1', name: 'A區' },
          { id: 'station-2', name: 'B區' },
        ],
        stationPriority: ['station-1', 'station-2', null] as (string | null)[],
        shiftSettings: [earlyShift('station-1'), earlyShift('station-2')],
        existingAssignments: [],
        dailyRequirements: hwRequirement,
        staffingResult: zeroStaffing,
        specific,
      };

      const withPreference = generateAutoRoster(baseInput);
      expect(withPreference.insertions[0].station_id).toBe('station-2');

      const ignoring = generateAutoRoster({
        ...baseInput,
        principles: {
          earlyExtra: { enabled: false, n: 1 },
          ignoreStationPreference: true,
        },
      });
      expect(ignoring.insertions[0].station_id).toBe('station-1');
    });
  });
});
