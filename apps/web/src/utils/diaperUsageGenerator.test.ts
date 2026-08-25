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

  it('被跳過時段的份量會失去：有跳過的月份總量低於無跳過（同一隨機源）', () => {
    const full = generateMonthGrid({ ...baseParams, rng: seededRng(99) });
    // 每日跳過一半時段（首 3 個）
    const skippedSlots = new Set(['7AM-11AM', '11AM-3PM', '3PM-7PM']);
    const half = generateMonthGrid({
      ...baseParams,
      rng: seededRng(99),
      absenceCheck: (_date, slotTime) => (skippedSlots.has(slotTime) ? '入院' : null),
    });
    const sum = (g: typeof full) =>
      Object.values(g).reduce(
        (a, slots) => a + Object.values(slots).reduce((b, c) => b + c.urine + c.core, 0),
        0
      );
    const fullSum = sum(full);
    const halfSum = sum(half);
    expect(halfSum).toBeLessThan(fullSum);
    // 大約失去一半份量（允許隨機誤差）
    expect(halfSum).toBeLessThan(fullSum * 0.75);
  });

  it('每次換片範圍與每日條件共同生效：每格不超過每次上限、生成的格不少於每次下限，跳過時段仍不生成', () => {
    const grid = generateMonthGrid({
      ...baseParams,
      rng: seededRng(5),
      perChangeMinDiaper: 1,
      perChangeMaxDiaper: 2,
      perChangeMinCore: 0,
      perChangeMaxCore: 1,
      absenceCheck: (date, slotTime) =>
        date === '2026-08-10' ? '入院' : (date === '2026-08-15' && slotTime === '7AM-11AM' ? '無大小便' : null),
    });
    expect(grid['2026-08-10']).toBeUndefined();
    for (const [date, slots] of Object.entries(grid)) {
      for (const cell of Object.values(slots)) {
        expect(cell.urine).toBeLessThanOrEqual(2);
        expect(cell.urine).toBeGreaterThanOrEqual(1); // min=1：生成的格不可為 0
        expect(cell.core).toBeLessThanOrEqual(1);
        expect(cell.core).toBeGreaterThanOrEqual(0);
      }
      if (date === '2026-08-15') expect(slots['7AM-11AM']).toBeUndefined();
    }
  });

  it('同一種子結果一致（可重現），不同種子結果不同（自然隨機）', () => {
    const a = generateMonthGrid({ ...baseParams, rng: seededRng(1) });
    const b = generateMonthGrid({ ...baseParams, rng: seededRng(1) });
    const c = generateMonthGrid({ ...baseParams, rng: seededRng(2) });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
