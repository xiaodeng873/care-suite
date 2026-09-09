import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const data = new Uint8Array(fs.readFileSync('upload/rvp202627_consent_form_aged_18_or_above_chi.pdf'));
const doc = await pdfjs.getDocument({ data }).promise;
console.log('pages:', doc.numPages);
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const vp = page.getViewport({ scale: 1 });
  console.log(`\n===== PAGE ${p} (${vp.width.toFixed(0)}x${vp.height.toFixed(0)}) items=${tc.items.length} =====`);
  // 按 y 分組、x 排序，重建行
  const lines = new Map();
  for (const it of tc.items) {
    const y = Math.round(it.transform[5]);
    const x = it.transform[4];
    if (!lines.has(y)) lines.set(y, []);
    lines.get(y).push({ x, str: it.str });
  }
  const ys = [...lines.keys()].sort((a, b) => b - a);
  for (const y of ys) {
    const parts = lines.get(y).sort((a, b) => a.x - b.x);
    const line = parts.map(p2 => p2.str).join('');
    if (line.trim()) console.log(`y=${String(y).padStart(4)} | ${line}`);
  }
}
