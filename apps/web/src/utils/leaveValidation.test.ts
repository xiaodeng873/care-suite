import { describe, it, expect } from 'vitest';
import {
  isDateInTargetMonth,
  hasLeaveConflict,
  validateScheduledLeave,
  getRosterExpectedCounts,
  getRosterUsedCounts,
} from './leaveValidation';
import type { UserLeaveRecord, PublicHoliday } from '@care-suite/shared';

function makeLeave(
  id: string,
  date: string,
  type: UserLeaveRecord['leave_type'],
  refId?: string | null,
): UserLeaveRecord {
  return {
    id,
    user_id: 'u1',
    leave_date: date,
    record_type: 'leave',
    leave_type: type,
    reference_public_holiday_id: refId ?? null,
    urgency: 'mandatory',
    availability_start_time: null,
    availability_end_time: null,
    is_overridden: false,
    overridden_by: null,
    overridden_at: null,
    is_auto: false,
    remark: null,
    created_at: '',
    updated_at: '',
  };
}

function makeHoliday(id: string, date: string, name: string, type: 'PH' | 'SH'): PublicHoliday {
  return { id, holiday_date: date, name, type, created_by: null, created_at: '', updated_at: '' };
}

const baseCtx = {
  year: 2025,
  month: 4,
  existingLeaves: [] as UserLeaveRecord[],
  usedHolidayIds: new Set<string>(),
  doBalance: 0,
  restDayFraction: 0,
  prdExpected: 0,
  alBalance: 0,
  publicHolidays: [] as PublicHoliday[],
  publicHolidayType: null as 'PH' | 'SH' | null,
};

describe('isDateInTargetMonth', () => {
  it('同年月 → true', () => {
    expect(isDateInTargetMonth('2025-04-15', 2025, 4)).toBe(true);
  });
  it('不同月 → false', () => {
    expect(isDateInTargetMonth('2025-05-01', 2025, 4)).toBe(false);
  });
});

describe('hasLeaveConflict', () => {
  it('同日期有記錄 → true', () => {
    const leaves = [makeLeave('1', '2025-04-10', 'DO')];
    expect(hasLeaveConflict('2025-04-10', leaves)).toBe(true);
  });
  it('排除自己時不算衝突', () => {
    const leaves = [makeLeave('1', '2025-04-10', 'DO')];
    expect(hasLeaveConflict('2025-04-10', leaves, '1')).toBe(false);
  });
  it('不同日期 → false', () => {
    expect(hasLeaveConflict('2025-04-11', [makeLeave('1', '2025-04-10', 'DO')])).toBe(false);
  });
});

describe('validateScheduledLeave', () => {
  it('DO 額度足夠 → 通過', () => {
    const ctx = { ...baseCtx, doBalance: 1 };
    expect(
      validateScheduledLeave({ recordType: 'leave', urgency: 'mandatory', leaveDate: '2025-04-10', leaveType: 'DO' }, ctx),
    ).toBeNull();
  });

  it('DO 額度不足 → 錯誤', () => {
    const ctx = { ...baseCtx, doBalance: 0 };
    expect(validateScheduledLeave({ recordType: 'leave', urgency: 'mandatory', leaveDate: '2025-04-10', leaveType: 'DO' }, ctx)).toBe(
      'DO 額度不足',
    );
  });

  it('PRD fraction 不足 → 錯誤', () => {
    const ctx = { ...baseCtx, restDayFraction: 0.5, prdExpected: 0 };
    expect(validateScheduledLeave({ recordType: 'leave', urgency: 'mandatory', leaveDate: '2025-04-10', leaveType: 'PRD' }, ctx)).toBe(
      'PRD 累積不足 1 天，無法預排',
    );
  });

  it('PRD fraction + 預期達 1 → 通過', () => {
    const ctx = { ...baseCtx, restDayFraction: 0.5, prdExpected: 1 };
    expect(validateScheduledLeave({ recordType: 'leave', urgency: 'mandatory', leaveDate: '2025-04-10', leaveType: 'PRD' }, ctx)).toBeNull();
  });

  it('PH 需關聯實際假期且同月', () => {
    const h = makeHoliday('h1', '2025-04-04', '清明節', 'PH');
    const ctx = { ...baseCtx, publicHolidays: [h] };
    expect(
      validateScheduledLeave({ recordType: 'leave', urgency: 'mandatory', leaveDate: '2025-04-03', leaveType: 'PH', referencePublicHolidayId: 'h1' }, ctx),
    ).toBeNull();
    expect(
      validateScheduledLeave({ recordType: 'leave', urgency: 'mandatory', leaveDate: '2025-05-03', leaveType: 'PH', referencePublicHolidayId: 'h1' }, ctx),
    ).toBe('預排日必須在目標排班月份內');
    expect(
      validateScheduledLeave({ recordType: 'leave', urgency: 'mandatory', leaveDate: '2025-04-03', leaveType: 'PH' }, ctx),
    ).toBe('PH/SH 預排必須關聯實際假期');
  });

  it('PH 同假期不可重複預排', () => {
    const h = makeHoliday('h1', '2025-04-04', '清明節', 'PH');
    const ctx = { ...baseCtx, publicHolidays: [h], usedHolidayIds: new Set(['h1']) };
    expect(
      validateScheduledLeave({ recordType: 'leave', urgency: 'mandatory', leaveDate: '2025-04-03', leaveType: 'PH', referencePublicHolidayId: 'h1' }, ctx),
    ).toBe('該實際假期已被同一員工預排');
  });

  it('同一日期衝突 → 錯誤', () => {
    const ctx = {
      ...baseCtx,
      doBalance: 1,
      existingLeaves: [makeLeave('1', '2025-04-10', 'DO')],
    };
    expect(validateScheduledLeave({ recordType: 'leave', urgency: 'mandatory', leaveDate: '2025-04-10', leaveType: 'AL' }, ctx)).toBe(
      '該員工在目標日期已有預排記錄',
    );
  });
});

describe('getRosterExpectedCounts', () => {
  it('5 天工作，2025-04 有 4 次發放 → 8 DO, 0 PRD', () => {
    const counts = getRosterExpectedCounts(5, [], 2025, 4, '2025-01-01');
    expect(counts.doExpected).toBe(8);
    expect(counts.prdExpected).toBe(0);
  });

  it('5.5 天工作，2025-04 有 4 次發放 → 4 DO, 2 PRD', () => {
    const counts = getRosterExpectedCounts(5.5, [], 2025, 4, '2025-01-01');
    expect(counts.doExpected).toBe(4);
    expect(counts.prdExpected).toBe(2);
  });

  it('計算 PH/SH 數目', () => {
    const h = [makeHoliday('h1', '2025-04-04', '清明節', 'PH')];
    const counts = getRosterExpectedCounts(5, h, 2025, 4, '2025-01-01');
    expect(counts.phExpected).toBe(1);
    expect(counts.shExpected).toBe(0);
  });
});

describe('getRosterUsedCounts', () => {
  it('按目標年月統計已用假別', () => {
    const leaves = [
      makeLeave('1', '2025-04-05', 'DO'),
      makeLeave('2', '2025-04-12', 'PRD'),
      makeLeave('3', '2025-04-04', 'PH', 'h1'),
      makeLeave('4', '2025-05-01', 'DO'),
    ];
    const counts = getRosterUsedCounts(leaves, 2025, 4);
    expect(counts.doUsed).toBe(1);
    expect(counts.prdUsed).toBe(1);
    expect(counts.phUsed).toBe(1);
  });
});
