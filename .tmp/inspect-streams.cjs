const { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFRef } = require('pdf-lib');
const zlib = require('node:zlib');
const fs = require('node:fs');
(async () => {
  const doc = await PDFDocument.load(fs.readFileSync('.tmp/copied-draw-test.pdf'));
  const page = doc.getPage(0);
  const contents = page.node.get(PDFName.of('Contents'));
  const arr = contents instanceof PDFArray ? contents.asArray() : [contents];
  console.log('stream count:', arr.length);
  for (let i = 0; i < arr.length; i++) {
    const stream = doc.context.lookup(arr[i]);
    let raw;
    const dict = stream.dict ?? stream;
    const f = dict.get(PDFName.of('Filter'));
    const data = stream.contents ?? stream.getContents();
    if (f?.toString?.().includes('FlateDecode')) {
      raw = zlib.inflateSync(Buffer.from(data)).toString('latin1');
    } else {
      raw = Buffer.from(data).toString('latin1');
    }
    console.log(`--- stream[${i}] len=${raw.length} head ---`);
    console.log(raw.slice(0, 250).replace(/\r/g, ''));
    console.log(`--- stream[${i}] tail ---`);
    console.log(raw.slice(-250).replace(/\r/g, ''));
  }
})();
