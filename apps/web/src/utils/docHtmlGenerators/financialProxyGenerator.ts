import financialProxyP1Template from '../../../../../doc_html/託管院友財物授權書P1.html?raw';
import financialProxyP2Template from '../../../../../doc_html/託管院友財物授權書P2.html?raw';
import { processDocHtmlTemplate, fillInputAfterLabel } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateFinancialProxyP1Html(ctx: DocumentGeneratorContext): Promise<string> {
  let html = processDocHtmlTemplate(financialProxyP1Template, ctx);
  if (ctx.contentMode !== 'blank') {
    // 第一個身份證號碼欄位屬院友（在委託人欄位之前）
    html = fillInputAfterLabel(html, '身份證號碼', ctx.patient.身份證號碼 || '');
  }
  return Promise.resolve(html);
}

export function generateFinancialProxyP2Html(ctx: DocumentGeneratorContext): Promise<string> {
  return Promise.resolve(processDocHtmlTemplate(financialProxyP2Template, ctx));
}
