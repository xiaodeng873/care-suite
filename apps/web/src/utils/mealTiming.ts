// 服用時段（可增減）：slots 為時段清單，connectors 為相鄰時段之間嘅連接詞
// （「或」=任一時段給服皆合處方要求；「及」=該縫位兩時段皆需給服；''=無連接詞，顯示時換新行），長度 = slots.length - 1
export type MealTimingConnector = '或' | '及' | '';

export interface MealTimings {
  slots: string[];
  connectors: MealTimingConnector[];
}

interface MealTimingSource {
  meal_timings?: unknown;
  meal_timing?: string | null;
  meal_timing_1?: string | null; // 藥物資料庫嘅時段1欄名
  meal_timing_2?: string | null;
  meal_timing_connector?: string | null;
}

const clean = (s: unknown): string => String(s ?? '').trim();

/** 從處方/藥物記錄取時段結構：優先 meal_timings jsonb，fallback 舊三欄 */
export function getMealTimings(source: MealTimingSource | null | undefined): MealTimings {
  if (!source) return { slots: [], connectors: [] };
  const raw = source.meal_timings as { slots?: unknown; connectors?: unknown } | null | undefined;
  if (raw && Array.isArray(raw.slots)) {
    const slots = (raw.slots as unknown[]).map(clean).filter(Boolean);
    if (slots.length) {
      const need = slots.length - 1;
      const connectors: MealTimingConnector[] = Array.isArray(raw.connectors)
        ? (raw.connectors as unknown[]).slice(0, need).map((c) => (c === '及' ? '及' : c === '' || c == null ? '' : '或'))
        : [];
      while (connectors.length < need) connectors.push('或');
      return { slots, connectors };
    }
  }
  const slots = [clean(source.meal_timing ?? source.meal_timing_1), clean(source.meal_timing_2)].filter(Boolean);
  return {
    slots,
    connectors: slots.length > 1 ? [source.meal_timing_connector === '及' ? '及' : '或'] : [],
  };
}

/** 顯示格式：時段1或時段2及時段3 …（每個縫位用自己嘅連接詞，唔加空格；無連接詞='' → 換行 \n） */
export function formatMealTimings(t: MealTimings): string {
  if (!t.slots.length) return '';
  let out = t.slots[0];
  for (let i = 1; i < t.slots.length; i++) {
    const conn = t.connectors[i - 1] ?? '或';
    out += conn === '' ? `\n${t.slots[i]}` : `${conn}${t.slots[i]}`;
  }
  return out;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML 文件用：同 formatMealTimings（連接詞前後唔加空格），但已 escape，且無連接詞嘅縫位輸出 <br> */
export function formatMealTimingsHtml(t: MealTimings): string {
  if (!t.slots.length) return '';
  let out = escapeHtml(t.slots[0]);
  for (let i = 1; i < t.slots.length; i++) {
    const conn = t.connectors[i - 1] ?? '或';
    out += conn === '' ? `<br>${escapeHtml(t.slots[i])}` : `${conn}${escapeHtml(t.slots[i])}`;
  }
  return out;
}

/** HTML 文件用捷徑（getMealTimings + formatMealTimingsHtml） */
export function formatMealTimingHtmlFrom(source: MealTimingSource | null | undefined): string {
  return formatMealTimingsHtml(getMealTimings(source));
}

/** 舊介面（時段1/時段2/單一連接詞）；新代碼請用 formatMealTimings(getMealTimings(x)) */
export function formatMealTiming(mealTiming?: string | null, mealTiming2?: string | null, connector: '或' | '及' = '或'): string {
  const parts = [mealTiming, mealTiming2]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  return parts.join(connector);
}

/** 由來源直接組顯示字串（getMealTimings + formatMealTimings 嘅捷徑） */
export function formatMealTimingFrom(source: MealTimingSource | null | undefined): string {
  return formatMealTimings(getMealTimings(source));
}

/** 寫入 payload：meal_timings jsonb + 同步舊三欄（首兩時段 + 首連接詞）作兼容 */
export function toMealTimingPayload(
  t: MealTimings,
  slot1Key: 'meal_timing' | 'meal_timing_1' = 'meal_timing'
): Record<string, unknown> {
  // 過濾空時段，連接詞跟住「呢個時段前面嗰個縫位」保持對齊
  const slots: string[] = [];
  const connectors: MealTimingConnector[] = [];
  t.slots.forEach((slot, i) => {
    const s = clean(slot);
    if (!s) return;
    if (slots.length > 0) connectors.push(t.connectors[i - 1] ?? '或');
    slots.push(s);
  });
  return {
    meal_timings: slots.length ? { slots, connectors } : null,
    [slot1Key]: slots[0] || null,
    meal_timing_2: slots[1] || null,
    // 舊欄只識 或/及；無連接詞（''）喺舊欄存 null，完整結構以 meal_timings jsonb 為準
    meal_timing_connector: slots.length > 1 ? (connectors[0] === '' ? null : (connectors[0] ?? '或')) : null,
  };
}
