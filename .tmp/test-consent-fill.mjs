// Node 測試：模擬 vaccineConsentForm.ts 的填表邏輯，驗證中文 flatten 後能抽出文字（=列印一定見到）
import { PDFDocument, PDFName, PDFHexString, PDFBool } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';

const master = 'apps/web/public/rvp202627_consent_form_acroform.pdf';
const out = '.tmp/consent-test-filled.pdf';

const pdfDoc = await PDFDocument.load(fs.readFileSync(master));
pdfDoc.registerFontkit(fontkit);
const form = pdfDoc.getForm();
form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);

const cjkFont = await pdfDoc.embedFont(fs.readFileSync('apps/web/public/fonts/kaiu.ttf'), { subset: true });

const values = {
  // 模擬只有「中文姓名」全名、冇拆開姓氏/名字嘅院友（fallback：首字=姓，其餘=名）
  p1_surname_ch: '張',
  p1_firstname_ch: '行濤',
  p1_surname_en: 'CHEUNG',
  p1_firstname_en: 'Hang Tor',
  p1_dob_dd: '01',
  p1_dob_mm: '01',
  p1_dob_yyyy: '1918',
  p2_hkid_no: 'B645276(6)',
};
const isAscii = /^[\x20-\x7E]*$/;
const pages = pdfDoc.getPages();
for (const [name, value] of Object.entries(values)) {
  let field;
  try { field = form.getTextField(name); } catch { console.log('MISSING FIELD:', name); continue; }
  if (isAscii.test(value)) {
    field.setText(value);
  } else {
    field.acroField.dict.set(PDFName.of('V'), PDFHexString.fromText(value));
    const widget = field.acroField.getWidgets()[0];
    const rect = widget.getRectangle();
    const holder = widget.dict ?? widget;
    const pRef = typeof holder.get === 'function' ? holder.get(PDFName.of('P')) : undefined;
    const page = pages.find(p => p.ref === pRef) ?? pages[0];
    page.drawText(value, {
      x: rect.x + 4,
      y: rect.y + Math.max(1.5, (rect.height - 11) / 2),
      size: 11,
      font: cjkFont,
    });
    console.log('flattened:', name, 'at', JSON.stringify(rect));
  }
}
try { form.getCheckBox('p1_sex_f').check(); console.log('checkbox p1_sex_f checked'); }
catch (e) { console.log('checkbox fail:', e.message); }

fs.writeFileSync(out, await pdfDoc.save());
console.log('saved', out, fs.statSync(out).size, 'bytes');

// 用 pdfjs 抽文字驗證 flatten 內容
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(out)) }).promise;
let allText = '';
for (let i = 1; i <= doc.numPages; i++) {
  const tc = await (await doc.getPage(i)).getTextContent();
  allText += tc.items.map(it => it.str).join(' ') + '\n';
}
for (const expect of ['張', '行濤', 'CHEUNG', 'Hang Tor', 'B645276', '1918']) {
  console.log(expect.includes('黃') || expect.includes('碧') ? 'CJK' : '    ', expect, '→', allText.includes(expect) ? 'OK' : 'NOT FOUND');
}
