// 生成換片記錄 preview HTML（含 injectPageLogo 處理），輸出到 .tmp/diaper_preview.html
import { writeFileSync, mkdirSync } from 'node:fs';

const fakePatients = [
  { 中文姓名: '關蓉杏', 中文姓氏: '關', 中文名字: '蓉杏', 床號: 'A101-1' },
];

// import.meta.env.BASE_URL stub for printPageLogo
const { generateDiaperRecordPrintFormHtml } = await import('../apps/web/src/utils/diaperRecordPrintFormHtml.ts');
const { injectPageLogo } = await import('../apps/web/src/utils/printPageLogo.ts');

let html = generateDiaperRecordPrintFormHtml(fakePatients, '2026年09月', '善頤(福群)護老院');
html = injectPageLogo(html, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/diaper_preview.html', html, 'utf8');
console.log('written .tmp/diaper_preview.html');
