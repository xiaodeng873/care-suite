import { describe, it, expect } from 'vitest';
import { extractPageConfig, groupPagesByConfig, type PageConfig } from './printUtils';

const makeHtml = (pageCss: string): string => `<!DOCTYPE html>
<html>
<head>
<style>
${pageCss}
</style>
</head>
<body><div>page</div></body>
</html>`;

describe('extractPageConfig', () => {
  it('parses A4 portrait with shorthand margin', () => {
    const html = makeHtml('@page { size: A4; margin: 5mm; }');
    expect(extractPageConfig(html)).toEqual({ size: 'A4', orientation: 'portrait', margin: '5mm 5mm 5mm 5mm' });
  });

  it('parses A4 landscape', () => {
    const html = makeHtml('@page { size: A4 landscape; margin: 6mm; }');
    expect(extractPageConfig(html)).toEqual({ size: 'A4', orientation: 'landscape', margin: '6mm 6mm 6mm 6mm' });
  });

  it('parses four-value margin and orientation property', () => {
    const html = makeHtml('@page { size: A4; margin: 5mm 10mm 8mm 12mm; orientation: landscape; }');
    expect(extractPageConfig(html)).toEqual({ size: 'A4', orientation: 'landscape', margin: '5mm 10mm 8mm 12mm' });
  });

  it('parses @page inside @media print', () => {
    const html = makeHtml('@media print { @page { size: A4; margin: 0; } }');
    expect(extractPageConfig(html)).toEqual({ size: 'A4', orientation: 'portrait', margin: '0 0 0 0' });
  });

  it('parses named @page and ignores later declarations', () => {
    const html = makeHtml('@page icp { size: A4; margin: 12mm 10mm 10mm 10mm; }');
    expect(extractPageConfig(html)).toEqual({ size: 'A4', orientation: 'portrait', margin: '12mm 10mm 10mm 10mm' });
  });

  it('defaults to A4 portrait margin 0 when no @page', () => {
    const html = makeHtml('body { margin: 0; }');
    expect(extractPageConfig(html)).toEqual({ size: 'A4', orientation: 'portrait', margin: '0 0 0 0' });
  });

  it('normalizes 210mm 297mm to A4 portrait for grouping', () => {
    const html = makeHtml('@page { size: 210mm 297mm; margin: 5mm 12mm; }');
    expect(extractPageConfig(html)).toEqual({ size: 'A4', orientation: 'portrait', margin: '5mm 12mm 5mm 12mm' });
  });

  it('normalizes 297mm 210mm to A4 landscape', () => {
    const html = makeHtml('@page { size: 297mm 210mm; margin: 5mm; }');
    expect(extractPageConfig(html)).toEqual({ size: 'A4', orientation: 'landscape', margin: '5mm 5mm 5mm 5mm' });
  });

  it('handles nested @page at-rules like @bottom-center', () => {
    const html = makeHtml(`@page {
      size: A4 landscape;
      margin: 5mm 10mm;
      @bottom-center { content: "x"; }
    }`);
    expect(extractPageConfig(html)).toEqual({ size: 'A4', orientation: 'landscape', margin: '5mm 10mm 5mm 10mm' });
  });
});

describe('groupPagesByConfig', () => {
  it('groups pages by identical config', () => {
    const p1 = makeHtml('@page { size: A4; margin: 5mm; }');
    const p2 = makeHtml('@page { size: A4; margin: 5mm 5mm; }');
    const p3 = makeHtml('@page { size: A4 landscape; margin: 5mm; }');
    const groups = groupPagesByConfig([p1, p2, p3]);
    expect(groups.size).toBe(2);
    const entries = Array.from(groups.values());
    expect(entries.find((g) => g.config.orientation === 'portrait')?.pages).toHaveLength(2);
    expect(entries.find((g) => g.config.orientation === 'landscape')?.pages).toHaveLength(1);
  });

  it('groups by size + orientation regardless of margin', () => {
    const p1 = makeHtml('@page { size: A4; margin: 5mm 0.25in; }');
    const p2 = makeHtml('@page { size: A4; margin: 0; }');
    const p3 = makeHtml('@page { size: A4 landscape; margin: 6mm; }');
    const groups = groupPagesByConfig([p1, p2, p3]);
    expect(groups.size).toBe(2);
    const entries = Array.from(groups.values());
    expect(entries.find((g) => g.config.orientation === 'portrait')?.pages).toHaveLength(2);
    expect(entries.find((g) => g.config.orientation === 'landscape')?.pages).toHaveLength(1);
  });

  it('skips empty pages', () => {
    const p1 = makeHtml('@page { size: A4; margin: 5mm; }');
    const groups = groupPagesByConfig([p1, '', '   ']);
    expect(groups.size).toBe(1);
    expect(Array.from(groups.values())[0].pages).toHaveLength(1);
  });
});
