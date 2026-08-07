import { describe, it, expect } from 'vitest';
import {
  a1ContractDailyHours,
  computeDualRedLineStaffing,
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

  it('護理員：以全院在住人數計算（50 甲一 + 50 私位 → 100 人 → ceil(100/20)=5）', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 50, 甲一買位: 50 };
    expect(minHeadcountForPosition('護理員', bedCounts, 100)).toBe(5);
  });

  it('助理員：各性質 ceil(分母÷40) 總和（100 私位 → 3）', () => {
    const bedCounts = { ...DEFAULT_BED_COUNTS, 安老院: 100 };
    expect(minHeadcountForPosition('助理員', bedCounts, 100)).toBe(3);
  });

  it('註冊/登記護士：有甲一買位宿位時保底 1 名當值，否則為 0', () => {
    expect(
      minHeadcountForPosition('註冊/登記護士', { ...DEFAULT_BED_COUNTS, 甲一買位: 50 }, 100)
    ).toBe(1);
    expect(
      minHeadcountForPosition('註冊/登記護士', { ...DEFAULT_BED_COUNTS, 安老院: 100 }, 100)
    ).toBe(0);
  });

  it('保健員：以全院在住人數計算；有甲一時先扣除 1 名註冊護士貢獻的 2 當量', () => {
    // 甲二 40 床位（在住 40）→ ceil(40/30) = 2
    const a2Only = { ...DEFAULT_BED_COUNTS, 甲二買位: 40 };
    expect(minHeadcountForPosition('保健員', a2Only, 40)).toBe(2);

    // 安老院 100 私位 + 甲二 0 → ceil(100/30) = 4
    const private100 = { ...DEFAULT_BED_COUNTS, 安老院: 100 };
    expect(minHeadcountForPosition('保健員', private100, 100)).toBe(4);

    // 有甲一時：100 人，保健員當量 ceil(100/30)=4，1 名護士視同 2 當量 → 保健員 2
    const mixed = { ...DEFAULT_BED_COUNTS, 安老院: 50, 甲一買位: 50 };
    expect(minHeadcountForPosition('保健員', mixed, 100)).toBe(2);
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

  it('護理員欄以全院在住人數計算：50 甲一 + 50 私位 → 100 人，期間內 5，期間外 3', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 甲一買位: 50, 安老院: 50 }, currentResidents: 100 })
    );
    const careCol = col('護理員');
    expect(grid[8][careCol]).toBe(5);
    expect(grid[20][careCol]).toBe(3);
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

  it('護士／保健員 13h：甲一買位護士與保健員混合貢獻，至少 1 名註冊護士', () => {
    const nurseCol = col('註冊/登記護士');
    const hwCol = col('保健員');

    // 40 甲一宿位：總當量 ceil(40/30)=2；護士至少 1 名（貢獻 2 當量），保健員 0
    const a1_40 = makeInput({ bedCounts: { 甲一買位: 40 }, currentResidents: 40 });
    const { grid: g1 } = computeStaffingRequirements(a1_40);
    for (let h = NURSE_HW_START; h < NURSE_HW_END; h++) {
      expect(g1[h][nurseCol]).toBe(1);
      expect(g1[h][hwCol]).toBe(0);
    }

    // 100 甲一宿位：總當量 ceil(100/30)=4；護士至少 1 名（貢獻 2 當量），保健員 2
    const a1_100 = makeInput({ bedCounts: { 甲一買位: 100 }, currentResidents: 100 });
    const { grid: g2 } = computeStaffingRequirements(a1_100);
    for (let h = NURSE_HW_START; h < NURSE_HW_END; h++) {
      expect(g2[h][nurseCol]).toBe(1);
      expect(g2[h][hwCol]).toBe(2);
    }

    // 70 甲一宿位：總當量 ceil(70/30)=3；護士至少 1 名（貢獻 2 當量），保健員 1
    const a1_70 = makeInput({ bedCounts: { 甲一買位: 70 }, currentResidents: 70 });
    const { grid: g3 } = computeStaffingRequirements(a1_70);
    for (let h = NURSE_HW_START; h < NURSE_HW_END; h++) {
      expect(g3[h][nurseCol]).toBe(1);
      expect(g3[h][hwCol]).toBe(1);
    }
  });

  it('護士／保健員 13h：安老院／甲二完全由保健員按各自分母達標，甲二 0 宿位則為 0', () => {
    // 安老院 100 私位 → 保健員時段內 ceil(100/30)=4
    const privateOnly = makeInput({ bedCounts: { 安老院: 100 }, currentResidents: 100 });
    const { grid: g1 } = computeStaffingRequirements(privateOnly);
    const nurseCol = col('註冊/登記護士');
    const hwCol = col('保健員');
    for (let h = NURSE_HW_START; h < NURSE_HW_END; h++) {
      expect(g1[h][nurseCol]).toBe(0);
      expect(g1[h][hwCol]).toBe(4);
    }
    expect(g1[6][hwCol]).toBe(0);
    expect(g1[20][hwCol]).toBe(0);

    // 甲二 40 床位（無安老院私位）→ 保健員時段內 ceil(40/30)=2
    const a2Only = makeInput({ bedCounts: { 甲二買位: 40 }, currentResidents: 40 });
    const { grid: g2 } = computeStaffingRequirements(a2Only);
    for (let h = NURSE_HW_START; h < NURSE_HW_END; h++) {
      expect(g2[h][nurseCol]).toBe(0);
      expect(g2[h][hwCol]).toBe(2);
    }

    // 甲二 0 宿位且無其他宿位 → 全部為 0
    const a2Zero = makeInput({ bedCounts: { 甲二買位: 0 }, currentResidents: 0 });
    const { grid: g3 } = computeStaffingRequirements(a2Zero);
    for (let h = 0; h < 24; h++) {
      expect(g3[h][hwCol]).toBe(0);
      expect(g3[h][nurseCol]).toBe(0);
    }
  });

  it('任何員工欄：其他職位夜班已達 2 名時顯示 0（可兼任，只補差額）', () => {
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 安老院: 100 }, currentResidents: 100 })
    );
    const anyCol = col('任何員工');
    // 100 私位夜班護理員 = ceil(100/40) = 3 ≥ 2 → 任何員工全欄 0
    for (let h = 0; h < 24; h++) {
      expect(grid[h][anyCol]).toBe(0);
    }
  });

  it('任何員工欄：細院舍夜班護理員不足 2 名時補差額', () => {
    // 30 私位 → 夜班護理員 ceil(30/40) = 1。
    // h=18,19 保健員 13h 時段（07:00–20:00）仍在班（1 名）→ 全院已有 2 名 → 補 0；
    // h=20–23、0–6 只有護理員 1 名 → 補 1。
    const { grid } = computeStaffingRequirements(
      makeInput({ bedCounts: { 安老院: 30 }, currentResidents: 30 })
    );
    const anyCol = col('任何員工');
    for (let h = 0; h < 24; h++) {
      const inNight = h >= 18 || h < 7;
      const hwOnDuty = h >= NURSE_HW_START && h < NURSE_HW_END ? 1 : 0; // ceil(30/30)
      const expected = inNight ? Math.max(0, 2 - 1 - hwOnDuty) : 0;
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

describe('雙紅線獨立合格引擎', () => {
  it('甲一合約工時換算：40 宿位基準', () => {
    // 主管固定 48/7 ≈ 6.857 → 7.0
    expect(a1ContractDailyHours('主管', 40)).toBe(7.0);
    // 護士 96/7 ≈ 13.714 → 14.0（向上取整至 0.5）
    expect(a1ContractDailyHours('護士', 40)).toBe(14.0);
    // 保健員 96/7 ≈ 13.714 → 14.0
    expect(a1ContractDailyHours('保健員', 40)).toBe(14.0);
    // 護理員 384/7 ≈ 54.857 → 55.0
    expect(a1ContractDailyHours('護理員', 40)).toBe(55.0);
    // 助理員 192/7 ≈ 27.429 → 27.5
    expect(a1ContractDailyHours('助理員', 40)).toBe(27.5);
  });

  it('甲一合約工時換算：非 40 倍數按比例換算後向上取整', () => {
    // 41 宿位：護士 96×41/40/7 ≈ 14.057 → 14.5
    expect(a1ContractDailyHours('護士', 41)).toBe(14.5);
    // 50 宿位：護士 96×50/40/7 ≈ 17.143 → 17.5
    expect(a1ContractDailyHours('護士', 50)).toBe(17.5);
    // 主管不按比例，固定 7.0
    expect(a1ContractDailyHours('主管', 100)).toBe(7.0);
  });

  it('甲一 0 宿位時所有合約工時為 0', () => {
    expect(a1ContractDailyHours('主管', 0)).toBe(0);
    expect(a1ContractDailyHours('護士', 0)).toBe(0);
    expect(a1ContractDailyHours('保健員', 0)).toBe(0);
  });

  it('雙紅線獨立合格：紅線2目標 > 紅線1隱含時，每日總工時 = 紅線2目標', () => {
    const input = makeInput({ bedCounts: { 甲一買位: 40 }, currentResidents: 40 });
    const result = computeDualRedLineStaffing(input);

    // 主管：紅線1隱含 0，紅線2目標 7.0 → 每日總工時 7.0
    expect(result.statutoryImpliedHours['主管']).toBe(0);
    expect(result.contractTargetHours['主管']).toBe(7.0);
    expect(result.dailyHours['主管']).toBe(7.0);
    expect(result.supplementaryHours['主管']).toBe(7.0);

    // 護理員：紅線1隱含工時（10h×2 + 14h×1 = 34）> 紅線2目標 55.0？不，紅線1隱含是 34，紅線2是 55
    // 實際上 40 甲一宿位：護理員 10h 內 ceil(40/20)=2，其餘 14h ceil(40/40)=1，總共 2×10 + 1×14 = 34
    // 紅線2目標 55.0 > 34，所以每日總工時 = 55.0
    expect(result.dailyHours['護理員']).toBe(55.0);
    expect(result.supplementaryHours['護理員']).toBe(21.0); // 55 - 34
  });

  it('≥8h 硬約束：工時只看紅線2合約，不與紅線1隱含工時混合', () => {
    // 甲一 10 宿位：紅線1 13h 時段護士=1（隱含 13h），紅線2合約 3.5h
    const input = makeInput({ bedCounts: { 甲一買位: 10 }, currentResidents: 10 });
    const result = computeDualRedLineStaffing(input);

    // 「護士」合約工時計入註冊/登記護士
    expect(result.contractTargetHours['註冊/登記護士']).toBe(3.5);
    // 工時只看紅線2，不看紅線1隱含工時
    expect(result.dailyHours['註冊/登記護士']).toBe(3.5);
  });

  it('護士替代保健員：紅線1當量正確，紅線2工時獨立', () => {
    const input = makeInput({ bedCounts: { 甲一買位: 40 }, currentResidents: 40 });
    const result = computeDualRedLineStaffing(input);

    // 紅線1：13h 時段護士=1（貢獻 2 當量），保健員=0
    // 紅線2：護士合約工時計入註冊/登記護士，保健員獨立計算
    expect(result.contractTargetHours['註冊/登記護士']).toBe(14.0);
    expect(result.contractTargetHours['保健員']).toBe(14.0);
    expect(result.dailyHours['註冊/登記護士']).toBe(14.0);
    expect(result.dailyHours['保健員']).toBe(14.0);
  });

  it('甲一或甲二有買位宿位時 hasContractHours 為 true，否則 false', () => {
    expect(computeDualRedLineStaffing(makeInput({ bedCounts: { 甲一買位: 40 } })).hasContractHours).toBe(true);
    expect(computeDualRedLineStaffing(makeInput({ bedCounts: { 甲二買位: 40 } })).hasContractHours).toBe(true);
    expect(computeDualRedLineStaffing(makeInput({ bedCounts: { 安老院: 40 } })).hasContractHours).toBe(false);
    expect(computeDualRedLineStaffing(makeInput({})).hasContractHours).toBe(false);
  });
});
