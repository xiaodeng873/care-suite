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
