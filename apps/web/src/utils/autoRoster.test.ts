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
});
