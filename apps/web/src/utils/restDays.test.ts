import { describe, it, expect } from 'vitest';
import {
  weeklyRestDays,
  splitRestDays,
  getExpectedRestDayGrants,
  countSundaysInMonth,
  getExpectedMonthlyRestDays,
} from './restDays';

// 2026-08-04 是星期二；2026-08-02 是周日
const TUESDAY = new Date(2026, 7, 4);

describe('weeklyRestDays', () => {
  it('5 天工作 → 2 天休息', () => {
    expect(weeklyRestDays(5)).toBe(2);
  });
  it('5.5 天工作 → 1.5 天休息', () => {
    expect(weeklyRestDays(5.5)).toBe(1.5);
  });
  it('6 天工作 → 1 天休息', () => {
    expect(weeklyRestDays(6)).toBe(1);
  });
});

describe('splitRestDays', () => {
  it('5 天工作 → integerDO=2, fraction=0', () => {
    expect(splitRestDays(5)).toEqual({ integerDO: 2, fraction: 0 });
  });
  it('5.5 天工作 → integerDO=1, fraction=0.5', () => {
    expect(splitRestDays(5.5)).toEqual({ integerDO: 1, fraction: 0.5 });
  });
  it('6 天工作 → integerDO=1, fraction=0', () => {
    expect(splitRestDays(6)).toEqual({ integerDO: 1, fraction: 0 });
  });
});

describe('getExpectedRestDayGrants', () => {
  it('無起始日或無每周工作天數 → 空', () => {
    expect(getExpectedRestDayGrants(null, 5, TUESDAY)).toEqual({ grants: [], totalFraction: 0 });
    expect(getExpectedRestDayGrants('2026-08-01', null, TUESDAY)).toEqual({
      grants: [],
      totalFraction: 0,
    });
  });

  it('起始日在未來 → 空', () => {
    expect(getExpectedRestDayGrants('2026-08-10', 5, TUESDAY)).toEqual({
      grants: [],
      totalFraction: 0,
    });
  });

  it('起始日當日發放一次整數 DO', () => {
    expect(getExpectedRestDayGrants('2026-08-04', 6, TUESDAY)).toEqual({
      grants: [{ record_date: '2026-08-04', days: 1 }],
      totalFraction: 0,
    });
  });

  it('起始日後逢周日發放整數 DO（周二入職 → 首個周日為 8-09）', () => {
    // today = 2026-08-23（周日）：8-17 周二起始 → 8-23 周日一筆
    const result = getExpectedRestDayGrants('2026-08-17', 5, new Date(2026, 7, 23));
    expect(result.grants).toEqual([
      { record_date: '2026-08-17', days: 2 },
      { record_date: '2026-08-23', days: 2 },
    ]);
  });

  it('起始日本身是周日 → 下一次發放為 7 日後的周日', () => {
    // 起始 2026-08-02（周日），today 2026-08-16（周日）
    const result = getExpectedRestDayGrants('2026-08-02', 5, new Date(2026, 7, 16));
    expect(result.grants).toEqual([
      { record_date: '2026-08-02', days: 2 },
      { record_date: '2026-08-09', days: 2 },
      { record_date: '2026-08-16', days: 2 },
    ]);
  });

  it('每周工作 5.5 天 → 只發整數 DO 1 天，fraction 0.5 累積', () => {
    const result = getExpectedRestDayGrants('2026-08-04', 5.5, TUESDAY);
    expect(result.grants).toEqual([{ record_date: '2026-08-04', days: 1 }]);
    expect(result.totalFraction).toBe(0.5);
  });

  it('無效每周工作天數（>6）→ 不產生獲得行', () => {
    const result = getExpectedRestDayGrants('2026-08-04', 6.5, TUESDAY);
    expect(result.grants).toEqual([]);
    expect(result.totalFraction).toBe(0);
  });

  it('跨越月份星期計算正確', () => {
    // 起始 2026-08-31（周一），today 2026-09-07（周一）→ 周日 9-06 一筆
    const result = getExpectedRestDayGrants('2026-08-31', 5, new Date(2026, 8, 7));
    expect(result.grants).toEqual([
      { record_date: '2026-08-31', days: 2 },
      { record_date: '2026-09-06', days: 2 },
    ]);
  });

  it('累積 fraction 計算正確（5.5 天工作，3 周）', () => {
    // 起始 2026-08-02（周日），today 2026-08-16（周日）→ 3 次發放（含起始日 + 8-09 + 8-16）
    const result = getExpectedRestDayGrants('2026-08-02', 5.5, new Date(2026, 7, 16));
    expect(result.grants).toHaveLength(3);
    expect(result.totalFraction).toBe(1.5);
  });
});

describe('countSundaysInMonth', () => {
  it('2026-08 有 5 個周日', () => {
    expect(countSundaysInMonth(2026, 8)).toBe(5);
  });
  it('2026-09 有 4 個周日', () => {
    expect(countSundaysInMonth(2026, 9)).toBe(4);
  });
  it('受 startDate 限制時只計入職後周日', () => {
    expect(countSundaysInMonth(2026, 8, '2026-08-10')).toBe(3);
  });
});

describe('getExpectedMonthlyRestDays', () => {
  it('每周工作 5 天，8 月 5 個周日 → 10 DO, 0 PRD', () => {
    expect(getExpectedMonthlyRestDays(5, 2026, 8, 0)).toEqual({
      doDays: 10,
      prdDays: 0,
      totalFraction: 0,
      leftoverFraction: 0,
    });
  });

  it('每周工作 5.5 天，8 月 5 個周日，fraction 0 → 5 DO, 2 PRD', () => {
    expect(getExpectedMonthlyRestDays(5.5, 2026, 8, 0)).toEqual({
      doDays: 5,
      prdDays: 2,
      totalFraction: 2.5,
      leftoverFraction: 0.5,
    });
  });

  it('每周工作 5.5 天，9 月 4 個周日，帶入 1.0 fraction → 4 DO, 3 PRD', () => {
    expect(getExpectedMonthlyRestDays(5.5, 2026, 9, 1.0)).toEqual({
      doDays: 4,
      prdDays: 3,
      totalFraction: 3.0,
      leftoverFraction: 0,
    });
  });

});
