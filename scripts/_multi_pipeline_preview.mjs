// 瀏覽器版：驗證個人衛生 + 巡房記錄經 printCombinedHtml 後，第 2 頁起有冇頂部補償
const { generateHygieneRecordPrintFormHtml } = await import('../apps/web/src/utils/hygieneRecordPrintFormHtml.ts');
const { generatePatrolRoundsRangeHtml } = await import('../apps/web/src/utils/patrolRoundsHtmlExporter.ts');
const { injectPageLogo } = await import('../apps/web/src/utils/printPageLogo.ts');
const { printCombinedHtml } = await import('../apps/web/src/utils/printUtils.ts');

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PX_PER_MM = 96 / 25.4;
const out: string[] = [];

// ── 個人衛生（2 個月 = 2 頁）──
const patient = { 院友id: 1, 中文姓名: '測試甲', 中文姓氏: '測', 中文名字: '試甲', 床號: 'A101-1' };
let hygieneHtml = generateHygieneRecordPrintFormHtml(
  [patient as never],
  [
    { year: 2026, month: 9, recordsByPatient: new Map() },
    { year: 2026, month: 10, recordsByPatient: new Map() },
  ],
  '善頤(福群)護老院'
);
hygieneHtml = injectPageLogo(hygieneHtml, LOGO);
printCombinedHtml([hygieneHtml], 'hygiene-printform-iframe');

// ── 巡房（8 日 = 2 頁）──
let patrolHtml = generatePatrolRoundsRangeHtml({
  bedNumber: 'A101-1',
  startDate: '2026-09-01',
  endDate: '2026-09-20',
  rounds: [],
  facilityName: '善頤(福群)護老院',
});
patrolHtml = injectPageLogo(patrolHtml, LOGO);
printCombinedHtml([patrolHtml], 'patrol-print-iframe');

setTimeout(() => {
  const report = (iframeId: string, containerSel: string, label: string) => {
    const iframe = document.getElementById(iframeId);
    if (!iframe?.contentDocument) { out.push(`${label}: iframe missing`); return; }
    const doc = iframe.contentDocument;
    const wrapper = doc.querySelector('[class*="print-doc-"]') as HTMLElement | null;
    if (!wrapper) { out.push(`${label}: wrapper missing`); return; }
    const wPad = parseFloat(getComputedStyle(wrapper).paddingTop) / PX_PER_MM;
    const containers = Array.from(wrapper.querySelectorAll(containerSel)) as HTMLElement[];
    out.push(`${label}: wrapperPadTop=${wPad.toFixed(2)}mm containers=${containers.length}`);
    containers.forEach((c, i) => {
      const padTop = parseFloat(getComputedStyle(c).paddingTop) / PX_PER_MM;
      out.push(`  ${label} page${i + 1}: padTop=${padTop.toFixed(2)}mm height=${(c.getBoundingClientRect().height / PX_PER_MM).toFixed(1)}mm`);
    });
    const logos = doc.querySelectorAll('img.admission-page-logo');
    out.push(`  ${label} logo clones: ${logos.length}`);
  };
  report('hygiene-printform-iframe', '.container', 'hygiene');
  report('patrol-print-iframe', '.page', 'patrol');
  const pre = document.createElement('pre');
  pre.id = 'measure-results';
  pre.textContent = out.join('\n');
  document.body.appendChild(pre);
}, 4000);
