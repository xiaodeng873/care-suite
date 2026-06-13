import { isOverdue } from '../isOverdue';

const TODAY = new Date('2026-06-01T12:00:00Z');

describe('isOverdue', () => {

  // ─── 1. 明確過去日期（探針彈）────────────────────────────────────────────────
  it('過去日期 → true', () => {
    expect(isOverdue('2026-01-01', TODAY)).toBe(true);
  });

  // ─── 2. 未來日期 ────────────────────────────────────────────────────────────
  it('未來日期 → false', () => {
    expect(isOverdue('2026-12-31', TODAY)).toBe(false);
  });

  // ─── 3. null / 空字串 安全性 ─────────────────────────────────────────────────
  it('undefined → false', () => expect(isOverdue(undefined, TODAY)).toBe(false));
  it('空字串 → false', () => expect(isOverdue('', TODAY)).toBe(false));

  // ─── 4. 等於基準時間 → false（等於不算逾期）─────────────────────────────────
  it('完全等於 today → false', () => {
    expect(isOverdue('2026-06-01T12:00:00Z', TODAY)).toBe(false);
  });

  // ─── 5. datetime 字串時間邊界 ────────────────────────────────────────────────
  it('datetime 在 today 之後一秒 → false', () => {
    expect(isOverdue('2026-06-01T12:00:01Z', TODAY)).toBe(false);
  });

  it('datetime 在 today 之前一秒 → true', () => {
    expect(isOverdue('2026-06-01T11:59:59Z', TODAY)).toBe(true);
  });

  // ─── 6. date-only 字串：同日零時 UTC → 已逾期（wounds 使用模式）──────────────
  it('date-only 同日（UTC 解析為零時）在 noon today 之前 → true', () => {
    // new Date("2026-06-01") = 2026-06-01T00:00:00Z, 早於 noon
    expect(isOverdue('2026-06-01', TODAY)).toBe(true);
  });

});
