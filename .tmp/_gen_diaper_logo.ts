import { writeFileSync } from 'fs';
import { generateDiaperRecordPrintFormHtml } from '../apps/web/src/utils/diaperRecordPrintFormHtml';
import { injectPageLogo } from '../apps/web/src/utils/printPageLogo';

const patient: any = { 院友id: 1, 中文姓氏: '關', 中文名字: '賽杏', 中文姓名: '關賽杏', 床號: 'A101-1' };
const html = injectPageLogo(
  generateDiaperRecordPrintFormHtml([patient], '2026年10月', '善頤(福群)護老院'),
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
);
writeFileSync('.tmp/_diaper_logo.html', html);
const m = html.match(/@page[^}]+\}/g);
console.log(m ? m.join('\n') : 'no @page');
