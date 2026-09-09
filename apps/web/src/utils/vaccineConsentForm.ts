import { PDFDocument, PDFName, PDFHexString, PDFBool } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Patient } from '../lib/database';

const FORM_URL = '/rvp202627_consent_form_acroform.pdf';
const FONT_URL = '/fonts/kaiu.ttf';

interface DateParts {
  dd: string;
  mm: string;
  yyyy: string;
}

/** 支援 'YYYY-MM-DD' 及 'DD/MM/YYYY' 兩種日期格式；解析不到則回 null */
function parseDateParts(value: string): DateParts | null {
  const v = (value || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) {
    return { yyyy: m[1], mm: m[2].padStart(2, '0'), dd: m[3].padStart(2, '0') };
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if (m) {
    return { dd: m[1].padStart(2, '0'), mm: m[2].padStart(2, '0'), yyyy: m[3] };
  }
  return null;
}

/**
 * 生成衛生署疫苗接種同意書 PDF（在 AcroForm master 上填入院友資料）。
 * 中文欄位唔可以用 field.setText()（Helvetica 唔支援中文）；
 * 改為用標楷體直接將文字畫上頁面（flatten，列印一定見到），
 * 兼寫 field 層 /V 保存資料；
 * 純英數欄位（日期、身份證號碼、英文姓名）用 setText 正式生成 appearance；
 * 性別用 pdf-lib check() 剔相應 checkbox。
 */
export async function generateVaccineConsentPdf(patient: Patient): Promise<Uint8Array> {
  const response = await fetch(FORM_URL);
  if (!response.ok) {
    throw new Error(`無法載入同意書範本（${response.status}）`);
  }
  const pdfDoc = await PDFDocument.load(await response.arrayBuffer());
  // Vite/npm 環境用嘅係 cjs/es build，唔會自動註冊 fontkit，必須手動註冊先 embed 到自訂字體
  pdfDoc.registerFontkit(fontkit);
  const form = pdfDoc.getForm();

  const values: Record<string, string> = {};
  values.p1_surname_ch = patient.中文姓氏 ?? '';
  values.p1_firstname_ch = patient.中文名字 ?? '';
  values.p1_surname_en = patient.英文姓氏 ?? '';
  values.p1_firstname_en = patient.英文名字 ?? '';
  const dob = patient.出生日期 ? parseDateParts(patient.出生日期) : null;
  if (dob) {
    values.p1_dob_dd = dob.dd;
    values.p1_dob_mm = dob.mm;
    values.p1_dob_yyyy = dob.yyyy;
  }
  values.p2_hkid_no = patient.身份證號碼 ?? '';
  const hkidIssue = patient.身份證簽發日期 ? parseDateParts(patient.身份證簽發日期) : null;
  if (hkidIssue) {
    values.p2_hkid_issue_dd = hkidIssue.dd;
    values.p2_hkid_issue_mm = hkidIssue.mm;
    values.p2_hkid_issue_yy = hkidIssue.yyyy.slice(-2);
  }

  form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
  const isAscii = /^[\x20-\x7E]*$/;
  // 中文字體（標楷體，subset 只嵌入用過嘅字，檔案細）
  let cjkFont: Awaited<ReturnType<PDFDocument['embedFont']>> | null = null;
  if (Object.values(values).some(v => v && !isAscii.test(v))) {
    const fontRes = await fetch(FONT_URL);
    if (!fontRes.ok) throw new Error(`無法載入中文字體（${fontRes.status}）`);
    cjkFont = await pdfDoc.embedFont(await fontRes.arrayBuffer(), { subset: true });
  }
  const pages = pdfDoc.getPages();
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue;
    let field;
    try {
      field = form.getTextField(name);
    } catch {
      continue;
    }
    if (isAscii.test(value)) {
      // 純英數：用 pdf-lib 正式 setText，會順手生成正確 appearance
      field.setText(value);
    } else if (cjkFont) {
      // 中文：setText 會因 Helvetica 唔支援而抛錯；直接將文字畫上頁面（flatten）。
      // 列印管線唔會重生成 form appearance，所以必須畫死落頁面先保證見到；
      // 同時寫 field 層 /V 保存資料。位置由 widget 矩形讀取（座標改咗都唔使改呢度）。
      field.acroField.dict.set(PDFName.of('V'), PDFHexString.fromText(value));
      const widget: any = field.acroField.getWidgets()[0];
      const rect = widget.getRectangle();
      const holder: any = widget.dict ?? widget;
      const pRef = typeof holder.get === 'function' ? holder.get(PDFName.of('P')) : undefined;
      const page = pages.find(p => p.ref === pRef) ?? pages[0];
      const fontSize = 11;
      page.drawText(value, {
        x: rect.x + 4,
        y: rect.y + Math.max(1.5, (rect.height - fontSize) / 2),
        size: fontSize,
        font: cjkFont,
      });
    }
  }

  // 性別：剔返相應 checkbox（pdf-lib checkbox appearance 用 ZapfDingbats，無中文問題）
  try {
    if (patient.性別 === '男') form.getCheckBox('p1_sex_m').check();
    else if (patient.性別 === '女') form.getCheckBox('p1_sex_f').check();
  } catch {
    // 範本冇 checkbox 時略過
  }

  return pdfDoc.save();
}
