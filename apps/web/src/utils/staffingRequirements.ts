import {
  CONTRACT_NATURES,
  FACILITY_NATURES,
  GRID_POSITIONS,
  PHYSIOTHERAPIST,
  type FacilityNature,
  type NatureBedCounts,
  type NatureRequirements,
  type SpecificHoursConfig,
  type TimeSegment,
} from './facilityNatureSettings';

// =====================================================
// 24 小時最低人手計算引擎（純函數）
// =====================================================

export interface StaffingInput {
  bedCounts: NatureBedCounts;
  requirements: NatureRequirements;
  specific: SpecificHoursConfig;
  /** 全院當前在住人數 */
  currentResidents: number;
}

export interface DailySummary {
  position: string;
  /** 每日最低總工時要求（工時頁各性質換算總和；排班時的目標數字） */
  requiredDailyHours: number;
  /** 每日最低僱用人數（比例頁各性質 ceil(分母÷N) 總和） */
  minHeadcount: number;
}

export interface StaffingResult {
  /** number[24][7]：行 = 小時 0-23，列 = GRID_POSITIONS 七職位 */
  grid: number[][];
  dailySummaries: DailySummary[];
}

/** "HH:MM" → 分鐘數 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** 無條件進位到最近的 0.5 */
export function ceilHalf(n: number): number {
  return Math.ceil(n * 2) / 2;
}

/** 小時格 h（[h*60, h*60+60)）是否落在時段 [start, end) 內 */
function hourInSegment(hour: number, seg: TimeSegment): boolean {
  const slotStart = hour * 60;
  return slotStart >= timeToMinutes(seg.start) && slotStart < timeToMinutes(seg.end);
}

function hourInAnySegment(hour: number, segments: TimeSegment[]): boolean {
  return segments.some((seg) => hourInSegment(hour, seg));
}

/**
 * 性質分母：
 * - 安老院 = max(0, 全院當前在住人數 − 三個買位／計劃類宿位數總和)
 * - 買位／計劃類 = 該類宿位數（用戶輸入的床位數）
 */
export function natureDenominator(
  nature: FacilityNature,
  bedCounts: NatureBedCounts,
  currentResidents: number
): number {
  if (nature === '安老院') {
    const contractBeds = CONTRACT_NATURES.reduce((sum, n) => sum + (bedCounts[n] || 0), 0);
    return Math.max(0, currentResidents - contractBeds);
  }
  return bedCounts[nature] || 0;
}

/** 工時頁每日換算：物理治療師每周總工時 ÷ 5 無條件進位到 0.5；其他職位即每日總工時。留空回 0。 */
export function positionTotalDailyHours(position: string, totalHours: number | null | undefined): number {
  if (totalHours == null || totalHours <= 0) return 0;
  return position === PHYSIOTHERAPIST ? ceilHalf(totalHours / 5) : totalHours;
}

/** 職位的每日最低總工時要求 = 各性質工時頁設定總和（物理治療師每周 ÷ 5） */
export function requiredDailyHoursForPosition(
  position: string,
  requirements: NatureRequirements
): number {
  let total = 0;
  for (const nature of FACILITY_NATURES) {
    total += positionTotalDailyHours(position, requirements[nature]?.hours?.[position]);
  }
  return total;
}

/** 職位的每日最低僱用人數 = 各性質比例頁 ceil(分母÷N) 總和 */
export function minHeadcountForPosition(
  position: string,
  bedCounts: NatureBedCounts,
  requirements: NatureRequirements,
  currentResidents: number
): number {
  let total = 0;
  for (const nature of FACILITY_NATURES) {
    const n = requirements[nature]?.ratios?.[position];
    if (n == null || n <= 0) continue;
    total += Math.ceil(natureDenominator(nature, bedCounts, currentResidents) / n);
  }
  return total;
}

/**
 * 貪婪算法，嚴格順序：
 * 1. 護理員欄：要求1時段 → ceil(全院在住 ÷ 要求1比例)，其餘 → ceil(全院在住 ÷ 要求2比例)；在住為 0 → 0
 * 2. 要求3：時段內各護士類職位（註冊護士／登記護士／保健員）欄 ≥ 病護比例換算的最低僱用人數（11 小時內同樣要符合病護比例才合格）；
 *    無比例設定時保底：任何買位／計劃類床位 > 0 → 註冊護士 ≥1；純安老院 → 保健員 ≥1
 * 3. 每職位每日總工時要求扣除該欄已覆蓋小時，餘數無條件進位後由 07:00 起填入 07:00–22:00（15 格），與現值取 max
 * 4. 總結只列最低要求目標（每日最低總工時、每日最低僱用人數）；實際總工時取決於排班，此階段不比對達標
 */
export function computeStaffingRequirements(input: StaffingInput): StaffingResult {
  const { bedCounts, requirements, specific, currentResidents } = input;

  const grid: number[][] = Array.from({ length: 24 }, () => GRID_POSITIONS.map(() => 0));
  const colIndex = (pos: string) => GRID_POSITIONS.indexOf(pos as (typeof GRID_POSITIONS)[number]);

  // 步驟 1：護理員欄
  const careWorkerCol = colIndex('護理員');
  const daytime = currentResidents > 0 ? Math.ceil(currentResidents / specific.requirement1.ratio) : 0;
  const nighttime = currentResidents > 0 ? Math.ceil(currentResidents / specific.requirement2.ratio) : 0;
  for (let h = 0; h < 24; h++) {
    grid[h][careWorkerCol] = hourInAnySegment(h, specific.requirement1.segments) ? daytime : nighttime;
  }

  // 步驟 2：要求3（護士／保健員最低連續 11 小時）
  // 時段內除最少 1 人當值外，必須同時符合病護比例：各護士類職位欄 ≥ 比例頁換算的每日最低僱用人數
  const hasContractBeds = CONTRACT_NATURES.some((n) => (bedCounts[n] || 0) > 0);
  const nursePositions = ['註冊護士', '登記護士', '保健員'] as const;
  for (const pos of nursePositions) {
    const ratioRequired = minHeadcountForPosition(pos, bedCounts, requirements, currentResidents);
    const col = colIndex(pos);
    const minimum = Math.max(
      ratioRequired,
      // 無比例設定時的保底：有買位類床位 → 註冊護士 ≥1；純安老院 → 保健員 ≥1
      (hasContractBeds && pos === '註冊護士') || (!hasContractBeds && pos === '保健員') ? 1 : 0
    );
    if (minimum <= 0) continue;
    for (let h = 0; h < 24; h++) {
      if (hourInSegment(h, specific.requirement3)) {
        grid[h][col] = Math.max(grid[h][col], minimum);
      }
    }
  }

  // 步驟 3：各職位每日總工時要求，補進 07:00–22:00（15 格）
  for (const position of GRID_POSITIONS) {
    const required = requiredDailyHoursForPosition(position, requirements);
    if (required <= 0) continue;
    const col = colIndex(position);
    let covered = 0;
    for (let h = 0; h < 24; h++) covered += grid[h][col];
    const remaining = Math.ceil(Math.max(0, required - covered));
    if (remaining <= 0) continue;
    const base = Math.floor(remaining / 15);
    let extra = remaining % 15;
    for (let h = 7; h < 22; h++) {
      const add = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      grid[h][col] = Math.max(grid[h][col], add);
    }
  }

  // 步驟 4：總結（只列出最低要求目標；實際總工時取決於排班，此階段不比對達標）
  const dailySummaries: DailySummary[] = GRID_POSITIONS.map((position) => ({
    position,
    requiredDailyHours: requiredDailyHoursForPosition(position, requirements),
    minHeadcount: minHeadcountForPosition(position, bedCounts, requirements, currentResidents),
  }));

  return { grid, dailySummaries };
}
