import { describe, it, expect } from 'vitest';
import {
  weeklyRestDays,
  splitRestDays,
  getExpectedRestDayGrants,
  getExpectedMonthlyRestDays,
} from './restDays';

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

  it('每周 6 天工作：只發放星期日', () => {
    // 2026-08-04（周二）入職，6 天工作 → 8/9（周日）首次發放 1 DO
    const result = getExpectedRestDayGrants('2026-08-04', 6, new Date(2026, 7, 9));
    expect(result.grants).toEqual([{ record_date: '2026-08-09', days: 1 }]);
    expect(result.totalFraction).toBe(0);
  });

  it('每周 5.5 天工作：星期日發 1 DO，星期六累積 0.5 PRD', () => {
    // 2026-08-04（周二）入職，5.5 天工作 → 8/9（周日）1 DO，8/8（周六）0.5 PRD
    const result = getExpectedRestDayGrants('2026-08-04', 5.5, new Date(2026, 7, 9));
    expect(result.grants).toEqual([{ record_date: '2026-08-09', days: 1 }]);
    expect(result.totalFraction).toBe(0.5);
  });

  it('每周 5 天工作：星期六、星期日各發 1 DO', () => {
    // 2026-08-04（周二）入職，5 天工作 → 8/8（周六）、8/9（周日）各 1 DO
    const result = getExpectedRestDayGrants('2026-08-04', 5, new Date(2026, 7, 9));
    expect(result.grants).toEqual([
      { record_date: '2026-08-08', days: 1 },
      { record_date: '2026-08-09', days: 1 },
    ]);
    expect(result.totalFraction).toBe(0);
  });

  it('無效每周工作天數（>6）→ 不產生獲得行', () => {
    const result = getExpectedRestDayGrants('2026-08-04', 6.5, TUESDAY);
    expect(result.grants).toEqual([]);
    expect(result.totalFraction).toBe(0);
  });

  it('跨越月份 7 天計算正確', () => {
    // 2026-08-31（周一）入職，5 天工作 → 9/5、9/6、9/12、9/13、9/19、9/20、9/26、9/27
    const result = getExpectedRestDayGrants('2026-08-31', 5, new Date(2026, 8, 30));
    expect(result.grants).toEqual([
      { record_date: '2026-09-05', days: 1 },
      { record_date: '2026-09-06', days: 1 },
      { record_date: '2026-09-12', days: 1 },
      { record_date: '2026-09-13', days: 1 },
      { record_date: '2026-09-19', days: 1 },
      { record_date: '2026-09-20', days: 1 },
      { record_date: '2026-09-26', days: 1 },
      { record_date: '2026-09-27', days: 1 },
    ]);
  });

  it('累積 fraction 計算正確（5.5 天工作，9 月 4 個星期六）', () => {
    // 2026-09-01 起 5.5 天工作，9 月 4 個星期六 → 4 × 0.5 = 2.0 fraction
    const result = getExpectedRestDayGrants('2026-09-01', 5.5, new Date(2026, 8, 30));
    expect(result.grants).toHaveLength(4); // 4 個星期日
    expect(result.totalFraction).toBe(2);
  });
});

describe('getExpectedMonthlyRestDays', () => {
  it('每周 5 天工作，起始日為月初', () => {
    // 2026-08-01（周六）入職，5 天工作 → 8 月 5 個星期六 + 5 個星期日 = 10 DO
    expect(getExpectedMonthlyRestDays(5, 2026, 8, '2026-08-01')).toEqual({
      doDays: 10,
      prdDays: 0,
      totalFraction: 0,
      leftoverFraction: 0,
    });
  });

  it('每周 5.5 天工作，起始日為月初', () => {
    // 2026-08-01（周六）入職，5.5 天工作 → 5 個星期日 DO + 5 個星期六 × 0.5 = 2.5 PRD
    expect(getExpectedMonthlyRestDays(5.5, 2026, 8, '2026-08-01')).toEqual({
      doDays: 5,
      prdDays: 2,
      totalFraction: 2.5,
      leftoverFraction: 0.5,
    });
  });

  it('每周 6 天工作，起始日為月初', () => {
    // 2026-08-01（周六）入職，6 天工作 → 8 月 5 個星期日 = 5 DO
    expect(getExpectedMonthlyRestDays(6, 2026, 8, '2026-08-01')).toEqual({
      doDays: 5,
      prdDays: 0,
      totalFraction: 0,
      leftoverFraction: 0,
    });
  });

  it('每周 6 天工作，9 月有 4 個星期日', () => {
    expect(getExpectedMonthlyRestDays(6, 2026, 9, '2026-09-01')).toEqual({
      doDays: 4,
      prdDays: 0,
      totalFraction: 0,
      leftoverFraction: 0,
    });
  });

  it('每周 5.5 天工作，受僱日中旬入職，只計算當月餘下星期日/六', () => {
    // 2026-08-20（周四）入職，5.5 天工作 → 8/23、8/30 兩個星期日 + 8/22、8/29 兩個星期六
    expect(getExpectedMonthlyRestDays(5.5, 2026, 8, '2026-08-20')).toEqual({
      doDays: 2,
      prdDays: 1,
      totalFraction: 1.0,
      leftoverFraction: 0,
    });
  });

  it('起始日在目標月之前，只計算當月內合資格日', () => {
    // 2026-07-15（周三）入職，5.5 天工作 → 8 月 5 個星期日 + 5 個星期六 × 0.5
    expect(getExpectedMonthlyRestDays(5.5, 2026, 8, '2026-07-15')).toEqual({
      doDays: 5,
      prdDays: 2,
      totalFraction: 2.5,
      leftoverFraction: 0.5,
    });
  });

  it('起始日在目標月之後 → 無獲得', () => {
    expect(getExpectedMonthlyRestDays(5.5, 2026, 8, '2026-09-01')).toEqual({
      doDays: 0,
      prdDays: 0,
      totalFraction: 0,
      leftoverFraction: 0,
    });
  });

  it('只顯示當月獲得量，不帶入累積 fraction', () => {
    // 2026-08-01 入職，5.5 天工作，8 月 5 個星期日 + 5 個星期六 × 0.5
    expect(getExpectedMonthlyRestDays(5.5, 2026, 8, '2026-08-01')).toEqual({
      doDays: 5,
      prdDays: 2,
      totalFraction: 2.5,
      leftoverFraction: 0.5,
    });
  });
});
