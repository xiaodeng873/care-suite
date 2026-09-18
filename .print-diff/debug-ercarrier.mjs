// debug v3：複製 padOdd 嘅檢測邏輯，dump 每個 wrapper 嘅 pageCount / carriers / clone 位置
import { chromium } from 'playwright-core';
import { createRequire } from 'module';
import esbuild from 'esbuild';
import path from 'path';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const stubDir = path.join(root, '.print-diff/stubs');

const result = await esbuild.build({
  entryPoints: [path.join(root, 'apps/web/src/utils/printUtils.ts')],
  bundle: true, write: false, format: 'iife', globalName: 'PrintUtils', platform: 'browser',
  plugins: [{
    name: 'stubs',
    setup(build) {
      build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
      build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
      build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    },
  }],
});
const iife = result.outputFiles[0].text;
const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
await page.addScriptTag({ content: iife });
const out = await page.evaluate(() => {
  const PX_PER_MM = 96 / 25.4;
  const pageRuleRe = /@page (pg-\d+-\d+) \{([^}]*)\}/g;
  const rules = {};
  for (const st of Array.from(document.querySelectorAll('style'))) {
    const css = st.textContent || '';
    let m;
    while ((m = pageRuleRe.exec(css))) rules[m[1]] = m[2];
  }
  const wrappers = Array.from(document.querySelectorAll('[class*="print-doc-"]')).filter((el) => /^print-doc-\d+-\d+$/.test(el.className));
  const list = wrappers.map((w) => {
    const pageName = (w.getAttribute('style') || '').match(/page:\s*(pg-\d+-\d+)/)?.[1];
    const body = rules[pageName] || '';
    const margin = body.match(/margin:\s*([^;}]+)/)?.[1]?.trim() || '0 0 0 0';
    const orientation = /size:\s*A4\s+landscape/i.test(body) ? 'landscape' : 'portrait';
    return { selector: '.' + w.className, name: w.className, config: { size: 'A4', orientation, margin }, pageName };
  });
  const mm = (px) => +(px / PX_PER_MM).toFixed(1);
  const report = [];
  list.forEach(({ selector, name, config }) => {
    const w = document.querySelector(selector);
    if (!w) return;
    const margins = (config.margin || '0 0 0 0').split(/\s+/).map((v) => parseFloat(v) || 0);
    const [mt, mr, mb, ml] = margins;
    const paperH = config.orientation === 'landscape' ? 210 : 297;
    const contentH = paperH - mt - mb;
    const contentPx = contentH * PX_PER_MM;
    const kids = Array.from(w.children).filter((el) => !(el.classList.contains('punch-guide-fixed') || el.classList.contains('admission-page-logo')));
    report.push({
      name, orient: config.orientation, margin: config.margin,
      wrapperHm: mm(w.getBoundingClientRect().height),
      contentHm: contentH,
      kids: kids.map((el) => {
        const cs = getComputedStyle(el);
        return {
          cls: (el.className || el.tagName).slice(0, 24),
          offsetTopMm: mm(el.offsetTop),
          hMm: mm(el.getBoundingClientRect().height),
          pbb: cs.pageBreakBefore, pba: cs.pageBreakAfter,
          bb: cs.breakBefore, ba: cs.breakAfter,
        };
      }),
    });
  });
  // 行 padOdd
  window.PrintUtils.padOddPageDocuments(document, list, '', true);
  // dump clones（screen flow 座標）
  report.forEach((r) => {
    const w = document.querySelector('.' + r.name);
    r.clones = Array.from(w.querySelectorAll('.punch-guide-fixed, img.admission-page-logo')).map((el) => {
      const host = el.parentElement?.parentElement;
      return {
        isLogo: el.tagName === 'IMG',
        leftMm: mm(parseFloat(el.style.left) || 0),
        topMm: mm(parseFloat(el.style.top) || 0),
        inCarrier: el.parentElement?.style?.position === 'absolute' && (el.parentElement.style.width === '0px' || el.parentElement.style.width === '0mm'),
        host: (host?.className || host?.tagName || '').slice(0, 20),
        hostOffsetTopMm: host ? mm(host.offsetTop) : null,
      };
    });
  });
  return report;
});
out.forEach((r) => {
  console.log(r.name, r.orient, 'margin', r.margin, 'wrapper', r.wrapperHm + 'mm', 'content', r.contentHm + 'mm');
  r.kids.forEach((k) => console.log('  kid:', JSON.stringify(k)));
  (r.clones || []).forEach((c) => console.log('  clone:', JSON.stringify(c)));
});
await browser.close();
