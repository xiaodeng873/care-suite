import { PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import { inflateSync } from 'zlib';
import fs from 'fs';
const doc = await PDFDocument.load(fs.readFileSync('repro-nursing.pdf'));
const p = doc.getPages()[0];
const c = doc.context.lookup(p.node.get(PDFName.of('Contents')));
const raw = inflateSync(c.contents ?? c.getContents()).toString('latin1');
const tokens = raw.match(/\/[A-Za-z0-9_.+-]+|\[|\]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|\S/g) || [];
let i = 0;
const check = (op, n) => {
  const ops = tokens.slice(i - n - 1, i - 1).map(Number);
  if (ops.length !== n || ops.some(isNaN)) {
    console.log(`BAD ${op} operands:`, JSON.stringify(tokens.slice(i - n - 3, i + 1)), 'at token', i - 1);
    return true;
  }
  return false;
};
while (i < tokens.length) {
  const t = tokens[i++];
  if (t === 're' && check('re', 4)) break;
  if ((t === 'm' || t === 'l') && check(t, 2)) break;
  if (t === 'RG' && check('RG', 3)) break;
}
console.log('scan done');
