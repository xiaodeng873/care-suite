import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

const SRC = 'upload/rvp202627_consent_form_aged_18_or_above_chi.pdf';
const OUT = 'upload/rvp202627_consent_form_acroform_preview.pdf';
const MASTER = 'apps/web/public/rvp202627_consent_form_acroform.pdf';

const pdfDoc = await PDFDocument.load(fs.readFileSync(SRC));
const form = pdfDoc.getForm();
const pages = pdfDoc.getPages();

// text: [name, pageIdx, x, y(基線), w, h]
const textFields = [
  // 第1頁 疫苗接種者資料
  ['p1_surname_ch', 0, 64, 192, 146, 16],
  ['p1_firstname_ch', 0, 64, 148, 146, 16],
  ['p1_surname_en', 0, 306, 190, 224, 16],
  ['p1_firstname_en', 0, 306, 145, 224, 16],
  ['p1_dob_dd', 0, 101, 58, 44, 16],
  ['p1_dob_mm', 0, 176, 58, 44, 16],
  ['p1_dob_yyyy', 0, 256, 58, 77, 16],
  // 第2頁 身份證明文件
  ['p2_birthcert_no', 1, 203, 722, 210, 16],
  ['p2_hkid_no', 1, 155, 664, 210, 16],
  ['p2_hkid_issue_dd', 1, 119, 638, 46, 16],
  ['p2_hkid_issue_mm', 1, 194, 638, 46, 16],
  ['p2_hkid_issue_yy', 1, 274, 638, 46, 16],
  ['p2_returnpermit_no', 1, 58, 565, 170, 16],
  ['p2_returnpermit_issue_dd', 1, 119, 540, 46, 16],
  ['p2_returnpermit_issue_mm', 1, 194, 540, 46, 16],
  ['p2_returnpermit_issue_yy', 1, 274, 540, 46, 16],
  ['p2_doc_no', 1, 58, 477, 170, 16],
  ['p2_doc_issue_dd', 1, 122, 451, 46, 16],
  ['p2_doc_issue_mm', 1, 197, 451, 46, 16],
  ['p2_doc_issue_yy', 1, 277, 451, 46, 16],
  ['p2_staypermit_no', 1, 58, 375, 210, 16],
  ['p2_staypermit_until_dd', 1, 134, 349, 46, 16],
  ['p2_staypermit_until_mm', 1, 209, 349, 46, 16],
  ['p2_staypermit_until_yy', 1, 289, 349, 46, 16],
  ['p2_travel_class', 1, 137, 276, 100, 16],
  
  ['p2_travel_ref', 1, 221, 248, 320, 17],
  ['p2_adoption_no', 1, 61, 177, 245, 16],
  ['p2_exemption_no', 1, 182, 129, 372, 16],
  ['p2_exemption_file', 1, 122, 103, 432, 16],
  ['p2_exemption_hkid', 1, 290, 77, 203, 17],
  ['p2_exemption_issue_dd', 1, 122, 51, 46, 16],
  ['p2_exemption_issue_mm', 1, 197, 51, 46, 16],
  ['p2_exemption_issue_yy', 1, 277, 51, 46, 16],
  // 第3頁 疫苗接種同意
  ['p3_guardian_surname', 2, 102, 463.5, 60, 15],
  ['p3_guardian_firstname', 2, 231, 463.5, 115, 15],
  ['p3_guardian_phone', 2, 442, 463.5, 111, 15],
  ['p3_guardian_hkid', 2, 125, 379, 95, 15],
  ['p3_guardian_idclass', 2, 319, 371, 25, 11],
  ['p3_guardian_idno', 2, 450, 371, 103, 11],
  ['p3_sign_date', 2, 415, 314.5, 100, 14],
  ['p3_witness_name', 2, 330, 172, 180, 14],
  ['p3_witness_id', 2, 256, 90, 235, 17],
  ['p3_witness_sig_date', 2, 102, 61, 140, 14],
  ['p3_witness_phone', 2, 342, 60.5, 150, 14],
  // 第4頁 醫健通
  ['p4_self_sig_date', 3, 288, 534.5, 65, 14],
  ['p4_self_phone', 3, 446, 534.5, 107, 14],
  ['p4_proxy_relation', 3, 150, 380.5, 200, 14],
  ['p4_proxy_surname', 3, 102, 290.5, 150, 15],
  ['p4_proxy_hkid', 3, 359, 290.5, 194, 15],
  ['p4_proxy_firstname', 3, 102, 241.5, 150, 15],
  ['p4_proxy_phone', 3, 126, 187.5, 120, 15],
  ['p4_proxy_idclass', 3, 347, 187, 200, 13],
  ['p4_proxy_idno', 3, 347, 145, 200, 13],
  ['p4_proxy_sig_date', 3, 323, 102.5, 120, 14],
];

for (const [name, pi, x, y, w, h] of textFields) {
  form.createTextField(name).addToPage(pages[pi], {
    x, y, width: w, height: h,
    borderWidth: 0,
    fontSize: 11,
  });
}

// 只保留性別兩格 checkbox（填表時自動剔），其餘 checkbox 已按用戶要求移除
const checkboxes = [
  ['p1_sex_m', 0, 76.6, 105.8], ['p1_sex_f', 0, 115.6, 105.8],
];
for (const [name, pi, x, y] of checkboxes) {
  form.createCheckBox(name).addToPage(pages[pi], {
    x, y, width: 12, height: 12,
    borderWidth: 0,
  });
}

const out = await pdfDoc.save();
fs.writeFileSync(OUT, out);
fs.writeFileSync(MASTER, out);
console.log('saved:', OUT, 'and', MASTER, out.length, 'bytes,', textFields.length, 'text fields,', checkboxes.length, 'checkboxes');
