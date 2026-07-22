import outingConsentTemplate from '../../../../../doc_html/院友外出同意書.html?raw';
import { processDocHtmlTemplate, fillInputAfterLabel } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateOutingConsentHtml(ctx: DocumentGeneratorContext): Promise<string> {
  let html = processDocHtmlTemplate(outingConsentTemplate, ctx);
  if (ctx.contentMode !== 'blank') {
    const { patient } = ctx;
    const name = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
    const hkid = patient.身份證號碼 || '';
    // 「是院友(姓名) ___ 身份證號碼：___」— 此範本只有院友一組身份證欄位
    html = fillInputAfterLabel(html, '[（(]姓名[）)]', name);
    html = fillInputAfterLabel(html, '身份證號碼', hkid);
  }
  return Promise.resolve(html);
}
