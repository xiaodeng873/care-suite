import { describe, it, expect } from 'vitest';
import { getExpectedRestDayGrants } from './restDays';

// 2026-08-04 是星期二；2026-08-02 是周日
const TUESDAY = new Date(2026, 7, 4);

describe('getExpectedRestDayGrants', () => {
  it('無起始日或無每周天數 → 空', () => {
    expect(getExpectedRestDayGrants(null, 1, TUESDAY)).toEqual([]);
    expect(getExpectedRestDayGrants('2026-08-01', null, TUESDAY)).toEqual([]);
    expect(getExpectedRestDayGrants('2026-08-01', 0, TUESDAY)).toEqual([]);
  });

  it('起始日在未來 → 空', () => {
    expect(getExpectedRestDayGrants('2026-08-10', 1, TUESDAY)).toEqual([]);
  });

  it('起始日當日發放一次', () => {
    expect(getExpectedRestDayGrants('2026-08-04', 1, TUESDAY)).toEqual([
      { record_date: '2026-08-04', days: 1 },
    ]);
  });

  it('起始日後逢周日發放（周二入職 → 首個周日為 8-09）', () => {
    // today = 2026-08-23（周日）：8-17 周二起始 → 8-23 周日一筆
    const rows = getExpectedRestDayGrants('2026-08-17', 1, new Date(2026, 7, 23));
    expect(rows).toEqual([
      { record_date: '2026-08-17', days: 1 },
      { record_date: '2026-08-23', days: 1 },
    ]);
  });

  it('起始日本身是周日 → 下一次發放為 7 日後的周日', () => {
    // 起始 2026-08-02（周日），today 2026-08-16（周日）
    const rows = getExpectedRestDayGrants('2026-08-02', 1, new Date(2026, 7, 16));
    expect(rows).toEqual([
      { record_date: '2026-08-02', days: 1 },
      { record_date: '2026-08-09', days: 1 },
      { record_date: '2026-08-16', days: 1 },
    ]);
  });

  it('每周休息日可為 0.5 的倍數', () => {
    const rows = getExpectedRestDayGrants('2026-08-04', 1.5, TUESDAY);
    expect(rows).toEqual([{ record_date: '2026-08-04', days: 1.5 }]);
  });

  it('跨越月份星期計算正確', () => {
    // 起始 2026-08-31（周一），today 2026-09-07（周一）→ 周日 9-06 一筆
    const rows = getExpectedRestDayGrants('2026-08-31', 1, new Date(2026, 8, 7));
    expect(rows).toEqual([
      { record_date: '2026-08-31', days: 1 },
      { record_date: '2026-09-06', days: 1 },
    ]);
  });
});
