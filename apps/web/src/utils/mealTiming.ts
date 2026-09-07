// 服用時段顯示格式：時段1 與時段2 以「或」連接；任一時段給服皆合處方要求
export function formatMealTiming(mealTiming?: string | null, mealTiming2?: string | null): string {
  const parts = [mealTiming, mealTiming2]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  return parts.join(' 或 ');
}
