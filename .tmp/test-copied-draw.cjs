const { PDFDocument, StandardFonts, PDFName } = require('pdf-lib');
const fs = require('node:fs');
const fontkit = require('@pdf-lib/fontkit');
(async () => {
  const masterBytes = fs.readFileSync('apps/web/public/rvp202627_consent_form_acroform.pdf');
  const merged = await PDFDocument.create();
  merged.registerFontkit(fontkit);
  const cjk = await merged.embedFont(fs.readFileSync('apps/web/public/fonts/kaiu.ttf'), { subset: true });
  const helv = await merged.embedFont(StandardFonts.Helvetica);

  const master = await PDFDocument.load(masterBytes);
  const form = master.getForm();
  const pages = master.getPages();
  const field = form.getTextField('p1_surname_ch');
  const widget = field.acroField.getWidgets()[0];
  const rect = widget.getRectangle();
  const pRef = (widget.dict ?? widget).get(PDFName.of('P'));
  const idx = pages.findIndex(p => p.ref === pRef);
  console.log('rect:', JSON.stringify(rect), 'pageIndex:', idx, 'pageSize:', pages[idx].getSize());

  const copied = await merged.copyPages(master, master.getPageIndices());
  copied.forEach(p => merged.addPage(p));
  const target = merged.getPage(idx);
  console.log('copied page size:', target.getSize());

  target.drawText('張', { x: rect.x + 4, y: rect.y + 3, size: 11, font: cjk });
  target.drawText('CHEUNG', { x: rect.x + 200, y: rect.y + 3, size: 11, font: helv });

  // 檢查 page node 嘅 Contents
  const contents = target.node.get(PDFName.of('Contents'));
  console.log('Contents type:', contents?.constructor?.name);

  fs.writeFileSync('.tmp/copied-draw-test.pdf', await merged.save());
  console.log('saved');
})();
