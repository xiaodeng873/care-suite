import financialReturnTemplate from '../../../../../doc_html/領回託管財物證明書.html?raw';
import { processDocHtmlTemplate, fillInputAfterLabel } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateFinancialReturnHtml(ctx: DocumentGeneratorContext): Promise<string> {
  let html = processDocHtmlTemplate(financialReturnTemplate, ctx);
  if (ctx.contentMode !== 'blank') {
    const { patient } = ctx;
    const name = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
    // 只填「貴院院友(院友姓名)」；本人(姓名)/身份證號碼屬領回人，留白
    html = fillInputAfterLabel(html, '院友（院友姓名）', name);
  }
  return Promise.resolve(html);
}
