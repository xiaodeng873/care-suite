import { PDFDocument, PDFName, PDFHexString, rgb } from 'pdf-lib';
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

const TEXT_FIELD_NAMES = [
  'p1_surname_ch', 'p1_firstname_ch', 'p1_surname_en', 'p1_firstname_en',
  'p1_dob_dd', 'p1_dob_mm', 'p1_dob_yyyy',
  'p2_hkid_no', 'p2_hkid_issue_dd', 'p2_hkid_issue_mm', 'p2_hkid_issue_yy',
];

const isAscii = /^[\x20-\x7E]*$/;

function latin1Decode(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function latin1Encode(str: string): Uint8Array {
  return Uint8Array.from(str, c => c.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** /T 係 UTF-16BE hex string（可能帶 BOM），用 decodeText 解出純文字欄位名 */
function fieldNameOf(t: any): string {
  if (t && typeof t.decodeText === 'function') {
    try {
      const decoded = t.decodeText();
      if (decoded) return decoded;
    } catch {
      // 跌落去用原始格式
    }
  }
  const s = String(t.toString());
  return s.replace(/^\//, '').replace(/^\(|\)$/g, '');
}

function buildValues(patient: Patient): Record<string, string> {
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
  return values;
}

/**
 * 將值寫入 widget 嘅 /AP /N appearance stream：
 * 每個欄位嘅 AP 係「白底方框 + /Tx BMC ... <> Tj ... EMC」——
 * 白底方框用嚟蓋住原文件嘅 placeholder 符號，一定要保留；
 * 我哋只係將空文字 `<>` 換成實際值（中文欄位順手將字體轉做標楷體）。
 * 用 AP 而唔係直接畫頁面內容，係因為 widget AP 行得通 copyPages 合併
 * （字體程式唔會跌），頁面內容畫字就會跌。
 */
async function flateDecode(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function writeValueIntoAppearance(
  merged: PDFDocument,
  annotDict: any,
  fieldDict: any,
  value: string,
  cjkFont: Awaited<ReturnType<PDFDocument['embedFont']>>,
): Promise<void> {
  const ctx = merged.context;
  const apRef = annotDict.get(PDFName.of('AP'));
  if (!apRef) return;
  const apDict: any = ctx.lookup(apRef);
  if (!apDict) return;
  const nRef = apDict.get(PDFName.of('N'));
  if (!nRef) return;
  const nStream: any = ctx.lookup(nRef);
  const nDict: any = nStream.dict ?? nStream;
  const raw = latin1Decode(await flateDecode(new Uint8Array(nStream.contents)));

  const cjk = !isAscii.test(value);
  const hex = cjk
    ? bytesToHex(cjkFont.encodeText(value).asBytes())
    : bytesToHex(latin1Encode(value));

  let patched = raw;
  if (cjk) {
    // 中文字體：Helvetica 支援唔到，轉用嵌入嘅標楷體（AP 自帶 Resources，加個 Kaiu 入口）
    patched = patched.replace('/Helvetica 12 Tf', '/Kaiu 12 Tf');
  }
  if (!patched.includes('<> Tj')) return; // 唔係預期格式就唔郁佢
  patched = patched.replace('<> Tj', `<${hex}> Tj`);

  const oldRes: any = ctx.lookup(nDict.get(PDFName.of('Resources')));
  const oldFontDict: any = ctx.lookup(oldRes.get(PDFName.of('Font')));
  const helvRef = oldFontDict.get(PDFName.of('Helvetica'));
  const fontMap: Record<string, any> = { Helvetica: helvRef };
  if (cjk) fontMap.Kaiu = cjkFont.ref;

  const newStream = ctx.flateStream(latin1Encode(patched), {
    Type: PDFName.of('XObject'),
    Subtype: PDFName.of('Form'),
    BBox: nDict.get(PDFName.of('BBox')),
    Matrix: nDict.get(PDFName.of('Matrix')),
    Resources: { Font: fontMap },
  });
  apDict.set(PDFName.of('N'), ctx.register(newStream));

  // 同時寫 field /V 保存資料
  if (fieldDict && typeof fieldDict.set === 'function') {
    fieldDict.set(PDFName.of('V'), PDFHexString.fromText(value));
  }
}

/** 喺合併後嘅頁面搵欄位 widget（經 /Parent 對上 /T 欄位名） */
function findFieldAnnots(merged: PDFDocument): Map<string, { annot: any; field: any; pageIndex: number }> {
  const ctx = merged.context;
  const found = new Map<string, { annot: any; field: any; pageIndex: number }>();
  const pages = merged.getPages();
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const annots: any = pages[pageIndex].node.get(PDFName.of('Annots'));
    if (!annots) continue;
    const list: any[] = annots.asArray ? annots.asArray() : [annots];
    for (const ref of list) {
      const annot: any = ctx.lookup(ref);
      if (!annot) continue;
      const parentRef = annot.get(PDFName.of('Parent'));
      const field: any = parentRef ? ctx.lookup(parentRef) : annot;
      const t = field?.get?.(PDFName.of('T'));
      if (!t) continue;
      const name = fieldNameOf(t);
      if (TEXT_FIELD_NAMES.includes(name) && !found.has(`${pageIndex}:${name}`)) {
        found.set(`${pageIndex}:${name}`, { annot, field, pageIndex });
      }
    }
  }
  return found;
}

interface CheckboxHit {
  pageIndex: number;
  name: string;
  ref: any;
  rect: { x: number; y: number; width: number; height: number };
}

/** 搵出所有指定名嘅 checkbox widgets（連 annot ref，等陣要由頁面移除） */
function findCheckboxAnnots(merged: PDFDocument, names: string[]): CheckboxHit[] {
  const ctx = merged.context;
  const hits: CheckboxHit[] = [];
  const pages = merged.getPages();
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const annots: any = pages[pageIndex].node.get(PDFName.of('Annots'));
    if (!annots) continue;
    const list: any[] = annots.asArray ? annots.asArray() : [annots];
    for (const ref of list) {
      const annot: any = ctx.lookup(ref);
      if (!annot) continue;
      const parentRef = annot.get(PDFName.of('Parent'));
      const field: any = parentRef ? ctx.lookup(parentRef) : annot;
      const t = field?.get?.(PDFName.of('T'));
      if (!t) continue;
      const name = fieldNameOf(t);
      if (!names.includes(name)) continue;
      const rect: any = annot.get(PDFName.of('Rect'));
      const nums = rect.asArray().map((n: any) => Number(ctx.lookup(n)?.toString() ?? n.toString()));
      hits.push({ pageIndex, name, ref, rect: { x: nums[0], y: nums[1], width: nums[2] - nums[0], height: nums[3] - nums[1] } });
    }
  }
  return hits;
}

/** 由頁面 /Annots 移除指定 widget（rebuild 個 array） */
function removeAnnot(page: ReturnType<PDFDocument['getPage']>, ref: any): void {
  const annots: any = page.node.get(PDFName.of('Annots'));
  if (!annots) return;
  const kept = annots.asArray().filter((r: any) => r.toString() !== ref.toString());
  page.node.set(PDFName.of('Annots'), page.doc.context.obj(kept));
}

/**
 * 性別剔勾：唔用 checkbox AP（Chrome 打印管線對 widget 狀態嘅處理太飄忽），
 * 直接將 widget 移除，再喺頁面內容畫「白底方框（蓋住原文件符號）+ 邊框（+ ✓）」——
 * 頁面內容係最基本嘅 PDF 繪圖，打印一定出現。
 */
function flattenCheckbox(
  hit: CheckboxHit,
  page: ReturnType<PDFDocument['getPage']>,
  ticked: boolean,
): void {
  removeAnnot(page, hit.ref);
  const { x, y, width: w, height: h } = hit.rect;
  page.drawRectangle({
    x, y, width: w, height: h,
    color: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.8,
  });
  if (!ticked) return;
  // 用兩條線畫剔號 ✓（Helvetica 冇 ✓ 字符）
  const p1 = { x: x + w * 0.18, y: y + h * 0.5 };
  const p2 = { x: x + w * 0.42, y: y + h * 0.18 };
  const p3 = { x: x + w * 0.86, y: y + h * 0.78 };
  page.drawLine({ start: p1, end: p2, thickness: 1.4, color: rgb(0, 0, 0) });
  page.drawLine({ start: p2, end: p3, thickness: 1.4, color: rgb(0, 0, 0) });
}

/**
 * 生成衛生署疫苗接種同意書 PDF（可以多位院友）。
 *
 * 做法：master 頁面 copyPages 入 merged（widget annotations 連 AP 一齊複製，
 * 呢個路徑唔會跌字體），然後將每個欄位嘅值寫入佢嘅 AP——
 * 白底方框保留（蓋住原文件 placeholder）、值喺框內顯示、列印一定見到。
 */
export async function generateVaccineConsentPdfs(patients: Patient[]): Promise<Uint8Array> {
  const [formRes, fontRes] = await Promise.all([fetch(FORM_URL), fetch(FONT_URL)]);
  if (!formRes.ok) throw new Error(`無法載入同意書範本（${formRes.status}）`);
  if (!fontRes.ok) throw new Error(`無法載入中文字體（${fontRes.status}）`);
  const masterBytes = await formRes.arrayBuffer();
  const fontBytes = await fontRes.arrayBuffer();

  const merged = await PDFDocument.create();
  merged.registerFontkit(fontkit);
  // 標楷體只嵌入一次（subset）；所有院友嘅中文 AP 共用
  const cjkFont = await merged.embedFont(fontBytes, { subset: true });

  const pagesPerPatient: number[] = [];
  for (const patient of patients) {
    const master = await PDFDocument.load(masterBytes);
    const copied = await merged.copyPages(master, master.getPageIndices());
    copied.forEach(page => merged.addPage(page));
    pagesPerPatient.push(copied.length);
  }

  // 逐位院友：搵返佢嗰疊頁面嘅欄位 widgets，寫值入 AP
  let pageOffset = 0;
  for (let pi = 0; pi < patients.length; pi++) {
    const patient = patients[pi];
    const values = buildValues(patient);
    // [臨時診斷] 解決中文空白問題後會移除
    console.log('[vaccineConsent 診斷]', JSON.stringify({
      院友: `${patient.中文姓氏 ?? '(空)'}${patient.中文名字 ?? '(空)'}`,
      '將會寫入 AP 嘅值': Object.fromEntries(Object.entries(values).filter(([, v]) => v)),
    }));

    const fieldAnnots = findFieldAnnots(merged);
    for (const [key, { annot, field }] of fieldAnnots) {
      const [, name] = key.split(':');
      const pageIndex = Number(key.split(':')[0]);
      if (pageIndex < pageOffset || pageIndex >= pageOffset + pagesPerPatient[pi]) continue;
      const value = values[name];
      if (!value) continue;
      await writeValueIntoAppearance(merged, annot, field, value, cjkFont);
    }

    // 性別：移除 checkbox widgets，白框 + 剔勾直接畫入頁面內容（打印 100% 出現）
    const sexField = patient.性別 === '男' ? 'p1_sex_m' : patient.性別 === '女' ? 'p1_sex_f' : null;
    const sexAnnots = findCheckboxAnnots(merged, ['p1_sex_m', 'p1_sex_f'])
      .filter(c => c.pageIndex >= pageOffset && c.pageIndex < pageOffset + pagesPerPatient[pi]);
    for (const hit of sexAnnots) {
      flattenCheckbox(hit, merged.getPage(hit.pageIndex), hit.name === sexField);
    }

    pageOffset += pagesPerPatient[pi];
  }

  // [臨時診斷]
  const saved = await merged.save();
  console.log('[vaccineConsent 診斷] 完成，總 bytes =', saved.length, '院友數 =', patients.length);
  return saved;
}
