import { describe, it, expect } from 'vitest';
import {
  splitDayIntoPages,
  computeRecheckRows,
  A5_CONTENT_HEIGHT,
  HEADER_HEIGHT,
  SLOT_TITLE_HEIGHT,
  TABLE_HEADER_HEIGHT,
  ROW_HEIGHT,
  RECHECK_ROW_HEIGHT,
  SLOT_MARGIN,
} from './monitoringTaskWorksheetGenerator';

// 分頁規則測試：
// 1. 第 1 頁只放晚餐之前嘅時段（早餐/午餐）；晚餐同宵夜強制落第 2 頁（背頁）
// 2. 第 1 頁剩餘高度夠一列複檢（雙倍行高）先加；唔夠就唔加（唔爆版）

const task = (time: string) => ({
  床號: 'A01',
  姓名: '測試院友',
  任務類型: '生命表徵',
  備註: '',
  時間: time,
});

const makeDay = (counts: { 早餐?: number; 午餐?: number; 晚餐?: number; 宵夜?: number }) => {
  const fill = (n: number, baseHour: number) =>
    Array.from({ length: n }, (_, i) => task(`${String(baseHour + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`));
  return {
    date: '2026-08-01',
    dateShort: '01/08/2026',
    weekday: '星期六',
    tasks: {
      早餐: fill(counts.早餐 ?? 0, 7),
      午餐: fill(counts.午餐 ?? 0, 10),
      晚餐: fill(counts.晚餐 ?? 0, 14),
      宵夜: fill(counts.宵夜 ?? 0, 18),
    },
  };
};

const slotHeight = (taskCount: number) =>
  SLOT_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + SLOT_MARGIN + taskCount * ROW_HEIGHT;

describe('splitDayIntoPages', () => {
  it('晚餐同宵夜強制落第 2 頁；第 1 頁只有早餐/午餐', () => {
    const pages = splitDayIntoPages(makeDay({ 早餐: 5, 午餐: 5, 晚餐: 5, 宵夜: 2 }));
    expect(pages.length).toBe(2);
    expect(pages[0].slots.map(s => s.name)).toEqual(['早餐', '午餐']);
    expect(pages[1].slots.map(s => s.name)).toEqual(['晚餐', '宵夜']);
  });

  it('冇早餐/午餐任務時，第 1 頁照樣留空，晚餐落第 2 頁', () => {
    const pages = splitDayIntoPages(makeDay({ 晚餐: 5 }));
    expect(pages.length).toBe(2);
    expect(pages[0].slots).toEqual([]);
    expect(pages[1].slots.map(s => s.name)).toEqual(['晚餐']);
  });

  it('全日冇任務時維持一個空白頁', () => {
    const pages = splitDayIntoPages(makeDay({}));
    expect(pages.length).toBe(1);
    expect(pages[0].slots).toEqual([]);
  });

  it('只有早餐/午餐時全部喺第 1 頁（冇強制開新頁）', () => {
    const pages = splitDayIntoPages(makeDay({ 早餐: 10, 午餐: 10 }));
    expect(pages.length).toBe(1);
    expect(pages[0].slots.map(s => s.name)).toEqual(['早餐', '午餐']);
  });

  it('第 1 頁 usedHeight 反映已佔高度，供複檢空間計算', () => {
    const pages = splitDayIntoPages(makeDay({ 早餐: 5, 午餐: 3, 晚餐: 4 }));
    expect(pages[0].usedHeight).toBeCloseTo(HEADER_HEIGHT + slotHeight(5) + slotHeight(3), 5);
    expect(pages[1].slots.map(s => s.name)).toEqual(['晚餐']);
  });

  it('早餐/午餐多到要兩頁時，晚餐都係跟喺佢哋之後嘅新頁', () => {
    // 每頁 200mm：header 5.5 + 餐段基礎 10.5 + n×4.6 ≤ 200 → 單餐段最多 40 行
    const pages = splitDayIntoPages(makeDay({ 早餐: 45, 晚餐: 5 }));
    expect(pages.length).toBe(3);
    expect(pages[0].slots[0].name).toBe('早餐');
    expect(pages[0].slots[0].endIndex).toBeLessThan(44); // 早餐跨頁（續）
    expect(pages[2].slots.map(s => s.name)).toEqual(['晚餐']);
  });
});

describe('computeRecheckRows（第 1 頁複檢空間計算）', () => {
  const FOOTER_RESERVE = 7;
  const recheckBase = SLOT_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + SLOT_MARGIN + FOOTER_RESERVE;

  it('第 1 頁容納早餐/午餐後，剩餘空間夠先加到複檢列', () => {
    const pages = splitDayIntoPages(makeDay({ 早餐: 5, 午餐: 5, 晚餐: 5 }));
    const rows = computeRecheckRows(pages[0].usedHeight, A5_CONTENT_HEIGHT);
    const expected = Math.floor((A5_CONTENT_HEIGHT - pages[0].usedHeight - recheckBase) / RECHECK_ROW_HEIGHT);
    expect(rows).toBe(expected);
    expect(rows).toBeGreaterThan(0);
    // 加上複檢後唔會爆版：已用 + 複檢表頭 + n×雙倍行高 ≤ 內容高度
    expect(pages[0].usedHeight + recheckBase + rows * RECHECK_ROW_HEIGHT).toBeLessThanOrEqual(A5_CONTENT_HEIGHT);
  });

  it('第 1 頁塞滿時複檢列數為 0（唔好硬擠）', () => {
    // 45 行早餐分咗兩頁，令第 1 頁幾乎用盡；搵一個 usedHeight 好接近上限嘅情況直接驗算
    const rows = computeRecheckRows(A5_CONTENT_HEIGHT - RECHECK_ROW_HEIGHT + 0.1, A5_CONTENT_HEIGHT);
    expect(rows).toBe(0);
  });

  it('完全冇剩餘空間時複檢列數為 0', () => {
    expect(computeRecheckRows(A5_CONTENT_HEIGHT, A5_CONTENT_HEIGHT)).toBe(0);
  });
});
