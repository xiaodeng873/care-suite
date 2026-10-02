import { describe, it, expect } from 'vitest';
import { mapOCRDataToPrescriptionForm } from './ocrFieldMapper';

describe('mapOCRDataToPrescriptionForm 取代前綴', () => {
  it('「晚上2次」→ slot 晚上 + replacePrefix + daily_frequency=2', () => {
    const { formData } = mapOCRDataToPrescriptionForm(
      { 服用時段: ['晚上2次'] }, { 服用時段: 0.9 }, [],
    );
    expect(formData.meal_timings?.slots).toEqual(['晚上']);
    expect(formData.meal_timings?.replacePrefix).toEqual([true]);
    expect(formData.daily_frequency).toBe(2);
  });

  it('「臨睡前1次」→ replacePrefix + daily_frequency=1', () => {
    const { formData } = mapOCRDataToPrescriptionForm(
      { 服用時段: '臨睡前1次' }, {}, [],
    );
    expect(formData.meal_timings?.slots).toEqual(['臨睡前']);
    expect(formData.meal_timings?.replacePrefix).toEqual([true]);
    expect(formData.daily_frequency).toBe(1);
  });

  it('中文數字「上午二次」都識', () => {
    const { formData } = mapOCRDataToPrescriptionForm(
      { 服用時段: ['上午二次'] }, {}, [],
    );
    expect(formData.meal_timings?.slots).toEqual(['上午']);
    expect(formData.daily_frequency).toBe(2);
  });

  it('多時段「早上1次或晚上2次」→ 兩個都標記，次數取最後一個', () => {
    const { formData } = mapOCRDataToPrescriptionForm(
      { 服用時段: '早上1次或晚上2次' }, {}, [],
    );
    expect(formData.meal_timings?.slots).toEqual(['早上', '晚上']);
    expect(formData.meal_timings?.replacePrefix).toEqual([true, true]);
    expect(formData.meal_timings?.connectors).toEqual(['或']);
    expect(formData.daily_frequency).toBe(2);
  });

  it('普通時段（餐後）唔會誤標 replacePrefix', () => {
    const { formData } = mapOCRDataToPrescriptionForm(
      { 服用時段: ['餐後', '睡前'] }, {}, [],
    );
    expect(formData.meal_timings?.replacePrefix).toEqual([false, false]);
    expect(formData.daily_frequency).toBeUndefined();
  });

  it('「午夜1次」→ slot 午夜', () => {
    const { formData } = mapOCRDataToPrescriptionForm(
      { 服用時段: ['午夜1次'] }, {}, [],
    );
    expect(formData.meal_timings?.slots).toEqual(['午夜']);
    expect(formData.meal_timings?.replacePrefix).toEqual([true]);
  });

  it('服用日數：結束日 = 開始日 + 日數 - 1，結束時間取最早時間點', () => {
    const { formData } = mapOCRDataToPrescriptionForm(
      {
        處方日期: '2026-09-29',
        服用日數: '4日',
        服用時間: ['08:00', '20:00'],
      },
      {}, [],
    );
    expect(formData.end_date).toBe('2026-10-02');
    expect(formData.end_time).toBe('08:00');
  });
});
