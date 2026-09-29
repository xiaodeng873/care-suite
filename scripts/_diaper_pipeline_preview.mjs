// 瀏覽器版：行真實 printCombinedHtml 流程，量度換片記錄每頁頂部位置
const fakePatients = [
  { 中文姓名: '關蓉杏', 中文姓氏: '關', 中文名字: '蓉杏', 床號: 'A101-1' },
];

const { generateDiaperRecordPrintFormHtml } = await import('../apps/web/src/utils/diaperRecordPrintFormHtml.ts');
const { injectPageLogo } = await import('../apps/web/src/utils/printPageLogo.ts');
const { printCombinedHtml } = await import('../apps/web/src/utils/printUtils.ts');

let html = generateDiaperRecordPrintFormHtml(fakePatients, '2026年09月', '善頤(福群)護老院');
html = injectPageLogo(html, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

printCombinedHtml([html], 'diaper-printform-iframe');

// 等 padOddPageDocuments 完成後量度（print 喺 headless 係 no-op）
setTimeout(() => {
  const iframe = document.getElementById('diaper-printform-iframe');
  const out: string[] = [];
  const PX_PER_MM = 96 / 25.4;
  if (iframe && iframe.contentDocument) {
    const doc = iframe.contentDocument;
    const wrapper = doc.querySelector('.print-doc-0') as HTMLElement | null;
    if (wrapper) {
      const wRect = wrapper.getBoundingClientRect();
      out.push(`wrapper top=${(wRect.top / PX_PER_MM).toFixed(2)}mm padTop=${(parseFloat(getComputedStyle(wrapper).paddingTop) / PX_PER_MM).toFixed(2)}mm`);
      const pages = Array.from(wrapper.querySelectorAll('.page')) as HTMLElement[];
      pages.forEach((p, i) => {
        const inst = p.querySelector('.inst') as HTMLElement | null;
        const r = inst ? inst.getBoundingClientRect() : p.getBoundingClientRect();
        const padTop = parseFloat(getComputedStyle(p).paddingTop) / PX_PER_MM;
        // 每頁內容盒高 = 210 - 0(top) - 6(bottom) = 204mm
        const inSheet = (r.top / PX_PER_MM) % 210;
        out.push(`page${i + 1}: .inst y=${(r.top / PX_PER_MM).toFixed(2)}mm inSheet≈${inSheet.toFixed(2)}mm padTop=${padTop.toFixed(2)}mm height=${(p.getBoundingClientRect().height / PX_PER_MM).toFixed(2)}mm`);
      });
      const logos = Array.from(doc.querySelectorAll('img.admission-page-logo')) as HTMLElement[];
      out.push(`logo clones: ${logos.length}`);
      logos.slice(0, 6).forEach((l, i) => {
        out.push(`logo${i}: pos=${l.style.position} top=${l.style.top} left=${l.style.left}`);
      });
    } else {
      out.push('wrapper not found');
    }
  } else {
    out.push('iframe not found');
  }
  const pre = document.createElement('pre');
  pre.id = 'measure-results';
  pre.textContent = out.join('\n');
  document.body.appendChild(pre);
  document.title = 'MEASURED';
}, 3000);
