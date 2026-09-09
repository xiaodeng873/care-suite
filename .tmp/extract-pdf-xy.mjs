import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const data = new Uint8Array(fs.readFileSync('upload/rvp202627_consent_form_aged_18_or_above_chi.pdf'));
const doc = await pdfjs.getDocument({ data }).promise;
for (let p = 1; p <= 4; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  console.log(`\n===== PAGE ${p} =====`);
  for (const it of tc.items) {
    const x = it.transform[4], y = it.transform[5];
    const w = it.width ?? 0;
    const str = it.str;
    if (!str.trim()) continue;
    console.log(`x=${x.toFixed(1).padStart(6)} y=${y.toFixed(1).padStart(6)} w=${w.toFixed(1).padStart(6)} | ${str}`);
  }
}
