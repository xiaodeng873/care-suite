// 用真實 printUtils 管線重現合併列印：scope → assemble → padOddPageDocuments
import { generateRestraintObservationHtml } from '../apps/web/src/utils/restraintObservationHtmlExporter';
import { extractPageConfig, pageContentBoxMm, scopeDocumentHtml, padOddPageDocuments } from '../apps/web/src/utils/printUtils';

declare const window: any;

const PX_PER_MM = 96 / 25.4;

const patient: any = {
  院友id: 1, 中文姓氏: '胡', 中文名字: '甜妹', 中文姓名: '胡甜妹',
  床號: 'C219-4', 性別: '女', 出生日期: '1933-01-07',
};
const assessment: any = {
  suggested_restraints: {
    '約束衣': { checked: true, usageConditions: '坐在椅上及躺在床上', allDay: true },
    '約束手套/連指手套': { checked: true, usageConditions: '坐在椅上及躺在床上', allDay: true },
  },
};
const html = generateRestraintObservationHtml({
  patient, records: [], assessment,
  dateRange: { start: '2026-12-16', end: '2026-12-19' },
  facilityName: '善頤(福群)護老院',
  includeDayNumber: true,
});

const pages = [html];
const parts = pages.map((page, i) => {
  const config = extractPageConfig(page);
  const widthPx = pageContentBoxMm(config).w * PX_PER_MM;
  return {
    config,
    ...scopeDocumentHtml(page, `print-doc-${i}`, 'scope', `box-sizing:border-box;width:${widthPx.toFixed(1)}px;`),
  };
});

const baseCss = `
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
  .no-print { display: none !important; }`;

const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>${baseCss}
</style>
${parts.map((p) => p.styles).join('\n')}
</head>
<body>
${parts.map((p) => p.body).join('\n')}
</body>
</html>`;

(window as any).__run = () => {
  document.open();
  document.write(combined);
  document.close();
  try {
    padOddPageDocuments(
      document,
      parts.map((p, i) => ({ selector: `.print-doc-${i}`, config: p.config })),
      `${baseCss}\n${parts.map((p) => p.styles).join('\n')}`
    );
  } catch (e) {
    console.error('pad failed', e);
  }
  document.title = 'READY';
};
