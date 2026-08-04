import { describe, it, expect } from 'vitest';
import {
  computeStaffingRequirements,
  minHeadcountForPosition,
  requiredDailyHoursForPosition,
  natureDenominator,
  ceilHalf,
} from './staffingRequirements';
import {
  DEFAULT_BED_COUNTS,
  DEFAULT_SPECIFIC_HOURS_CONFIG,
  GRID_POSITIONS,
  type NatureBedCounts,
  type NatureRequirements,
  type SpecificHoursConfig,
} from './facilityNatureSettings';

const col = (pos: string) => GRID_POSITIONS.indexOf(pos as (typeof GRID_POSITIONS)[number]);

const emptyRequirements: NatureRequirements = {};

function makeInput(overrides: {
  bedCounts?: Partial<NatureBedCounts>;
  requirements?: NatureRequirements;
  specific?: SpecificHoursConfig;
  currentResidents?: number;
}) {
  return {
    bedCounts: { ...DEFAULT_BED_COUNTS, ...overrides.bedCounts },
    requirements: overrides.requirements ?? emptyRequirements,
    specific: overrides.specific ?? DEFAULT_SPECIFIC_HOURS_CONFIG,
    currentResidents: overrides.currentResidents ?? 0,
  };
}

describe('ceilHalf', () => {
  it('無條件進位到 0.5', () => {
    expect(ceilHalf(1.0)).toBe(1.0);
    expect(ceilHalf(1.01)).toBe(1.5);
    expect(ceilHalf(1.5)).toBe(1.5);
    expect(ceilHalf(0)).toBe(0);
  });
});

describe('natureDenominator', () => {
  it('安老院 = max(0, 在住 − 三個計劃類宿位總和)；買位類 = 該類宿位數', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 50, 甲一買位: 50 };
    expect(natureDenominator('安老院', bedCounts, 100)).toBe(50);
    expect(natureDenominator('甲一買位', bedCounts, 100)).toBe(50);
    // 在住少於計劃類宿位時下限 0
    expect(natureDenominator('安老院', bedCounts, 40)).toBe(0);
  });
});

describe('病護比例換算（每日最低僱用人數）', () => {
  it('混合：50 甲一買位 + 50 安老院私位，甲一助理員 1:5 → 助理員 = 10', () => {
    const requirements: NatureRequirements = {
      甲一買位: { ratios: { 助理員: 5 }, hours: {} },
    };
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 50, 甲一買位: 50 };
    expect(minHeadcountForPosition('助理員', bedCounts, requirements, 100)).toBe(10);
  });

  it('100 床全屬甲一 → 助理員 = 20', () => {
    const requirements: NatureRequirements = {
      甲一買位: { ratios: { 助理員: 5 }, hours: {} },
    };
    const bedCounts = { ...DEFAULT_BED_COUNTS, 甲一買位: 100 };
    expect(minHeadcountForPosition('助理員', bedCounts, requirements, 100)).toBe(20);
  });

  it('比例留空（null）= 無要求', () => {
    const requirements: NatureRequirements = {
      甲一買位: { ratios: { 助理員: null }, hours: {} },
    };
    const bedCounts = { ...DEFAULT_BED_COUNTS, 甲一買位: 100 };
    expect(minHeadcountForPosition('助理員', bedCounts, requirements, 100)).toBe(0);
  });
});

describe('工時換算（每日最低總工時）', () => {
  it('甲一助理員每天總共 80 小時 → 每日 80 小時', () => {
    const requirements: NatureRequirements = {
      甲一買位: { ratios: {}, hours: { 助理員: 80 } },
    };
    expect(requiredDailyHoursForPosition('助理員', requirements)).toBe(80);
  });

  it('混合性質：各性質每天總工時直接相加', () => {
    const requirements: NatureRequirements = {
      甲一買位: { ratios: {}, hours: { 助理員: 64 } },
      安老院: { ratios: {}, hours: { 助理員: 16 } },
    };
    expect(requiredDailyHoursForPosition('助理員', requirements)).toBe(80);
  });

  it('物理治療師每周總工時 ÷ 5 無條件進位到 0.5', () => {
    // 每周 3 小時：每日 = ceilHalf(3/5=0.6→1.0) = 1
    const requirements: NatureRequirements = {
      甲一買位: { ratios: {}, hours: { 物理治療師: 3 } },
    };
    expect(requiredDailyHoursForPosition('物理治療師', requirements)).toBe(1);
  });
});

describe('computeStaffingRequirements', () => {
  it('要求1/2：在住 100，比例 20/40 → 要求1時段每小時 5 護理員，其餘 3', () => {
    const { grid } = computeStaffingRequirements(makeInput({ currentResidents: 100 }));
    const careCol = col('護理員');
    // 預設要求1 = 07:00–17:00
    for (let h = 7; h < 17; h++) {
      expect(grid[h][careCol]).toBe(5);
    }
    for (const h of [0, 6, 17, 23]) {
      expect(grid[h][careCol]).toBe(3); // ceil(100/40) = 3
    }
  });

  it('在住 0 → 護理員欄全 0', () => {
    const { grid } = computeStaffingRequirements(makeInput({ currentResidents: 0 }));
    const careCol = col('護理員');
    for (let h = 0; h < 24; h++) {
      expect(grid[h][careCol]).toBe(0);
    }
  });

  it('要求3：有買位床位 → 時段內註冊護士欄 = 1', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 甲一買位: 10 }, currentResidents: 100 })
    );
    const rnCol = col('註冊護士');
    // 預設要求3 = 07:00–18:00
    for (let h = 7; h < 18; h++) {
      expect(grid[h][rnCol]).toBe(1);
    }
    expect(grid[6][rnCol]).toBe(0);
    expect(grid[18][rnCol]).toBe(0);
  });

  it('要求3：純安老院 → 時段內保健員欄 = 1（註冊護士欄不受影響）', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 安老院: 100 }, currentResidents: 100 })
    );
    const hwCol = col('保健員');
    const rnCol = col('註冊護士');
    for (let h = 7; h < 18; h++) {
      expect(grid[h][hwCol]).toBe(1);
    }
    expect(grid[6][hwCol]).toBe(0);
    for (let h = 0; h < 24; h++) {
      expect(grid[h][rnCol]).toBe(0);
    }
  });

  it('要求3 + 病護比例：甲一 50 床、註冊護士 1:10 → 時段內註冊護士欄 = 5', () => {
    const requirements: NatureRequirements = {
      甲一買位: { ratios: { 註冊護士: 10 }, hours: {} },
    };
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 甲一買位: 50 }, requirements, currentResidents: 100 })
    );
    const rnCol = col('註冊護士');
    for (let h = 7; h < 18; h++) {
      expect(grid[h][rnCol]).toBe(5); // ceil(50/10)，高於保底的 1
    }
    expect(grid[6][rnCol]).toBe(0);
    expect(grid[18][rnCol]).toBe(0);
  });

  it('要求3 + 病護比例：安老院 100 住客、保健員 1:20 → 時段內保健員欄 = 5', () => {
    const requirements: NatureRequirements = {
      安老院: { ratios: { 保健員: 20 }, hours: {} },
    };
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 安老院: 100 }, requirements, currentResidents: 100 })
    );
    const hwCol = col('保健員');
    for (let h = 7; h < 18; h++) {
      expect(grid[h][hwCol]).toBe(5); // ceil(100/20)
    }
    expect(grid[6][hwCol]).toBe(0);
  });

  it('要求3 + 病護比例：登記護士比例獨立計算（甲一 50 床、登記護士 1:25 → 2）', () => {
    const requirements: NatureRequirements = {
      甲一買位: { ratios: { 登記護士: 25 }, hours: {} },
    };
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 甲一買位: 50 }, requirements, currentResidents: 100 })
    );
    const enCol = col('登記護士');
    for (let h = 7; h < 18; h++) {
      expect(grid[h][enCol]).toBe(2); // ceil(50/25)
    }
    expect(grid[6][enCol]).toBe(0);
  });

  it('工時要求補入 07:00–22:00：80 小時助理員需求 → base 5 + 餘 5 格 6', () => {
    const requirements: NatureRequirements = {
      甲一買位: { ratios: {}, hours: { 助理員: 80 } },
    };
    const { grid, dailySummaries } = computeStaffingRequirements(
      makeInput({ bedCounts: { 甲一買位: 50 }, requirements, currentResidents: 100 })
    );
    const asstCol = col('助理員');
    // R = 80，base = floor(80/15) = 5，餘 5 → 07:00 起 5 格為 6，其餘 5
    for (let h = 7; h < 12; h++) expect(grid[h][asstCol]).toBe(6);
    for (let h = 12; h < 22; h++) expect(grid[h][asstCol]).toBe(5);
    expect(grid[6][asstCol]).toBe(0);
    expect(grid[22][asstCol]).toBe(0);
    const summary = dailySummaries.find((s) => s.position === '助理員')!;
    expect(summary.requiredDailyHours).toBe(80);
  });

  it('總結只列最低要求目標，不含達標比對', () => {
    const { dailySummaries } = computeStaffingRequirements(makeInput({ currentResidents: 100 }));
    for (const s of dailySummaries) {
      expect(s.requiredDailyHours).toBeGreaterThanOrEqual(0);
      expect(s.minHeadcount).toBeGreaterThanOrEqual(0);
    }
  });
});
