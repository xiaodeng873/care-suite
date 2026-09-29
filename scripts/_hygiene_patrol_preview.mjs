// 生成個人衛生 + 巡房 preview HTML（含 injectPageLogo），輸出到 .tmp/
import { writeFileSync, mkdirSync } from 'node:fs';

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const { generateHygieneRecordPrintFormHtml } = await import('../apps/web/src/utils/hygieneRecordPrintFormHtml.ts');
const { generatePatrolRoundsRangeHtml } = await import('../apps/web/src/utils/patrolRoundsHtmlExporter.ts');
const { injectPageLogo } = await import('../apps/web/src/utils/printPageLogo.ts');

const patient = { 院友id: 1, 中文姓名: '測試甲', 中文姓氏: '測', 中文名字: '試甲', 床號: 'A101-1' };
let hygiene = generateHygieneRecordPrintFormHtml(
  [patient],
  [
    { year: 2026, month: 9, recordsByPatient: new Map() },
    { year: 2026, month: 10, recordsByPatient: new Map() },
  ],
  '善頤(福群)護老院'
);
hygiene = injectPageLogo(hygiene, LOGO);

let patrol = generatePatrolRoundsRangeHtml({
  bedNumber: 'A101-1',
  startDate: '2026-09-01',
  endDate: '2026-09-20',
  rounds: [],
  facilityName: '善頤(福群)護老院',
});
patrol = injectPageLogo(patrol, LOGO);

mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/hygiene_preview.html', hygiene, 'utf8');
writeFileSync('.tmp/patrol_preview.html', patrol, 'utf8');
console.log('written hygiene + patrol previews');
