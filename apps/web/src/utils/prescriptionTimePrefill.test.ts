import { describe, it, expect } from 'vitest';
import { nextDoseTime, lastDoseDateTime } from './prescriptionTimePrefill';

describe('nextDoseTime', () => {
  it('取今日尚未過的最早時間點', () => {
    expect(nextDoseTime('11:00', ['08:00', '12:00', '16:00'])).toBe('12:00');
  });

  it('全部已過時取最早時間點（聽日第一次）', () => {
    expect(nextDoseTime('20:00', ['08:00', '12:00', '16:00'])).toBe('08:00');
  });

  it('剛好等於時間點時取該時間點', () => {
    expect(nextDoseTime('12:00', ['08:00', '12:00', '16:00'])).toBe('12:00');
  });

  it('容忍未排序及單位數字時間', () => {
    expect(nextDoseTime('07:30', ['8:00', '07:00'])).toBe('08:00');
  });

  it('無時間點或格式錯誤回傳 null', () => {
    expect(nextDoseTime('11:00', [])).toBeNull();
    expect(nextDoseTime('11:00', null)).toBeNull();
    expect(nextDoseTime('bad', ['08:00'])).toBeNull();
  });
});

describe('lastDoseDateTime', () => {
  const slots = ['08:00', '12:00', '16:00'];

  it('服用日數優先：開始日 + 日數 - 1，時間點取最後日最早一次', () => {
    expect(lastDoseDateTime({
      startDate: '2026-10-01',
      slots,
      dailyFrequency: 3,
      durationDays: 7,
    })).toEqual({ date: '2026-10-07', time: '08:00' });
  });

  it('用戶例子：29/9 20:00 首服、每日 8A/8P、服用 4 日 → 2/10 08:00', () => {
    expect(lastDoseDateTime({
      startDate: '2026-09-29',
      startTime: '20:00',
      slots: ['08:00', '20:00'],
      dailyFrequency: 2,
      durationDays: 4,
    })).toEqual({ date: '2026-10-02', time: '08:00' });
  });

  it('無服用日數時用結束日期，時間點取最早一次', () => {
    expect(lastDoseDateTime({
      startDate: '2026-10-01',
      slots,
      dailyFrequency: 3,
      endDate: '2026-10-05',
    })).toEqual({ date: '2026-10-05', time: '08:00' });
  });

  it('最後一日即開始日時，由開始時間起計', () => {
    expect(lastDoseDateTime({
      startDate: '2026-10-01',
      startTime: '12:00',
      slots,
      dailyFrequency: 3,
      durationDays: 1,
    })).toEqual({ date: '2026-10-01', time: '12:00' });
  });

  it('開始時間晚於全部時間點時 fallback 用全部時間點', () => {
    expect(lastDoseDateTime({
      startDate: '2026-10-01',
      startTime: '17:00',
      slots,
      dailyFrequency: 1,
      durationDays: 1,
    })).toEqual({ date: '2026-10-01', time: '08:00' });
  });

  it('無時間點 / 無日數資料回傳 null', () => {
    expect(lastDoseDateTime({ startDate: '2026-10-01', slots: [], durationDays: 7 })).toBeNull();
    expect(lastDoseDateTime({ startDate: '2026-10-01', slots })).toBeNull();
  });
});
