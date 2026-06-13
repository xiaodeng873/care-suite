import { formatTaskFrequency } from '../formatTaskFrequency';
import type { FrequencyUnit } from '../constants';

describe('formatTaskFrequency', () => {

  // 1. 探針彈
  it('每日 × 1 → 每1每日', () => {
    expect(formatTaskFrequency(1, 'daily')).toBe('每1每日');
  });

  // 2. 所有單位
  it('每小時 × 4', () => {
    expect(formatTaskFrequency(4, 'hourly')).toBe('每4每小時');
  });

  it('每週 × 2', () => {
    expect(formatTaskFrequency(2, 'weekly')).toBe('每2每週');
  });

  it('每月 × 3', () => {
    expect(formatTaskFrequency(3, 'monthly')).toBe('每3每月');
  });

  it('每年 × 1', () => {
    expect(formatTaskFrequency(1, 'yearly')).toBe('每1每年');
  });

  // 3. 邊界：value 為空字串時回退到 '1'（表單初始狀態）
  it('value 為空字串 → 回退到 1', () => {
    expect(formatTaskFrequency('' as unknown as number, 'daily')).toBe('每1每日');
  });

  // 4. 未知 unit → 回退到 unit key 本身
  it('未知 unit → 顯示 unit key', () => {
    expect(formatTaskFrequency(1, 'unknown' as FrequencyUnit)).toBe('每1unknown');
  });

});
