import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const SCALE = 1.5;
const PW = 595, PH = 842;

const data = new Uint8Array(fs.readFileSync(process.argv[2] || 'upload/rvp202627_consent_form_acroform_preview.pdf'));
const doc = await pdfjs.getDocument({ data }).promise;

for (let p = 1; p <= 4; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const items = tc.items.map(it => {
    const size = Math.abs(it.transform[3]) || 12;
    return { x: it.transform[4], y: it.transform[5], size, str: it.str.replace(/</g, '&lt;') };
  });
  const fields = (await page.getAnnotations())
    .filter(a => a.subtype === 'Widget')
    .map(a => {
      const [x1, y1, x2, y2] = a.rect;
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, name: a.fieldName || a.id };
    });
  const divs = items.map(i =>
    `<div class="t" style="left:${(i.x * SCALE).toFixed(1)}px;top:${((PH - i.y - i.size) * SCALE).toFixed(1)}px;font-size:${(i.size * SCALE).toFixed(1)}px">${i.str}</div>`
  ).join('\n');
  const boxes = fields.map(f =>
    `<div class="f" style="left:${(f.x * SCALE).toFixed(1)}px;top:${((PH - f.y - f.h) * SCALE).toFixed(1)}px;width:${(f.w * SCALE).toFixed(1)}px;height:${(f.h * SCALE).toFixed(1)}px" title="${f.name}"></div>`
  ).join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#fff}
.p{position:relative;width:${PW * SCALE}px;height:${PH * SCALE}px;background:#fff;overflow:hidden}
.t{position:absolute;font-family:"MingLiU","PMingLiU",serif;white-space:pre;color:#000}
.f{position:absolute;border:1.5px solid red;box-sizing:border-box;background:rgba(255,0,0,0.08)}
</style></head><body><div class="p">${divs}${boxes}</div></body></html>`;
  fs.writeFileSync(`.tmp/verify-p${p}.html`, html);
  console.log('page', p, 'items', items.length, 'fields', fields.length);
}
