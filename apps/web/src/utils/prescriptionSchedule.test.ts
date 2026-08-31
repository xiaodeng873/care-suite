import { describe, it, expect } from 'vitest';
import { isPrescriptionScheduledOnDate, computeNextDoseFromLastTaken } from './prescriptionSchedule';

describe('prescriptionSchedule · every_x_weeks', () => {
  const base = {
    frequency_type: 'every_x_weeks',
    frequency_value: 1, // 每1星期 = 每星期（週期 7 天）
    start_date: '2026-08-03',
    end_date: null,
  };

  it('按週期 N×7 天推算服藥日', () => {
    expect(isPrescriptionScheduledOnDate(base, '2026-08-03')).toBe(true);  // 開始日
    expect(isPrescriptionScheduledOnDate(base, '2026-08-10')).toBe(true);  // +7
    expect(isPrescriptionScheduledOnDate(base, '2026-08-17')).toBe(true);  // +14
    expect(isPrescriptionScheduledOnDate(base, '2026-08-24')).toBe(true);    // +21
    expect(isPrescriptionScheduledOnDate(base, '2026-08-07')).toBe(false); // +4
  });

  it('開始日之前永遠唔係服藥日', () => {
    expect(isPrescriptionScheduledOnDate(base, '2026-08-02')).toBe(false);
  });
});

describe('prescriptionSchedule · last_taken_date 錨點', () => {
  it('每X月：目標日 ≥ 上次服用日時以上次服用日重定週期', () => {
    const p = {
      frequency_type: 'every_x_months',
      frequency_value: 2, // 每2月
      start_date: '2026-01-10',
      end_date: null,
      last_taken_date: '2026-08-15',
    };
    // 新錨點：8/15 → 10/15 → 12/15
    expect(isPrescriptionScheduledOnDate(p, '2026-08-15')).toBe(true);
    expect(isPrescriptionScheduledOnDate(p, '2026-10-15')).toBe(true);
    expect(isPrescriptionScheduledOnDate(p, '2026-11-15')).toBe(false);
    expect(isPrescriptionScheduledOnDate(p, '2026-10-10')).toBe(false); // 舊 start 週期日已失效
    // 歷史段（早於上次服用日）沿用 start 週期：1/10, 3/10, 5/10, 7/10
    expect(isPrescriptionScheduledOnDate(p, '2026-07-10')).toBe(true);
  });

  it('每X日：last_taken_date 重定錨點', () => {
    const p = {
      frequency_type: 'every_x_days',
      frequency_value: 1, // 每1日 = 每日
      start_date: '2026-08-01',
      end_date: null,
      last_taken_date: '2026-08-10',
    };
    expect(isPrescriptionScheduledOnDate(p, '2026-08-10')).toBe(true);
    expect(isPrescriptionScheduledOnDate(p, '2026-08-11')).toBe(true);
    expect(isPrescriptionScheduledOnDate(p, '2026-08-12')).toBe(true);
  });

  it('last_taken_date 早於 start_date 視為無效，沿用 start', () => {
    const p = {
      frequency_type: 'every_x_days',
      frequency_value: 2, // 每2日
      start_date: '2026-08-10',
      end_date: null,
      last_taken_date: '2026-08-01',
    };
    expect(isPrescriptionScheduledOnDate(p, '2026-08-10')).toBe(true);
    expect(isPrescriptionScheduledOnDate(p, '2026-08-12')).toBe(true);
    expect(isPrescriptionScheduledOnDate(p, '2026-08-11')).toBe(false);
  });
});

describe('computeNextDoseFromLastTaken', () => {
  it('每X日：+ N 天', () => {
    expect(computeNextDoseFromLastTaken('every_x_days', 1, '2026-08-10')).toBe('2026-08-11');
  });

  it('每X星期：+ N×7 天', () => {
    expect(computeNextDoseFromLastTaken('every_x_weeks', 1, '2026-08-10')).toBe('2026-08-17');
    expect(computeNextDoseFromLastTaken('every_x_weeks', 3, '2026-08-10')).toBe('2026-08-31');
  });

  it('每X月：+ N 個月', () => {
    expect(computeNextDoseFromLastTaken('every_x_months', 2, '2026-08-15')).toBe('2026-10-15');
  });

  it('非間隔型或缺日期回傳空字串', () => {
    expect(computeNextDoseFromLastTaken('daily', 1, '2026-08-10')).toBe('');
    expect(computeNextDoseFromLastTaken('every_x_weeks', 1, '')).toBe('');
    expect(computeNextDoseFromLastTaken('every_x_weeks', 1, null)).toBe('');
  });
});
