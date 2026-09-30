import { writeFileSync } from 'fs';
import { generateDiaperRecordPrintFormHtml } from '../apps/web/src/utils/diaperRecordPrintFormHtml';

const patient: any = { 院友id: 1, 中文姓氏: '關', 中文名字: '賽杏', 中文姓名: '關賽杏', 床號: 'A101-1' };
const html = generateDiaperRecordPrintFormHtml([patient], '2026年10月', '善頤(福群)護老院');
writeFileSync('.tmp/_diaper_preview.html', html);
console.log('written', html.length);
