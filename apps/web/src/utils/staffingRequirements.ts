import {
  CONTRACT_NATURES,
  FACILITY_NATURES,
  GRID_POSITIONS,
  NIGHT_ANY_STAFF,
  STATUTORY_RATIOS,
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

/** 有甲一／院舍卷宿位（觸發買位合約「最少 1 名註冊護士當值」） */
function hasA1VoucherBeds(bedCounts: NatureBedCounts): boolean {
  return (bedCounts['甲一買位'] || 0) + (bedCounts['院舍卷計劃'] || 0) > 0;
}

/** 有任何宿位 */
function hasAnyBeds(bedCounts: NatureBedCounts): boolean {
  return FACILITY_NATURES.some((n) => (bedCounts[n] || 0) > 0);
}

/**
 * 職位的每日最低僱用人數（法定比例寫死，全部向上取整）：
 * - 主管：全院固定 1 人（有任何宿位時）
 * - 護理員：各性質 max(ceil(分母÷20), ceil(分母÷40)) = ceil(分母÷20) 總和
 * - 助理員：各性質 ceil(分母÷40) 總和
 * - 保健員：無甲一／院舍卷宿位 → ceil(全院在住 ÷ 30)（完全由保健員達標）；有則由排班決定組合，此處為 0
 * - 註冊護士：有甲一／院舍卷宿位 → 保底 1 名當值（買位合約要求）
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
    if (hasA1VoucherBeds(bedCounts)) return 0;
    let total = 0;
    for (const nature of FACILITY_NATURES) {
      total += ratioHeadcount(
        natureDenominator(nature, bedCounts, currentResidents),
        STATUTORY_RATIOS.healthWorker
      );
    }
    return total;
  }
  if (position === '註冊護士') {
    return hasA1VoucherBeds(bedCounts) ? 1 : 0;
  }
  if (position === '登記護士') {
    // 特定鐘點的護士分層填補為排班指引，不計入固定僱用人數
    return 0;
  }
  if (position === '護理員' || position === '助理員') {
    const ratio =
      position === '護理員' ? STATUTORY_RATIOS.careWorkerDay : STATUTORY_RATIOS.assistant;
    let total = 0;
    for (const nature of FACILITY_NATURES) {
      total += ratioHeadcount(natureDenominator(nature, bedCounts, currentResidents), ratio);
    }
    return total;
  }
  return 0;
}

/**
 * 計算順序（比例全部寫死，向上取整）：
 * 1. 護理員欄：指明期間 10 小時內各性質 ceil(分母÷20)，其餘時間 ceil(分母÷40)，按小時加總
 * 2. 助理員欄：指明期間 11 小時內各性質 ceil(分母÷40)，按小時加總
 * 3. 護士／保健員指明期間（連續 13 小時）：每 30 名住客 1 名保健員，1 名護士視同 2 名保健員
 *    甲一／院舍卷 → 「護士×2 ＋ 保健員 ≥ ceil(全院在住÷30)」混合約束，只作排班指引列出，
 *      不預填欄（由誰貢獻在排班時決定）；註冊護士欄保底 1 名當值（買位合約要求）
 *    安老院／甲二 → 時段內保健員欄 = ceil(全院在住 ÷ 30)（完全由保健員達標）
 * 4. 任何員工欄：18:00–翌日 07:00 須有 2 名員工當值（可兼任，不計入僱用人數）
 * 5. 總結只列每日最低僱用人數；實際工時與組合取決於排班，此階段不比對達標
 */
export function computeStaffingRequirements(input: StaffingInput): StaffingResult {
  const { bedCounts, specific, currentResidents } = input;

  const grid: number[][] = Array.from({ length: 24 }, () => GRID_POSITIONS.map(() => 0));
  const colIndex = (pos: string) => GRID_POSITIONS.indexOf(pos as GridPosition);

  // 按性質分母加總的當值人數
  const sumByRatio = (ratio: number): number => {
    let total = 0;
    for (const nature of FACILITY_NATURES) {
      total += ratioHeadcount(natureDenominator(nature, bedCounts, currentResidents), ratio);
    }
    return total;
  };

  // 步驟 1：護理員欄（指明期間 10h 1:20；其餘 14h 1:40）
  {
    const careCol = colIndex('護理員');
    for (let h = 0; h < 24; h++) {
      const inReq1 = hourInAnySegment(h, specific.requirement1.segments);
      grid[h][careCol] = sumByRatio(
        inReq1 ? STATUTORY_RATIOS.careWorkerDay : STATUTORY_RATIOS.careWorkerNight
      );
    }
  }

  // 步驟 2：助理員欄（指明期間 11h 1:40）
  {
    const asstCol = colIndex('助理員');
    for (let h = 0; h < 24; h++) {
      if (hourInSegment(h, specific.assistantWindow)) {
        grid[h][asstCol] = sumByRatio(STATUTORY_RATIOS.assistant);
      }
    }
  }

  // 步驟 3：護士／保健員指明期間（連續 13 小時）
  {
    const a1Beds = (bedCounts['甲一買位'] || 0) + (bedCounts['院舍卷計劃'] || 0);
    const a2Beds = bedCounts['甲二買位'] || 0;

    // 安老院／甲二：保健員按各自分母 1:30 獨立計算（向上取整後加總）
    const nonA1HealthWorkers =
      ratioHeadcount(natureDenominator('安老院', bedCounts, currentResidents), STATUTORY_RATIOS.healthWorker) +
      ratioHeadcount(a2Beds, STATUTORY_RATIOS.healthWorker);

    // 甲一／院舍卷：護士/保健員 1:30（保健員當量），1 護士 = 2 保健員
    // 註冊護士先佔 1:60，剩餘用登記護士 1:60，最終剩餘用保健員 1:30
    let rnCount = 0;
    let enCount = 0;
    let hwCount = 0;
    if (a1Beds > 0) {
      const totalEquivalents = ratioHeadcount(a1Beds, STATUTORY_RATIOS.healthWorker); // 保健員當量
      rnCount = ratioHeadcount(a1Beds, STATUTORY_RATIOS.nurse); // 1:60
      const remainingAfterRn = Math.max(0, totalEquivalents - rnCount * 2);
      enCount = ratioHeadcount(remainingAfterRn, 2); // 每個登記護士 = 2 保健員當量
      const remainingAfterEn = Math.max(0, remainingAfterRn - enCount * 2);
      hwCount = remainingAfterEn;
    }

    const minimums: Record<string, number> = {
      註冊護士: rnCount,
      登記護士: enCount,
      保健員: nonA1HealthWorkers + hwCount,
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

  // 步驟 4：任何員工欄（18:00–翌日 07:00 兩名當值，可兼任）
  if (hasAnyBeds(bedCounts)) {
    const anyCol = colIndex('任何員工');
    for (let h = 0; h < 24; h++) {
      if (hourInSegment(h, NIGHT_ANY_STAFF)) {
        grid[h][anyCol] = NIGHT_ANY_STAFF.count;
      }
    }
  }

  // 步驟 5：總結（每日最低僱用人數；實際工時與組合取決於排班，此階段不比對達標）
  const dailySummaries: DailySummary[] = GRID_POSITIONS.map((position) => ({
    position,
    minHeadcount: minHeadcountForPosition(position, bedCounts, currentResidents),
  }));

  return { grid, dailySummaries };
}
