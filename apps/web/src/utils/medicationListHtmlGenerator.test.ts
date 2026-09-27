import { describe, it, expect } from 'vitest';
import { paginateListRows, printableWidthPx } from './medicationListHtmlGenerator';

// LIST_PAGE_CONTENT_PX = round(287 * 96/25.4) = 1085；LIST_SAFETY_PX = round(3 * 96/25.4) = 11
// fixedPx = 200 → budgetPx = 874；emptyRowPx = 31.5
const baseMetrics = (rowPx: number[]) => ({
  fixedPx: 200,
  emptyRowPx: 31.5,
  rowPx,
});

const pageItems = <T,>(pages: { items: T[] }[]): T[][] => pages.map((p) => p.items);

describe('printableWidthPx', () => {
  it('margin: 5mm 0.25in（兩值）→ A4 闊減左右各 0.25in = 746px', () => {
    const template = '<style>@page { size: A4; margin: 5mm 0.25in; }</style>';
    expect(printableWidthPx(template)).toBe(746);
  });

  it('四值 margin 取第 4 個（左邊距）', () => {
    const template = '<style>@page { margin: 5mm 10mm 5mm 10mm; }</style>';
    // 左右各 10mm ≈ 37.8px → 794 − 76 = 718
    expect(printableWidthPx(template)).toBe(718);
  });

  it('冇 @page 或解析唔到 → fallback 0.25in', () => {
    expect(printableWidthPx('<style>body{}</style>')).toBe(746);
  });
});

describe('paginateListRows', () => {
  it('冇量度數據（null）時 fallback 固定 24 列一頁', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const pages = paginateListRows(items, null);
    expect(pages).toHaveLength(2);
    expect(pageItems(pages)[0]).toHaveLength(24);
    expect(pageItems(pages)[1]).toHaveLength(6);
    expect(pages.map((p) => p.padRows)).toEqual([0, 18]);
    expect(pageItems(pages).flat()).toEqual(items);
  });

  it('空清單回傳一頁空白（維持至少一頁嘅語義）', () => {
    expect(paginateListRows([], null)).toEqual([{ items: [], padRows: 24 }]);
    expect(paginateListRows([], baseMetrics([]))).toEqual([{ items: [], padRows: 24 }]);
  });

  it('全部單行高列：一頁裝到 24 列，照樣補滿空白', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const pages = paginateListRows(items, baseMetrics(items.map(() => 31.5)));
    expect(pages).toHaveLength(2);
    expect(pageItems(pages)[0]).toHaveLength(24);
    expect(pageItems(pages)[1]).toHaveLength(6);
    expect(pages.map((p) => p.padRows)).toEqual([0, 18]);
    expect(pageItems(pages).flat()).toEqual(items);
  });

  it('部分列高三倍：按真實列高總和分頁，唔計空白 padding 落預算', () => {
    // fixedPx = 100 → budgetPx = 974；首 4 條單行（31.5），其後三倍高（94.5，模擬長藥名/注意事項撑高）
    const items = Array.from({ length: 20 }, (_, i) => i);
    const rowPx = items.map((i) => (i < 4 ? 31.5 : 94.5));
    const pages = paginateListRows(items, { fixedPx: 100, emptyRowPx: 31.5, rowPx });
    expect(pageItems(pages)).toEqual([items.slice(0, 12), items.slice(12)]);
    expect(pages.map((p) => p.padRows)).toEqual([2, 6]);
    // 每頁真實列高和 + padding 唔超過預算；footer 由 flex margin-top:auto 釘底，唔靠 padding 定位
    let offset = 0;
    pages.forEach((p) => {
      const sum = rowPx.slice(offset, offset + p.items.length).reduce((s, h) => s + h, 0);
      expect(sum + p.padRows * 31.5).toBeLessThanOrEqual(974);
      offset += p.items.length;
    });
  });

  it('真實列總和高過預算少少都唔會硬拆（padding 讓位）', () => {
    // 23 條單行 = 724.5 ≤ 874，第 24 條加埋 = 756 都 ≤ 874——24 列一頁齊
    const items = Array.from({ length: 24 }, (_, i) => i);
    const pages = paginateListRows(items, baseMetrics(items.map(() => 31.5)));
    expect(pageItems(pages)).toEqual([items]);
  });

  it('rowPx 缺項（量度漏列）用 emptyRowPx 補', () => {
    const items = [0, 1, 2];
    const pages = paginateListRows(items, baseMetrics([31.5]));
    expect(pageItems(pages).flat()).toEqual(items);
  });
});
