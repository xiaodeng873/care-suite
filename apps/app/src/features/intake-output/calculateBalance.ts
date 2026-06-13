import type { IntakeItem, OutputItem } from './types';

export interface BalanceResult {
  /** 液態攝入量（只計 unit === 'ml' 的項目）*/
  intakeMl: number;
  /** 排出量（全部為 ml）*/
  outputMl: number;
  /** 淨差值：intakeMl - outputMl */
  balance: number;
}

/**
 * 計算單次記錄或每日匯總的出入量平衡。
 *
 * 業務規則：
 * - 只有 unit === 'ml' 的進水項目才納入 intakeMl（份/件等固體不計）
 * - outputMl 為所有排出項目的 amount_ml 加總
 */
export function calculateBalance(
  intakeItems: IntakeItem[],
  outputItems: OutputItem[]
): BalanceResult {
  const intakeMl = intakeItems
    .filter((i) => i.unit === 'ml')
    .reduce((sum, i) => sum + i.amount_numeric, 0);

  const outputMl = outputItems.reduce((sum, i) => sum + i.amount_ml, 0);

  return { intakeMl, outputMl, balance: intakeMl - outputMl };
}
