import personalBelongingsTemplate from '../../../../../doc_html/私人物品記錄表.html?raw';
import { processDocHtmlTemplate, fillInputAfterLabel } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generatePersonalBelongingsHtml(ctx: DocumentGeneratorContext): Promise<string> {
  let html = processDocHtmlTemplate(personalBelongingsTemplate, ctx);
  if (ctx.contentMode !== 'blank') {
    // 第一個身份證號碼欄位屬院友（在監護人欄位之前）
    html = fillInputAfterLabel(html, '身份證號碼', ctx.patient.身份證號碼 || '');
  }
  return Promise.resolve(html);
}
