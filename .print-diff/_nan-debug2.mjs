import { PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import { inflateSync } from 'zlib';
import fs from 'fs';
const doc = await PDFDocument.load(fs.readFileSync('repro-nursing.pdf'));
const p = doc.getPages()[0];
const c = doc.context.lookup(p.node.get(PDFName.of('Contents')));
const raw = inflateSync(c.contents ?? c.getContents()).toString('latin1');
const tokens = raw.match(/\/[A-Za-z0-9_.+-]+|\[|\]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|\S/g) || [];
let i = 0;
const consumers = { cm: 6, re: 4, m: 2, l: 2, RG: 3, rg: 3, G: 1, g: 1, Tm: 6, Td: 2, TD: 2, w: 1, J: 1, j: 1, M: 1, ri: 1, i: 1, d: 0 /* array */, };
while (i < tokens.length) {
  const t = tokens[i++];
  if (t === 're') {
    const ops = tokens.slice(i - 5, i - 1);
    if (ops.some((v) => isNaN(Number(v)))) {
      console.log('bad re operands:', JSON.stringify(tokens.slice(i - 8, i + 2)), 'at token', i);
      break;
    }
  }
  if (t === 'm' || t === 'l') {
    const ops = tokens.slice(i - 3, i - 1);
    if (ops.some((v) => isNaN(Number(v)))) {
      console.log('bad', t, 'operands:', JSON.stringify(tokens.slice(i - 6, i + 2)), 'at token', i);
      break;
    }
  }
  // 簡易前進：對常見運算子略過運算元
  if (['cm','re','m','l','RG','rg','G','g','Tm','Td','TD','w'].includes(t)) i += consumers[t] ?? 0;
}
console.log('scan done, tokens:', tokens.length);
