import {
  A1_CONTRACT_NATURES,
  A1_CONTRACT_WEEKLY_HOURS_PER_40_BEDS,
  FACILITY_NATURES,
  GRID_POSITIONS,
  NIGHT_ANY_STAFF,
  NON_PRIVATE_NATURES,
  STATUTORY_RATIOS,
  WORK_HOUR_STEP,
  type FacilityNature,
  type GridPosition,
  type NatureBedCounts,
  type SpecificHoursConfig,
  type TimeSegment,
} from './facilityNatureSettings';

// =====================================================
// 24 小時最低人手計算引擎（純函數）
// 比例按《安老院規例》附表1寫死（STATUTORY_RATIOS），所有人手換算向上取整（ceil）
// =====================================================

export interface StaffingInput {
  bedCounts: NatureBedCounts;
  specific: SpecificHoursConfig;
  /** 全院當前在住人數 */
  currentResidents: number;
}

export interface DailySummary {
  position: string;
  /** 每日最低僱用人數（向上取整） */
  minHeadcount: number;
}

export interface StaffingResult {
  /** number[24][8]：行 = 小時 0-23，列 = GRID_POSITIONS 八欄 */
  grid: number[][];
  dailySummaries: DailySummary[];
}

/** "HH:MM" → 分鐘數 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** 比例換算人數：ceil(分母 ÷ N)，帶小數必須進位；無比例或分母為 0 → 0 */
export function ratioHeadcount(denominator: number, ratio: number | null | undefined): number {
  return ratio != null && ratio > 0 && denominator > 0 ? Math.ceil(denominator / ratio) : 0;
}

/**
 * 性質分母：
 * - 安老院 = max(0, 全院當前在住人數 − 非私位宿位數總和)
 * - 買位類 = 該類宿位數（用戶輸入的床位數）
 */
export function natureDenominator(
  nature: FacilityNature,
  bedCounts: NatureBedCounts,
  currentResidents: number
): number {
  if (nature === '安老院') {
    const nonPrivateBeds = NON_PRIVATE_NATURES.reduce((sum, n) => sum + (bedCounts[n] || 0), 0);
    return Math.max(0, currentResidents - nonPrivateBeds);
  }
  return bedCounts[nature] || 0;
}

/** 小時格 h（[h*60, h*60+60)）是否落在時段 [start, end) 內；start > end 視為跨午夜（如 18:00–07:00） */
function hourInSegment(hour: number, seg: TimeSegment): boolean {
  const slotStart = hour * 60;
  const s = timeToMinutes(seg.start);
  const e = timeToMinutes(seg.end);
  if (s <= e) return slotStart >= s && slotStart < e;
  return slotStart >= s || slotStart < e;
}

function hourInAnySegment(hour: number, segments: TimeSegment[]): boolean {
  return segments.some((seg) => hourInSegment(hour, seg));
}

/** 有甲一買位宿位（觸發買位合約「最少 1 名註冊護士當值」） */
function hasA1VoucherBeds(bedCounts: NatureBedCounts): boolean {
  return A1_CONTRACT_NATURES.reduce((sum, n) => sum + (bedCounts[n] || 0), 0) > 0;
}

/** 有任何宿位 */
function hasAnyBeds(bedCounts: NatureBedCounts): boolean {
  return FACILITY_NATURES.some((n) => (bedCounts[n] || 0) > 0);
}

/**
 * 職位的每日最低僱用人數（法定比例寫死，全部向上取整）：
 * - 主管：全院固定 1 人（有任何宿位時）
 * - 護理員：全院 ceil(入住人數÷20)（指明期間 1:20，大於 1:40，取日間值）
 * - 助理員：全院 ceil(入住人數÷40)（指明期間 1:40）
 * - 保健員：全院保健員人手 ceil(入住人數÷30)；有甲一買位宿位時，先扣 1 名註冊護士貢獻的 2 名人手
 * - 註冊/登記護士：有甲一買位宿位 → 保底 1 名當值（買位合約要求）
 * - 任何員工（夜班 18:00–07:00 兩名）：可由其他職位兼任，不計入僱用人數 → 0
 */
export function minHeadcountForPosition(
  position: string,
  bedCounts: NatureBedCounts,
  currentResidents: number
): number {
  if (position === '主管') {
    return hasAnyBeds(bedCounts) ? 1 : 0;
  }
  if (position === '保健員') {
    const equivalents = ratioHeadcount(currentResidents, STATUTORY_RATIOS.healthWorker);
    if (hasA1VoucherBeds(bedCounts)) {
      return Math.max(0, equivalents - 2); // 1 名註冊護士視同 2 名保健員人手
    }
    return equivalents;
  }
  if (position === '註冊/登記護士') {
    return hasA1VoucherBeds(bedCounts) ? 1 : 0;
  }
  if (position === '護理員' || position === '助理員') {
    const ratio =
      position === '護理員' ? STATUTORY_RATIOS.careWorkerDay : STATUTORY_RATIOS.assistant;
    return ratioHeadcount(currentResidents, ratio);
  }
  return 0;
}

/**
 * 計算順序（比例全部寫死，向上取整）：
 * 1. 護理員欄：指明期間 10h 全院 ceil(入住人數÷20)，其餘 14h 全院 ceil(入住人數÷40)
 * 2. 助理員欄：指明期間 11h 全院 ceil(入住人數÷40)
 * 3. 護士／保健員指明期間（連續 13 小時）：全院保健員人手 ceil(入住人數÷30)，
 *    1 名註冊護士視同 2 名保健員。有甲一買位時，註冊護士欄保底 1 名，剩餘由保健員填補。
 * 4. 任何員工欄：18:00–翌日 07:00 全院至少 2 名員工當值（可兼任，不計入僱用人數）
 * 5. 總結只列每日最低僱用人數；實際工時與組合取決於排班，此階段不比對達標
 */
export function computeStaffingRequirements(input: StaffingInput): StaffingResult {
  const { bedCounts, specific, currentResidents } = input;

  const grid: number[][] = Array.from({ length: 24 }, () => GRID_POSITIONS.map(() => 0));
  const colIndex = (pos: string) => GRID_POSITIONS.indexOf(pos as GridPosition);

  // 步驟 1：護理員欄（指明期間 10h 1:20；其餘 14h 1:40）
  {
    const careCol = colIndex('護理員');
    for (let h = 0; h < 24; h++) {
      const inReq1 = hourInAnySegment(h, specific.requirement1.segments);
      grid[h][careCol] = ratioHeadcount(
        currentResidents,
        inReq1 ? STATUTORY_RATIOS.careWorkerDay : STATUTORY_RATIOS.careWorkerNight
      );
    }
  }

  // 步驟 2：助理員欄（指明期間 11h 1:40）
  {
    const asstCol = colIndex('助理員');
    for (let h = 0; h < 24; h++) {
      if (hourInSegment(h, specific.assistantWindow)) {
        grid[h][asstCol] = ratioHeadcount(currentResidents, STATUTORY_RATIOS.assistant);
      }
    }
  }

  // 步驟 3：護士／保健員指明期間（連續 13 小時）
  {
    const a1Beds = bedCounts['甲一買位'] || 0;
    const healthWorkerEquivalents = ratioHeadcount(currentResidents, STATUTORY_RATIOS.healthWorker);

    let nurseCount = 0;
    let healthWorkerCount = healthWorkerEquivalents;
    if (a1Beds > 0) {
      nurseCount = 1; // 買位合約：至少 1 名註冊護士當值
      healthWorkerCount = Math.max(0, healthWorkerEquivalents - nurseCount * 2); // 剩餘由保健員填補
    }

    const minimums: Record<string, number> = {
      '註冊/登記護士': nurseCount,
      保健員: healthWorkerCount,
    };

    for (const [pos, minimum] of Object.entries(minimums)) {
      if (minimum <= 0) continue;
      const col = colIndex(pos);
      for (let h = 0; h < 24; h++) {
        if (hourInSegment(h, specific.requirement3)) {
          grid[h][col] = Math.max(grid[h][col], minimum);
        }
      }
    }
  }

  // 步驟 4：任何員工欄（18:00–翌日 07:00 全院至少 2 名員工當值，可由其他職位兼任）
  // 只顯示尚欠差額：其他職位該小時已達 2 名時無需額外補人。
  if (hasAnyBeds(bedCounts)) {
    const anyCol = colIndex('任何員工');
    for (let h = 0; h < 24; h++) {
      if (!hourInSegment(h, NIGHT_ANY_STAFF)) continue;
      let otherStaff = 0;
      for (let c = 0; c < grid[h].length; c++) {
        if (c !== anyCol) otherStaff += grid[h][c];
      }
      grid[h][anyCol] = Math.max(0, NIGHT_ANY_STAFF.count - otherStaff);
    }
  }

  // 步驟 5：總結（每日最低僱用人數；實際工時與組合取決於排班，此階段不比對達標）
  const dailySummaries: DailySummary[] = GRID_POSITIONS.map((position) => ({
    position,
    minHeadcount: minHeadcountForPosition(position, bedCounts, currentResidents),
  }));

  return { grid, dailySummaries };
}

// =====================================================
// 雙紅線獨立合格引擎：特定鐘點人數（紅線1）+ 甲一合約時數（紅線2）
// =====================================================

/** 向上取整至指定步長（0.5 小時） */
function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/**
 * 甲一買位合約每日工時目標：
 * - 主管固定 48 小時/週 ÷ 7，不按比例
 * - 其他職位按宿位比例換算（每 40 宿位基準），向上取整至 0.5 小時
 */
export function a1ContractDailyHours(position: string, a1VoucherBeds: number): number {
  if (a1VoucherBeds <= 0) return 0;
  if (position === '主管') return roundUpToStep(48 / 7, WORK_HOUR_STEP);

  // 「註冊/登記護士」對應合約中的「護士」（RN+EN 合計）
  const contractKey = position === '註冊/登記護士' ? '護士' : position;
  const weeklyBase =
    A1_CONTRACT_WEEKLY_HOURS_PER_40_BEDS[
      contractKey as keyof typeof A1_CONTRACT_WEEKLY_HOURS_PER_40_BEDS
    ];
  if (!weeklyBase) return 0;

  return roundUpToStep((weeklyBase * a1VoucherBeds) / 40 / 7, WORK_HOUR_STEP);
}

export interface DualRedLineResult {
  /** 每職位每日最少總工時（小時）= 紅線2合約目標 */
  dailyHours: Record<string, number>;
  /** 紅線1：每小時峰值人數（特定鐘點決定） */
  peakHeadcount: Record<string, number>;
  /** 紅線1：特定鐘點隱含每日工時 */
  statutoryImpliedHours: Record<string, number>;
  /** 紅線2：甲一合約每日工時目標 */
  contractTargetHours: Record<string, number>;
  /** 需額外補足工時（紅線2 - 紅線1隱含），只給總量邊界，不指定具體時段 */
  supplementaryHours: Record<string, number>;
  /** 是否有買位合約工時要求（甲一或甲二買位宿位數 > 0） */
  hasContractHours: boolean;
}

/**
 * 雙紅線獨立合格計算：
 * - 紅線 1（特定鐘點人數）：每小時每職位最少當值人數，不可妥協
 * - 紅線 2（甲一合約時數）：每職位每日總工時目標，不可妥協
 * - 兩者獨立，不能互相抵扣
 * - 護士替代保健員只影響紅線 1 的人手計算（1 護士 = 2 保健員），不影響紅線 2 的獨立工時
 */
export function computeDualRedLineStaffing(input: StaffingInput): DualRedLineResult {
  const { bedCounts } = input;
  const a1VoucherBeds = bedCounts['甲一買位'] || 0;
  const a2VoucherBeds = bedCounts['甲二買位'] || 0;
  const hasContractHours = a1VoucherBeds + a2VoucherBeds > 0;

  // 紅線 1：特定鐘點人數
  const statutory = computeStaffingRequirements(input);

  const result: DualRedLineResult = {
    dailyHours: {},
    peakHeadcount: {},
    statutoryImpliedHours: {},
    contractTargetHours: {},
    supplementaryHours: {},
    hasContractHours,
  };

  const colIndex = (pos: string) => GRID_POSITIONS.indexOf(pos as GridPosition);

  for (const pos of GRID_POSITIONS) {
    const col = colIndex(pos);
    const columnValues = statutory.grid.map((row) => row[col]);

    // 紅線 1：峰值人數與隱含工時
    const peak = Math.max(...columnValues, 0);
    const statutoryH = columnValues.reduce((sum, v) => sum + v, 0);

    // 紅線 2：甲一買位每日工時目標
    // 「護士」是 RN+EN 合計概念，計入「註冊/登記護士」欄
    const contractH = a1ContractDailyHours(pos, a1VoucherBeds);

    // 紅線 1 與紅線 2 分開計算：
    // - 工時只看甲一買位合約，不看人手比例
    // - 人頭只看特定鐘點比例，獨立於工時
    const dailyH = contractH;

    result.peakHeadcount[pos] = peak;
    result.statutoryImpliedHours[pos] = statutoryH;
    result.contractTargetHours[pos] = contractH;
    result.supplementaryHours[pos] = Math.max(0, contractH - statutoryH);
    result.dailyHours[pos] = dailyH;
  }

  return result;
}
