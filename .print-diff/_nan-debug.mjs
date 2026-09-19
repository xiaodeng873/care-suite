import { PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import { inflateSync } from 'zlib';
import fs from 'fs';
const doc = await PDFDocument.load(fs.readFileSync('repro-nursing.pdf'));
const p = doc.getPages()[0];
const c = doc.context.lookup(p.node.get(PDFName.of('Contents')));
const raw = inflateSync(c.contents ?? c.getContents()).toString('latin1');
const tokens = raw.match(/\/[A-Za-z0-9_.+-]+|\[|\]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|\S/g) || [];
const matMul = (m1, m2) => [
  m1[0]*m2[0]+m1[2]*m2[1], m1[1]*m2[0]+m1[3]*m2[1],
  m1[0]*m2[2]+m1[2]*m2[3], m1[1]*m2[2]+m1[3]*m2[3],
  m1[0]*m2[4]+m1[2]*m2[5]+m1[4], m1[1]*m2[4]+m1[3]*m2[5]+m1[5],
];
let ctm = [1,0,0,1,0,0];
const stack = [];
let i = 0;
while (i < tokens.length) {
  const t = tokens[i++];
  if (t === 'q') stack.push(ctm);
  else if (t === 'Q') ctm = stack.pop() || [1,0,0,1,0,0];
  else if (t === 'cm') {
    const m6 = tokens.slice(i, i + 6).map(Number);
    if (m6.some(isNaN)) { console.log('NaN cm operands at token', i, ':', JSON.stringify(tokens.slice(i-2, i+8))); process.exit(0); }
    i += 6;
    ctm = matMul(ctm, m6);
    if (ctm.some(isNaN)) { console.log('NaN ctm after mul, m6=', m6, 'prev ctm=', stack[stack.length-1]); process.exit(0); }
  }
}
console.log('no NaN in cm ops; total tokens', tokens.length);
// 搵可疑 token（非運算子非數字非名字）
const ops = new Set(['q','Q','cm','re','m','l','c','v','y','h','S','s','f','F','f*','B','B*','b','b*','n','W','W*','Do','RG','rg','G','g','BT','ET','Tf','Tm','Td','TD','Tj','TJ','gs','d','w','J','j','M','ri','i','cs','CS','sc','SC','scn','SCN','sh','BI','ID','EI']);
const weird = new Set();
for (const t of tokens) {
  if (ops.has(t) || /^[-+]?\d*\.?\d+([eE][-+]?\d+)?$/.test(t) || /^\/[A-Za-z0-9_.+-]+$/.test(t) || t === '[' || t === ']') continue;
  weird.add(t.length > 40 ? t.slice(0,40)+'…' : t);
}
console.log('weird tokens:', [...weird].slice(0, 20));
