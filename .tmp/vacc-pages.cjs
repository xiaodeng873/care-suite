const fs = require('fs');
const path = require('path');
(async () => {
  globalThis.DOMMatrix = class DOMMatrix { constructor() {} };
  const pdfjs = await import('file:///' + path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.mjs').split(String.fromCharCode(92)).join('/'));
  const data = new Uint8Array(fs.readFileSync(path.join(__dirname, 'vacc-test.pdf')));
  const doc = await pdfjs.getDocument({ data }).promise;
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    const lines = {};
    for (const it of tc.items) {
      const y = Math.round(it.transform[5]);
      (lines[y] = lines[y] || []).push(it.str);
    }
    const rows = Object.keys(lines).sort((a,b)=>b-a).map(y => lines[y].join(' '));
    console.log('===== page ' + i + ' =====');
    console.log(rows.slice(0, 4).join(' | '));
    console.log('  ...最後: ' + rows.slice(-3).join(' | '));
  }
})().catch(e => { console.error(e.message); process.exit(1); });
