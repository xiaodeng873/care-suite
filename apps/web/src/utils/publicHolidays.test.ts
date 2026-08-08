import { describe, it, expect } from 'vitest';
import {
  getExpectedPublicHolidayGrants,
  getPublicHolidaysForMonth,
  getValidSubstituteDates,
  addDays,
} from './publicHolidays';
import type { PublicHoliday } from '@care-suite/shared';

function makeHoliday(date: string, name: string, type: 'PH' | 'SH'): PublicHoliday {
  return {
    id: `${type}-${date}`,
    holiday_date: date,
    name,
    type,
    created_by: null,
    created_at: '',
    updated_at: '',
  };
}

describe('getExpectedPublicHolidayGrants', () => {
  it('無起始日或無類型 → 空陣列', () => {
    const h = [makeHoliday('2025-04-04', '清明節', 'PH')];
    expect(getExpectedPublicHolidayGrants(null, 'PH', h)).toEqual([]);
    expect(getExpectedPublicHolidayGrants('2025-04-01', null, h)).toEqual([]);
  });

  it('起始日未來 → 空陣列', () => {
    const h = [makeHoliday('2025-04-04', '清明節', 'PH')];
    expect(getExpectedPublicHolidayGrants('2025-06-01', 'PH', h, new Date('2025-05-01'))).toEqual([]);
  });

  it('按每個假期獨立產生 grant，有效期為 holiday_date + 30 天', () => {
    const h = [
      makeHoliday('2025-04-04', '清明節', 'PH'),
      makeHoliday('2025-04-18', '耶穌受難節', 'PH'),
      makeHoliday('2025-05-01', '勞動節', 'PH'),
    ];
    const result = getExpectedPublicHolidayGrants('2025-04-01', 'PH', h, new Date('2025-05-05'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      record_date: '2025-04-01',
      days: 1,
      remark: '清明節',
      holiday_date: '2025-04-04',
      expiry_date: '2025-05-04',
      reference_public_holiday_id: 'PH-2025-04-04',
    });
    expect(result[1]).toMatchObject({
      record_date: '2025-04-01',
      days: 1,
      remark: '耶穌受難節',
      holiday_date: '2025-04-18',
      expiry_date: '2025-05-18',
      reference_public_holiday_id: 'PH-2025-04-18',
    });
    expect(result[2]).toMatchObject({
      record_date: '2025-05-01',
      days: 1,
      remark: '勞動節',
      holiday_date: '2025-05-01',
      expiry_date: '2025-05-31',
      reference_public_holiday_id: 'PH-2025-05-01',
    });
  });

  it('SH 與 PH 分開計算', () => {
    const h = [
      makeHoliday('2025-04-04', '清明節', 'PH'),
      makeHoliday('2025-04-05', '清明節翌日', 'SH'),
    ];
    const ph = getExpectedPublicHolidayGrants('2025-04-01', 'PH', h, new Date('2025-04-30'));
    const sh = getExpectedPublicHolidayGrants('2025-04-01', 'SH', h, new Date('2025-04-30'));
    expect(ph).toHaveLength(1);
    expect(ph[0].reference_public_holiday_id).toBe('PH-2025-04-04');
    expect(sh).toHaveLength(1);
    expect(sh[0].reference_public_holiday_id).toBe('SH-2025-04-05');
  });

  it('無假期月份不產生 row', () => {
    const h = [makeHoliday('2025-05-01', '勞動節', 'PH')];
    const result = getExpectedPublicHolidayGrants('2025-04-01', 'PH', h, new Date('2025-06-01'));
    expect(result.map((r) => r.record_date)).toEqual(['2025-05-01']);
  });

  it('跨年發放', () => {
    const h = [
      makeHoliday('2025-12-25', '聖誕節', 'PH'),
      makeHoliday('2026-01-01', '元旦', 'PH'),
    ];
    const result = getExpectedPublicHolidayGrants('2025-11-01', 'PH', h, new Date('2026-01-05'));
    expect(result.map((r) => r.record_date)).toEqual(['2025-12-01', '2026-01-01']);
  });
});

describe('getPublicHolidaysForMonth', () => {
  it('統計指定年月 PH 數目', () => {
    const h = [
      makeHoliday('2025-04-04', '清明節', 'PH'),
      makeHoliday('2025-04-18', '耶穌受難節', 'PH'),
      makeHoliday('2025-05-01', '勞動節', 'PH'),
    ];
    const result = getPublicHolidaysForMonth(h, 2025, 4, 'PH');
    expect(result.count).toBe(2);
    expect(result.holidays.map((x) => x.holiday_date)).toEqual(['2025-04-04', '2025-04-18']);
  });

  it('SH 與 PH 不混淆', () => {
    const h = [
      makeHoliday('2025-04-04', '清明節', 'PH'),
      makeHoliday('2025-04-05', '清明節翌日', 'SH'),
    ];
    expect(getPublicHolidaysForMonth(h, 2025, 4, 'PH').count).toBe(1);
    expect(getPublicHolidaysForMonth(h, 2025, 4, 'SH').count).toBe(1);
  });
});

describe('getValidSubstituteDates', () => {
  it('返回與假期同月的所有日期', () => {
    const dates = getValidSubstituteDates('2025-04-04', 2025, 4);
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2025-04-01');
    expect(dates[dates.length - 1]).toBe('2025-04-30');
  });

  it('假期與目標月份不同 → 空', () => {
    expect(getValidSubstituteDates('2025-04-04', 2025, 5)).toEqual([]);
  });
});

describe('addDays', () => {
  it('跨月加天數', () => {
    expect(addDays('2025-04-04', 30)).toBe('2025-05-04');
  });

  it('跨年加天數', () => {
    expect(addDays('2025-12-25', 30)).toBe('2026-01-24');
  });
});
