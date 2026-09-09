const { PDFDocument, PDFName } = require('pdf-lib');
const fs = require('node:fs');
(async () => {
  const doc = await PDFDocument.load(fs.readFileSync('apps/web/public/rvp202627_consent_form_acroform.pdf'));
  const form = doc.getForm();
  const f = form.getTextField('p1_surname_ch');
  const dict = f.acroField.dict;
  const t = dict.get(PDFName.of('T'));
  console.log('T class:', t?.constructor?.name, 'toString:', JSON.stringify(t?.toString()));
  // widget 個 /Parent 又係點
  const w = f.acroField.getWidgets()[0];
  const wd = w.dict ?? w;
  console.log('widget has Parent:', !!wd.get(PDFName.of('Parent')), 'widget has T:', wd.get(PDFName.of('T'))?.toString());
  console.log('field === widget?', wd === dict);
})();
