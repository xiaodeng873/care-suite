import { calculateBalance } from '../calculateBalance';
import type { IntakeItem, OutputItem } from '../types';

// 建立最小假資料的輔助函式
function makeIntake(overrides: Partial<IntakeItem>): IntakeItem {
  return {
    id: '1',
    record_id: 'r1',
    category: 'beverage',
    item_type: '水',
    amount: '200',
    amount_numeric: 200,
    unit: 'ml',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeOutput(overrides: Partial<OutputItem>): OutputItem {
  return {
    id: '1',
    record_id: 'r1',
    category: 'urine',
    amount_ml: 300,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── 1. 空輸入 ──────────────────────────────────────────────────────────────

describe('calculateBalance', () => {
  it('空進水、空排出 → 全部為 0', () => {
    const result = calculateBalance([], []);
    expect(result.intakeMl).toBe(0);
    expect(result.outputMl).toBe(0);
    expect(result.balance).toBe(0);
  });

  // ─── 2. 非 ml 進水不計入 ──────────────────────────────────────────────────

  it('份量（portion）進水不納入 intakeMl', () => {
    const result = calculateBalance(
      [makeIntake({ unit: 'portion', amount_numeric: 3 })],
      []
    );
    expect(result.intakeMl).toBe(0);
  });

  it('件數（piece）進水不納入 intakeMl', () => {
    const result = calculateBalance(
      [makeIntake({ unit: 'piece', amount_numeric: 2 })],
      []
    );
    expect(result.intakeMl).toBe(0);
  });

  // ─── 3. ml 進水正確累計 ───────────────────────────────────────────────────

  it('單筆 ml 進水正確計入 intakeMl', () => {
    const result = calculateBalance(
      [makeIntake({ unit: 'ml', amount_numeric: 500 })],
      []
    );
    expect(result.intakeMl).toBe(500);
  });

  it('多筆 ml 進水累加', () => {
    const result = calculateBalance(
      [
        makeIntake({ id: '1', unit: 'ml', amount_numeric: 200 }),
        makeIntake({ id: '2', unit: 'ml', amount_numeric: 300 }),
        makeIntake({ id: '3', unit: 'portion', amount_numeric: 1 }), // 不計
      ],
      []
    );
    expect(result.intakeMl).toBe(500);
  });

  // ─── 4. 排出量正確累計 ────────────────────────────────────────────────────

  it('多筆排出累加', () => {
    const result = calculateBalance([], [
      makeOutput({ id: '1', amount_ml: 200 }),
      makeOutput({ id: '2', amount_ml: 150 }),
    ]);
    expect(result.outputMl).toBe(350);
  });

  // ─── 5. 正平衡（攝入 > 排出）─────────────────────────────────────────────

  it('正平衡：攝入 > 排出', () => {
    const result = calculateBalance(
      [makeIntake({ unit: 'ml', amount_numeric: 800 })],
      [makeOutput({ amount_ml: 300 })]
    );
    expect(result.balance).toBe(500);
  });

  // ─── 6. 負平衡（排出 > 攝入）─────────────────────────────────────────────

  it('負平衡：排出 > 攝入', () => {
    const result = calculateBalance(
      [makeIntake({ unit: 'ml', amount_numeric: 200 })],
      [makeOutput({ amount_ml: 500 })]
    );
    expect(result.balance).toBe(-300);
  });
});
