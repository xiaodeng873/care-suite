import fs from 'fs';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const data = new Uint8Array(fs.readFileSync('C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch.pdf'));
const doc = await pdfjs.getDocument({ data }).promise;
const toMm = (pt) => +(pt / 72 * 25.4).toFixed(1);
for (let i = 1; i <= doc.numPages; i++) {
  const p = await doc.getPage(i);
  const ops = await p.getOperatorList();
  let cur = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const mul = (m1, m2) => [
    m1[0]*m2[0]+m1[2]*m2[1], m1[1]*m2[0]+m1[3]*m2[1],
    m1[0]*m2[2]+m1[2]*m2[3], m1[1]*m2[2]+m1[3]*m2[3],
    m1[0]*m2[4]+m1[2]*m2[5]+m1[4], m1[1]*m2[4]+m1[3]*m2[5]+m1[5],
  ];
  const placements = [];
  for (let j = 0; j < ops.fnArray.length; j++) {
    const fn = ops.fnArray[j], args = ops.argsArray[j];
    if (fn === pdfjs.OPS.save) stack.push(cur);
    else if (fn === pdfjs.OPS.restore) cur = stack.pop() || [1,0,0,1,0,0];
    else if (fn === pdfjs.OPS.transform) cur = mul(cur, args);
    else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
      placements.push({ x_mm: toMm(cur[4]), yTop_mm: toMm(p.view[3] - cur[5]), w_mm: toMm(cur[0]), h_mm: toMm(Math.abs(cur[3])) });
    }
  }
  console.log('page', i, JSON.stringify(placements));
}
