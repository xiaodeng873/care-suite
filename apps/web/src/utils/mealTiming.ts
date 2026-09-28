// 服用時段（可增減）：slots 為時段清單，connectors 為相鄰時段之間嘅連接詞
// （「或」=任一時段給服皆合處方要求；「及」=該縫位兩時段皆需給服；''=無連接詞，顯示時換新行），長度 = slots.length - 1
// replacePrefix 為每時段嘅「取代前綴」勾選（與 slots 對齊）：勾選後該時段取代頻率類型，
// 直接做當日服用次數嘅前綴（「晚上1次」取代「晚上／每日1次」），eMAR 同藥紙顯示適用
// hoursBefore 為每時段嘅「N小時」（與 slots 對齊）：有值時時段顯示「餐前一小時」式
// （時段本身已含「前」→「{時段}{N}小時」，否則「{時段}前{N}小時」）；同 replacePrefix 互斥
export type MealTimingConnector = '或' | '及' | '';

export interface MealTimings {
  slots: string[];
  connectors: MealTimingConnector[];
  replacePrefix?: boolean[];
  hoursBefore?: (number | null)[];
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
  const raw = source.meal_timings as { slots?: unknown; connectors?: unknown; replacePrefix?: unknown; hoursBefore?: unknown } | null | undefined;
  if (raw && Array.isArray(raw.slots)) {
    const slots = (raw.slots as unknown[]).map(clean).filter(Boolean);
    if (slots.length) {
      const need = slots.length - 1;
      const connectors: MealTimingConnector[] = Array.isArray(raw.connectors)
        ? (raw.connectors as unknown[]).slice(0, need).map((c) => (c === '及' ? '及' : c === '' || c == null ? '' : '或'))
        : [];
      while (connectors.length < need) connectors.push('或');
      const replacePrefix = Array.isArray(raw.replacePrefix)
        ? (raw.replacePrefix as unknown[]).slice(0, slots.length).map(Boolean)
        : [];
      while (replacePrefix.length < slots.length) replacePrefix.push(false);
      const hoursBefore: (number | null)[] = Array.isArray(raw.hoursBefore)
        ? (raw.hoursBefore as unknown[]).slice(0, slots.length).map((n) => {
            const v = Number(n);
            return Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
          })
        : [];
      while (hoursBefore.length < slots.length) hoursBefore.push(null);
      return { slots, connectors, replacePrefix, hoursBefore };
    }
  }
  const slots = [clean(source.meal_timing ?? source.meal_timing_1), clean(source.meal_timing_2)].filter(Boolean);
  return {
    slots,
    connectors: slots.length > 1 ? [source.meal_timing_connector === '及' ? '及' : '或'] : [],
    replacePrefix: slots.map(() => false),
    hoursBefore: slots.map(() => null),
  };
}

/** 有冇時段勾咗「取代前綴」：有嘅話顯示時唔再出獨立頻率行（次數已嵌入時段名） */
export const hasReplacePrefixSlot = (t: MealTimings): boolean => (t.replacePrefix ?? []).some(Boolean);

// 中文數字（N小時顯示）：1–10 用「一…十」，11+ 用「十X／二十X」式
const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function toChineseHours(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 10) return CN_DIGITS[n];
  if (n === 10) return '十';
  if (n < 20) return `十${CN_DIGITS[n % 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${CN_DIGITS[tens]}十${ones ? CN_DIGITS[ones] : ''}`;
}

/** 呢啲時段選咗會自動預設「取代前綴」（用戶仍可手動取消） */
export const AUTO_PREFIX_SLOTS = ['早上', '上午', '中午', '下午', '晚上', '臨睡前'];

/** 時段顯示標籤：有 N小時 時變「餐前一小時」式
 *  （時段含「前」或「後」→「{時段}{N}小時」，例如 餐前+1 → 餐前一小時、餐後+1 → 餐後一小時；
 *    否則「{時段}前{N}小時」，例如 晚上+1 → 晚上前一小時） */
export function mealSlotLabel(slot: string, hoursBefore?: number | null): string {
  if (!hoursBefore) return slot;
  const cn = toChineseHours(hoursBefore);
  return slot.includes('前') || slot.includes('後') ? `${slot}${cn}小時` : `${slot}前${cn}小時`;
}

/** 時段係咪支援「N小時」（時段本身含「前」或「後」先有相對時間概念） */
export const slotSupportsHours = (slot: string): boolean => slot.includes('前') || slot.includes('後');

/** 「取代前綴」顯示組裝：勾選嘅時段顯示「{時段}{perDay}次」，其餘時段照舊；
 *  冇任何勾選時同 formatMealTimings。perDay = 當日服用次數（daily_frequency 優先） */
export function formatMealTimingsWithPrefix(t: MealTimings, perDay: number): string {
  if (!t.slots.length) return '';
  const rp = t.replacePrefix ?? [];
  const hb = t.hoursBefore ?? [];
  const piece = (i: number): string => (rp[i] ? `${mealSlotLabel(t.slots[i], hb[i])}${perDay}次` : mealSlotLabel(t.slots[i], hb[i]));
  let out = piece(0);
  for (let i = 1; i < t.slots.length; i++) {
    const conn = t.connectors[i - 1] ?? '或';
    out += conn === '' ? `\n${piece(i)}` : `${conn}${piece(i)}`;
  }
  return out;
}

/** 顯示格式：時段1或時段2及時段3 …（每個縫位用自己嘅連接詞，唔加空格；無連接詞='' → 換行 \n） */
export function formatMealTimings(t: MealTimings): string {
  if (!t.slots.length) return '';
  const hb = t.hoursBefore ?? [];
  let out = mealSlotLabel(t.slots[0], hb[0]);
  for (let i = 1; i < t.slots.length; i++) {
    const conn = t.connectors[i - 1] ?? '或';
    out += conn === '' ? `\n${mealSlotLabel(t.slots[i], hb[i])}` : `${conn}${mealSlotLabel(t.slots[i], hb[i])}`;
  }
  return out;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML 文件用：同 formatMealTimings（連接詞前後唔加空格），但已 escape，且無連接詞嘅縫位輸出 <br> */
export function formatMealTimingsHtml(t: MealTimings): string {
  if (!t.slots.length) return '';
  const hb = t.hoursBefore ?? [];
  let out = escapeHtml(mealSlotLabel(t.slots[0], hb[0]));
  for (let i = 1; i < t.slots.length; i++) {
    const conn = t.connectors[i - 1] ?? '或';
    out += conn === '' ? `<br>${escapeHtml(mealSlotLabel(t.slots[i], hb[i]))}` : `${conn}${escapeHtml(mealSlotLabel(t.slots[i], hb[i]))}`;
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
  // 過濾空時段，連接詞、replacePrefix、hoursBefore 跟住「呢個時段前面嗰個縫位」保持對齊
  const slots: string[] = [];
  const connectors: MealTimingConnector[] = [];
  const replacePrefix: boolean[] = [];
  const hoursBefore: (number | null)[] = [];
  t.slots.forEach((slot, i) => {
    const s = clean(slot);
    if (!s) return;
    if (slots.length > 0) connectors.push(t.connectors[i - 1] ?? '或');
    slots.push(s);
    const hb = t.hoursBefore?.[i];
    const hours = Number.isFinite(hb) && Number(hb) > 0 ? Math.floor(Number(hb)) : null;
    hoursBefore.push(hours);
    // 與 N小時 互斥：有 N小時 嘅時段唔保留取代前綴
    replacePrefix.push(hours ? false : Boolean(t.replacePrefix?.[i]));
  });
  return {
    meal_timings: slots.length ? { slots, connectors, replacePrefix, hoursBefore } : null,
    [slot1Key]: slots[0] || null,
    meal_timing_2: slots[1] || null,
    // 舊欄只識 或/及；無連接詞（''）喺舊欄存 null，完整結構以 meal_timings jsonb 為準
    meal_timing_connector: slots.length > 1 ? (connectors[0] === '' ? null : (connectors[0] ?? '或')) : null,
  };
}
