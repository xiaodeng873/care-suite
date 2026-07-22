const fs = require('fs');
const { PDFParse } = require('pdf-parse');
(async () => {
  const pdf = fs.readFileSync('shots/_all.pdf');
  const parser = new PDFParse({ data: pdf });
  const res = await parser.getText();
  const pages = res.pages || [];
  console.log('pages:', pages.length);
  pages.forEach((pg, i) => {
    const t = (pg.text || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    console.log(`${String(i + 1).padStart(2)}: ${t}`);
  });
  await parser.destroy();
})();
