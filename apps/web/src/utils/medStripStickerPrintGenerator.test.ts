import { describe, it, expect } from 'vitest';
import { generateMedStripStickerHtml } from './medStripStickerPrintGenerator';
import type { Patient } from '../lib/database';

const mkPatient = (id: number, bed: string, name: string): Patient =>
  ({ 院友id: id, 床號: bed, 中文姓名: name } as unknown as Patient);

describe('generateMedStripStickerHtml', () => {
  it('每位院友一頁，80 張貼紙，五色數量正確，藍排白前', () => {
    const html = generateMedStripStickerHtml([
      mkPatient(1, 'A101-1', '關賽杏'),
      mkPatient(2, 'C219-4', '胡甜妹'),
    ]);
    expect((html.match(/ms-page/g) || []).length).toBe(4); // 2 頁 + 2 條 CSS rule
    expect((html.match(/class="ms-sticker"/g) || []).length).toBe(160);
    expect((html.match(/ms-b-red/g) || []).length).toBe(33); // 32 + CSS
    expect((html.match(/ms-b-yel/g) || []).length).toBe(33);
    expect((html.match(/ms-b-grn/g) || []).length).toBe(33);
    expect((html.match(/ms-b-wht/g) || []).length).toBe(33);
    expect((html.match(/ms-b-blu/g) || []).length).toBe(33);
    // 每位院友貼紙順序：藍（其他）出現喺白（宵夜）之前
    const firstBlue = html.indexOf('ms-b-blu');
    const firstWhite = html.indexOf('ms-b-wht');
    expect(firstBlue).toBeGreaterThan(-1);
    expect(firstBlue).toBeLessThan(firstWhite);
    expect(html).toContain('A101-1 關賽杏');
    expect(html).toContain('C219-4 胡甜妹');
    expect(html).toContain('size: A4 portrait');
  });

  it('空白院友名單都出一頁空頁', () => {
    const html = generateMedStripStickerHtml([]);
    expect(html).toContain('ms-page');
    expect((html.match(/class="ms-sticker"/g) || []).length).toBe(0);
  });
});
