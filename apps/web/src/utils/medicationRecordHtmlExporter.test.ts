import { describe, it, expect } from 'vitest';
import {
  packBlocksForSignatureEfficiency,
  orderPrescriptionsForSignatureEfficiency,
  preparePages,
} from './medicationRecordHtmlExporter';

// 雷燕優（C209-1）2026-08 口服處方（真實資料）
const rx = (name: string, slots: string[]) => ({
  medication_name: name,
  administration_route: '口服',
  medication_time_slots: slots,
  inspection_rules: [],
});

const LEI_ORAL = [
  rx('CYANOCOBALAMIN (VIT B12) TABLET 50MCG', ['08:00', '16:00']),
  rx('ENERVON C TABLET', ['08:00']),
  rx('THIAMINE HCL (VIT B1) TABLET 50MG', ['08:00', '16:00']),
  rx('LISINOPRIL TABLET 5MG', ['08:00', '16:00']),
  rx('AMLODIPINE (BESYLATE) TABLET 5MG', ['08:00']),
  rx('SENNA TABLET 7.5MG', []),
  rx('ALENDRONATE SODIUM TAB (70MG ALENDRONIC ACID)', ['07:00']),
  rx('CALCIUM（CARBONATE）+VITAMIN D CHEW TAB 1000MG CA+800IU', ['08:00']),
  rx('METFORMIN HCL TABLET 500MG', ['08:00', '16:00']),
  rx('METFORMIN HCL TABLET 250MG', ['08:00', '16:00']),
];

// 全域搜尋後 page1 = 五個 {08:00,16:00}；同頁按時序排列，sig 相同再按藥名排序
const PAGE1_NAMES = [
  'CYANOCOBALAMIN (VIT B12) TABLET 50MCG',
  'LISINOPRIL TABLET 5MG',
  'METFORMIN HCL TABLET 250MG',
  'METFORMIN HCL TABLET 500MG',
  'THIAMINE HCL (VIT B1) TABLET 50MG',
];
// page2 = {07:00} 在前，三個 {08:00} 按藥名排序
const PAGE2_NAMES = [
  'ALENDRONATE SODIUM TAB (70MG ALENDRONIC ACID)',
  'AMLODIPINE (BESYLATE) TABLET 5MG',
  'CALCIUM（CARBONATE）+VITAMIN D CHEW TAB 1000MG CA+800IU',
  'ENERVON C TABLET',
];

describe('packBlocksForSignatureEfficiency（雷燕優個案）', () => {
  const scheduled = LEI_ORAL.filter((p) => p.medication_time_slots.length > 0);
  const blocks = scheduled.map((p) => ({ prescription: p, timeSlots: p.medication_time_slots }));
  // footerLegendMm=20 等同 estimateFooterLegendMm(0)（無職員代號）
  const pages = packBlocksForSignatureEfficiency(blocks, 20);

  it('頁面按首列處方的第一個時間點排序：{07:00} 頁在 {08:00} 頁之前', () => {
    expect(pages).toHaveLength(2);
    expect(pages[0].map((b) => b.prescription.medication_name)).toEqual(PAGE2_NAMES);
    expect(pages[1].map((b) => b.prescription.medication_name)).toEqual(PAGE1_NAMES);
  });

  it('各頁彙總區不同時段數合計為 4（2+2），而非 5（2+3）', () => {
    const total = pages.reduce((n, page) => n + new Set(page.flatMap((b) => b.timeSlots)).size, 0);
    expect(total).toBe(4);
  });
});

describe('orderPrescriptionsForSignatureEfficiency（modal 預覽＝列印順序）', () => {
  it('展平順序與分頁一致，無時段處方（SENNA）排最後', () => {
    const ordered = orderPrescriptionsForSignatureEfficiency(LEI_ORAL);
    expect(ordered.map((p) => p.medication_name)).toEqual([
      ...PAGE2_NAMES,
      ...PAGE1_NAMES,
      'SENNA TABLET 7.5MG',
    ]);
  });
});

// 詹金花（C213-2）2026-08 口服處方（真實資料）
const ZHAN_ORAL = [
  rx('ATENOLOL TABLET 50MG', ['08:00']),
  rx('CALCIUM CARBONATE + VITAMIN D (CALCICHEW D3) CHEWABLE TABLET 1000MG CA + 800IU', ['08:00']),
  rx('ASPIRIN TABLET 80MG', ['08:00']),
  rx('FRUSEMIDE (FUROSEMIDE) TABLET 40MG', ['08:00']),
  rx('AMLODIPINE TABLET 5MG', ['20:00']),
  rx('SENNA TABLET 7.5MG', ['20:00']),
  rx('SIMVASTATIN TABLET 10MG', ['20:00']),
  rx('LANSOPRAZOLE ORODISPERSIBLE TAB 30MG', ['07:00']),
  rx('PARACETAMOL TABLET 500MG', ['08:00', '12:00']),
  rx('LISINOPRIL TABLET 5MG', ['08:00', '16:00']),
  rx('ISOSORBIDE MONONITRATE TAB 20MG', ['08:00', '20:00']),
];

describe('packBlocksForSignatureEfficiency（詹金花個案）', () => {
  const blocks = ZHAN_ORAL.map((p) => ({ prescription: p, timeSlots: p.medication_time_slots }));
  const pages = packBlocksForSignatureEfficiency(blocks, 20);

  it('全域最優：3 頁、彙總區不同時段數合計為 6（舊貪心為 8，人手排法為 7）', () => {
    expect(pages).toHaveLength(3);
    const total = pages.reduce((n, page) => n + new Set(page.flatMap((b) => b.timeSlots)).size, 0);
    expect(total).toBe(6);
  });

  it('每頁內部已按時序排列（首時段分鐘數遞增）', () => {
    for (const page of pages) {
      const firsts = page.map((b) => {
        const [h, m] = b.timeSlots[0].split(':').map(Number);
        return h * 60 + m;
      });
      const sorted = [...firsts].sort((a, b) => a - b);
      expect(firsts).toEqual(sorted);
    }
  });
});

// ---- 「檢測項獨立分頁」選項 ----

const PATIENT = { 院友id: 1, 中文姓氏: '陳', 中文名字: '大文' };

const normalRx = (name: string, slots: string[]) => ({
  medication_name: name,
  administration_route: '口服',
  medication_time_slots: slots,
  inspection_rules: [],
});

const inspectionRx = (name: string, slots: string[]) => ({
  medication_name: name,
  administration_route: '口服',
  medication_time_slots: slots,
  inspection_rules: [
    { vital_sign_type: '血壓', condition_operator: 'gte', condition_value: 90, action_if_met: 'block_dispensing' },
  ],
});

const RXS = [
  normalRx('AMLODIPINE TABLET 5MG', ['08:00']),
  inspectionRx('METFORMIN HCL TABLET 500MG', ['08:00', '16:00']),
  normalRx('SENNA TABLET 7.5MG', ['20:00']),
];

describe('preparePages（檢測項獨立分頁：關閉）', () => {
  const pages = preparePages(PATIENT, RXS, true, 0, 'efficiency', false);

  it('行為與原本一致：檢測項處方混入常規分頁，全部處方都在頁面上', () => {
    expect(pages.flatMap((p) => p.blocks).map((b) => b.prescription.medication_name).sort())
      .toEqual(RXS.map((r) => r.medication_name).sort());
  });

  it('含檢測項處方所在頁照常補空白列（fillerCount > 0）', () => {
    const inspPages = pages.filter((p) => p.blocks.some((b) => b.prescription.inspection_rules.length > 0));
    expect(inspPages.length).toBeGreaterThan(0);
    expect(inspPages.every((p) => p.fillerCount > 0)).toBe(true);
  });
});

describe('preparePages（檢測項獨立分頁：開啟）', () => {
  const pages = preparePages(PATIENT, RXS, true, 0, 'efficiency', true);

  it('含檢測項處方裝入獨立頁，排於常規頁之後（單個 block 獨佔一頁）', () => {
    const inspPages = pages.filter((p) => p.blocks.some((b) => b.prescription.inspection_rules.length > 0));
    expect(inspPages).toHaveLength(1);
    expect(inspPages[0].blocks).toHaveLength(1);
    expect(inspPages[0].blocks[0].prescription.medication_name).toBe('METFORMIN HCL TABLET 500MG');
    expect(pages[pages.length - 1]).toBe(inspPages[0]);
  });

  it('檢測項獨立頁即使勾了包含空白列也不補空白列（fillerCount = 0）', () => {
    const inspPage = pages[pages.length - 1];
    expect(inspPage.fillerCount).toBe(0);
  });

  it('唔含檢測項嘅處方維持原有分頁同行為（仍補空白列）', () => {
    const normalPages = pages.slice(0, -1);
    expect(normalPages.flatMap((p) => p.blocks).map((b) => b.prescription.medication_name).sort())
      .toEqual(['AMLODIPINE TABLET 5MG', 'SENNA TABLET 7.5MG']);
    expect(normalPages.some((p) => p.fillerCount > 0)).toBe(true);
  });

  it('口服途徑頁碼連貫：pageIndexInRoute 1..N，pageCountInRoute = N（含檢測項獨立頁）', () => {
    expect(pages.map((p) => p.pageIndexInRoute)).toEqual(pages.map((_, i) => i + 1));
    expect(pages.every((p) => p.pageCountInRoute === pages.length)).toBe(true);
  });
});

describe('preparePages（檢測項獨立分頁：時間點互斥共用頁）', () => {
  it('兩條有檢測項處方時間點相同 → 分開兩頁', () => {
    const rxs = [
      inspectionRx('METFORMIN HCL TABLET 500MG', ['08:00']),
      inspectionRx('METFORMIN HCL TABLET 250MG', ['08:00']),
    ];
    const pages = preparePages(PATIENT, rxs, false, 0, 'efficiency', true);
    const inspPages = pages.filter((p) => p.blocks.some((b) => b.prescription.inspection_rules.length > 0));
    expect(inspPages).toHaveLength(2);
    expect(inspPages.every((p) => p.blocks.length === 1)).toBe(true);
    expect(inspPages.every((p) => p.fillerCount === 0)).toBe(true);
  });

  it('兩條有檢測項處方時間點唔同 → 同一頁（高度容許）', () => {
    const rxs = [
      inspectionRx('METFORMIN HCL TABLET 500MG', ['08:00']),
      inspectionRx('METFORMIN HCL TABLET 250MG', ['16:00']),
    ];
    const pages = preparePages(PATIENT, rxs, false, 0, 'efficiency', true);
    const inspPages = pages.filter((p) => p.blocks.some((b) => b.prescription.inspection_rules.length > 0));
    expect(inspPages).toHaveLength(1);
    expect(inspPages[0].blocks.map((b) => b.prescription.medication_name).sort())
      .toEqual(['METFORMIN HCL TABLET 250MG', 'METFORMIN HCL TABLET 500MG']);
    expect(inspPages[0].fillerCount).toBe(0);
  });

  it('時間點唔同但同時包含一個相同時間點 → 分開兩頁', () => {
    const rxs = [
      inspectionRx('METFORMIN HCL TABLET 500MG', ['08:00', '16:00']),
      inspectionRx('METFORMIN HCL TABLET 250MG', ['16:00', '20:00']),
    ];
    const pages = preparePages(PATIENT, rxs, false, 0, 'efficiency', true);
    const inspPages = pages.filter((p) => p.blocks.some((b) => b.prescription.inspection_rules.length > 0));
    expect(inspPages).toHaveLength(2);
  });

  it('無時間點嘅檢測項處方唔會同任何處方衝突，可同頁', () => {
    const rxs = [
      inspectionRx('METFORMIN HCL TABLET 500MG', ['08:00']),
      inspectionRx('INSULIN INJECTION', []),
    ];
    const pages = preparePages(PATIENT, rxs, false, 0, 'efficiency', true);
    const inspPages = pages.filter((p) => p.blocks.some((b) => b.prescription.inspection_rules.length > 0));
    expect(inspPages).toHaveLength(1);
    expect(inspPages[0].blocks).toHaveLength(2);
  });
});

describe('preparePages（藥物數量參考：全部在服處方）', () => {
  const qtyRx = (name: string, amount: number, slots: string[]) => ({
    medication_name: name,
    administration_route: '口服',
    medication_time_slots: slots,
    dosage_amount: amount,
    dosage_unit: '粒',
    frequency_type: 'daily',
    inspection_rules: [],
  });

  it('冇傳 quantityStatPrescriptions：fallback 用勾選清單計統計', () => {
    const pages = preparePages(PATIENT, [qtyRx('A', 1, ['08:00'])], false, 0, 'efficiency', false);
    expect(pages[0].oralQuantityStat).toBe('藥物數量參考 8A(1)');
  });

  it('傳咗在服全集：未勾選嘅在服口服處方都計入統計', () => {
    const selected = [qtyRx('A', 1, ['08:00'])];
    const allActive = [qtyRx('A', 1, ['08:00']), qtyRx('B', 2, ['08:00']), qtyRx('C', 3, ['20:00'])];
    const pages = preparePages(PATIENT, selected, false, 0, 'efficiency', false, allActive);
    expect(pages[0].oralQuantityStat).toBe('藥物數量參考 8A(3) 8P(3)');
  });

  it('統計清單中非口服途徑處方會被濾走', () => {
    const selected = [qtyRx('A', 1, ['08:00'])];
    const allActive = [
      qtyRx('A', 1, ['08:00']),
      { ...qtyRx('D', 5, ['08:00']), administration_route: '皮下注射' },
    ];
    const pages = preparePages(PATIENT, selected, false, 0, 'efficiency', false, allActive);
    expect(pages[0].oralQuantityStat).toBe('藥物數量參考 8A(1)');
  });
});
