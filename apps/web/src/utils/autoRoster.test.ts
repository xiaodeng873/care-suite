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
    expect(result.finalDeficit).toBe(0);
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

  it('prefers station priority over shift when both equally improve deficit', () => {
    const aShift: StationShiftSetting = {
      ...shiftSetting,
      id: 'sA',
      station_id: 'station-a',
      shift_name: '午班',
      start_time: '15:00',
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
      shift_name: '午班',
      start_time: '15:00',
    });
  });

  it('uses shift start time even when user has a preferred default start time', () => {
    const afternoonShift: StationShiftSetting = {
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

    const result = generateAutoRoster({
      date: '2026-08-02',
      position: '護理員',
      users: [userWithDefaultStart],
      employmentDetails: { u1: detailsWithDefaultStart },
      stations: [{ id: 'station-1', name: 'A區' }],
      shiftSettings: [afternoonShift],
      existingAssignments: [],
      dailyRequirements: [
        { position: '護理員', hours: 8, peakHeadcount: 1 },
      ],
      staffingResult,
      specific,
    });

    expect(result.insertions.length).toBe(1);
    expect(result.insertions[0]).toMatchObject({
      shift_name: '午班',
      start_time: '13:00',
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
});
