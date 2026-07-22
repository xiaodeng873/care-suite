import selfMedicationTemplate from '../../../../../doc_html/自行存放及使用藥物同意書.html?raw';
import { processDocHtmlTemplate, setInputTagValue } from './baseTemplateProcessor';
import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

export function generateSelfMedicationHtml(ctx: DocumentGeneratorContext): Promise<string> {
  let html = processDocHtmlTemplate(selfMedicationTemplate, ctx);
  if (ctx.contentMode !== 'blank') {
    const { patient } = ctx;
    const name = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
    // 「本人 ___ （住客姓名）」— 本人即院友，input 在標籤之前
    html = html.replace(
      /(本人\s*)(<input(?![^>]*checkbox)[^>]*>)(\s*（住客姓名）)/i,
      (_m, pre: string, tag: string, post: string) => pre + setInputTagValue(tag, name) + post
    );
  }
  return Promise.resolve(html);
}
