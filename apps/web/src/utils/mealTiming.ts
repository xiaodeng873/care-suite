// 服用時段顯示格式：時段1 與時段2 以連接詞連接（預設「或」，可選「及」）
export function formatMealTiming(mealTiming?: string | null, mealTiming2?: string | null, connector: '或' | '及' = '或'): string {
  const parts = [mealTiming, mealTiming2]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  return parts.join(` ${connector} `);
}
