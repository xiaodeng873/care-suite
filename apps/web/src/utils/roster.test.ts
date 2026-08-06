import { describe, it, expect } from 'vitest';
import type { UserProfile, StationShiftSetting, UserShiftAssignment } from '@care-suite/shared';
import {
  getWeekRange,
  getWeekDays,
  formatDate,
  parseTime,
  formatTime,
  addHoursToTime,
  calculateAge,
  getApplicablePosition,
  getUserAllPositions,
  getShiftEndTime,
  buildShiftAssignmentMap,
  getActiveShiftSettings,
  getPositionOptions,
  summarizeDailyShiftByPosition,
  buildDailyCompliance,
  clamp,
} from './roster';

describe('roster utils', () => {
  describe('getWeekRange', () => {
    it('returns Sunday to Saturday around a Wednesday', () => {
      const wed = new Date(2026, 7, 5); // 2026-08-05 Wed
      const { start, end } = getWeekRange(wed);
      expect(start.getDay()).toBe(0);
      expect(end.getDay()).toBe(6);
      expect(formatDate(start.getFullYear(), start.getMonth() + 1, start.getDate())).toBe('2026-08-02');
      expect(formatDate(end.getFullYear(), end.getMonth() + 1, end.getDate())).toBe('2026-08-08');
    });
  });

  describe('getWeekDays', () => {
    it('returns 7 days starting from Sunday', () => {
      const days = getWeekDays(new Date(2026, 7, 5));
      expect(days).toHaveLength(7);
      expect(days[0].weekday).toBe('日');
      expect(days[6].weekday).toBe('六');
      expect(days[0].date).toBe('2026-08-02');
      expect(days[6].date).toBe('2026-08-08');
    });
  });

  describe('time helpers', () => {
    it('parses and formats time', () => {
      expect(parseTime('07:30')).toEqual({ hours: 7, minutes: 30 });
      expect(formatTime(7, 5)).toBe('07:05');
    });

    it('adds hours and wraps at midnight', () => {
      expect(addHoursToTime('22:00', 4)).toBe('02:00');
      expect(addHoursToTime('07:00', -2)).toBe('05:00');
      expect(addHoursToTime('23:00', 10)).toBe('09:00');
    });
  });

  describe('calculateAge', () => {
    it('returns null for empty or invalid date', () => {
      expect(calculateAge(null)).toBeNull();
      expect(calculateAge('')).toBeNull();
      expect(calculateAge('not-a-date')).toBeNull();
    });

    it('calculates age correctly', () => {
      const dob = `${new Date().getFullYear() - 30}-06-15`;
      expect(calculateAge(dob)).toBe(30);
    });
  });

  describe('getApplicablePosition', () => {
    const user = {
      nursing_position: '護理員',
      hygiene_position: null,
      allied_health_position: null,
      other_position: null,
      secondary_positions: ['助理員'],
    } as unknown as UserProfile;

    it('matches primary position', () => {
      expect(getApplicablePosition(user, '護理員')).toBe(true);
    });

    it('matches secondary position', () => {
      expect(getApplicablePosition(user, '助理員')).toBe(true);
    });

    it('returns false for non-matching position', () => {
      expect(getApplicablePosition(user, '保健員')).toBe(false);
    });
  });

  describe('getUserAllPositions', () => {
    it('returns primary and secondary positions without duplicates', () => {
      const user = {
        nursing_position: '護理員',
        hygiene_position: null,
        allied_health_position: null,
        other_position: null,
        secondary_positions: ['助理員', '護理員'],
      } as unknown as UserProfile;
      expect(getUserAllPositions(user)).toEqual(['護理員', '助理員']);
    });
  });

  describe('getShiftEndTime', () => {
    it('uses daily contract hours when set', () => {
      expect(getShiftEndTime('07:00', 8)).toBe('15:00');
    });

    it('defaults to 8 hours when not set', () => {
      expect(getShiftEndTime('07:00', null)).toBe('15:00');
    });

    it('wraps at midnight', () => {
      expect(getShiftEndTime('22:00', 10)).toBe('08:00');
    });
  });

  describe('buildShiftAssignmentMap', () => {
    it('groups assignments by station/shift/date and by user/date', () => {
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', created_by: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u2', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', created_by: null, created_at: '', updated_at: '' },
        { id: '3', user_id: 'u1', work_date: '2026-08-03', station_id: null, shift_name: '午班', start_time: '15:00', created_by: null, created_at: '', updated_at: '' },
      ];
      const { byKey, byUserDate } = buildShiftAssignmentMap(assignments);
      expect(byKey.get('s1|早班|2026-08-02')).toHaveLength(2);
      expect(byKey.get('unassigned|午班|2026-08-03')).toHaveLength(1);
      expect(byUserDate.get('u1|2026-08-02')).toBeDefined();
      expect(byUserDate.get('u1|2026-08-03')).toBeDefined();
      expect(byUserDate.get('u2|2026-08-03')).toBeUndefined();
    });
  });

  describe('getActiveShiftSettings', () => {
    it('filters and sorts active settings for a station', () => {
      const settings: StationShiftSetting[] = [
        { id: '1', station_id: 's1', shift_name: '午班', start_time: '15:00', is_active: true, sort_order: 2, created_at: '', updated_at: '' },
        { id: '2', station_id: 's1', shift_name: '早班', start_time: '07:00', is_active: true, sort_order: 1, created_at: '', updated_at: '' },
        { id: '3', station_id: 's1', shift_name: '晚班', start_time: '23:00', is_active: false, sort_order: 3, created_at: '', updated_at: '' },
        { id: '4', station_id: 's2', shift_name: '早班', start_time: '08:00', is_active: true, sort_order: 1, created_at: '', updated_at: '' },
      ];
      const result = getActiveShiftSettings(settings, 's1');
      expect(result).toHaveLength(2);
      expect(result[0].shift_name).toBe('早班');
      expect(result[1].shift_name).toBe('午班');
    });

    it('returns unassigned station settings with null station_id', () => {
      const settings: StationShiftSetting[] = [
        { id: '1', station_id: null, shift_name: '早班', start_time: '07:00', is_active: true, sort_order: 1, created_at: '', updated_at: '' },
      ];
      expect(getActiveShiftSettings(settings, null)).toHaveLength(1);
    });
  });

  describe('getPositionOptions', () => {
    it('collects unique positions from primary and secondary roles', () => {
      const users = [
        { nursing_position: '護理員', secondary_positions: ['助理員'] },
        { nursing_position: '保健員', secondary_positions: [] },
        { nursing_position: '護理員', secondary_positions: ['助理員', 'invalid'] },
      ] as unknown as UserProfile[];
      expect(getPositionOptions(users)).toEqual(['保健員', '助理員', '護理員']);
    });
  });

  describe('clamp', () => {
    it('clamps value between min and max', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-2, 0, 10)).toBe(0);
      expect(clamp(12, 0, 10)).toBe(10);
    });
  });

  describe('summarizeDailyShiftByPosition', () => {
    it('sums headcount and hours by primary position', () => {
      const users = [
        { id: 'u1', nursing_position: '護理員', secondary_positions: [] },
        { id: 'u2', nursing_position: '護理員', secondary_positions: [] },
        { id: 'u3', nursing_position: null, hygiene_position: '助理員', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = {
        u1: { daily_contract_hours: 8 },
        u2: { daily_contract_hours: 6 },
        u3: { daily_contract_hours: 8 },
      } as any;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', created_by: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u2', work_date: '2026-08-02', station_id: 's1', shift_name: '午班', start_time: '15:00', created_by: null, created_at: '', updated_at: '' },
        { id: '3', user_id: 'u3', work_date: '2026-08-02', station_id: 's1', shift_name: '晚班', start_time: '22:00', created_by: null, created_at: '', updated_at: '' },
      ];
      const summary = summarizeDailyShiftByPosition('2026-08-02', users, employmentDetails, assignments);
      expect(summary['護理員']).toEqual({ headcount: 2, hours: 14 });
      expect(summary['助理員']).toEqual({ headcount: 1, hours: 8 });
    });
  });

  describe('buildDailyCompliance', () => {
    it('compares actual against required and flags ok status', () => {
      const users = [
        { id: 'u1', nursing_position: '護理員', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = { u1: { daily_contract_hours: 8 } } as any;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', created_by: null, created_at: '', updated_at: '' },
      ];
      const requiredHours = { 護理員: 16 };
      const requiredHourly = {
        護理員: Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 17 ? 2 : h < 7 || h >= 17 ? 1 : 0)),
      };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildDailyCompliance('2026-08-02', requiredHours, requiredHourly, specific, users, employmentDetails, assignments);
      const careRow = rows.find((r) => r.position === '護理員')!;
      expect(careRow.actualHours).toBe(8);
      expect(careRow.requiredHours).toBe(16);
      expect(careRow.hoursOk).toBe(false);
      expect(careRow.specificSlotOk).toBe(false);
      expect(careRow.hasSpecificSlotRequirement).toBe(true);
      expect(careRow.specificSegments).toEqual([
        { label: '07:00-17:00', required: 2, actual: 0 },
        { label: '17:00-07:00', required: 1, actual: 0 },
      ]);
    });

    it('lists all care worker specific windows when requirement1 is split', () => {
      const users: UserProfile[] = [];
      const employmentDetails = {};
      const assignments: UserShiftAssignment[] = [];
      const requiredHours = { 護理員: 16 };
      const requiredHourly = {
        護理員: Array.from({ length: 24 }, (_, h) =>
          h >= 7 && h < 9 ? 2 : h >= 10 && h < 18 ? 2 : 1
        ),
      };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '09:00' }, { start: '10:00', end: '18:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildDailyCompliance('2026-08-02', requiredHours, requiredHourly, specific, users, employmentDetails, assignments);
      const careRow = rows.find((r) => r.position === '護理員')!;
      expect(careRow.specificSegments).toEqual([
        { label: '07:00-09:00', required: 2, actual: 0 },
        { label: '10:00-18:00', required: 2, actual: 0 },
        { label: '09:00-10:00', required: 1, actual: 0 },
        { label: '18:00-07:00', required: 1, actual: 0 },
      ]);
    });

    it('flags specific slot as not ok when no users of that position exist', () => {
      const users: UserProfile[] = [];
      const employmentDetails = {};
      const assignments: UserShiftAssignment[] = [];
      const requiredHours = { 助理員: 105 };
      const requiredHourly = {
        助理員: Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 18 ? 7 : 0)),
      };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildDailyCompliance('2026-08-02', requiredHours, requiredHourly, specific, users, employmentDetails, assignments);
      const row = rows.find((r) => r.position === '助理員')!;
      expect(row.hoursOk).toBe(false);
      expect(row.specificSlotOk).toBe(false);
      expect(row.hasSpecificSlotRequirement).toBe(true);
      expect(row.requiredSpecificHeadcount).toBe(7);
      expect(row.actualSpecificHeadcount).toBe(0);
      expect(row.specificSegments).toEqual([{ label: '07:00-18:00', required: 7, actual: 0 }]);
    });
  });
});
