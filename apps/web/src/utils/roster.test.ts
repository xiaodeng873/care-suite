import { describe, it, expect } from 'vitest';
import type { UserProfile, StationShiftSetting, UserShiftAssignment, UserEmploymentDetails, UserLeaveRecord } from '@care-suite/shared';
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
  formatShiftTimeAbbreviation,
  buildShiftAssignmentMap,
  getActiveShiftSettings,
  getPositionOptions,
  getGridPositionOptions,
  getRosterGroupOptions,
  getAssignmentPositionForTable,
  summarizeDailyShiftByPosition,
  buildDailyCompliance,
  buildPreScheduleDailyCompliance,
  canFillPositionInPreSchedule,
  getPreScheduleAvailableByShiftHour,
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

    it('formats shift time abbreviation', () => {
      expect(formatShiftTimeAbbreviation('07:00', '18:00')).toBe('7A-6P');
      expect(formatShiftTimeAbbreviation('13:00', '22:00')).toBe('1P-10P');
      expect(formatShiftTimeAbbreviation('21:00', '07:00')).toBe('9P-7A');
      expect(formatShiftTimeAbbreviation('00:00', '12:00')).toBe('12A-12P');
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
      secondary_positions: [],
    } as unknown as UserProfile;

    it('matches primary position', () => {
      expect(getApplicablePosition(user, '護理員')).toBe(true);
    });

    it('returns false for non-matching position', () => {
      expect(getApplicablePosition(user, '保健員')).toBe(false);
    });
  });

  describe('getUserAllPositions', () => {
    it('returns only primary position', () => {
      const user = {
        nursing_position: '護理員',
        hygiene_position: null,
        allied_health_position: null,
        other_position: null,
        secondary_positions: ['社工助理', '護理員'],
      } as unknown as UserProfile;
      expect(getUserAllPositions(user)).toEqual(['護理員']);
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
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u2', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
        { id: '3', user_id: 'u1', work_date: '2026-08-03', station_id: null, shift_name: '午班', start_time: '15:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
      ];
      const { byKey, byUserDate } = buildShiftAssignmentMap(assignments);
      expect(byKey.get('s1|早班|2026-08-02')).toHaveLength(2);
      expect(byKey.get('unassigned|午班|2026-08-03')).toHaveLength(1);
      expect(byUserDate.get('u1|2026-08-02')).toBeDefined();
      expect(byUserDate.get('u1|2026-08-03')).toBeDefined();
      expect(byUserDate.get('u2|2026-08-03')).toBeUndefined();
    });

    it('sorts by position priority and hire date when sort_order is uniform', () => {
      const assignments: UserShiftAssignment[] = [
        { id: 'hw', user_id: 'u_hw', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, position: '保健員', created_by: null, created_at: 'a', updated_at: '' },
        { id: 'en_old', user_id: 'u_en_old', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, position: '登記護士', created_by: null, created_at: 'b', updated_at: '' },
        { id: 'rn', user_id: 'u_rn', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, position: '註冊護士', created_by: null, created_at: 'c', updated_at: '' },
        { id: 'en_new', user_id: 'u_en_new', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, position: '登記護士', created_by: null, created_at: 'd', updated_at: '' },
      ];
      const users = [
        { id: 'u_hw', hire_date: '2020-01-01', nursing_position: '保健員', secondary_positions: [] },
        { id: 'u_en_old', hire_date: '2018-01-01', nursing_position: '登記護士', secondary_positions: [] },
        { id: 'u_rn', hire_date: '2019-01-01', nursing_position: '註冊護士', secondary_positions: [] },
        { id: 'u_en_new', hire_date: '2021-01-01', nursing_position: '登記護士', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const { byKey } = buildShiftAssignmentMap(assignments, users);
      const list = byKey.get('s1|早班|2026-08-02')!;
      expect(list.map((a) => a.id)).toEqual(['rn', 'en_old', 'en_new', 'hw']);
    });

    it('sort_order only overrides order within the same position priority', () => {
      const assignments: UserShiftAssignment[] = [
        { id: 'rn', user_id: 'u_rn', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, position: '註冊護士', sort_order: 3, created_by: null, created_at: '', updated_at: '' },
        { id: 'hw', user_id: 'u_hw', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, position: '保健員', sort_order: 1, created_by: null, created_at: '', updated_at: '' },
        { id: 'en', user_id: 'u_en', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, position: '登記護士', sort_order: 2, created_by: null, created_at: '', updated_at: '' },
      ];
      const { byKey } = buildShiftAssignmentMap(assignments, []);
      const list = byKey.get('s1|早班|2026-08-02')!;
      // 職位優先級仍高於 sort_order
      expect(list.map((a) => a.id)).toEqual(['rn', 'en', 'hw']);
    });

    it('sort_order overrides hire_date within the same position', () => {
      const assignments: UserShiftAssignment[] = [
        { id: 'en_new', user_id: 'u_en_new', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, position: '登記護士', sort_order: 0, created_by: null, created_at: 'a', updated_at: '' },
        { id: 'en_old', user_id: 'u_en_old', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, position: '登記護士', sort_order: 1, created_by: null, created_at: 'b', updated_at: '' },
      ];
      const users = [
        { id: 'u_en_new', hire_date: '2021-01-01', nursing_position: '登記護士', secondary_positions: [] },
        { id: 'u_en_old', hire_date: '2018-01-01', nursing_position: '登記護士', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const { byKey } = buildShiftAssignmentMap(assignments, users);
      const list = byKey.get('s1|早班|2026-08-02')!;
      // sort_order 0 的 en_new 排在 sort_order 1 的 en_old 前面，即使 en_new 入職較晚
      expect(list.map((a) => a.id)).toEqual(['en_new', 'en_old']);
    });
  });

  describe('getActiveShiftSettings', () => {
    it('filters and sorts active settings for a station', () => {
      const settings: StationShiftSetting[] = [
        { id: '1', station_id: 's1', position: null, shift_name: '午班', start_time: '15:00', is_active: true, sort_order: 2, created_at: '', updated_at: '' },
        { id: '2', station_id: 's1', position: null, shift_name: '早班', start_time: '07:00', is_active: true, sort_order: 1, created_at: '', updated_at: '' },
        { id: '3', station_id: 's1', position: null, shift_name: '晚班', start_time: '23:00', is_active: false, sort_order: 3, created_at: '', updated_at: '' },
        { id: '4', station_id: 's2', position: null, shift_name: '早班', start_time: '08:00', is_active: true, sort_order: 1, created_at: '', updated_at: '' },
      ];
      const result = getActiveShiftSettings(settings, 's1');
      expect(result).toHaveLength(2);
      expect(result[0].shift_name).toBe('早班');
      expect(result[1].shift_name).toBe('午班');
    });

    it('returns unassigned station settings with null station_id', () => {
      const settings: StationShiftSetting[] = [
        { id: '1', station_id: null, position: null, shift_name: '早班', start_time: '07:00', is_active: true, sort_order: 1, created_at: '', updated_at: '' },
      ];
      expect(getActiveShiftSettings(settings, null)).toHaveLength(1);
    });
  });

  describe('getRosterGroupOptions', () => {
    it('merges nurses and health workers into a single tab', () => {
      const users = [
        { nursing_position: '註冊護士', secondary_positions: [] },
        { nursing_position: '保健員', secondary_positions: [] },
        { nursing_position: '護理員', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const options = getRosterGroupOptions(users);
      expect(options).toContain('護士/保健員');
      expect(options).not.toContain('註冊/登記護士');
      expect(options).not.toContain('保健員');
      expect(options).toContain('護理員');
    });

    it('groups admin and general affairs separately', () => {
      const users = [
        { nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '主管', department: '行政', secondary_positions: [] },
        { nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '廚師', department: '庶務', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const options = getRosterGroupOptions(users);
      expect(options).toContain('行政');
      expect(options).toContain('庶務');
    });
  });

  describe('getAssignmentPositionForTable', () => {
    it('returns nurse/health worker primary position for merged tab', () => {
      const rn = { nursing_position: '註冊護士', secondary_positions: [] } as unknown as UserProfile;
      const en = { nursing_position: '登記護士', secondary_positions: [] } as unknown as UserProfile;
      const hw = { nursing_position: '保健員', secondary_positions: [] } as unknown as UserProfile;
      expect(getAssignmentPositionForTable(rn, '護士/保健員')).toBe('註冊護士');
      expect(getAssignmentPositionForTable(en, '護士/保健員')).toBe('登記護士');
      expect(getAssignmentPositionForTable(hw, '護士/保健員')).toBe('保健員');
    });

    it('returns null when primary does not match table even with secondary role', () => {
      const user = {
        nursing_position: '主管',
        secondary_positions: ['廚師'],
      } as unknown as UserProfile;
      expect(getAssignmentPositionForTable(user, '庶務')).toBeNull();
    });

    it('returns admin primary position for admin table', () => {
      const user = {
        nursing_position: null,
        hygiene_position: null,
        allied_health_position: null,
        other_position: '主管',
        department: '行政',
        secondary_positions: [],
      } as unknown as UserProfile;
      expect(getAssignmentPositionForTable(user, '行政')).toBe('主管');
    });

    it('returns null when user cannot fill table', () => {
      const user = {
        nursing_position: '護理員',
        secondary_positions: [],
      } as unknown as UserProfile;
      expect(getAssignmentPositionForTable(user, '行政')).toBeNull();
    });
  });
  describe('getGridPositionOptions', () => {
    it('merges registered and enrolled nurses into a single grid option', () => {
      const users = [
        { nursing_position: '註冊護士', secondary_positions: [] },
        { nursing_position: '登記護士', secondary_positions: [] },
        { nursing_position: '護理員', secondary_positions: [] },
      ] as unknown as UserProfile[];
      expect(getGridPositionOptions(users)).toContain('註冊/登記護士');
      expect(getGridPositionOptions(users)).not.toContain('註冊護士');
      expect(getGridPositionOptions(users)).not.toContain('登記護士');
    });
  });

  describe('getPositionOptions', () => {
    it('collects unique positions from primary roles only', () => {
      const users = [
        { nursing_position: '護理員', secondary_positions: ['社工助理'] },
        { nursing_position: '保健員', secondary_positions: [] },
        { nursing_position: '護理員', secondary_positions: ['社工助理', 'invalid'] },
      ] as unknown as UserProfile[];
      expect(getPositionOptions(users)).toEqual(['保健員', '登記護士', '註冊護士', '護理員']);
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
        { id: 'u3', nursing_position: null, hygiene_position: '清潔員', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = {
        u1: { daily_contract_hours: 8 },
        u2: { daily_contract_hours: 6 },
        u3: { daily_contract_hours: 8 },
      } as unknown as Record<string, UserEmploymentDetails>;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u2', work_date: '2026-08-02', station_id: 's1', shift_name: '午班', start_time: '15:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
        { id: '3', user_id: 'u3', work_date: '2026-08-02', station_id: 's1', shift_name: '晚班', start_time: '22:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
      ];
      const summary = summarizeDailyShiftByPosition('2026-08-02', users, employmentDetails, assignments);
      expect(summary['護理員']).toEqual({ headcount: 2, hours: 14 });
      expect(summary['清潔員']).toEqual({ headcount: 1, hours: 0 });
      expect(summary['助理員']).toEqual({ headcount: 0, hours: 8 });
    });

    it('counts admin and general affairs staff hours toward assistant slot', () => {
      const users = [
        { id: 'u1', nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '文員', department: '行政', secondary_positions: [] },
        { id: 'u2', nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '會計', department: '行政', secondary_positions: [] },
        { id: 'u3', nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '廚師', department: '庶務', secondary_positions: [] },
        { id: 'u4', nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '主管', department: '行政', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = {
        u1: { daily_contract_hours: 8 },
        u2: { daily_contract_hours: 8 },
        u3: { daily_contract_hours: 8 },
        u4: { daily_contract_hours: 8 },
      } as unknown as Record<string, UserEmploymentDetails>;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u2', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
        { id: '3', user_id: 'u3', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
        { id: '4', user_id: 'u4', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
      ];
      const summary = summarizeDailyShiftByPosition('2026-08-02', users, employmentDetails, assignments);
      expect(summary['助理員']).toEqual({ headcount: 0, hours: 24 });
      expect(summary['主管']).toEqual({ headcount: 1, hours: 8 });
      expect(summary['文員']).toEqual({ headcount: 1, hours: 0 });
      expect(summary['會計']).toEqual({ headcount: 1, hours: 0 });
      expect(summary['廚師']).toEqual({ headcount: 1, hours: 0 });
    });

    it('counts nurse covering health worker shift toward health worker headcount and nurse hours', () => {
      const users = [
        { id: 'u1', nursing_position: '登記護士', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = { u1: { daily_contract_hours: 8 } } as unknown as Record<string, UserEmploymentDetails>;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', position: '保健員', shift_name: '早班', start_time: '07:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
      ];
      const summary = summarizeDailyShiftByPosition('2026-08-02', users, employmentDetails, assignments);
      expect(summary['保健員']).toEqual({ headcount: 1, hours: 0 });
      expect(summary['註冊/登記護士']).toEqual({ headcount: 0, hours: 8 });
    });
  });

  describe('buildDailyCompliance', () => {
    it('compares actual against required and flags ok status', () => {
      const users = [
        { id: 'u1', nursing_position: '護理員', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = { u1: { daily_contract_hours: 8 } } as unknown as Record<string, UserEmploymentDetails>;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: null, created_by: null, created_at: '', updated_at: '' },
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

    it('counts all non-nursing staff as assistants for specific slot', () => {
      const users = [
        { id: 'u1', nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '文員', department: '行政', secondary_positions: [] },
        { id: 'u2', nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '社工助理', department: '行政', secondary_positions: [] },
        { id: 'u3', nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '清潔員', department: '庶務', secondary_positions: [] },
        { id: 'u4', nursing_position: null, hygiene_position: null, allied_health_position: null, other_position: '廚師', department: '庶務', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = { u1: { daily_contract_hours: 8 }, u2: { daily_contract_hours: 8 }, u3: { daily_contract_hours: 8 }, u4: { daily_contract_hours: 8 } } as unknown as Record<string, UserEmploymentDetails>;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: '18:00', created_by: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u2', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: '18:00', created_by: null, created_at: '', updated_at: '' },
        { id: '3', user_id: 'u3', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: '18:00', created_by: null, created_at: '', updated_at: '' },
        { id: '4', user_id: 'u4', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: '18:00', created_by: null, created_at: '', updated_at: '' },
      ];
      const requiredHours = { 助理員: 0 };
      const requiredHourly = {
        助理員: Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 18 ? 3 : 0)),
      };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildDailyCompliance('2026-08-02', requiredHours, requiredHourly, specific, users, employmentDetails, assignments);
      const assistantRow = rows.find((r) => r.position === '助理員')!;
      expect(assistantRow.actualSpecificHeadcount).toBe(4);
      expect(assistantRow.specificSlotOk).toBe(true);
    });

    it('combines health worker and nurse equivalents for the 13-hour specific slot', () => {
      const users = [
        { id: 'u1', nursing_position: '註冊護士', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = { u1: { daily_contract_hours: 8 } } as unknown as Record<string, UserEmploymentDetails>;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', position: '保健員', shift_name: '早班', start_time: '07:00', end_time: '20:00', created_by: null, created_at: '', updated_at: '' },
      ];
      const requiredHours = { 保健員: 0, '註冊/登記護士': 0 };
      const requiredHourly = {
        保健員: Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 20 ? 2 : 0)),
        '註冊/登記護士': Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 20 ? 1 : 0)),
      };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildDailyCompliance('2026-08-02', requiredHours, requiredHourly, specific, users, employmentDetails, assignments);
      const healthWorkerRow = rows.find((r) => r.position === '保健員')!;
      expect(healthWorkerRow.requiredSpecificHeadcount).toBe(4);
      expect(healthWorkerRow.actualSpecificHeadcount).toBe(2);
      expect(healthWorkerRow.specificSlotOk).toBe(false);
      const nurseRow = rows.find((r) => r.position === '註冊/登記護士')!;
      expect(nurseRow.requiredSpecificHeadcount).toBe(8);
      expect(nurseRow.actualSpecificHeadcount).toBe(11);
      expect(nurseRow.specificSlotOk).toBe(true);
    });

    it('flags A1 nurse coverage as not ok when fewer than 8 hours within 07:00-18:00', () => {
      const users = [
        { id: 'u1', nursing_position: '註冊護士', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = { u1: { daily_contract_hours: 6 } } as unknown as Record<string, UserEmploymentDetails>;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '09:00', end_time: '15:00', created_by: null, created_at: '', updated_at: '' },
      ];
      const requiredHourly = {
        '註冊/登記護士': Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 20 ? 1 : 0)),
      };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildDailyCompliance('2026-08-02', {}, requiredHourly, specific, users, employmentDetails, assignments);
      const nurseRow = rows.find((r) => r.position === '註冊/登記護士')!;
      expect(nurseRow.requiredSpecificHeadcount).toBe(8);
      expect(nurseRow.actualSpecificHeadcount).toBe(6);
      expect(nurseRow.specificSlotOk).toBe(false);
    });

    it('stacks multiple RN duty hours within 07:00-18:00 toward the 8-hour requirement', () => {
      const users = [
        { id: 'u1', nursing_position: '註冊護士', secondary_positions: [] },
        { id: 'u2', nursing_position: '註冊護士', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = {
        u1: { daily_contract_hours: 8 },
        u2: { daily_contract_hours: 8 },
      } as unknown as Record<string, UserEmploymentDetails>;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: '11:00', created_by: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u2', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: '11:00', created_by: null, created_at: '', updated_at: '' },
      ];
      const requiredHourly = {
        '註冊/登記護士': Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 20 ? 1 : 0)),
      };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildDailyCompliance('2026-08-02', {}, requiredHourly, specific, users, employmentDetails, assignments);
      const nurseRow = rows.find((r) => r.position === '註冊/登記護士')!;
      // 兩名 RN 各當值 4 小時（重疊），累積 8 小時即合格，不需 RN 覆蓋整個窗口
      expect(nurseRow.requiredSpecificHeadcount).toBe(8);
      expect(nurseRow.actualSpecificHeadcount).toBe(8);
      expect(nurseRow.specificSlotOk).toBe(true);
    });

    it('does not count enrolled nurse toward A1 registered nurse 8-hour coverage', () => {
      const users = [
        { id: 'u1', nursing_position: '登記護士', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = { u1: { daily_contract_hours: 8 } } as unknown as Record<string, UserEmploymentDetails>;
      const assignments: UserShiftAssignment[] = [
        { id: '1', user_id: 'u1', work_date: '2026-08-02', station_id: 's1', shift_name: '早班', start_time: '07:00', end_time: '15:00', created_by: null, created_at: '', updated_at: '' },
      ];
      const requiredHourly = {
        '註冊/登記護士': Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 20 ? 1 : 0)),
      };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildDailyCompliance('2026-08-02', {}, requiredHourly, specific, users, employmentDetails, assignments);
      const nurseRow = rows.find((r) => r.position === '註冊/登記護士')!;
      expect(nurseRow.requiredSpecificHeadcount).toBe(8);
      expect(nurseRow.actualSpecificHeadcount).toBe(0);
      expect(nurseRow.specificSlotOk).toBe(false);
      expect(nurseRow.specificSegments[0]?.label).toBe('註冊護士 07:00-18:00');
    });
  });

  describe('canFillPositionInPreSchedule', () => {
    it('matches primary position', () => {
      const user = { nursing_position: '護理員', secondary_positions: [] } as unknown as UserProfile;
      expect(canFillPositionInPreSchedule(user, '護理員')).toBe(true);
    });

    it('does not allow nurse to cover health worker', () => {
      const user = { nursing_position: '註冊護士', secondary_positions: [] } as unknown as UserProfile;
      expect(canFillPositionInPreSchedule(user, '保健員')).toBe(false);
    });

    it('does not allow health worker to cover nurse', () => {
      const user = { nursing_position: null, hygiene_position: '保健員', secondary_positions: [] } as unknown as UserProfile;
      expect(canFillPositionInPreSchedule(user, '註冊/登記護士')).toBe(false);
    });
  });

  describe('getPreScheduleAvailableByShiftHour', () => {
    it('counts available users per shift hour without counting nurse as health worker', () => {
      const users = [
        { id: 'u1', nursing_position: '保健員', secondary_positions: [] },
        { id: 'u2', nursing_position: '註冊護士', secondary_positions: [] },
        { id: 'u3', nursing_position: '保健員', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const leaves = [
        { user_id: 'u3', leave_date: '2026-08-02', record_type: 'leave', leave_type: 'AL' },
      ] as unknown as UserLeaveRecord[];
      const { available, equivalent } = getPreScheduleAvailableByShiftHour('2026-08-02', '保健員', users, leaves);
      expect(available[0]).toBe(1);
      expect(equivalent[0]).toBe(1);
    });
  });

  describe('buildPreScheduleDailyCompliance', () => {
    it('shows available hours and specific slot from leave records, not assignments', () => {
      const users = [
        { id: 'u1', nursing_position: '護理員', secondary_positions: [] },
        { id: 'u2', nursing_position: '護理員', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = { u1: { daily_contract_hours: 8 }, u2: { daily_contract_hours: 8 } } as unknown as Record<string, UserEmploymentDetails>;
      const leaves = [] as unknown as UserLeaveRecord[];
      const requiredHours = { 護理員: 16 };
      const requiredHourly = {
        護理員: Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 17 ? 2 : h < 7 || h >= 17 ? 1 : 0)),
      };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildPreScheduleDailyCompliance('2026-08-02', requiredHours, requiredHourly, specific, users, employmentDetails, leaves);
      const careRow = rows.find((r) => r.position === '護理員')!;
      expect(careRow.actualHours).toBe(16);
      expect(careRow.hoursOk).toBe(true);
      expect(careRow.actualSpecificHeadcount).toBe(2);
      expect(careRow.specificSlotOk).toBe(true);
    });

    it('shows availability records as available, not as leave', () => {
      const users = [
        { id: 'u1', nursing_position: '註冊護士', secondary_positions: [] },
        { id: 'u2', nursing_position: '登記護士', secondary_positions: [] },
      ] as unknown as UserProfile[];
      const employmentDetails = {
        u1: { daily_contract_hours: 8 },
        u2: { daily_contract_hours: 8 },
      } as unknown as Record<string, UserEmploymentDetails>;
      const leaves = [
        { user_id: 'u1', leave_date: '2026-08-02', record_type: 'availability', availability_start_time: '07:00', availability_end_time: '16:00', urgency: 'preferred' },
        { user_id: 'u2', leave_date: '2026-08-02', record_type: 'leave', leave_type: 'DO', urgency: 'preferred' },
      ] as unknown as UserLeaveRecord[];
      const requiredHours = { '註冊/登記護士': 8 };
      const requiredHourly = { '註冊/登記護士': Array.from({ length: 24 }, () => 0) };
      const specific = {
        requirement1: { segments: [{ start: '07:00', end: '17:00' }] },
        requirement3: { start: '07:00', end: '20:00' },
        assistantWindow: { start: '07:00', end: '18:00' },
      };
      const rows = buildPreScheduleDailyCompliance('2026-08-02', requiredHours, requiredHourly, specific, users, employmentDetails, leaves);
      const nurseRow = rows.find((r) => r.position === '註冊/登記護士')!;
      // u1 availability => counted; u2 DO leave => not counted; total 8h => OK
      expect(nurseRow.actualHours).toBe(8);
      expect(nurseRow.hoursOk).toBe(true);
    });
  });
});
