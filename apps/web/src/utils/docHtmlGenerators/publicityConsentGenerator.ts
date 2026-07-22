import publicityConsentTemplate from '../../../../../doc_html/發佈資料同意書.html?raw';
import { processDocHtmlTemplate, fillInputAfterLabel, setInputTagValue } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generatePublicityConsentHtml(ctx: DocumentGeneratorContext): Promise<string> {
  let html = processDocHtmlTemplate(publicityConsentTemplate, ctx);
  if (ctx.contentMode !== 'blank') {
    const { patient } = ctx;
    const name = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
    const hkid = patient.身份證號碼 || '';
    // 院友 = 「(姓名) ___ (身份證號碼：___)」；本人/簽署人欄位留白
    html = fillInputAfterLabel(html, '[（(]姓名[）)]', name);
    html = html.replace(
      /([（(]姓名[）)][^<]{0,20}<input[^>]*>[^<]{0,40}身份證號碼[：:][^<]{0,10})(<input[^>]*>)/i,
      (_m, prefix: string, tag: string) => prefix + setInputTagValue(tag, hkid)
    );
  }
  return Promise.resolve(html);
}
