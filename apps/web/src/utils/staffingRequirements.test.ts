import { describe, it, expect } from 'vitest';
import {
  computeStaffingRequirements,
  minHeadcountForPosition,
  natureDenominator,
} from './staffingRequirements';
import {
  DEFAULT_BED_COUNTS,
  DEFAULT_SPECIFIC_HOURS_CONFIG,
  GRID_POSITIONS,
  STATUTORY_RATIOS,
  type NatureBedCounts,
  type SpecificHoursConfig,
} from './facilityNatureSettings';

const col = (pos: string) => GRID_POSITIONS.indexOf(pos as (typeof GRID_POSITIONS)[number]);

function makeInput(overrides: {
  bedCounts?: Partial<NatureBedCounts>;
  specific?: SpecificHoursConfig;
  currentResidents?: number;
}) {
  return {
    bedCounts: { ...DEFAULT_BED_COUNTS, ...overrides.bedCounts },
    specific: overrides.specific ?? DEFAULT_SPECIFIC_HOURS_CONFIG,
    currentResidents: overrides.currentResidents ?? 0,
  };
}

// 預設時段：護理員 10h = 07:00–17:00；護士／保健員 13h = 07:00–20:00；助理員 11h = 07:00–18:00
const NURSE_HW_START = 7;
const NURSE_HW_END = 20;
const ASST_START = 7;
const ASST_END = 18;

describe('natureDenominator', () => {
  it('安老院 = max(0, 在住 − 三個計劃類宿位總和)；買位類 = 該類宿位數', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 50, 甲一買位: 50 };
    expect(natureDenominator('安老院', bedCounts, 100)).toBe(50);
    expect(natureDenominator('甲一買位', bedCounts, 100)).toBe(50);
    expect(natureDenominator('安老院', bedCounts, 40)).toBe(0);
  });
});

describe('法定比例（附表1寫死）', () => {
  it('護理員 1:20／1:40；助理員 1:40；保健員 1:30；護士視同 2 保健員（1:60）', () => {
    expect(STATUTORY_RATIOS).toEqual({
      careWorkerDay: 20,
      careWorkerNight: 40,
      assistant: 40,
      healthWorker: 30,
      nurse: 60,
    });
  });

  it('預設時段長度：護理員 10h、護士／保健員 13h、助理員 11h', () => {
    const len = (s: string, e: string) => {
      const [sh, sm] = s.split(':').map(Number);
      const [eh, em] = e.split(':').map(Number);
      return eh * 60 + em - (sh * 60 + sm);
    };
    const d = DEFAULT_SPECIFIC_HOURS_CONFIG;
    expect(
      d.requirement1.segments.reduce((sum, seg) => sum + len(seg.start, seg.end), 0)
    ).toBe(10 * 60);
    expect(len(d.requirement3.start, d.requirement3.end)).toBe(13 * 60);
    expect(len(d.assistantWindow.start, d.assistantWindow.end)).toBe(11 * 60);
  });
});

describe('向上取整（ceil）', () => {
  it('甲一 40 宿位助理員 1:9.09 類小數結果必須進位：41 宿位 1:40 → ceil(1.025) = 2', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 41 };
    expect(minHeadcountForPosition('助理員', bedCounts, 41)).toBe(2);
  });

  it('護理員 10h：21 名住客 1:20 → ceil(1.05) = 2', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 21 };
    expect(minHeadcountForPosition('護理員', bedCounts, 21)).toBe(2);
  });

  it('保健員：全院在住 91 人 1:30 → ceil(3.03) = 4', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 100 };
    expect(minHeadcountForPosition('保健員', bedCounts, 91)).toBe(4);
  });
});

describe('每日最低僱用人數', () => {
  it('主管不用比例制：有宿位時固定 1 人（混合性質亦為 1），無宿位為 0', () => {
    const mixed = { ...DEFAULT_BED_COUNTS, 安老院: 50, 甲一買位: 50 };
    expect(minHeadcountForPosition('主管', mixed, 100)).toBe(1);
    expect(minHeadcountForPosition('主管', { ...DEFAULT_BED_COUNTS }, 0)).toBe(0);
  });

  it('護理員：各性質 ceil(分母÷20) 總和（50 甲一 + 50 私位 → 3 + 3 = 6）', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 50, 甲一買位: 50 };
    expect(minHeadcountForPosition('護理員', bedCounts, 100)).toBe(6);
  });

  it('助理員：各性質 ceil(分母÷40) 總和（100 私位 → 3）', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 100 };
    expect(minHeadcountForPosition('助理員', bedCounts, 100)).toBe(3);
  });

  it('註冊護士：有甲一／院舍卷宿位時保底 1 名當值，否則為 0', () => {
    expect(
      minHeadcountForPosition('註冊護士', { ...DEFAULT_BED_COUNTS, 甲一買位: 50 }, 100)
    ).toBe(1);
    expect(
      minHeadcountForPosition('註冊護士', { ...DEFAULT_BED_COUNTS, 院舍卷計劃: 50 }, 100)
    ).toBe(1);
    expect(
      minHeadcountForPosition('註冊護士', { ...DEFAULT_BED_COUNTS, 安老院: 100 }, 100)
    ).toBe(0);
  });

  it('保健員：有甲一／院舍卷宿位時由排班決定組合，最低僱用人數為 0', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 50, 甲一買位: 50 };
    expect(minHeadcountForPosition('保健員', bedCounts, 100)).toBe(0);
  });

  it('任何員工（夜班兩名）可兼任，不計入僱用人數', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 100 };
    expect(minHeadcountForPosition('任何員工', bedCounts, 100)).toBe(0);
  });
});

describe('computeStaffingRequirements', () => {
  it('護理員欄：100 私位 → 指明期間（07:00–17:00）每小時 5，其餘時間 3', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 安老院: 100 }, currentResidents: 100 })
    );
    const careCol = col('護理員');
    for (let h = 7; h < 17; h++) {
      expect(grid[h][careCol]).toBe(5); // ceil(100/20)
    }
    for (const h of [0, 6, 17, 23]) {
      expect(grid[h][careCol]).toBe(3); // ceil(100/40)
    }
  });

  it('護理員欄跨性質加總：50 甲一 + 50 私位 → 期間內 3+3=6，期間外 2+2=4', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 甲一買位: 50, 安老院: 50 }, currentResidents: 100 })
    );
    const careCol = col('護理員');
    expect(grid[8][careCol]).toBe(6);
    expect(grid[20][careCol]).toBe(4);
  });

  it('助理員欄：100 私位 → 指明期間（07:00–18:00）每小時 ceil(100/40)=3，時段外為 0', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 安老院: 100 }, currentResidents: 100 })
    );
    const asstCol = col('助理員');
    for (let h = ASST_START; h < ASST_END; h++) {
      expect(grid[h][asstCol]).toBe(3);
    }
    expect(grid[6][asstCol]).toBe(0);
    expect(grid[18][asstCol]).toBe(0);
  });

  it('助理員欄向上取整：41 私位 → 時段內 2', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 安老院: 41 }, currentResidents: 41 })
    );
    expect(grid[8][col('助理員')]).toBe(2);
  });

  it('護士／保健員 13h：甲一／院舍卷混合約束不預填欄，註冊護士保底 1', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 甲一買位: 10 }, currentResidents: 100 })
    );
    const rnCol = col('註冊護士');
    const hwCol = col('保健員');
    for (let h = NURSE_HW_START; h < NURSE_HW_END; h++) {
      expect(grid[h][rnCol]).toBe(1);
      expect(grid[h][hwCol]).toBe(0);
    }
    expect(grid[6][rnCol]).toBe(0);
    expect(grid[20][rnCol]).toBe(0);
  });

  it('護士／保健員 13h：安老院／甲二完全由保健員達標 → 時段內 ceil(在住÷30)', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 甲二買位: 40 }, currentResidents: 100 })
    );
    const rnCol = col('註冊護士');
    const hwCol = col('保健員');
    for (let h = NURSE_HW_START; h < NURSE_HW_END; h++) {
      expect(grid[h][rnCol]).toBe(0);
      expect(grid[h][hwCol]).toBe(4); // ceil(100/30)
    }
    expect(grid[6][hwCol]).toBe(0);
    expect(grid[20][hwCol]).toBe(0);
  });

  it('任何員工欄：18:00–翌日 07:00 固定 2 名（有宿位時），其餘時間為 0', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 安老院: 100 }, currentResidents: 100 })
    );
    const anyCol = col('任何員工');
    for (let h = 0; h < 24; h++) {
      const expected = h >= 18 || h < 7 ? 2 : 0;
      expect(grid[h][anyCol]).toBe(expected);
    }
  });

  it('任何員工欄：無宿位時全 0', () => {
    const { grid } = computeStaffingRequirements(makeInput({ currentResidents: 0 }));
    const anyCol = col('任何員工');
    for (let h = 0; h < 24; h++) {
      expect(grid[h][anyCol]).toBe(0);
    }
  });

  it('在住 0、無宿位 → 全部欄為 0', () => {
    const { grid } = computeStaffingRequirements(makeInput({ currentResidents: 0 }));
    for (let h = 0; h < 24; h++) {
      for (const v of grid[h]) {
        expect(v).toBe(0);
      }
    }
  });

  it('總結只列每日最低僱用人數', () => {
    const { dailySummaries } = computeStaffingRequirements(
      makeInput({ bedCounts: { 安老院: 100 }, currentResidents: 100 })
    );
    const hw = dailySummaries.find((s) => s.position === '保健員')!;
    expect(hw.minHeadcount).toBe(4); // ceil(100/30)
    const any = dailySummaries.find((s) => s.position === '任何員工')!;
    expect(any.minHeadcount).toBe(0); // 可兼任
  });
});
