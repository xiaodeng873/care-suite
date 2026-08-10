import { describe, it, expect } from 'vitest';
import {
  weeklyRestDays,
  splitRestDays,
  getExpectedRestDayGrants,
  getExpectedMonthlyRestDays,
} from './restDays';

// 2026-08-04 是星期二
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

  it('每周 5 天工作：受僱日 + 5 天後首次發放 2 DO', () => {
    // 2026-08-04（周二）入職，5 天工作 → 8/9（周日）首次發放 2 DO
    const result = getExpectedRestDayGrants('2026-08-04', 5, new Date(2026, 7, 9));
    expect(result.grants).toEqual([{ record_date: '2026-08-09', days: 2 }]);
    expect(result.totalFraction).toBe(0);
  });

  it('每周 5.5 天工作：第 6 天發放 1 DO + 0.5 PRD', () => {
    // 2026-08-04（周二）入職，5.5 天工作 → 8/9（周日）首次發放 1 DO，累積 0.5 fraction
    const result = getExpectedRestDayGrants('2026-08-04', 5.5, new Date(2026, 7, 9));
    expect(result.grants).toEqual([{ record_date: '2026-08-09', days: 1 }]);
    expect(result.totalFraction).toBe(0.5);
  });

  it('之後每 7 天發放一次', () => {
    // 2026-08-04（周二）入職，5 天工作 → 8/9、8/16、8/23 共三筆 2 DO
    const result = getExpectedRestDayGrants('2026-08-04', 5, new Date(2026, 7, 23));
    expect(result.grants).toEqual([
      { record_date: '2026-08-09', days: 2 },
      { record_date: '2026-08-16', days: 2 },
      { record_date: '2026-08-23', days: 2 },
    ]);
  });

  it('每周 6 天工作：受僱日 + 6 天後首次發放 1 DO', () => {
    // 2026-08-04（周二）入職，6 天工作 → 8/10（周一）首次發放 1 DO
    const result = getExpectedRestDayGrants('2026-08-04', 6, new Date(2026, 7, 10));
    expect(result.grants).toEqual([{ record_date: '2026-08-10', days: 1 }]);
  });

  it('無效每周工作天數（>6）→ 不產生獲得行', () => {
    const result = getExpectedRestDayGrants('2026-08-04', 6.5, TUESDAY);
    expect(result.grants).toEqual([]);
    expect(result.totalFraction).toBe(0);
  });

  it('跨越月份 7 天計算正確', () => {
    // 2026-08-31（周一）入職，5 天工作 → 9/5（周六）首次發放，9/12 第二筆
    const result = getExpectedRestDayGrants('2026-08-31', 5, new Date(2026, 8, 12));
    expect(result.grants).toEqual([
      { record_date: '2026-09-05', days: 2 },
      { record_date: '2026-09-12', days: 2 },
    ]);
  });

  it('累積 fraction 計算正確（5.5 天工作，3 次發放）', () => {
    // 2026-08-04（周二）入職，5.5 天工作 → 8/9、8/16、8/23 三次發放
    const result = getExpectedRestDayGrants('2026-08-04', 5.5, new Date(2026, 7, 23));
    expect(result.grants).toHaveLength(3);
    expect(result.totalFraction).toBe(1.5);
  });
});

describe('getExpectedMonthlyRestDays', () => {
  it('每周 5 天工作，起始日為月初，次月才首次發放', () => {
    // 2026-08-01（周六）入職，5 天工作 → 首次發放 8/06；8 月 8/06、8/13、8/20、8/27 共 4 次
    expect(getExpectedMonthlyRestDays(5, 2026, 8, '2026-08-01')).toEqual({
      doDays: 8,
      prdDays: 0,
      totalFraction: 0,
      leftoverFraction: 0,
    });
  });

  it('每周 5.5 天工作，起始日為月初', () => {
    // 2026-08-01（周六）入職，5.5 天工作 → 首次發放 8/06；8 月 4 次
    expect(getExpectedMonthlyRestDays(5.5, 2026, 8, '2026-08-01')).toEqual({
      doDays: 4,
      prdDays: 2,
      totalFraction: 2.0,
      leftoverFraction: 0,
    });
  });

  it('每周 5.5 天工作，受僱日中旬入職，只計算當月內事件', () => {
    // 2026-08-20（周四）入職，5.5 天工作 → 首次發放 8/25；8 月僅 8/25 一次
    expect(getExpectedMonthlyRestDays(5.5, 2026, 8, '2026-08-20')).toEqual({
      doDays: 1,
      prdDays: 0,
      totalFraction: 0.5,
      leftoverFraction: 0.5,
    });
  });

  it('起始日在目標月之前，只計算當月內事件', () => {
    // 2026-07-15（周三）入職，5.5 天工作 → 首次發放 7/20；8 月落在 8/03、8/10、8/17、8/24、8/31 共 5 次
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
    // 2026-08-01 入職，5.5 天工作，8 月 4 次；即使累積了 fraction，當月預估仍是 2.0
    expect(getExpectedMonthlyRestDays(5.5, 2026, 8, '2026-08-01')).toEqual({
      doDays: 4,
      prdDays: 2,
      totalFraction: 2.0,
      leftoverFraction: 0,
    });
  });
});
