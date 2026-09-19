import { PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import { inflateSync } from 'zlib';
import fs from 'fs';
const doc = await PDFDocument.load(fs.readFileSync('repro-nursing.pdf'));
const p = doc.getPages()[0];
const c = doc.context.lookup(p.node.get(PDFName.of('Contents')));
const raw = inflateSync(c.contents ?? c.getContents()).toString('latin1');
console.log(raw.slice(0, 600));
console.log('...has Do:', /\bDo\b/.test(raw), 'has re:', /\bre\b/.test(raw));
