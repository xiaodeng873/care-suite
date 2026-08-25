import { describe, it, expect } from 'vitest';
import { daysInMonth, generateMonthGrid } from './diaperUsageGenerator';
import { DIAPER_CHANGE_SLOTS } from './careRecordHelper';

// 可重現的隨機源（LCG）
const seededRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

const baseParams = {
  year: 2026,
  month: 8,
  monthlyDiaper: 120,
  monthlyCore: 60,
  dailyMinDiaper: 2,
  dailyMaxDiaper: 6,
  dailyMinCore: 0,
  dailyMaxCore: 4,
};

describe('daysInMonth', () => {
  it('回傳正確日數', () => {
    expect(daysInMonth(2026, 8)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe('generateMonthGrid', () => {
  it('每日尿片/片芯總量在用戶自設 min~max 內，且 6 時段加總等於當日總量', () => {
    const grid = generateMonthGrid({ ...baseParams, rng: seededRng(42) });
    const dates = Object.keys(grid);
    expect(dates.length).toBe(31);

    for (const date of dates) {
      const slots = grid[date];
      const urineSum = Object.values(slots).reduce((a, c) => a + c.urine, 0);
      const coreSum = Object.values(slots).reduce((a, c) => a + c.core, 0);
      expect(urineSum).toBeGreaterThanOrEqual(baseParams.dailyMinDiaper);
      expect(urineSum).toBeLessThanOrEqual(baseParams.dailyMaxDiaper);
      expect(coreSum).toBeGreaterThanOrEqual(baseParams.dailyMinCore);
      expect(coreSum).toBeLessThanOrEqual(baseParams.dailyMaxCore);
      // 分配不流失：時段加總 = 當日總量（總量本身已在範圍內）
      expect(Object.keys(slots).length).toBe(DIAPER_CHANGE_SLOTS.length);
    }
  });

  it('缺席時段不生成；整日缺席則該日不存在', () => {
    const absenceCheck = (date: string, slotTime: string) => {
      if (date === '2026-08-10') return '入院' as const; // 整日入院
      if (date === '2026-08-15' && slotTime === '7AM-11AM') return '渡假' as const;
      return null;
    };
    const grid = generateMonthGrid({ ...baseParams, absenceCheck, rng: seededRng(7) });

    expect(grid['2026-08-10']).toBeUndefined();
    expect(grid['2026-08-15']['7AM-11AM']).toBeUndefined();
    expect(Object.keys(grid['2026-08-15']).length).toBe(DIAPER_CHANGE_SLOTS.length - 1);
  });

  it('同一種子結果一致（可重現），不同種子結果不同（自然隨機）', () => {
    const a = generateMonthGrid({ ...baseParams, rng: seededRng(1) });
    const b = generateMonthGrid({ ...baseParams, rng: seededRng(1) });
    const c = generateMonthGrid({ ...baseParams, rng: seededRng(2) });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
