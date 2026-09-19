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
    const m6 = tokens.slice(i - 7, i - 1).map(Number);
    if (m6.length !== 6 || m6.some(isNaN)) {
      console.log('BAD cm operands at token', i - 1, ':', JSON.stringify(tokens.slice(i - 10, i + 1)));
      process.exit(0);
    }
    ctm = matMul(ctm, m6);
  }
}
console.log('cm ops all clean, tokens:', tokens.length);
