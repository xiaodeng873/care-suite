import { describe, it, expect } from 'vitest';
import { roundHalf, addMonthsClamped, getExpectedAnnualLeaveGrants } from './annualLeave';

describe('roundHalf', () => {
  it('四捨五入至最近 0.5', () => {
    expect(roundHalf(1.75)).toBe(2.0);
    expect(roundHalf(1.24)).toBe(1.0);
    expect(roundHalf(1.25)).toBe(1.5);
    expect(roundHalf(1.26)).toBe(1.5);
    expect(roundHalf(1.74)).toBe(1.5);
    expect(roundHalf(0.25)).toBe(0.5);
    expect(roundHalf(0.24)).toBe(0);
    expect(roundHalf(7)).toBe(7);
  });
});

describe('addMonthsClamped', () => {
  it('普通月份直接加', () => {
    expect(addMonthsClamped('2026-06-01', 3)).toBe('2026-09-01');
    expect(addMonthsClamped('2026-06-15', 1)).toBe('2026-07-15');
  });

  it('跨年', () => {
    expect(addMonthsClamped('2026-11-10', 3)).toBe('2027-02-10');
  });

  it('月底截斷到目標月最後一日，且不永久漂移', () => {
    // 1月31日 入職：2月取 28 日，3月回到 31 日，4月取 30 日
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30');
    // 閏年 2月29日
    expect(addMonthsClamped('2024-01-31', 1)).toBe('2024-02-29');
  });
});

describe('getExpectedAnnualLeaveGrants', () => {
  it('無 Y 或無 startDate → 空陣列', () => {
    expect(getExpectedAnnualLeaveGrants(null, 7, new Date(2026, 7, 4))).toEqual([]);
    expect(getExpectedAnnualLeaveGrants('2026-01-01', null, new Date(2026, 7, 4))).toEqual([]);
    expect(getExpectedAnnualLeaveGrants('2026-01-01', 0, new Date(2026, 7, 4))).toEqual([]);
  });

  it('未滿 3 個月無獲得', () => {
    // 6月1日入職，8月31日仍未滿 3 個月
    expect(getExpectedAnnualLeaveGrants('2026-06-01', 12, new Date(2026, 7, 31))).toEqual([]);
  });

  it('滿 3 個月發放一筆 roundHalf(Y×3/12)', () => {
    // Y=7：7×3/12 = 1.75 → 2.0
    expect(getExpectedAnnualLeaveGrants('2026-06-01', 7, new Date(2026, 8, 1))).toEqual([
      { record_date: '2026-09-01', days: 2.0 },
    ]);
  });

  it('4..11 個月按差額逐月發放', () => {
    // Y=7，入職 2026-06-01，today = 2026-10-15（滿 4 個月）
    // k=3: roundHalf(1.75)=2.0
    // k=4: roundHalf(7×4/12=2.33)=2.5 − 2.0 = 0.5
    const rows = getExpectedAnnualLeaveGrants('2026-06-01', 7, new Date(2026, 9, 15));
    expect(rows).toEqual([
      { record_date: '2026-09-01', days: 2.0 },
      { record_date: '2026-10-01', days: 0.5 },
    ]);
  });

  it('略過 days=0 的月份', () => {
    // Y=7：k=5: roundHalf(2.917)=3.0 − 2.5 = 0.5；k=6: roundHalf(3.5)=3.5 − 3.0 = 0.5
    // Y=6：k=3: 1.5；k=4: roundHalf(2.0)−1.5 = 0.5；k=5: roundHalf(2.5)−2.0 = 0.5
    // 找一個有 0 增量的：Y=5 → k=3: roundHalf(1.25)=1.5；k=4: roundHalf(1.667)=1.5 − 1.5 = 0（略過）
    const rows = getExpectedAnnualLeaveGrants('2026-06-01', 5, new Date(2026, 9, 15));
    expect(rows).toEqual([
      { record_date: '2026-09-01', days: 1.5 },
    ]);
  });

  it('滿 12 個月補足首年全年 Y', () => {
    // Y=7，入職 2026-06-01，today = 2027-06-01（滿 12 個月）
    // 首年總和應 = 7；第 12 個月 = 7 − roundHalf(7×11/12=6.417)=7−6.5=0.5
    const rows = getExpectedAnnualLeaveGrants('2026-06-01', 7, new Date(2027, 5, 1));
    const total = rows.reduce((s, r) => s + r.days, 0);
    expect(total).toBe(7);
    expect(rows[rows.length - 1]).toEqual({ record_date: '2027-06-01', days: 0.5 });
  });

  it('滿一年後每個週年日一筆 Y，非週年月份不發放', () => {
    // 入職 2024-06-01，today = 2026-08-04（已過 24 個月週年，未滿 36 個月）
    const rows = getExpectedAnnualLeaveGrants('2024-06-01', 7, new Date(2026, 7, 4));
    const anniversaryRows = rows.filter(r => r.record_date.endsWith('-06-01'));
    expect(anniversaryRows).toContainEqual({ record_date: '2026-06-01', days: 7 });
    // 不應有 2026-07-01 的發放
    expect(rows.some(r => r.record_date === '2026-07-01')).toBe(false);
    // 最後一筆是 24 個月週年
    expect(rows[rows.length - 1]).toEqual({ record_date: '2026-06-01', days: 7 });
  });

  it('月底入職以每月最後一日為受僱日', () => {
    // 1月31日入職，4月30日滿 3 個月
    const rows = getExpectedAnnualLeaveGrants('2026-01-31', 12, new Date(2026, 3, 30));
    expect(rows).toEqual([{ record_date: '2026-04-30', days: 3 }]);
    // 4月29日仍未滿
    expect(getExpectedAnnualLeaveGrants('2026-01-31', 12, new Date(2026, 3, 29))).toEqual([]);
  });
});
